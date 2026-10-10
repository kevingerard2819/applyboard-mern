import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import httpRequest from 'supertest';
import { app } from '../app.js';
import { Application } from '../models/Application.js';
import { User, Session } from '../auth.js';

let mongo;
let client;
let userId;
const request = () => client;
before(
  async () => {
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([User.init(), Session.init()]);
    client = httpRequest.agent(app);
    const registered = await client
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'owner@example.test', password: 'test-password-123' })
      .expect(201);
    userId = registered.body.user._id;
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
  assert.equal(created.body.application.followUpDate, '');
  assert.equal(created.body.application.interviewAt, '');
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
    userId,
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
    { userId, company: 'A.cme', role: 'Frontend Engineer', status: 'Applied' },
    { userId, company: 'Acme', role: 'Backend Engineer', status: 'Interview' },
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

test('scheduling persists, rejects invalid dates, and completion preserves application and interview details', async () => {
  const created = await request(app)
    .post('/api/applications')
    .send({
      company: 'Acme',
      role: 'Engineer',
      notes: 'Keep this',
      followUpDate: '2026-10-10',
      nextStep: ' Email recruiter ',
      interviewAt: '2026-10-12T09:30:00+04:00',
      interviewNotes: 'Technical round',
    })
    .expect(201);
  const id = created.body.application._id;
  const stored = await Application.findById(id);
  assert.equal(stored.nextStep, 'Email recruiter');
  assert.equal(stored.interviewAt, '2026-10-12T09:30:00+04:00');
  for (const invalid of [
    { followUpDate: '2026-02-30' },
    { interviewAt: '2026-10-12T09:30' },
    { interviewAt: 'nonsense' },
    { nextStep: 'x'.repeat(201) },
  ]) {
    await request(app).patch(`/api/applications/${id}`).send(invalid).expect(400);
  }
  await request(app)
    .patch(`/api/applications/${id}`)
    .send({ followUpDate: '', nextStep: '' })
    .expect(200);
  const result = await request(app).get('/api/applications').expect(200);
  const saved = result.body.applications[0];
  assert.equal(saved.followUpDate, '');
  assert.equal(saved.nextStep, '');
  assert.equal(saved.company, 'Acme');
  assert.equal(saved.notes, 'Keep this');
  assert.equal(saved.interviewNotes, 'Technical round');
  assert.equal(saved.interviewAt, stored.interviewAt);
});

test('multiple interview rounds persist, reject duplicate IDs, and keep unrelated fields', async () => {
  const rounds = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      label: ' Recruiter screen ',
      at: '2026-10-11T10:00:00Z',
      status: 'Completed',
      notes: 'Discussed role',
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      label: 'Technical',
      at: '2026-10-13T10:00:00Z',
      status: 'Scheduled',
      notes: '',
    },
  ];
  const created = await request(app)
    .post('/api/applications')
    .send({ company: 'Acme', role: 'Engineer', notes: 'Keep', interviewRounds: rounds })
    .expect(201);
  const id = created.body.application._id;
  assert.equal(created.body.application.interviewRounds[0].label, 'Recruiter screen');
  for (const invalid of [
    [rounds[0], rounds[0]],
    [{ ...rounds[0], status: 'Passed' }],
    [{ ...rounds[0], at: 'bad' }],
    [{ ...rounds[0], label: '' }],
    [{ ...rounds[0], activity: [] }],
  ]) {
    await request(app)
      .patch(`/api/applications/${id}`)
      .send({ interviewRounds: invalid })
      .expect(400);
  }
  await request(app).patch(`/api/applications/${id}`).send({ interviewRounds: [] }).expect(200);
  const saved = await Application.findById(id);
  assert.equal(saved.interviewRounds.length, 0);
  assert.equal(saved.notes, 'Keep');
  assert.ok(saved.activity.some((entry) => entry.message === 'Interview schedule updated'));
  assert.ok(saved.activity.some((entry) => entry.message === 'Interview round removed: Technical'));
});

test('activity is server-owned, persisted, unchanged by no-op patches, and capped at 50 entries', async () => {
  await request(app)
    .post('/api/applications')
    .send({ company: 'Acme', role: 'Engineer', activity: [{ message: 'Fake' }] })
    .expect(400);
  const created = await request(app)
    .post('/api/applications')
    .send({ company: 'Acme', role: 'Engineer' })
    .expect(201);
  const id = created.body.application._id;
  assert.equal(created.body.application.activity[0].message, 'Application created');
  await request(app).patch(`/api/applications/${id}`).send({ status: 'Wishlist' }).expect(200);
  assert.equal((await Application.findById(id)).activity.length, 1);
  await request(app).patch(`/api/applications/${id}`).send({ activity: [] }).expect(400);
  await request(app)
    .patch(`/api/applications/${id}`)
    .send({ status: 'Applied', followUpDate: '2026-10-11' })
    .expect(200);
  let saved = await Application.findById(id);
  assert.ok(
    saved.activity.some((entry) => entry.message === 'Status changed from Wishlist to Applied'),
  );
  assert.ok(saved.activity.some((entry) => entry.message === 'Follow-up scheduled for 2026-10-11'));
  await Application.findByIdAndUpdate(id, {
    $set: {
      activity: Array.from({ length: 50 }, (_, index) => ({
        message: `Old ${index}`,
        at: new Date(),
      })),
    },
  });
  await request(app).patch(`/api/applications/${id}`).send({ role: 'Senior Engineer' }).expect(200);
  saved = await Application.findById(id);
  assert.equal(saved.activity.length, 50);
  assert.equal(saved.activity[0].message, 'Old 1');
  assert.equal(saved.activity[49].message, 'Application details updated');
});
