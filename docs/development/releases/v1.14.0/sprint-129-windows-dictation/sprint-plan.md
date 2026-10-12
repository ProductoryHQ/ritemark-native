# Sprint 129 — Windows Dictation (on-device Whisper on Windows)

Track: SDD (auto-detected: cross-platform path handling, webview ↔ host ↔ external binary flow, three linked issues)<br>
Release tier: shell (new native binaries under `extensions/ritemark/binaries/win32-x64/` and `darwin-x64/`, and `.github/workflows/build-whisper.yml`)<br>
**Status:** Phase 3 (DEVELOP), starting with the Phase 0 audits. Plan approved by Jarmo on 2026-10-11.<br>
**Branch after approval:** `sprint-129-windows-dictation`, cut from this worktree's tip, which must be `origin/main` plus the plan commit only (`git log origin/main..HEAD` shows one commit; rebase onto the then-current `origin/main` first)<br>
**Worktree:** `.claude/worktrees/vibrant-lewin-74cd1d` (plan only; the sprint branch is cut from `main` after approval)<br>
**Release:** [v1.14.0](../release-plan.md) (milestone 13). v1.13.0 published on 2026-10-11; merging needs Jarmo's admin-merge yes for the PR by number.

## SDD Artifacts

- [spec.md](./spec.md): behaviour contract R1–R14
- [scenarios.md](./scenarios.md): manual QA matrix, by stage
- [technical-plan.md](./technical-plan.md): workstreams W0–W14
- [tasks.md](./tasks.md): implementation tracker
- [research/current-state-audit.md](./research/current-state-audit.md): what ships today, with file and line references
- [sprint-plan.md](./sprint-plan.md): this file (intent, decisions, status)

## Goal

Windows users can dictate into documents and transcribe recordings on their own computer, privately, as Apple silicon Mac users already can. When something stands in the way, Ritemark says what to do in plain words.

## Linked Issues

- [#133](https://github.com/ProductoryHQ/ritemark-native/issues/133) Windows voice dictation (the sprint's reason)
- [#203](https://github.com/ProductoryHQ/ritemark-native/issues/203) No Intel Mac whisper binary (proposed ride-along, same pipeline)
- [#117](https://github.com/ProductoryHQ/ritemark-native/issues/117) Dictation pipeline modernization (closed; only its "dropped audio" finding is taken, as R8)

## What changes for users

- **Windows:** the microphone button appears in the editor header. Dictation works as "speak, then text": the user talks, presses Stop, and the text arrives about 20 s later (R12). The first click offers a 0.8 GB voice model, the 8-bit version of the Mac's (R13). Transcribe's On-device · Whisper engine works for MP3, WAV, FLAC, OGG and Record files.
- **Windows microphone blocked:** a dialog names the exact Windows switches (**Microphone access**, **Let desktop apps access your microphone**) and has an **Open Microphone Settings** button.
- **Intel Mac** (if approved): the same on-device dictation and transcription. Today the mic button downloads 1.5 GB and then never inserts text (code reading, §4 of the audit).
- **Every platform:** dictation no longer drops speech when transcription runs behind; the words arrive a little later instead. Ritemark never offers the download on a computer where the engine cannot start.

## How it works (short)

1. **Where the binary comes from:** a new CI workflow builds whisper.cpp **v1.8.3**, the version already shipped on Apple silicon, for win32-x64 (and darwin-x64), from the pinned upstream commit. The output is committed to `extensions/ritemark/binaries/<target>/`, as the Apple silicon binary already is, and recorded with SHA-256 in `binaries/whisper-manifest.json`. Release builds do not compile whisper. We do not redistribute upstream's prebuilt Windows zip because its CPU baseline and C runtime dependency are not ours to control.
2. **Windows build choices:** the CPU code is picked at run time, so older processors do not crash. No Visual C++ Redistributable is needed. A UTF-8 manifest lets user folders with any characters work. The CI contract test proves each point on a real runner.
3. **Bundling:** `copy-extension-for-target.mjs` already copies only the matching platform's folder. A new check in `validate-build-output.sh` fails the release build if the engine is missing or changed.
4. **Stripping (patch 008):** not involved. Patch 008 strips foreign binaries from the bundled Copilot and Agent SDK packages; our folders are filtered per target already, and MSVC keeps debug symbols in `.pdb` files we do not ship. No VS Code patch, no submodule change.
5. **Signing:** the Windows release workflow already signs **every** unsigned `.exe`/`.dll` it finds with Productory's Azure certificate and verifies each one. macOS `codesign-app.sh` already signs files named `whisper-cli` and every `.dylib`. No signing script changes.
6. **In the app:** one function finds the engine for both dictation and Transcribe and tests it once before anything is downloaded. Engine and microphone failures map to plain-language messages. `voice-dictation` gains `win32` in its platform list.

## Product Decisions

- **2026-10-11 (Jarmo):** "approved, no Intel Mac — use the CI runner". The plan and the five decisions below stand. Intel Mac evidence is the contract test on the `macos-15-intel` runner; Gate 2 has no Intel Mac hands-on, and the release report says so.

- **2026-10-12 (Jarmo, relayed by the Development manager):** "1. jah mõõda kõiki 2. jah võta sisse".
  - **Windows speed: measure every candidate** before choosing. The candidates are Whisper large-v3-turbo q8_0; NVIDIA Parakeet TDT 0.6B v3 (int8, via sherpa-onnx); TalTech's Estonian–English streaming Zipformer (sherpa-onnx); and TalTech's Estonian-tuned Whisper (`whisper-large-v3-turbo-et-verbatim-2604`, official GGML, MIT). Accuracy (WER on FLEURS Estonian) is scored on the Mac, because it does not depend on the computer; speed is measured on the Windows PC (bench round 2). Adopting a non-Whisper engine would add a runtime, so that stays a separate decision.
  - **Apple silicon engine for macOS 12–14 is in scope**, as R11.
- **2026-10-12 (Jarmo, in the "Ritemark on Windows" session, relayed by the Development manager):** "parakeeti pole mõtet (kehv kvaliteet), zipformerit pole mõtet (ainult ET ja EN ei sobi), sherpa-onnx - ma olen kahevahel, miks seda veel?" Then, after the explanation that sherpa-onnx is only those two models' runtime: "tee".
  - Parakeet (poor Estonian) and the TalTech Zipformer (Estonian and English only) are out, so no sherpa-onnx runtime is needed.
  - Bench round 2 runs Whisper large-v3-turbo q8_0 against f16 only.
  - TalTech's Estonian-tuned Whisper (11.4% WER) was not part of this cut and stays open as an accuracy option.
- **2026-10-12 (Jarmo, in the "Ritemark on Windows" session, relayed by the Development manager), answering ship-or-hold:** "mõõda lühema akna ja mällu jääva mudeliga. 2 - väiksem mudel vaid siis kui kvaliteet ei kannata. 3 - kui saab siis jah..."
  1. **Measure the shorter window with the model kept in memory** (round 3, on the Windows PC): fixed 5 s and 10 s chunks cut the way dictation cuts them, all through one whisper-cli process.
  2. **q8_0 only if quality does not suffer.**
  3. **GPU on Windows: "if it can be done, yes".** A Vulkan build (config VK) is added to `build-whisper.yml` for measuring. Before it goes into the product, Jarmo gets what it changes: download size, the GPU-driver dependency (`vulkan-1.dll`), and the CPU fallback.
- **2026-10-12 (Jarmo, in the "Ritemark on Windows" session, relayed by the Development manager), after round 3:** "1. Nõus! 2. ok 3. ok 4. unustame selle graafikaardi testi hetkel".
  1. **Windows dictation is "speak, then text"** (R12). The user records and presses Stop; Ritemark then transcribes with the full 30 s window (~14% WER on his laptop). The wait is about 20 s for a short phrase. The UI says it is processing and does not suggest live text. The shorter window (`--audio-ctx`) does not ship.
  2. **q8_0 is the default model on Windows** (R13).
  3. **Cutting at pauses (VAD) is separate work for every platform**: [#411](https://github.com/ProductoryHQ/ritemark-native/issues/411). whisper-cli 1.8.3 already has `--vad`, `--vad-model` and `--vad-max-speech-duration-s`.
  4. **No GPU in v1.14.0.** The GPU round does not run; this replaces his earlier "if it can be done, yes". Config VK stays in `build-whisper.yml` as a harness option, built only on request (W12); nothing Vulkan ships.
  - **How R12 does the work (engineering, told to Jarmo):** the audio is transcribed in the background in pieces of up to 28 s while the user is still talking, and the text is held until Stop. A long dictation then waits ~20 s after Stop instead of about as long as it lasted. Accuracy is the same within measurement noise (17.5% against 16.6% WER on 255 s of continuous Estonian; 3 words in 338). The user sees exactly "record, press Stop, then the text".
- **2026-10-12 (the Development manager, answering on Jarmo's delegation: "those tiny end questions ask your dev manager to answer"):** not gates.
  - **Wording:** kept as built, including "Click to cancel." on the start-up tooltip. Revisit if the Windows test finds wording that reads wrong.
  - **Intel Macs follow Windows:** "speak, then text" and the q8_0 model (R12, R13). They are CPU-only and slower than Jarmo's laptop.
  - **Background pieces accepted:** transcribe in pieces of up to 28 s while the user talks, holding the text until Stop.
- **2026-10-12, after the Windows branch test (the Development manager, on Jarmo's delegation):** fix bugs A–D in this sprint (R14).
  - Remove stays under Dictation Settings → Model.
  - The missing-engine wording stays as built.
  - The note may sit inside a heading: it goes where the caret is, like typing.
  - MP3 Transcribe, cancelling a transcription and the fixes go to a Windows re-test. The two-minute recording on a busy CPU and "microphone in use" move to the v1.14.0 Gate 2 list.
- **2026-10-12 (Jarmo, relayed):** "kui nupp on aktiivne st dictation käib siis peaks olema nupul tekst: Transcribe now, mitte enam Estonian".
  - While recording, the button reads **Transcribe now** ("speak, then text"), then **Transcribing…** while processing; the tooltip keeps the language.
  - Live mode on Apple silicon (Claude's choice): **Stop**, then **Finishing…**. "Transcribe now" would be wrong there, because the text is already appearing.

Proposed 2026-10-11 and approved with the plan:

- **Intel Mac binary (#203) rides along.** It is one more CI job on the existing `macos-15-intel` runner, and the existing signing rules already cover it. Without it, the Intel Mac dictation defect needs its own fix anyway. Declining it still leaves Intel Macs with an honest "needs Apple silicon" message (R3/R6).
- **Dictation stops dropping speech when busy (R8)**, on Mac too. It matters most on Windows, where transcription runs on the CPU only.
- **Binaries are committed to git** like the Apple silicon one (about 5–15 MB more in history), rather than fetched at build time. That keeps the three release pipelines unchanged and the product bytes in the source commit (D1).
- **Model stays in `~/.ritemark/models`** on Windows too, where Ritemark already keeps its per-user data. No migration.
- **No Windows GPU acceleration in this sprint.** If the speed measurement on Jarmo's machine misses the target after the three pre-approved settings (threads, beam size, chunk length), I stop and bring him the numbers before adding anything bigger.

## Open decisions for Jarmo (raised 2026-10-11, after approval)

- ~~Apple silicon engine for macOS 12–14~~: approved 2026-10-12, now R11.
- ~~Windows dictation: ship or hold~~: decided 2026-10-12, "speak, then text" (R12), q8_0 (R13), no GPU. History: [research/windows-performance-audit.md](./research/windows-performance-audit.md).
- ~~Intel Macs~~: decided 2026-10-12 by the Development manager on Jarmo's delegation: they follow Windows (R12, R13).
- ~~"Speak, then text" wording~~: decided 2026-10-12 by the Development manager on Jarmo's delegation: kept as built.

## Feature Flag Check

- [x] No new flag. `voice-dictation` (stable, default on) gains `win32`; the on-device engine's own platform list gains `win32` too. Kill switches stay code-level: drop `win32` from the list, or set `status: 'disabled'`. No code is removed.

## Success Criteria

- [ ] Windows: dictation in Estonian and English inserts text in order, with no missing sentences, on Jarmo's machine (branch test and signed RC).
- [ ] Windows: on-device Transcribe completes a 10-minute MP3 and a Record file; m4a gets the honest ElevenLabs message.
- [ ] Windows: every microphone problem state shows the plain-language dialog, and **Open Microphone Settings** opens the right page.
- [ ] No download is offered where the engine cannot start; engine failures stop dictation with a reason.
- [ ] Whisper files in the signed Windows installer carry Productory's timestamped signature; the release build fails if they are missing or changed.
- [ ] CI contract test is green for win32-x64, darwin-x64 and the committed darwin-arm64 binary, including the Unicode-folder case.
- [ ] Apple silicon dictation and Transcribe on-device behave as in v1.13.0, apart from no longer dropping speech.
- [ ] Intel Mac: binary signed and notarized, contract test green on `macos-15-intel` (no hands-on: no Intel Mac available).
- [ ] User docs, architecture doc, tier lists, changelog and release notes updated.

## How Windows gets verified (Jarmo tests)

`build-windows.yml` builds only the exact `main` commit, so a sprint branch cannot produce a Windows installer. Three stages, each one command on his machine:

1. **Speed bench** (Phase 0): `windows-whisper-bench.ps1` runs the CI-built engine on fixed samples and prints a table. About 10 minutes, plus the 1.5 GB model if it is not already on the machine. Jarmo pastes the output back.
2. **Branch test** (Phase 5): `windows-branch-test.ps1` starts his **installed** Ritemark with a separate profile and a test copy of the branch's extension (same method as our macOS production-shell test). The installed app is not modified. He walks the scenarios marked **B**, including turning the Windows microphone switch off.
3. **Gate 2 of v1.14.0:** the signed installer, signature check, the scenarios marked **C**, and the Smart App Control state noted.

## Risks

| Risk | Mitigation |
|---|---|
| CPU-only transcription too slow for comfortable dictation on Windows | A2 measures first; three pre-approved settings; R8 guarantees no lost words; GPU only with Jarmo's decision |
| Older or low-end processors | Runtime CPU variants (Config V); otherwise a plain "needs a newer processor" message |
| Missing VC++ runtime pops a Windows error dialog | Runtime ships beside the exe or is linked statically; CI dependency check |
| Non-ASCII user folders break file paths | UTF-8 code-page manifest; CI Unicode-folder test |
| Smart App Control or antivirus blocks the new exe | Signed with the same identity as `Ritemark.exe`; `blocked` state explained; SAC hands-on only if a machine has it On |
| No pre-merge Windows installer | Branch test inside the installed app; full signed check at Gate 2 |
| `main` frozen, and `workflow_dispatch` needs the workflow on `main` | The workflow also triggers on the sprint PR |

## Pre-Implementation Gate

Conformance check by `sprint-manager` on 2026-10-11 (sprint number, template, R-ID traceability, gates); its fixes are applied. Implementation starts only after Jarmo's approval, beginning with the A1–A3 audits (Phase 0). A stop condition in W6 brings the speed numbers back to Jarmo before Phase 2.

## Status

**Track:** SDD · **Current phase:** 3 (DEVELOP), Phase 0 audits · **Branch:** `sprint-129-windows-dictation`

## Approval

- [x] Jarmo approved this sprint plan (and the Product Decisions above), 2026-10-11
