# Publishing — local implementation checkpoint

Date: 2026-10-27. Status: LOCAL CANDIDATE / NOT DEPLOYED / TASK INCOMPLETE.
Base: main 3c8dfaa7c3cf559aa3927cd4451fe694e8bdc815.
Branch: feature/publishing-promo-project.

## Implemented

- Public /integrations uses fixed DFBK advertising, independent of the latest private project. All nine channel controls open a preparation panel.
- Per-channel editable German promotional copy; MP4 9:16 and 1:1, selectable before sharing. Instagram/Pinterest/WhatsApp default vertical; other channels default square. These defaults do not prove provider acceptance.
- Actual 14-second animation export, 24 fps, H264/yuv420p, no audio. Original stage is contained with padding; no crop. Final Original frame now uses friseur-after.webp.
- Unsupported video can fall back to image. Export converts images to JPEG in the browser; private source files remain private.
- Native device sharing, file download, text copying and external channel links. Opening a service or completing navigator.share is never reported as publication.
- /app/projects/:id/publish loads only the selected project's image and content. Existing project publication links and OAuth resume links lead here. Previous social-card text edits are carried into the Instagram starting draft.
- Project drafts use existing KI results: social -> Instagram, Google Business -> Facebook, title + website -> Pinterest. These are starting texts, NOT new channel-specific AI generation. No paid AI calls added.
- Existing Instagram/Facebook API accepts one selected channel and its caption. Save exact payload/idempotency key before POST; block new attempts across projects until result is resolved. Browser storage failure prevents sending. Reload recovery preserves the original payload/key. Only confirmed terminal results permit explicit preparation of a new post. Confirmed retryable pending jobs can continue with the same key.
- Existing backend entitlement share flag is required for the private preparation page. No pricing/PRO entitlement contract invented.

## Verification

- Full local suite: 86 PASS / 0 FAIL / 0 skipped.
- Browser smoke: actual MP4/JPEG files passed to mocked native sharing, unsupported-video fallback, nine public channels, guest/private-data separation, 390px layout, selected project/media/text, uncertain result lock, reload replay, terminal reset, distinct Facebook starting text, storage denial, same-key pending continuation. All API publication calls are mocked; no provider publication tested.
- Frontend-only TypeScript check PASS. Root tsc fails on existing Worker type errors (Cloudflare global types, Google generic calls, BufferSource). Same errors occur in the original checkout; original local social fixes add a separate implicit-any diagnostic.
- Vite build PASS; Wrangler deploy --dry-run PASS, no deployment.
- Both MP4 files fully decode. Vertical: 1080x1920, 1,819,132 bytes, SHA256 6dbc4b77cbdf1410bea732e5ecbb5a91e9a2781a40749a551929a1ba1744062d. Square: 1080x1080, 1,120,473 bytes, SHA256 9e37698228f76e08986a5e6de1ffb49ca4a4c9fe728b46b55aff154adee80ac9.

## Reproduce locally

Install dependencies using the lockfile. Edge is used by default on Windows; PROMO_BROWSER can specify another local Chromium executable.

1. npm run build; npm run preview -- --host 127.0.0.1 --port 4173
2. Set PROMO_ORIGIN=http://127.0.0.1:4173; npm run render:promo
3. node scripts/verify-promo.cjs; npm run build
4. npm run dev -- --host 127.0.0.1; npm run test:publishing-ui
5. npm run test:local; npm run typecheck:frontend

Use static preview for recording: Vite HMR reloads can interrupt rendering. PROMO_VARIANT=vertical or square renders only one variant. The renderer captures the existing DOM/CSS with paused animation times. FFmpeg and Playwright are development dependencies; they do not enter the browser bundle. Screenshots and local test logs are ignored under artifacts/publishing.

## Remaining work / limits

- The product decision permitting manual/device-share fallback is still pending. This candidate does not satisfy universal direct publication in 2–3 clicks. A browser cannot force a selected native target or upload directly to arbitrary accounts without their authorization.
- No new OAuth connectors for Pinterest, X, LinkedIn, Google Business or CMS. Website/Blog currently exports media/text only: no WordPress/Wix/Joomla/Drupal/Tilda publishing adapter.
- Public promo has no new API upload pipeline; it uses native sharing/export. Social backend still supports project photo publication only, not video or carousels.
- New independently generated Instagram/Facebook/Pinterest captions, persistent edited multi-channel drafts and durable server-side recovery across tabs/devices remain open. Current attempt persistence is sessionStorage for the current user/tab; it is not cross-device synchronization.
- Social remains FROZEN / SOCIAL_ENABLED=false. Actual Meta OAuth, current app permissions, live token/media acceptance and provider post evidence remain unverified.
- Earlier callback/token fixes in the original checkout are NOT included here. That checkout's 89-test result must not be substituted for this branch's 86-test result. Integrate/review those separately before enabling Meta.
- Global tsc failures remain a release blocker for a clean typecheck. No billing implementation or production access changes were made.
- No push, PR, merge, deployment, production SQL/R2/secrets change or real post.

## Exact stopping point

Local reviewable frontend/media candidate with mocked safety verification; external integration and product acceptance are still open. Next concrete implementation slice: define and implement independent project caption variants while preserving legacy API/idempotency compatibility, without enabling live publication.
