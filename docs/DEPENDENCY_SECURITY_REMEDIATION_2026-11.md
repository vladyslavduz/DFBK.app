# DFBK.app — Dependency lockfile security remediation (2026-11-18)

## Scope and evidence

Proposed change: **package-lock.json only** (no application, SQL, Cloudflare configuration, or `package.json` changes).

Candidate was resolved and regression-tested on GitHub-hosted Ubuntu/Node 24:
- [GitHub Actions run 44247572300](https://github.com/vladyslavduz/DFBK.app/actions/runs/44247572300) — both candidate test and lockfile commit jobs SUCCESS.
- Its artifact `tested-lockfile-candidate` contains original and candidate `npm audit` JSON, lockfile and Full Regression JSON/Markdown/logs.
- `npm ci --ignore-scripts`: PASS.
- Full Regression: **4/4 PASS** (frontend typecheck, Vite build, Node/SQLite unit/API, Chromium browser smoke).
- These checks use local fixtures, not live Production E2E.

## Security advisory before/after

| npm audit scope | Original lockfile | Updated lockfile |
|---|---:|---:|
| All dependencies — High | **9** | **4** |
| All dependencies — Critical | **0** | **0** |
| `--omit=dev` — all severities | **0** | **0** |

Resolved high package advisory groupings: `miniflare`, `sharp`, `source-map-js`, `undici`, `wrangler`.

Open findings: `picomatch` and its parent chain `fdir` → `tinyglobby` → `vite`. All four npm dependency-tree findings stem from **one underlying picomatch ReDoS advisory**, [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). The installed candidate `picomatch@4.0.7` is affected. A nonbreaking, fixed release was not demonstrated by the audit. **Do not use `npm audit fix --force`: npm suggests a Vite downgrade to 6.2.7 and this has not been evaluated.** Record this as an accepted-for-testing **unresolved risk, not closed or safe**. Confirm whether untrusted/user-controlled glob patterns can reach build tooling; restrict dev server to localhost and avoid exposing it publicly.

## Candidate dependency versions from GitHub Action

| Package | Candidate version |
|---|---|
| vite | 7.3.8 |
| wrangler | 4.164.0 |
| miniflare | 5.20261117.0-beta |
| undici | 7.30.1 |
| sharp | 0.35.5 |
| source-map-js | 1.2.2 |
| picomatch | 4.0.7 |
| tinyglobby | 0.2.17 |
| fdir | 6.5.0 |

**Note**: Wrangler's locked version currently depends on a prerelease Miniflare; this needs compatibility review if Cloudflare local dev workflows rely on Miniflare, even though the four regression checks passed.

## Prior-to-merge release gates

1. Review `package-lock.json` diff: no altered root package specs, new scripts or unexpected registries.
2. The PR's own `DFBK Full Regression` must PASS on the committed lockfile.
3. Re-run or verify `npm audit` on this exact commit, not a previous artifact, and verify 9→4 (or better), Production 0.
4. Document disposition of picomatch issue; do not call all advisories resolved.
5. Validate Cloudflare config with a **non-deploy dry-run** in a separate check if compatibility uncertainty remains.
6. Merge only after human approval. No Production deployment or schema migration by this PR.

## Status

**Dependency upgrade proposal only**. Security posture is improved in CI evidence, but complete application security and actual live Cloudflare behavior remain **NOT VERIFIED**.
