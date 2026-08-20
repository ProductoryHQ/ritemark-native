# v1.9.0 Test Checklist

**Status:** Gate 1 **PASSED** (Jarmo, 2026-08-17) — arm64 notarized and stapled
**Release:** Ritemark v1.9.0 — Transcribe
**Sprint:** 108 — Transcription Workbench ([#202](https://github.com/ProductoryHQ/ritemark-native/pull/202))
**Candidate:** `dist/Ritemark-1.9.0-darwin-arm64.dmg` (582,653,931 bytes)
**SHA-256:** `3b54f0c8c43ca5142e2d1d7818cc1937cc88e0c5521e1572bebd8799780271e5`
— computed **after** stapling, which rewrites the DMG. The pre-staple value
(`7396175885e9…`) is what Gate 1 was tested against; the post-staple value above
is the one the update feed and the GitHub Release must carry.
**DMG built:** 2026-08-15 12:56 · **Gate 1 passed + notarized:** 2026-08-17 12:11
(47 h hardening, against a 60-minute minimum)
**Notarization:** submission `3b0b18d6-4a45-4aa9-a67c-3e911b2fc84e` — Accepted,
stapled, `spctl` reports `source=Notarized Developer ID`

## Automated checks (done before handover)

- [x] `release-preflight.sh` passes — 13/13 patches apply against vanilla VS Code 1.117.0, CI asset parity, signing cert present, no 0-byte sources
- [x] `pre-commit-validator.sh` passes
- [x] Extension type-check clean; host bundles emitted (`extension.js` 5.5 MB, `browserMcpAdapter.js` 9 KB)
- [x] Webview production build clean (8,226,635 bytes)
- [x] All 12 Sprint 108 test suites pass
- [x] Every other suite in the `test` script passes when run individually
- [ ] `npm test` runs to completion — it still aborts at `SaveFileNodeExecutor.integration.test.ts` (needs the `vscode` module, pre-existing since e9a3f9f) and `workspaceConsent.test.ts` (top-level await under CJS, Sprint 107). Neither is a product defect; both are tracked separately
- [x] Built app reports `ritemarkVersion` 1.9.0; bundled extension manifest 1.9.0-0
- [x] Transcribe code present in the shipped bundles (not just in `src/`)
- [x] All bundled Mach-O binaries carry Team ID JKBSC3ZDT5 — including `whisper-cli` and the `libggml*`/`libwhisper` stack Transcribe depends on, and the three agent binaries that ship with foreign Team IDs
- [x] Deep signature verification, hardened runtime, secure timestamp
- [x] DMG signed with Developer ID, timestamped

## Smoke test (done on the signed app, isolated profile)

- [x] App launches from a fresh profile with 0 errors / 0 warnings
- [x] **Transcribe** appears in the Activity Bar
- [x] Panel opens: `TRANSCRIBE` title with the gear on the same row, **Add recording**, supported formats listed
- [x] The `+` glyph on the primary button is white, matching the button text

## Gate 1 — Jarmo, on the installed DMG — **PASSED 2026-08-17**

Jarmo tested the signed, un-notarized arm64 DMG and gave the approval phrase
("tested locally"). The approval was given for the build as a whole; the boxes
below are left unticked because there is no itemized record of which ones he
exercised, and ticking them on his behalf would invent a test record. The gate
is passed — the detail simply was not captured.

### Install

- [ ] DMG mounts, drag-to-Applications works
- [ ] App opens (right-click → Open on first launch, since the tested build was not yet notarized)
- [ ] About reports 1.9.0

### Transcribe — on-device

- [ ] Add an `.m4a` recording; length and cost/privacy trade are shown before anything runs
- [ ] On-device engine transcribes; the transcript says plainly that it cannot separate speakers
- [ ] Progress advances; **Cancel** stops it immediately
- [ ] Close the panel mid-job — the job keeps running and the Activity Bar badge shows the count
- [ ] Quit mid-job, reopen — the recording says **Interrupted**, nothing is silently lost

### Transcribe — ElevenLabs

- [ ] With no key, the engine card says what to do and the gear opens Settings
- [ ] With a key: duration and estimated cost shown, and **nothing uploads** until you confirm
- [ ] Speakers are separated; renaming one renames it in every line
- [ ] Amber marks land on plausible words, not on ordinary ones

### Workbench

- [ ] Click any line — audio plays from there and the line highlights as it goes
- [ ] Waveform seek, playback speed cycling, space / ← / →
- [ ] **Generate insights** returns items whose timestamps play the right moment
- [ ] **Save to document** asks which folder, writes Markdown, opens it in the Ritemark editor
- [ ] Saving again into the same folder offers Replace / Save a copy rather than overwriting silently
- [ ] The saved document stays linked in the workbench header
- [ ] With the workbench open, the AI sidebar treats the transcript — not the audio file — as the active file

### Project scoping

- [ ] Recordings transcribed in one project do not appear in another
- [ ] Move a recording on disk — the row says so and **Find it** relinks it without losing the transcript, renames or insights

### Regression sweep (nothing from 1.8.6 broke)

- [ ] Markdown editing, formatting toolbar, slash commands
- [ ] AI sidebar: Claude Code, Codex, OpenCode all connect and answer
- [ ] Settings opens and API keys save
- [ ] Flows run
- [ ] Export to PDF and Word
- [ ] Browser panel

## ✅ SHIPPED 2026-08-20

Published: https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.9.0

| Artifact | Size | SHA-256 (post-staple) |
| --- | --- | --- |
| `Ritemark-arm64.dmg` | 583,392,434 | `dfda96c95de4e08e2ce4684b9e01e7dba90e5f5879ecd704cea83ecb70e4dab4` |
| `Ritemark-x64.dmg` | 626,896,407 | `d9948d37e984b47f0dab852e866ec8e6d767108a34fa96753ada1c6bcb382367` |
| `Ritemark-Setup.exe` | 396,621,848 | `9b248918c860e93a53e327b19f3359cce7296f8a7761a3d1f69ff9f4d474e8d4` |

Both DMGs notarized and stapled (`e78669d4…` arm64, `8127a3bf…` x64); the
installer is Authenticode-signed via Azure Trusted Signing. The update feed
retains all 18 releases and resolves 1.9.0 for darwin/arm64, darwin/x64 and
win32/x64; all three advertised URLs verified live.

## ⛔ The first set of artifacts was WITHDRAWN (2026-08-17)

Jarmo found, by using the build, that recordings vanished when he opened a
different project. They had not been deleted — the project-scoped library
filtered them out and then rendered the same empty state as a first-time user.
Fixed in `ff32a68`; see the driven-checklist section below for what that cost.

These artifacts all predate the fix and must not be shipped:

| Artifact | State |
| --- | --- |
| `Ritemark-1.9.0-darwin-arm64.dmg` (notarized `3b0b18d6…`) | superseded — rebuild |
| `Ritemark-1.9.0-darwin-x64.dmg` (signed `255a65a2…`) | superseded — rebuild |
| `Ritemark-1.9.0-win32-x64-setup.exe` (signed `8fd87df2…`) | superseded — rebuild |

Gate 1 and Gate 2 both restart. Per the ordering rule, macOS arm64 Gate 1 must
pass before any x64/Windows CI is dispatched again.

## Driven checklist (Claude, on the built app — 2026-08-17)

Run after Jarmo's instruction to test it myself rather than hand over a
smoke-tested build. Prod app for the shipped-bundle checks; dev mode for the
rest, once the prod bundle refused a second instance alongside the installed
copy.

**Verified working**

- [x] Transcript survives closing the window and reopening the same folder
- [x] Cancel stops the job — confirmed the `whisper-cli` process actually exits
- [x] Activity-bar badge shows the running-job count; progress reaches 35%+ with a live percentage
- [x] Undecodable audio produces an honest error rather than an empty transcript (A2's exit-0 trap holds)
- [x] Transcript renders with timestamps, speaker attribution and amber confidence marks
- [x] Click a line → audio seeks there, plays, and the line is marked as it goes
- [x] Waveform click seeks; playback speed cycles 1× → 1.25× → 1.5×
- [x] Speaker rename dialog opens pre-filled and states how many segments it will change
- [x] Insights render with clickable timestamps, owners attributed
- [x] The saved document opens in Ritemark's editor and stays linked in the workbench header ("Save again")
- [x] With the workbench open, the AI sidebar treats the saved transcript as the active file
- [x] The gear in the Transcribe title bar opens Ritemark Settings
- [x] A moved recording shows "Recording moved or deleted" with **Find it**
- [x] **Fix verified**: empty state now reports how many recordings live elsewhere, and the toggle lists them with their project

**Not verified, and why**

- [ ] Interrupted-job recovery — the app would not start a second instance alongside the installed 1.9.0, and dev mode stopped yielding a debug target before this could be re-run
- [ ] Save-to-document folder picker — native dialog, not drivable here
- [ ] Settings' transcript storage size / clear row — Settings opened, but the page did not scroll to that row
- [ ] Keyboard control (space, ←, →)
- [ ] The final cosmetic tweak moving the project label to its own line — type-checks and is present in the built bundle, not seen rendered

### macOS x64 (Intel)

- [ ] DMG mounts and installs; right-click → Open on first launch (not notarized yet)
- [ ] About reports 1.9.0
- [ ] Transcribe via ElevenLabs works end to end
- [ ] The on-device card explains itself rather than failing oddly — see [#203](https://github.com/ProductoryHQ/ritemark-native/issues/203): no x64 whisper binary ships, so it currently reads "missing from this build"
- [ ] Editing, AI sidebar, Settings, export — no Intel-specific breakage

### Windows

- [ ] Installer runs; no unsigned-publisher warning (Authenticode signing ran in CI)
- [ ] Smart App Control / SmartScreen behaviour noted — reputation is earned over time, signing alone does not clear it ([#130](https://github.com/ProductoryHQ/ritemark-native/issues/130))
- [ ] About reports 1.9.0
- [ ] Transcribe: ElevenLabs works; the on-device card says it is not available on Windows yet ([#133](https://github.com/ProductoryHQ/ritemark-native/issues/133))
- [ ] Save to document writes and opens correctly on Windows paths
- [ ] Editing, AI sidebar, Settings, export

## Known not exercised

These are stated rather than quietly omitted:

- **Windows end-to-end on real hardware.** Verified by simulation only. ElevenLabs is plain HTTP and the on-device card says it is macOS-only ([#133](https://github.com/ProductoryHQ/ritemark-native/issues/133))
- **Live offline / quota-exceeded / invalid-key responses** from ElevenLabs — unit-tested, never provoked against the real API
- **Disk-space exhaustion** during transcription
- **`.ogg` input** — accepted by the format gate, never run end to end
- **ElevenLabs confidence-threshold tuning** — the 0.55 threshold and 4-character minimum were measured on Whisper output, not on Scribe's
