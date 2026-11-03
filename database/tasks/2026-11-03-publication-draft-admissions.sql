-- Draft admission accounting; no provider execution. Apply after publication-package-drafts task.
-- Deliberately no project/package FK: deleting a project must not replenish the rolling quota.
CREATE TABLE publication_package_draft_admissions (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL,
 package_id TEXT NOT NULL UNIQUE,
 admitted_at_ms INTEGER NOT NULL,
 PRIMARY KEY(user_id,request_key)
);
CREATE INDEX idx_package_admissions_owner_time
 ON publication_package_draft_admissions(user_id,admitted_at_ms);
