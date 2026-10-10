import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../app.js';
import { Application } from '../models/Application.js';

let mongo;
before(
  async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Application.deleteMany({});
});

test('health reflects MongoDB availability', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
});

test('database outages reject writes immediately instead of queuing them', async () => {
  await mongoose.disconnect();
  try {
    await request(app).get('/api/health').expect(503);
    const response = await request(app)
      .post('/api/applications')
      .send({ company: 'Do not queue', role: 'Engineer' })
      .expect(503);
    assert.match(response.body.message, /database is unavailable/);
  } finally {
    await mongoose.connect(mongo.getUri());
  }
  assert.equal(await Application.countDocuments(), 0);
});

test('create, persist, edit, list and delete an application', async () => {
  const created = await request(app)
    .post('/api/applications')
    .send({ company: '  Acme  ', role: 'Engineer', notes: 'Follow up' })
    .expect(201);
  const id = created.body.application._id;
  assert.equal(created.body.application.company, 'Acme');
  assert.equal(created.body.application.status, 'Wishlist');
  assert.equal((await Application.findById(id)).notes, 'Follow up');
  await request(app).patch(`/api/applications/${id}`).send({ status: 'Interview' }).expect(200);
  const list = await request(app).get('/api/applications').expect(200);
  assert.equal(list.body.applications.length, 1);
  assert.equal(list.body.applications[0].status, 'Interview');
  assert.equal(list.body.applications[0].company, 'Acme');
  await request(app).delete(`/api/applications/${id}`).expect(204);
  assert.equal(await Application.countDocuments(), 0);
  await request(app).delete(`/api/applications/${id}`).expect(404);
});

test('reject invalid fields, dates, unsafe links, and MongoDB operators', async () => {
  for (const invalid of [
    { company: ' ', role: 'Engineer' },
    { company: 'Acme', role: 'Engineer', status: 'Unknown' },
    { company: 'Acme', role: 'Engineer', appliedDate: '2026-02-30' },
    { company: 'Acme', role: 'Engineer', url: 'javascript:alert(1)' },
    { company: { $ne: null }, role: 'Engineer' },
    { company: 'Acme', role: 'Engineer', $set: { status: 'Offer' } },
  ])
    await request(app).post('/api/applications').send(invalid).expect(400);
  assert.equal(await Application.countDocuments(), 0);
});

test('validate patches and distinguish malformed IDs from missing records', async () => {
  const { _id } = await Application.create({
    company: 'Acme',
    role: 'Engineer',
    status: 'Applied',
  });
  await request(app).patch(`/api/applications/${_id}`).send({}).expect(400);
  await request(app).patch(`/api/applications/${_id}`).send({ status: 'invalid' }).expect(400);
  await request(app).patch('/api/applications/bad-id').send({ status: 'Offer' }).expect(400);
  await request(app)
    .patch(`/api/applications/${new mongoose.Types.ObjectId()}`)
    .send({ status: 'Offer' })
    .expect(404);
  assert.equal((await Application.findById(_id)).status, 'Applied');
});

test('search uses literal text and can be combined with a status filter', async () => {
  await Application.create([
    { company: 'A.cme', role: 'Frontend Engineer', status: 'Applied' },
    { company: 'Acme', role: 'Backend Engineer', status: 'Interview' },
  ]);
  const literal = await request(app).get('/api/applications').query({ q: '.' }).expect(200);
  assert.equal(literal.body.applications.length, 1);
  const filtered = await request(app)
    .get('/api/applications')
    .query({ q: 'ENGINEER', status: 'Interview' })
    .expect(200);
  assert.equal(filtered.body.applications.length, 1);
  assert.equal(filtered.body.applications[0].company, 'Acme');
  await request(app).get('/api/applications').query({ status: 'invalid' }).expect(400);
  await request(app).get('/api/applications').query({ 'q[$ne]': 'x' }).expect(200);
});

test('malformed JSON and unknown API routes return JSON errors', async () => {
  await request(app)
    .post('/api/applications')
    .set('Content-Type', 'application/json')
    .send('{bad')
    .expect(400);
  const response = await request(app).get('/api/unknown').expect(404);
  assert.equal(response.body.message, 'API endpoint not found');
});
