# Sprint 41: VS Code Upstream Update

## Status: Complete

## Summary

Upgraded Ritemark's VS Code OSS base from `1.94.0` to `1.109.5` and revalidated the full patch stack against the new upstream. The sprint started as a maintenance upgrade, but it also surfaced a few product-critical regressions during smoke testing. Those were fixed as part of the same branch so the upgraded app still behaves like Ritemark rather than stock VS Code.

## Goal

Move the `vscode/` submodule onto a current stable upstream release without losing Ritemark's layout, branding, startup behavior, or extension loading.

## What Actually Shipped

| Area | Outcome |
| --- | --- |
| Upstream base | `vscode/` submodule moved from `1.94.0` to `1.109.5` |
| Patch stack | All 5 grouped patches were updated to apply cleanly against the new base |
| Build/runtime compatibility | TypeScript and gulp compile pass on the upgraded base |
| Dev startup | White-screen startup regressions were fixed so the extension loads again in the dev app |
| Branding | About dialog shows `Ritemark` and uses `ritemarkVersion` (`1.4.1`) instead of upstream VS Code version text |
| Terminal invariant | Ritemark no longer opens or restores integrated terminals in the editor area |

## Delivered Changes

### 1. Upstream migration

- Updated the VS Code OSS submodule from `1.94.0` to `1.109.5`
- Rebased and repaired:
  - `patches/vscode/001-ritemark-branding.patch`
  - `patches/vscode/002-ritemark-ui-layout.patch`
  - `patches/vscode/003-ritemark-menu-cleanup.patch`
  - `patches/vscode/004-ritemark-build-system.patch`
  - `patches/vscode/005-ritemark-windows-and-oss-fixes.patch`

### 2. Regressions found during validation and fixed in-sprint

- Removed the eager macOS microphone prompt on startup; microphone permission is now requested only when media access is actually needed
- Removed the forced reset of saved custom view locations so user layout choices survive restart
- Added a guard for missing `defaultChatAgent` / OSS product metadata so the upgraded dev app does not white-screen during startup
- Fixed the About dialog to show Ritemark branding and `ritemarkVersion`
- Locked down the terminal invariant so `Reload Window` does not restore `bash` as an editor tab

### 3. Ritemark-specific invariants preserved

- AI sidebar remains in the right-side workbench area
- Terminal remains in the right-side workbench area
- Titlebar customization and menu cleanup patches still apply on the new upstream
- Ritemark extension loads in the upgraded dev app and the markdown editor renders normally

## Verification Completed

- [x] `./scripts/apply-patches.sh --dry-run`
- [x] `./scripts/apply-patches.sh`
- [x] `npm run compile-check-ts-native`
- [x] `npm run gulp compile`
- [x] Dev app launch on macOS arm64 with the upgraded VS Code base
- [x] Ritemark extension loads in the dev app
- [x] Markdown document opens and renders correctly
- [x] AI sidebar is accessible after startup
- [x] `Reload Window` no longer restores the integrated terminal into the editor area

## Environment Notes

- VS Code `1.109.5` requires Node `22.21.1` for the local dev workflow
- Stale shell environment variables such as `ELECTRON_RUN_AS_NODE=1` can make the dev app appear broken even when the code is fine
- The terminal placement regression was caused by three separate mechanisms, not one:
  - workbench layout location
  - user setting `terminal.integrated.defaultLocation`
  - terminal editor restore/serialization

## Scope Notes

- The original sprint plan described this as a pure infrastructure upgrade. In practice, the sprint also needed product-level regression fixes to keep the upgraded app aligned with Ritemark UX.
- Validation in this sprint covered patch application, compile checks, and dev-app smoke testing. Release packaging/signing remains part of the normal release flow, not this sprint document.

## Branch / Commits

Primary implementation branch:

- `codex/review-update-vscode-oss-EI0jF`

Key commits:

- `ef31c19` `chore: update VS Code OSS submodule from 1.94 to 1.109.5`
- `ba2e7f6` `fix: stabilize vscode oss upgrade patches`
- `2e2229f` `fix: stabilize vscode oss dev startup and about dialog`
- `eab635f` `fix: keep terminal out of editor area`

## Outcome

The VS Code upstream upgrade is no longer just "researched" or "planned". It has been implemented, smoke-tested, and hardened enough to merge into `main` alongside the existing Ritemark extension work.
