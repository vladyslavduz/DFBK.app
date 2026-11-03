# SCHEDULER-PROJECT-DRAFT-FORM-01

03.11.2026. Branch codex/scheduler-project-draft-form.
Base: draft PR #64, remote 19781d8b4c6adf6257cf106a85fe64c1c821da89 / local 900a6307; identical tree f06b821502caa6234cb74be9b6b40a049261fe9c.
Scope: existing project page -> draft form -> existing draft-create API -> explicit link to calendar. No automatic publishing or production activation.

## User flow and boundaries

On /app/projects/:id/publish, an owned ready project with available material gets "Entwurf im Planer vorbereiten".
The expandable form shows the selected protected project photo, all nine existing catalogue channels, editable separate Instagram/Facebook captions, common Berlin date/time and optional per-channel time overrides.
Only currently connected available Instagram/Facebook destinations can be checked. Fresh connections load on opening/retry, independently of potentially stale global context state. The server remains authoritative. Unimplemented channels stay visible with an explicit unavailable label; no fake connections or OAuth launch.
Existing manual PublishingPanel, copying/downloading/opening channels and existing direct-publish code are separate and preserved. Google Business is shown but not admitted to scheduling, as previously agreed.
Form defaults select no channels and no date. Captions start from this project's existing KI results, not a new paid generation. The new form has its own editable text state; manual panel edits are a separate flow.

All date-time input means Europe/Berlin, not the device's timezone. Actual Intl zone offsets and the shared pure validator determine valid instants. Spring gap/invalid/past dates cannot submit; autumn fold requires an explicit first/second offset choice. Form/calendar technical year range remains 2000..2099. Horizon/plan/media authority is still checked server-side.

## Save and recovery

The new same-origin service sends only projectId/mediaId/commonTime/targets to POST /api/scheduler/packages with a random Idempotency-Key, after client validation. Redirects and cross-origin API configuration are refused. Request bound: 24 KiB UTF-8, caption field <=10,000 UTF-16 units; response validation requires the explicit draft acknowledgement and cannotDispatch=true.
A synchronous in-flight guard prevents duplicate submission. One frozen selection/key is retained per attempt:
- While sending, controls are disabled.
- Network/5xx/invalid-success response gives uncertain status; inputs remain frozen and only the exact request/key can be retried.
- A conflict cannot overwrite an existing receipt or silently mint a new key. The user can inspect the Planer.
- A definitive initial rejection (including disabled/missing-policy response) can explicitly return to editing. Once an outcome was uncertain, a later rejection does not unlock it.
- Saved/replayed status appears ONLY after valid API acknowledgement, with a project-filtered calendar link. It clearly says this is an unapproved draft and nothing was published. No fake calendar event is inserted client-side; the calendar reads the server.
- Owner/project/media keyed component reset and unmount guards keep one project's text/result out of another project.

This step intentionally retains unsaved input and unresolved attempt data in memory only, without localStorage/sessionStorage. The UI warns that leaving/reloading discards unsaved input and asks to keep the page open while outcome is unknown. A reload-safe or cross-device pending-attempt recovery mechanism is NOT implemented; inspect server drafts in the calendar before starting another attempt. Confirmed drafts are stored in D1 by #64, not just browser state.
No automatic save, provider calls, system share picker, public media URL or promotional content substitution. Browser fixture photo bytes are synthetic test responses using an existing public asset; production URLs always reference the selected private project media.

## Verification

- Frontend TypeScript PASS.
- Vite production build PASS: 114 modules; final assets index-Cl0yMp8m.js / index-D4Np9vaq.css.
- tests/planner-draft-form.test.mjs: 7 groups PASS on Node 22.12.0 and Node 24.22.1. Covers Berlin date/DST/past validation, same-origin/key/request bytes, acknowledgement/replay, network/malformed/contradictory/5xx uncertainty, disabled/policy/conflict and cross-origin/oversize refusal.
- Built-preview scripts/planner-draft-form-smoke.cjs PASS in Edge with mocked API: protected own photo/text, nine-channel catalogue, independent caption/time override, 320px overflow, pending lock, acknowledged save/calendar GET, exact key/body retry after lost response, definitive rejection/edit/new key, conflict lock, DST gap/fold/past, project reset, disconnected/processing/guest gating, no native share/provider mutation.
- Existing private-project-result-smoke.cjs PASS: own images/captions, JPEG download, read-only recovery, incomplete/processing/error states, explicit original choice, project loading races, guest/foreign denial, mobile layout and no duplicate generation requests.
- Initial new smoke encountered ambiguous labels on caption/offset controls; explicit aria-labels added. Final built smoke PASS.
- artifacts/planner-draft/mobile-320.png inspected: no horizontal overflow; synthetic data only, ignored local QA artifact. Long element capture includes fixed app navigation in the middle of the stitched image; not a second nav added by this change.
- git diff --cached --check PASS. No backend/SQL/config/dependency changes in this step, so previous backend runtime suites were not repeated without cause.

## Exact stop and next step

Form/service/time helpers/styles/tests are prepared for review. On production, neither these draft branches nor the draft schema/flags are activated. All source and this checkpoint are saved to GitHub as a stacked draft over #64; this is not a local-only deliverable.
No merge/deploy, Cloudflare login/settings, D1 task application, R2 write, secret/OAuth/billing change or Social activation.
Dependencies: #57 -> #58 -> #59 -> #60 -> #61 -> #62 -> #63 -> #64 -> this draft.
Next: prepare the immutable server-side material snapshot required before schedule confirmation, keeping any approval/runner/connector activation separate. Production rollout of the draft chain still requires agreed limits/quota policy, schema review and the owner's explicit release permission.
