# v2.0.0 Partner Center submission evidence — 2026-10-23

Copied at Sprint 136's closeout from ritemark-dev `releases/v2.0.0/store-hosting-evidence.md`. The listing text entered is in ritemark-dev `releases/v2.0.0/store-listing.md`, and in [LISTING-COPY.md](../LISTING-COPY.md) since this closeout.

## Candidate identity

- URL: `https://getritemark.com/windows/v2.0.0/Ritemark-Setup.exe` ([hosting evidence](hosting-v2.0.0-2026-10-22.md))
- Size: `532642016` bytes
- SHA-256: `5364a56e7d1b5f8c60084f69039b344d28605b0d82b67ff9c7e6c735ade884fe`
- The same bytes as the GitHub release asset `Ritemark-Setup.exe` of v2.0.0, published 2026-10-23T04:56:43Z.

## Package validation (update draft, v2.0.0 URL)

The package URL in the update draft was set on 22 October, with x64, EXE, the same silent parameters and the same return codes, and the draft was saved. Microsoft downloaded the package, and validation ran again. The result, read on 23 October:

| Check | Result |
|---|---|
| Malware check | The package is found to be clean. |
| Code sign check | Your app has a valid code sign. |
| Silent install check | We could not identify if your app is installing silently. |
| Entry in add or remove programs | Could not identify the app and publisher names added to Add or remove programs. |
| Bundleware check | Could not identify the app and publisher names added to Add or remove programs. |

These are the same results as v1.14.0's validation on 17 October ([partner-center-validation-v1.14.0-2026-10-17.md](partner-center-validation-v1.14.0-2026-10-17.md)). The three "could not identify" results are inconclusive, not passes. The evidence for this exact SHA-256 is the Windows CI standard-user round trip and update from v1.14.0 (run `39598992733`), and the Gate 2 install, update and uninstall on Jarmo's PC.

## Submission

Submitted on 23 October 2026, about 05:24 UTC. The GitHub release went public at 04:56:43Z, and the 2.0 privacy page was live (`https://ritemark.app/en/privacy/`, "Last updated: 23 October 2026") before the submit.

- **The draft submitted:**
  - the package URL above;
  - the English (UK) listing from ritemark-dev `releases/v2.0.0/store-listing.md`, with the five 2.0 Windows screenshots;
  - the 2.0 certification notes ([CERTIFICATION-NOTES-v2.0.0.md](../CERTIFICATION-NOTES-v2.0.0.md));
  - privacy URL `https://ritemark.app/en/privacy/`.
- **Recommendation shown:** Partner Center showed the same **In-app purchases disclosure** as for v1.14.0. Freemium pricing implies digital goods, so it suggested answering Yes in Age ratings. Ritemark sells no digital goods in the app.
- **Who submitted:** Jarmo said "submit to store", then pressed **Submit anyway** himself ("submit anyway - ma vajutasin ise").
- **Result:** Partner Center shows "Update in review", with a review SLA of 3 business days. Freemium → Free is planned for 2.1's submission.
