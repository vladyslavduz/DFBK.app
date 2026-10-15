-- Additive migration for Microsoft sign-in. Review and apply separately before enabling OAuth.
-- The key is the validated tenant ID and pairwise subject from a signed Microsoft ID token.
ALTER TABLE users ADD COLUMN microsoft_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_microsoft_sub
ON users(microsoft_sub) WHERE microsoft_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS microsoft_oauth_states (
  state_hash TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('login','link')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_microsoft_oauth_expires
ON microsoft_oauth_states(expires_at);
