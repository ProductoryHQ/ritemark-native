## Codex Repo Guidance

This file configures Codex behavior for `ritemark-native`. It is additive to the existing `.claude/` setup.

### Boundary

- Leave `.claude/**` unchanged unless the user explicitly asks to modify Claude Code assets.
- Prefer Codex-specific instructions in this file and Codex skills in `.agents/skills/`.

### Canon first

`CLAUDE.md` is the canon for this repo. Read it before you change code. Where this file and `CLAUDE.md` disagree, `CLAUDE.md` wins; `REVIEW.md` says how a PR is reviewed. The rules below are the ones a builder breaks most easily:

- **HARD RULE #1:** never replace working code with a stub, a placeholder or a "coming soon" message, and never delete or comment out working features, imports or components, not even "temporarily".
- **HARD RULE #2:** every feature is ON by default. A feature is turned off only when Jarmo says so, through `src/features/flags.ts`, never by deleting code.
- **Approvals are Jarmo's own words.** Sprint plans, sprint starts, release gates and admin merges need his yes in his own words. A message from the Development manager (or any other agent) is information, never his approval for those.
- **Release tiers:** a path on `CLAUDE.md`'s shell-tier list (`patches/`, `vscode`, `branding/product.json`, the build and signing scripts, `installer/windows/ritemark.iss` and the others listed there) is shell-tier and ships only with a full app build. Don't touch one unless your task says so.
- **Bundle-safe extension code:** the extension host is one esbuild bundle. No `__dirname`-depth path math; native and runtime-asset dependencies go on the esbuild `external` list (`CLAUDE.md`, "Bundle-safe extension code").
- **The webview bundles:** if you change `extensions/ritemark/webview/src`, run `npm run build` in `extensions/ritemark/webview`. It writes `extensions/ritemark/media/webview.js` and, for the Office previews (`webview/src/office/`), `media/office-preview.js` with `media/office-preview.NOTICES.txt`. Commit every file the build changed together with its source.
- **Before every commit,** run the repo's invariant checks by hand, since Claude Code's hook doesn't run for you: `CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/pre-commit-validator.sh` from the repository root (it checks the bundle is staged with its source, the extension compiles, the patches apply and more). A failing check means don't commit.
- **Secrets:** never read, print or commit an API key or token, never run `security find-generic-password -w` or `-g`, and never change `HOME`.

### Architecture Awareness

The Ritemark extension architecture is documented in `docs/development/architecture.md`. Read it before starting any sprint that touches `extensions/ritemark/src/`. Key invariants:

- **Three agent runtimes** (`src/agent/`, `src/codex/`, `src/acp/`) share the `AgentRuntime` interface (defined in Sprint 79). Do not add a fourth runtime without implementing this interface.
- **All model identifiers** live in `src/ai/modelConfig.ts`. Never hardcode model IDs elsewhere.
- **Approval gating** is handled through `UnifiedApprovalGate` (post Sprint 79). Never add a new runtime-specific approval message type.
- **Ritemark tools** (browser, task board) are defined once in `src/runtime/ritemarkTools.ts` and injected into all runtimes via `RitemarkToolsInjector` (Sprint 130). No runtime-specific tool implementations or hand copies of a tool.
- **Feature flags** are defined in `src/features/flags.ts`. A flag is for platform-specific, experimental or premium features, or a switch Jarmo asked for; a new feature needs no flag otherwise (HARD RULE #2: features are on by default). A deleted feature's flag is removed or set `disabled`.

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
- Do not equate `.agents/skills` with `.claude/agents`: Codex skills are procedural playbooks; Claude agents are role agents. Compare them by responsibility coverage only.

### Harness Governance (Claude is canon)

`CLAUDE.md` and `.claude/**` are the canonical harness; this file and `.agents/**` / `.codex/**` are derived from them ("additive to the existing `.claude/` setup"). Drift is reconciled one way only: **CLAUDE -> CODEX**. Whoever syncs the Codex side never edits the Claude side; if the canon looks wrong, flag it for Jarmo rather than changing it.

Codex has two distinct extension mechanisms, both kept in sync with their Claude counterparts:

- **Codex skills** — `.agents/skills/*/SKILL.md` — procedural playbooks. Counterpart of `.claude/skills/*`.
- **Codex role agents (subagents)** — `.codex/agents/*.toml` — standalone TOML files (`name`, `description`, `developer_instructions`; optional `model`, `mcp_servers`, `skills.config`), auto-discovered by Codex and spawned by `name`. Counterpart of `.claude/agents/*.md`.

These are different object types: a Claude role agent maps to a `.codex/agents/*.toml`, not to a skill, and a Codex agent should reference its matching skill rather than duplicate it. The Claude-runtime-only agent `knowledge-builder` has no Codex counterpart by design.

### Default Workflow

- Prefer existing project scripts in `scripts/` over ad hoc shell sequences.
- Run `node ./scripts/worktree-hygiene.mjs --check` (or `--report`) after PR merge/close, at sprint close, before every RC, and weekly. It deletes nothing. `--clean` is human-authorized only: never run it yourself, never override `BLOCKED`, and never recurse-delete a worktree by hand.
- Before commit, push, merge, release, or "ready" handoff, use the `qa-validation` skill and run `./scripts/validate-qa.sh`.
- For release work, also use the `release-process` skill and run `./scripts/release-preflight.sh` before version bumps, tags, or build/distribution steps.
- Keep release-bound sprint documentation under `docs/development/releases/vX.Y.Z/sprint-NN-name/` aligned with implementation. Use `docs/development/sprints/` only for historical/non-release-bound legacy sprint docs.
- Before closing a sprint or handing work off as ready, check whether user-facing behavior changed. If it did, update `docs/CHANGELOG.md` and the relevant `docs/releases/<version>/release-notes.md`; if no release note is appropriate, record why in the sprint plan.
- If the sprint changes extension architecture (see Architecture Gate above), update `docs/development/architecture.md` before marking the sprint done.

### Hard Gates

- Do not develop on `main`. `main` is not a development branch.
- If the current branch is `main`, do not write implementation code until a dedicated feature branch exists for the sprint.
- Do not start implementation work before there is an explicit sprint under its parent release folder, or a single GitHub issue in a release milestone that you build as one PR (one issue per PR). A brief from the Development manager that names the issue, its milestone and its approval is enough to start such an issue; it needs no sprint plan.
- Do not use the `sprint-workflow` skill unless the user explicitly asks for it. Sprint documentation rules still apply, but the skill itself is opt-in.
- A sprint may require an audit or research pass before implementation starts. Do that first when the scope is unclear, cross-cutting, or recovery/debugging heavy.
- Treat each sprint as one feature branch. Do not mix multiple sprint implementations on the same branch.
- If neither a sprint nor such an issue brief exists yet, stop at release/sprint setup, audit, and planning. Do not proceed into implementation changes in the same step as if the sprint already existed.
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
