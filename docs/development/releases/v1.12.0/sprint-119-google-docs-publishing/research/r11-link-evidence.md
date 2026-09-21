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

- **Google Docs section of the privacy policy.** The live page has no Google Docs publishing section yet; the only Google mention is the AI provider list. The facts to write it from are in [google-user-data-facts.md](google-user-data-facts.md). This has to be live before the OAuth app is published. Jarmo approves the legal text.
- **Microsoft Store listing.** The privacy and terms URLs in Partner Center move to ritemark.app. Jarmo does this in Partner Center.
- **Not in scope, noticed in passing.** `branding/product.json` `privacyStatementUrl` still points at the upstream `aka.ms/github-copilot-privacy-statement`. It is a shell-tier file, so it is left for a shell release.
