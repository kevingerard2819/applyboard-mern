import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../app.js';
import { User, Session } from '../auth.js';
import { Application } from '../models/Application.js';

let mongo;
let first;
let second;
let cookie;
let recordId;
const account = {
  name: 'First User',
  email: 'first@example.test',
  password: 'correct-password-123',
};
before(
  async () => {
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([User.init(), Session.init()]);
    first = request.agent(app);
    second = request.agent(app);
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('anonymous application requests are rejected', async () => {
  await request(app).get('/api/applications').expect(401);
  await request(app)
    .post('/api/applications')
    .send({ company: 'Acme', role: 'Engineer' })
    .expect(401);
  await request(app).get('/api/auth/me').expect(401);
});
test('registration hashes passwords and returns only public profile with protected session cookie', async () => {
  await first
    .post('/api/auth/register')
    .send({ ...account, password: 'short' })
    .expect(400);
  await first
    .post('/api/auth/register')
    .send({ ...account, admin: true })
    .expect(400);
  const result = await first
    .post('/api/auth/register')
    .send({ ...account, email: ' FIRST@example.test ' })
    .expect(201);
  assert.deepEqual(Object.keys(result.body.user).sort(), ['_id', 'email', 'name']);
  assert.equal(result.body.user.email, account.email);
  cookie = result.headers['set-cookie'][0].split(';')[0];
  assert.match(result.headers['set-cookie'][0], /HttpOnly/);
  assert.match(result.headers['set-cookie'][0], /SameSite=Lax/);
  const stored = await User.findOne({ email: account.email }).select('+passwordHash');
  assert.notEqual(stored.passwordHash, account.password);
  assert.match(stored.passwordHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.notEqual((await Session.findOne({ userId: stored._id })).tokenHash, cookie.split('=')[1]);
  await first.get('/api/auth/me').expect(200);
  await request(app).post('/api/auth/register').send(account).expect(409);
});
test('incorrect credentials are rejected, login rotates session, and owners are isolated', async () => {
  const bad = await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: 'wrong-password-123' })
    .expect(401);
  const missing = await request(app)
    .post('/api/auth/login')
    .send({ email: 'missing@example.test', password: 'wrong-password-123' })
    .expect(401);
  assert.equal(bad.body.message, missing.body.message);
  await first
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password })
    .expect(200);
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  await second
    .post('/api/auth/register')
    .send({ ...account, name: 'Second User', email: 'second@example.test' })
    .expect(201);
  const created = await first
    .post('/api/applications')
    .send({ company: 'Private Company', role: 'Engineer' })
    .expect(201);
  recordId = created.body.application._id;
  assert.equal((await first.get('/api/applications').expect(200)).body.applications.length, 1);
  assert.equal((await second.get('/api/applications').expect(200)).body.applications.length, 0);
  await second.patch(`/api/applications/${recordId}`).send({ status: 'Offer' }).expect(404);
  await second.delete(`/api/applications/${recordId}`).expect(404);
  await first
    .patch(`/api/applications/${recordId}`)
    .send({ userId: (await second.get('/api/auth/me')).body.user._id })
    .expect(400);
  assert.equal((await Application.findById(recordId)).status, 'Wishlist');
});
test('unowned legacy data remains private and cross-origin writes are rejected', async () => {
  await Application.create({ company: 'Legacy', role: 'Engineer' });
  assert.equal((await first.get('/api/applications').expect(200)).body.applications.length, 1);
  await first
    .patch(`/api/applications/${recordId}`)
    .set('Origin', 'https://untrusted.example')
    .send({ status: 'Offer' })
    .expect(403);
  await first.post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site').expect(403);
  await first
    .patch(`/api/applications/${recordId}`)
    .set('Origin', 'http://127.0.0.1:5173')
    .send({ status: 'Applied' })
    .expect(200);
});
test('expired sessions cannot read data and logout invalidates the server session', async () => {
  const expires = await request
    .agent(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password })
    .expect(200);
  const expiredCookie = expires.headers['set-cookie'][0].split(';')[0];
  const token = expiredCookie.split('=')[1];
  const { createHash } = await import('node:crypto');
  await Session.updateOne(
    { tokenHash: createHash('sha256').update(token).digest('hex') },
    { expiresAt: new Date(Date.now() - 1000) },
  );
  await request(app).get('/api/applications').set('Cookie', expiredCookie).expect(401);
  const active = await first
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password })
    .expect(200);
  const activeCookie = active.headers['set-cookie'][0].split(';')[0];
  await first.post('/api/auth/logout').expect(204);
  await first.get('/api/applications').expect(401);
  await request(app).get('/api/auth/me').set('Cookie', activeCookie).expect(401);
});
test('demo visitors get isolated seeded workspaces, editable records and expiring sessions', async () => {
  const demoA = request.agent(app);
  const demoB = request.agent(app);
  const resultA = await demoA.post('/api/auth/demo').expect(201);
  const resultB = await demoB.post('/api/auth/demo').expect(201);
  assert.equal(resultA.body.user.isDemo, true);
  assert.notEqual(resultA.body.user._id, resultB.body.user._id);
  const listA = (await demoA.get('/api/applications').expect(200)).body.applications;
  const listB = (await demoB.get('/api/applications').expect(200)).body.applications;
  assert.equal(listA.length, 8);
  assert.equal(listB.length, 8);
  assert.equal(new Set(listA.map((record) => record.status)).size, 5);
  assert.ok(listA.some((record) => record.interviewRounds.length > 0));
  assert.ok(listA.some((record) => record.followUpDate));
  assert.ok(listA.every((record) => record.expiresAt));
  assert.equal((await second.get('/api/applications').expect(200)).body.applications.length, 0);
  await demoA.patch(`/api/applications/${listA[0]._id}`).send({ status: 'Offer' }).expect(200);
  await demoB.patch(`/api/applications/${listA[0]._id}`).send({ status: 'Offer' }).expect(404);
  const newRecord = await demoA
    .post('/api/applications')
    .send({ company: 'Demo addition', role: 'Engineer' })
    .expect(201);
  const demoUser = await User.findById(resultA.body.user._id);
  assert.equal(
    new Date(newRecord.body.application.expiresAt).getTime(),
    demoUser.expiresAt.getTime(),
  );
  assert.ok(demoUser.expiresAt.getTime() <= Date.now() + 24 * 60 * 60 * 1000);
  const session = await Session.findOne({ userId: demoUser._id });
  assert.ok(Math.abs(session.expiresAt.getTime() - demoUser.expiresAt.getTime()) < 100);
  await User.updateOne({ _id: demoUser._id }, { expiresAt: new Date(Date.now() - 1000) });
  await demoA.get('/api/applications').expect(401);
  await demoB.get('/api/applications').expect(200);
  const normalUser = await User.findOne({ email: account.email });
  assert.equal(normalUser.expiresAt, undefined);
});

test('authentication attempts are limited', async () => {
  let response;
  for (let count = 0; count < 21; count++) {
    response = await request(app).post('/api/auth/login').send({ email: 'invalid', password: '' });
    if (response.status === 429) break;
  }
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers['retry-after']) > 0);
});
