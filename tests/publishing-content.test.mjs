import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
after(() => vite.close());
const { publishingChannels, promoTexts, promoVideos } = await vite.ssrLoadModule('/src/config/publishing.ts');
const promo = await vite.ssrLoadModule('/src/services/promo-share.ts');

test('every public channel has its own DFBK promo payload independent of user state', () => {
  assert.equal(publishingChannels.length, 9);
  for (const c of publishingChannels) { assert.ok(promoTexts[c.id].includes('dfbk.app')); assert.ok(promoTexts[c.id].length > 30); }
  assert.notEqual(promoTexts.instagram, promoTexts.facebook);
  assert.notEqual(promoTexts.facebook, promoTexts.pinterest);
  for (const video of promoVideos) assert.ok(video.url.startsWith('/promo/'));
  const source=readFileSync('src/pages/IntegrationsPage.tsx','utf8');
  assert.doesNotMatch(source,/useUserArea|latestReadyProject|getProjectContent|plan.features/);
});

test('public share composers contain only the fixed public promo and never require an OAuth session', () => {
  for (const channel of ['facebook','whatsapp','x','linkedin','pinterest','email']) {
    const href = promo.promoShareLink(channel);
    assert.ok(href.includes(encodeURIComponent(promo.promoShareUrl)));
    assert.doesNotMatch(href, /access_token|client_secret|\/api\/projects|\/app\//);
  }
  const facebook = new URL(promo.promoShareLink('facebook'));
  assert.equal(facebook.searchParams.get('u'), promo.promoShareUrl);
  assert.equal(facebook.searchParams.has('quote'), false);
  assert.equal(facebook.searchParams.has('app_id'), false);
  assert.equal(new URL(promo.promoShareLink('pinterest')).searchParams.get('media'), promo.promoShareImage);
  assert.equal(promo.promoShareLink('instagram'), null);
  assert.equal(promo.promoShareLink('javascript:alert(1)'), null);
});
test('shared promo has crawler-readable static metadata and a real public JPEG', () => {
  const html = readFileSync('public/share/friseur.html','utf8');
  assert.ok(html.includes('<meta property="og:url" content="' + promo.promoShareUrl + '">'));
  assert.ok(html.includes('<meta property="og:image" content="' + promo.promoShareImage + '">'));
  assert.equal(readFileSync('public/promo/dfbk-friseur.jpg').subarray(0,2).toString('hex'), 'ffd8');
  assert.doesNotMatch(html, /access_token|\/api\/projects/);
});
