# DFBK.app — Entitlements Frontend v1

## Plan codes

- `trial` — display name `Testzugang`
- `business` — display name `Business`

The frontend reads the authenticated user's plan from:

```text
GET /api/account/entitlements
```

The endpoint reuses the existing `dfbk_session`. If no `user_entitlements` row exists for the current user, the backend returns Trial.

## Response contract

Trial:

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
  "features": {
    "contentGeneration": true,
    "share": false,
    "businessIntegrations": false
  },
  "expiresAt": null
}
```

Business:

```json
{
  "ok": true,
  "plan": "business",
  "displayName": "Business",
  "status": "active",
  "voice": {
    "enabled": true,
    "maxWords": null
  },
  "features": {
    "contentGeneration": true,
    "share": true,
    "businessIntegrations": true
  },
  "expiresAt": null
}
```

The existing frontend normalization may ignore `features` until the related UI uses them. The plan fields remain backward-compatible with the prepared frontend contract.

## Manual Business activation

There is no Stripe or admin UI in v1. The server-only admin route is:

```text
POST /api/admin/users/:userId/plan
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json
```

Business grant body:

```json
{ "plan": "business" }
```

Trial/revoke body:

```json
{ "plan": "trial" }
```

`trial` deletes the entitlement row so the normal default-Trial behavior applies again. `ADMIN_API_KEY` is a Cloudflare Secret and must never be exposed to frontend code.

## Important limitation

The current microphone uses browser speech recognition and sends ordinary project text to the existing Projects API. The 10-word Trial cap is therefore still a frontend UX rule, not a tamper-proof server-side voice limit. Strict enforcement would require a later explicit voice-input backend contract.
