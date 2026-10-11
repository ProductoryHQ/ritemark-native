# Release Plan — v1.14.0

**Status:** **Planning** (created 2026-10-11 with the Sprint 129 plan). Nothing merges until v1.13.0 is published; `main` stays frozen for the v1.13.0 release candidate until then<br>
**Target:** v1.14.0<br>
**GitHub milestone:** [v1.14.0](https://github.com/ProductoryHQ/ritemark-native/milestone/13)<br>
**Release type:** **Shell-tier.** [#195](https://github.com/ProductoryHQ/ritemark-native/issues/195) needs a change to `patches/vscode/009-*`, and Sprint 129 adds native whisper binaries for Windows (and Intel Macs, if approved). Full app release: clean-room release worktree, Gate 1 + Gate 2, notarization after the hardening window, Windows CI<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-10-11<br>
**Source:** The Development manager opened the milestone on Jarmo's decision of 2026-10-11. On the same day Jarmo pressed "Build it" for #133 on the Dev Dashboard (a request to plan it, not plan approval).

## Release Thesis

To be written once the scope is settled. Current candidate: Windows users get on-device voice dictation and on-device transcription, which until now needed an Apple silicon Mac.

## Sprints

| Sprint | Scope | Status |
|---|---|---|
| [129 — Windows dictation](sprint-129-windows-dictation/sprint-plan.md) | On-device Whisper on Windows: voice dictation and Transcribe's on-device engine ([#133](https://github.com/ProductoryHQ/ritemark-native/issues/133)); Intel Mac binary from the same pipeline ([#203](https://github.com/ProductoryHQ/ritemark-native/issues/203)) if approved | Plan awaiting Jarmo's approval |

## Milestone items without a sprint yet

- [#195](https://github.com/ProductoryHQ/ritemark-native/issues/195): Browser Recent never records in-panel browsing (shell-tier, patch 009).
- [#396](https://github.com/ProductoryHQ/ritemark-native/pull/396): Agent Library More actions button uses Phosphor dots-three (PR).
- [#398](https://github.com/ProductoryHQ/ritemark-native/issues/398): Make GPT-6.1 Sol Ritemark's default Codex model.

## Gates

- **Shell-tier:** clean-room release worktree from exact `origin/main`, Gate 1 + Gate 2, notarization after the 60-minute hardening window, Windows CI (see `release-manager`).
- **Release test must cover** (from Sprint 129): Windows dictation and on-device Transcribe on the signed installer, and the whisper files' Productory signature. If #203 rides along, the same on an Intel Mac.
- Every release repeats the bundled runtime review (Claude Code, Codex, OpenCode).
