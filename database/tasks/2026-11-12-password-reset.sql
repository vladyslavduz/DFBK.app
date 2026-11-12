-- Apply to D1 before releasing password recovery.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  requested_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0 CHECK (consumed IN (0, 1))
);
