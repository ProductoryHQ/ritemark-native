# Partner Center live draft

Last inspected: **2026-10-17**

## Product identity

| Field | Live value |
|---|---|
| Product name | `Ritemark` |
| Product type | EXE or MSI app |
| Partner Center ID | `3a2a9010-fbe3-47cf-ae87-4d338f587830` |
| Store ID | `XP9K8SP24TRNK4` |
| Store state | In Microsoft Store |
| Store page | `https://apps.microsoft.com/store/detail/XP9K8SP24TRNK4` |
| Update state | Submitted 2026-10-17; `Update in review` |

The application overview displayed “Your latest app is now available on Microsoft Store” and exposed a new **Update app** workflow.

## Update draft audit

| Section | Current state / action |
|---|---|
| Availability | Existing live values inherited; review only unless a deliberate business change is requested |
| Properties | Existing live values inherited; preserve privacy and terms URLs |
| Age ratings | Existing live rating inherited; re-attest only if Partner Center requires it and the answers remain accurate |
| Packages | Package ID `23647104`, x64, last modified 2026-10-16; draft URL is the immutable v1.14.0 candidate URL |
| Package validation | Completed 2026-10-17: malware check clean and code sign valid; silent install, add/remove-programs entry, and bundleware checks remained inconclusive |
| Store listing | Existing live listing inherited; **What's new in this version** updated for v1.14.0 and saved |

## Package values to preserve

| Field | Value |
|---|---|
| Package ID | `23647104` |
| Architecture | x64 |
| App type | EXE |
| Languages | One language; preserve the existing selection |
| Installer parameters | `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER` |
| Installer handling URL | `https://jrsoftware.org/ishelp/topic_setupexitcodes.htm` |
| Cancel return codes | `2`, `5` |
| Success return code | `0` |

The only package identity change for v1.14.0 is the versioned URL:

`https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`

SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`

## Stable public values

- Website: `https://ritemark.app/en/`
- Support: `https://ritemark.app/en/support/`
- Public support email: `info@productory.eu`
- Privacy: `https://www.productory.ai/en/privacy/`
- License terms: `https://www.productory.ai/en/terms/`
- Category: Productivity
- Pricing: Freemium (optional third-party AI account, subscription, or API-credit requirements; no Ritemark in-app subscription)
- Markets: 240/240; automatic future-region distribution remains off
- Generative AI declaration: enabled

Do not use this package update to revise legal URLs, pricing, ratings answers, media, or public contact data unless Jarmo separately requests that change.

## v1.14.0 text

The **What's new** copy from the [candidate record](./release-candidates/v1.14.0-candidate-2.md) and the length-limited reviewer text from [`CERTIFICATION-NOTES-v1.14.0.md`](./CERTIFICATION-NOTES-v1.14.0.md) were saved on 2026-10-16.

A fresh read-only review on 2026-10-17 confirmed 240/240 markets, future-region distribution off, Store discoverability on, inherited Freemium pricing, Productivity category, the approved Productory privacy and terms URLs, completed age ratings, one x64 package with validation completed, the saved v1.14.0 text, and the accepted live media. The final **Submit** control was enabled after this review; it was not clicked without Jarmo's action-time approval.

## Submission record

Jarmo explicitly approved the exact candidate URL and full SHA-256 immediately before **Submit**. Partner Center then presented a separate recommendation claiming that the inherited `Freemium` pricing model implies digital-goods purchases and recommending a `Yes` age-rating answer. Ritemark does not sell digital goods in the app; the Freemium disclosure covers optional third-party AI accounts, subscriptions, or API credits. Jarmo separately approved **Submit anyway** after the warning was shown.

Partner Center accepted the update at approximately `2026-10-17 15:00 EEST` and returned to the application overview with status **Update in review**. The submitted candidate is:

- URL: `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`
- SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`
- Size: `475059168` bytes

The privacy and terms URLs were not changed. A fresh anonymous post-submit download returned the same size and SHA-256.

## Completed submission boundary

All pre-submit gates were completed before **Submit to the Store**:

1. package validation must be complete for the v1.14.0 URL — completed 2026-10-17 with clean malware and valid code-sign results; three identification checks remained inconclusive;
2. every inherited section must be reviewed for accidental changes;
3. the public URL must be freshly downloaded and rehashed;
4. repository QA must pass;
5. Jarmo must explicitly approve the exact URL and full SHA-256 at action time;
6. any separate Partner Center warning needs its own action-time confirmation.
