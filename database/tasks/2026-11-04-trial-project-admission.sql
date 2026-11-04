-- INACTIVE FOUNDATION. Never auto-apply. Production create still uses legacy cap 5.
-- No default/backfill scope: unknown deleted-project history requires owner-approved
-- migration policy. Do not seed zero for existing users or delete projects above 3.
-- Future create MUST batch admission + project INSERT atomically with stable retry key.
CREATE TABLE trial_project_admission_scopes (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  history_status TEXT NOT NULL CHECK(history_status IN ('verified','unknown')),
  baseline_consumed INTEGER,
  CHECK((history_status='unknown' AND baseline_consumed IS NULL) OR
    (history_status='verified' AND typeof(baseline_consumed)='integer' AND baseline_consumed BETWEEN 0 AND 9007199254740991))
);
CREATE TABLE trial_project_admissions (
  user_id TEXT NOT NULL REFERENCES trial_project_admission_scopes(user_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128 AND idempotency_key NOT GLOB '*[^A-Za-z0-9_-]*'),
  -- Deliberately NO projects FK: this is the durable deletion-resistant tombstone.
  project_id TEXT NOT NULL UNIQUE CHECK(length(trim(project_id))>0),
  request_identity TEXT NOT NULL CHECK(length(trim(request_identity))>0),
  created_at_ms INTEGER NOT NULL CHECK(typeof(created_at_ms)='integer' AND created_at_ms BETWEEN -8640000000000000 AND 8640000000000000),
  PRIMARY KEY(user_id,idempotency_key)
);
CREATE TRIGGER trial_project_admission_guard BEFORE INSERT ON trial_project_admissions BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM trial_project_admissions a
    WHERE a.user_id=NEW.user_id AND a.idempotency_key=NEW.idempotency_key
      AND (a.project_id IS NOT NEW.project_id OR a.request_identity IS NOT NEW.request_identity))
    THEN RAISE(ABORT,'TRIAL_PROJECT_IDENTITY_CONFLICT') END;
  -- Exact replay bypasses capacity/new-project checks, never inserts a second row.
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM trial_project_admissions a
    WHERE a.user_id=NEW.user_id AND a.idempotency_key=NEW.idempotency_key)
    AND NOT EXISTS(SELECT 1 FROM trial_project_admission_scopes s
      WHERE s.user_id=NEW.user_id AND s.history_status='verified')
    THEN RAISE(ABORT,'TRIAL_PROJECT_HISTORY_REQUIRED') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM trial_project_admissions a
    WHERE a.user_id=NEW.user_id AND a.idempotency_key=NEW.idempotency_key)
    AND EXISTS(SELECT 1 FROM trial_project_admission_scopes s WHERE s.user_id=NEW.user_id
      AND (s.baseline_consumed>=3 OR (SELECT COUNT(*) FROM trial_project_admissions a WHERE a.user_id=NEW.user_id)>=3-s.baseline_consumed))
    THEN RAISE(ABORT,'TRIAL_LIFETIME_PROJECT_LIMIT') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM trial_project_admissions a
    WHERE a.user_id=NEW.user_id AND a.idempotency_key=NEW.idempotency_key)
    AND EXISTS(SELECT 1 FROM projects p WHERE p.id=NEW.project_id)
    THEN RAISE(ABORT,'TRIAL_PROJECT_ALREADY_EXISTS') END;
END;
CREATE TRIGGER trial_project_admission_no_update BEFORE UPDATE ON trial_project_admissions BEGIN
  SELECT RAISE(ABORT,'TRIAL_PROJECT_HISTORY_IMMUTABLE');
END;
CREATE TRIGGER trial_project_admission_no_delete BEFORE DELETE ON trial_project_admissions
WHEN EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) BEGIN
  SELECT RAISE(ABORT,'TRIAL_PROJECT_HISTORY_IMMUTABLE');
END;
CREATE TRIGGER trial_project_scope_no_update BEFORE UPDATE ON trial_project_admission_scopes BEGIN
  SELECT RAISE(ABORT,'TRIAL_PROJECT_MIGRATION_POLICY_REQUIRED');
END;
CREATE TRIGGER trial_project_scope_no_delete BEFORE DELETE ON trial_project_admission_scopes
WHEN EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) BEGIN
  SELECT RAISE(ABORT,'TRIAL_PROJECT_MIGRATION_POLICY_REQUIRED');
END;
-- Genuine users deletion can cascade; project deletion cannot reset lifetime history.
-- This is NOT an erasure workflow, send ledger, AI budget or Business/downgrade policy.
