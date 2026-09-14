# DFBK.app — full technical skeleton

**DFBK = Dein Foto bringt Kunden.**

This package expands the existing DFBK landing page without changing its established visual direction. The public landing keeps the same layout and styling logic; the repository now contains the full technical shell for the planned product.

## Product idea

A Handwerker / Selbstständiger / small business uploads photos of completed work. DFBK later uses AI to understand the work, generate marketing content, save it as a reusable project/reference and publish it to selected channels.

The first commercial loop remains deliberately small:

**Photo → AI → ready German content → review → save/copy/download.**

Direct publishing and other advanced features are scaffolded but disabled.

## Important security rule

**There is intentionally no folder with API keys.** Secrets never belong in GitHub or frontend code. Exact secret names and connection points are documented in `.dev.vars.example`, `docs/SECRETS.md` and `docs/API-MAP.md`.

## Main pages

- `/` landing page — existing visual direction
- `/login`
- `/register`
- `/forgot-password`
- `/dashboard`
- `/create`
- `/result`
- `/projects`
- `/projects/:id`
- `/profile`
- `/integrations`
- `/settings`
- `/pricing`
- `/billing`
- `/help`
- `/impressum`
- `/datenschutz`
- `/agb`
- `/widerruf`

## API skeleton

The Worker has safe non-functional placeholders for auth, AI, projects, uploads, publishing, integrations and billing. Most intentionally return `501 NOT_IMPLEMENTED` until you connect the relevant provider.

`GET /api/health` is functional and can be used to verify that the Worker is alive.

## Install

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to Cloudflare

```bash
npm run build && npx wrangler deploy
```

Cloudflare config is in `wrangler.jsonc`.

## Recommended work style

Large structural work: computer/local Git workflow. Small fixes: GitHub/mobile commits are fine. Keep meaningful commits so rollback stays easy.

See `/docs` before connecting any API.

## Brand / Design

The approved DFBK.app brand assets are included in `public/brand/`. The approved color system is applied globally in `src/styles/global.css`. See `docs/DESIGN-SYSTEM.md` for the fixed palette and logo rules.
