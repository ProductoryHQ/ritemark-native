## Codex Repo Guidance

This file configures Codex behavior for `ritemark-native`. It is additive to the existing `.claude/` setup.

### Boundary

- Leave `.claude/**` unchanged unless the user explicitly asks to modify Claude Code assets.
- Prefer Codex-specific instructions in this file and Codex skills in `.agents/skills/`.

### Architecture Awareness

The Ritemark extension architecture is documented in `docs/development/architecture.md`. Read it before starting any sprint that touches `extensions/ritemark/src/`. Key invariants:

- **Three agent runtimes** (`src/agent/`, `src/codex/`, `src/acp/`) share the `AgentRuntime` interface (defined in Sprint 79). Do not add a fourth runtime without implementing this interface.
- **All model identifiers** live in `src/ai/modelConfig.ts`. Never hardcode model IDs elsewhere.
- **Approval gating** is handled through `UnifiedApprovalGate` (post Sprint 79). Never add a new runtime-specific approval message type.
- **Browser tools** are injected via `BrowserToolsInjector` → MCP server path. Do not add new runtime-specific browser tool implementations.
- **Feature flags** are defined in `src/features/flags.ts`. New features require a flag entry. Deleted features require the flag to be removed or set `disabled`.

**Sprint Architecture Gate:** If a sprint changes module structure, webview message contracts, feature flags, or the binary manifest, update `docs/development/architecture.md` as part of the sprint close. The `Last updated` date in that document must be ≥ the sprint branch creation date.

### Default Workflow

- Prefer existing project scripts in `scripts/` over ad hoc shell sequences.
- Before commit, push, merge, release, or "ready" handoff, use the `qa-validation` skill and run `./scripts/validate-qa.sh`.
- For release work, also use the `release-process` skill and run `./scripts/release-preflight.sh` before version bumps, tags, or build/distribution steps.
- Keep sprint documentation under `docs/development/sprints/` aligned with implementation when the task is part of an explicit sprint.
- Before closing a sprint or handing work off as ready, check whether user-facing behavior changed. If it did, update `docs/CHANGELOG.md` and the relevant `docs/releases/<version>/release-notes.md`; if no release note is appropriate, record why in the sprint plan.
- If the sprint changes extension architecture (see Architecture Gate above), update `docs/development/architecture.md` before marking the sprint done.

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
