# Partner Center live draft

Last inspected: **2026-09-02**

## Product identity

| Field | Live value |
|---|---|
| Product name | `Ritemark` |
| Product type | EXE or MSI app |
| Partner Center ID | `3a2a9010-fbe3-47cf-ae87-4d338f587830` |
| Submission state | In draft |
| Store ID | Available after the app is live |
| Store deep link | Available after the app is live |
| Web Store URL | Available after the app is live |

Onboarding is complete and all three verification checks passed. The stale new-account verification warning disappeared from the Store listing surface after refresh on 2026-09-02.

## Submission sections

| Section | Live state / proposed value | Save state |
|---|---|---|
| Availability | 240/240 markets, discoverable, Free, future regions not automatic | Complete; no unsaved changes observed |
| Properties | Productivity, policy/product URLs, generative-AI declaration persisted | Support-contact URL remains blank |
| Age ratings | Questionnaire complete; IARC preview generated | Awaiting explicit IARC Terms/adult-status attestation and **Save** |
| Packages | Final package does not exist | Intentionally blocked |
| Store listing | Manage listing page renders without the account-verification propagation alert | No language added yet |
| Package validation | Depends on Packages | Blocked |

## Availability decisions

Live confirmed values:

- markets: 240 of 240;
- discoverability: discoverable in Microsoft Store;
- automatically include new regions: unchecked;
- pricing model: `Free: no payment necessary`.

Jarmo confirmed these values on 2026-09-01. Partner Center showed no unsaved Availability changes.

## Properties mapping

| Field | Proposed value / decision |
|---|---|
| Primary category | Productivity |
| Secondary category | Leave blank, or choose Utilities & tools after Jarmo review |
| Privacy policy | `https://www.productory.ai/en/privacy/` |
| Website | `https://ritemark.app/en/` |
| Support contact info | Intended: `https://ritemark.app/en/support/`; live field currently clears input and remains blank |
| Public email | Pending explicit confirmation |
| Public phone | Pending explicit confirmation |
| Public address | Pending explicit confirmation |
| Non-Microsoft driver / NT service | Unchecked; final candidate audit must confirm |
| Accessibility-guidelines claim | Unchecked unless a documented accessibility test supports the claim |
| Pen and ink | Unchecked |
| Generative AI | Checked — Ritemark incorporates generative AI features |
| Notes for certification | Use the completed certification-notes template after final package audit |
| Minimum hardware | Keyboard and mouse are appropriate desktop inputs; avoid claiming optional hardware as required |

Partner Center states that the contact email, phone, and address can be displayed to customers. Do not copy the onboarding contact data into these public fields without explicit approval.

## IARC mapping

The questionnaire starts with:

- App type: `All Other App Types`;
- external rating/physical media: `No`.

Clear answers based on current product behavior:

| Question | Proposed answer |
|---|---|
| Ratings-relevant content bundled in the app | No |
| Native user-to-user content sharing | No |
| Online content, including generated AI content | **Yes** |
| Focus on age-restricted products/activities | No |
| Share precise location with other users | No |
| Purchase digital goods in the app | No, subject to pricing confirmation |
| Cash rewards, crypto rewards, or transferable digital assets | No |
| Primarily a web browser or search engine | No |
| Primarily news or education | No |

Answering **Yes** to online/generated content opens four additional “can contain” questions:

- violence;
- sexual material or nudity;
- potentially offensive language;
- illegal or recreational drug references.

Jarmo approved conservative `Yes` answers for all four categories. The resulting detail answers are:

- this content is not Ritemark's primary purpose or focus;
- violence, sexual content, and controlled-substance references can appear in generated text, but Ritemark is not declaring generated visual depictions;
- generated text can include minor profanity, moderate/offensive language, discriminatory language, and sexual expletives.

A partial IARC draft was saved successfully. Jarmo then explicitly authorized **Next**, including Microsoft's stated transfer of the publisher display name and account email to IARC for correspondence. The first preview attempt returned a transient Partner Center error with correlation ID `6956dce3-1c45-45f1-9e08-8a1acf6fa8b0`. After account verification propagated and the final detailed answer was restored, the preview succeeded on 2026-09-02.

Generated preview highlights:

- Microsoft Store: `12+`;
- IARC global: `12+` — Parental Guidance Recommended;
- ESRB: `Teen` — Diverse Content: Discretion Advised;
- USK: `12+` — Contents for Different Age Groups;
- Brazil DJCTQ: `14` — Violence, Sexual Content, Illegal Drugs;
- Chile CCC: `14`;
- Russia PCBP: `18+`;
- PEGI: `Parental Guidance Recommended`.

The preview now requires a checkbox attesting agreement to the IARC Terms of Use and that the publisher representative is of the age of majority in their jurisdiction. **Save** remains disabled until that legal attestation is checked. Obtain Jarmo's explicit confirmation before checking it or saving the ratings.

## Hard boundary

Do not add a package placeholder and do not select Submit. The exact signed EXE, immutable HTTPS URL, SHA-256, Windows evidence, and final approval remain mandatory.
