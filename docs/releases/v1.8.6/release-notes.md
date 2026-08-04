---
date: '2026-08-04'
title: 'Ritemark v1.8.6 — Clear Start, Trustworthy AI'
author: Jarmo Tuisk
status: Draft
sprints:
  - sprint-102
  - sprint-103
  - sprint-104
  - sprint-105
  - sprint-106
tags:
  - sprint-102
  - sprint-103
  - sprint-104
  - sprint-105
  - sprint-106
  - ai-transparency
  - privacy
  - human-review
  - plan-mode
---

# Ritemark v1.8.6 — Clear Start, Trustworthy AI

**Status:** Draft — Sprints 102–106 complete (Sprint 107 Clean Start in progress separately).  
**Release issues:** [#163 — AI transparency and policy alignment](https://github.com/ProductoryHQ/ritemark-native/issues/163) · [#132 — truthful Plan controls](https://github.com/ProductoryHQ/ritemark-native/issues/132) · [#161 — truthful activity state](https://github.com/ProductoryHQ/ritemark-native/issues/161)

## A clear place to start (Sprint 106)

- **Home lives in the left rail.** After the one-time Welcome is gone, Home stays: create a **Markdown document** with one obvious click, start a **New AI task**, open a document or folder, insert a table — or jump back into your recently edited documents.

## Comments become a work list (Sprint 105)

- **Count what needs attention.** The editor toolbar shows a Comments badge with the document's true comment count; the overview splits it into assigned and unassigned, per agent.
- **Send assigned comments as real tasks.** One click queues one ordered task per agent — Claude gets Claude's comments, Codex gets Codex's — with a confirmation first. Your comments stay in the document; nothing is auto-resolved.
- **Watch each comment's task.** Margin markers show live status: queued, working, finished, or failed.

## Follow-ups that wait their turn (Sprint 104)

- **Queue several prompts per chat.** While an agent works, keep typing — each Enter adds to a visible **Queued · n/10** list you can edit, reorder, or remove before it runs. Nothing is silently dropped, and the composer never locks.
- **Comments queue too.** Sending an assigned comment to a busy agent now waits its turn in that agent's own thread instead of disappearing.
- **The queue respects your checkpoints.** A plan waiting for review, a question, or an approval pauses draining; a failed turn holds the queue until you press Resume.

## Plans you can actually review (Sprint 103)

- **Plan mode is now enforced, not promised.** Turn on the **Plan** chip and the agent plans in a technically read-only phase — Claude runs in the SDK's native plan mode, Codex plans in a read-only sandbox. Nothing in your workspace changes until you approve the plan.
- **The plan always shows up.** The review card appears reliably on the first attempt, shows the plan as rendered markdown with a verified *"No files changed yet."* line, and says who asked for the plan — including *"Claude chose to plan first"* when the agent decided on its own.
- **Approve & continue, or keep planning.** Approval continues execution in the same conversation under your autonomy choice; **Keep planning** sends your feedback back for a revised plan without anything running.
- **Simpler, honest controls.** The old `Auto / Ask / Plan` strip is now an autonomy select (**Manual** / **Auto**) plus the Plan chip; switching autonomy mid-thread keeps the agent's memory of your conversation. OpenCode shows no Plan control because it cannot enforce one — the UI no longer pretends otherwise.
- **A status line that tells the truth.** One line under the conversation shows what is actually happening — working, waiting for you (plan review / question / approval), done, failed, or stopped. "Done" never appears while something still needs you, the headline time is agent working time, and "Modified N files" counts only your workspace files.

## AI transparency

- **Know when you are interacting with AI.** A compact notice appears before the first AI sidebar interaction without blocking the composer. Its explicit **Don’t show again** action records the one-time acknowledgement.
- **See the current AI identity.** The disclosure names the selected runtime, provider/service, and model using the same state as the model picker.
- **Understand what may be shared.** The persistent **AI information** view—available from both the composer and Ritemark Settings—explains prompts, active files, selections, attachments, shared browser context, conversation handoffs, and tool results.
- **Review before relying on output.** Ritemark now states directly that approval controls do not verify correctness and that important facts, sources, calculations, commands, and changes need human review.
- **Separate AI processing from app analytics.** The information view explains that AI requests go directly through the selected runtime/provider, while anonymous Ritemark product analytics uses PostHog when enabled.

## Context accuracy fixes

- Removing the active-file chip now excludes that item for Codex and OpenCode turns as well as Claude Code turns.
- Switching runtimes no longer lets a stale model identifier from the previous runtime leak into the AI information view.
- Browser context is shown only for Claude Code and Codex, matching the host's actual injection behavior.
- OpenCode attachment payloads now reach the ACP runtime instead of stopping at the composer.

## Public information

The paired Ritemark website work is live with English and Estonian AI-information pages and corrected support claims. The counsel-approved Productory Terms and Privacy corrections are also published in English and Estonian.

## Still to come in v1.8.6

This file covers Sprint 102 only. Sprint 103–106 release notes will be added as those approved sprints are implemented.
