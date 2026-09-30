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

The frontend reads and validates `features` together with the plan on each authenticated load or status refresh. Business is shown only for a complete, active Business response from this endpoint. If the request fails or the response is invalid, the frontend returns to a visible Trial fallback and shows an error; a previous Business result is never retained. No plan is stored in localStorage or selected through a build flag.

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
