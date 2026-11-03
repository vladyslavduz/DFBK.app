# SCHEDULER-CALENDAR-01

03.11.2026. Branch codex/scheduler-calendar. Base local 73b2211 / remote 53dfd600 (draft PR #61), same base tree 385837dd3c6e2eba805ae5da48b73b4018d6146e.
Scope: first read-only calendar screen and date-window selection; no draft creation, approval or sending.

## Date-window contract

GET /api/scheduler/packages accepts paired integer epoch-millisecond from/to in addition to existing limit/project/cursor parameters. The interval is [from,to), positive duration, at most 93 days. Missing/noninteger/reversed/too-wide bounds reject before reading. Omitting both retains the existing bounded newest-created listing.
SQL selects a package if ANY owned child has its own scheduledAt in the interval, including a channel override when commonTime is outside. It then reads and validates the WHOLE package/receipt/child set through the existing single read batch. The client filters individual visible events by that same interval; out-of-month siblings are not calendar events for the month.
Malformed or missing JSON times are deliberately included as candidates for integrity validation, not silently hidden as an empty month. The local D1 check verifies that malformed JSON produces the safe data-unavailable response rather than a raw SQL error. Existing keyset cursor, owner/current-project guards, serialization/response limits, private/no-store responses and disabled flag remain in force.
This is a bounded result/page contract, not a proven large-volume date-indexed query. The SQL EXISTS/JSON time predicate can scan owned draft history; evaluate normalized per-target time indexing and representative workloads before activation.

## Existing app UI

- /app/planner is inside AppAccessGate, with a Planer sidebar link and topbar link accessible on mobile. Existing bottom navigation destinations are preserved. A calendar icon extends the existing SVG icon system.
- German monthly view starts Monday, plus an agenda. Previous/next/current month, project/channel/day filters, paginated load-more, draft detail and protected project photo/caption are available. Empty, loading, unavailable/disabled, error/retry and partial-page states are explicit.
- Europe/Berlin is shown. Month boundaries use the actual Berlin offset at each boundary, not browser timezone or a fixed 24-hour-per-day assumption. Helpers are technically scoped to years 2000..2099 and handle leap months/year changes.
- Counts are computed once per loaded event/day; the formatter is cached. Calendar data and content are not stored in localStorage. Fetch credentials remain same-origin.
- Snapshots are keyed to authenticated owner/month/project; request abort and key checks prevent late responses overwriting another selection. Detail requests are similarly isolated. Changing the channel is a local filter over the selected month's loaded packages.
- If nextCursor exists, the interface explicitly says more records remain. It does not claim the month is complete before the remaining pages load. Each package/target appears once after merging pages.
- Entries remain Entwurf. A permanent notice says automatic publishing is not activated; a disabled API shows a clear notice and no simulated grid/events. No Schedule, Publish or fake-success action is added.
- The planner service validates the read response shape and fixed error object, limits the received JSON and uses the existing protected media route for opaque media IDs. It does not create signed/public media links or substitute public promotional assets.
- The established palette/type stack is reused. The final heading is Dein Planer so it remains readable at 320px; no new font or calendar dependency was installed.

## Completed validation

Tests completed before the interruption and preserved on continuation; successful checks were not repeated without source changes:
- Frontend TypeScript PASS on the final UI.
- Narrow backend route/import TypeScript PASS with the explicit existing test ambient helper; not a full historical Worker typecheck claim.
- Production Vite build PASS, 109 modules. Final assets: index-ur4KoBvv.js / index-F0-TCJRh.css.
- 29 focused groups PASS on Node 22.12.0 and Node 24.22.1: calendar helper (3), reader (15), HTTP API (11). Added cases cover real Berlin month/DST boundaries, leap/month navigation, lower-inclusive/upper-exclusive per-target time selection, common-time-outside override, rejected windows and malformed child JSON handling.
- Extended installed Miniflare/workerd script PASS, 19 groups, exit 0: previous 18 plus actual calendar HTTP range/override/end-bound/malformed-JSON behavior. Ephemeral local DB only, disposed. No Wrangler app config or production credentials loaded.
- Built-preview planner-calendar-smoke.cjs PASS: month boundary request values, cross-month channel override, pagination, project/channel/day filters, protected image/detail, 390/320px overflow, late-month-response isolation, disabled/retry, guest gating and zero mutation/generation/schedule requests. Fixture users/projects/content only.
- Initial smoke could not select an ambiguously labelled filter; explicit matching aria-labels were added and the completed run passed. The final mobile title was shortened after visual inspection, rebuilt and the same smoke passed again.
- artifacts/planner/mobile-320.png inspected (ignored local synthetic artifact, not production evidence). node --check on the smoke and git diff --check PASS.

## Exact stop point

Read-only calendar/date filtering is prepared in this branch. It does not create/confirm/edit/cancel schedules or execute any provider. Production remains unchanged: no merge/deployment, D1 schema application, R2/Worker configuration, OAuth/secrets/billing, paid generation or Social activation occurred. SCHEDULER_READ_ENABLED remains absent from configuration and therefore OFF.
Save as a draft PR stacked on #61; keep #57 -> #58 -> #59 -> #60 -> #61 dependency order. The phone-accessible checkpoint is this file and the PR, not an unsaved local-only result.
Next small implementation: authenticated draft creation FROM AN OWNED PROJECT, resolving real media/material and destination references server-side rather than accepting storage keys/owner IDs from the browser. Pin explicit per-target text/time and keep confirmation/dispatch separate. No fake connection IDs for unsupported channels. Production schema/activation still requires the owner's separate approval.
