# Scheduler drafts release — five short stages

03.11.2026. Coordinator checkpoint. Scope: release the existing draft/calendar work safely; automatic sending remains outside this release.

## Stage plan

| Stage | Deliverable / exit condition | Status |
| --- | --- | --- |
| 1. Assemble | One draft release PR into main containing #57–65; frozen source/head manifest and this checkpoint. No merge or production action. | DONE when this release PR is created |
| 2. Validate | Validate the combined candidate, review SQL and flags, record final tree/check results and remaining blockers. Existing green local results remain evidence, not CI claims. | NEXT |
| 3. Release code OFF | After concrete release approval: one squash commit into main, observe Cloudflare build/deploy and verify active version; scheduler/Social stay OFF. Main's existing auto-deploy means merge is a production-affecting action. | NOT STARTED |
| 4. Activate drafts | Agree actual parsing/admission/quota limits; resolve account-selection blocker below; review live D1/schema, backup/rollback and separately approved SQL/settings actions; enable only reviewed draft functionality. | BLOCKED on prerequisites; not activated |
| 5. Verify real flow | With an authorized test session: own project -> draft save -> calendar -> exact retry, foreign-access denial and no provider publication. Record actual outcomes, then decide the next increment. | NOT STARTED |

Each stage ends with an online checkpoint. Do not combine an unfinished schema/settings operation with another large coding step. No fresh request to confirm already authorized reversible preparation is needed; merge/deploy and production DB/settings actions remain concrete review/approval boundaries.

## Frozen candidate manifest

Verified through GitHub API at stage 1. All nine PRs are OPEN, DRAFT, UNMERGED with sequential bases:
- #57 codex/scheduler-package-local: 098c2aaac2c320a97473fc95bafa50d52a91eb73, base main.
- #58 codex/scheduler-package-store: 75b5fb4d8f2cd3817ea82ce4f2ee690465d17e62, base #57 branch.
- #59 codex/scheduler-package-d1-check: 3310d553f2bc646ec06d166299956dccfc26797c, base #58.
- #60 codex/scheduler-package-read: 6bac899be6c96af4a8708e0baea575f922a2d4ea, base #59.
- #61 codex/scheduler-package-read-api: 53dfd600aca373b2b955e600875af4e6e03ddbb2, base #60.
- #62 codex/scheduler-calendar: 5127ce722f13a75e2b5cdb75324c03e0b995ebe0, base #61.
- #63 codex/scheduler-project-draft: 3bd3a232d3bf2ca6619a6a8ecc0262d6850aa3b2, base #62.
- #64 codex/scheduler-project-draft-api: 19781d8b4c6adf6257cf106a85fe64c1c821da89, base #63.
- #65 codex/scheduler-project-draft-form: dd62344aaaf57d242c5ab591f630e7a930455390, base #64.
- Verified main: b57a8d594cf2f185fb9549e818f974ccf7a209c1.
- Final #65 source tree: 225bbef768110becd3e97c9acf5e461edc162cd0. Local equivalent commit: 35c29d7e7d3a309866277566cc85b64eaeb913e4.
- Combined code delta against main: 49 files, 2815 additions / 1 deletion. This release adds only this coordinator document; no implementation modification in stage 1.
- New release branch: codex/scheduler-drafts-release. Remote release commit has main as its single parent and includes the final source tree plus this file. Local source and remote release trees must match before review.
- Keep original stacked PRs as evidence until a successful release; no individual merge/closure occurred.

## Current checks and actual configuration evidence

Latest source commit #65 has one completed successful GitHub check: "Workers Builds: dfbk-app". Legacy commit status endpoint reports pending with ZERO statuses; that is absence of statuses, not evidence of an unfinished/failed test.
No .github/workflows directory exists in this checkout; automatic GitHub Actions unit/security tests are not established. Cloudflare build success is NOT a full regression result, nor proof of an active production deployment.
Completed local tests/build/runtime/browser results are recorded in the per-step checkpoints. Stage 2 must record verification against the combined release tree; stage 1 did not rerun code tests because only this document was added.
Repository wrangler.jsonc: Worker dfbk-app, entry worker/index.ts, ASSETS=dist, DB D1 binding, MEDIA R2 binding. SOCIAL_ENABLED is "false"; SCHEDULER flags absent, no triggers configured. No Cloudflare panel/current live variables inspected in stage 1. No secret values read.

## Material activation blocker

worker/routes/social.ts -> connections() reads/exposes connected accounts only when socialConfigured(env) is true. With SOCIAL_ENABLED=false, the private form cannot select Meta accounts even if the new scheduler flags/schema are ready.
Therefore "enable scheduler flags = usable connected-account draft flow" is NOT established.
Do NOT enable Social publishing merely to make the selector work. Stage 2/4 must choose/review a separate draft-only read path for existing owned destination references, or obtain a separately scoped configuration decision. Fresh OAuth and actual connected-account existence remain unconfirmed; a read path cannot manufacture connections.
Other activation prerequisites: actual policy values/admission quotas are not approved/configured; the draft SQL task has not been applied to production; immutable media pinning, approval and dispatch do not exist in this release.
SQL task reviewed for inventory only: database/tasks/2026-11-02-publication-package-drafts.sql creates 3 draft/receipt tables + 2 pagination indexes with owner/request uniqueness and FK guards. It is not an execution queue; no SQL was run against production.

## Exact stop

Stage 1 assembles a reviewable single-commit candidate and records blockers. No main refs, original PR states, production deployment, D1/R2, Worker configuration, OAuth/secrets/billing or Social activation changed.
Next action: stage 2, combined-candidate validation and resolution plan for draft-only account selection, before any main merge.
