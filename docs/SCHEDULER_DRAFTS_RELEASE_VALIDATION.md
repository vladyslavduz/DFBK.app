# Scheduler drafts — stage 2 validation

03.11.2026. PR #66, branch codex/scheduler-drafts-release.
Validated remote code candidate: 8b9bbeff95c63692af1b13e7573ce39666d0040f, tree 0a7cf5b55babc0dfb081c654e5d2d205abdd1203.
Local equivalent: d5b61bf26b6493a8f8aed1eba4285dbf63ce8808. No implementation/configuration/dependency changes during this stage; only this report and the stage checkpoint are appended afterward.

## Result

Stage 2 COMPLETE.
Code-only release with all scheduler flags OFF: checks passed; ready for a separate stage-3 release decision and active-version verification.
Activation of usable drafts: NOT READY. The destination-selection dependency, production schema and actual policy/quota settings remain unresolved. This validation is not permission to publish, run OAuth, apply SQL or turn Social on.

## Completed checks on combined candidate

All commands exited 0:
- Full existing local test run: node --experimental-sqlite --test --test-concurrency=1 --test-reporter=dot (Node 22.12.0). Not just the newly added scheduler tests.
- Frontend TypeScript: tsc -p tsconfig.publishing.json --noEmit.
- Strict scheduler route/import TypeScript with tests/helpers/scheduler-runtime-types.d.ts. This is a narrow ambient surface, not a full historical Worker typecheck claim.
- Vite production build: 114 modules; index-Cl0yMp8m.js / index-D4Np9vaq.css.
- Wrangler 4.136.1 deploy --dry-run: PASS, exited with "--dry-run: exiting now"; Worker bundle 204.23 KiB / gzip 45.71 KiB, 107 local asset files read. Bundle output only in a temporary directory. No upload/deployment/traffic change command was issued.
- scheduler-package-d1-check.cjs: 19 real ephemeral workerd/D1 scenarios PASS (transactions/rollback/recovery, ownership, corruption, paging, auth, read limits and calendar ranges).
- scheduler-package-create-api-check.cjs: 11 real ephemeral workerd/D1/R2 scenarios PASS (authenticated atomic creation, replay/conflict/concurrency, safe DTO, unavailable media and zero provider jobs).
- planner-calendar-smoke.cjs: built-preview Edge PASS (month/DST bounds, overrides, paging/filtering, protected media, 390/320px, late-response isolation, disabled/retry/guest and no mutations).
- planner-draft-form-smoke.cjs: built-preview Edge PASS (own material/text, nine visible channels, independent time/text, 320px, server acknowledgement/calendar, frozen exact retry, rejection/conflict, DST/past and project/guest/incomplete-state isolation).
- git status after commands: clean before writing reports. wrangler.jsonc, package.json and package-lock.json have ZERO diff against main.
- Installed versions match lock: Wrangler 4.136.1, TypeScript 5.9.3, Vite 7.3.6, React 19.3.0, Miniflare 5.20260921.0-alpha, Playwright 1.64.1.

Runtime tests used temporary SDK storage and disposed it. Browser API/identity/content were synthetic. The previous manual-project smoke on the identical implementation remains recorded in the form checkpoint; it was not unnecessarily repeated here. No paid generation, real recipient, OAuth flow or provider post was used.

GitHub check on the validated remote SHA: Workers Builds: dfbk-app completed SUCCESS. Legacy status endpoint: pending with zero statuses; no pending-test inference. No .github/workflows exists in the checkout. Local suite success is not claimed as automatic GitHub CI coverage.
The documentation-only follow-up commit may trigger a fresh build; its status and main/head leases must be checked at stage 3.

## SQL review

File: database/tasks/2026-11-02-publication-package-drafts.sql.
SHA-256: b59640268cfb9ee854bb808cab42a2421b284d217467eff32ed47adb3eb0e8e9.
Inventory: publication_package_drafts, publication_package_draft_items, publication_package_draft_receipts; indexes idx_package_drafts_owner_created and idx_package_drafts_owner_project_created.
- Composite parent uniqueness supports the child/receipt composite FKs; owner/request uniqueness prevents duplicate package receipts.
- The guarded single write batch checks current project ownership and asserts all children before committing the complete receipt. Injected failures and lost acknowledgements pass the actual D1 tests.
- Drafts do not have executable approval; no provider queue, trigger or scheduler execution table is installed by this task.
- This is CREATE-only DDL, NOT IF NOT EXISTS. Do not rerun blindly. Production table existence/shape, users/projects prerequisites, backup and verification must be checked before any approved application.
- Local/ephemeral schema results do not establish production schema state. No remote D1 query or SQL application was performed.

Known volume limits: date filtering uses an owner-history EXISTS/JSON scan, not a normalized time index. Serialized reader budgets apply after database fetch. Before public write activation, agree admission/rate/storage quota policy and representative workload expectations. The API's parsing ceilings are not a product quota.

## Flags and activation boundary

Reviewed in source and local dry-run, NOT refreshed from the live Cloudflare panel:
- Repo SOCIAL_ENABLED="false"; SCHEDULER_READ_ENABLED and SCHEDULER_DRAFT_WRITE_ENABLED absent. No cron triggers and only fetch Worker entrypoint.
- Missing read flag returns the existing disabled response after session authentication, before draft schema access.
- Missing write flag retains POST 405. Even with it true, creation also needs read enabled and explicit valid MAX_TARGETS/HORIZON_MS/MAX_MEDIA_BYTES policy.
- Worker startup does not apply SQL. Merely merging code is not schema/flag activation.
- In the current configuration stage 3 must remain code-only/OFF. Before deployment, inspect effective live variable overrides; config file defaults alone do not prove live state.

## Destination blocker and concrete follow-up

Current chain:
ProjectDraftForm -> socialService.getConnections -> /api/social/connections -> connections() -> socialConfigured(env).
With SOCIAL_ENABLED=false, this returns unavailable/no connected accounts. Enabling only scheduler flags does not fix it.
Recommended separate small patch before stage 4:
1. Add a scheduler-owned, session-authenticated read-only destination endpoint under scheduler read gating.
2. Query explicit fields only: owned connected Meta connection references/labels and relevant status/expiry metadata. Never SELECT *, select/decrypt tokens, discover accounts, write connection status or call Meta.
3. Use it only in the draft form. Preserve existing Social OAuth/direct-publish gates and SOCIAL_ENABLED=false.
4. Test foreign/guest/disabled/missing-schema/invalid destination behavior and a draft save with Social frozen, including real temporary D1 and the built UI.
5. A read path still requires an existing genuine connection; if none exists, stop before inventing one. Fresh connection/OAuth configuration remains a separate authorized action.

This patch is a proposed resolution, NOT implemented or claimed tested in stage 2. Stage-3 OFF release does not depend on making drafts usable immediately; stage-4 activation does.

## Exact stop

Validation report saved to the release PR. Follow-up contains documentation only; no force push, main merge, production deployment, SQL/R2/settings/secret/billing modification or Social activation.
Next numbered stage: stage 3, a separately scoped one-squash-commit code release with scheduler/Social OFF, only after final main/head/build/live-flag review. Do not mark stage 4/5 complete until actual activation and real flow evidence exist.
