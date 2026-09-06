# Microsoft Store decisions and change log

This log captures material Store decisions that must survive individual releases.

| Date | Decision | Rationale / effect |
|---|---|---|
| 2026-09-01 | Keep Microsoft Store material in `docs/microsoft-store-submission/`, outside release folders. | Account, listing, legal, hosting, and certification material changes independently of a single release. |
| 2026-09-01 | Maintain one candidate record per submitted Windows binary under this hub. | Preserves release-specific URL/hash evidence without making the overall Store process release-bound. |
| 2026-09-01 | Prepare the submission in English. | English was selected during onboarding and is the initial Store listing language. |
| 2026-09-01 | Use a Company developer account for `Productory Services OÜ`. | The app is published by the registered legal entity, not an individual. |
| 2026-09-01 | Do not request a new D-U-N-S number at this stage. | No match was found; Microsoft accepted an official company registry extract for documentary verification. |
| 2026-09-01 | Use publisher display name `Productory Services OÜ`. | Name was accepted during onboarding and matches the legal entity. |
| 2026-09-01 | Use `https://productory.ai` as the company website and `https://ritemark.app/en/` as the product website. | Separates legal company identity from the product landing page. |
| 2026-09-01 | Use Productory's approved English privacy and terms pages. | Both return HTTP 200 and are already used by the shipping app; proposed Ritemark policy paths return 404. |
| 2026-09-01 | Submit the existing standalone x64 EXE path, not a new MSIX project. | Current Windows signing/build work and Store preparation target the EXE/MSI flow. |
| 2026-09-01 | Use a versioned immutable installer URL and exact SHA-256 evidence. | Microsoft requires submitted installer bytes not to change; this also protects release Gate 2 integrity. |
| 2026-09-01 | Treat the seven v1.10.0 screenshots as references only. | They show a development-host build and must not represent the final installed Windows product. |
| 2026-09-01 | Keep Partner Center as a draft until final-candidate approval. | Submit starts external certification and normally publication after certification. |
| 2026-09-01 | Record Productory's company account as fully verified by Microsoft. | Email, business, and employment verification all show `Verified`; the next action is **Finish account setup**. |
| 2026-09-01 | Complete account setup and enter Partner Center's Apps and games area. | The Productory publisher account is active and can create Store products. |
| 2026-09-01 | Record `Ritemark` as available but not yet reserved. | Partner Center's live availability check passed; reserving creates a persistent product record and starts a 90-day submission window. |
| 2026-09-01 | Reserve `Ritemark` as an EXE/MSI app. | Jarmo completed the reservation in Partner Center; the product is now an active draft with ID `3a2a9010-fbe3-47cf-ae87-4d338f587830`. |
| 2026-09-01 | Set Availability to all 240 markets, normal Store discoverability, Free pricing, and no automatic future regions. | Jarmo approved the initial distribution model; Partner Center showed these values without unsaved changes. |
| 2026-09-01 | Declare generative AI and use conservative IARC content answers. | General-purpose AI output may include sensitive text categories even though they are not Ritemark's focus; visual depictions are not declared. |
| 2026-09-02 | Record Partner Center account verification as propagated to the Store listing surface. | The stale verification warning disappeared after refresh, so listing preparation can continue. |
| 2026-09-02 | Keep the conservative IARC answers after reviewing the generated preview. | The preview produces ratings from `12+` through region-specific `18+`; legal attestation and final save still require Jarmo's explicit approval. |

## Open decisions

| Decision | Owner | Needed by |
|---|---|---|
| Public support email | Jarmo | Before support information is finalized |
| Final screenshot set and order | Jarmo | Before final draft review |
| Exact package candidate/hash | Release manager + Jarmo | Before package section is finalized |
| Submit authorization | Jarmo | After all validation and clean-Windows evidence |

## Change procedure

When a stable Store value changes:

1. Update the relevant canonical document.
2. Add a dated row here with the reason and impact.
3. Update [`STATUS.md`](./STATUS.md).
4. Check whether any open Partner Center draft or published listing must also change.
5. Never edit an older candidate's package URL/hash record to make it look like a new binary.
