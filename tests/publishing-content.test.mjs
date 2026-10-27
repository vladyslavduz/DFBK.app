import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
after(() => vite.close());
const { publishingChannels, promoTexts, promoVideos } = await vite.ssrLoadModule('/src/config/publishing.ts');
test('every public channel has its own DFBK promo payload independent of user state', () => {
  assert.equal(publishingChannels.length, 9);
  for (const c of publishingChannels) { assert.ok(promoTexts[c.id].includes('dfbk.app')); assert.ok(promoTexts[c.id].length > 30); }
  assert.notEqual(promoTexts.instagram, promoTexts.facebook);
  assert.notEqual(promoTexts.facebook, promoTexts.pinterest);
  for (const video of promoVideos) assert.ok(video.url.startsWith('/promo/'));
  const source=readFileSync('src/pages/IntegrationsPage.tsx','utf8');
  assert.doesNotMatch(source,/useUserArea|latestReadyProject|getProjectContent|plan.features/);
});
