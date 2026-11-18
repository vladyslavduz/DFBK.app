# DFBK.app — Full Regression (local and GitHub Actions)

## Purpose
One reproducible **offline/local-fixture** regression suite that checks frontend typechecking, Vite build, existing Node unit/API tests and three Playwright smoke scripts. Python is only the orchestrator; it does **not** duplicate Node or browser tests. The full test suite uses existing test fixtures: no production D1, R2, AI generation, Resend mail, social publishing, billing or deployment.

## Run in GitHub
After the workflow has been merged to the default branch, open **Actions → DFBK Full Regression (local fixtures) → Run workflow** from desktop or phone. On pull requests against main the workflow also runs automatically.

- GitHub-hosted Ubuntu; Node 24, Python 3.11, Chromium.
- `npm ci --ignore-scripts` installs locked dependencies without npm lifecycle scripts.
- `npx playwright install --with-deps chromium` installs a Linux browser.
- `PROMO_BROWSER` points at Playwright's installed Chromium, overriding the Windows Edge path hardcoded as default in existing smoke scripts.
- Frontend preview is bound to `127.0.0.1:5173`, not published to the internet.
- Workflow has only `contents: read` permission; checkout does not persist credentials. No environment with production secrets is attached.
- Logs and `report.json` / `report.md` are stored as a workflow artifact for **7 days**, even when the regression fails.
- Expect 4 steps: frontend typecheck; Vite build; Node local tests; browser smoke. Browser step is skipped if earlier checks fail.
- Historical TypeScript errors outside `tsconfig.publishing.json` are not implicitly asserted to pass.

## Run on Windows / local workstation
Install Python 3.11+, Node 24, project dependencies (`npm ci`) and a compatible Playwright Chromium:
```bash
npx playwright install chromium
```
Set `PROMO_BROWSER` to the browser executable path (e.g. from `node -p "require('playwright').chromium.executablePath()"`), then:
```bash
python scripts/full_regression.py
```
Results are under `artifacts/full-regression/` (gitignored). Python uses only standard-library modules.

## Security and limitations
- This is **not a production E2E test** and should never be described as proof that Microsoft/Google OAuth, real email delivery, payments or Meta publishing work.
- Existing unit tests can deliberately use mock provider environments and test flag values internally; the runner's environment flags do not change those fixture tests or enable production services.
- Do not add production credentials to GitHub Actions, repo vars, artifact logs or test fixtures. Avoid downloading real customer data or connecting the runner to production resources.
- Workflow cannot protect against all future test changes that intentionally make network calls: inspect PR modifications to scripts and tests before merge. Add stronger network sandboxing for an adversarial or untrusted-code testing scenario.
- Do not add a production URL to `PROMO_ORIGIN`; the orchestrator explicitly sets it to localhost.
- CI failures can be environmental: missing binary/native dependency, resource exhaustion, or old tests using Windows-only paths. Preserve FAIL logs and fix only with reviewed changes.
- Running CI consumes GitHub runner minutes/storage subject to account/repository billing rules; standard mocked tests do not consume Codex LLM tokens.
- The manual **Run workflow** button becomes available only after the workflow exists on the repository default branch.

## Acceptance criteria for this PR
1. New files only: `scripts/full_regression.py`, `.github/workflows/full-regression.yml`, this document.
2. No source runtime/SQL/schema/Cloudflare changes.
3. GitHub Actions successfully installs Node/Python/Chromium and runs the suite on this PR.
4. JSON/Markdown report and logs uploaded even on failure; job fails when checks fail.
5. Inspect first PR run and record actual PASS/FAIL. Do not automatically merge.
