---
date: '2026-08-03'
title: 'Ritemark v1.8.6 — Clear Start, Trustworthy AI'
author: Jarmo Tuisk
status: Draft
sprints:
  - sprint-102
tags:
  - sprint-102
  - ai-transparency
  - privacy
  - human-review
---

# Ritemark v1.8.6 — Clear Start, Trustworthy AI

**Status:** Draft — Sprint 102 complete; remaining v1.8.6 sprints are not complete.  
**Release issue:** [#163 — AI transparency and policy alignment](https://github.com/ProductoryHQ/ritemark-native/issues/163)

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
