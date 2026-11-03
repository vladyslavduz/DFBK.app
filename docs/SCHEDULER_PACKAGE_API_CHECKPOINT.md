# SCHEDULER-PACKAGE-READ-API-01

02.11.2026. Branch codex/scheduler-package-read-api. Base local f2af9e1 / remote 6bac899b (draft PR #60), same tree 41eefd581aedac93b7a95196bc36cb7da4e85c5c.

## HTTP contract and inactive boundary

- GET /api/scheduler/packages: safe summaries, nextCursor, cannotDispatch:true. Parameters: limit (default technical read bound 20, accepted 1..20), optional projectId, paired cursorCreatedAt and cursorId.
- GET /api/scheduler/packages/:id: safe package detail and cannotDispatch:true; no query fields accepted.
- Existing requireUser and hashed dfbk_session sessions authenticate the actor. Owner is ALWAYS actor.id. Guests, unknown, expired or revoked sessions receive a fixed 401, without session diagnostics. An admin has no automatic access to another owner's draft.
- SCHEDULER_READ_ENABLED must be exactly the string true. It is optional in Env and deliberately absent from Wrangler configuration; unset/false/other values return 503 SCHEDULER_DISABLED after authentication and before any draft-schema query. This read flag is independent of Social and cannot enable publication.
- Own historical draft READ access does not depend on an active trial/paid plan. Existing project ownership and active login remain required. This grants neither creation nor scheduling/dispatch rights. Deleting/transferring a project removes the original owner's access; no new retention policy is activated.
- Only GET is allowed. Other methods including HEAD and OPTIONS receive 405 / Allow: GET. The dispatcher checks this namespace before its existing global OPTIONS wildcard, so these private endpoints do not advertise wildcard CORS. Unrelated routes retain their existing behavior.

## Validation, limits and errors

Unknown/duplicate query keys, body-owner injection, malformed IDs/percent escapes, invalid limits and unpaired/noninteger cursors are rejected with 400. URL length is capped at 4096 units (414). Missing and foreign package detail both return identical 404 SCHEDULER_PACKAGE_NOT_FOUND responses.
All responses are private/no-store, Vary: Cookie, nosniff and no-referrer; there is no Access-Control-Allow-Origin reflection. SQL/schema failures map to 503 SCHEDULER_UNAVAILABLE; inconsistent stored data to SCHEDULER_DATA_UNAVAILABLE. Raw SQL, stack traces, recipient data and tokens are never returned or logged by the new handler.
The reader now rejects individual serialized fields above 1 Mi UTF-16 units and total selected serialized values above 2 Mi units before parsing stored JSON. It returns too_large, mapped to 503 SCHEDULER_READ_LIMIT. The complete successful HTTP JSON response is capped at 256 KiB UTF-8; oversized content is rejected, never silently truncated. These are technical prototype read limits, not subscription rules. They apply after the bounded database fetch; they are not a proof of a pre-transfer D1 byte/CPU budget. Future create APIs must bound stored payloads compatibly, and activation requires representative volume checks.
Two owner/created/id and owner/project/created/id indexes are added ONLY to the draft SQL task. They support the existing keyset ordering, not a calendar-date query. No migration or index was applied to production.

## Verification

34 focused tests PASS on Node 22.12.0 and 24.22.1: 10 new HTTP groups plus 12 reader and 12 store groups. Tests use real in-memory SQLite, actual requireUser/hashSessionToken and the actual application dispatcher. Sessions, users and project materials are artificial. They cover authentication, disabled/no-schema behavior, safe DTOs, expired-trial READ access, foreign/admin isolation, all unsupported methods, strict query parsing, cursor paging, corrupt data, URL/serialized/UTF8 limits, unchanged data and existing health/unrelated dispatch.
Strict noEmit TypeScript of the new route/imports PASS with tests/helpers/scheduler-runtime-types.d.ts. This is an explicit narrow test ambient interface, NOT generated Cloudflare types or a claim that the entire historical Worker typechecks. The installed workspace does not contain @cloudflare/workers-types; no dependency was installed to mask that distinction.
The existing integration script now uses the actual session/user/response/route code inside local workerd with real D1 sessions. 18 groups PASS, exit 0: previous 14 groups plus real hashed-cookie HTTP reads, guest/unknown/expired/revoked sessions, disabled/query/method/temporarily absent schema, and URL/UTF8 response limits. Node 24.22.1, Miniflare 5.20260921.0-alpha, workerd 1.20260921.1; ephemeral SDK state disposed. No production resources/config/credentials loaded.
An initial integration start failed because the narrow concatenation harness exposed the string USER_COLUMNS as a Worker entrypoint. Only the harness assembly was corrected to remove named exports; production module exports were unchanged. The completed integration run passed. It now checks the known five draft statements: three tables and two indexes, not a general SQL splitter.
node --check for the script and git diff --check PASS. A broad application or frontend build was not rerun: tests directly exercised touched dispatcher behavior and workerd route execution. This is local-runtime evidence, not production/replica/provider validation.

## Exact stop point and next step

Handlers are registered in the branch's application dispatcher, but the optional feature flag is not enabled anywhere in configuration. No merge/deployment occurred. No production schema, D1/R2 data, secret/OAuth, billing, AI generation, cron/queue, approvals or real publishing changed. Social remains frozen.
Publish as a draft PR stacked on #60; preserve #57 -> #58 -> #59 -> #60 dependencies. Safe read-only HTTP is prepared, not a production-enabled planner.
Next small task: date-range/event selection for the calendar (using each target's time, including overrides), with bounded pagination and tests. Then create the calendar UI against the real contract. Creation, confirmation, edits/cancellation and execution still need their separate service/permissions work; do not invent scheduled/published states or store simulated schedules in production localStorage.
