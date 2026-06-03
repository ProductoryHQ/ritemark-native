---
date: 'TBD'
title: 'Ritemark v1.7.3 — Agent Library, Agent Configurator, Browser UX & AI sidebar polish'
author: Jarmo Tuisk
tags:
  - sprint-78
  - sprint-77
  - sprint-74
  - agent-library
  - agent-configurator
  - browser
  - browser-snapshot
  - annotation-mode
  - ai-sidebar
  - composer
  - plan-approval
  - queue
  - edit-link
  - code-blocks
  - draft
---

# Ritemark v1.7.3 — Agent Library, Agent Configurator, Browser UX & AI sidebar polish

**Status:** DRAFT / unreleased
**Type:** Minor release (Agent Library + Agent Configurator, Browser UX, AI sidebar & composer polish)
**Ships after:** v1.7.2 (this release is the next one in the train; v1.7.2 must ship first)
**Focus:** Sprint 77 ships the unified Agent Library and a visual Agent Configurator built on the real Claude Code agent format — create, browse, and configure AI agents without touching YAML. Sprint 78 makes the integrated browser a better partner for AI agents — a `browser_snapshot` tool for re-observing page state and a live screenshot chip in the composer when annotation mode is on. Sprint 74 sharpens the AI sidebar's two most-used surfaces — the composer and the plan-approval flow — and fixes two smaller editor annoyances.

**User guide:** [How to Configure and Use AI Agents in Ritemark](./agent-configurator-guide.md) — full how-to written for this release; source material for marketing and the user-docs refresh.

* * *

## Downloads

> _v1.7.3 is a DRAFT and has not been built. Download links and the build date are filled in at release-cut time._

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark.dmg | macOS (Apple Silicon, arm64) | TBD on release |
| Ritemark x64 DMG | macOS (Intel, x64) | TBD on release |
| Windows installer | Windows x64 | TBD on release |

* * *

## Why This Release

v1.7.2 was a Markdown-navigation release. v1.7.3 turns back to the AI sidebar and fixes the friction that showed up once people actually used the chat composer and the plan-approval flow day to day.

Two of these are headline behaviour fixes; two are polish:

- **The composer used to lock while an agent was running.** If a follow-up thought occurred mid-run, you had to wait for the run to finish before typing it. Now the composer stays unlocked — type the next prompt and it queues.
- **The plan-approval card looked clickable but did nothing.** The Approve/Reject buttons rendered after the approval window had already closed, so clicking them was a silent no-op. That is fixed, and the card is redesigned.
- **Edit Link couldn't change link text.** The dialog only edited the URL; now it has an optional Display text field.
- **Short code blocks showed a phantom horizontal scrollbar** caused by the copy-button tooltip overflowing the container.

Sprint docs: `docs/development/sprints/sprint-74-ai-sidebar-composer-polish/`, `docs/development/sprints/sprint-77-unified-agent-library-p1/`, and `docs/development/sprints/sprint-78-browser-ux/`

Closes [#73](https://github.com/ProductoryHQ/ritemark-native/issues/73), [#82](https://github.com/ProductoryHQ/ritemark-native/issues/82), [#84](https://github.com/ProductoryHQ/ritemark-native/issues/84), [#86](https://github.com/ProductoryHQ/ritemark-native/issues/86), [#88](https://github.com/ProductoryHQ/ritemark-native/issues/88), and [#93](https://github.com/ProductoryHQ/ritemark-native/issues/93). Sprint 77 work delivered via [PR #99](https://github.com/ProductoryHQ/ritemark-native/pull/99), Sprint 78 via [PR #101](https://github.com/ProductoryHQ/ritemark-native/pull/101).

* * *

## What's New

### Unified Agent Library & Agent Configurator (sprint-77)

Ritemark now treats AI agents as first-class citizens you can see, organize, and configure — without writing a line of YAML.

**Agent Library (left sidebar, robot icon):**

- Everything AI-related in one place, in collapsible sections: **Instructions** (CLAUDE.md / AGENTS.md), **Agents**, **Skills**, **Commands**, and **Flows**
- Section collapse state is remembered — keep only what you work with open
- Project / User scope tabs, search, sort, create (+), and full row actions (Open, Duplicate, Launch Chat, Move scope, Delete)
- Instructions files (CLAUDE.md / AGENTS.md) are now clearly separated from agents — they are project-wide rules loaded into every session, not configurable assistants

**Agent Configurator (right panel when an agent file is open):**

- Built on the **real Claude Code agent format** — what you configure is exactly what the AI runtime reads
- **Description** editing with a required-field warning (this is how the AI decides when to delegate to the agent)
- **Model** picker: Inherit / Sonnet / Opus / Haiku / custom model ID
- **Tools** as an allow-list with correct semantics: nothing checked = agent inherits all tools; checked = agent gets only those (least privilege)
- **Skills** preloading, and an **Advanced** section for Effort, Memory, and Color
- Toolbar toggles to switch between Table of Contents, Properties, and the Agent panel

**Read the full guide:** [How to Configure and Use AI Agents in Ritemark](./agent-configurator-guide.md)

### Agents can re-observe the browser — `browser_snapshot` tool (#88) (sprint-78)

AI agents working with the integrated browser previously had only one way to "look at" a page: navigate to it. Re-checking the page after clicking or filling a form meant re-navigating — losing page state — or falling back to an external Playwright server.

- New **`browser_snapshot`** tool in the `mcp__ritemark_browser__*` toolset returns the current ARIA outline (URL, title, and full accessibility tree) of the active browser tab — without navigating.
- Available to both Claude Code (MCP) and Codex (`ritemark_browser_snapshot`) runtimes.
- **Read-only and consent-aware:** the tool only works on tabs you've shared with Ritemark AI. An unshared tab returns an error — no URL, title, or page content leaks.

### See what the AI sees — screenshot chip in the composer (#73) (sprint-78)

When annotation mode is on (the camera toggle in the browser toolbar), the composer used to show a plain URL chip — misleading, because what actually gets attached to your prompt is a **screenshot** of the page.

- The composer now shows a **live screenshot thumbnail chip** (same 56×56 format as a pasted image) instead of the URL chip when annotation mode is active.
- The thumbnail refreshes automatically as you scroll or interact with the page (≈5 s), so it always previews what the AI will receive.
- Dismiss it with × to exclude the browser context from your next prompt — exactly like dismissing the URL chip.

### Keep typing while the agent runs — your next prompt queues (#82)

The composer no longer locks during an agent run. Type a follow-up while Claude Code or Codex is still working and press Enter: instead of being dropped or blocked, the prompt parks in a **"Queued"** notch above the input — the same visual pattern you already know from "Working on selected text." The moment the current run finishes, the queued prompt auto-sends.

- **One queued prompt at a time.** You can park exactly one follow-up; it sends automatically when the run completes.
- **Discard with ×.** Changed your mind? Click the × on the Queued notch and the prompt is cleared before it ever sends.

This is intentionally minimal for now — see *Coming Next* for the richer queue controls that are deferred.

### Plan approval actually approves — and actually shows the plan (#86 + sprint-78)

When an agent proposes a plan and waits for your go-ahead, the Approve/Reject buttons used to render **after** the approval window had already closed. Clicking them silently did nothing, which made the whole gate feel broken.

- **Approval UI now renders only while the agent is genuinely blocked** waiting on plan approval. If the window is closed, the buttons aren't there to mislead you.
- **The card is redesigned.** It shows the **full plan text** (previously it truncated to the last section only), uses a flat single-level layout, and gives Approve a clear indigo primary call-to-action so the intended action is obvious.
- **The plan content itself is now reliable** (sprint-78). The plan markdown is taken directly from Claude Code's plan-approval request instead of a fragile streamed side-channel — so the card always shows the actual plan, not an empty body with two buttons.

* * *

## Polish

### Edit Link dialog can change the link text (#93)

The Edit Link dialog now has an optional **"Display text"** field:

- **Pre-populates from the current selection** when you create a link.
- **Re-opening an existing link pre-fills with that link's current text**, and clicking Update replaces the whole link (text + target), so renaming a link is a single, predictable step.
- **Leave it as-is or empty** to keep the existing behaviour.
- **Hidden during `@file` search**, so the file-link picker flow is unchanged.

### No more phantom scrollbar on short code blocks (#84)

Short, single-line code blocks used to show a spurious horizontal scrollbar. The cause was the copy-button tooltip overflowing the `<pre>` container. The container no longer scrolls; the inner `<code>` element carries the scroll, so genuinely long lines still scroll while short blocks sit flush.

### OpenCode model picker updates the moment you save an API key (sprint-78)

Saving a provider key (Google AI, OpenAI, Anthropic, OpenRouter) in Settings used to leave the agent picker's OpenCode section stuck on "Add API keys to use OpenCode" until you reloaded the whole window. The picker now refreshes instantly when a key is added or removed.

* * *

## Coming Next

- **Richer composer queue controls (#95).** This release ships a single queued prompt with discard (×). Removing, editing, or promoting queued prompts — and queuing more than one — is deferred to [#95](https://github.com/ProductoryHQ/ritemark-native/issues/95).

* * *

## Under the Hood

- **`browser_snapshot` bridge action** (sprint-78): new `BrowserSnapshotAction` in VS Code patch 010 with a read-share consent gate — snapshots never expose URL, title, or page content of a tab that isn't shared with Ritemark AI. Codex automated review (P1) verified and addressed in [PR #101](https://github.com/ProductoryHQ/ritemark-native/pull/101).
- **Annotation screenshot cache** (sprint-78): viewport screenshots for the composer chip are cached per URL with a 5-second TTL, so the chip stays fresh without running a Playwright capture on every 1.5 s context poll.
- **Agent schema module** (`agent/agentSchema.ts`, with tests): canonical Claude Code tool names, tools-field parsing (comma-separated string ↔ list), and self-healing of tool names written by older Ritemark versions. Reference document: `docs/development/sprints/sprint-77-unified-agent-library-p1/agent-protocols-reference.md`.
- **Non-functional agent scheduling removed** (cron field, `cron-parser` dependency, "runs only while open" banner). Scheduling returns properly designed after the Flows → agent-runtime refactor ([#100](https://github.com/ProductoryHQ/ritemark-native/issues/100)).
- **New quality gate:** webview TypeScript typecheck now runs in the pre-commit hook (vite builds do not type-check).
- New webview modules: `ai-sidebar/composerQueue.ts` (queue state/transitions, with tests) and `ai-sidebar/planText.test.ts` (plan-text rendering coverage for the redesigned approval card). Both are wired into `npm test`.
- The two chat agents remain Claude Code and Codex; the plan-approval and queue work applies to agent runs in the AI sidebar.
- VS Code base: 1.117 (unchanged from v1.7.2). Primary target: macOS darwin-arm64.

* * *

## Tests and Validation

- Regression coverage for the composer queue (#82) and plan-approval text (#86) lands as `ai-sidebar/composerQueue.ts` tests and `ai-sidebar/planText.test.ts`, run via `npm test`.
- Gate 2 (manual install + test of the cut build) is pending — this is a draft and no DMG has been built.
