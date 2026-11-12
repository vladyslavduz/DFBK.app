import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../worker/routes/business-contact.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { handleBusinessContact } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

const url = new URL('https://dfbk.app/api/business-contact');
const fields = { email: 'visitor@example.invalid', message: 'Ich interessiere mich für Business.', token: 'fixture-token' };
const env = {
  BUSINESS_CONTACT_SITE_KEY: 'fixture-public-key',
  BUSINESS_CONTACT_SECRET: 'fixture-private-key',
  BUSINESS_CONTACT_LIMIT: { limit: async () => ({ success: true }) },
  RESEND_API_KEY: 'fixture-email-key',
  EMAIL_FROM: 'DFBK <noreply@example.invalid>',
};
function request(body = fields, options = {}) {
  return new Request(url, {
    method: 'POST',
    headers: {
      Origin: url.origin,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.1',
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

test('public config exposes the site key only when contact is ready', async () => {
  const get = new Request(url);
  assert.deepEqual(await (await handleBusinessContact(get, env, url)).json(), { siteKey: 'fixture-public-key' });
  const incomplete = { ...env, BUSINESS_CONTACT_SECRET: undefined };
  assert.deepEqual(await (await handleBusinessContact(get, incomplete, url)).json(), { siteKey: null });
  assert.equal((await handleBusinessContact(request(), incomplete, url)).status, 503);
  const preflight = await handleBusinessContact(new Request(url, { method: 'OPTIONS' }), env, url);
  assert.equal(preflight.status, 405);
  assert.equal(preflight.headers.has('Access-Control-Allow-Origin'), false);
});

test('reject invalid origin, client recipient, oversized payload and rate-limited requests before external calls', async t => {
  const outbound = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external call'); });
  assert.equal((await handleBusinessContact(request(fields, { headers: { Origin: 'https://example.invalid' } }), env, url)).status, 403);
  assert.equal((await handleBusinessContact(request({ ...fields, to: 'other@example.invalid' }), env, url)).status, 400);
  assert.equal((await handleBusinessContact(request({ ...fields, message: 'x'.repeat(17000) }), env, url)).status, 413);
  assert.equal((await handleBusinessContact(request({ ...fields, email: 'a@example.invalid\r\nBcc: attacker@example.invalid' }), env, url)).status, 400);
  const limited = { ...env, BUSINESS_CONTACT_LIMIT: { limit: async () => ({ success: false }) } };
  const denied = await handleBusinessContact(request(), limited, url);
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('Retry-After'), '60');
  assert.equal(outbound.mock.callCount(), 0);
});

test('only a valid Turnstile token for this host and action can reach the fixed inbox', async t => {
  let verification = { success: true, hostname: 'another.example.invalid', action: 'business_contact' };
  let deliveryStatus = 200;
  const mail = [];
  t.mock.method(globalThis, 'fetch', async (endpoint, options) => {
    if (endpoint === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      assert.equal(options.body.get('response'), fields.token);
      return Response.json(verification);
    }
    assert.equal(endpoint, 'https://api.resend.com/emails');
    mail.push(JSON.parse(options.body));
    return Response.json({ id: 'fixture' }, { status: deliveryStatus });
  });

  for (const verdict of [
    verification,
    { success: true, hostname: url.hostname, action: 'other_form' },
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
  ]) {
    verification = verdict;
    assert.equal((await handleBusinessContact(request(), env, url)).status, 400);
  }
  assert.equal(mail.length, 0);

  verification = { success: true, hostname: url.hostname, action: 'business_contact' };
  assert.deepEqual(await (await handleBusinessContact(request(), env, url)).json(), { ok: true });
  assert.deepEqual(mail[0].to, ['dfbk.app@gmail.com']);
  assert.equal(mail[0].reply_to, fields.email);
  assert.match(mail[0].text, /interessiere/);
  deliveryStatus = 503;
  assert.equal((await handleBusinessContact(request(), env, url)).status, 502);
});
