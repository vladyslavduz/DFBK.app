# Local SQLite test runner

Use Node.js **22.12.0** (the reported Windows environment), npm and the committed lockfile.
The `test:local` script enables experimental SQLite and runs test files sequentially.
All test-only Vite servers have HMR disabled; no listener on port 24678 is required.
Existing `after()` hooks close the Vite servers. No deployment command is part of this test runner.

## Windows / PowerShell

After checking out `fix/local-sqlite-test-runner` (or main after its approved merge):

```powershell
Set-Location D:\DFBK_app\GitHubClone\DFBK.app
node --version
npm --version
npm ci
npm run test:local 2>&1 | Tee-Object -FilePath test-local-1.log
$LASTEXITCODE
npm run test:local 2>&1 | Tee-Object -FilePath test-local-2.log
$LASTEXITCODE
npm run build
$LASTEXITCODE
git diff --check
git status --short
```

Inspect the exit code immediately after each command. Both test logs should report
77 tests, 77 passed, 0 failed, 0 skipped. The five new tests validate the local
SQLite adapter; none of the original 72 tests were removed or relaxed.
`*.log`, `node_modules`, `dist` and `.wrangler` are ignored by Git.

Direct equivalent command:

```powershell
node --experimental-sqlite --test --test-concurrency=1
```

Optional bundling validation **after successful tests/build**, without deployment:

```powershell
$env:WRANGLER_SEND_METRICS = 'false'
npx --no-install wrangler deploy --dry-run --outdir .wrangler/dry-run
```

Do not run `npm run deploy` for this task. Do not apply production migrations,
change SOCIAL_ENABLED, perform Meta OAuth/publishing or call paid AI providers.
The unit tests use local in-memory databases and mocked providers. The SQLite
experimental warning is expected on Node 22.12.0 and does not mean test failure.

## Root cause

On unchanged main `1c97156caca6d44437d076f61f2aeaedc13923cd`, Node 22.12.0
reproduced 35 passing / 37 failing tests. The shared fixture's `first()` called
`StatementSync.get(...args)` for D1 SQL with indexed parameters such as `?1`.
That version of node:sqlite requires named bindings for those parameters:

```js
statement.get('user');          // SELECT ?1: SQLITE_RANGE / errcode 25
statement.get({ '?1': 'user' }); // Same SQL/value: succeeds
```

The same mismatch affected `all()` and `run()` and caused downstream assertions
such as expected 401 / actual 500. Fixture creation, migration order and enabled
foreign keys were verified before the failing call at backend.mjs:21.

The test-only adapter now translates positional `?` / indexed `?N` placeholders
into deterministic named placeholders and supplies values by index. Translation
ignores SQL strings, quoted identifiers and comments, preserves repeated indices,
and rejects missing/extra bind values. This avoids different mixed-parameter
semantics between Node 22.12.0 and Node 24.19.0. Production SQL files are unchanged.
Batch transaction behavior and foreign key enforcement are preserved and tested.

This helper remains a local fixture for the SQL used by this repository, not a
complete emulator of all Cloudflare D1 behavior or SQLite syntax.

## LOCAL SQLITE TEST INFRASTRUCTURE REPORT — 2026-10-14

| Field | Result |
| --- | --- |
| Base | main 1c97156caca6d44437d076f61f2aeaedc13923cd |
| Branch | fix/local-sqlite-test-runner |
| Root cause | D1 positional binding forwarded to incompatible node:sqlite calls |
| Node for full tests/build/dry-run | 22.12.0 |
| Before | 35 PASS / 37 FAIL / 72 tests |
| After, run 1 | 77 PASS / 0 FAIL / 0 SKIP |
| After, run 2 with occupied 24678 | 77 PASS / 0 FAIL / 0 SKIP |
| Additional adapter check, Node 24.19.0 | 5 PASS / 0 FAIL |
| Build | PASS |
| Wrangler dry-run | PASS; DB=dfbk-db, MEDIA=dfbk-media, SOCIAL_ENABLED=false |
| Deploy script / lockfile / dependency versions | Unchanged |
| Production / social implementation / PR35 diagnostics | Unchanged |
| Audit | 5 high findings in dev dependency chains; separate report below |
| Windows execution | Pending repeat on the user's actual Windows machine |
| PR / merge | Review-only PR; no merge or real deployment authorized |

The execution host was Linux, using the exact Node 22.12.0 binary. This establishes
the SQLite cause and fix independently of Windows, but does not claim a native
Windows run. The user should run the PowerShell sequence above for final Windows
confirmation before Plan & Gemacht decides on merge.

The dry-run bundled locally and ended with `--dry-run: exiting now`; it did not
publish a Worker or apply D1/R2 changes. The displayed binding names verify config,
not a new live connection to production resources. No candidate credentials were
found by the targeted scan of tracked files and generated public assets; this is
not a complete secret-history audit.

Security findings: [DEPENDENCY_SECURITY_2026-10-14.md](DEPENDENCY_SECURITY_2026-10-14.md).
Primary API reference: https://nodejs.org/download/release/v22.12.0/docs/api/sqlite.html
