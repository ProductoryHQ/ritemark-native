---
date: '2026-05-02'
title: ''
author: Jarmo Tuisk
tags:
  - maintenance
  - vscode-upgrade
  - mermaid
  - onboarding
---
# Ritemark v1.6.1 — Foundation + Polish

**Status:** Draft (open — release pending)
**Type:** Patch release
**Focus:** VS Code engine upgrade, Windows onboarding, Mermaid diagram polish, bug fixes

* * *

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |
| Windows | [Ritemark-Setup.exe](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-1.6.1-win32-x64-setup.exe) |

* * *

## What's New

### VS Code Engine Upgrade: 1.109.5 → 1.117.0

The underlying VS Code engine jumps from 1.109.5 to 1.117.0 — a major leap covering 8 upstream releases. This brings improved editor performance, updated Electron, and better platform support without changing anything in your Ritemark workflow.

All 6 Ritemark patches (branding, UI layout, menu cleanup, build system, Windows/OSS fixes, dev launch) have been rebased and validated against the new base.

### Mermaid Diagrams — Wider, Sharper, Exportable

Diagrams now render at the full content-container width (no more 680px cap), with reduced margins so they breathe inside the document rather than floating in whitespace. Complex diagrams that overflow scroll horizontally instead of getting clipped or shrunken.

New diagram toolbar:
- **Copy image** — copy the rendered SVG to the clipboard.
- **Download** — Save As dialog to write the diagram to disk.
- **Expand** — full-screen overlay with cursor-anchored Cmd/Ctrl+Scroll zoom (0.25×–4×). Press Esc to close.

### Friendlier Claude / Codex Onboarding (Windows + macOS)

- **Bundled agent runtime** — agent CLIs (Claude, Codex) can now be shipped inside the extension instead of relying on whatever's installed globally. Lays the groundwork for clean Windows onboarding.
- **Truthful Claude auth state** — Settings now queries the Claude CLI directly to determine sign-in state. Previously the env-var fallback could falsely report "Connected" after `claude logout`.
- **Terminal-free sign-in** — `claude /login` now runs as a background subprocess and opens your system browser. No terminal needed. There's also an "Use Anthropic API key" alternative path with input box + secret storage, and a Cancel button during in-progress sign-in (5-min timeout).
- **Workspace trust prompt removed** — first-launch friction gone; you can start editing immediately.

### Bug Fixes

- **Text selection visibility** — selection background in code blocks and table cells is now clearly distinguishable from row hover highlight.
- **Gitignored files in Explorer** — entries like `docs-internal/` and `node_modules/` are now readable in the File Explorer (the gitignored foreground was previously near-invisible against the sidebar background, in both light and dark themes).
- **AI Flow file writes** — Flow-generated files now route through `vscode.workspace.fs` instead of raw Node `fs`, fixing reliability issues with workspace file creation.
- **File explorer refresh after AI writes** — the explorer tree now auto-refreshes when Claude Code or other agents write files to the workspace, plus a manual refresh button in the explorer toolbar.
- **Document header hook** — replaced stale `document-header` sentinel with `ai-sidebar` to fix hook misfires.

* * *

## Also Included

- **Activity bar spacing** — 6px vertical spacing between activity-bar icons (post-v1.6.0 polish).
- **Sprint 54 contributions restored** — Agent Library panel adjustments that were dropped during the patch 002 rebase have been put back.

* * *

## For Developers

**VS Code base:** 1.117.0 (up from 1.109.5)

**Patches:** All 6 patches rebased cleanly onto 1.117.0. No new patches in this release.

**New utilities:**
- `bundledAgentRuntime` — resolves bundled CLI binaries from `extensions/ritemark/binaries/agents/`, with tests.
- `detectClaudeAuthMethod` — CLI-first auth detection in `agent/setup.ts`, with env-var demoted to last-resort fallback.

**Upgrade notes:** No breaking changes. No new runtime dependencies in the extension host.

* * *

## Sprints Rolled Up

- **Sprint 55** — VS Code 1.109.5 → 1.117.0 upgrade + bug bundle (text selection, AI file writes, explorer refresh, hook fix)
- **Sprint 56** — Mermaid diagram fixes (margins, toolbar polish, expand view, Save As download)
- **Sprint 57** — Windows onboarding (bundled agent runtime, truthful Claude auth, terminal-free sign-in)
- **Theme fix** — gitignored Explorer entries readability (PR #37)
