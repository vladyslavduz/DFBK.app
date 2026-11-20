# DFBK.app — Cloud technical/security evidence collection

## Purpose
Run code-level evidence collection and existing Full Regression without the local laptop. Use GitHub Actions as temporary compute and download JSON/Markdown/log artifacts. This is a **baseline inventory**, not a claim that the application passed a comprehensive security audit.

## Inputs and baseline
- Repository checkout at exact workflow commit SHA.
- Product baseline: `docs/PRODUCT_BASELINE.md` (approved target, not proof of implementation).
- Existing `scripts/full_regression.py`, Node/SQLite fixture tests and Playwright mocked browser smoke tests.
- `scripts/cloud_security_audit.py` examines only tracked source paths and source patterns without evaluating app code or opening network connections.
- `npm audit --json` consults the public npm advisory registry; it is NOT an application/paid provider call. Dependency findings need severity, exploitability, and fix triage.

## Workflow execution
After review and merging this workflow into `main`, go to **GitHub → Actions → DFBK Cloud Audit (offline app tests) → Run workflow → main** on phone or desktop. PR checks run before merge. The Action:
1. Checks out code read-only (no persisted GitHub credentials).
2. Installs pinned-lock dependencies with `npm ci --ignore-scripts`.
3. Runs static source inventory and obtains `audit.md` / `audit.json`.
4. Saves npm advisory JSON and exit status without hiding that issues may exist.
5. Runs TypeScript, Vite build, unit/API tests and localhost browser smokes.
6. Uploads artifacts for seven days even if a later check fails.

## Safety
- No `wrangler deploy`, Cloudflare credentials, D1/R2 writes, provider OAuth, emails, AI generation or actual publishing.
- Frontend preview binds only `127.0.0.1`; tests use synthetic fixtures. Inspect newly added tests for egress before merging: current workflow does NOT provide network isolation.
- Do not pass sensitive tokens to the runner. No production environment is attached. GitHub permissions limited to `contents: read`.
- Any discovered high/critical security issue should be reported without public exploit details or secrets; public repo artifacts are not a private security channel.
- This workflow does not inspect the disabled local Codex chats or guarantee a complete initial-vision-to-code comparison.

## What the evidence actually means
- `audit.md` / `audit.json`: tracked file counts, filename-based test discovery, flagged review locations, selected repository config flags. These are **not** vulnerability findings or demonstrated coverage.
- `npm-audit.json`: dependency advisories as reported by npm at run time, NOT code exploitability proofs.
- `full-regression/report.md`: build and existing mocked tests; does not cover actual external providers or production secrets.
- Product implementation vs approved requirements, security authorization invariants and deployment configuration still require focused semantic review and tests. Mark unchecked areas **NOT VERIFIED**.

## ERROR / RETEST / Plan & Gemacht
For any FAIL: record run URL, SHA, failed step, reproduction and sanitized error. Separate CI-environment failures from application bugs. Do not infer security defects from regex flags. Fix in separate reviewed PR, retest the exact failing case, rerun full workflow, and only then close the error. Do not auto-merge or deploy.

## Definition of done for this PR
- A complete green workflow on PR's latest commit.
- Static audit JSON/MD, dependency snapshot, full regression JSON/MD and logs are present as downloadable artifacts.
- No runtime code or schema changes.
- Reviewer accepts that overall security and production readiness remain unverified.
