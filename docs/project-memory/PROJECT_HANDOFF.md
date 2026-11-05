# DFBK.app — Codex project handoff
Prepared 2026-10-21 from available Plan & Gemacht history and repository configuration. This is a structured summary, **not** a complete verbatim export of all project chats. Verify all historical claims against code and current runtime.

## Product
DFBK.app — "Dein Foto bringt Kunden." / "Du machst die Arbeit. DFBK macht sie sichtbar." German-first marketing SaaS: upload work photo, optional description, photo optimization, generated Google Business / social media / website text. Commercial MVP first; KI-Visualisierung is future backlog. Trial historically limited to 5 projects; Business/DFBK Pro naming to be checked in code. Stripe/billing unfinished.

## Architecture
GitHub: https://github.com/vladyslavduz/DFBK.app ; Cloudflare Worker dfbk-app, frontend static SPA, /api/* routes; D1 dfbk-db binding DB; private R2 dfbk-media binding MEDIA. Production https://dfbk.app . Cloudflare wrangler.jsonc inspected 2026-10-21: SOCIAL_ENABLED="false"; observability.logs.invocation_logs=true. Effective deployed runtime config not independently verified.

## Backend and data
- Email/password, Google OAuth, sessions cookie dfbk_session, /api/auth/me and logout. PBKDF2 iterations historically reduced to 100000 after Worker 1101/500 failure.
- users, auth_tokens, sessions; projects with ownership enforcement and statuses; project_media private R2 JPEG/PNG/WebP historically <=10MB; generated_contents types google_business, social_media, website_reference.
- Photo optimization stores original and optimized image, concurrency guards. Description optional, image required.
- Admin/trial controls and admin_audit_log; project management and entitlement migrations historically completed.
- Microsoft OAuth code+PKCE, token validation and safe account linking. SQL users.microsoft_sub and microsoft_oauth_states migration reported completed 2026-10-15. Backend PR #43 and frontend Auth Modal PR #44 merged.
- PR #48 diagnosed personal Microsoft account Graph id versus oid mismatch; PR #49 merged fix 2026-10-16. Production E2E not verified.
- Social Publishing tables social_connections, social_oauth_states, publication_requests, publication_jobs. Meta OAuth callback unresolved; Social Publishing FROZEN, never activate without separate approval.
- Registration verification email blocker previously reported: Resend 403 not authorized for dfbk.app, POST /api/auth/register 502 VERIFICATION_EMAIL_FAILED. Reverify current status.

## Frontend
Marketing site, /app shell, dashboard, projects, media upload/preview, content, profile/logout, mobile navigation. Cleanup A PR #36 and B #37 merged; Trial 5, Business naming, Share, copy and inactive actions corrected. Desktop spacing/Hero/scroll reveal PR #39–42 merged; compact pricing reverted via #41. iPhone/Safari production visual acceptance pending.

## Tests
Testing Request workstream: auth, API abuse, ownership, media validation, AI-cost controls and regression. PR #38 local SQLite Node 22.12 adapter fix merged 2026-10-14. Never claim tests PASS without logs and exact commands. Microsoft PR #49 focused regression not verified.

## Project workstreams
Plan & Gemacht = master sequence and current checkpoint; Backend DFBK.app 2 = Worker/Auth/release; Frontend DFBK.app = UI; SQL DB DFBK.app = migrations; Registrieren API + Andere = OAuth configuration; Testing Request = regression/security; ERROR_!!! = incidents.

## History
Sep: auth, projects, private R2, generation MVP. Oct 1–7: photo optimization, admin/trial, social schema. Oct 10: frontend cleanup merged. Oct 13: local GitHub Desktop/Git environment D:\DFBK_app\GitHubClone. Oct 14: frontend desktop changes and SQLite test adapter merged. Oct 15: Microsoft migration, backend/frontend merged, secrets configured. Oct 16: diagnostics PR #48 and fix PR #49 merged. Oct 17–21: latest available Plan & Gemacht says no newer confirmed code change; production acceptance pending.

## Sequence (do not skip)
1. Run focused PR #49 Microsoft regression and record PASS/FAIL.
2. Resolve repository/runtime OAuth invocation logging mismatch.
3. Preflight exact main commit, bindings, secrets, D1 migration, SOCIAL_ENABLED=false and diff.
4. Controlled deployment only after explicit approval.
5. Microsoft real E2E, then Google regression and account chooser UX.
6. Registration email delivery, password recovery, auth security, mobile Safari.
7. Commercial MVP, billing/cost controls.
8. Social Publishing only when separately unfrozen.

PR merged != deployed; deployed != E2E verified. Never write credentials, private images or production data into this documentation.
