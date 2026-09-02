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

### Development Lifecycle Canon

Ritemark now uses a release-first DLC hierarchy:

```text
Release (`docs/development/releases/vX.Y.Z/` + GitHub milestone `vX.Y.Z`)
└── Sprints (`docs/development/releases/vX.Y.Z/sprint-NN-name/`)
    └── GitHub Issues (`Open → In sprint → Done`)
```

- Create the GitHub milestone as soon as a release enters `Mapped` state.
- Release-bound sprint folders live under their parent release folder, not under the old global `docs/development/sprints/` path.
- `release-plan.md` is the internal source of truth for sprint map, issue intake, risks/blockers, tracker, feature-complete state, and decisions.
- `docs/releases/vX.Y.Z/` is for release execution/public assets: test checklist, changelog, release notes, screenshots.
- DLC canon docs live in `docs/DLC/`.
- `.claude/agents/harness-equalizer.md` is a scheduled twice-daily drift checker that keeps the Codex harness aligned with the Claude canon (one-directional: CLAUDE -> CODEX). Treat it as a reviewer/maintainer, not as a new lifecycle state source.
- Do not equate `.agents/skills` with `.claude/agents`: Codex skills are procedural playbooks; Claude agents are role agents. Compare them by responsibility coverage only.

### Harness Governance (Claude is canon)

`CLAUDE.md` and `.claude/**` are the canonical harness; this file and `.agents/**` / `.codex/**` are derived from them ("additive to the existing `.claude/` setup"). Drift is reconciled one way only: **CLAUDE -> CODEX**. The `harness-equalizer` never edits the Claude side; if the canon looks wrong it flags it for Jarmo rather than changing it.

Codex has two distinct extension mechanisms, both kept in sync with their Claude counterparts:

- **Codex skills** — `.agents/skills/*/SKILL.md` — procedural playbooks. Counterpart of `.claude/skills/*`.
- **Codex role agents (subagents)** — `.codex/agents/*.toml` — standalone TOML files (`name`, `description`, `developer_instructions`; optional `model`, `mcp_servers`, `skills.config`), auto-discovered by Codex and spawned by `name`. Counterpart of `.claude/agents/*.md`.

These are different object types: a Claude role agent maps to a `.codex/agents/*.toml`, not to a skill, and a Codex agent should reference its matching skill rather than duplicate it. The Claude-runtime-only agents (`harness-equalizer`, `knowledge-builder`) have no Codex counterpart by design.

### Default Workflow

- Prefer existing project scripts in `scripts/` over ad hoc shell sequences.
- Run `node ./scripts/worktree-hygiene.mjs --check` after PR merge/close, at sprint close, before every RC, and weekly. Use `--clean` only after reviewing the report; the script must preserve dirty, unreadable, unpushed, upstream-less, active, current, primary, and locked worktrees.
- Before commit, push, merge, release, or "ready" handoff, use the `qa-validation` skill and run `./scripts/validate-qa.sh`.
- For release work, also use the `release-process` skill and run `./scripts/release-preflight.sh` before version bumps, tags, or build/distribution steps.
- Keep release-bound sprint documentation under `docs/development/releases/vX.Y.Z/sprint-NN-name/` aligned with implementation. Use `docs/development/sprints/` only for historical/non-release-bound legacy sprint docs.
- Before closing a sprint or handing work off as ready, check whether user-facing behavior changed. If it did, update `docs/CHANGELOG.md` and the relevant `docs/releases/<version>/release-notes.md`; if no release note is appropriate, record why in the sprint plan.
- If the sprint changes extension architecture (see Architecture Gate above), update `docs/development/architecture.md` before marking the sprint done.

### Hard Gates

- Do not develop on `main`. `main` is not a development branch.
- If the current branch is `main`, do not write implementation code until a dedicated feature branch exists for the sprint.
- Do not start implementation work before there is an explicit sprint under its parent release folder, unless the work is explicitly non-release-bound.
- Do not use the `sprint-workflow` skill unless the user explicitly asks for it. Sprint documentation rules still apply, but the skill itself is opt-in.
- A sprint may require an audit or research pass before implementation starts. Do that first when the scope is unclear, cross-cutting, or recovery/debugging heavy.
- Treat each sprint as one feature branch. Do not mix multiple sprint implementations on the same branch.
- If no sprint exists yet, stop at release/sprint setup, audit, and planning. Do not proceed into implementation changes in the same step as if the sprint already existed.
- A shell-release candidate must be built in a new worktree created by `./scripts/create-release-worktree.sh`. `build-prod.sh`, signing, and packaging must refuse a source that is not the exact `origin/main` commit, uses a symlinked/pre-patched VS Code tree, shares top-level dependency directories, reuses build output, or lacks matching embedded provenance. Full contract: `docs/development/release-process/BUILD-AND-WORKTREE-HYGIENE.md`.

### Skill Routing

- Use `vscode-development` for VS Code OSS builds, extension activation/loading, patch application, upstream updates, Node/toolchain issues, and `scripts/code.sh` or production build problems.
- Use `webview-development` for `extensions/ritemark/webview/`, TipTap, React, Vite, Tailwind, webview bundle issues, blank editor problems, and VS Code <-> webview bridge debugging.
- Use `qa-validation` before any commit/release readiness decision and after substantial build-sensitive changes.
- Use `release-process` for release planning, versioning, DMG/notarization, GitHub releases, and extension-only update packaging.
- Use `ritemark-flows` when creating or editing `.ritemark/flows/*.flow.json` or backend/frontend flow node integrations.
- Use `feature-flags` when adding gated, experimental, platform-specific, premium, or kill-switch features.
- Use `sprint-workflow` only when the user explicitly asks for that skill.
- Use `macos-screenshots` when you need a fresh screenshot of the full screen, an interactively selected window, or a specific macOS window for UI inspection.

### Reporting

- When validation or release checks fail, report the failing command, the affected path, and the smallest safe next action.
- When a task touches both VS Code shell code and webview code, use both relevant skills and keep the responsibilities separated in the explanation.
