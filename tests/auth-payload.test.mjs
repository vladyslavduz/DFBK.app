import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { fixture } from './helpers/backend.mjs';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

const { handleAuth } = await vite.ssrLoadModule('/worker/routes/auth.ts');
const { hashPassword } = await vite.ssrLoadModule('/worker/lib/password.ts');
const originalFetch = globalThis.fetch;

after(async () => {
  globalThis.fetch = originalFetch;
  await vite.close();
});

function request(path, rawBody) {
  return new Request('https://dfbk.app' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://dfbk.app',
    },
    body: rawBody,
  });
}

async function jsonResult(response) {
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  return { status: response.status, body: await response.json() };
}

const malformedCases = [
  ['malformed JSON', '{'],
  ['null', 'null'],
  ['array', '[]'],
  ['email object', JSON.stringify({ email: {}, password: 'TestPassword123!' })],
  ['email number', JSON.stringify({ email: 123, password: 'TestPassword123!' })],
  ['password object', JSON.stringify({ email: 'test@example.com', password: {} })],
  ['password array', JSON.stringify({ email: 'test@example.com', password: [] })],
  ['password number', JSON.stringify({ email: 'test@example.com', password: 123 })],
];

for (const path of ['/api/auth/login', '/api/auth/register']) {
  for (const [name, rawBody] of malformedCases) {
    test(`${path} rejects ${name} with stable 400 JSON`, async () => {
      const { db, env } = await fixture();
      const response = await handleAuth(request(path, rawBody), env, path);
      assert.ok(response);
      const result = await jsonResult(response);
      assert.equal(result.status, 400);
      assert.equal(result.body.ok, false);
      assert.equal(
        result.body.error,
        name === 'malformed JSON' ? 'INVALID_JSON' : 'INVALID_REQUEST_BODY'
      );
      db.close();
    });
  }

  test(`${path} preserves missing-field behavior for empty object`, async () => {
    const { db, env } = await fixture();
    const response = await handleAuth(request(path, '{}'), env, path);
    assert.ok(response);
    const result = await jsonResult(response);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      ok: false,
      error: 'EMAIL_AND_PASSWORD_REQUIRED',
    });
    db.close();
  });
}

test('login preserves successful verified-user behavior', async () => {
  const { db, env } = await fixture();
  const password = 'TestPassword123!';
  const passwordHash = await hashPassword(password);
  db.prepare('UPDATE users SET password_hash=?, email_verified=1 WHERE id=?')
    .run(passwordHash, 'user');

  const response = await handleAuth(
    request('/api/auth/login', JSON.stringify({
      email: ' USER@EXAMPLE.COM ',
      password,
    })),
    env,
    '/api/auth/login'
  );

  assert.ok(response);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.user.email, 'user@example.com');
  assert.equal(body.user.emailVerified, true);
  assert.match(response.headers.get('set-cookie') ?? '', /dfbk_session=/);
  db.close();
});

test('register preserves successful behavior and normalized email', async () => {
  const { db, env } = await fixture();
  env.RESEND_API_KEY = 'fixture';
  env.EMAIL_FROM = 'DFBK.app <noreply@auth.dfbk.app>';

  globalThis.fetch = async () => new Response('{}', { status: 200 });

  try {
    const response = await handleAuth(
      request('/api/auth/register', JSON.stringify({
        email: ' NEW.USER@EXAMPLE.COM ',
        password: 'TestPassword123!',
      })),
      env,
      '/api/auth/register'
    );

    assert.ok(response);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.user.email, 'new.user@example.com');
    assert.equal(body.user.emailVerified, false);
    assert.equal(body.verificationEmailSent, true);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM users WHERE email=?')
        .get('new.user@example.com').count,
      1
    );
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});
