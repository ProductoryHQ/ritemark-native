# Microsoft Store resubmission — 2026-09-20

## Result

Jarmo explicitly authorized **Submit anyway** after reviewing Partner Center's completed package validation and its Freemium/age-rating warning. Codex selected the action in Partner Center and observed the resulting **In review** state, the confirmation “Your app submission is complete,” and review **in process**. Microsoft displays an SLA of **3 business days**. This records submission completion, not certification approval or Store publication.

- Product: Ritemark, EXE/MSI app.
- Partner Center product ID: `3a2a9010-fbe3-47cf-ae87-4d338f587830`.
- Package ID: `23647104`, x64.
- Candidate: v1.11.0 candidate 1.
- URL: `https://getritemark.com/windows/v1.11.0/Ritemark-Setup.exe`.
- Size: `444207592` bytes.
- SHA-256: `0ebda5016e432b2f039613f74665343220006e39e7749ddb76d285d0a87b932b`.
- R2 ETag: `"215bc154378ab2bf8ab4cce863ebaf9d"`.
- Installer parameters: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER`.

## Microsoft package validation

Validation status: **Completed**.

- Malware: package found clean.
- Code signing: valid.
- Silent install, Apps & Features identity, and bundleware: Microsoft's automatic checks could not identify a result. These were not reported as passed automated checks and were not displayed as validation failures.
- Manual evidence for this exact candidate records standard-user silent install, one `Ritemark 1.11.0` Apps & Features entry from `Productory Services OÜ`, and silent uninstall with no remaining entry.
- Jarmo also manually tested the installer and confirmed it works.
- A separate clean Windows 11 / Smart App Control On test remains pending and is not represented as completed by this submission.

## Submitted remediation

- Availability is saved as **Freemium** because optional AI may require a separate third-party provider subscription or API credits; Ritemark itself does not sell an in-app subscription.
- Ritemark 1.11.0 adds a discoverable **Report AI issue** flow with user-reviewed content and an honest email/copy fallback.
- The English (United Kingdom) 2:3 poster art was replaced with Windows artwork.
- The Source Control empty state no longer promotes or links to a Git download.
- Certification notes include reviewer steps, package URL, SHA-256, architecture, silent-install parameters, offline behavior, and optional AI-provider requirements.

Partner Center displayed a warning suggesting the age-rating answer for digital purchases be revisited because the pricing model is Freemium. The answer remained **No**: Microsoft's questionnaire describes purchases completed directly within the app, while Ritemark has no direct in-app purchase flow. Optional provider subscriptions or API credits are purchased separately from those providers and are disclosed in the pricing/listing text and certification notes. Jarmo reviewed this distinction and explicitly approved **Submit anyway**.

## Next

1. Await Microsoft's certification decision and inspect any actionable report.
2. Never replace the bytes at the submitted v1.11.0 URL. A changed binary requires a new immutable URL and candidate.
3. After publication, verify Store-origin installation, launch, edit/save, and uninstall, then complete the Store-related Gate 2 evidence.

Partner Center remains the live source of certification status.
