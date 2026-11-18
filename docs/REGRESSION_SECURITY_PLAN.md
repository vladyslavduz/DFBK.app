# DFBK.app — Full Regression / ERROR / RETEST security acceptance plan

Status: REVIEW SPECIFICATION. This document does not claim the listed checks already pass. Scope: isolated CI runner, localhost preview, SQLite fixtures, browser API mocks. No production endpoints, D1/R2 writes, secrets, paid AI, actual email delivery, actual OAuth redirects, or provider publishing.

## Acceptance gates, in order

**G0 — Change review / safety**
- Confirm only test runner, CI workflow, and docs changed. Review workflow triggers, permissions, package-lock provenance and PR diff.
- No deploy, migrations, credentials, outbound calls to paid providers or production URLs. Browser fixtures must intercept external navigation/API requests.
- Flag any unmocked requests in code review; current workflow is not a network sandbox against malicious code.
- Check workflow has read-only GitHub permissions; never use `pull_request_target`, broad write tokens, or production environments.

**G1 — Build and existing regression**
- Reproducible `npm ci --ignore-scripts` under Node 24, `npm run typecheck:frontend`, `npm run build`, `npm run test:local`.
- Local `vite preview` on 127.0.0.1 and existing Playwright scripts with installed Chromium.
- Python reports per-step exit status, duration, log; workflow fails on any FAIL/TIMEOUT/SKIP/ERROR.
- Pass means **only** existing covered cases have passed. Test counts and assertions are taken from actual CI logs, never assumed.

**G2 — Security test coverage matrix (incremental; add tests only in reviewed PRs)**
| Domain | Required checks | Evidence |
|---|---|---|
| Authentication | login/logout; unverified email; password reset token expiry/single use; old sessions invalidated; account existence masking; CSRF/OAuth state/PKCE | Node API tests and dedicated mocked browser tests |
| Authorization | guest and cross-account project/media/content access rejected; admin-only routes; trial history confirmation authorization | 401/403/404 behavior and DB assertions |
| Input/media | allowed file types and magic bytes, size limits, malformed JSON, XSS in displayed text, upload failures | explicit negative tests |
| Trial/quota | approved 3 lifetime projects and 15 successful sends as **target**, not active; duplicate POST, concurrency, legacy unknown history fail closed; no double charging | isolated SQLite/workerd tests |
| Scheduler/publishing | unsupported channels fail closed, write/dispatch flags off; retries idempotent; uncertain provider status not assumed success; no external posting | fixture tests and logs |
| Secrets and logging | no raw tokens/passwords/provider secrets in logs/artifacts; invocation log config reviewed; error responses sanitized | static review plus fixture redaction tests |
| Browser | desktop/mobile 1280 / 390 / 320px, stale-project response isolation, browser errors, empty/error/reload flows | Playwright assertions |
| Dependencies/CI | locked dependencies; review npm audit output separately; untrusted PR permissions minimal | CI config review; package vulnerability audit |

G2 is a **planned coverage checklist**, not a promise that current suite exhaustively tests all points. Do not mark an item PASS without identifying the exact test/assertions/log.

**G3 — Security review beyond current CI**
- Optional dependency vulnerability scan (`npm audit --omit=dev` + `npm audit`, triage severity and false positives). Does not automatically establish exploitation.
- Dedicated local workerd/D1 compatibility tests and network egress guardrails are a separate reviewed task.
- Static security audit of Worker routing, CSP/CORS, cookie flags, session revocation, OAuth callbacks, object ownership, rate limiting, and provider error handling.
- Real production OAuth/email/delivery, Cloudflare runtime configuration, and browser acceptance must be checked later under separate explicit approval.

## ERROR → RETEST protocol

1. On CI FAIL, capture run URL, failing step, commit SHA, test name, expected vs actual, severity, and sanitized log excerpt.
2. Classify as: CI environment | existing regression | new regression | product bug | suspected security issue | unverified.
3. For security issues: **do not include secrets/customer data in GitHub issue**, restrict details if necessary and avoid public proof-of-concept data.
4. Reproduce in isolated fixture; identify minimal root cause. Open a narrow fixing PR; no unrelated changes.
5. Retest failing case first; run full suite second; review resulting diff.
6. Mark fixed only on verified green run for the fixing commit. `SKIP` and `NOT RUN` are not `PASS`.
7. Merge only after current-head CI PASS, reviewed diff, no high/critical unresolved security findings in changed scope, and explicit approval.
8. Post-merge rerun on main; attach report artifact URL and exact main SHA. Any post-merge regression reopens ERROR and blocks later deployment.

## Readiness rules
- PR #78 may merge only after a complete green GitHub Actions run on its latest commit and explicit review.
- A green result is **Full Regression v1 PASS**, not full security certification.
- After merge, manually dispatch full regression on main and record output. No deployment or paid API calls.
- If any suite is flaky or fails only on Linux, fix test infrastructure in separate reviewed changes, not by disabling test coverage.
