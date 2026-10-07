-- Explicit SQL TASK. Review schema, back up D1, apply and verify BEFORE enabling.
-- Never run this task automatically on Worker startup.
CREATE TABLE social_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('instagram','facebook','linkedin','x')),
  external_account_id TEXT NOT NULL,
  external_account_name TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TEXT,
  scopes TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN ('pending','connected','reconnect_required','disconnected')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,provider,external_account_id)
);
CREATE UNIQUE INDEX idx_social_one_active ON social_connections(user_id,provider) WHERE status='connected';
CREATE INDEX idx_social_owner ON social_connections(user_id,provider);
CREATE TABLE social_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('instagram','facebook')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE publication_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX idx_publication_request_owner_created ON publication_requests(user_id,created_at);
CREATE TABLE publication_jobs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES publication_requests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('instagram','facebook','linkedin','x')),
  connection_id TEXT REFERENCES social_connections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','published','failed')),
  caption TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_source TEXT NOT NULL CHECK(media_source IN ('original','optimized')),
  external_container_id TEXT,
  external_publish_started_at TEXT,
  external_post_id TEXT,
  external_post_url TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id,provider)
);
CREATE INDEX idx_publication_owner_project ON publication_jobs(user_id,project_id,created_at);
