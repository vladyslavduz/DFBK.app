-- DFBK.app Projects v1 migration
-- Minimal MVP table for authenticated user projects.

CREATE TABLE projects (
  id TEXT PRIMARY KEY,

  user_id TEXT NOT NULL,

  title TEXT NOT NULL,

  description TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'processing',
        'ready',
        'finished',
        'failed'
      )
    ),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_projects_user_created_at
ON projects(user_id, created_at DESC);
