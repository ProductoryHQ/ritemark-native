---
date: 'TBD'
title: 'Ritemark v1.7.3 — AI sidebar & composer polish'
author: Jarmo Tuisk
tags:
  - sprint-74
  - ai-sidebar
  - composer
  - plan-approval
  - queue
  - edit-link
  - code-blocks
  - draft
---

# Ritemark v1.7.3 — AI sidebar & composer polish

**Status:** DRAFT / unreleased
**Type:** Patch release (AI sidebar & composer polish)
**Ships after:** v1.7.2 (this release is the next one in the train; v1.7.2 must ship first)
**Focus:** Sprint 74 sharpens the AI sidebar's two most-used surfaces — the composer and the plan-approval flow — and fixes two smaller editor annoyances. You can now keep typing while an agent runs, plan approval buttons actually approve, the Edit Link dialog can change link text, and short code blocks stop showing a phantom scrollbar.

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

Sprint docs: `docs/development/sprints/sprint-74-ai-sidebar-composer-polish/`

Closes [#82](https://github.com/ProductoryHQ/ritemark-native/issues/82), [#84](https://github.com/ProductoryHQ/ritemark-native/issues/84), [#86](https://github.com/ProductoryHQ/ritemark-native/issues/86), and [#93](https://github.com/ProductoryHQ/ritemark-native/issues/93).

* * *

## What's New

### Keep typing while the agent runs — your next prompt queues (#82)

The composer no longer locks during an agent run. Type a follow-up while Claude Code or Codex is still working and press Enter: instead of being dropped or blocked, the prompt parks in a **"Queued"** notch above the input — the same visual pattern you already know from "Working on selected text." The moment the current run finishes, the queued prompt auto-sends.

- **One queued prompt at a time.** You can park exactly one follow-up; it sends automatically when the run completes.
- **Discard with ×.** Changed your mind? Click the × on the Queued notch and the prompt is cleared before it ever sends.

This is intentionally minimal for now — see *Coming Next* for the richer queue controls that are deferred.

### Plan approval actually approves (#86)

When an agent proposes a plan and waits for your go-ahead, the Approve/Reject buttons used to render **after** the approval window had already closed. Clicking them silently did nothing, which made the whole gate feel broken.

- **Approval UI now renders only while the agent is genuinely blocked** waiting on plan approval. If the window is closed, the buttons aren't there to mislead you.
- **The card is redesigned.** It shows the **full plan text** (previously it truncated to the last section only), uses a flat single-level layout, and gives Approve a clear indigo primary call-to-action so the intended action is obvious.

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

* * *

## Coming Next

- **Richer composer queue controls (#95).** This release ships a single queued prompt with discard (×). Removing, editing, or promoting queued prompts — and queuing more than one — is deferred to [#95](https://github.com/ProductoryHQ/ritemark-native/issues/95).

* * *

## Under the Hood

- New webview modules: `ai-sidebar/composerQueue.ts` (queue state/transitions, with tests) and `ai-sidebar/planText.test.ts` (plan-text rendering coverage for the redesigned approval card). Both are wired into `npm test`.
- The two chat agents remain Claude Code and Codex; the plan-approval and queue work applies to agent runs in the AI sidebar.
- VS Code base: 1.117 (unchanged from v1.7.2). Primary target: macOS darwin-arm64.

* * *

## Tests and Validation

- Regression coverage for the composer queue (#82) and plan-approval text (#86) lands as `ai-sidebar/composerQueue.ts` tests and `ai-sidebar/planText.test.ts`, run via `npm test`.
- Gate 2 (manual install + test of the cut build) is pending — this is a draft and no DMG has been built.
