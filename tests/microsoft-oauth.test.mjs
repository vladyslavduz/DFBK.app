import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { fixture } from './helpers/backend.mjs';

const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { handleAuth } = await vite.ssrLoadModule('/worker/routes/auth.ts');
const originalFetch = globalThis.fetch;
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });

const clientId = 'd86e6aa0-5aee-4cab-a67d-86ab861b53e4';
const tenant = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const oid = '11111111-2222-3333-4444-555555555555';
const envConfig = { MICROSOFT_CLIENT_ID: clientId, MICROSOFT_CLIENT_SECRET: 'test-secret-only',
  MICROSOFT_REDIRECT_URI: 'https://dfbk.app/api/auth/microsoft/callback' };
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'test-key' };

async function makeToken(nonce, overrides = {}) {
  const header = enc({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const body = enc({ aud: clientId, iss: `https://login.microsoftonline.com/${tenant}/v2.0`,
    tid: tenant, sub: 'pairwise-subject', oid, nonce, exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey,
    new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${Buffer.from(signature).toString('base64url')}`;
}

async function setup() {
  const { db, env } = await fixture();
  Object.assign(env, envConfig);
  return { db, env };
}

async function begin(env, link = false) {
  const path = link ? '/api/auth/microsoft?link=1' : '/api/auth/microsoft';
  const headers = link ? { Cookie: 'dfbk_session=user', Referer: 'https://dfbk.app/app/profile' } : {};
  const result = await handleAuth(new Request(`https://dfbk.app${path}`, { headers }), env, '/api/auth/microsoft');
  assert.equal(result.status, 302);
  const url = new URL(result.headers.get('location'));
  assert.equal(url.hostname, 'login.microsoftonline.com');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'openid profile email User.Read');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), envConfig.MICROSOFT_REDIRECT_URI);
  assert.ok(!url.toString().includes(envConfig.MICROSOFT_CLIENT_SECRET));
  return { state: url.searchParams.get('state'), nonce: url.searchParams.get('nonce'),
    cookie: result.headers.get('set-cookie').split(';')[0], url };
}

function provider(nonce, { email = 'new@example.com', claims = {}, error = false } = {}) {
  let exchanges = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.endsWith('/token')) {
      exchanges++;
      assert.equal(options.method, 'POST');
      assert.equal(options.body.get('client_secret'), envConfig.MICROSOFT_CLIENT_SECRET);
      assert.ok(options.body.get('code_verifier'));
      if (error) return new Response('{"error":"private-provider-detail"}', { status: 400 });
      return Response.json({ id_token: await makeToken(nonce, claims), access_token: 'private-access-token' });
    }
    if (url.endsWith('/keys')) return Response.json({ keys: [jwk] });
    if (url.startsWith('https://graph.microsoft.com/')) {
      assert.equal(options.headers.Authorization, 'Bearer private-access-token');
      return Response.json({ id: oid, mail: email, userPrincipalName: email });
    }
    throw new Error('Unexpected provider endpoint');
  };
  return () => exchanges;
}

async function callback(env, attempt, { session = '', state = attempt.state } = {}) {
  const path = `/api/auth/microsoft/callback?code=one-time-code&state=${encodeURIComponent(state)}`;
  return handleAuth(new Request(`https://dfbk.app${path}`, {
    headers: { Cookie: `${attempt.cookie}${session ? `; dfbk_session=${session}` : ''}` },
  }), env, '/api/auth/microsoft/callback');
}

test('confidential code + PKCE, verified ID token, private state, new unverified-email user and existing session cookie', async () => {
  const { db, env } = await setup();
  const attempt = await begin(env);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM microsoft_oauth_states').get().n, 1);
  const count = provider(attempt.nonce);
  const result = await callback(env, attempt);
  assert.equal(result.status, 302);
  assert.equal(new URL(result.headers.get('location')).searchParams.get('auth'), 'microsoft_success');
  assert.match(result.headers.get('set-cookie'), /dfbk_session=/);
  assert.ok(!result.headers.get('set-cookie').includes('private-access-token'));
  assert.equal(count(), 1);
  const user = db.prepare('SELECT email,email_verified,microsoft_sub FROM users WHERE email=?').get('new@example.com');
  assert.equal(user.email_verified, 0); // Microsoft email/UPN is not verified ownership of another account.
  assert.equal(user.microsoft_sub, `${tenant}:pairwise-subject`);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 3);
  const replay = await callback(env, attempt);
  assert.equal(new URL(replay.headers.get('location')).searchParams.get('reason'), 'invalid_state');
  assert.equal(count(), 1);
  db.close();
});

test('email collision cannot take over a Google/password account; authenticated user can link explicitly', async () => {
  const { db, env } = await setup();
  let attempt = await begin(env);
  provider(attempt.nonce, { email: 'user@example.com' });
  let response = await callback(env, attempt);
  assert.equal(new URL(response.headers.get('location')).searchParams.get('reason'), 'account_link_required');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  assert.equal(db.prepare("SELECT microsoft_sub FROM users WHERE id='user'").get().microsoft_sub, null);

  attempt = await begin(env, true);
  provider(attempt.nonce, { email: 'user@example.com' });
  response = await callback(env, attempt, { session: 'user' });
  assert.equal(new URL(response.headers.get('location')).searchParams.get('auth'), 'microsoft_success');
  assert.equal(db.prepare("SELECT microsoft_sub FROM users WHERE id='user'").get().microsoft_sub,
    `${tenant}:pairwise-subject`);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);

  attempt = await begin(env);
  provider(attempt.nonce, { email: 'changed@example.com' });
  response = await callback(env, attempt);
  assert.equal(new URL(response.headers.get('location')).searchParams.get('auth'), 'microsoft_success');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  db.close();
});

test('tampered state, another browser session, wrong audience and provider failure create no users', async () => {
  const { db, env } = await setup();
  let attempt = await begin(env);
  provider(attempt.nonce);
  let result = await callback(env, attempt, { state: 'X'.repeat(43) });
  assert.equal(new URL(result.headers.get('location')).searchParams.get('reason'), 'invalid_state');

  attempt = await begin(env, true);
  result = await callback(env, attempt, { session: 'admin' });
  assert.equal(new URL(result.headers.get('location')).searchParams.get('reason'), 'invalid_state');

  attempt = await begin(env);
  provider(attempt.nonce, { claims: { aud: 'another-client' } });
  result = await callback(env, attempt);
  assert.equal(new URL(result.headers.get('location')).searchParams.get('reason'), 'invalid_identity');

  attempt = await begin(env);
  provider(attempt.nonce, { error: true });
  result = await callback(env, attempt);
  assert.equal(new URL(result.headers.get('location')).searchParams.get('reason'), 'token_exchange_failed');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  db.close();
});

test('Google email matching cannot claim an unverified Microsoft account', async () => {
  const { db, env } = await setup();
  let attempt = await begin(env);
  provider(attempt.nonce, { email: 'new@example.com' });
  await callback(env, attempt);
  const microsoftUser = db.prepare('SELECT id FROM users WHERE email=?').get('new@example.com');
  env.GOOGLE_CLIENT_ID = 'google-test-client';
  env.GOOGLE_CLIENT_SECRET = 'google-test-secret';
  env.GOOGLE_REDIRECT_URI = 'https://dfbk.app/api/auth/google/callback';
  const start = await handleAuth(new Request('https://dfbk.app/api/auth/google'), env, '/api/auth/google');
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  globalThis.fetch = async input => {
    if (String(input) === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'google-test-token' });
    if (String(input) === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return Response.json({ sub: 'google-subject', email: 'new@example.com', email_verified: true });
    }
    throw new Error('Unexpected provider endpoint');
  };
  const result = await handleAuth(new Request(`https://dfbk.app/api/auth/google/callback?code=test-code&state=${state}`,
    { headers: { Cookie: `dfbk_google_oauth_state=${state}` } }), env, '/api/auth/google/callback');
  assert.equal(new URL(result.headers.get('location')).searchParams.get('reason'), 'account_link_required');
  assert.equal(db.prepare('SELECT google_sub FROM users WHERE id=?').get(microsoftUser.id).google_sub, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 3);
  db.close();
});
