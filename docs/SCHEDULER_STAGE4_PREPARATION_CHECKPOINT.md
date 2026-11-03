# Scheduler stage 4.1 — destinations and admission quota

03.11.2026. Branch codex/scheduler-draft-destinations. Base production/main: 7de0890c7bc3c355b5d2c4ed40f3e707daf227ab (tree cabff898bebe3415462f7884eed5e6149142fbf5).
Status: CODE PREPARED / PRODUCTION ACTIVATION PENDING. Stage 4 is NOT complete.

## Approved initial limits

The owner explicitly confirmed in this chat:
- 2 channels per draft: existing connected Instagram/Facebook destinations.
- Horizon 30 days: SCHEDULER_DRAFT_HORIZON_MS=2592000000.
- Photo bound 8 MiB: SCHEDULER_DRAFT_MAX_MEDIA_BYTES=8388608.
- 100 NEW drafts per authenticated owner over a rolling 24 hours: SCHEDULER_DRAFT_MAX_CREATES_PER_DAY=100.
- SCHEDULER_DRAFT_MAX_TARGETS=2. Exact-key replays do not consume another admission.
These are approved initial settings, NOT currently applied runtime variables. Social publishing remains frozen.

## Separate destination metadata path

GET /api/scheduler/destinations is handled before the generic OPTIONS/CORS handler.
Real session authentication, exact SCHEDULER_READ_ENABLED=true, GET-only, no query parameters, bounded URL, private/no-store, Vary Cookie and fixed error DTOs.
It queries explicit columns from the existing social_connections table for the current owner and connected Meta providers. It does not require socialConfigured/SOCIAL_ENABLED, read/decrypt access tokens, select external account IDs, invoke OAuth, call Meta, write connection status or access R2.
The response is only {ok,destinations:[{channel,connectionId,label}],scope:"draft_only",cannotDispatch:true}. Current expiry metadata is checked conservatively; expired/malformed timestamps are excluded. Connected-state/name/ID corruption or duplicate active channels fails closed.
This is observed account metadata for a draft, not verification of scopes, secret correctness, token validity at Meta or publishing permission. No genuine connection => empty selection, never a fabricated destination.

ProjectDraftForm now uses this dedicated service rather than socialService.getConnections. Existing Social OAuth/direct-publish context and gates are unchanged. The nine-channel catalogue remains visible; other provider connectors remain unavailable.
Frontend validates the draft-only response, 2-item/channel uniqueness, reference/label shape and same-origin URL.

## Rolling quota and durable accounting

New SQL task database/tasks/2026-11-03-publication-draft-admissions.sql creates:
- publication_package_draft_admissions: owner/request key PK, unique package ID, admitted timestamp; user FK cascades on user deletion.
- idx_package_admissions_owner_time.
SHA-256 c96d8490a7faf1278e832f365000c23c996c7805b2332ffd8e9bbdf770fff4ca.

No package/project FK is deliberate: deleting a project must not replenish the quota or permit reusing a consumed request key. No text, token, recipient or image key is stored in this ledger.
The public create API requires the explicit daily-cap variable in addition to the previous three policy variables. No defaults added.
After receipt recovery and ownership checks, it checks admission history and quota BEFORE R2/hash work. Exact saved retries return first, even at the cap. A consumed key whose package was deleted conflicts rather than overwriting history.
The final quota check is part of the guarded header INSERT in the SAME D1 batch as children, ledger INSERT and receipt assertion. The receipt requires the matching ledger timestamp/package/owner/key. A silently omitted ledger insert rolls back the package, siblings and receipt.
Concurrent admissions cannot exceed the cap; count uses the owner/time index with admitted_at_ms > now-86400000. At exactly 24h the oldest admission leaves the window.
The library's optional cap preserves existing pure-store fixtures; every public create route call supplies the required configured cap. No runner or publication authority is added.
Quota responses use 429 SCHEDULER_DRAFT_RATE_LIMITED with a clear German UI explanation. Historical drafts/retries do not create a billing change.
Ledger retention beyond the rolling window is not automatically purged; user deletion cascades. Any future retention cleanup must preserve intended key-reuse semantics.

## Checks

- Full Node 22 local suite PASS on the final source after fixing the owner-transfer regression.
- Node 24: 44 targeted store/API/client groups PASS.
- Frontend TypeScript PASS; narrow strict scheduler route/destination/import TypeScript PASS.
- Vite build PASS: 114 modules; index-CfYupTjK.js / index-D4Np9vaq.css. Later changes were server/test-only.
- Real ephemeral workerd/D1/R2 API script PASS: 13 scenarios including destination reads with Social frozen and concurrent admissions at the cap; disposed, zero provider jobs.
- Updated built-preview draft-form Edge smoke PASS: the global Social endpoint reports frozen/unavailable while the dedicated draft destination endpoint supplies synthetic owned metadata. Save/calendar, exact retry, disabled/conflict, DST/past, mobile 320 and project/guest isolation remain passing.
- Tests cover expired/malformed destination expiry, no guest/foreign leakage, no token/external ID selection, disabled/missing schema, initial quota denial before R2, free retry, 24h boundary, project deletion conservation, consumed-key conflict and missing-ledger rollback.
- A full run found that the new admission history could return 409 after project ownership transfer. Fixed by checking current project ownership before admission-history conflict; the existing 404 privacy contract is preserved. Final runs pass.
- git diff --cached --check PASS. No credentials or production data in fixtures/docs.

## Production D1 access and exact stop

A temporary dashboard tab was opened for dfbk-db. Console navigation succeeded. A READ-ONLY sqlite_master SELECT for the necessary table definitions was attempted, but the browser tool timed out; subsequent tab recovery also timed out. Its result was NOT observed. The owner subsequently confirmed the Console opens normally on their side; browser automation recovery, not a new password/token, is needed. Do not infer table existence or successful schema verification from that attempt.
No production CREATE/ALTER/DROP/INSERT/UPDATE/DELETE, backup/restore, secret, OAuth, R2 write, scheduler flag or Social activation was performed in stage 4.1. Production remains the stage-3 code release with its features OFF; this patch is not merged/deployed.
The already reviewed base task creates 3 draft tables + 2 indexes; the new admission task adds 1 table + 1 index and must follow it. Neither is confirmed applied to production. CREATE-only DDL must not be run blindly.
The initial limits are approved. Remaining work is operational evidence/action, not another request to choose those same limits:
1. Restore dashboard access and observe production schema and existing owned Meta connection availability using metadata/aggregates only; do not copy personal rows.
2. Record a valid backup/recovery point and review the exact two tasks against the actual schema.
3. Review/release this code patch, keeping Social false; apply only reviewed necessary DDL and verify constraints/shape.
4. Set approved scheduler policy values; enable read first, check destination behavior, then enable writes only after all prerequisites pass.
5. Stage 5: authorized own-project save/replay/calendar verification. If no genuine connection exists, report that blocker; do not fabricate one or enable OAuth/publishing as an incidental shortcut.

Checkpoint is saved online in the draft PR. This is a short stage-4 preparation increment, not a claim that live drafts or automatic posting work.
