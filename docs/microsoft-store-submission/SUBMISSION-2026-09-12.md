# Microsoft Store submission — 2026-09-12

## Result

Confirmation observed on 2026-09-12 at approximately 12:08 UTC; evidence recorded at 12:09 UTC.

Jarmo explicitly authorized continuing through Submit in this conversation. Codex selected Submit in Partner Center and verified the resulting **In review** status and the confirmation: “Your app submission is complete.” Microsoft displays an SLA of **3 business days** for review. This is submission completion, not certification approval or Store publication.

- Product: Ritemark, EXE/MSI app.
- Partner Center product ID: `3a2a9010-fbe3-47cf-ae87-4d338f587830`.
- Package ID: `23647104`, x64.
- Candidate: v1.10.1 candidate 3.
- URL: `https://getritemark.com/windows/v1.10.1/Ritemark-Setup.exe`.
- SHA-256: `93f9adce13529c727cbb4b407822897f0043d65c62ff5dab0eab95fc54d77250`.
- A fresh HTTPS download streamed through `shasum -a 256` immediately before Submit matched this hash. No installer copy or probe file was left behind.
- Installer parameters: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER`.
- Separate submission ID was not displayed in the confirmation view; do not confuse the product/package IDs or URL `jid` with a submission ID.

## Microsoft package validation

Validation status: **Completed**.

- Malware: package found clean.
- Code signing: valid.
- Silent install, Apps & Features identity, and bundleware checks: automatic identification inconclusive; Microsoft links to manual verification. These were not reported as passed automated checks.
- Manual evidence for the same hash is in `release-candidates/v1.10.1-candidate-3.md`: non-elevated silent installation exit 0, exactly one Ritemark 1.10.1 / Productory Services OÜ Apps & Features entry, silent uninstall, and no unrelated bundleware or undisclosed driver/service.
- Separate clean-machine Windows 11/SAC testing remains pending; existing evidence is from the developer Windows machine. Submission must not be represented as completing that test.

## Submitted draft contents

- English (United Kingdom) listing: saved, **Complete**; four installed-Windows screenshots.
- Correct-size square logo and 2:3 poster art: uploaded by Jarmo, accepted and saved in Partner Center. The original repository 1024px logo was rejected; it is not the final uploaded logo.
- Windows transcription is not advertised.
- Properties: Productivity; generative AI declaration checked; certification notes disclose offline local editing, optional provider credentials, and silent installation parameters.
- Public contact email approved by Jarmo and saved: `info@productory.eu`.
- Website: `https://ritemark.app/en/`.
- Support: `https://ritemark.app/en/support/`.
- Privacy: `https://www.productory.ai/en/privacy/`.
- License terms: `https://www.productory.ai/en/terms/`.
- Availability: Free; discoverable in the Store; 240/240 regions; automatic future-region distribution unchecked.
- IARC terms/adult attestation confirmed by Jarmo and saved; Age ratings **Complete**. Microsoft rating 12+; other rating systems differ.

## Next

1. Await Microsoft's certification decision; inspect any actionable report.
2. Do not replace bytes at the submitted installer URL. A changed binary requires a new immutable URL and candidate.
3. After publication, verify Store-origin installation, launch, edit/save, and uninstall.
4. Reconcile older status documents and the candidate record: their upload/draft/attestation-pending statements predate the live actions recorded here. Preserve the still-pending clean-machine test distinction.

The Partner Center overview remains the live source of certification status.
