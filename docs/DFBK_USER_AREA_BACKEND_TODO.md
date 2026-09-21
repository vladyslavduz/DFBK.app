# BACKEND TODO — DFBK.app User Area V1

This document is a handoff. None of the tasks below are implemented in the frontend branch.

## Priority 1 — complete the account flow

1. **Resend verification email**
   - Needed for: `E-Mail erneut senden`.
   - Proposed endpoint: `POST /api/auth/resend-verification`.
   - Input: `{ email }`.
   - Requirements: rate limiting, generic response to prevent account enumeration, invalidate/rotate old unused tokens.

2. **Verification redirect**
   - Needed for: friendly `E-Mail bestätigt` screen.
   - Current verification endpoint returns JSON.
   - Recommended behavior after a browser verification: redirect to `/verify-email?status=success`; preserve JSON behavior only where explicitly requested by an API client.

3. **Password change/reset**
   - Needed for: settings and forgot-password flow.
   - Proposed endpoints: existing `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, plus authenticated `POST /api/auth/change-password`.
   - Requirements: short-lived hashed token, rate limiting, revoke active sessions after password change when appropriate.

4. **Apple OAuth**
   - Needed for: `Mit Apple fortfahren`.
   - Add only after Apple identifiers, redirect URI and key management are approved.
   - Do not expose Apple secrets to the frontend.

5. **Account deletion**
   - Needed for: future `Konto löschen` action.
   - Proposed endpoint: `DELETE /api/account` with recent-auth confirmation.
   - Define retention/deletion behavior for D1, R2 media and generated content first.

## Priority 2 — projects and media

### Recommended D1 entities

1. `user_profiles`
   - `user_id` FK/PK → `users.id`
   - `display_name`, `business_name`, optional `trade`, `service_area`, `communication_tone`
   - `created_at`, `updated_at`

2. `projects`
   - `id`, `user_id` FK, `title`, `description`, `status`
   - statuses: `draft`, `processing`, `ready`, `finished`, `failed`
   - `created_at`, `updated_at`
   - index: `(user_id, created_at DESC)`

3. `project_media`
   - `id`, `project_id` FK, `kind` (`original`, `optimized`), `storage_key`, `mime_type`, dimensions, size
   - binary images should live in Cloudflare R2, not D1
   - index: `(project_id, kind)`

4. `generated_contents`
   - `id`, `project_id` FK, `channel` (`google`, `social`, `website`), `text`, optional `title`, `version`
   - `created_at`, `updated_at`
   - index: `(project_id, channel)`

5. Optional `generation_jobs`
   - only if generation becomes asynchronous
   - `id`, `project_id`, `status`, timestamps, sanitized error code
   - frontend must receive stage names, not fake percentages

### Proposed API contracts

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `POST /api/projects/:id/media`
- `POST /api/projects/:id/generate`
- `PATCH /api/projects/:id/contents/:channel`
- `POST /api/projects/:id/contents/:channel/regenerate`
- `GET /api/projects/:id/media/:kind/download`

Every project query must be scoped to the authenticated `user_id`; project IDs alone must never grant access.

## Priority 3 — photo and voice processing

1. **R2 upload flow**
   - Validate MIME type, extension, file signature and maximum size server-side.
   - Strip unsafe metadata where required.
   - Generate optimized WebP/AVIF derivatives and thumbnails.

2. **Voice input**
   - Proposed endpoint: `POST /api/projects/:id/transcribe` or upload audio through a short-lived R2 flow.
   - Return transcript for user confirmation before generation.
   - Define audio retention and add it to Datenschutz before activation.

3. **Content generation**
   - Use the existing server-side provider architecture and secrets.
   - Return structured channel results: `google`, `social`, `website`.
   - Store source inputs, prompt/version metadata only where actually necessary.
   - Add retry/idempotency to prevent duplicate paid generation.

4. **Image optimization**
   - Return explicit `original` and `optimized` media records.
   - Do not claim improvement when the optimized file is unavailable.

## Priority 4 — profile and plan

- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/account/providers` for Google/Apple/E-Mail status
- `GET /api/billing/plan`

Stripe checkout, prices, quotas and paid-plan promises must remain disabled until a separate commercial specification is approved.

## Priority 5 — publishing (not MVP)

The current frontend correctly offers `Text kopieren` and `Bild herunterladen`. Automatic publication should only be added after each channel integration is implemented, permissioned and tested. Do not reuse the visual channel pills as proof of a live connection.

## Security and privacy checklist

- session cookie remains `HttpOnly`, `Secure`, `SameSite=Lax`
- CSRF review for authenticated mutation endpoints
- per-user authorization on every object
- upload validation and malware/abuse limits
- rate limits for auth, resend, transcription and generation
- no API/provider secrets in React or Vite variables
- retention/deletion policy for photos, voice and generated content
- update Datenschutz before activating voice, R2 storage, image processing or additional OAuth providers
