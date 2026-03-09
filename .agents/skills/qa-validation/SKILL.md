---
name: qa-validation
description: Run repository-specific quality gates before commit, push, merge, release, or readiness handoff. Use when the user asks if work is safe to ship, wants to commit or release, or when build-sensitive files changed.
---

# QA Validation

Run the project checks that catch the recurring failure modes in `ritemark-native`.

## When To Use

- The user mentions `commit`, `push`, `merge`, `PR`, `release`, `ship`, `ready`, `done`, or similar handoff language.
- Build-sensitive files changed and confidence matters.
- You need a concrete pass/fail answer before distribution work.

## Core Commands

Run these from repo root:

```bash
./scripts/validate-qa.sh
./scripts/release-preflight.sh        # for release/build readiness
```

## Workflow

1. Run `./scripts/validate-qa.sh`.
2. If the task is release-related, also run `./scripts/release-preflight.sh` before any version bump, tag, notarization, or packaging step.
3. If validation fails, stop and surface the exact failing check before suggesting fixes.
4. After fixes, re-run the same validation path instead of assuming the issue is gone.

## What `validate-qa.sh` Covers

- `vscode/extensions/ritemark` symlink integrity
- webview bundle size and CSS-processing sanity
- required webview config files
- extension TypeScript compilation
- targeted flow tests when flow-related files changed

## Shipping Contract

- Do not describe work as ready to commit or release if validation failed.
- If checks were skipped, state that explicitly and explain the risk.
