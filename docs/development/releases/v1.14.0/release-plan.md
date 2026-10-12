# Release Plan — v1.14.0

**Status:** **Planning / in development.** Opened 2026-10-11, when the v1.13.0 candidate was built. `main` has been open since v1.13.0 published on 2026-10-11. Two sprints are approved and in development<br>
**Target:** v1.14.0<br>
**GitHub milestone:** [v1.14.0](https://github.com/ProductoryHQ/ritemark-native/milestone/13)<br>
**Release type:** **Shell-tier.** [#195](https://github.com/ProductoryHQ/ritemark-native/issues/195) needs a change to `patches/vscode/009-*`, Sprint 129 adds native whisper binaries for Windows and Intel Macs, and Sprint 130 adds an activity-bar icon that an extension release does not ship. Full app release: clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window, Windows CI. The first live run of the draft-first publish (release skill Step 8, [#402](https://github.com/ProductoryHQ/ritemark-native/pull/402))<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-11 (the milestone); this file 2026-10-12<br>
**Source:** The Development manager opened the milestone on Jarmo's decision of 2026-10-11 (the next release opens when a candidate is built). On the same day Jarmo pressed "Build it" for #133, #119 and #195 on the Dev Dashboard; each sprint plan was approved separately in its own session.

## Release Thesis

To be written once the scope is settled. Candidates:
- Windows users get on-device transcription, and voice dictation as "speak, then text": they talk, press Stop, and the text arrives about 20 s later.
- Every project folder gets a task board whose cards can be handed to an agent.

## Sprints

| Sprint | Scope | Status |
|---|---|---|
| [129 — Windows dictation](sprint-129-windows-dictation/sprint-plan.md) | On-device Whisper on Windows: voice dictation and Transcribe's on-device engine ([#133](https://github.com/ProductoryHQ/ritemark-native/issues/133)). The Intel Mac binary comes from the same pipeline ([#203](https://github.com/ProductoryHQ/ritemark-native/issues/203)). The Apple silicon engine is rebuilt for macOS 12–14 (R11, Jarmo 2026-10-12) | Approved 2026-10-11. In development, draft [#399](https://github.com/ProductoryHQ/ritemark-native/pull/399). Jarmo's speed decisions (2026-10-12, after round 3): on Windows, dictation ships as "speak, then text" (record, press Stop, then the text) with the full audio window; the shorter window does not ship; q8_0 is the Windows model; no GPU (Vulkan) in v1.14.0; cutting at pauses (VAD) is separate work for all platforms |
| [130 — Task board](sprint-130-task-board/sprint-plan.md) | Task board in each project folder, with Give to agent ([#119](https://github.com/ProductoryHQ/ritemark-native/issues/119)) | Approved 2026-10-12 (Doing limit in; Tasks above Transcribe). Phase 0 probes done. In development on `sprint-130-task-board`, draft [#409](https://github.com/ProductoryHQ/ritemark-native/pull/409) |

The sprint links resolve when each sprint's docs merge with its PR.

## Merged since v1.13.0

| PR | Commit | What it changes | Ships in the product |
|---|---|---|---|
| [#396](https://github.com/ProductoryHQ/ritemark-native/pull/396) | `510384f3` | Agent Library More actions button uses Phosphor dots-three (#391) | Yes (extension) |
| [#404](https://github.com/ProductoryHQ/ritemark-native/pull/404) | `cf194e30` | Comment-task retention sweep runs at activation, so the store stops growing | Yes (extension) |
| [#397](https://github.com/ProductoryHQ/ritemark-native/pull/397) | `542bee6c` | README links ritemark.app; GitHub detects the MIT license | No (docs) |
| [#400](https://github.com/ProductoryHQ/ritemark-native/pull/400) | `e649fc09` | v1.13.0 closeout | No (docs) |
| [#402](https://github.com/ProductoryHQ/ritemark-native/pull/402) | `200adae9` | `notarize-dmg.sh` fails on every refusal; publish releases from a draft | No (release harness) |
| [#405](https://github.com/ProductoryHQ/ritemark-native/pull/405) | `d4c6ed47` | Pre-commit Check 7 actually runs the extension compile | No (harness) |
| [#407](https://github.com/ProductoryHQ/ritemark-native/pull/407) | `37c4973f` | Worktree hygiene proves squash merges | No (harness) |

## Milestone items without a sprint yet

- [#195](https://github.com/ProductoryHQ/ritemark-native/issues/195): Browser Recent never records in-panel browsing. Shell-tier (patch 009); its planning session has not started.
- [#398](https://github.com/ProductoryHQ/ritemark-native/issues/398): make GPT-6.1 Sol Ritemark's default Codex model.

## Gates

- **Shell-tier:** clean-room release worktree from exact `origin/main`, Gate 1 + Gate 2, notarization after the 60-minute hardening window, Windows CI (see `release-manager`).
- **The release test must cover:**
  - from Sprint 129: on-device Transcribe and "speak, then text" dictation on the signed Windows installer, the whisper files' Productory signature, and Apple silicon dictation on macOS 12–14. Intel Mac evidence is the CI runner's contract test only (Jarmo, 2026-10-11).
  - from Sprint 130: the task board, Give to agent in all three runtimes, and the browser tools after the tool-registry change.
- **Runtime review:** every release repeats it for the bundled runtimes (Claude Code, Codex, OpenCode).
