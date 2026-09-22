# Ritemark 1.12.0 Test Checklist

> **Draft.** No candidate has been built. Each v1.12.0 sprint adds its rows when it closes; the release manager adds the candidate, automated-check and mounted-DMG sections when a candidate exists. Sprints 118 and 119 are written; 120 and 122–125 have not started.

Release: Publish to Google Docs + Everyday UX ([release plan](../../development/releases/v1.12.0/release-plan.md)).

**Shell-tier:** Sprint 119 changed `scripts/build-prod.sh`, `scripts/build-prod-windows.sh` and the build workflows, which compile the Google OAuth client in at build time. So this is a full app rebuild: Gate 1, Gate 2, notarization and the 60-minute hardening wait.

## What is new, and therefore what has to be exercised

| Sprint | Change | Where it is tested |
|---|---|---|
| 119 | Publish to Google Docs (Create, Sync, templates, one narrow permission); Ritemark's own privacy policy and terms links; relative-image and Export-menu keyboard fixes | Gate 1, and **Gate 2 for the first native Windows run of the loopback OAuth flow** |
| 118 | Record in Transcribe: microphone capture into a WAV in the project, recovery after an interruption, tooltips on every Transcribe button | Gate 1, and **Gate 2 for the first native Windows capture**. The dev build could not prove macOS permission under the real bundle ID |
| 120, 122–125 | _Not started_ | — |

## Automated checks (before handover)

_To be filled for the candidate: `validate-qa.sh`, preflight, `build-prod.sh`, byte-identical `media/webview.js`, provenance, `ritemarkVersion` 1.12.0._

- [ ] `scripts/check-google-oauth-build.mjs` passes on the built extension for every platform (the client ID and secret compiled in from the CI secrets or `~/.config/ritemark/release.env`)

## ⛔ Gate 1 — Jarmo, on the installed arm64 DMG (un-notarized)

Gatekeeper will warn: right-click → **Open**, or `xattr -dr com.apple.quarantine '/Applications/Ritemark.app'`.

### Publish to Google Docs (Sprint 119)

- [ ] Settings → **Google Docs** → Connect: Google's consent screen names **Ritemark**, asks for one permission, and the card shows the account afterwards
- [ ] **Export → Create Google Doc** on a document with headings, a list, a table, a link, code and a local image: the Doc opens in the browser with all of them
- [ ] Edit the Markdown → **Export → Sync Google Doc**: the same Doc (same link) updates. The first Sync asks before overwriting
- [ ] Edit the Doc in Google Docs, then Sync: Ritemark warns that the Doc changed, with **Open Google Doc**
- [ ] Sync with no changes says so and writes nothing
- [ ] A template picked in Settings is used for the next Create, and Sync keeps its look
- [ ] Disconnect revokes access and leaves the Docs in Drive
- [ ] The analytics consent and AI information links open ritemark.app's privacy policy and terms

### Record in Transcribe (Sprint 118)

- [ ] On a profile that has never recorded, the first **Record** makes macOS ask for microphone access **for Ritemark**. The panel shows "Waiting for microphone permission…" with Cancel until you answer
- [ ] Speak for about 30 seconds, then **Stop and use**. The engine-choice card shows the file and its length, and nothing starts by itself
- [ ] The file is in `recordings/` in the open folder, named `Recording YYYY-MM-DD HH.MM.wav`. It plays in Finder / QuickLook, and your voice is clearly audible. The capture has no automatic gain: say if it is too quiet
- [ ] Transcribe it on-device: the transcript matches what you said
- [ ] Record again, then **Cancel** after more than 5 seconds: it asks first, and **Discard** puts the file in the Trash
- [ ] Record, then quit Ritemark (⌘Q) mid-recording and reopen it: **Recording interrupted** is offered, and **Save recording** gives a playable file in the engine-choice card
- [ ] With no folder open (File → Close Folder), the first Record asks where to save before recording; the next one does not ask, and **Change** changes it
- [ ] Deny microphone access in System Settings → Privacy & Security → Microphone, then Record: the panel says access is denied, and **Microphone Settings** opens that page
- [ ] Hover over Record, Add recording, and the recording card buttons: each shows a tooltip. A disabled Record says why

### Regression sweep

- [ ] Add recording, the library, the Transcript Workbench and Insights work as in v1.11.0
- [ ] Typing at speed, task lists, undo/redo, and saving without conflict warnings

**Gate 1 verdict:** _pending_

## ⛔ Gate 2 — Jarmo, on the x64 DMG (un-notarized) + Windows installer

### macOS x64 (Intel)

- [ ] Google Docs Connect, Create and Sync work
- [ ] Record → Stop and use gives a playable file. On-device transcription is not available on Intel; the engine card says so, and ElevenLabs is offered if a key is set

### Windows

- [ ] Installer signed by `Productory Services OÜ`; standard-user install and clean uninstall
- [ ] **Google Docs Connect** completes in the browser and returns to Ritemark. This is the first native Windows run of the loopback OAuth flow. Then Create and Sync
- [ ] **Record**: Windows asks for microphone access, a short recording with speech is saved to `recordings\` and plays back, and it reaches the engine-choice card. This is the first native Windows capture
- [ ] With the microphone blocked in Settings → Privacy & security → Microphone, Record explains it, and **Microphone Settings** opens that page
- [ ] Quit mid-recording and reopen: **Recording interrupted** is offered and saves a playable file

**Gate 2 verdict:** _pending_

## Not verifiable before the gates

- macOS microphone permission under the real bundle ID. The dev build's permission belongs to a different app identity (Sprint 118 Phase 0, S6), so only the signed build proves the prompt names Ritemark.
- Windows capture and the Windows Google OAuth loopback. Neither has run natively.
- Level of real speech across machines. The capture is deliberately unprocessed; one dev-build test with a MacBook microphone peaked around −19 dBFS.
