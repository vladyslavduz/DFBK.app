-- INACTIVE, sequential task AFTER 2026-11-04-trial-project-admission.sql.
-- No production application authorized. Neither task has been applied to production.
-- Apply once in an operator-controlled atomic migration, never on API requests/startup.
-- No backfill, count(projects), inferred zero, plan change or project deletion.
CREATE TABLE trial_project_history_confirmations (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmation_id TEXT NOT NULL UNIQUE CHECK(length(confirmation_id) BETWEEN 16 AND 128
    AND confirmation_id NOT GLOB '*[^A-Za-z0-9_-]*'),
  baseline_consumed INTEGER NOT NULL CHECK(typeof(baseline_consumed)='integer'
    AND baseline_consumed BETWEEN 0 AND 9007199254740991),
  -- Historical authenticated actor identity; no FK that blocks admin account deletion.
  admin_user_id TEXT NOT NULL CHECK(length(trim(admin_user_id))>0),
  evidence_reference TEXT NOT NULL CHECK(length(trim(evidence_reference)) BETWEEN 1 AND 1024),
  confirmed_at_ms INTEGER NOT NULL CHECK(typeof(confirmed_at_ms)='integer'
    AND confirmed_at_ms BETWEEN -8640000000000000 AND 8640000000000000)
);

CREATE TRIGGER trial_history_confirmation_guard BEFORE INSERT ON trial_project_history_confirmations BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM trial_project_history_confirmations c
    WHERE (c.user_id=NEW.user_id OR c.confirmation_id=NEW.confirmation_id)
      AND (c.user_id IS NOT NEW.user_id OR c.confirmation_id IS NOT NEW.confirmation_id
        OR c.baseline_consumed IS NOT NEW.baseline_consumed OR c.admin_user_id IS NOT NEW.admin_user_id
        OR c.evidence_reference IS NOT NEW.evidence_reference OR c.confirmed_at_ms IS NOT NEW.confirmed_at_ms))
    THEN RAISE(ABORT,'TRIAL_HISTORY_CONFIRMATION_CONFLICT') END;
  -- Exact replay is observation only, including INSERT OR REPLACE: never replace audit.
  SELECT CASE WHEN EXISTS(SELECT 1 FROM trial_project_history_confirmations c WHERE c.user_id=NEW.user_id)
    AND NOT EXISTS(SELECT 1 FROM trial_project_admission_scopes s WHERE s.user_id=NEW.user_id
      AND s.history_status='verified' AND s.baseline_consumed=NEW.baseline_consumed)
    THEN RAISE(ABORT,'TRIAL_HISTORY_CONFIRMATION_INCONSISTENT') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM trial_project_history_confirmations c WHERE c.user_id=NEW.user_id)
    THEN RAISE(IGNORE) END;
  -- Defense in depth, NOT session authentication. Backend must derive this ID from requireAdmin.
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.admin_user_id AND role='admin')
    THEN RAISE(ABORT,'TRIAL_HISTORY_TRUSTED_ADMIN_REQUIRED') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM trial_project_admission_scopes s WHERE s.user_id=NEW.user_id
    AND (s.history_status IS NOT 'unknown' OR s.baseline_consumed IS NOT NULL))
    OR EXISTS(SELECT 1 FROM trial_project_admissions a WHERE a.user_id=NEW.user_id)
    THEN RAISE(ABORT,'TRIAL_HISTORY_CONFIRMATION_CONFLICT') END;
END;

-- Replace the old blanket guard ONCE in this schema task; no DROP on confirmation requests.
DROP TRIGGER trial_project_scope_no_update;
CREATE TRIGGER trial_project_scope_no_update BEFORE UPDATE ON trial_project_admission_scopes
WHEN NOT (OLD.user_id IS NEW.user_id AND OLD.history_status IS 'unknown' AND OLD.baseline_consumed IS NULL
  AND NEW.history_status IS 'verified' AND typeof(NEW.baseline_consumed)='integer'
  AND NEW.baseline_consumed BETWEEN 0 AND 9007199254740991
  AND EXISTS(SELECT 1 FROM trial_project_history_confirmations c
    WHERE c.user_id=OLD.user_id AND c.baseline_consumed IS NEW.baseline_consumed))
BEGIN
  SELECT RAISE(ABORT,'TRIAL_PROJECT_MIGRATION_POLICY_REQUIRED');
END;
-- REPLACE/upsert must not turn a verified row into an unknown row or a smaller baseline.
-- New verified inserts remain the existing trusted-seeding contract; not registration authorization.
CREATE TRIGGER trial_project_scope_no_replace BEFORE INSERT ON trial_project_admission_scopes
WHEN EXISTS(SELECT 1 FROM trial_project_admission_scopes s WHERE s.user_id=NEW.user_id) BEGIN
  SELECT RAISE(ABORT,'TRIAL_PROJECT_MIGRATION_POLICY_REQUIRED');
END;

CREATE TRIGGER trial_history_confirmation_apply AFTER INSERT ON trial_project_history_confirmations BEGIN
  INSERT INTO trial_project_admission_scopes(user_id,history_status,baseline_consumed)
    SELECT NEW.user_id,'unknown',NULL WHERE NOT EXISTS(
      SELECT 1 FROM trial_project_admission_scopes s WHERE s.user_id=NEW.user_id);
  UPDATE trial_project_admission_scopes SET history_status='verified',baseline_consumed=NEW.baseline_consumed
    WHERE user_id=NEW.user_id AND history_status='unknown' AND baseline_consumed IS NULL;
  -- Unconditional assertion. Any failure rolls receipt/scope back as one SQLite statement.
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM trial_project_admission_scopes s WHERE s.user_id=NEW.user_id
    AND s.history_status='verified' AND s.baseline_consumed IS NEW.baseline_consumed)
    THEN RAISE(ABORT,'TRIAL_HISTORY_CONFIRMATION_INCOMPLETE') END;
END;
CREATE TRIGGER trial_history_confirmation_no_update BEFORE UPDATE ON trial_project_history_confirmations BEGIN
  SELECT RAISE(ABORT,'TRIAL_PROJECT_HISTORY_IMMUTABLE');
END;
CREATE TRIGGER trial_history_confirmation_no_delete BEFORE DELETE ON trial_project_history_confirmations
WHEN EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) BEGIN
  SELECT RAISE(ABORT,'TRIAL_PROJECT_HISTORY_IMMUTABLE');
END;
-- Target user deletion may cascade exactly as existing admission/completion history.
-- No production activation, registration cutover, send ledger or downgrade policy here.
