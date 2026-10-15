# Dependency Security Findings — 2026-10-14

Scope: read-only npm audit of the unchanged package-lock at main
`1c97156caca6d44437d076f61f2aeaedc13923cd`.
No `npm audit fix`, force update, overrides or dependency upgrades were performed.
The SQLite test-runner fix does not require a dependency change.

`npm audit --json`: **5 high / 0 critical** package findings.
`npm audit --omit=dev --json`: **0 vulnerabilities** reported.
Five package findings do not mean five independent exploitable production issues:
Wrangler and Miniflare inherit findings from their dependencies, and Undici has
multiple advisories. Runtime reachability has to be assessed separately.

| Package | Locked version | Direct/transitive | Chain / scope | Available correction |
| --- | --- | --- | --- | --- |
| wrangler | 4.136.1 | Direct devDependency | Build/development/deployment tooling | 4.149.0 depends on the corrected Miniflare chain |
| miniflare | 5.20260921.0-alpha | Transitive dev | wrangler -> miniflare | 5.20261006.1-alpha, as declared by Wrangler 4.149.0 |
| sharp | 0.35.4 | Transitive dev | wrangler -> miniflare -> sharp | 0.35.5 |
| undici | 7.29.0 | Transitive dev | wrangler -> miniflare -> undici | 7.29.1 |
| source-map-js | 1.2.1 | Transitive dev | vite -> postcss -> source-map-js | 1.2.2 |

Registry metadata was checked read-only: Wrangler 4.149.0 uses Miniflare
5.20261006.1-alpha, which declares Sharp 0.35.5 and Undici 7.29.1. This is a
candidate remediation path, not a tested lockfile upgrade. It does not require
changing Wrangler's major 4. Sharp/Undici/source-map-js corrections also remain
within their shown minor/major lines. Resolve the actual new lockfile and re-audit
in a separate approved dependency-security task; do not manually edit lock entries.

## Impact

- **Sharp:** upstream librsvg memory vulnerability; the advisory describes possible
  RCE under specific glibc/Linux conditions. Package presence does not establish
  that the DFBK Worker decodes SVG through Sharp.
- **Undici:** advisories include TLS validation bypass in BalancedPool, WebSocket
  denial of service, decompression/caching/retry issues; relevant API use and
  untrusted inputs determine exposure.
- **source-map-js:** event-loop denial of service from indexed source-map offsets;
  assess untrusted source maps in development/build tooling.
- **Wrangler/Miniflare:** affected dependency chains require maintenance even
  though they are devDependencies. CI and developer machines execute these tools.
- No imports of these tooling packages were found in `worker/` or `src/`.
  The deployed Worker uses Cloudflare APIs and fetch; the frontend's direct runtime
  dependencies are React/ReactDOM. This is a source-level reachability observation,
  not proof that the whole deployed system is safe. Build and dry-run passed with
  the existing versions; this does not remediate the advisories.

## Next task

Prepare a separate dependency-security PR using the committed lockfile, select
compatible patched tooling versions, rerun tests/build/dry-run and both audits.
Keep deployment, Meta integration and Social Publishing frozen until authorized.
Do not bundle version changes into the local SQLite fix.

Sources:

- https://github.com/advisories/GHSA-wq5f-xc86-pv6w (Sharp)
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q (source-map-js)
- https://github.com/advisories/GHSA-w293-vg96-wgc3 (Undici TLS)
- Local npm audit JSON also lists Undici GHSA-3wwx-pv8p-q78v,
  GHSA-pmjh-fq2x-6v4x, GHSA-r53p-7pc4-xj5r, GHSA-rfgv-xxqx-mfg5,
  GHSA-3xpg-4rpp-hhhm, GHSA-2jfj-6hjv-fm6j, GHSA-2gqq-gqf2-x968,
  GHSA-8436-99hf-9mmv and GHSA-rx4f-c7p8-82vq.
