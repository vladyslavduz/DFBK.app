# DFBK.app — Codex instructions

Before work read docs/project-memory/PROJECT_HANDOFF.md and CURRENT_CHECKPOINT.md.

Treat repository code, tests, migrations and actual runtime observations as authoritative; historical chat reports are context, not proof of deployment or tests. Work on branches with PRs. Do not deploy, change production D1/R2, expose secrets, enable Social Publishing or run paid AI calls without explicit approval. Keep SOCIAL_ENABLED=false. Report exact test results. Preserve existing auth, private media, and cost safeguards.

NEXT: run targeted regression tests for Microsoft OAuth PR #49 on current main (personal Microsoft account; Entra identifier mismatch; existing-account takeover prevention). Report PASS/FAIL; no deployment.
