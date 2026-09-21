# R11 link switch: evidence

**Date:** 2026-09-21
**Change:** the app's privacy and terms links move from productory.ai to ritemark.app.

| Where | Before | After |
| --- | --- | --- |
| `extensions/ritemark/src/analytics/posthog.ts` (analytics consent) | `https://www.productory.ai/en/privacy/`, `/en/terms/` | `https://ritemark.app/en/privacy/`, `/en/terms/` |
| `extensions/ritemark/webview/src/components/ai-sidebar/aiDisclosure.ts` (AI information) | same | same |

No test asserted the old URLs. After the change, `grep -rn productory.ai extensions/ritemark/src extensions/ritemark/webview/src` finds nothing.

## The pages answered before the switch

Checked with `curl -sI` on 2026-09-21. The server dates are below.

- `https://ritemark.app/en/privacy/` → HTTP/2 200, Mon, 21 Sep 2026 06:42:30 GMT
- `https://ritemark.app/en/terms/` → HTTP/2 200, Mon, 21 Sep 2026 06:42:32 GMT

The consent screen's home page:

- `https://ritemark.app/` → HTTP/2 302 to `/et/`, then 200, Mon, 21 Sep 2026 07:22:05 GMT. The redirect goes by locale; from an Estonian connection it lands on the Estonian home page. Not checked here: whether the page content meets Google's brand-verification requirements.

The old URLs still resolve, so apps up to 1.11 still reach a policy:

- `https://www.productory.ai/en/privacy/` → HTTP/2 200, Mon, 21 Sep 2026 06:42:34 GMT
- `https://www.productory.ai/en/terms/` → HTTP/2 200, Mon, 21 Sep 2026 06:42:36 GMT

## Still open for R11

- ~~Google Docs section of the privacy policy.~~ **Done 2026-09-21.** Written from [google-user-data-facts.md](google-user-data-facts.md), approved by Jarmo, and published in EN and ET through ritemark-web PR #152 (squash commit `8db07a4f`). Checked live at 09:05 UTC: `https://ritemark.app/en/privacy/#google-docs` and `/et/privacy/#google-docs` both show the drive.file and Limited Use statements, "Last updated: 21 September 2026", and the User Data Policy and Google Account links. Unit and E2E tests in ritemark-web now require those statements.
- ~~OAuth app publication.~~ **Done 2026-09-21**, each step on Jarmo's explicit go-ahead:
  - Jarmo verified `sc-domain:ritemark.app` in Search Console. jarmo@productory.eu and tuiskjarmo@gmail.com are both verified owners.
  - Pre-checks: the consent screen shows app name Ritemark, home `https://ritemark.app/en/`, privacy `/en/privacy/`, terms `/en/terms/` and authorized domain `ritemark.app`, with no logo. Both home pages link to the privacy policy.
  - Audience → Publish app → "Push to production?" → Confirm. Status: **In production**, External.
  - Branding → Verify branding. It passed automatically within seconds. Publish branding: "Your branding has been verified and is being shown to users."
  - Verification Center, data access: "Verification is not required since your app is not requesting any sensitive or restricted scopes." The 100-user cap applies only to unapproved sensitive or restricted scopes, so it does not limit `drive.file`.
  - Still to do for the release: compile the production client ("Ritemark desktop (Phase 0)") into release builds through the CI secrets. Delete the disposable canary client and the canary Docs when Phase 0 closes.
- **Microsoft Store listing.** The privacy and terms URLs in Partner Center move to ritemark.app. Jarmo does this in Partner Center.
- **Not in scope, noticed in passing.** `branding/product.json` `privacyStatementUrl` still points at the upstream `aka.ms/github-copilot-privacy-statement`. It is a shell-tier file, so it is left for a shell release.
