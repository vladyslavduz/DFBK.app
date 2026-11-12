import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { fixture } from './helpers/backend.mjs';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
const { default: worker } = await vite.ssrLoadModule('/worker/index.ts');
const { hashPassword } = await vite.ssrLoadModule('/worker/lib/password.ts');
after(() => vite.close());

const origin = 'https://dfbk.app';
const oldPassword = 'Old-test-password!';
const newPassword = 'New-test-password!';

async function setup(t) {
  const { db, env } = await fixture();
  t.after(() => db.close());
  const migration = new URL('../database/tasks/2026-11-12-password-reset.sql', import.meta.url);
  db.exec(readFileSync(migration, 'utf8'));
  env.RESEND_API_KEY = 'test';
  env.EMAIL_FROM = 'test@example.com';
  env.AUTH_RECOVERY_LIMIT = { limit: async () => ({ success: true }) };

  const messages = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    messages.push(JSON.parse(options.body));
    return Response.json({ id: 'test-message' });
  });
  async function call(path, body, extraHeaders = {}) {
    const pending = [];
    const request = new Request(new URL(path, origin), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        'CF-Connecting-IP': '192.0.2.1',
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const response = await worker.fetch(request, env, { waitUntil: promise => pending.push(promise) });
    await Promise.all(pending);
    return response;
  }
  return { db, env, messages, call };
}

function link(message) {
  return new URL(message.text.match(/https:\/\/\S+/)[0]);
}

test('password recovery masks account existence, enforces expiry and single use, and replaces credentials', async t => {
  const { db, env, messages, call } = await setup(t);
  const email = 'user@example.com';
  db.prepare("UPDATE users SET password_hash = ? WHERE id = 'user'").run(await hashPassword(oldPassword));

  const missing = await call('/api/auth/forgot-password', { email: 'missing@example.com' });
  const known = await call('/api/auth/forgot-password', { email: ' USER@example.com ' });
  assert.equal(missing.status, 202);
  assert.equal(known.status, missing.status);
  assert.deepEqual(await known.json(), await missing.json());
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].to, [email]);

  const firstLink = link(messages[0]);
  assert.equal(firstLink.pathname, '/reset-password');
  assert.equal(firstLink.search, '');
  const token = new URLSearchParams(firstLink.hash.slice(1)).get('token');
  const stored = db.prepare('SELECT * FROM password_reset_tokens').get();
  assert.notEqual(stored.token_hash, token);
  assert.equal(stored.expires_at - stored.requested_at, 30 * 60);

  await call('/api/auth/forgot-password', { email });
  assert.equal(messages.length, 1);
  db.exec("UPDATE password_reset_tokens SET expires_at = unixepoch(), requested_at = unixepoch() - 61");
  assert.equal((await call('/api/auth/reset-password', { token, password: newPassword })).status, 410);
  assert.equal((await call('/api/auth/login', { email, password: oldPassword })).status, 200);

  await call('/api/auth/forgot-password', { email });
  const valid = new URLSearchParams(link(messages[1]).hash.slice(1)).get('token');
  const reset = () => call('/api/auth/reset-password', { token: valid, password: newPassword });
  const results = await Promise.all([reset(), reset()]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 410]);
  assert.equal((await reset()).status, 410);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = 'user' AND revoked_at IS NULL").get().count, 0);
  assert.equal((await call('/api/auth/login', { email, password: oldPassword })).status, 401);
  assert.equal((await call('/api/auth/login', { email, password: newPassword })).status, 200);

  env.AUTH_RECOVERY_LIMIT.limit = async () => ({ success: false });
  const limited = await call('/api/auth/forgot-password', { email });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
});

test('registration requires email verification, supports throttled resend, and redirects expired and successful clicks', async t => {
  const { db, messages, call } = await setup(t);
  const email = 'new@example.com';
  const credentials = { email, password: oldPassword };
  assert.equal((await call('/api/auth/register', credentials)).status, 201);
  const unverified = await call('/api/auth/login', credentials);
  assert.equal(unverified.status, 403);
  assert.equal((await unverified.json()).error, 'EMAIL_NOT_VERIFIED');

  const browser = { Accept: 'text/html' };
  const initialLink = link(messages[0]);
  assert.equal((await call('/api/auth/resend-verification', { email })).status, 202);
  assert.equal(messages.length, 1);
  db.exec("UPDATE auth_tokens SET expires_at = '2000-01-01T00:00:00.000Z'");
  const expired = await call(initialLink, undefined, browser);
  assert.equal(expired.status, 302);
  assert.equal(expired.headers.get('location'), '/verify-email?status=expired');
  assert.equal(expired.headers.get('referrer-policy'), 'no-referrer');

  const resent = await Promise.all([
    call('/api/auth/resend-verification', { email }),
    call('/api/auth/resend-verification', { email }),
    call('/api/auth/resend-verification', { email: 'unknown@example.com' }),
  ]);
  assert.deepEqual(resent.map(response => response.status), [202, 202, 202]);
  assert.equal(messages.length, 2);
  const newLink = link(messages[1]);
  const verified = await call(newLink, undefined, browser);
  assert.equal(verified.status, 302);
  assert.equal(verified.headers.get('location'), '/verify-email?status=success');
  assert.equal((await call(newLink, undefined, browser)).headers.get('location'), '/verify-email?status=success');
  assert.equal((await call('/api/auth/login', credentials)).status, 200);
  await call('/api/auth/resend-verification', { email });
  assert.equal(messages.length, 2);
});
