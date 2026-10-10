import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../api.js';

afterEach(() => mock.restoreAll());

test('unauthorized auth requests retain HTTP status and use the auth endpoint', async () => {
  mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, '/api/auth/me');
    return Response.json({ message: 'Please sign in to continue.' }, { status: 401 });
  });
  await assert.rejects(request('/me', {}, '/api/auth'), { status: 401 });
});

test('proxy HTML errors produce a readable message instead of a JSON parser error', async () => {
  mock.method(
    globalThis,
    'fetch',
    async () => new Response('<html>Unavailable</html>', { status: 502 }),
  );
  await assert.rejects(request(), /unexpected response/);
});

test('connection failures and timeouts produce actionable errors', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(request(), /Could not reach the server/);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => {
    throw new DOMException('Timed out', 'TimeoutError');
  });
  await assert.rejects(request(), /took too long/);
});

test('aborted load requests retain cancellation so callers can ignore them', async () => {
  const controller = new AbortController();
  controller.abort();
  mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.signal.aborted, true);
    throw new DOMException('Cancelled', 'AbortError');
  });
  await assert.rejects(request('', { signal: controller.signal }), { name: 'AbortError' });
});

test('validation details and general API errors are preserved', async () => {
  mock.method(globalThis, 'fetch', async () =>
    Response.json(
      {
        message: 'Check the application details',
        errors: { fieldErrors: { company: ['Company is required'] } },
      },
      { status: 400 },
    ),
  );
  await assert.rejects(request(), /Company is required/);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () =>
    Response.json({ message: 'Application not found' }, { status: 404 }),
  );
  await assert.rejects(request(), /Application not found/);
});

test('successful JSON and bodyless deletes return their expected values', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ applications: [] }));
  assert.deepEqual(await request(), { applications: [] });
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await request('/id', { method: 'DELETE' }), null);
});
