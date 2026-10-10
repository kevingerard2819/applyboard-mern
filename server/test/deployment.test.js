import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

let mongo;
let app;
before(
  async () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    ({ app } = await import('../app.js'));
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test('Render HTTPS forwarding supports same-origin auth and Secure cookies', async () => {
  assert.equal(app.get('trust proxy'), 1);
  const response = await request(app)
    .post('/api/auth/register')
    .set('Host', 'applyboard.example')
    .set('X-Forwarded-Proto', 'https')
    .set('X-Forwarded-For', '203.0.113.10')
    .set('Origin', 'https://applyboard.example')
    .send({ name: 'Hosted User', email: 'hosted@example.test', password: 'hosted-password-123' })
    .expect(201);
  assert.match(response.headers['set-cookie'][0], /Secure/);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
  await request(app)
    .post('/api/auth/logout')
    .set('Cookie', cookie)
    .set('Host', 'applyboard.example')
    .set('X-Forwarded-Proto', 'https')
    .set('Origin', 'https://untrusted.example')
    .expect(403);
  await request(app)
    .post('/api/auth/logout')
    .set('Cookie', cookie)
    .set('Host', 'applyboard.example')
    .set('X-Forwarded-Proto', 'https')
    .set('Origin', 'https://applyboard.example')
    .expect(204);
});
