---
date: '2026-05-05'
title: ''
author: Jarmo Tuisk
tags:
  - agents
  - skills
  - authoring
  - conversations
  - runtime
  - feature
---
# Ritemark v1.6.3 — One Conversation, Many Runtimes; A Library You Can Author Into

**Status:** Draft — awaiting build + Jarmo approval
**Type:** Feature release
**Focus:** Conversations are now durable workspaces you can switch runtimes inside of, and the Agent Library is a place to *create and fork*, not just browse

* * *

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |

> Windows: coming soon — the installer will be added as a follow-up asset on the v1.6.3 release.

* * *

## What's New

### One Conversation, Many Runtimes

Until this release, the runtime — Claude or Codex — was effectively chosen *per conversation*. If you wanted Codex to take over halfway through a Claude thread, your only real option was to start over.

v1.6.3 changes the model. A conversation is now your durable workspace. Each *turn* picks its runtime, model, and mode. The thread stays continuous.

-   **Switch runtime mid-conversation.** Open a conversation in Claude, ask a question, then send the next turn through Codex without leaving the thread. The previous turns are still there, still readable, still part of the context you can refer back to in the chat.

-   **Per-turn provenance.** Every assistant response now carries a small line above it telling you which runtime and model produced it. When you scroll back through a long thread, you can see exactly who answered what — useful when one runtime got something right and the other didn't.

-   **Plan/Edit is a per-turn setting.** Codex's Plan and Edit modes used to feel like two different conversation types. They're now a footer toggle on the next run. The same conversation can plan a change with one turn and apply it with the next.

-   **Mixed-runtime history badges.** The conversation list summarizes mixed-runtime threads with a compact badge so you can spot which conversations spanned more than one runtime at a glance.

-   **Cancel and approval still target the running turn.** If Claude is mid-stream and you switch the footer to Codex, hitting **Stop** still cancels the Claude run that's actually executing. Plan approvals, command/file approvals, and pending questions route to the run they belong to, not whatever the footer happens to show.

#### What this is not (yet)

-   We do not import provider-internal session state from one runtime into another. The visible conversation is shared; the providers themselves keep their own session semantics. If a future turn needs the previous runtime's context, Ritemark prepends a compact handoff note to the prompt — automatic cross-runtime summarization is on the roadmap, not in this build.

-   The thinking/reasoning effort control is wired into the data model but does not yet have a UI control on the composer. It will appear in a follow-up where every supported runtime exposes the option.

### The Ritemark Document Agent Steps Back

The legacy "Ritemark Document Agent" entry has been removed from the agent selector. Claude and Codex are now the primary visible runtimes, which is what most of you have been using anyway.

-   **Old conversations stay readable.** If your saved history contains turns produced by the legacy agent, those threads still open and render. Nothing in your localStorage history was deleted or rewritten.

-   **No migration prompt.** The conversation storage now reads both the old format and the new v2 schema. New conversations write the v2 format behind a guarded rollout so we can pull back if anything goes wrong; the old records are preserved alongside.

-   **Setup copy updated.** First-run and onboarding messaging now point at Claude and Codex as the runtimes Ritemark expects you to configure.

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

### The Library Has a Face

Every row in the Agent Library now has a colour-coded icon chip — a 32×32 rounded tile that gives each helper a visual identity at a glance. The design follows the same Phosphor Icons system used throughout Ritemark.

-   **Auto-assigned.** If an agent or skill has no `icon` or `color` frontmatter, Ritemark picks one based on keywords in the name and description. `pr-reviewer` gets a blue clipboard. `release-manager` gets a green rocket. A generic helper gets an indigo sparkle.

-   **Manual override.** Add `icon: bug` and `color: red` to any `.md` frontmatter and that's what appears, immediately after a file save.

-   **Description on the second line.** The frontmatter `description` field now renders directly in the row — no need to hover or open the file to know what a helper does. File paths have moved to a tooltip (hover the row) to reduce clutter.

-   **"More" button on hover.** A `⋯` button appears at the row's right edge when you hover. It opens the same context menu as right-click but is easier to discover without knowing the gesture.

The eight available colours are `indigo` (default), `blue`, `green`, `amber`, `red`, `purple`, `pink`, and `slate`. The icon set (33 Phosphor regular icons) covers code, writing, review, data, design, communication, AI, and productivity — chosen to cover the common agent archetypes without bundling the full Phosphor package.

### The Library Stays Live

External edits to anything under `.claude/agents/`, `.claude/skills/`, or `.claude/commands/` now show up in the sidebar without a manual reload. Edit a skill in your terminal, have an agent rewrite one for you, sync from another machine — the library reflects reality.

A new sort dropdown gives you **Alphabetical** or **Recently modified**. Recently modified is the one that earns its keep once you have thirty or forty helpers and need to find the one you touched yesterday.

* * *

## What's Fixed

-   **Row context menu now opens reliably.** A regression caught during validation: the right-click menu was silently failing on some rows because we were stashing item data in a `data-item` HTML attribute via `JSON.stringify(item)`, and unescaped quotes inside the JSON were breaking the attribute. Switched to a `data-filepath` lookup against in-scope arrays, so the menu opens every time. (Commit `4299a77`.)

* * *

## What Didn't Change

The markdown editor, file explorer, file watcher, and everything outside the AI sidebar and Agent Library behave exactly as in v1.6.2.

A few things were considered for this release and deliberately deferred — they're on the roadmap, not in this build:

-   **Try it** — a one-click test loop for a skill or agent from the library
-   **Capture from conversation** — turning an AI panel exchange into a saved skill
-   **Description coach** — interactive help writing the frontmatter description
-   **Template gallery** — more starter helpers, browsable
-   **Builder agent** — an agent that writes other agents
-   **Marketplace** — discovery and sharing across users
-   **Cross-runtime context summarization** — automatic high-quality handoff between Claude and Codex inside one conversation
-   **Per-run thinking/reasoning effort UI** — the data model supports it; the composer control is the next slice
-   **Gemini and other SDK-backed runtimes** — the conversation/run model is now ready for them; framework selection is the next sprint

* * *

## Upgrade

Auto-update will offer v1.6.3 to existing v1.6.2 users on next launch. You can also download the DMG directly from the release page. No settings migration is required.

If you already have files in `~/.claude/`, the starter pack will not seed — your library is left untouched. To see the starter pack, move your existing `~/.claude/` aside and relaunch.

Saved conversations carry over with no action from you. The new conversation storage reads both the old format and the v2 schema, and v2 writes are guarded so the rollout can be reversed if needed.

* * *

## Technical Notes

For developers and changelog readers.

**Sprints:**

-   [Sprint 59 — Agent Authoring Loop](../../development/sprints/sprint-59-agent-authoring-loop/sprint-plan.md) (PR #45, merged 2026-05-04)
-   Sprint 60 — Agent Harness Refactor (PR #46, merged 2026-05-04). Internal-only refactor of `CLAUDE.md`, agents, skills, and hooks per the 2026-05-03 audit. No product code changes; included here for changelog completeness only.
-   [Sprint 61 — Agent Library Icons & Colours](../../development/sprints/sprint-61-agent-library-icons/sprint-plan.md) (PR #47, merged 2026-05-04)
-   [Sprint 62 — Conversation Runtime + Agent Switching](../../development/sprints/sprint-62-conversation-runtime/sprint-plan.md) (branch `codex/sprint-62-conversation-runtime`)

**Highlights — Conversation runtime (sprint 62):**

-   New unified conversation model in `extensions/ritemark/webview/src/components/ai-sidebar/conversationModel.ts`. Pure types and migration helpers — no localStorage access, no Zustand imports — so the model is independently testable.
-   `schemaVersion: 2` for saved conversations. The store reads both legacy and v2 records, writes v2 behind a guarded rollout, and never deletes legacy localStorage entries during the transition.
-   Each `ConversationRun` carries `runtimeId`, `modelId`, `mode`, optional `thinkingEffort`, and the provider's own typed turn payload (Claude SDK turn, Codex turn, or legacy Ritemark turn). Provider-specific details survive intact inside the unified envelope.
-   `RuntimeId = 'claude-code' | 'codex' | 'legacy-ritemark'`. The legacy variant is read-only for old history; new runs only use Claude or Codex.
-   Cancel, approve, command/file approval, and question-answer actions now resolve the *active run*, not the globally selected agent. This is what makes mid-conversation runtime switching safe.
-   Context handoff is conservative: same visible conversation, provider-local sessions, optional compact handoff note prepended to the prompt when switching runtimes. Automatic summarization across previous runs is deferred. See `docs/development/sprints/sprint-62-conversation-runtime/notes/context-handoff-decision.md`.
-   Per-run runtime/model picker lives in the composer footer. `AgentSelector.tsx` continues to handle setup/discovery/availability, but the per-turn choice is made at the point of composition.
-   Per-message provenance line shown in `AgentResponse.tsx`, `CodexView.tsx`, and the new `UnifiedConversationView.tsx`.
-   New tests: `conversationModel.test.ts` (migration + schema), `runtimeSwitching.test.ts` (mixed-runtime store behavior), plus updates to lifecycle and conversation-reset tests for cancel/approval routing.
-   No changes to `AgentRunner.ts` or `codex/codexManager.ts` runtime behavior — the sprint changed the conversation model and UX shell around those runtimes, not the runtimes themselves.

**Highlights — Agent Library (sprints 59 & 61):**

-   New-helper modal collects name + scope, generates a frontmatter skeleton, writes the file under the correct `.claude/` subdirectory, and opens it in the editor.
-   Row actions wired to VS Code APIs: **Reveal in Finder** uses `revealFileInOS`, **Delete…** uses the workspace FS trash, **Move scope** is a project↔user file move with sidebar refresh.
-   Starter pack vendored under `extensions/ritemark/starter-pack/`, including `skill-creator` at upstream commit `5128e186` (Apache-2.0). Seeding logic checks `~/.claude/` is empty and runs at most once per machine.
-   File watcher attached to `.claude/{agents,skills,commands}/` for live sidebar updates.
-   Sort dropdown reads modified-time from the FS at refresh time; no extra index file.
-   Icon system (`extensions/ritemark/src/agent/iconPack.ts`): 33 Phosphor regular SVG paths (viewBox 256×256) embedded as inline strings in the webview HTML — no npm bundle needed since the Agent Library is a string-template webview, not a bundled React app. Eight brand colours as `rgba` alpha tints so chips read correctly on both light and dark VS Code themes. `resolveIconAndColor()` checks frontmatter first, then keyword heuristics, then defaults to `sparkle`+`indigo`. Phosphor is MIT-licensed; attribution added to `branding/ATTRIBUTION.md`.

**Upgrade notes:** No breaking changes. No new runtime dependencies in the extension or webview. localStorage migration is read-compatible with v1.6.2 records.

* * *

## Sprints Rolled Up

-   **Sprint 59** — Agent Authoring Loop (user-facing)
-   **Sprint 60** — Agent Harness Refactor (internal only)
-   **Sprint 61** — Agent Library Icons & Colours (user-facing)
-   **Sprint 62** — Conversation Runtime + Agent Switching (user-facing)

Browsing a library is fine. Adding to it is the part that matters. Owning a conversation that outlives any one runtime is the other part.
