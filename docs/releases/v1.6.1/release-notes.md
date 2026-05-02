---
date: '2026-04-30'
title: ''
author: Jarmo Tuisk
tags:
  - maintenance
  - vscode-upgrade
---
# Ritemark v1.6.1 — Under the Hood

**Status:** Draft (open - more to come)
**Type:** Patch release
**Focus:** VS Code engine upgrade + bug fixes

* * *

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |
| Windows | [Ritemark-Setup.exe](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-1.6.1-win32-x64-setup.exe) |

* * *

## What's New

### VS Code Engine Upgrade: 1.109.5 -> 1.117.0

The underlying VS Code engine jumps from 1.109.5 to 1.117.0 — a major leap covering 8 upstream releases. This brings improved editor performance, updated Electron, and better platform support without changing anything in your Ritemark workflow.

All 6 Ritemark patches (branding, UI layout, menu cleanup, build system, Windows/OSS fixes, dev launch) have been rebased and validated against the new base.

### Bug Fixes

- **Text selection visibility** — text selection background in code blocks and table cells is now clearly distinguishable from row hover highlight
- **AI Flow file writes** — Flow-generated files now route through `vscode.workspace.fs` instead of raw Node `fs`, fixing reliability issues with workspace file creation
- **File explorer refresh after AI writes** — the explorer tree now auto-refreshes when Claude Code or other agents write files to the workspace, plus a manual refresh button in the explorer toolbar
- **Document header hook** — replaced stale `document-header` sentinel with `ai-sidebar` to fix hook misfires

* * *

## Also Included

- **Activity bar spacing** — 6px vertical spacing between activity-bar icons (post-v1.6.0 polish)

* * *

## For Developers

**VS Code base:** 1.117.0 (up from 1.109.5)

**Patch rebase notes:** All 6 patches rebased cleanly. Sprint 54 contributions (Agent Library panel adjustments) that were dropped during the patch 002 rebase have been restored.

**Upgrade notes:** No breaking changes, no new runtime dependencies.

* * *

## What's Next

This release is still in progress. More items may be added before release.
