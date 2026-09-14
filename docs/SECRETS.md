# Secrets — never commit them

Do not create a `keys/` folder in GitHub. A public or accidentally exposed repository would leak every credential.

## Local development

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Put local secret values only in `.dev.vars`.
3. `.dev.vars` is already in `.gitignore`.

## Cloudflare production

Add secrets in Cloudflare Worker settings or with Wrangler, one by one. Example:

```bash
npx wrangler secret put OPENAI_API_KEY
```

Repeat for the required secret name. The value is entered interactively and must never be pasted into source code.

## Browser rule

Anything named `VITE_*` becomes readable by website visitors. Therefore only public configuration may use `VITE_*`. API keys must never use that prefix.
