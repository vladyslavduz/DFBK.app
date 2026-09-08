# DFBK.app — Website Skeleton

DFBK = Dein Foto bringt Kunden.

This repository is the technical website skeleton for the DFBK MVP.
It borrows the public information architecture pattern of TradesAI (hero → benefits → features → process → testimonials → pricing → footer), but not its copy, branding, assets, or proprietary code.

## MVP goal

Photo → AI analysis → generated German marketing content → user review/copy/download.
Direct social publishing comes later.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

Cloudflare serves `./dist` according to `wrangler.jsonc`.

## Structure

- `src/components` — reusable layout components
- `src/sections` — landing page sections
- `src/pages` — future application pages
- `src/lib` — future API helpers
- `src/data` — future static/config data
- `public` — static files and legal placeholder pages

## Next implementation phases

1. Landing-page structure and responsive shell
2. Upload page
3. Photo preview
4. AI API endpoint through server-side/Worker code
5. Generated-content result page
6. Login/business profile only when MVP requires it
7. Publishing integrations only after core workflow is validated

## Security

Never put API keys or passwords in frontend code or GitHub commits. Use Cloudflare secrets/environment variables for production.
