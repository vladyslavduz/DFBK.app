# SCHEDULER-PROJECT-DRAFT-01

03.11.2026. Branch codex/scheduler-project-draft. Base: draft PR #62, remote 5127ce722f13a75e2b5cdb75324c03e0b995ebe0 / local 5220969d; same tree 5ed2539828da741b06b598e3a6ca64ef85ec593e.
Scope: trusted-service preparation from an owned ready project. This is not yet a public create endpoint or a working scheduling button.

## Implemented contract

prepareProjectPackageDraft receives authenticated owner context, a stable request key, a bounded JSON selection, explicit server policy and server clock. The caller must authenticate; the module does not infer identity from JSON. No HTTP route imports it yet.
JSON allowlist: projectId, mediaId, commonTime, targets. Each target: channel, connectionId, caption, optional timeOverride. Confirmed Europe/Berlin times use the existing DST validator and explicit horizon. Unknown owner/storage/destination/snapshot/approval fields reject before DB or R2 reads.
Technical parsing ceilings: 24 KiB UTF-8 request, 10,000 UTF-16 code units per caption, maxTargets 1..1000, media ceiling 10 MiB. Policy maxTargets/horizonMs/maxMediaBytes is REQUIRED, not a product/subscription default. Caption bounds are not a platform-specific content guarantee.

The service reads the actual projects/project_media/social_connections schema through an injected first-primary D1 session:
- Owned project and selected image must match, project status must be ready.
- Only original/optimized image roles and JPEG/PNG/WebP draft metadata are accepted, with bounded positive bytes.
- Each selected connection must belong to the same owner, match the channel and have connected status. External destination is resolved from DB. Tokens, recipients, credentials and connection names are not selected.
- Current real connector scope is Instagram/Facebook account targets. Other catalogue channels explicitly return DRAFT_CHANNEL_UNAVAILABLE; they are still future product scope, not fabricated connections.
- R2 is read only by the storage key resolved from the owned media row. Missing objects, size mismatches, short/overflow streams fail. Bytes are streamed into a bounded buffer and SHA-256 is calculated from actual content.
- Stable package/child IDs derive from owner/request key and target selectors. Reordered checkboxes preserve comparison identity; edited caption/time/media changes content identity, allowing the existing store to return conflict rather than silently overwrite.

Output is the existing immutable draft model: separate per-channel caption/time, null approvals, cannotDispatch=true. It includes PRIVATE storage metadata for server use and MUST NOT be serialized to an HTTP response. Use the existing read DTO allowlist after persistence.
No DB/R2 writes or provider network calls occur during preparation. Tests exercise explicit projection into the existing atomic store and safe reader, including read-only replay and changed-content conflict.

## Limits and remaining work

Connected status is an observed DB state, not proof of current token validity, scopes, entitlement or provider permission. No token is decrypted or validated here.
Hashing is NOT immutable pinning: R2/project/connection may change after observation. Recheck authority/material at confirmation and dispatch; prepare a pinned immutable media version before approval. No approved job can be produced by this module.
Image metadata/bytes are observed, not decoded/transcoded or certified for Meta. WebP may form a draft but needs channel-compatible preparation before approval. connectorVersion=draft-unverified-v1 and mediaProfile=project-image-unverified are deliberately non-executable placeholders, not registered verified capabilities.
Draft result and IDs are deterministic only for unchanged observed material/request/policy. Existing save admission still requires a future time; after-due recovery must use the reader, not rebuild an expired request. End-to-end HTTP idempotency, bounded same-origin request handling, session authentication, policy wiring and receipt recovery are still pending.
No calendar creation form, approval/promotion, cron/queue runner, provider connectors for other channels or autonomous sending was added.

## Checks completed

- Node 22.12.0: 50 focused groups PASS: new preparation 12 + existing package 11/store 12/reader 15.
- Node 24.22.1: new preparation 12 groups PASS.
- Narrow strict TypeScript PASS for scheduler-project-draft.ts and imported pure/store contracts. Not a full historical Worker typecheck.
- scripts/scheduler-project-draft-check.cjs: 9 scenarios PASS in installed workerd with real ephemeral D1 and R2 bindings, disposed after run. Checks owned material/hash, reordered selectors, foreign owner/connection, forged storage field, changed R2 bytes, size mismatch, absent object and no package/job writes.
- Local SQL tests use real SQLite with actual media/social/draft DDL and synthetic parent tables; R2 stream unit cases include short/overflow and multiple chunks.
- No full frontend build needed: no frontend/runtime route/config/dependency changed.
- git diff --check PASS.

## Exact stop and next action

Service preparation is ready for review, without HTTP/UI wiring or production activation. Next small step: authenticated, same-origin, feature-disabled-by-default draft-create endpoint integrating this resolver with atomic persistence and safe response DTOs; explicitly configured policy and replay/conflict handling first, then the project form.
Dependency chain remains #57 -> #58 -> #59 -> #60 -> #61 -> #62 -> this draft.
No merge/deploy, production D1/R2/Worker configuration, SQL application, secrets/OAuth/billing, external posts or Social activation. Main stays b57a8d594cf2f185fb9549e818f974ccf7a209c1 at the read-only verification in this step. Social remains frozen.
