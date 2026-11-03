# SCHEDULER-PACKAGE-D1-CHECK-01

02.11.2026. Branch codex/scheduler-package-d1-check, base local 23e859a / remote 75b5fb4d (draft PR #58), identical tree 39d435f882a601a64484c841ff95938ba096358d.
Scope: reproducible local D1/workerd integration script and this checkpoint only. Runtime/package/store/SQL sources remain unchanged.

## Execution

Command from repository root:

    node scripts/scheduler-package-d1-check.cjs

Tested on Node 24.22.1; use a compatible Node with the existing installed dependencies. No dependencies were installed or updated. Miniflare/workerd/TypeScript versions used: {"miniflare":"5.20260921.0-alpha","workerd":"1.20260921.1","typescript":"5.9.3"}.

The script compiles the four known pure modules using installed TypeScript, removes their static relative imports and assembles one test-only ES module Worker. Actual savePublicationPackageDraft executes INSIDE that Worker against env.DB, not as Node code against a fabricated D1 object. This assembly is a narrow harness, not the app's production bundler or router.
Miniflare SDK is started directly with a synthetic D1 binding and compatibilityDate 2026-09-14. It does not read Wrangler configuration, account credentials, production resources or real project/media records. The SDK uses ephemeral temporary storage, and the process completed exit 0 after mf.dispose().
Minimal fixture users/projects tables plus a synthetic constraint table are created locally. The exact three CREATE TABLE statements from database/tasks/2026-11-02-publication-package-drafts.sql are submitted to actual D1. Splitting by semicolon is deliberately limited to this known simple DDL, not a general migration parser.

## Results: 11 groups PASS, exit 0

1. Real Worker/store saves header, two separate texts/times and complete receipt in one batch.
2. Exact-key replay and reversed checkbox order perform no write.
3. Changed text under the same key conflicts without changing stored data.
4. A real UNIQUE constraint failure inserted after every possible batch prefix (including after receipt insertion) rolls back header, all children and receipt.
5. Silently skipped child causes the final SQL receipt assertion to fail and roll back siblings.
6. Synthetic transport failure AFTER real batch commit recovers the existing receipt through a fresh first-primary session, with no second write.
7. A different owner cannot save a draft for the fixture project; the response contains no package identifier.
8. An ownership change between read and write is rechecked by SQL guards; no partial package survives.
9. Corrupted destination routing column fails replay integrity validation.
10. Two overlapping dispatchFetch calls to the local Worker retain exactly one header, one child set and one receipt. This is a local-runtime overlap check, not distributed/replica consistency evidence.
11. Actual workerd Intl resolves both explicit Europe/Berlin autumn offsets; target times differ by one hour.

All observed results retain cannotDispatch:true. First-primary selection is asserted through the real session wrapper. Provider, OAuth, paid AI and production calls were not made. Wrappers inject only failure/omission/lost-ack conditions; successful statements run on actual local D1, not canned SQL results.
The test Worker exists only as an SDK script; no handler, route, cron, queue or binding is added to the application. The script lives under scripts rather than tests to avoid starting workerd in the normal unit suite. node --check passed before execution. The previous strict TypeScript and Node 22/24 SQLite results belong to #58 and were not repeated for unchanged source.

## Relationship to earlier scheduler adapter

The older single-schedule adapter persists the execution model. This check covers only the new package DRAFT store: it preserves full child snapshot/time plus targetKind and package identity, but never promotes or approves those children. Future promotion must explicitly bind package version and destination kind to each execution approval; dropping that context into the older adapter is not valid integration.
No reconciliation of its old draft DDL, independent QA or distributed safety is claimed by this test. Real R2 immutability/ownership, provider capabilities, grants, tariff checks, account-wide serialization, approvals and sending remain separate work.

## Exact stop point

Local D1/workerd draft-store compatibility check is complete and reproducible; store source did not require changes. Keep this step online as a draft PR stacked on #58. No merge/deployment, production D1/R2/Worker change, secret access, Social activation or actual publication occurred.
Next small implementation: owner-scoped read/detail/list contracts for stored draft packages, including retrieval after due date, with safe DTOs that omit internal storage keys and draft comparison identities. Then connect the calendar to those contracts; the current create-save admission is not a retrieval API.
