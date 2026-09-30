# DFBK.app — Pricing / Tarife v1 — Business TODO

Frontend implementation intentionally does not decide these commercial rules.

Before publishing the final commercial version, owner decisions are required for:

1. DFBK Pro price.
2. Free test vs. Free Plan.
3. Number of projects/generations included in the test.
4. Whether a payment card is required.
5. Test duration, if time-limited.
6. Monthly vs. annual billing.
7. Annual-payment discount, if any.
8. Cancellation policy and effective cancellation date.
9. What happens to stored projects after subscription end.
10. VAT display (gross/net) for the intended German target group.

## Current frontend-safe behavior

- Public Pricing uses `Ausprobieren` instead of promising `kostenlos` while the free-test model is not approved.
- No public promise of `Jederzeit kündbar` is shown while cancellation terms are not approved.
- No invented DFBK Pro price is shown; the centralized config exposes a price placeholder.
- Share / Business integrations are shown only as `in Vorbereitung` because the entitlement flags exist but the end-user integration flow is not yet delivered.
- The prepared `UpgradePrompt` is not auto-triggered until the test limit/end condition is defined.
- Registration from Pricing continues directly to `/app/new` so the first user can start the first project without first landing on an empty dashboard.

Commercially changeable Pricing copy/data is centralized in `src/config/pricing.ts`.
