# SCHEDULER-PROJECT-DRAFT-API-01

03.11.2026. Branch codex/scheduler-project-draft-api.
Base: draft PR #63, remote 3bd3a232d3bf2ca6619a6a8ecc0262d6850aa3b2 / local b03bb7bb; same tree 2b640f2e0749809f0def4879a3b4cdfc581f021e.
Scope: authenticated creation/persistence of unapproved publication drafts. No project form or automatic delivery.

## HTTP contract

POST /api/scheduler/packages
- Real dfbk_session authentication, same-origin HTTPS Origin, no cross-site Sec-Fetch-Site, no URL query.
- Application/json, streamed request bound 24 KiB. Idempotency-Key: 16..128 ASCII letters/digits/_/-.
- JSON fields only: projectId, mediaId, commonTime, targets. Target: channel, connectionId, caption, optional timeOverride.
- Existing resolver checks owned ready project, owned image and connected same-owner Meta destinations, then reads actual bounded R2 content and SHA-256. Browser cannot supply owner, R2 key, external destination, snapshot or approval.
- New drafts require verified email and business plan OR the existing isTrialActive rules (including existing null-expiry trial behavior). This creates no new billing entitlement or charge. Historical read/replay remains available with a valid session.
- First successful save: 201 {ok:true,packageId,status:"draft",replayed:false,cannotDispatch:true}.
- Exact retry: 200, same packageId, replayed:true. Response has no caption, storage key, raw connection/destination IDs, identity, hash or tokens. The existing GET detail returns its own safe DTO.
- Errors: fixed {ok:false,error:{code}}, no raw SQL/R2/provider output. No CORS; private/no-store, Vary Cookie, nosniff and no-referrer.

Existing GET/list/calendar behavior is preserved. Root POST is routed only when the new write flag is exactly true; absent/false flags retain 405/Allow GET, including the existing preflight isolation. POST detail paths, other mutations and OPTIONS stay unsupported.

## Durable retry semantics

readOwnedDraftReceipt is a SERVER-INTERNAL function, not a response DTO. It reuses the reader's atomic header/receipt/ALL-children read, ownership scope, serialized budgets, canonical reconstruction and integrity checks.
The incoming selection is bounded and validated separately from new-draft horizon admission. Receipt comparison includes project/media IDs, common time, per-target connection/channel/text and presence/value of time overrides; checkbox/property order does not matter.
- Same key + same selection returns the frozen saved draft without another R2 read or write, even after due time, media deletion, token/connection state changes or trial expiry. Replay grants no right to send and does not refresh its snapshot.
- Changed selection + same key gives 409 SCHEDULER_REQUEST_CONFLICT. To intentionally create another draft, use another key.
- Corrupt/incomplete receipt fails 503 without overwriting.
- Current project ownership still applies; the former owner cannot replay it after transfer.
- New save uses the existing single guarded atomic batch. Lost acknowledgements/overlapping requests recover the committed receipt with no second mutation attempt by the same handler. If no complete receipt is established, return a fixed uncertain/unavailable response, never fake success.
- Current configured parsing limits must still accept a replay request. Configuration changes may refuse it; GET remains the recovery path.

## Configuration: declared only, NOT activated

No Wrangler or Cloudflare settings changed. New optional Env declarations:
- SCHEDULER_DRAFT_WRITE_ENABLED: must be exactly "true".
- SCHEDULER_READ_ENABLED: must also be exactly "true".
- SCHEDULER_DRAFT_MAX_TARGETS: required positive decimal integer, <=1000 technical ceiling.
- SCHEDULER_DRAFT_HORIZON_MS: required positive safe integer milliseconds.
- SCHEDULER_DRAFT_MAX_MEDIA_BYTES: required positive decimal integer, <=10 MiB technical ceiling.

There are NO working defaults or newly approved product limits. Missing/malformed policy fails 503 before accessing the draft schema or R2. Tests use explicitly fictional policy values.
The already-reviewed draft SQL task from #58/#61 is a prerequisite for activation; this step adds no new schema and applies no SQL.
Before a separately approved public rollout, agree the actual limits and admission/rate/quota policy and review all stacked dependencies. Real Meta configuration and OAuth failure remain separate work.

## Validation completed

- 76 focused groups PASS on Node 22.12.0: package 11, store 12, reader 15, existing read API 11, project preparation 12, new create API 15.
- New create API 15 groups PASS on Node 24.22.1.
- Narrow strict TypeScript PASS for scheduler-packages route/imports with the explicit test ambient surface; not a claim that all historical Worker code typechecks.
- New scheduler-package-create-api-check.cjs: 11 scenarios PASS in actual ephemeral workerd/D1/R2, disposed afterward. Real hashed sessions, atomic save, safe GET, replay, conflict, overlapping POSTs, foreign/guest/origin/disabled guards, missing media replay/fresh-create failure, corrupt receipt and zero provider jobs.
- Existing scheduler-package-d1-check.cjs: all 19 scenarios PASS, including read/calendar/date-window compatibility.
- Unit tests exercise streamed size bounds, real SQL schema, ownership, email/plan gates, missing policy/schema, failed transaction, lost acknowledgement, after-due replay and unchanged media/text/time identity.
- git diff --cached --check PASS. No frontend files changed; no full frontend build or browser session required. No paid AI, provider calls or live data used.

## Exact stop point

Create API is implemented behind OFF-by-default flags and saved for review. It is not deployed. No calendar/project creation form, confirmation/promotion, immutable R2 pinning/transcoding, queue/cron execution or additional provider connector was added.
Instagram/Facebook are the only real destination types currently resolvable. Other catalogue channels remain planned, explicitly unavailable for this API. Connected status and observed media hash do not establish current scopes, token validity, format compatibility or permission to publish.
No main merge, production deploy, D1 application, R2 writes, Worker settings, secrets/OAuth/billing change or Social activation.
Next small step: project UI with channel/text/time selection, stable per-attempt request key and explicit "Entwurf speichern"; show calendar entry after actual API acknowledgement and preserve conflict/uncertain recovery without false success.
Dependency chain: #57 -> #58 -> #59 -> #60 -> #61 -> #62 -> #63 -> this draft.
