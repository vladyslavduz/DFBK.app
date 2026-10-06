-- SQL TASK: apply explicitly after review and production backup.
-- NOT an automatically applied migration. Do not deploy dependent backend first.
-- Preflight: PRAGMA table_info(projects); check columns do not already exist.
ALTER TABLE projects ADD COLUMN title_source TEXT NOT NULL DEFAULT 'system'
  CHECK (title_source IN ('system', 'auto', 'manual'));
ALTER TABLE projects ADD COLUMN photo_optimization_state TEXT NOT NULL DEFAULT 'available'
  CHECK (photo_optimization_state IN ('available', 'processing', 'completed'));
ALTER TABLE projects ADD COLUMN photo_optimization_token TEXT;
ALTER TABLE projects ADD COLUMN photo_optimization_started_at TEXT;

-- Existing title provenance is unknown. Preserve all meaningful existing names.
UPDATE projects SET title_source = 'manual'
WHERE lower(trim(title)) NOT IN ('neues projekt', 'mein neues projekt') AND trim(title) <> '';

-- Existing optimized media has already consumed the successful optimization.
UPDATE projects SET photo_optimization_state = 'completed'
WHERE EXISTS (SELECT 1 FROM project_media pm
  WHERE pm.project_id = projects.id AND pm.media_type = 'image' AND pm.role = 'optimized');
