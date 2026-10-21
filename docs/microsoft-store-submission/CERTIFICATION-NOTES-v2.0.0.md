# Microsoft Store certification notes — v2.0.0

Draft for Jarmo's approval (Sprint 136, R7). Nothing here has been submitted. Jarmo enters the approved text in Partner Center himself, through his ChatGPT flow.

Candidate URL: `https://getritemark.com/windows/v2.0.0/Ritemark-Setup.exe` (not uploaded yet)  
SHA-256: pending. It comes from the v2.0.0 candidate record after the guarded upload and the anonymous download check.

## Text for Partner Center

Ritemark 2.0.0 is a per-user x64 desktop app, with the same EXE installer type and silent parameters as 1.14.0:

`/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER`

It installs from a standard Windows account, with one Start-menu entry and one Apps/Programs entry.

Basic test:

1. Launch Ritemark from the Start menu.
2. A welcome asks which AI you use: Claude or ChatGPT, each with its own sign-in. Neither is needed; choose Skip for now.
3. Choose Try the sample project, which Ritemark copies into Documents\Ritemark.
4. Open Documents (top left), then Brief.md. Edit it and save (Ctrl+S).
5. Open Tasks to see the task board.

There is no title row: the menu is the button at the start of the left column's strip (or Alt), and window buttons are top right. The terminal is a tab.

Local editing and the task board need no account and work offline. Optional AI features need network access and the user's own provider account or API key; offline, they show an unavailable state.

Anonymous usage data is on by default. Nothing is sent until you leave the welcome with its switch on; turn it off there or in Settings (Ctrl+,). It never carries documents, chats, names or location.

Uninstall from Windows Apps/Programs, or silently with `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`. It removes the install directory, Start-menu group and app registration. There is no non-Microsoft driver, NT service or unrelated bundleware.

Still addressed from the 15 September 2026 report:

- Freemium covers optional third-party AI accounts/subscriptions/API credits; Ritemark sells no in-app subscription.
- “Report AI issue” shows the report before opening email to `info@productory.eu`, stays copyable without a mail handler, and never claims it was sent.
- Without Git, File changes (formerly Source Control) says Git is required and offers no download link.
- English (UK) 2:3 poster art shows only the Windows app.

## What changed from v1.14.0's text

| Part | v1.14.0 | 2.0.0 |
|---|---|---|
| Installer | Silent install parameters | The same parameters, and a sentence saying the EXE type and parameters are unchanged |
| Basic test, steps 2–3 | Open or create a local folder with a Markdown file | The welcome: Skip for now (no AI account needed), then Try the sample project, copied into `Documents\Ritemark\Leadership programme` |
| Basic test, steps 4–5 | Edit and save the `.md` file; Tasks from the activity bar | `Brief.md` from Documents, at the top of the left column; Tasks beside it |
| The window | Not mentioned | No title row: the menu button at the start of the left column's strip, Alt, window buttons at the top right; the terminal is a tab |
| Usage data | Not mentioned | On by default, nothing sent before the welcome is left with the switch on, off on the welcome or in Settings, no documents, chats, names or location |
| Source Control finding | "Source Control" | "File changes (formerly Source Control)". 2.0 names it File changes, in More (⋯) at the end of the places row |
| Dictation and transcription | They download a speech model on first use, and the basic path doesn't need them | Left out to fit the field. Neither is new in 2.0, and the basic test doesn't touch them |
| Package lines | Package URL, SHA-256, architecture, publisher at the end of the text | Left out to fit the field. Partner Center's package entry carries the URL, and the SHA-256 is at the top of this file |

## Operator note

- **Length.** The text measures 1,920 characters, counted from the raw text with line breaks. v1.14.0's saved text was recorded as 1,843 characters, and the same count gives 1,838 for it. This repository doesn't record the field's limit. If Partner Center's counter refuses the text, shorten the window paragraph before cutting the basic test or the usage-data paragraph.
- **The package.** Only the URL changes. Keep x64, EXE, the language, the silent parameters, the installer handling URL and the return codes exactly as [`PARTNER-CENTER-LIVE-DRAFT.md`](./PARTNER-CENTER-LIVE-DRAFT.md) lists them.
- **Privacy and terms URLs.** Keep these exactly as they are, unless the web side changed them for 2.0's usage data (R7):
  - `https://www.productory.ai/en/privacy/`
  - `https://www.productory.ai/en/terms/`
- **The privacy page says the same as the app.** Before Submit, open the privacy page signed out and check that it describes usage data that is on by default, with no location ([`LEGAL-AND-URLS.md`](./LEGAL-AND-URLS.md), step 3). The Development manager confirms these lines with Traffic before publication (R8).
- **Properties.** The privacy answers in Properties were given before usage data was on by default. Read them again against 2.0's behaviour, as [`SUBMISSION-WORKSHEET.md`](./SUBMISSION-WORKSHEET.md) asks under "Personal information/privacy". Change nothing else there.
- **What's new.** Use "What's new in 2.0" in [`LISTING-COPY.md`](./LISTING-COPY.md). It was drafted from the release notes, so it changes if they change.
- **Submit anyway.** Partner Center's Freemium and digital-goods recommendation may appear again. As for v1.14.0, it needs its own confirmation from Jarmo at the time.
- **Evidence.** Claim only the Windows checks that were run against this exact SHA-256 ([`STATUS.md`](./STATUS.md), "Honest evidence boundary").
