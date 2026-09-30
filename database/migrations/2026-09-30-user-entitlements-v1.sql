-- DFBK.app User Entitlements v1
-- Missing row means default Trial access.

CREATE TABLE user_entitlements (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL
    CHECK (plan IN ('trial', 'business')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);
