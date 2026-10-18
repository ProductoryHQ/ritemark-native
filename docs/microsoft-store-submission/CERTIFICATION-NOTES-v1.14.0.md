# Microsoft Store certification notes — v1.14.0

Candidate URL: `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`  
SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`

## Text for Partner Center

Ritemark 1.14.0 is a per-user x64 desktop app.

Silent install:

`/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER`

Install works from a standard Windows account and creates one Start-menu entry and one Windows Apps/Programs entry.

Basic test:

1. Launch Ritemark from the Start menu.
2. Open or create a local folder containing a Markdown file.
3. Edit and save the `.md` file.
4. Open Tasks from the activity bar to view the project task board.

Local editing and the task board require no account and work offline. Optional AI/provider features require network access and user-configured provider access. Offline network features should show an unavailable/error state, not crash.

Uninstall through Windows Apps/Programs, or silently with:

`/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`

Uninstall removes the install directory, Start-menu group and app registration. There is no non-Microsoft driver, NT service or unrelated bundleware.

Windows voice dictation and on-device transcription download a speech model on first use. They are not required for the basic certification path.

The four findings from the 15 September 2026 report remain addressed:

- Freemium covers optional third-party AI accounts/subscriptions/API credits; Ritemark sells no in-app subscription.
- “Report AI issue” shows the report before opening email to `info@productory.eu`. Without a mail handler, the address and report stay visible and copyable; Ritemark does not claim it was sent.
- When Git is absent, Source Control only explains that Git is required and offers no download link.
- English (UK) 2:3 poster art shows only the Windows app.

Package: `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`  
SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`  
Architecture: x64  
Publisher: Productory Services OÜ

## Operator note

This exact 1,843-character text was saved in Partner Center on 2026-10-16 after the hosted URL passed the fresh anonymous hash check. Preserve the existing privacy and terms URLs exactly:

- `https://www.productory.ai/en/privacy/`
- `https://www.productory.ai/en/terms/`
