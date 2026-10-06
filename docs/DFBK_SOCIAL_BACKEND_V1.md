# DFBK.app — Social Publishing V1 backend

07.10.2026 Europe/Berlin. Implementation staged; SQL/Meta configuration/live API verification/production E2E PENDING. NOT CLOSED. Frontend implementation outside this task.

## Audit / scope

Based on main `e1eafa6`, preserving AUTH-PAYLOAD-001 fix, current generation/title/Trial/Admin/frontend work. Prior publish and Meta integration routes are skeletons only. Reuse requireUser and dfbk_session, bounded JSON/same-origin mutation guard, D1 UUIDs/CURRENT_TIMESTAMP and private MEDIA. No Auth, generation, optimization, plan/role, existing SQL schema or frontend behavior changes. Legacy skeleton endpoints retained; new API is `/api/social/*` and project publish/publications.

Shared service handles connect/callback/connection selection/disconnect; Meta adapters handle provider publishing. LinkedIn/X explicitly in_preparation, no adapters or live publish. Phase 1 uses Facebook Login for both Facebook Pages and linked Instagram Professional accounts. OAuth returns candidates for explicit selection, never automatically publishes or selects the first account. One active account per provider in V1; selection replaces active destination, with other authorized candidates retained for later choice.

## Security / delivery semantics

OAuth state is random, stored hashed, owner+current-session+provider-bound, 10-minute expiry, atomic one-use consumption. Cross-site connect start refused; browser navigation must carry same-origin Referer (normal window.location navigation). Callback requires existing DFBK session. Tokens AES-256-GCM encrypted with random IV and AAD bound to owner/provider/account. Credentials never returned in connection/job responses. All application social logs are generic codes; never raw provider responses, tokens, codes, URLs with secrets or stack errors. Configure platform access logs/traces to redact OAuth callback query strings and provider credentials before enabling; application sanitization alone does not control infrastructure logs.

Disconnect clears encrypted access/refresh tokens and metadata for all accounts of provider, invalidates in-flight OAuth saves via state deletion and keeps publication history. It does not delete external posts, cancel already-sent provider requests, or globally revoke all Meta grants shared with another provider. Account deletion cascades new D1 owner records. Meta-specific refresh-token grant is not implemented because this Facebook Login path uses long-lived token exchange at connect, not generic refresh_token. Known expiry/code190 clears credentials and requires reconnect; frontend handles no tokens.

Publish POST represents explicit user confirmation of caption/image/providers. It performs no AI or image optimization. Caption/media/connection IDs snapshot into jobs before external mutation. Owner/key payload uniqueness and CAS pending→processing prevent parallel duplicate posts for the SAME idempotency key. Reusing key with changed payload gives409. Different keys represent distinct user-authorized publications, not automatic retries; frontend must reuse a key after uncertain network results.

External APIs cannot share a D1 transaction. external_publish_started_at is persisted before final external post. Network timeout/5xx/invalid post acknowledgement/unknown DB result remains processing with unknown outcome rather than failed+blind retry. This is at-most-once dispatch for a confirmed job, not a mathematical guarantee of exactly-once external delivery. Hard Worker termination after claim requires operator reconciliation. No cron retry, stale-lock reset or Queue is added.

Instagram container ID persists before final publish. IN_PROGRESS safely returns pending, with10-second minimum resume interval. Repeating exact same confirmed POST/key resumes saved container; it never repeats final publish after dispatch. A crashed claim remains processing for reconciliation. Partial provider success stays published even if another provider fails. Published/failed jobs do not re-execute on replay.

No bucket public access. A15-minute HMAC capability URL identifies one publication job/media snapshot; only provider receives it. Cookie-free GET/HEAD is an intentional provider fetch exception, with signature/time/current connection/job/ownership checks, no listings, no redirects and no-store. Disconnect revokes this capability. UI preview uses existing authenticated media API, never the capability. Existing private media endpoints unchanged.

Bounds: max4 known input providers (only2 enabled), no duplicate providers, 24KiB JSON, captions IG2200 Unicode codepoints, FB conservative V1 product cap5000. IG JPEG≤8MiB with aspect0.8–1.91; FB JPEG/PNG≤10MiB. No silent image conversion/cropping or new optimization; unsupported image returns SOCIAL_MEDIA_UNSUPPORTED. Verify current provider-specific limits/version for selected Meta App before live release.20 new requests/hour/user (atomic),10 OAuth starts/10min/user; replay resumes bounded10sec/job. Disconnect/select bounded JSON and authorization.

## Activation prerequisites

1. Apply/verify separate SQL TASK in `docs/DFBK_SOCIAL_SQL_TASK_V1.md`. No production write performed.
2. Meta App configured for chosen Facebook Login/Page+Instagram use cases. Dedicated test Page and linked Instagram Professional account, app roles in development. Verify requested permissions, business verification/Advanced Access/App Review requirements for actual app/use case before customer release. Do not invent approvals.
3. Register BOTH exact HTTPS callbacks:
   - https://dfbk.app/api/social/instagram/callback
   - https://dfbk.app/api/social/facebook/callback
4. Cloudflare Secrets: META_APP_SECRET; SOCIAL_TOKEN_ENCRYPTION_KEY and SOCIAL_MEDIA_SIGNING_KEY, two independent random32-byte base64 secrets. Generate securely outside chat; never paste/log. Keep encryption key durable/backup controlled. Existing META_REDIRECT_URI is not used by new routes, avoiding a wrong shared callback.
5. Server config: META_APP_ID; META_GRAPH_VERSION chosen from supported version for this app (required, no hardcoded default); SOCIAL_PUBLIC_ORIGIN=https://dfbk.app. SOCIAL_ENABLED stays absent/false until SQL/config ready. Enable only for controlled live tests; wider launch after approval/E2E.
6. Privacy policy/data-deletion/revocation handling and pending-candidate token retention need to satisfy chosen Meta App review/use-case requirements before wider production use. Disconnect alone is not a claim of full GDPR or platform compliance.
7. Real Meta E2E for consent/cancel/multiple pages/select/reconnect, Instagram JPEG container/publish/permalink, Facebook Page photo/caption, media fetch, idempotency, partial outcomes and disconnect.

Provider documentation retrieval: developers.facebook.com pages were inaccessible/429 in this environment. Official Meta-owned Postman collection exposes the me/accounts discovery contract; official facebook/facebook-nodejs-business-sdk page.js and ig-user.js retrieved via GitHub confirm /photos, /media and /media_publish edges. This verifies basic API shape, not current app eligibility, all limits or live permissions. Those remain release gates. Sources: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api ; https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/page.js ; https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/ig-user.js ; https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/content-publishing/ ; https://developers.facebook.com/docs/pages-api/posts/ .

## API contract for Frontend

Existing cookie session, no social passwords or bearer secrets in JS. 401 uses existing auth errors. Foreign project returns404 before provider work. Other generic failures503 SOCIAL_SERVICE_UNAVAILABLE, no internals. Connect/callback are browser navigation; POST actions use same-origin fetch and application/json.

GET /api/social/connections → `{ok:true,connections:[{provider,availability,connected,connectionId,accountId,accountName,status,accounts:[{connectionId,accountId,accountName,status,connected,expiresAt}]}]}`. Four providers always represented. availability: available / not_configured / in_preparation. top-level status connected / not_connected / reconnect_required; account status pending / connected / reconnect_required. If disabled/no configuration: Meta not_configured, future providers in_preparation; no query of new tables, allowing safe UI scaffolding. available means configured, not a claim of Meta App approval.

GET /api/social/:provider/connect →302 Meta. Redirect back `/app/integrations?social=select_account|cancelled|failed|no_accounts|permission_required&provider=...`. No frontend return URL accepted. Refresh connections after return; show authorized accounts for explicit choice. POST /api/social/:provider/select `{connectionId}` →200 current connections. POST /api/social/:provider/disconnect `{}` →200 current connections. LinkedIn/X actions503 SOCIAL_PROVIDER_NOT_AVAILABLE; not configured503 SOCIAL_NOT_CONFIGURED.

POST /api/projects/:id/publish with header `Idempotency-Key: <16..128 ASCII A-Za-z0-9_-; use crypto.randomUUID()>` and body `{providers:["instagram","facebook"],caption:"...",useOptimizedImage:true}`. Default useOptimizedImage=true; optimized chosen if present, else original. false means original explicitly. Snapshot stays fixed on key replay. User-provided media URLs/tokens/user IDs forbidden.

Response200 when terminal;202 +Retry-After:10 if any pending/processing:
`{ok:true,requestId,results:[{jobId,provider,status,mediaSource,externalPostId,url,error,retryAllowed}]}`.
status pending / processing / published / failed. Nonconnected/expired providers get failed job result; other connected provider may succeed. Preflight request-wide errors use standard `{ok:false,error}`. retryAllowed=true only safe pending container continuation, not generic failed-job retry.

GET /api/projects/:id/publications?requestId=... → same request results, owner-only; read does not publish. After uncertain client timeout, retry POST only with exact original payload/key to recover requestId/status; no new key. For pending/retryAllowed, bounded exact POST continuation is permitted without new user confirmation because it continues the previously confirmed immutable post. For processing/unknown, read only and reconcile; do not reset lock. For explicit terminal failed, user may initiate a NEW confirmed request with only failed provider(s), a new key; never include already published providers.

Errors: SOCIAL_NOT_CONNECTED, SOCIAL_TOKEN_EXPIRED, SOCIAL_PERMISSION_REQUIRED, RECONNECT_REQUIRED, SOCIAL_MEDIA_NOT_AVAILABLE, SOCIAL_MEDIA_UNSUPPORTED, SOCIAL_PUBLISH_FAILED, SOCIAL_RATE_LIMITED, SOCIAL_NOT_CONFIGURED, SOCIAL_PROVIDER_NOT_AVAILABLE, SOCIAL_PROVIDER_UNAVAILABLE, SOCIAL_ACCOUNT_LIST_TOO_LARGE, SOCIAL_CONTAINER_PROCESSING, SOCIAL_PUBLICATION_OUTCOME_UNKNOWN, INVALID_OAUTH_STATE, INVALID_SOCIAL_PROVIDER, INVALID_CAPTION, INVALID_SOCIAL_REQUEST, INVALID_IDEMPOTENCY_KEY, IDEMPOTENCY_CONFLICT, PROJECT_NOT_FOUND, PUBLICATION_NOT_FOUND. Published replay returns saved result200 rather than SOCIAL_ALREADY_PUBLISHED error.

## Validation / pending work

13 dedicated social tests (SQLite/D1 fixtures; Meta/R2 mocked): auth/ownership/Origin, private connections, encryption/AAD/tamper, state binding/replay/expiry/cancel, candidates/select/disconnect, caption/provider/key validation, optimized/original preference, one external call under concurrency, saved IG container continuation, partial results, unknown outcome, lost DB success acknowledgement, media capability, local rate bounds and atomic admission rollback. Full regression run and build/dry-run results in PR checkpoint. Worker strict typecheck has existing password.ts BufferSource error; new modules checked after fixing their typed-array declarations. No real accounts, social posts, secrets or production migrations used.

Backend is IMPLEMENTED LOCALLY / SQL+META+PRODUCTION E2E PENDING, NOT CLOSED. Frontend may implement UX and safe configuration states now; real actions after backend deployment/configuration. LinkedIn/X remain separate phases. No claim of full Social Publishing DoD until genuine Meta post+caption and mobile confirmation flow succeed.
