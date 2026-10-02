# Backend Admin + Trial + Manual Plan Management v1

Checkpoint: 2026-10-02. Implementation and local validation complete; production deploy/E2E pending. NOT CLOSED.

## Architecture audit and decisions

- Reuses `dfbk_session`, SHA-256 token hashing, existing `sessions`, `users`, cookie flags and UUID IDs. `requireUser` is shared by auth/me, account entitlements and requireAdmin. Login, registration, OAuth, logout, Projects, Media and Generation implementations are otherwise unchanged.
- Admin role is read from `users.role` for every request, never from email or a client flag. Missing, unknown, revoked, expired sessions return 401; authenticated non-admin returns 403.
- User defaults in both registration paths are preserved; trial expiry remains NULL unless explicitly supplied when switching to trial.
- Production SQL schema was supplied as already verified by the user. No production database access was available here; no schema or migration changes were made. The existing `database/schema.sql` is explicitly a future draft, not the production source of truth.
- Previous entitlements used `user_entitlements` and a Bearer-key POST mutation. Current plan reads now use `users.plan`, as required by this specification. Existing account entitlement response shape and previously implemented feature values are preserved. No new quotas or generation gates were added.
- Old POST `/api/admin/users/:id/plan` no longer performs a mutation (401/403 before method handling, 405 for authenticated admin). `ADMIN_API_KEY` cannot grant Admin API access. The old table and secret are left untouched; they are no longer used for plan writes. This deliberately closes an alternate unaudited mutation path.
- Before production rollout, compare any historical Business grants in `user_entitlements` against `users.plan`; do not silently migrate or revoke real client grants. This specification states all existing users are currently trial. Frontend reads the same account endpoint after this change.

## API

- `GET /api/admin/me`: `{id,email,role}`; admin only.
- `GET /api/admin/users?email=...`: exact normalized email lookup; one result, no export/list. `{user:{id,email,role,plan,planSource,trialExpiresAt,planUpdatedAt,createdAt}}`.
- `PATCH /api/admin/users/:id/plan`: `{plan:"trial"|"business", trialExpiresAt?:"YYYY-MM-DD HH:MM:SS"}`. Optional expiry only for trial. Response `{changed,user}` from actual transaction state.
- `GET /api/auth/me`: existing `ok`, user id/email/emailVerified and session.expiresAt preserved; role/plan/source/expiry/timestamp/createdAt added.
- `GET /api/account/entitlements`: existing frontend contract, now backed by users.plan.

## Atomicity and idempotency

A D1 `batch` transaction first inserts audit using `INSERT ... SELECT` from the current users row only when requested plan differs. UPDATE is conditional on the unique audit ID from this transaction; a SELECT in the same batch returns factual state. Old plan is read inside the transaction, avoiding stale pre-read audit values. Batch failure rolls back both writes.

Same plan returns changed=false without changing source, timestamp or expiry and without another audit. Explicit same-plan expiry edits are rejected with `TRIAL_EXPIRATION_CHANGE_NOT_SUPPORTED`; there is no disguised USER_PLAN_CHANGED record. Business clears expiry; switching back to Trial without a supplied expiry sets NULL. There is no arbitrary duration.

`isTrialActive` uses server UTC time, NULL expiry is active, equality/expired is inactive, Business is never active Trial. `getUserPlanState` exposes plan/source/expiry/active without imposing new entitlements. Expired Trial never becomes Business.

## Security

PATCH requires HTTPS, same-origin Origin, application/json, and rejects cross-site Fetch Metadata. Authentication/authorization runs before lookup/mutation. Body stream is capped at 1024 bytes even without Content-Length; email capped at 254 characters, ID at 128, exact indexed lookup limited to one row. Unknown body fields (including role) are rejected.

No existing global rate-limit infrastructure was found. V1 uses the specification's minimum: authorization, validation and bounded requests. This is not a distributed per-minute rate limiter; add a managed limiter before broader use if needed. No frontend admin token, public media URLs or secrets were introduced. New error logging only prints a generic error code, no SQL/stack/session information.

SECURITY TODO: Mandatory MFA / Passkey for Admin account before wider production use.

## Validation performed

`node --test tests/*.test.mjs`: 11 passing tests. Admin tests use actual SQL against an in-memory SQLite fixture with production-equivalent relevant columns and a transactional D1 adapter. External email/Google/OpenAI calls and R2 storage are mocked; this is local integration testing, not production E2E.

Covered: anonymous, unknown/expired/revoked sessions, non-admin, role changes, exact email search, no sensitive fields, user not found, trial/business changes, source/timestamps/expiry, audit contents, no-op, rollback on audit INSERT and users UPDATE failures, invalid plans/timestamps, Origin/content-type/body validation, role injection, server-time boundaries, auth/me, logout, registration defaults for email and Google, password login, Projects create/list, private upload/read ownership, text generation before/after plan changes, frontend entitlement contract.

`npm run build`: passed. `wrangler deploy --dry-run`: passed, expected DB/MEDIA/ASSETS bindings.

Full TypeScript check with generated Worker types still reports three pre-existing errors: src/lib/api.ts:30, worker/lib/image-optimization.ts:162, worker/lib/password.ts:112. Confirmed on unchanged main in a separate worktree. No new Admin errors reported. These unrelated files were not changed.

## Production blockers and required E2E

Wrangler reports not authenticated. No production deployment, remote schema queries, real admin login or real tariff mutations were performed from this environment. Do not label this block CLOSED yet.

After authorized production deployment:

1. Verify users columns/defaults and admin_audit_log exist as already established; do not replay SQL migration.
2. Login as dfbk.app@gmail.com; GET admin/me must return 200/admin. Normal test account returns 403; anonymous returns 401.
3. Use a dedicated test account. Search it, switch trial → business → trial, compare responses/new GET with D1 users and audit log. Same-plan PATCH adds no audit.
4. Exercise invalid plan, invalid expiry, cross-origin/missing Origin, anonymous and user PATCH. No sensitive response fields.
5. Check real login, Google OAuth, auth/me, logout, projects, media and generation. Do not run a paid image pipeline unnecessarily merely to test admin behavior.
6. Mark Backend ADMIN + MANUAL PLAN MANAGEMENT V1 CLOSED only when production E2E passes.

Next: Frontend Admin v1. Stripe, role management, new pricing limits, /admin frontend and MFA implementation are outside this change.
