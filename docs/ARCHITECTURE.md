# DFBK.app — technical skeleton

## Product path

Photo → upload → AI photo analysis → generated content → user review → save as project/reference → publish/export.

## MVP rule

Keep the first commercial version small. The first useful loop is:

1. Upload photos.
2. Generate German marketing content.
3. Review/copy/download.
4. Store the project as a reference.

Direct publishing, billing and client portal are prepared in the structure but must not block the MVP. Voice dictation is integrated into the Beschreibung field and is currently available in the Trial/Testzugang for a controlled 10-word test. Plan entitlements remain the source of truth for future Business access.

## Layers

- `src/` — browser UI. No secrets.
- `worker/` — Cloudflare Worker API. Secret/API calls belong here.
- `public/` — public static files.
- `docs/` — architecture, integrations, deployment and GDPR notes.

## Future storage (not connected yet)

Recommended low-cost Cloudflare-first path after core flow works:

- D1: user/business/project metadata.
- R2: uploaded photos and generated media.
- Worker Secrets: provider secrets and OAuth client secrets.

Do not create these resources until the corresponding feature is implemented.
