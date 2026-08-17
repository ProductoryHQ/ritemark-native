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

## Gate 2 — Jarmo, x64 DMG + Windows installer

Both built from `main` @ `99f19d6`, version read from `branding/product.json`.

| Artifact | Size | State | SHA-256 |
| --- | --- | --- | --- |
| `dist/Ritemark-1.9.0-darwin-x64.dmg` | 629,206,918 | Signed Developer ID, **not notarized** | `255a65a27ad525f4d445806f7d2d3672baa27bdac71f28e3ce40893847deca90` |
| `dist/Ritemark-1.9.0-win32-x64-setup.exe` | 396,596,576 | Authenticode-signed (Azure Trusted Signing) | `8fd87df2d6f3c34375ec874a7935df4772fefec8d66adde69318a42410760d79` |

x64 DMG built 2026-08-17 12:29 — its own 60-minute hardening clock, separate
from arm64's. CI: macOS x64 run `32018123566` (18 min), Windows run
`32018126868` (38 min), both success. Repo returned to public afterwards.

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
