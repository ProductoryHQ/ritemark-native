# Ritemark 1.12.0 Test Checklist

> **Draft.** No candidate has been built. Each v1.12.0 sprint adds its rows when it closes; the release manager adds the candidate, automated-check and mounted-DMG sections when a candidate exists. Sprints 118 and 119 are written; 120 and 122–125 have not started.

Release: Publish to Google Docs + Everyday UX ([release plan](../../development/releases/v1.12.0/release-plan.md)).

**Shell-tier:** Sprint 119 changed `scripts/build-prod.sh`, `scripts/build-prod-windows.sh` and the build workflows, which compile the Google OAuth client in at build time. So this is a full app rebuild: Gate 1, Gate 2, notarization and the 60-minute hardening wait.

## What is new, and therefore what has to be exercised

| Sprint | Change | Where it is tested |
|---|---|---|
| 119 | Publish to Google Docs (Create, Sync, templates, one narrow permission); Ritemark's own privacy policy and terms links; relative-image and Export-menu keyboard fixes | Gate 1, and **Gate 2 for the first native Windows run of the loopback OAuth flow** |
| 118 | Record in Transcribe: microphone capture into a WAV in the project, recovery after an interruption, tooltips on every Transcribe button | Gate 1, and **Gate 2 for the first native Windows capture**. The dev build could not prove macOS permission under the real bundle ID |
| 120 | A typed number only starts a numbered list up to 99, so a year such as `2026. ` stays a sentence | Gate 1 |
| 122 | Agent Chat names the current conversation (⋮ menu: rename, pin, delete); the composer grows and its top edge drags to any height; every chat link opens, reveals, locates or explains | Gate 1 |
| 123 | Transcript search (count, next/previous, highlights, Back to playing line) and a tab row that shrinks to fit | Gate 1, and **Gate 2 for the Windows tab row** |
| 127 | Claude Code 2.1.281 with Opus 5.5; the Claude model list follows the sign-in method; a model that is not available is named instead of swapped silently | Gate 1 (Max subscription), and **Gate 2 for the new Claude Code on x64 and Windows** |
| 124–125 | _Not started_ | — |

## Automated checks (before handover)

_To be filled for the candidate: `validate-qa.sh`, preflight, `build-prod.sh`, byte-identical `media/webview.js`, provenance, `ritemarkVersion` 1.12.0._

- [ ] `scripts/check-google-oauth-build.mjs` passes on the built extension for every platform (the client ID and secret compiled in from the CI secrets or `~/.config/ritemark/release.env`)
- [ ] `(cd extensions/ritemark && npm run check:anthropic-models)` passes on the release source (Sprint 127 R10)
- [ ] `./scripts/verify-agent-runtimes.sh` passes on the release Mac for Claude Code 2.1.281, and the runtime matrix gets its **Last verified** line (release-manager Step 2b)

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

### A typed number and a numbered list (Sprint 120)

- [ ] Type `2026. ` at the start of a paragraph and keep writing: it stays a sentence, and after save + reopen it is still a sentence
- [ ] Type `1. ` and `5. ` at the start of a paragraph: both still start a numbered list, and Enter continues it
- [ ] Type `100. ` at the start of a paragraph: it stays a sentence (99 is the last number that converts)
- [ ] Open a file that already contains a list starting at a high number (for example `2026. item`): it still opens as a list

### Agent Chat clarity (Sprint 122)

- [ ] Start a conversation: the header above the transcript shows its title; **⋮ → Rename** changes it there and in History
- [ ] **⋮ → Pin** pins it (the rail shows the pin); the menu then says **Unpin**
- [ ] **⋮ → Delete** asks first, with the same dialog as History
- [ ] Write a long prompt: the composer grows to about eight lines, then scrolls. Drag the handle on its top edge up and down: the box follows, goes past eight lines, and keeps that height after sending; double-click the handle and it fits the text again
- [ ] Zoom to 200 % (View → Zoom In) and write a long prompt: Send and the model control stay visible
- [ ] Ask the agent for links to a file and a folder in the project, a missing file, a web page and a `mailto:` address: the file opens, the folder is selected in the project tree, the missing file is named, the web page opens in the browser, the `mailto:` link explains itself and offers **Copy link**
- [ ] Right-click each of those links: the menu fits the destination; **Copy path** puts the path on the clipboard

### Findability (Sprint 123)

- [ ] Open a long transcript and press Cmd+F: the search field takes focus; type a word and see "1 of N" with the match highlighted
- [ ] Enter / Shift+Enter and the arrows move between matches, wrapping at the ends; a word marked as uncertain is found and keeps its marking
- [ ] Play the recording and search: the transcript stops following; **Back to playing line** returns to the playing line and following resumes
- [ ] Scroll the transcript with the mouse wheel while it plays: **Back to playing line** appears
- [ ] A word that is not there shows "No matches"; Escape clears the field
- [ ] Open eight or more files with long names: the tab row fits without scrolling sideways; hovering a tab shows its full name

### Claude Opus 5.5 and the model list (Sprint 127)

Full scenario matrix: `docs/development/releases/v1.12.0/sprint-127-day-zero-models/tasks.md` Phases 7 and 8.

- [ ] Settings shows the bundled Claude Code as 2.1.281
- [ ] Signed in with a Claude subscription (Max), the model menu lists **Opus 5.5**. Choose it and send a prompt: the reply arrives, and the conversation runs on Opus 5.5 (S35)
- [ ] A conversation that had **Opus** chosen before the update continues on Opus 5.5 with no substitution line
- [ ] Also save an API key in Settings while signed in with the subscription: the menu still follows the subscription (S7)
- [ ] Sign in with an API key only: the menu lists the models the key can use (S8)
- [ ] Choose a model the account cannot use (for example, one outside the plan): the error names the model and points to the model menu, and the conversation stays open (S29)

### Regression sweep

- [ ] Add recording, the library, the Transcript Workbench and Insights work as in v1.11.0
- [ ] Typing at speed, task lists, undo/redo, and saving without conflict warnings

**Gate 1 verdict:** _pending_

## ⛔ Gate 2 — Jarmo, on the x64 DMG (un-notarized) + Windows installer

### macOS x64 (Intel)

- [ ] A Claude Code chat on **Opus 5.5** replies (bundled Claude Code 2.1.281; Sprint 127)

- [ ] Google Docs Connect, Create and Sync work
- [ ] Record → Stop and use gives a playable file. On-device transcription is not available on Intel; the engine card says so, and ElevenLabs is offered if a key is set

### Windows

- [ ] With many files open, the tab row shrinks to fit and hovering a tab shows its full name (Sprint 123)
- [ ] A Claude Code chat on **Opus 5.5** replies (bundled Claude Code 2.1.281; Sprint 127)

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
