---
date: '2026-05-04'
title: ''
author: Jarmo Tuisk
tags:
  - agents
  - skills
  - authoring
  - feature
---
# Ritemark v1.6.3 — Authoring Agents and Skills, Without the Terminal

**Status:** Draft — awaiting build + Jarmo approval
**Type:** Feature release
**Focus:** The Agent Library becomes a place to *create and fork*, not just browse — new skills and agents are now a `+` button away

* * *

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |

> Windows: coming soon — the installer will be added as a follow-up asset on the v1.6.3 release.

* * *

## What's New

### Authoring Is a Button, Not a Terminal Session

Until this release, creating a new skill or agent meant opening a terminal, remembering the right directory under `.claude/`, and writing YAML frontmatter from memory. The Agent Library could *show* you what was there, but it couldn't help you make more.

v1.6.3 closes that loop. The library now creates files for you, in the right place, with the right scaffolding, and opens them in the editor ready to edit.

-   **Empty state with intent.** When the library has nothing to show, you no longer get a "open a terminal and add files to `.claude/`" instruction. You get two buttons: **New skill** and **New agent**. Click one, name the helper, pick a scope, and you're editing a real file with valid frontmatter a second later.

-   **`+` on every section header.** The Agents and Skills sections both have a `+` affordance in the header. Same modal, same flow — no need to scroll back to the empty state once you have helpers in the library.

-   **Right-click to manage.** Each row has a context menu: **Open**, **Duplicate** (the fastest way to fork an existing skill into your own), **Reveal in Finder**, **Move scope** (one click to promote a project-scope helper to your user library, or vice versa), and **Delete…** (uses the OS trash via VS Code's API, so it's recoverable; project-scope deletes also surface a teammate-impact note before you confirm).

### A Starter Pack on First Run

The first time Ritemark sees an empty `~/.claude/`, it now seeds a small starter pack so you have working examples to read, fork, and learn from. Four helpers ship in the pack:

-   **`skill-creator`** — Anthropic's official skill scaffolding helper, vendored at commit `5128e186` under Apache-2.0. The fastest way to bootstrap a new skill from a description.

-   **`outline-from-notes`** — Ritemark-authored. Turns a wall of notes into a structured outline.

-   **`frontmatter-cleanup`** — Ritemark-authored. Normalizes YAML frontmatter across a folder of markdown.

-   **`document-reviewer`** — Ritemark-authored. Reviews a draft for clarity, structure, and tone.

Seeding only happens once, only when `~/.claude/` is empty, and never overwrites existing files. After seeding, the files are yours — edit them, delete them, fork them, do whatever you'd do with anything else in your library.

### The Library Stays Live

External edits to anything under `.claude/agents/`, `.claude/skills/`, or `.claude/commands/` now show up in the sidebar without a manual reload. Edit a skill in your terminal, have an agent rewrite one for you, sync from another machine — the library reflects reality.

A new sort dropdown gives you **Alphabetical** or **Recently modified**. Recently modified is the one that earns its keep once you have thirty or forty helpers and need to find the one you touched yesterday.

* * *

## What's Fixed

-   **Row context menu now opens reliably.** A regression caught during validation: the right-click menu was silently failing on some rows because we were stashing item data in a `data-item` HTML attribute via `JSON.stringify(item)`, and unescaped quotes inside the JSON were breaking the attribute. Switched to a `data-filepath` lookup against in-scope arrays, so the menu opens every time. (Commit `4299a77`.)

* * *

## What Didn't Change

The AI panel, file watcher, markdown editor, and everything else outside the Agent Library behave exactly as in v1.6.2. This release is focused: it's about authoring.

A few things were considered for this sprint and deliberately deferred — they're on the roadmap, not in this build:

-   **Try it** — a one-click test loop for a skill or agent from the library
-   **Capture from conversation** — turning an AI panel exchange into a saved skill
-   **Description coach** — interactive help writing the frontmatter description
-   **Template gallery** — more starter helpers, browsable
-   **Builder agent** — an agent that writes other agents
-   **Marketplace** — discovery and sharing across users

* * *

## Upgrade

Auto-update will offer v1.6.3 to existing v1.6.2 users on next launch. You can also download the DMG directly from the release page. No settings migration is required.

If you already have files in `~/.claude/`, the starter pack will not seed — your library is left untouched. To see the starter pack, move your existing `~/.claude/` aside and relaunch.

* * *

## Technical Notes

For developers and changelog readers.

**Sprints:**

-   [Sprint 59 — Agent Authoring Loop](../../development/sprints/sprint-59-agent-authoring-loop/sprint-plan.md) (PR #45, merged 2026-05-04)
-   Sprint 60 — Agent Harness Refactor (PR #46, merged 2026-05-04). Internal-only refactor of `CLAUDE.md`, agents, skills, and hooks per the 2026-05-03 audit. No product code changes; included here for changelog completeness only.

**Highlights:**

-   New-helper modal collects name + scope, generates a frontmatter skeleton, writes the file under the correct `.claude/` subdirectory, and opens it in the editor.
-   Row actions wired to VS Code APIs: **Reveal in Finder** uses `revealFileInOS`, **Delete…** uses the workspace FS trash, **Move scope** is a project↔user file move with sidebar refresh.
-   Starter pack vendored under `extensions/ritemark/starter-pack/`, including `skill-creator` at upstream commit `5128e186` (Apache-2.0). Seeding logic checks `~/.claude/` is empty and runs at most once per machine.
-   File watcher attached to `.claude/{agents,skills,commands}/` for live sidebar updates.
-   Sort dropdown reads modified-time from the FS at refresh time; no extra index file.

**Upgrade notes:** No breaking changes. No new runtime dependencies in the extension or webview.

* * *

## Sprints Rolled Up

-   **Sprint 59** — Agent Authoring Loop (user-facing)
-   **Sprint 60** — Agent Harness Refactor (internal only)

Browsing a library is fine. Adding to it is the part that matters.
