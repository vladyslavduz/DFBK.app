# Replace the current GitHub skeleton

1. Extract this ZIP on the computer.
2. Open the extracted folder.
3. Upload/drag **the contents of the folder** into the root of the existing `DFBK.app` repository. Do not upload the outer folder itself.
4. Allow GitHub to replace files with the same names (`package.json`, `wrangler.jsonc`, `src/...`).
5. Commit directly to `main` for the current MVP workflow.

Suggested commit message:

`Expand DFBK.app full technical skeleton`

Cloudflare deploy command should remain:

`npm run build && npx wrangler deploy`

After deployment, verify:
- `/` still looks like the existing landing page.
- `/api/health` returns JSON with `ok: true`.
- `/dashboard`, `/create`, `/integrations` load as placeholder pages.

API integrations are intentionally not functional yet.
