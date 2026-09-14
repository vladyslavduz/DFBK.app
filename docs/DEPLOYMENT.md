# Deployment

Current Cloudflare build/deploy command:

```bash
npm run build && npx wrangler deploy
```

The reason `npm run build` must run first: Vite creates `dist/`, and Wrangler then uploads that directory as static assets.

## Git workflow for the current MVP

1. Work locally on the computer.
2. Check the site locally with `npm run dev`.
3. Commit a meaningful milestone to `main`.
4. Cloudflare rebuilds from GitHub.
5. Small text fixes can still be made from the phone and committed separately.
