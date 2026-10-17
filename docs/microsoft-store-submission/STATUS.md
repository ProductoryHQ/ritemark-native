# Microsoft Store status

Last updated: **2026-10-17**

## High-level status

**Ritemark is live in Microsoft Store. The v1.14.0 candidate 2 update was submitted on 2026-10-17 at approximately 15:00 EEST, and Partner Center now reports `Update in review`.**

- Partner Center product ID: `3a2a9010-fbe3-47cf-ae87-4d338f587830`.
- Store ID: `XP9K8SP24TRNK4`.
- Existing package ID: `23647104`, x64.
- Live Store page: `https://apps.microsoft.com/store/detail/XP9K8SP24TRNK4`.
- The update draft now points to the immutable v1.14.0 candidate URL.
- Target candidate: [v1.14.0 candidate 2](./release-candidates/v1.14.0-candidate-2.md).
- Target URL: `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`.
- Target SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`.
- Submission result: `Update in review`.

This file is a dated snapshot. Partner Center remains the live source of submission, validation, certification, and publication state.

## Completed foundations

- [x] Productory company developer account is active and Partner Center is accessible.
- [x] Ritemark is live in Microsoft Store as an EXE app.
- [x] English (United Kingdom) listing, availability, properties, age rating, and media were accepted for the live app.
- [x] Public support email is `info@productory.eu`.
- [x] Product, support, privacy, and terms URLs are established.
- [x] Existing privacy and terms URLs are frozen for this package update:
  - `https://www.productory.ai/en/privacy/`
  - `https://www.productory.ai/en/terms/`
- [x] Cloudflare R2 delivery uses direct HTTPS and an indefinite `windows/` object lock.
- [x] The uploader uses `If-None-Match: *`, Content-MD5, exact size/SHA checks, and an anonymous post-upload verification stream.
- [x] v1.14.0 is publicly released on GitHub.
- [x] The downloaded release installer matches Windows CI: `475059168` bytes and SHA-256 `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`.
- [x] The v1.14.0 public Store-host destination was unused (`404`) before upload.
- [x] The exact release installer is now published at the versioned v1.14.0 URL.
- [x] Anonymous verification returned HTTP `200`, zero redirects, the expected headers and length, no cookie, and the approved SHA-256.
- [x] A second guarded `plan` refused the now-existing URL before any upload attempt.
- [x] Windows CI standard-user install/uninstall round trip passes for this SHA-256.

## v1.14.0 update checklist

### Hosting

- [x] Upload the exact release installer to `windows/v1.14.0/Ritemark-Setup.exe` through the guarded interactive uploader.
- [x] Verify HTTP `200`, zero redirects, valid TLS, no `Location` or `Set-Cookie`, PE content type, and `Content-Length: 475059168`.
- [x] Stream a fresh anonymous download and verify the full SHA-256.
- [x] Run a second `plan` and confirm the existing key is refused.

### Partner Center

- [x] Replace only the package URL with the immutable v1.14.0 URL; preserve x64, EXE, language, silent parameters, handling URL, and return codes.
- [x] Save the package draft and start package validation again (initiated 2026-10-16).
- [x] Update **What's new in this version** with the approved v1.14.0 summary.
- [x] Update certification notes using [`CERTIFICATION-NOTES-v1.14.0.md`](./CERTIFICATION-NOTES-v1.14.0.md).
- [x] Confirm Availability, Properties, Age ratings, Store listing, and assets retain their accepted values (fresh read-only review 2026-10-17).
- [x] Do not change privacy or terms URLs.
- [x] Review validation results without converting inconclusive automated checks into claimed passes (2026-10-17): malware clean; code sign valid; silent install, add/remove-programs entry, and bundleware identification inconclusive.

### Submit boundary

- [x] Repository QA passes for these documentation changes (`./scripts/validate-qa.sh`, Node 22.22.1, rerun 2026-10-17 after recording validation and fresh-host evidence).
- [x] Recheck the public URL and fresh-download SHA-256 immediately before Submit (`475059168` bytes; exact approved SHA-256; 2026-10-17).
- [x] Obtain Jarmo's explicit action-time approval for the exact v1.14.0 URL and full SHA-256 (2026-10-17).
- [x] Obtain a separate action-time confirmation before accepting Partner Center's **Submit anyway** warning about the inherited Freemium pricing and digital-goods age-rating answer (2026-10-17).
- [x] Submit the exact candidate and record the result: `Update in review`, approximately 2026-10-17 15:00 EEST.
- [ ] After certification/publication, verify Store-origin install, launch, edit/save, and uninstall.

## Honest evidence boundary

The v1.14.0 release closeout records that all Windows checks the session could run passed against this exact installer. Live voice, Codex, OpenCode, network-off, and Google consent were not run in that Gate 2 session. Smart App Control On is not recorded for this exact candidate. Microsoft does not require a separate SAC or Defender evidence upload by default, but the repository must not claim those checks passed when they did not.

## Immediate next actions

1. Monitor Microsoft certification for completion or a request for action.
2. After publication, verify the Store page and Store-origin install, launch, edit/save, and uninstall.

Never replace or delete any published Store installer object. A rebuilt installer requires a new versioned URL and a new candidate record.
