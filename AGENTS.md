## Codex Repo Guidance

This file configures Codex behavior for `ritemark-native`. It is additive to the existing `.claude/` setup.

### Boundary

- Leave `.claude/**` unchanged unless the user explicitly asks to modify Claude Code assets.
- Prefer Codex-specific instructions in this file and Codex skills in `.agents/skills/`.

### Default Workflow

- Prefer existing project scripts in `scripts/` over ad hoc shell sequences.
- Before commit, push, merge, release, or "ready" handoff, use the `qa-validation` skill and run `./scripts/validate-qa.sh`.
- For release work, also use the `release-process` skill and run `./scripts/release-preflight.sh` before version bumps, tags, or build/distribution steps.
- Keep sprint documentation under `docs/development/sprints/` aligned with implementation when the task is part of an explicit sprint.

### Hard Gates

- Do not develop on `main`. `main` is not a development branch.
- If the current branch is `main`, do not write implementation code until a dedicated feature branch exists for the sprint.
- Do not start implementation work before there is an explicit sprint.
- Use the `sprint-workflow` skill to create or update the sprint before writing code.
- A sprint may require an audit or research pass before implementation starts. Do that first when the scope is unclear, cross-cutting, or recovery/debugging heavy.
- Treat each sprint as one feature branch. Do not mix multiple sprint implementations on the same branch.
- If no sprint exists yet, stop at sprint setup, audit, and planning. Do not proceed into code changes in the same step as if the sprint already existed.

### Skill Routing

- Use `vscode-development` for VS Code OSS builds, extension activation/loading, patch application, upstream updates, Node/toolchain issues, and `scripts/code.sh` or production build problems.
- Use `webview-development` for `extensions/ritemark/webview/`, TipTap, React, Vite, Tailwind, webview bundle issues, blank editor problems, and VS Code <-> webview bridge debugging.
- Use `qa-validation` before any commit/release readiness decision and after substantial build-sensitive changes.
- Use `release-process` for release planning, versioning, DMG/notarization, GitHub releases, and extension-only update packaging.
- Use `ritemark-flows` when creating or editing `.ritemark/flows/*.flow.json` or backend/frontend flow node integrations.
- Use `feature-flags` when adding gated, experimental, platform-specific, premium, or kill-switch features.
- Use `sprint-workflow` when the user is explicitly working inside the sprint process or asks for sprint plans/phases/docs.
- Use `macos-screenshots` when you need a fresh screenshot of the full screen, an interactively selected window, or a specific macOS window for UI inspection.

### Reporting

- When validation or release checks fail, report the failing command, the affected path, and the smallest safe next action.
- When a task touches both VS Code shell code and webview code, use both relevant skills and keep the responsibilities separated in the explanation.
