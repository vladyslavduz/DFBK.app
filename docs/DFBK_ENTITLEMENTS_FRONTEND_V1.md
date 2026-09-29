# DFBK.app — Entitlements Frontend v1

## Plan codes

- `trial` — display name `Testzugang`
- `business` — display name `Business`

The frontend is prepared for:

```text
GET /api/account/entitlements
```

Expected response:

```json
{
  "ok": true,
  "plan": "trial",
  "displayName": "Testzugang",
  "status": "active",
  "voice": {
    "enabled": true,
    "maxWords": 15
  },
  "expiresAt": null
}
```

Until this endpoint exists, the frontend uses an honest `trial` fallback. The preview build flag `VITE_FEATURE_VOICE=1` only enables the 15-word Trial voice test; it does not grant Business access.

## Backend requirement

Real per-user Business activation requires a Worker/D1 entitlement implementation. It must reuse the existing `dfbk_session` auth and should not modify `users`, `sessions`, or auth token handling. A separate entitlement table is preferable to a second auth system.

Minimum backend contract:

- `GET /api/account/entitlements` — authenticated user's current plan and feature limits;
- admin-only grant/revoke operation for `trial` and `business`;
- server-side validation of plan status and optional expiry;
- no Stripe or automatic checkout in this MVP stage.
