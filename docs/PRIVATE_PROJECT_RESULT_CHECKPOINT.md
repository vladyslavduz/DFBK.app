# Private project result checkpoint
Date: 2026-10-28. Base: main fc94708030fc53c124235e513da9e55523199422.
Scope: existing selected-project frontend; no new API, schema, paid generation, billing or OAuth configuration.

## Behavior
- Successful creation/content processing opens /app/projects/{id}/publish instead of duplicate inline wizard results.
- Project details have an explicit “Materialien verwenden” entry for later visits.
- Result page reads the exact project's metadata, media and content together; original and optimized images are labelled separately.
- The snapshot is hidden immediately when project/account identity changes; late reads cannot overwrite a newer project.
- Processing, failed processing, incomplete texts and absent image states block channel preparation. Status refresh only reads existing data.
- A missing optimized image permits use of the original only after an explicit choice; selected mediaId stays consistent with preview/export/API payload.
- Editable channel starting texts still use the existing three KI outputs. This is not independent generation for each network.
- Existing publication idempotency and uncertain/pending recovery are preserved.
- Font work remains paused; the established palette/type stack is retained.

## Verification on this candidate
- npm run typecheck:frontend: PASS.
- npm run build: PASS.
- npm run test:local: 88 PASS / 0 FAIL.
- PROMO_ORIGIN=http://127.0.0.1:4174 npm run test:publishing-ui against built Vite preview: all three scripts PASS.
- Public smoke: ordinary link composers, Instagram material dialog, manual CMS export, focus/escape, public/private separation.
- Existing private smoke: exact project/media/text, uncertain result lock, same-key reload recovery, terminal reset, storage denial and pending continuation.
- New result smoke: own images/captions, JPEG download, read-only status refresh, processing/failed/missing states, explicit original, late-response navigation race, mocked guest/foreign denial, 390/320px, actual wizard upload/generation fixture -> exact result route and no duplicate POST on reload.
- Browser API traffic uses local fixtures, including create/upload/generate/publication. No real paid AI calls, third-party posts or live ownership tests.
- Screenshot inspected: artifacts/private-result/mobile-320.png (ignored local artifact).
- git diff --check: PASS. Initial dev-server runs timed out; the completed UI run used the built preview. Smoke server URL is now configurable with PROMO_ORIGIN.

## Boundaries / remaining work
Social API remains frozen. Provider eligibility/OAuth and real posting are not validated here. Device share cannot force a particular native app/feed/story; CMS export is manual. New channel-specific KI generation, durable cross-device edits and universal API publication remain separate tasks. Existing global Worker type errors are outside this frontend typecheck. Font prototype is not approved or installed.
