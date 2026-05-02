---
date: '2026-04-27'
title: ''
author: Jarmo Tuisk
tags:
  - agents
---
# Ritemark v1.6.0 — Agents Come to the Front Seat

**Status:** Draft  
**Type:** Minor release  
**Focus:** Agent Library — the first step in bringing agents and skills from hidden folders to first-class citizens alongside your content

* * *

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |
| Windows | [Ritemark-Setup.exe](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-1.6.0-win32-x64-setup.exe) |

* * *

## What This Release Is About

For too long, agents and skills have been "headless code" — scattered across hidden `.claude/` folders, hard to discover, harder to manage. You write them, you accumulate them, but they stay invisible until you explicitly invoke them.

**v1.6.0 changes that.** Agents and skills now deserve the same attention as your content — they're not just automation buried in config folders, they're knowledge assets that should be easy to find, review, and improve.

The **Agent Library** is the first step: a dedicated activity-bar entry that auto-discovers your agents and skills (workspace and user-scope), shows them in one place, and lets you open them for editing alongside your documents. No more hunting through hidden folders. No more "did I write that agent or not?"

This is foundational work. More is coming — editing workflows, bulk operations, better curation tools — but the key shift starts here: **agents move to the front seat.**

* * *

## What's New

### Agent Library — Your Agents, Visible

The **Agent Library** brings your accumulated agent and skill files into a dedicated activity-bar panel. No more hunting through `.claude/agents/`, `.claude/skills/`, or `~/.claude/` to remember what you've written.

**What it does:**

-   **Auto-discovers** all your agents and skills (workspace + user-scope)
    
-   **Groups by scope** — workspace agents separate from your personal user-scope library
    
-   **Opens files for editing** — click any agent to open its markdown file in the editor
    
-   **Shows validation warnings** — agents missing required frontmatter fields show inline hints
    
-   **Supports YAML edge cases** — fixed CRLF line-ending bugs and added support for block scalars
    

**What it doesn't do (yet):**

-   Bulk operations, duplicate detection, agent builder flows — those are coming in follow-up releases
    

This is the foundation. The shift is from "agents as hidden automation" to "agents as knowledge assets worth managing."

### Properties Panel — Frontmatter Editing Simplified

The Properties panel moves from a modal dialog to a dedicated side panel that opens alongside your document. Edit status, tags, dates, and custom frontmatter fields without leaving your writing flow.

### Inline Table of Contents

The Contents button now opens a sticky left rail that stays visible as you scroll. Active heading tracking shows where you are in long documents.

### UI Refinements

The app now looks intentionally like Ritemark (vertical activity bar, Phosphor icons, indigo accents) instead of "VS Code with a theme." Dark mode ships as a first-class option alongside light mode.

The Agent Library activity-bar entry ships as the first altitude of unified agent management — a curation surface, not a builder or a runtime.

-   **Auto-discovery** across `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, and the user-scope `~/.claude/` equivalents — your accumulated agent files appear in one place instead of spread across hidden folders
    
-   **Scope tabs** separate workspace agents from user-scope agents
    
-   **Dedicated activity-bar icon** (`agent-library-icon.svg`)
    
-   **Inline frontmatter validation** — agents missing a `description` field show an inline warning so you can spot drift at a glance
    
-   **Robust frontmatter parser** — fixed a CRLF line-ending bug that broke agents written on Windows, and added support for YAML block scalar indicators (`>-`, `|`, `|-`)
    

This is the curation layer only. Agent editing and bulk operations are future work; the round-trip guarantee (your `.md` files are the source of truth, never overwritten in unsafe ways) is the design principle this surface is built on.

### CSV "Open in Excel" now converts to .xlsx

When you click **Open in Excel** on a CSV file, Ritemark converts it to a temporary `.xlsx` file (via SheetJS) before handing it off to Excel, instead of opening the raw CSV.

This fixes two real-world problems Mac users hit regularly:

-   **Encoding mojibake with Estonian / EU characters:** Mac Excel's CSV importer assumes MacRoman and mangles UTF-8 (ä, õ, ü, ž, etc.). Going through .xlsx preserves the encoding.
    
-   **Semicolon-delimiter locale issues:** In EU locales, Excel expects `;` as the CSV separator and may break columns when the source file uses `,`. The .xlsx conversion sidesteps the locale entirely.
    

The temporary .xlsx file is cleaned up automatically after 5 seconds.

* * *

## Also Included

**CSV → Excel conversion** (Mac): When you open a CSV in Excel, Ritemark converts it to `.xlsx` first, fixing encoding issues with Estonian/EU characters and semicolon-delimiter locale problems.

**Diagnostic noise suppression**: Markdown files no longer show red squiggles for missing link references or file-tree error decorations.

**Dark mode**: A rebalanced dark theme ships alongside the existing light theme.

* * *

## Why This Matters

If you've written agents or skills for Ritemark (or Claude Code), you know the problem: they work great when you remember they exist, but they're invisible until you invoke them. Scattered across folders, hard to review, easy to forget.

v1.6.0 starts fixing that. The Agent Library makes your agents visible, editable, and manageable — not as "code you wrote once," but as knowledge assets worth curating.

This is the first step. More curation tools, editing workflows, and agent-management capabilities are coming in future releases. But the shift starts here: **agents are no longer headless. They're front-seat knowledge.**

* * *

## For Developers

**New in this release:**

-   Agent Library view provider + auto-discovery system
    
-   Properties side panel components
    
-   Inline Table of Contents component
    
-   CSV → .xlsx conversion helper
    
-   Dark theme
    

**VS Code base:** 1.109.5 (no change from v1.5.3)

**Upgrade notes:** No breaking changes, no new runtime dependencies. If you've customized `.claude/` folder structure, the Agent Library will discover agents and skills automatically — no migration needed.

* * *

## What's Next

This is the foundation for agent management in Ritemark. Future releases will add:

-   Agent editing workflows (create, duplicate, template-based creation)
    
-   Bulk operations (tag multiple agents, archive unused ones)
    
-   Better curation tools (duplicate detection, usage tracking)
    

The goal: make agents as easy to manage as your documents.
