# Partner Center runbook

This runbook is designed for a browser-assisted session with Jarmo present for authentication, account decisions, legal attestations, and the final Submit action.

## 1. Finish company onboarding

1. Open `https://storedeveloper.microsoft.com/` and sign in with the Productory organization account.
2. Confirm business, contact, email, employment, and business verification are all complete.
3. Select **Finish account setup**.
4. If Microsoft requests more evidence, stop submission work and follow [`ACCOUNT-ONBOARDING.md`](./ACCOUNT-ONBOARDING.md).

## 2. Reserve the product

1. Enter Partner Center's Windows and Xbox product area.
2. Choose **New product → EXE or MSI app**.
3. Reserve `Ritemark`.
4. If the exact name is unavailable, stop. Jarmo must approve any alternate public product name before proceeding.

## 3. Create the English draft

1. Create an English (United Kingdom) Store listing, unless the live product flow requires a different English locale.
2. Enter the identity fields from [`SUBMISSION-WORKSHEET.md`](./SUBMISSION-WORKSHEET.md).
3. Paste the listing text from [`LISTING-COPY.md`](./LISTING-COPY.md).
4. Enter each feature separately without bullet characters.
5. For the initial submission, leave **What's new in this version** blank.
6. Add no package URL while it is still a placeholder.
7. Save the draft after every completed section.

## 4. Complete business decisions

Jarmo confirms the following in the live Partner Center UI:

- category (proposed: Productivity);
- price;
- market availability;
- visibility and publication timing;
- age-rating questionnaire answers;
- public support email;
- any legal declaration or policy attestation.

Do not infer these decisions from repo metadata.

## 5. Add support, legal, and media

1. Use only the canonical URLs in [`LEGAL-AND-URLS.md`](./LEGAL-AND-URLS.md).
2. Upload [`assets/store-logo-1x1.png`](./assets/store-logo-1x1.png) and inspect the Partner Center crop/preview.
3. Upload only the final installed-Windows screenshots approved in [`ASSETS.md`](./ASSETS.md).
4. Add the reviewed English captions.
5. Do not upload the company registry extract as listing media.

## 6. Add the approved EXE

Proceed only after release Gate 1 and the package checks in [`PACKAGE-AND-CERTIFICATION.md`](./PACKAGE-AND-CERTIFICATION.md).

1. Open the approved record in [`release-candidates/`](./release-candidates/README.md).
2. Select app type **EXE** and architecture **x64**.
3. Enter the exact versioned HTTPS package URL.
4. Enter `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER` as the installer parameters.
5. Select English as a supported language.
6. Save the package draft.
7. Record any preprocessing or validation result in the candidate record.
8. If the binary changes, create a new candidate record and new URL. Never overwrite the submitted URL.

## 7. Add certification notes

Copy and complete [`templates/certification-notes.md`](./templates/certification-notes.md). Include:

- standard-user silent install and uninstall instructions;
- Start menu and Apps list expectations;
- offline behavior;
- whether any feature needs internet access or provider credentials;
- a test account only if certification genuinely requires one;
- explicit disclosure of any non-Microsoft driver or NT service, if present.

Do not store reusable passwords, API keys, or recovery codes in this repository.

## 8. Final review and Submit boundary

1. Complete [`templates/final-submission-checklist.md`](./templates/final-submission-checklist.md).
2. Compare Partner Center's URL, version, publisher, architecture, and parameters with the approved candidate record.
3. Fresh-download the URL and compare SHA-256 again.
4. Confirm clean Windows 11 evidence refers to that same SHA-256.
5. Confirm every listing field contains final text and every public URL returns the expected page.
6. Ask Jarmo for explicit approval for the named candidate and hash.
7. Only then select **Submit to the Store**.

By default, Microsoft publishes the app after certification. Treat Submit as the external publication boundary, not as a harmless draft-save action.

## 9. After submission

1. Record the submission ID and timestamp in the candidate record.
2. Monitor certification status and copy actionable errors without secrets.
3. If certification fails, fix the cause, build a new candidate, use a new versioned URL, rerun the full validation, and create a new submission.
4. When certification passes, install from the Store on the clean Windows machine.
5. Record Store-origin install, launch, edit/save, and uninstall evidence against the same version.
6. Complete release Gate 2 before claiming the Store channel shipped.
