# Backend Task — Entitlements v1

## Goal

Add per-user access for exactly two plan codes without changing the existing auth system:

- `trial` — frontend label `Testzugang`;
- `business` — frontend label `Business`.

No Stripe, checkout, webhook, payment migration, or new authentication system is part of this task.

## Existing constraints

- Reuse the existing `dfbk_session` cookie and session ownership checks.
- Keep `users`, `auth_tokens`, and `sessions` unchanged.
- Worker: `dfbk-app`.
- D1: `dfbk-db`, binding `DB`.
- Do not expose secrets or storage details to the frontend.

## API contract

### `GET /api/account/entitlements`

Authenticated user only.

```json
{
  "ok": true,
  "plan": "trial",
  "displayName": "Testzugang",
  "status": "active",
  "voice": {
    "enabled": true,
    "maxWords": 10
  },
  "expiresAt": null
}
```

For Business, return `plan: "business"`, `displayName: "Business"`, and `voice.maxWords: null` unless a later commercial rule defines a limit.

### Admin grant/revoke

Protect these routes with the existing session plus a small server-side admin allowlist (`ADMIN_USER_IDS` or `ADMIN_EMAILS` in Cloudflare configuration):

- `GET /api/admin/entitlements?email=...`;
- `POST /api/admin/entitlements` with `{ "email": "...", "plan": "business", "expiresAt": "..." }`;
- `DELETE /api/admin/entitlements/:userId` to revoke a manual grant.

The admin surface can be added later; the API is the important security boundary.

## Storage

Prefer a separate table so auth and project tables remain stable:

```sql
CREATE TABLE user_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('trial', 'business')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'expired')),
  voice_enabled INTEGER NOT NULL DEFAULT 0,
  voice_max_words INTEGER,
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  granted_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Default behavior when no row exists: return `trial` / `Testzugang`.

## Important limitation

The current microphone uses browser speech recognition and sends ordinary project text to the existing Projects API. The 10-word Trial cap is therefore a frontend UX limit, not a security boundary. Strict server-side enforcement requires a later voice-input contract (for example an explicit `inputMode: "voice"` field or a transcription endpoint). Do not silently pretend the current browser-only cap is tamper-proof.
