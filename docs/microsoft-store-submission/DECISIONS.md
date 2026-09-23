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
| 2026-09-07 | Use Cloudflare R2 bucket `ritemark-downloads-prod` behind the apex domain `getritemark.com` for Store installer delivery. | This is the smallest low-cost architecture available in the existing Cloudflare account: managed DNS and TLS, a direct object response, no login page, and no separate CDN/origin service. |
| 2026-09-07 | Use `https://getritemark.com/windows/v{VERSION}/Ritemark-Setup.exe` as the immutable package pattern. | Each released build gets a new versioned key. A submitted key must never receive different bytes; rebuilds require a new candidate/version and URL. |
| 2026-09-07 | Keep the R2 development URL disabled and require TLS 1.2 or newer on the custom domain. | Only the production hostname is public; the rate-limited development hostname is not a supported download route. |
| 2026-09-07 | Publish Store installers with the repository's guarded S3-compatible tool, atomic `If-None-Match: *`, and an indefinite R2 lock on `windows/`. | The client refuses existing keys while the service-side retention rule prevents overwrite and deletion; neither mechanism depends on operator memory alone. |
| 2026-09-07 | Publish the approved v1.10.0 installer at `https://getritemark.com/windows/v1.10.0/Ritemark-Setup.exe`. | A fresh anonymous download matched the approved `430929984`-byte size and SHA-256 `7ada28ad…32f3`; the URL is now immutable and must never receive different bytes. |
| 2026-09-18 | Use v1.11.0 candidate 1 for the certification-remediation resubmission. | The immutable URL returns the approved 444207592-byte installer with SHA-256 `0ebda501…932b`; v1.10.0 and v1.10.1 remain unchanged. |
| 2026-09-18 | Classify the Store offer as Freemium while keeping the product copy explicit about third-party AI costs. | Microsoft finding R1 requires Freemium because optional providers may require subscriptions or API credits. Ritemark itself does not sell an in-app subscription. |
| 2026-09-18 | Treat the English UK `StoreLogo2` finding as the 2:3 poster-art slot and replace it with Windows artwork. | Jarmo uploaded and saved the 720×1080 `posterart_windows.png`; the replacement contains no Mac window chrome. |
| 2026-09-23 | Record v1.11.0 as certified and live under public Store ID `XP9K8SP24TRNK4`. | The public listing is visible at `https://apps.microsoft.com/detail/xp9k8sp24trnk4`; Jarmo confirmed Store-origin install, launch, and uninstall. The submitted installer remains immutable. |

## Open decisions

Reconciliation on 2026-09-18: v1.11.0 candidate 1 supersedes v1.10.1 for the certification-remediation resubmission. All three hosted versions stay immutable. The guarded uploader and its operational documentation remain release-independent tooling.

| Decision | Owner | Needed by |
|---|---|---|
| Clean Windows 11 / Smart App Control On evidence | Jarmo / Windows test owner | Separate post-publication hardening evidence; not inferred from Store certification |
| Store-origin edit/save evidence | Jarmo / Windows test owner | Optional completion of the full internal Store-origin matrix; install/launch/uninstall are already confirmed |

## Change procedure

When a stable Store value changes:

1. Update the relevant canonical document.
2. Add a dated row here with the reason and impact.
3. Update [`STATUS.md`](./STATUS.md).
4. Check whether any open Partner Center draft or published listing must also change.
5. Never edit an older candidate's package URL/hash record to make it look like a new binary.
