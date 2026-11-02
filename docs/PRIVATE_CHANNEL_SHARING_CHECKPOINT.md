# Private channel sharing checkpoint

Date: 2026-11-02. Local branch: codex/private-channel-sharing.
Base: ff60e7eed64b85fb0062decc415c1a3980992c32 (same tree as draft PR #56); main base 1ff93e517ef6a08015c695108a371c405ba5df0b.

## Behavior
- Project detail Teilen opens that project's existing preparation route, with the originating channel selected. It no longer calls the system share service.
- Logos and actions in the nine-channel integrations catalogue retain the explicit selected project and pass a validated channel query to the result page.
- Each private publishing channel has one keyboard-accessible logo/name button and a focused material preview.
- Primary workflow: download the authenticated project file, copy/edit its channel text, open the destination and confirm there. No navigator.share call remains in PublishingPanel.
- WhatsApp, X and email composers receive only the user's selected text (email also receives project title). Other destinations open their service; no automatic file upload is claimed.
- Website / Blog offers the existing 14 CMS names and manual instructions. No CMS connector or editor URL is invented.
- The existing owner-scoped local draft gains an optional channel field. Legacy drafts default to Instagram. Website/Google edits passed from details cannot replace the Instagram caption.
- Public promotional assets and protected API/project URLs are never inserted into outgoing composer links. Existing entitlement/media gates and publication recovery remain in place.

## Verification
- Frontend TypeScript: PASS.
- Vite production build: PASS (105 modules).
- Sequential local built-preview browser checks: private-project-result-smoke, publishing-smoke, channels-integrations-smoke: PASS.
- Added assertions: nine clickable logos, no native-share calls from private controls, selected-channel routing, editable Website draft isolation, text-only WhatsApp/X/email links, no private URLs or promo substitution, 14 CMS.
- Existing regression assertions: JPEG download, processing/missing states, explicit original choice, stale-project race, guest/foreign denial, 320/390px, no duplicate generation; same-key recovery, uncertain publication lock and storage failure protection.
- Mobile screenshot inspected: artifacts/private-result/mobile-320.png (ignored mock artifact).
- git diff --check: PASS. Initial dev-server browser attempts timed out before assertions; completed checks used built preview on 127.0.0.1:4183.

## Stop point
Local implementation only. No remote PR/settings changes, merge, production deployment, D1/R2 writes, OAuth flow, paid generation or real publication performed. This branch depends on the draft PR #56 catalogue; account for that dependency before opening/merging a release PR.
Social API remains frozen. Browser handoff does not guarantee upload or publication. Real provider/CMS automation and cross-device durable channel edits remain separate work.
