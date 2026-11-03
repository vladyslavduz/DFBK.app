# SCHEDULER-PACKAGE-LOCAL-01

02.11.2026. Branch codex/scheduler-package-local, base audit commit 0cc51d3, production source base b57a8d5.
Scope: pure local draft package model, no HTTP/storage/approval/dispatch wiring.

## Reuse and behavior

- scheduler-contract.ts, scheduler-state.ts and scheduler-contract.test.mjs are transferred byte-for-byte from the existing scheduler-adapter-local-01 checkout. Their existing prototype was not edited. No second application or repository is created.
- createPublicationPackage accepts an explicit supplied owner/project/package ID, common Berlin time, per-target optional time, typed destination kind, exact material snapshots, caller-supplied child IDs, clock and explicit parsing/horizon policy. These are trusted-service projections, not authentication proof or raw public API input.
- No working product limits are introduced: tests use fictional policy. maxTargets has an additional 1000-element technical parsing ceiling; it does not define an entitlement.
- Eight requested channel directions are represented; Google Business is excluded. Three WhatsApp modes, multiple sites, boards/accounts and per-recipient email targets are distinct draft destinations, not verified connectors.
- Children retain separate captions, file identity/hash/profile and execution identities; project consistency, duplicate child IDs and identical connection/destination/kind tuples are validated before returning any result.
- Data-property records only, exact known keys, dense bounded arrays; reject getters/extra fields, malformed times, past/out-of-horizon times and incompatible destination kinds. No implicit time zone or autumn offset guessing.
- Output and nested data are copied and frozen. draftIdentity covers normalized owner/project/materials/destination kind/time/policy; checkbox order does not change it. It is a comparison string, NOT a signature or approval token. It includes private material data and must not be logged or returned publicly without an appropriate DTO.
- Package status is draft, cannotDispatch is always true; child approvals are null. The existing kernel cannot claim an unapproved child. No IDs, wall clocks, random values, network, timers, DB statements or credentials are created/read by the module.

## Validation

Initial targeted run: 33 PASS / 0 FAIL (22 transferred kernel tests + 11 new package groups). Strict noEmit TypeScript check of the three modules PASS. No full frontend build or production/provider test is relevant to this unwired pure module.
Tests cover common time/overrides, ten independent projects, all requested destination kinds, duplicate rejection, wrong project, Google exclusion, policy/shape validation, Berlin spring gap/fall offsets, immutable copies, comparison identity changes and rejected unapproved claim.
Final focused check strengthens the no-side-effects assertion to trap Date.now, Math.random and global crypto random ID calls as well as network and timers; 11 PASS / 0 FAIL on Node 22.12.0 and on bundled Node 24.22.1. Transferred kernel/state/test files match their prototype bytes exactly.

## Exact stop point and next slice

Local source only, not imported by Worker routes or frontend; no approval API, schedule endpoint, calendar, persistence, migration, runner or real connection is enabled. Existing Social freeze/production flags are unchanged. Fake recipients contain no real addresses or phone numbers.
This is not runtime proof of the older D1 adapter. The old snapshot/DB contract does not yet carry the new package link or destination kind; NEVER approve/dispatch a child by dropping that package context. Next slice must preserve the package/version/target-kind binding and immutable approval identity in the trusted service/storage mapping.
Next task: design and test atomic local storage of package + all child drafts, verify ownership from server data, uniqueness/alias resolution of actual external destinations and replay identity; inject write failures to prove rollback. Global child-ID freshness, resolving multiple connections that alias one external account, actual media ownership/format, entitlements, capability verification, package approval/edit/revoke and external execution remain unimplemented.
Do not modify the old adapter checkout or apply its draft DDL to production. Reconcile the package additions with its independent QA and local D1 evidence first. Production D1/R2/Worker, secrets/OAuth, paid calls, publishing, push/PR, merge and deployment were not performed by this slice.
