-- DFBK.app Google OAuth migration
-- Apply this once to the production D1 database before enabling Google login.

ALTER TABLE users
ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
ON users(google_sub)
WHERE google_sub IS NOT NULL;
