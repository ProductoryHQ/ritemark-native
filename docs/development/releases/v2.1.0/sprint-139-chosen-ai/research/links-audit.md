# A3: billing pages and the question before a link (R2, R5)

26 October 2026, read in the VS Code tree at the pin (`d956e8a6`, 1.142).

## Does an extension's link ask first?

Yes, for any host that isn't a trusted link domain.

- `vscode.env.openExternal` reaches `MainThreadWindow.$openUri`, which calls `openerService.open(uri, { openExternal: true, … })` with no `fromWorkspace` (`src/vs/workbench/api/browser/mainThreadWindow.ts`).
- The opener runs every validator. `LinkProtectionContribution.validateLink` (`src/vs/workbench/contrib/url/browser/trustedDomainsValidator.ts`) lets an http(s) link through only when `fromWorkspace` is set in a trusted workspace, or when `trustedDomainService.isValid(uri)`. Otherwise it shows "Do you want Ritemark to open the external website?" with Open, Copy and Configure Trusted Domains.
- Ritemark's trusted domains are `branding/product.json`'s `linkProtectionTrustedDomains`: `*.ritemark.app`, `auth.openai.com`, `claude.com`, `platform.claude.com`, `claude.ai`, `console.anthropic.com`.

## The providers' billing pages

| Provider | Page | Trusted today | In 2.1 |
|---|---|---|---|
| Anthropic | `console.anthropic.com/settings/billing` | Yes | A button, **Open Claude Console**, opened by the host (`turn-failure/open-billing` takes a provider name, never a URL, and opens only a trusted page) |
| Google | Google AI Studio (`aistudio.google.com`) | No | Words: "Add credits in Google AI Studio, then send your message again." |
| OpenAI | the platform's billing settings (`platform.openai.com`) | No | Words |
| OpenRouter | the credits page (`openrouter.ai`) | No | Words |

Claude's pricing page for R2's See Claude's plans is on `claude.com`, already trusted.

## Decision

The narrowest one, which keeps 2.1's tier line as it is: **words for the three untrusted hosts, a button for Anthropic's console.** Adding `https://aistudio.google.com`, `https://platform.openai.com` and `https://openrouter.ai` to `linkProtectionTrustedDomains` would give them buttons too. That is one shell-tier line (`branding/product.json`); 2.1 is a shell release anyway, so it costs no extra build, but it is a tier and trust decision for the Development manager. The table that decides button or words is `BILLING_PAGES` in `src/runtime/turnFailureCopy.ts` (`trusted: true` and a `buttonLabel`), so the change is one line there beside the product.json line.
