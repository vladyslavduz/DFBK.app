# DFBK.app — Project Management + Trial Entitlements v1

Дата: 06.10.2026 (Europe/Berlin).
Backend implementation: DONE LOCALLY / TESTED.
Production schema: SQL TASK PENDING.
Production deploy/E2E: PENDING.
Overall backend stage: NOT CLOSED.
Frontend implementation: NOT STARTED, blocked until backend CLOSED as requested.

## Source audit

Based on main `d0b9e09` (Entitlements: enable Share for Trial). Existing Admin API is session-authorized with users.role; users.plan is the current plan source. Trial share=true is preserved. No project deletion exists. Automatic optimization runs after upload in Worker index, while explicit retry goes through /optimize. Previously there was no persistent guard for these two entry points; optimized versions could be replaced repeatedly.

## Implemented

- New projects always start with `Neues Projekt` / titleSource=system. Legacy creation body `title` remains accepted but is not used as a final/manual title. Description stays optional.
- Existing text-generation provider request now asks for camelCase `projectTitle` in the structured schema in addition to the same three content fields. No extra title request/model/provider was added. Strict schema includes required nullable title; invalid/missing title is ignored if the three texts are valid.
- Prompt asks for short factual German names across all small-business categories, details that distinguish works, no slogan/DFBK/date/invented facts. Backend rejects empty, unsafe, overly long and known generic names. Meaningfulness, photo correspondence and German quality still require real-photo production review; mocked tests do not establish model quality.
- Automatic title update runs with content saving, guarded by current D1 title_source != manual. A manual rename during in-flight generation wins. Same-owner collisions get the first available numeric suffix only as fallback; title/date remain separate. No naming API call.
- PATCH /api/projects/:id accepts only title. Session and ownership, HTTPS/same-origin Origin, application/json, 4 KiB bounded JSON; title trim/normalized whitespace, plain text/no control/tag delimiters, max 120 Unicode codepoints. Sets titleSource=manual even when text matches the existing title. Foreign project returns 404. Actual state returned, not a presumed local value.
- Atomic INSERT ... SELECT checks users.plan and owner project count in the same SQL write. Trial may create exactly five, including concurrent requests; Business bypasses limit. Quota counts all existing projects/statuses, including legacy and drafts; a downgrade to Trial does not delete existing projects. No new Delete, credits or generation paywall.
- GET /api/account/entitlements adds usage:{projectsUsed,projectsLimit}; Trial limit=5, Business=null. Existing voice/share/integration fields retained. No project-limit restriction on generation/read/optimization of project five or earlier.
- One successful stored optimization per project. Both automatic upload and explicit optimize use persistent DB claim before provider access. State=processing returns PHOTO_OPTIMIZATION_IN_PROGRESS, completed or existing optimized returns PHOTO_ALREADY_OPTIMIZED. Both 409.
- Provider/read/storage failures restore available and allow retry. Completed optimized media and completion state commit in one D1 batch. Lost D1 success response is reconciled before deleting an R2 object; a working result is not deleted. No old optimized replacement/deletion pipeline remains.
- Reupload into a processing/completed project is rejected. Conditional media INSERT closes the race between upload and optimize claim. This avoids changing original beneath an in-flight edit or bypassing completion by replacing the input photo. Available projects may upload/retry as before.
- Image edit fetch has a 180-second abort timeout. Model/quality/prompt otherwise preserved. No secrets, public media URLs, new bucket, Stripe, user/role changes or frontend features added.

## Separate SQL dependency

Read `docs/DFBK_PROJECT_MANAGEMENT_SQL_TASK.md`.
Apply explicitly `database/tasks/2026-10-06-project-management-trial-v1.sql` after preflight/backup; it is NOT automatically applied. Four additive projects fields, conservative legacy-title backfill, existing optimized → completed. No production D1 write was performed in this session.

Do not merge/deploy dependent code to production before SQL verification. Existing Worker would fail on missing columns, and creation could save a project before its new-column read fails. GitHub automatic builds/deploys make this ordering mandatory.

## Actual frontend API contract

### Creation

POST /api/projects, usual session cookie, existing description body. Response HTTP 201 includes:

```json
{"ok":true,"project":{"id":"...","title":"Neues Projekt","titleSource":"system","photoOptimization":{"state":"available"},"description":null,"status":"draft","createdAt":"...","updatedAt":"...","media":null}}
```

Trial 6: HTTP 403 `{ok:false,error:"TRIAL_PROJECT_LIMIT_REACHED",limit:5}`. Existing projects remain readable/usable.

### Rename

PATCH /api/projects/:id `{title:"Hochzeitstorte Familie Müller"}` → HTTP 200 `{ok:true,project:{...actual state...}}`.

Errors: INVALID_PROJECT_TITLE / INVALID_PROJECT_UPDATE / INVALID_JSON=400; INVALID_CONTENT_TYPE=415; REQUEST_TOO_LARGE=413; INVALID_ORIGIN=403; PROJECT_NOT_FOUND=404; PROJECT_UPDATE_FAILED=500. Existing session errors remain 401.

### Generation and reads

POST /api/projects/:id/generate keeps existing `{ok:true,content:{googleBusiness,socialMedia,websiteReference}}` and adds `project` with factual updated title/titleSource/date/state. Read/refresh GET /api/projects/:id if necessary. GET /api/projects also adds titleSource and photoOptimization, preserves camelCase createdAt/updatedAt and existing media summary.

Generated model field is `projectTitle`, not project_title; public project field is `title`. Frontend never creates an AI title itself. titleSource values: system/auto/manual.

### Usage

GET /api/account/entitlements adds:

```json
{"usage":{"projectsUsed":3,"projectsLimit":5}}
```

Business: projectsLimit=null. Plan field and existing response values remain. Refresh usage after successful creation and after plan refresh; never count from localStorage for security. Client normalization/types currently ignore unknown fields; Part B must explicitly retain usage without changing existing entitlement feature rules.

### Optimization

GET /api/projects/:id/media keeps media.original / media.optimized and adds photoOptimization:{state:"available"|"processing"|"completed"}. Project list/detail also expose this state.

POST /api/projects/:id/optimize requires same-origin Origin, returns existing successful `{ok:true,optimized:{id,mimeType}}`.

409 PHOTO_OPTIMIZATION_IN_PROGRESS → show busy, refresh media state.
409 PHOTO_ALREADY_OPTIMIZED → show completed, refresh existing private media; do not call provider again.
Technical failure → original usable, text generation independent, retry available after confirmed release.

Automatic upload optimization remains enabled: after upload, explicitly read media state before showing/triggering any optimization action. Do not promise another paid edit after a successful automatic optimization. Reupload after processing/completed is also 409.

## Local validation

25 tests passed: original Admin/Auth/OAuth/Projects/Media/Generation regression suite plus 14 project-management integration cases using actual SQL in SQLite fixtures. External email/Google/OpenAI and R2 mocked. SQL TASK applied ONLY to these local fixtures.

Covers placeholder/title fields; same text call/title/three texts; duplicates; invalid-title fallback; manual rename/reload/regenerate and concurrent rename; twelve simultaneous Trial creations yield five successes; Admin grant/revoke; usage and preserved Trial share; successful edit/private reads; automatic vs manual shared guard; double-call provider count=1; technical failures/retry; R2/D1 rollback; lost D1 success response; anonymous/foreign/no-original; post-completion reupload.

Build passed. Worker packaging/dry-run passed with expected bindings. Full TypeScript check still has two existing errors in src/lib/api.ts and worker/lib/password.ts; no errors reported in new backend code. Existing image-optimization typed-array error fixed in the modified module by using owned ArrayBuffer. This is not a claim that full tsc passes.

## Operational limits

A hard Worker termination or unconfirmable D1 commit can leave processing. Keep the lock, reconcile media/R2 and recover only after the old operation is known finished; SQL TASK explains the procedure. No automatic stale-lock reset that could double-charge a live operation.

"One successful optimization" means one successfully persisted, available optimized result. A provider may bill a failed/timed-out request or a successful response followed by storage failure. Without provider-side idempotency, exactly-once upstream billing cannot be guaranteed across such failures. Retry after technical failure is allowed as requested; no second optimization after completed is allowed.

## Remaining required before CLOSED

1. SQL TASK applied/verified in production D1.
2. Merge/deploy this backend after schema verification. Wrangler CLI currently reports unauthenticated; do not use a temporary unrelated account.
3. Real authenticated E2E: original/photo → three texts + meaningful German title; rename/regenerate preserves manual; fifth project fully works; sixth refused; Admin grant Business permits sixth; usage matches D1.
4. Real photo edit: original/optimized private reads, one success then 409, parallel calls blocked, technical failure retry; no accidental real-client test mutation.
5. Model-output quality and actual provider cost/time reviewed on real photos. Mocked German strings are not photo-understanding evidence.
6. Close backend only on factual results; then start Part B project library (cards/list, rename, sort/search, Trial usage, optimization states, mobile).

Final status: BACKEND IMPLEMENTATION READY FOR SQL/PRODUCTION VALIDATION; NOT CLOSED. Frontend waits.
