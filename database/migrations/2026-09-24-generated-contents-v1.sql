-- DFBK.app Generated Contents v1 migration
-- Minimal MVP storage for one current generated result per project/content type.

CREATE TABLE generated_contents (
  id TEXT PRIMARY KEY,

  project_id TEXT NOT NULL,

  content_type TEXT NOT NULL
    CHECK (
      content_type IN (
        'google_business',
        'social_media',
        'website_reference'
      )
    ),

  content TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE,

  UNIQUE (project_id, content_type)
);
