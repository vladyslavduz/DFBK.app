# DFBK.app — Dependency Remediation Candidate Results

Evidence source: [GitHub Actions Run #44231967706](https://github.com/vladyslavduz/DFBK.app/actions/runs/44231967706), commit `d78c7756133d9624648e079fd6cc3efad76a4f10`.

**Important:** These package versions exist only in the downloadable CI artifact's candidate `package-lock.json`. They have NOT been committed to `main`, deployed, or promoted to a remediation PR. The current PR #80 only adds a diagnostic workflow.

## npm audit (verified JSON artifacts)

| Scope | Before | Candidate | Status |
|---|---:|---:|---|
| All dependencies, high | 9 | 4 | 5 removed in candidate |
| All dependencies, critical | 0 | 0 | no reported critical |
| Production tree `--omit=dev`, all severities | 0 | 0 | npm reported none |

Candidate lockfile packages include:
- `vite` 7.3.8
- `wrangler` 4.164.0
- `miniflare` 5.20261117.0-beta
- `undici` 7.30.1
- `sharp` 0.35.5
- `picomatch` 4.0.7
- `tinyglobby` 0.2.17
- `fdir` 6.5.0
- `source-map-js` 1.2.2

Four remaining high findings (npm's own dependency graph): `vite`, `tinyglobby`, `fdir`, `picomatch`. npm proposes `vite@6.2.7` via `npm audit fix --force`; DO NOT blindly apply this major downgrade. The candidate smoke + unit regression passes (4/4) on Node 24 and Chromium/Linux, as documented in `full-regression/report.md`.

## Interpretation and next review

- `npm audit --omit=dev: 0` **does not** prove worker/API security or safe production configuration. The tested production dependency subset is only npm's dependency classification.
- CI success does not mean zero advisories. Current audit still reports four high development-tool findings.
- `npm audit fix --package-lock-only` ended nonzero and expressly reported four unresolved findings. The workflow intentionally records that outcome instead of pretending that remediation is complete.
- Analyze the exact GHSA advisory conditions and real exposure to untrusted glob patterns; decide whether a targeted non-major fix is possible or a temporary documented exception is needed.
- Review the generated lockfile and license/compatibility changes. Avoid pinning unstable beta Miniflare without explicit rationale.
- If acceptable, create a **separate** reviewed PR containing actual `package-lock.json` changes and documentation, rerun regression on that committed lockfile, then consider merge. No production deploy or migration as part of this task.

## Artifacts
[Candidate lockfile, audit before/after and regression logs](https://github.com/vladyslavduz/DFBK.app/actions/runs/44231967706) (GitHub Actions artifacts, seven-day retention).

## ERROR / RETEST
- No product regression reproduced in this run; all four local test groups PASS.
- Outstanding dependency risk remains under investigation; do not mark as FIXED.
- No live production OAuth/email/social/publishing/security E2E was performed.
