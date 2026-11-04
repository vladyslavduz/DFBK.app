# One-time Trial history confirmation (inactive)

Product baseline: 3 real lifetime projects, not current row count. Legacy unknown history
must block NEW creates until deliberate authenticated admin confirmation. Existing projects
and manual Trial/Business grants are untouched; no payment dependency or downgrade policy.

Apply tasks in order: 2026-11-04-trial-project-admission.sql, then
2026-11-05-trial-history-confirmation.sql, once in an explicitly authorized atomic schema
operation with assertions/rollback. Both remain unapplied to production. The second task
replaces one blanket trigger once; no API call drops/recreates guards. Do not apply tasks
automatically or confuse these with previously applied publication-draft tables.

Proposed Backend contract (NOT implemented): trusted server function
confirmTrialProjectHistory; authenticated POST /api/admin/users/:id/trial-project-history.
Reuse requireAdmin/session and mutation protections; derive admin_user_id from the trusted
principal, NEVER client-supplied role/actor ID. SQL's current users.role check is defense
in depth, not session authentication. No public SQL port or trusting a client's baseline
without deliberate evidence review. This is a proposal for Backend, not an approved API.

Freeze target, confirmation ID, nonnegative safe-integer baseline_consumed, authenticated
admin ID, bounded non-secret evidence reference and server-confirmed timestamp. Baseline
is the attested number of historic creates BEFORE the new admission ledger, including
deleted projects, excluding subsequent recorded admissions; count(projects) is not evidence.
Zero is allowed only as a conscious reliable admin finding, never an old-user default.
No bulk backfill or new-account verified-zero cutover is implemented.

Use one positional prepared statement (then read the receipt on a primary-consistent
session). Triggers atomically create missing unknown scope, promote unknown -> verified
and assert completion; failed scope mutation rolls back receipt too. No separate scope
UPDATE in Backend, changes() test, quota reset, or trigger manipulation per request.

    INSERT INTO trial_project_history_confirmations
      (user_id,confirmation_id,baseline_consumed,admin_user_id,evidence_reference,confirmed_at_ms)
    VALUES(?1,?2,?3,?4,?5,?6);

    SELECT c.* FROM trial_project_history_confirmations c
    JOIN trial_project_admission_scopes s ON s.user_id=c.user_id
      AND s.history_status='verified' AND s.baseline_consumed=c.baseline_consumed
    WHERE c.user_id=?1 AND c.confirmation_id=?2;

Exact repeated frozen confirmation is idempotent (including unchanged timestamp), never
rewrites audit/scope. A changed baseline/actor/evidence/time/ID or reusing another user's
ID conflicts. On lost acknowledgement read and compare ALL frozen fields, do not invent
another timestamp. Later HTTP integration may recover the original timestamp by stable
confirmation ID before issuing a retry; it must reject semantic payload changes.
Already verified scopes (even without confirmation receipts) cannot be overwritten or
reduced. Existing admissions also reject confirmation, avoiding double count/reset.
Repeated INSERT OR REPLACE receipt cannot replace audit; scope REPLACE/upsert is blocked.
Direct new verified scope insertion retains the existing trusted-seeding foundation;
it is NOT new registration authorization. Actor identity is historical text without an
FK, so deleting an admin does not block deleting that account or mutate other receipts.
Deleting the target account may cascade its scope/admissions/completions/confirmation;
project deletion cannot reset lifetime history. This is not a full privacy erasure design.

Focused tests use node:sqlite :memory:, explicit minimal users(role/plan) plus repository
Projects and admission task, then this sequential task. They check confirmation/replay/
conflicts, admin defense, immutable history, quota/deleted tombstones, atomic rollback and
account cascade, without production access. SQLite transaction/trigger evidence is NOT
D1 runtime/concurrency proof. Backend API/authorization, HTTP create activation, reliable
new-account cutover and production schema/release remain separate steps.

Local validation: Node 22.12.0, SQLite 3.47.0; 6 confirmation tests and 7 existing
trial-project-admission tests PASS. Run directly with node --experimental-sqlite
tests/trial-history-confirmation.test.mjs and tests/trial-project-admission.test.mjs
(the latter reuses existing TypeScript via NODE_PATH, no install). The node --test
wrapper could not spawn children in the Windows sandbox (EPERM); direct node:test
execution completed both suites with zero failures. No broad build/test run.

The canonical PRODUCT_BASELINE.md currently describes temporarily dropping/restoring a
guard per confirmation. This reviewed proposal supersedes that mechanism only by central
acceptance: a permanent conditional guard plus immutable receipt is narrower and safer.
Centre owns any canonical wording update; no change to the human history policy.
