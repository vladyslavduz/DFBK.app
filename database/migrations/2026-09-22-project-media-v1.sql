-- DFBK.app Project Media v1 migration
-- Minimal metadata for image files stored privately in Cloudflare R2.

CREATE TABLE project_media (
  id TEXT PRIMARY KEY,

  project_id TEXT NOT NULL,

  storage_key TEXT NOT NULL UNIQUE,

  media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image')),

  role TEXT NOT NULL
    CHECK (role IN ('original', 'optimized', 'thumbnail')),

  mime_type TEXT NOT NULL,

  size_bytes INTEGER NOT NULL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_project_media_project_role
ON project_media(project_id, role);
