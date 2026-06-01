# Sprint 77: Unified Agent Library Phase 1

Track: SDD
Branch: `claude/guitar-issues-69-70-sprint-6AquJ`
Status: Phase 2 (PLAN) — awaiting Jarmo approval before implementation

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (source of truth for requirements R1–R8)
- [scenarios.md](scenarios.md) — BDD examples (becomes the manual QA matrix)
- [technical-plan.md](technical-plan.md) — architecture, workstreams, type shapes, message protocol
- [tasks.md](tasks.md) — implementation checklist organised by phase
- [sprint-plan.md](sprint-plan.md) — this file (intent, status, product decisions)

## Agent Runtime Instructions

Any agent or human continuing Sprint 77 must follow this order before implementation:

1. Read this `sprint-plan.md`.
2. Read [spec.md](spec.md), [technical-plan.md](technical-plan.md), [scenarios.md](scenarios.md), and [tasks.md](tasks.md).
3. Treat [spec.md](spec.md) as the behaviour contract. If implementation reveals the spec is wrong, update spec first.
4. Treat [technical-plan.md](technical-plan.md) as the current architecture plan. If architecture diverges, update the tech plan before changing code.
5. Treat [tasks.md](tasks.md) as the running progress tracker. Only tick `[x]` when the corresponding code change is confirmed on the branch.
6. If scope expands mid-sprint, follow the Mid-Sprint Scope Change Protocol from the SDD skill (update spec → scenarios → tech plan → tasks → sprint-plan in that order, then write code).
7. Reference requirement IDs (`R1`, `R2`, …) in code comments and commit messages.

## Goal

Unify the two separate Ritemark agent sidebars into a single coherent panel, fix the Codex skill discovery bug introduced by an erroneous `.agents/agents/` scan, and ship a first-class structured editor for agent definition files — all in one sprint, closing GitHub issues #70 and #69 Phase 1.

## Linked Issues

- [#70 Agent Library: Codex agent discovery broken + missing provenance badges](https://github.com/ProductoryHQ/ritemark-native/issues/70)
- [#69 Agent Library: UX unification Phase 1](https://github.com/ProductoryHQ/ritemark-native/issues/69)

## MVP Scope

### WS1 — Discovery fix (#70)

Remove the erroneous `.agents/agents/*.md` scan from `discoverAgents()`. Add `provenance: 'claude' | 'codex' | 'shared'` to `DiscoveredCommand`. Deduplicate skills that exist in both roots into a single `shared` entry. Render provenance badges in the Agent Library sidebar.

### WS2 — Frontmatter extension + validator

Extend `parseFrontmatter` to handle YAML arrays, numbers, and booleans. Extend `DiscoveredAgent` with the eight new optional fields (`runtime`, `runtimeModel`, `schedule`, `routine`, `skills`, `allowedTools`, `maxBudgetUsd`, `worktree`). Add `validateAgentFrontmatter` export. Show yellow warning chip for agents with validation errors.

### WS3 — Sidebar merge

Remove the `ritemark-flows` activity bar container from `package.json` and the `ritemark.flowsView` registration from `extension.ts`. Add a Flows section to the Agent Library with click-to-edit and attachment indicator (R8).

### WS4 — agentEditor custom editor

New `AgentEditorProvider` (`vscode.CustomTextEditorProvider`) registered for `**/.claude/agents/*.md`. New Vite entry `agent-editor.js` in `webview/vite.config.ts`. New React component tree: `AgentEditorBody` (TipTap, left) + `Configurator` (right). Bidirectional frontmatter sync via `vscode.workspace.applyEdit`.

### WS5 — cronUtils + K6 banner

Install `cron-parser`. New `src/agent/cronUtils.ts` with `parseCronExpression`. K6 warning banner in Configurator Schedule field — dismissible per file path via `workspaceState`.

## Out of Scope

- Background scheduled agent execution (Phase 2).
- Codex agent discovery via `.agents/agents/` — the convention does not exist; the scan is removed.
- Changes to the main Ritemark Markdown editor (`ritemark.editor`).
- Auth-expiry recovery flow (Phase 2).
- `.agents/agents/` support for future Codex versions (evaluate in a dedicated sprint if Codex publishes a formal convention).

## Product Decisions

- **2026-06-01:** Sprint scope confirmed as one sprint (#70 + #69 Phase 1). Decided by Jarmo before sprint kickoff.
- **2026-06-01:** All four Phase 1 items from issue #69 are in scope (agentEditor, frontmatter + validator, sidebar merge, schedule UI + K6 banner). No items deferred.
- **2026-06-01:** agentEditor is a new combined webview (TipTap body + Configurator panel, brand new Vite entry) — not a sidebar panel. Decided by Jarmo.
- **2026-06-01:** Flows section in Agent Library is list + click-to-edit only. Run/schedule controls stay in the flow editor.
- **2026-06-01:** No feature flag for this sprint. All features on by default (CLAUDE.md hard rule).
- **2026-06-01:** Open questions from issue #69 resolved — local timezone for cron previews; per-agent configurable approval (default: auto-approve); broken routine = warning + disable; no commands schedule support; auth-expiry = notify-on-next-open in Phase 2.

## Feature Flag Check

No feature flag required for this sprint. None of the changes are experimental, platform-specific, or require a kill-switch. All features are on by default.

## Success Criteria

- [ ] `discoverAgents()` no longer scans `.agents/agents/` — no phantom agent entries in Codex workspaces (R1).
- [ ] Skills from `.claude/skills/` show `[claude]` badge; from `.agents/skills/` show `[codex]`; present in both show single `[shared]` entry (R2).
- [ ] The Agent Library panel contains a Flows section; the separate Flows activity bar icon is gone (R3).
- [ ] Clicking a flow in Agent Library opens the flow editor (R3).
- [ ] `DiscoveredAgent` exposes all eight new extended frontmatter fields; agents with invalid configurations show a yellow warning chip (R4).
- [ ] Opening a `.claude/agents/*.md` file launches the `ritemark.agentEditor` custom editor instead of the text editor (R5).
- [ ] The agent editor shows a TipTap body panel (left) and a Configurator panel (right) (R5).
- [ ] Every Configurator field writes back to the `.md` file on disk within ~300 ms of a change (R6).
- [ ] The schedule field shows a human-readable cron preview; the K6 banner appears when a schedule is set (R7).
- [ ] The K6 banner can be dismissed and stays dismissed across reopens of the same file (R7).
- [ ] Flows with a matching `routine:` reference show the agent name as an attachment label (R8).
- [ ] `npm run compile` passes in `extensions/ritemark`.
- [ ] `npm run build` passes for both webview entries (`index` + `agent-editor`).
- [ ] `./scripts/validate-qa.sh` passes.
- [ ] `docs/CHANGELOG.md` updated.
- [ ] GitHub issues #70 and #69 updated with sprint summary.

## HTML Prototypes

Visual reference prototypes are being produced separately:

- `prototypes/agent-library-sidebar.html` — revised Agent Library sidebar with Flows section, provenance badges, and warning chips.
- `prototypes/agent-editor-configurator.html` — agent editor layout showing TipTap body + Configurator panel split, all field groups, schedule preview, and K6 banner.

These prototypes are for visual alignment only; implementation uses the component tree described in `technical-plan.md`.

## Risks

| Risk | Mitigation |
|---|---|
| `cron-parser` v4/v5 API difference | Pin to v4 in `package.json`; check if v5 is already present in repo before installing |
| `**/.claude/agents/*.md` glob also matches user-level `~/.claude/agents/` files | Documented as Open Question in spec; accept for Phase 1, revisit if user reports unexpected activation |
| New Vite entry increases webview build time | Separate entry shares vendor chunks with `index`; should be minimal overhead |
| `AgentEditorProvider` + main `RitemarkEditorProvider` on same `.md` file (edge case: a `.claude/agents/*.md` file opened as Markdown) | Priority `default` means agentEditor wins; user can right-click → Open With → Text Editor if needed |
| `FlowStorage` API surface not designed for direct import into `AgentLibraryViewProvider` | Inspect `FlowStorage.ts` before implementation; if the API is unsuitable, introduce a thin adapter function rather than reworking `FlowStorage` |

## Approval

- [ ] Jarmo approved this sprint plan
