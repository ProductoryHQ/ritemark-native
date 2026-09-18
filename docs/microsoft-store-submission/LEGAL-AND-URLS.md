# Legal, support, and public URLs

Last installer HTTP/TLS and hash check: **2026-09-18**. Legal/support page checks remain dated 2026-09-01.

## Canonical submission URLs

| Purpose | Canonical URL | Result on 2026-09-01 | Use in Store |
|---|---|---:|---|
| Company website | `https://productory.ai` | HTTP 200 after redirect to localized site | Company/account record |
| Product website | `https://ritemark.app/en/` | HTTP 200 | Yes |
| Product support | `https://ritemark.app/en/support/` | HTTP 200 | Yes |
| Privacy policy | `https://www.productory.ai/en/privacy/` | HTTP 200 | Yes |
| License / terms | `https://www.productory.ai/en/terms/` | HTTP 200 | Yes |
| Installer host | `https://getritemark.com` | Public DNS, valid HTTPS, direct v1.11.0 response, and fresh-download hash passed | Yes |

Use explicit `/en/` policy URLs so the English Store listing does not depend on location-based redirects.

## Paths not to submit

These proposed Ritemark-specific paths returned HTTP 404 on 2026-09-01:

- `https://ritemark.app/en/privacy/`
- `https://ritemark.app/en/terms/`

Do not use them in Partner Center unless the web owner intentionally publishes and revalidates them. The shipping app already links to the approved Productory privacy and terms pages.

## Legal-source boundary

The live approved Productory policy pages are the legal source of truth. This repository records their canonical URLs and check results; it does not fork or rewrite counsel-approved legal text.

Before every submission:

1. Open both English policy URLs in a signed-out browser.
2. Confirm HTTP 200, valid TLS, readable content, and no authentication wall.
3. Confirm the privacy page still describes current Ritemark analytics, local files, AI-provider data flows, transcription choices, and user controls.
4. Confirm the terms/license page applies to Ritemark distribution.
5. Record the check date in the release-candidate record.

Ritemark's source repository is MIT-licensed, but the public Store listing should use the stable Productory terms URL rather than a repository URL that may become unavailable.

## Installer hosting

The production host is `getritemark.com`, backed by Cloudflare R2. DNS, HTTPS, and direct object delivery were verified with a safe probe on 2026-09-07. v1.10.0, v1.10.1 and v1.11.0 were uploaded to separate versioned keys under the indefinite `windows/` lock and downloaded again from their final URLs with the approved SHA-256. The current Store candidate is v1.11.0, verified 2026-09-18.

Required behavior, checked for every candidate:

- DNS resolves publicly;
- HTTPS certificate is valid;
- path is versioned;
- response is the installer itself, not an HTML page;
- no sign-in, cookie prompt, confirmation page, or JavaScript is required;
- bytes are immutable after Store submission;
- a fresh download matches the approved SHA-256.

Expected pattern:

`https://getritemark.com/windows/v{VERSION}/Ritemark-Setup.exe`

The complete architecture and operational procedure are in [`HOSTING-AND-DOWNLOADS.md`](./HOSTING-AND-DOWNLOADS.md). Probe evidence is in [`evidence/hosting-probe-2026-09-07.md`](./evidence/hosting-probe-2026-09-07.md).

## Public support identity

The support URL and public support email `info@productory.eu` are approved for the Store listing and the AI-reporting workflow. Private/account-verification contacts remain out of scope.

## Recheck commands

Use an external network, follow redirects, and record the final status rather than assuming a page is healthy because DNS resolves. A URL check does not replace visual/legal review.
