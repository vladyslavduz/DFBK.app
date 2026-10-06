# DFBK.app — Frontend Social Publishing V1

07.10.2026 Europe/Berlin. READY FOR UX INTEGRATION. Backend implementation staged, SQL/Meta activation/live verification PENDING; not in production/main yet. Real publish actions must stay unavailable until backend deployed/configured. No fake connected/success states. Instagram+Facebook phase1; LinkedIn/X In Vorbereitung.

Read current main, existing Social Media card/API client/entitlements/Private Media and backend contract `docs/DFBK_SOCIAL_BACKEND_V1.md`. Preserve Auth/Google/Admin/Trial5, titles/rename, generation and optimization. Do not modify SQL or generate AI copy during publish. Backend routes use existing cookie session; never social passwords/tokens in JS or storage.

## UI

Primary Social Media CTA `Veröffentlichen`; secondary Bearbeiten/Kopieren/Bild herunterladen. Optional Teilen remains device share sheet only. Same design system. Card composes image+caption as one post. Optimized preferred, else original; label Optimiertes Bild/Originalbild. No editor or new optimization.

Mobile sheet `Veröffentlichen` / `Wähle, wo du deinen Beitrag veröffentlichen möchtest.` lists recognizable Instagram/Facebook/LinkedIn/X marks with safe accountName and real state. Connected accounts show account; missing connection offers Verbinden only when availability=available. not_configured/in_preparation never offers real publish. On no backend support (404/503) show In Vorbereitung/Nicht verfügbar, not fake readiness. availability available means configured, not proof of Meta review success.

Multi-select Instagram/Facebook supported. One active destination/account per provider. Explicit account selection is REQUIRED after OAuth: do not silently choose first Page. Same connection store on modal and /app/integrations; no duplicate local mocked store. Authorized candidates are accounts with pending/connected statuses. POST select connectionId from backend list; accountId/name are display data, not publish authorization.

Preview uses existing generated socialMedia as base caption, editable publication draft only. Do not overwrite generated original without an existing explicit save endpoint. No channel variants generated client-side. Show selected account(s), caption, source image and full final confirmation `Beitrag veröffentlichen?` / `Jetzt veröffentlichen` / Abbrechen. No post on sheet-open, account selection, OAuth callback, mount or preview. Network POST only after explicit user confirmation.

## API

GET `/api/social/connections`:
`{ok:true,connections:[{provider,availability,connected,connectionId,accountId,accountName,status,accounts:[{connectionId,accountId,accountName,status,connected,expiresAt}]}]}`.
availability available/not_configured/in_preparation. top-level status connected/not_connected/reconnect_required. accounts status pending/connected/reconnect_required. No tokens. Preserve all fields in types/normalizer. Existing entitlements unchanged; do not invent a Business-only restriction that backend doesn't enforce.

Browser navigate to GET `/api/social/instagram/connect` or `/api/social/facebook/connect` using ordinary same-origin window.location navigation (not noreferrer external open). Backend needs same-origin Referer/Origin. Callback redirects fixed `/app/integrations?social=select_account|cancelled|failed|no_accounts|permission_required&provider=...`. Query is a UX hint only; reload connections before rendering. Existing session required on return. Preserve publication draft in React/session UI state if desired; never store tokens. URL must not contain full caption/private image URL. After OAuth, return to selection/preview, never auto-publish.

POST `/api/social/:provider/select` `{connectionId:"..."}` → `{ok:true,connections:[...]}`.
POST `/api/social/:provider/disconnect` `{}` → same. JSON via existing same-origin client. Disconnect refreshes shared store; it keeps external post history and doesn't delete external posts.

POST `/api/projects/:id/publish`
header `Idempotency-Key: crypto.randomUUID()` (16–128 ASCII A-Za-z0-9_-)
body `{providers:["instagram","facebook"],caption:"...",useOptimizedImage:true}`.
No userId/token/mediaURL/connection spoofing. useOptimizedImage=true defaults to optimized if present, else original. false deliberately uses original. Preview must show exactly chosen source. Caption trim; max IG2200 Unicode codepoints, FB conservative product cap5000; multi-select uses strictest. Backend currently supports IG JPEG≤8MiB/aspect0.8–1.91, FB JPEG/PNG≤10MiB; unsupported image shows clear error, no silent conversion/optimization.

Result200 terminal or202 +Retry-After10:
`{ok:true,requestId,results:[{jobId,provider,status,mediaSource,externalPostId,url,error,retryAllowed}]}`.
status pending/processing/published/failed. One provider failure is an individual result, not failure of all. Invalid request/media/config/ownership can be request-wide `{ok:false,error}`.

GET `/api/projects/:id/publications?requestId=...` gives saved results without publishing. Owner only. No full-history endpoint yet; don't build analytics/history dashboard. UI may keep current requestId to refresh statuses. Connection/account state always refetched server-side.

## Idempotency / recovery — mandatory

At final confirmation freeze providers/caption/image option and generate ONE key. Disable duplicate tap. For any ambiguous client timeout or repeat tap reuse SAME key and EXACT payload, not a new UUID per fetch. Published replay returns saved success and makes no new post. Changed payload/key reuse409 IDEMPOTENCY_CONFLICT; show error, don't silently create new key and publish.

Instagram container may be pending with retryAllowed=true. Continue only exact original POST/key, respecting Retry-After10, no overlapping requests, bounded total attempts/time. This continues an already confirmed immutable post, not another publication. GET reads alone do not advance container. Stop continuation on terminal status, close/unmount/logout; on return recover explicitly with stored key/payload and user flow. Key/payload may be held in draft UI state for this attempt; optional session persistence needs account isolation and clearing on logout.

processing or SOCIAL_PUBLICATION_OUTCOME_UNKNOWN: read state; do not resend with new key, reset lock or promise it failed. Show `Der Veröffentlichungsstatus wird geprüft. Bitte nicht erneut veröffentlichen.` and safe status refresh/support path. It may already exist externally. retryAllowed false is meaningful.

failed is terminal for that job. After explicit failure (not unknown processing), user may confirm a NEW request for only failed channel(s), new key. Never include successful providers in retry. Resuming exact key of failed job returns existing failure, not retry. Partial success UI keeps all successful results intact.

## States / errors

Submitting: Wird veröffentlicht…; disable controls affecting frozen request. Success: ✓ Auf Instagram/Facebook veröffentlicht; safe external link only if backend supplies url. Render links with HTTPS/provider host allowlist and noopener/noreferrer. No frontend-derived external post URL.

401 existing login/session flow;404 PROJECT_NOT_FOUND/PUBLICATION_NOT_FOUND safe unavailable message. SOCIAL_NOT_CONNECTED connect; SOCIAL_TOKEN_EXPIRED/RECONNECT_REQUIRED reconnect; SOCIAL_PERMISSION_REQUIRED explain permission; SOCIAL_MEDIA_NOT_AVAILABLE/UNSUPPORTED image message; SOCIAL_RATE_LIMITED wait; SOCIAL_NOT_CONFIGURED/PROVIDER_NOT_AVAILABLE not ready. No raw SQL/provider errors. Caption/key/Origin validation errors retain draft. Never label every202 as success.

## Mobile / scope

iPhone-first sheet/modal, visible full caption/image preview, sticky confirmation CTA, large44–48px targets, accessible labels/focus and scrolling with keyboard. No horizontal tables. No image editor, scheduled posts, carousel/Reels/Stories, analytics, role management, Stripe, new AI calls or project deletion. Provider icons follow branding; don't add heavy UI library.

## Tests / release

Locally verify connection normalization and unavailable states, explicit account selection, draft editing doesn't overwrite source, exact caption/image preview, multi-select, confirmation-only POST, stable key across timeout/replay, safe pending resume, unknown outcome without blind retry, partial success retrying only failed channel, reconnect/disconnect, private previews, safe external links and iPhone layout. Run build/checks and existing regressions.

Production gates: SQL task verified; backend merge/deploy confirmed; Meta secrets/version/origin/scopes/test accounts configured; no callback query/token logging; live Meta test consent/cancel/select/reconnect; one real IG image+caption and Facebook Page photo+caption only after explicit confirmation; durable statuses/no duplicate same key; private media fetch/disconnect tested. Real publishing UI enabled only after backend support. LinkedIn/X remain In Vorbereitung, don't block Meta.

Report PR/merge/deploy SHA/version, test results local vs production, dedicated test-account context without credentials, genuine external post results, mobile results and remaining blockers. Backend/frontend/overall CLOSED only on factual production DoD; otherwise IMPLEMENTED / META E2E PENDING.
