---
date: '2026-05-09'
title: 'Ritemark v1.6.4 — Minor Updates'
author: Jarmo Tuisk
tags:
  - minor-updates
draft: true
---

# Ritemark v1.6.4 — Minor Updates

A small follow-up to v1.6.3 with three Settings/Agent fixes and a cross-platform improvement to the pre-commit validator.

> Draft. More fixes may land before the v1.6.4 ship — release notes will be expanded as items are added.

## Minor updates

-   **Settings page cleanup.** The orphaned **AI Model** dropdown is gone — it fed only the legacy "Ritemark AI Assistant" runtime that was retired in v1.6.3 when the agent selector dropped the legacy entry. (Issue [#55](https://github.com/ProductoryHQ/ritemark-native/issues/55).)

-   **Features section retired.** The Voice Dictation, Ritemark Flows, and Codex Integration toggles in Settings have been removed. The first two were `stable` flags whose toggles did nothing; **Codex Integration** is now promoted from `experimental` to `stable` so it stays on by default. The Codex auth card no longer points at a Features section that no longer exists. (Issue [#56](https://github.com/ProductoryHQ/ritemark-native/issues/56).)

-   **Agent display-name casing preserved.** The Agent Library now respects branded casing for shipped agents — **UX Expert**, **PR Reviewer**, **QA Validator**, **VS Code Expert** — instead of lowercasing acronyms ("Ux Expert", "Pr Reviewer", etc.). Custom agents can opt in by adding a `displayName:` field to the frontmatter. (Issue [#50](https://github.com/ProductoryHQ/ritemark-native/issues/50).)

## Under the hood

-   **Cross-platform pre-commit validator.** The hook used BSD `stat -f%z` (macOS only) and unconditionally required the `vscode/extensions/ritemark` symlink, blocking commits on Linux (e.g. Claude Code on the web) even when no real invariant was violated. Replaced with a portable `file_size` helper and a soft-fail when the `vscode/` submodule isn't initialized.

* * *

PRs included so far:

-   PR [#59](https://github.com/ProductoryHQ/ritemark-native/pull/59) — fix: resolve #50, #55, #56 + cross-platform pre-commit hook
