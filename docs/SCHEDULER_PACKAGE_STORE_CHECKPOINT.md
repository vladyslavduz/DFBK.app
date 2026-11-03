# SCHEDULER-PACKAGE-STORE-LOCAL-01

02.11.2026. Branch codex/scheduler-package-store, base local 979581b. First slice is online in draft [PR #57](https://github.com/vladyslavduz/DFBK.app/pull/57), remote 098c2aaa, identical base tree 848f2d59c8affe8611903e45fe97c601f9adc58e.

## Scope

Draft persistence only: scheduler-package-store.ts, draft SQL under database/tasks, one target suite and this checkpoint. No existing kernel/state/package source changed. No Worker binding, public API, approval or execution is enabled; every result has cannotDispatch:true.
The three draft tables store the entire frozen package, typed child snapshots (including WhatsApp mode) and a complete receipt. They are NOT a production migration and do not replace or activate the older single-schedule execution schema. Before promotion to that execution model, package/version/target-kind and approval context must be carried through explicitly.

## Storage contract

savePublicationPackageDraft takes an injected D1-like port, a future server-authenticated owner, request key, package input, clock and explicit policy. It builds/validates its own package; it never accepts a pre-built SQL plan or an asserted approved state. This module does not authenticate requests or resolve grants/material ownership. The service must supply trusted server projections.
Owner-scoped receipt lookup and an actual projects.id/user_id check precede writing. A single batch inserts the header, all ordered children and an unconditional final receipt assertion. Zero/missing child writes or ID collisions fail completion and roll back the full batch under the port contract. Statement values are bound, never interpolated into SQL.
Receipt reads use one owner-filtered joined query and verify full package identity/payload, count, ordering, child IDs, serialized snapshots, routing columns and receipt metadata. Invalid/orphan/corrupted receipts are never treated as success or silently repaired. Checkbox order is canonicalized; changing materials/time/destination under the same key conflicts.
After a lost acknowledgement, only a fresh first-primary receipt lookup is performed: found matching receipt -> replayed; absent -> uncertain; no automatic second write or external action. Saved means a valid completed receipt after an acknowledged batch, not proof that this caller uniquely inserted the row in a race. Responses never echo SQL, captions, identities, recipients or raw errors.

## Verification and limitations

12 focused groups PASS on Node 22.12.0 and bundled Node 24.22.1. Strict noEmit TypeScript of store and imported package/kernel/state PASS.
Tests use real SQLite :memory: SQL with minimal users/projects parent fixtures, not fabricated successful DB outcomes. The harness explicitly models a transaction and numbered-parameter binding; it is not real D1/replica/runtime evidence. No DB files or remote credentials are used.
Coverage: complete round-trip with distinct text/time; exact-key and reordered replay; changed-payload conflict; injected failure at each write; silently skipped child; lost post-commit acknowledgement; wrong owner/foreign project; ownership change before write; global child-ID collision; corruption of payload/routing fields and missing receipt/child; private error redaction; interleaved identical requests; three WhatsApp modes.
The interleaving fixture is a local serial SQLite scenario, not a distributed concurrency proof. first-primary selection is observed via the port; real consistency is not established here.
[Cloudflare D1 documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/) confirms transactional rollback for failed batches and session support; consulted 02.11.2026. No explicit BEGIN/COMMIT SQL is submitted by the production module; those statements are test harness only.
No broad application tests or frontend build repeated: the module is not imported by the application. Draft-save retries still pass package planning admission against the supplied clock/horizon; retrieval of drafts after their due date needs the next dedicated read path, not an automatic create retry.

## Exact stop point

No source/runtime/configuration on production changed. No schema was applied, no OAuth flow/token/secret access, no real publication or paid generation occurred. Real material ownership/R2 pinning, destination grants, entitlements, aliases for one external account reached through multiple connections, account-wide locks/rate limits, approvals, cancellation/reschedule, retention/deletion and promotion to executable schedules remain pending.
Next small slice: verify this draft store against local D1/workerd and reconcile package storage with the existing scheduler adapter design; then add owner-scoped draft read/list contracts and tests. Keep all work online in reviewable branches/PRs; merge/deployment/activation require their separate authorization.
