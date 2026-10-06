# Marketing Content Quality Upgrade v1

Дата: 06.10.2026. Backend-only. Implementation tested locally; real-photo/manual quality verification PENDING. Overall NOT CLOSED.

## Audit / changes

Based on main `1438e0d`, including the merged project-management backend and subsequent frontend work. Existing model is `gpt-5.6-luna`, single Responses API request with original private R2 image, optional description and title context. Three texts are explicitly projected into the public response and persisted as existing `google_business`, `social_media`, `website_reference` records. Auto-title update remains inside the existing D1 batch guarded by current title_source != manual, including concurrent rename protection. No schema changes or changes to Auth, Trial, Admin, optimization, ownership, media or frontend.

Trusted `instructions` now define visual evidence → grounded customer benefit → channel-specific marketing copy in one response. User context is a separate JSON data block, not interpolated into trusted instructions. Description has priority over visual guesses unless obviously contradictory; a title is weak context, not proof of technical facts. Hooks must be evidence-based: a finished-room photo alone does not establish renovation, a food photo does not prove freshness, and a black box does not prove custom manufacture, metal, waterproofing or load capacity. Banned picture-description constructions, restrained German tone, channel differences and uncertainty fallback are specified. No automatic paid repair/retry or server-generated generic copy is introduced.

Strict model schema now contains seven camelCase fields:

- projectTitle: nullable string, existing normalization/fallback.
- visualUnderstanding: nullable concise evidence summary, accepted up to 600 Unicode codepoints.
- workType: nullable concise category, up to 120 codepoints.
- marketingAngle: nullable concise customer-benefit summary, up to 400 codepoints.
- googleBusiness, socialMedia, websiteReference: non-empty visible text strings, existing validation.

Internal fields are short task summaries, not requests for private chain-of-thought. Missing/wrong-type/empty/oversized internal fields become null and never invalidate usable visible copy. Strict schema requires the keys in actual provider output but allows null; defensive processing also tolerates old/missing internal fields. Internals are not persisted, returned to frontend, or logged. Current title fallback, channel API names and failure/status logic remain unchanged.

## Cost / quality limits

One existing model call per generation, no additional analysis/title/channel calls, same model. The larger instructions and three summaries add input/output tokens; actual monetary cost or latency may increase. There is no promise of unchanged price. No real provider call or paid quality test was performed in this implementation session.

Prompts guide marketing quality, factuality and variation; mocked outputs do not prove model compliance or that every prohibited phrase has disappeared. No brittle substring deletion is applied to otherwise valid text. Existing JSON and non-empty public-text validation is preserved; malformed public content follows existing failure logic. Quality acceptance requires the manual real-image checks below, not merely passing contract tests.

## Required manual tests — ALL NOT RUN

Use dedicated test data, not arbitrary real clients. Use existing projects where possible to avoid Trial limit and unnecessary automatic image-edit cost. Do not reset completed optimization locks. Every quality test uses the existing generate endpoint once; a deliberate regenerate is an additional normal paid generation, not a hidden backend call.

| Case | Evidence / description | Expected copy direction | Title direction / forbidden claims |
| --- | --- | --- | --- |
| Gastronomie | Actual plated dish; first without description, then if needed truthful supplied context | Appetizing presentation and experience; Google restrained, social engaging, website evergreen | Angerichtetes Hauptgericht or identifiable dish; no freshness/ingredients/origin claims without evidence |
| Handwerk | Two black boxes; no description. Optional separate run with genuine description `maßgefertigte Metallgehäuse` | Clear finish/appearance, no object inventory opening | Schwarze Gehäuse if identifiable; only contextual run may use Maßgefertigte Metallgehäuse; no waterproof/load claims |
| Renovation | Finished wall/room; truthful description confirms painting if applicable | Calm atmosphere and visible finish; transformation only if supported | Wohnzimmer neu gestrichen only when painting/room supported; otherwise factual room title |
| Beauty | Actual hairstyle, truthful haircut/styling context if needed | Finished style/look, no invented treatment or personal story | Damenhaarschnitt & Styling only with supporting evidence/context |
| Cleaning | Clean floor/space with truthful cleaning context | Cleanliness/maintained impression; before/after difference only if demonstrated | Bodenreinigung only if cleaning established; no invented method, disinfection or guarantee |

For each case record: project ID, date, description, actual image/context, resulting title, three actual texts, provider-call count evidence, reviewer findings and pass/fail. Do not place private customer data/images or tokens in git.

Acceptance: all three visible texts naturally German, grounded and plausibly useful for marketing; no picture-description lead-in/object inventory; no invented facts; clearly different channel approaches; title factual not slogan. Test missing description and ambiguous evidence; usable cautious copy should remain possible. If internal output is inspected for quality, do so in a controlled local test harness; do not expose it in production API or enable raw prompt/response logging.

Also rename a test project manually, regenerate and GET project: manual title unchanged. Verify generation writes exactly three existing content types and GET content retains existing contract. Run existing Auth/Google/Projects/Media/Trial/Admin regression checks. Production authenticated checks require access to a dedicated test session; no credentials should be pasted into chat.

## Validation checkpoint

Five new automated contract tests cover the seven-field request, one-call structure, bad/missing internals/title fallback, malformed public output without paid retries, five title fixtures and absence of internals from public GET/generate/D1. Existing project-management tests cover auto/manual/concurrent rename, quota and photo optimization. These use mocked external services; they are not manual photo quality tests.

Deployment and authenticated production E2E remain separate verification steps. Do not declare CLOSED until five real-photo quality cases and production regressions are documented.
