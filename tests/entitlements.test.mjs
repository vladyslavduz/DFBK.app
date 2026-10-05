import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: 'custom',
});
const { entitlementsService, fallbackTrialEntitlements, normalizeEntitlements } = await vite.ssrLoadModule('/src/services/entitlements.ts');
const originalFetch = globalThis.fetch;

after(async () => {
  globalThis.fetch = originalFetch;
  await vite.close();
});

const trial = {
  ok: true, plan: 'trial', displayName: 'Testzugang', status: 'active',
  voice: { enabled: true, maxWords: 10 },
  features: { contentGeneration: true, share: true, businessIntegrations: false },
  expiresAt: null,
};
const business = {
  ok: true, plan: 'business', displayName: 'Business', status: 'active',
  voice: { enabled: true, maxWords: null },
  features: { contentGeneration: true, share: true, businessIntegrations: true },
  expiresAt: null,
};

test('controlled Trial → admin grant Business → refresh → admin revoke → refresh', async () => {
  let serverPlan = trial;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, credentials: options.credentials });
    return new Response(JSON.stringify(serverPlan), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const first = await entitlementsService.getCurrent();
  assert.equal(first.plan, 'trial');
  assert.equal(first.voice.maxWords, 10);
  assert.equal(first.features.share, true);
  assert.equal(first.features.businessIntegrations, false);

  // Simulate the server-side admin grant; the frontend only re-reads GET.
  serverPlan = business;
  const granted = await entitlementsService.getCurrent();
  assert.equal(granted.plan, 'business');
  assert.equal(granted.voice.maxWords, null);
  assert.equal(granted.features.share, true);
  assert.equal(granted.features.businessIntegrations, true);
  assert.equal(granted.source, 'backend');

  serverPlan = trial;
  const revoked = await entitlementsService.getCurrent();
  assert.equal(revoked.plan, 'trial');
  assert.equal(revoked.voice.maxWords, 10);
  assert.equal(revoked.features.share, true);
  assert.equal(revoked.features.businessIntegrations, false);
  assert.deepEqual(requests, Array(3).fill({ url: '/api/account/entitlements', credentials: 'same-origin' }));
});

test('fallback and malformed responses never grant Business', () => {
  assert.equal(fallbackTrialEntitlements.plan, 'trial');
  assert.equal(fallbackTrialEntitlements.features.share, false);
  assert.equal(fallbackTrialEntitlements.features.businessIntegrations, false);
  assert.throws(() => normalizeEntitlements({ ...business, features: { ...business.features, share: false } }), /INVALID_ENTITLEMENTS_RESPONSE/);
  assert.throws(() => normalizeEntitlements({ ...business, status: 'expired' }), /INVALID_ENTITLEMENTS_RESPONSE/);
  assert.throws(() => normalizeEntitlements({ ...business, voice: { enabled: true, maxWords: 10 } }), /INVALID_ENTITLEMENTS_RESPONSE/);
  assert.throws(() => normalizeEntitlements({ ok: true, plan: 'elite' }), /INVALID_ENTITLEMENTS_RESPONSE/);
});
