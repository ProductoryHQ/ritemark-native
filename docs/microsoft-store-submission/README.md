# Microsoft Store submission hub

This directory is the release-independent source of truth for publishing Ritemark in the Microsoft Store as an EXE app.

Release folders may describe why a particular Windows candidate was built, but Store account data, listing copy, public URLs, reusable evidence, visual-asset rules, certification instructions, and the submission process live here. Version-specific package evidence is recorded under [`release-candidates/`](./release-candidates/README.md).

## Current position

Last reviewed: **2026-09-01**

| Area | State | Next action |
|---|---|---|
| Company developer account | Active; Partner Center accessible | Maintain account verification and contact details |
| English Store listing | `Ritemark` reserved; EXE/MSI draft active | Complete draft sections after account-state propagation and field decisions |
| Public product/support pages | Ready | Recheck immediately before submission |
| Privacy and terms | Ready at Productory URLs | Use the approved Productory pages, not the 404 Ritemark paths |
| Installer hosting | Blocked | Configure DNS and HTTPS for `downloads.ritemark.app` |
| Signed Windows package | Pending | Build only after the release Gate 1 approval |
| Store screenshots | Reference set only | Capture the installed Windows build; current images show a development host |
| Submission | Not authorized | Keep as draft until the final candidate and all checks pass |

The detailed checklist is in [`STATUS.md`](./STATUS.md).

## Work order

1. Complete and verify the Productory company developer account.
2. Reserve the `Ritemark` product name and open an EXE/MSI draft.
3. Fill the stable identity, listing, support, pricing, properties, and age-rating fields.
4. Make the versioned download host and all public URLs production-ready.
5. After release Gate 1, build and audit the signed Windows installer from the approved commit.
6. Upload that exact installer to a versioned, immutable HTTPS URL and verify its SHA-256 after download.
7. Capture final Windows screenshots and complete the certification notes.
8. Run the clean Windows 11 / Smart App Control test against the same SHA-256.
9. Review every Partner Center section and obtain Jarmo's explicit approval for the exact candidate.
10. Click **Submit to the Store**. Record certification and Store-origin installation evidence before calling the channel shipped.

## Directory map

| Path | Purpose |
|---|---|
| [`STATUS.md`](./STATUS.md) | Live status, blockers, owners, and next actions |
| [`ACCOUNT-ONBOARDING.md`](./ACCOUNT-ONBOARDING.md) | Company account facts and verification record |
| [`SUBMISSION-WORKSHEET.md`](./SUBMISSION-WORKSHEET.md) | Partner Center fields and current decisions |
| [`LISTING-COPY.md`](./LISTING-COPY.md) | Copy/paste English listing text |
| [`PARTNER-CENTER-RUNBOOK.md`](./PARTNER-CENTER-RUNBOOK.md) | Browser-assisted Partner Center sequence |
| [`PARTNER-CENTER-LIVE-DRAFT.md`](./PARTNER-CENTER-LIVE-DRAFT.md) | Current live product ID, section state, and pending decisions |
| [`PACKAGE-AND-CERTIFICATION.md`](./PACKAGE-AND-CERTIFICATION.md) | Installer, signature, URL, hash, and test gates |
| [`LEGAL-AND-URLS.md`](./LEGAL-AND-URLS.md) | Canonical public URLs and live checks |
| [`ASSETS.md`](./ASSETS.md) | Store logo and screenshot inventory |
| [`DECISIONS.md`](./DECISIONS.md) | Durable decisions and change log |
| [`OFFICIAL-REFERENCES.md`](./OFFICIAL-REFERENCES.md) | Microsoft documentation used by this package |
| [`templates/`](./templates/) | Candidate, certification, and final-review templates |
| [`release-candidates/`](./release-candidates/README.md) | One evidence record for each Store binary |
| [`evidence/`](./evidence/) | Account and external-check evidence |
| [`assets/`](./assets/) | Store logo plus reference/final screenshot files |

## Non-negotiable rules

- The final package URL is HTTPS, direct, versioned, and immutable.
- Never replace an installer behind a URL that has been submitted to Microsoft.
- The installer and all Ritemark-owned PE files are Authenticode-signed by `Productory Services OÜ`.
- The EXE is a standalone installer and does not download installation payloads.
- Partner Center, hosted file, clean-Windows evidence, and direct-download evidence must identify the same SHA-256.
- Do not click **Submit to the Store** until Jarmo approves the exact candidate record.
- Do not claim the Store channel shipped until certification passes and the Store-origin install has been verified.

## Updating this hub

Update the stable documents when Productory, Ritemark, Microsoft requirements, public URLs, or submission policy changes. Add a dated entry to [`DECISIONS.md`](./DECISIONS.md) for any material change. For each new Windows candidate, copy the release-candidate template instead of overwriting an earlier candidate record.
