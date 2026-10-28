# Public promotional sharing — checkpoint
Date: 2026-10-28. Scope: ordinary user-confirmed sharing, without DFBK registration or new provider APIs.
Base: main 0212615de8aa3a09542bca3cfae9263dc0628ee3.

## Implemented
- Public /integrations has direct share links for Facebook, WhatsApp, X, LinkedIn, Pinterest and email. The user confirms the final post in the destination service. Facebook receives only the public link; no forced user-authored caption or app ID.
- Public permalink /share/friseur.html contains static Open Graph/Twitter metadata, the approved hairdresser image, description and video. This is a fixed DFBK advertisement; it never reads user projects. Facebook and other services control the final preview.
- Public JPEG /promo/dfbk-friseur.jpg is converted from the existing approved WebP, with no additional AI generation.
- Instagram opens its own material dialog on every device. Download, copy description and open Instagram are explicit steps. System sharing is a separate optional action; it is never launched by the channel button. Feed/story/reel is chosen in Instagram, and files are not automatically uploaded when Instagram opens.
- Unsupported sharing opens a dialog with download, copy and service-opening actions. Photo/video choice is also available separately. All file fetches are public and omit credentials.
- Website/Blog opens a selector with 14 platforms (WordPress, Wix, Joomla, Drupal, Tilda, Jimdo, IONOS, Webflow, Squarespace, Ghost, Blogger, Shopify, TYPO3, other). This provides manual HTML/photo/text export; it is not a connected CMS publishing API.
- Google Business offers manual material transfer to the owner's profile, without claiming a direct API connection.
- Private selected-project publication and its idempotency/recovery flow are unchanged.

## Validation
- 88/88 local tests PASS, no skipped tests.
- Public browser smoke PASS: six link payloads, one-click Facebook composer (mocked destination), JPEG native handoff, cancel, unsupported-device fallback, website selector, public metadata/JPEG, privacy and 390px layout.
- Private browser regression PASS: exact project/media, uncertain-result lock, same-key recovery, storage denial and pending continuation.
- Frontend typecheck, Vite build and Worker dry-run PASS. Existing global Worker type errors remain outside this change.
- External provider publication, target-specific Instagram behavior and social-network preview rendering have NOT been tested with real accounts.

## Boundaries
No new OAuth application, API integration, social enablement, secrets, SQL, billing or real social posts.
SOCIAL_ENABLED remains false. Ordinary public share links do not use that frozen API subsystem.
GitHub push/PR/squash is authorized by the user as one reversible commit. Before merge, verify current Cloudflare production-branch automation or obtain permission for its production effect.
Cloudflare UI currently requires a fresh sign-in; no settings or active deployment were changed during implementation.
The new canonical public share URL and image require deployment of this change before actual public link sharing can be accepted end-to-end. A feature preview alone does not establish that production canonical URLs exist.

## Windows sharing correction (2026-10-28)
The user observed the Windows sharing picker instead of Instagram. The Instagram channel action no longer invokes navigator.share. Browser regression explicitly enables native-share support and verifies zero native calls from the channel action, JPEG download, exact description copying, the Instagram destination (mocked), and optional native sharing/cancellation. No real social posts are used for this check.

## Stop point
Tested local implementation ready for one PR. Next release action: verify Cloudflare settings after sign-in, merge the exact tested tree as one squash commit, then publish only with the applicable production authorization and verify the public URLs. Do not create a real post as a test without user authorization.
