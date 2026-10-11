# Sprint 129 — Windows Dictation (on-device Whisper on Windows)

Track: SDD (auto-detected: cross-platform path handling, webview ↔ host ↔ external binary flow, three linked issues)<br>
Release tier: shell (new native binaries under `extensions/ritemark/binaries/win32-x64/` and `darwin-x64/`, and `.github/workflows/build-whisper.yml`)<br>
**Status:** Phase 3 (DEVELOP), starting with the Phase 0 audits. Plan approved by Jarmo on 2026-10-11.<br>
**Branch after approval:** `sprint-129-windows-dictation`, cut from this worktree's tip, which must be `origin/main` plus the plan commit only (`git log origin/main..HEAD` shows one commit; rebase onto the then-current `origin/main` first)<br>
**Worktree:** `.claude/worktrees/vibrant-lewin-74cd1d` (plan only; the sprint branch is cut from `main` after approval)<br>
**Release:** [v1.14.0](../release-plan.md) (milestone 13). Nothing merges before v1.13.0 is published.

## SDD Artifacts

- [spec.md](./spec.md): behaviour contract R1–R10
- [scenarios.md](./scenarios.md): manual QA matrix, by stage
- [technical-plan.md](./technical-plan.md): workstreams W0–W8
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

- **Windows:** the microphone button appears in the editor header. The first click offers the same 1.5 GB voice model as on the Mac. Transcribe's On-device · Whisper engine works for MP3, WAV, FLAC, OGG and Record files.
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

Proposed 2026-10-11 and approved with the plan:


- **Intel Mac binary (#203) rides along.** It is one more CI job on the existing `macos-15-intel` runner, and the existing signing rules already cover it. Without it, the Intel Mac dictation defect needs its own fix anyway. Declining it still leaves Intel Macs with an honest "needs Apple silicon" message (R3/R6).
- **Dictation stops dropping speech when busy (R8)**, on Mac too. It matters most on Windows, where transcription runs on the CPU only.
- **Binaries are committed to git** like the Apple silicon one (about 5–15 MB more in history), rather than fetched at build time. That keeps the three release pipelines unchanged and the product bytes in the source commit (D1).
- **Model stays in `~/.ritemark/models`** on Windows too, where Ritemark already keeps its per-user data. No migration.
- **No Windows GPU acceleration in this sprint.** If the speed measurement on Jarmo's machine misses the target after the three pre-approved settings (threads, beam size, chunk length), I stop and bring him the numbers before adding anything bigger.

## Open decisions for Jarmo (raised 2026-10-11, after approval)

- **Apple silicon engine for macOS 12–14 (scope change, proposed).** The engine shipped since v1.0.3 is built for macOS 15.0 and later, but Ritemark runs on macOS 12. So on macOS 12–14, dictation and on-device Transcribe fail today. The same pipeline produces a macOS 12 build that passes every check, including a run on macOS 14, at the same speed. Shipping it replaces the Apple silicon binary, which the plan excluded, and adds an Apple silicon dictation check to Gate 2. If approved, it becomes R11 in the spec.
- **Shorter audio window on CPU-only computers (pending A2).** Whisper can process a 5 s chunk with a shorter window than its default 30 s, which may be the biggest speed-up on Windows. It is not one of the pre-approved settings. The bench measures it, and I will bring the numbers.

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
