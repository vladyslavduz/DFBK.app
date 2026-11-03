# SCHEDULER-PACKAGE-READ-01

02.11.2026. Branch codex/scheduler-package-read. Base local 7c63f7e / remote 3310d553 (draft PR #59); same base tree 6960c21f64e33949aab0f14257430accac2114b5.
Scope: pure owner-scoped detail/list reader, focused tests, extension of the existing local D1 check and this checkpoint. No write-model, schema, Worker route or configuration changes.

## Read contracts

- readOwnedPackageDraft(db, authenticatedOwnerId, packageId): read one owned package, return a safe detail DTO or fixed invalid/not_found/integrity_error/unavailable status.
- listOwnedPackageDrafts(db, authenticatedOwnerId, query): explicit limit 1..20, optional projectId and keyset cursor {createdAt,id}. Newest creation first, then descending opaque ID. Fetch limit+1 to determine nextCursor. The maximum is a technical read bound, not a subscription rule.
- Owner must come from future server authentication, not a query/body field. Both header and child queries enforce that owner and current project ownership. Foreign and nonexistent package IDs produce the same not_found response; foreign project filters yield an empty list.
- Header/receipt and children are read in one first-primary session batch, giving one local transactional snapshot for that request. Keyset pages are not a long-lived cross-request DB snapshot; newly inserted newer packages appear on refresh, not behind an existing cursor.
- Reading uses recorded creation time/policy to reconstruct a draft, not Date.now or current admission. An old due date does not prevent retrieval. Stored draft status remains draft and cannotDispatch:true; this does not mark a missed publication as sent.

## Integrity and projection

The decoder checks owner metadata before private serialized values, exact row fields/counts, complete receipt, package identity, stored canonical payload and all typed child routing fields. It rebuilds through the existing package model to validate time/DST/project/material shapes and unapproved child state. Missing/extra/corrupted children, invalid JSON, altered routing and forged approval state fail closed without returning a partial page.
This is consistency validation, not cryptographic evidence against a fully coherently modified database. Global row/read bounds apply (21 packages including lookahead, 1000 children per package); byte/CPU budgets and suitable list indexes must be assessed before a public API.
Detail includes project/package IDs, creation/common/individual time, channel/kind, caption and media {id,role,mimeType}. Summary omits captions and media. Both omit owner ID, connection/destination identifiers, raw recipient addresses, storageKey, hashes, draftIdentity, request key, execution key, grants and approval internals. No public or signed media URL is minted.
Media ID must be an opaque internal ID, not an arbitrary URL. The older draft-save prototype accepts generic snapshot text IDs; future trusted material resolution must produce real internal media IDs before HTTP creation is wired. A malformed historical URL-as-ID is rejected by the reader rather than projected into the interface.
DTOs are freshly constructed and deeply frozen. Returned summaries expose earliest/latest target times and per-target times, but this is NOT yet a month/date-range calendar query or UI, nor an external account/recipient label resolver.

## Verification

12 focused SQLite :memory: groups PASS on Node 22.12.0 and Node 24.22.1. Strict noEmit TypeScript of the read module and imports PASS. No previous application suite/build was repeated for unchanged application code.
Coverage: old due-date retrieval without sampling current clock; explicit DTO allowlists; another owner reading an existing package; transfer/delete access revocation; equal-timestamp keyset pagination with later inserts; project filtering; one read batch and unchanged total_changes; malformed JSON/receipt/child/routing; forged approval; invalid input and getters before DB access; redacted SQL failure; empty/missing records; immutable output; URL masquerading as media ID.
The existing scripts/scheduler-package-d1-check.cjs now assembles the reader as its fifth pure module and guards read-path SQL against mutations. It ran exit 0 with 14 groups PASS inside actual local workerd/D1: all previous 11 storage groups plus old-date detail/DTO/no-write, keyset list/no captions, and existing foreign draft/corruption rejection.
Runtime: Node 24.22.1, installed Miniflare 5.20260921.0-alpha, workerd 1.20260921.1. SDK ephemeral storage disposed. No Wrangler config, account credentials or production bindings were loaded. This is local-runtime evidence, not replica/distributed/provider validation.
Commands:

    node --experimental-sqlite --test tests/scheduler-package-read.test.mjs
    node scripts/scheduler-package-d1-check.cjs
    node node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --skipLibCheck worker/lib/scheduler-package-read.ts

On Node 24 the sqlite flag is unnecessary. Use a compatible Node for the installed Miniflare runtime; no dependency installation or version update is part of this slice. node --check on the integration script and git diff --check PASS.

## Exact stop point / next slice

Read/detail/list are library functions only: not registered API endpoints. No approval/edit/cancel or dispatch permission, cron/queue, OAuth/provider work, real publication, paid generation or production DB/R2/Worker/config changes occurred. The SQL draft was not applied anywhere except ephemeral local tests.
Publish as a draft PR stacked on #59, retaining #57 -> #58 -> #59 dependency order. Do not merge or deploy automatically.
Next small step: authenticated, bounded HTTP read/detail/list handlers using these DTOs behind an explicit inactive feature boundary, tested on fixtures. The service must map requireUser identity, avoid accidental body-owner trust, define plan/retention access and HTTP error mapping, and keep schema unavailable paths safe. Then add the calendar view against that real contract; no simulated sent/scheduled states in production.
