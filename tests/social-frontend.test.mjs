import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

const { normalizeConnections, normalizePublicationResponse } =
  await vite.ssrLoadModule('/src/services/social.ts');

after(async () => {
  await vite.close();
});

test('social connection normalization requires all four providers and preserves accounts', () => {
  const connections = normalizeConnections({
    ok: true,
    connections: [
      { provider: 'instagram', availability: 'available', connected: true, connectionId: 'ig-1', accountId: 'a1', accountName: 'Werkstatt IG', status: 'connected', accounts: [{ connectionId: 'ig-1', accountId: 'a1', accountName: 'Werkstatt IG', status: 'connected', connected: true, expiresAt: null }] },
      { provider: 'facebook', availability: 'available', connected: false, connectionId: null, accountId: null, accountName: null, status: 'not_connected', accounts: [] },
      { provider: 'linkedin', availability: 'in_preparation', connected: false, connectionId: null, accountId: null, accountName: null, status: 'not_connected', accounts: [] },
      { provider: 'x', availability: 'in_preparation', connected: false, connectionId: null, accountId: null, accountName: null, status: 'not_connected', accounts: [] },
    ],
  });
  assert.equal(connections.length, 4);
  assert.equal(connections[0].accountName, 'Werkstatt IG');
  assert.equal(connections[2].availability, 'in_preparation');
});

test('publication normalization preserves independent provider outcomes', () => {
  const result = normalizePublicationResponse({
    ok: true,
    requestId: 'req-1',
    results: [
      { jobId: 'j1', provider: 'instagram', status: 'published', mediaId: 'm1', mediaSource: 'optimized', externalPostId: 'p1', url: 'https://www.instagram.com/p/example', error: null, retryAllowed: false },
      { jobId: 'j2', provider: 'facebook', status: 'failed', mediaId: 'm1', mediaSource: 'optimized', externalPostId: null, url: null, error: 'SOCIAL_PERMISSION_REQUIRED', retryAllowed: false },
    ],
  });
  assert.equal(result.results[0].status, 'published');
  assert.equal(result.results[1].status, 'failed');
  assert.equal(result.results[1].error, 'SOCIAL_PERMISSION_REQUIRED');
});
