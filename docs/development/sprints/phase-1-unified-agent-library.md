# Phase 1: Unified Agent Library — Sprint Planning Artifacts

**Epic:** #69 Unified Agent Library (https://github.com/ProductoryHQ/ritemark-native/issues/69)
**Pre-requisite:** Issue #70 — Codex `.agents/` discovery fix (must merge before Phase 1 starts)
**Sprint number:** Sprint 71 (follows sprint 70, which resolves issue #70)
**Status:** Plan — awaiting Tier 3 (sprint-level) approval from Jarmo

---

## Deliverable 1: Phase 1 Implementation Plan

### Sprint Goal

Introduce the `ritemark.agentEditor` custom editor with full Configurator panel, merge `flowsView` into a unified four-section `agentLibraryView`, add `cron-parser`-backed scheduling with a warning banner, and extend frontmatter parsing to recognise the eight new agent keys — all in one PR that is independent of Phase 2.

---

### Task Breakdown

#### T1 — Extend `DiscoveredAgent` type and frontmatter loader
**Files:** `extensions/ritemark/src/agent/discovery.ts`, `extensions/ritemark/src/agent/types.ts`

The current `parseFrontmatter()` function returns `Record<string, string>` and only surfaces `name`, `description`, `displayName`, `icon`, `color`, and `user-invocable`. Eight new keys must be parsed and validated:

| Key | Expected type | Notes |
|---|---|---|
| `runtime` | `'claude-code' \| 'codex'` | Which CLI backend runs this agent |
| `runtimeModel` | string | Model hint forwarded to the runtime |
| `schedule` | cron string | Replaces `intervalMinutes` in new agents |
| `routine` | string | Free-text trigger description |
| `skills` | comma- or YAML-list | Referenced skill slugs |
| `allowedTools` | comma- or YAML-list | Tool whitelist |
| `maxBudgetUsd` | number | Cost cap — stored only, not enforced in Phase 1 |
| `worktree` | string | Path to a separate git worktree |

Extend `DiscoveredAgent` to carry these fields (all optional — existing agents continue working without them). Add a `validateAgentFrontmatter()` function that returns typed fields plus a `warnings: string[]` array for the UI badge.

Effort: 1.5 days

---

#### T2 — Add `cron-parser` dependency and cron utility module
**Files:** `extensions/ritemark/package.json` (production dependency), new `extensions/ritemark/src/agent/agentSchedule.ts`

`intervalMinutes` in `FlowSchedule` is a Ritemark Flows concept. Agent scheduling in Phase 1 is a parallel concept stored as a cron string in the agent frontmatter, not in flow JSON. Tasks:

- Add `cron-parser` npm package (production, not devDependency — bundled into extension).
- Create `agentSchedule.ts` with:
  - `parseCronExpression(expr: string): CronParseResult` (wraps `cron-parser`, returns `{ valid: boolean, next: Date | null, humanReadable: string, error?: string }`).
  - `cronToHumanReadable(expr: string): string` (e.g. `"0 9 * * 1-5"` → `"Weekdays at 09:00"`).
  - `convertIntervalMinutesToCron(minutes: number): string` (migration helper for the "convert to cron" UI affordance).
- No scheduler execution in Phase 1 — the module is consumed only by the editor UI and sidebar badge.

Effort: 1 day

Dependency: none (can run in parallel with T1)

---

#### T3 — `ritemark.agentEditor` custom editor provider
**Files:** new `extensions/ritemark/src/agent/AgentEditorProvider.ts`, `extensions/ritemark/package.json`

Register a new `CustomTextEditorProvider` for `.md` files inside `.claude/agents/` and `~/.claude/agents/`. The editor renders a split view: raw markdown on the left, Configurator panel on the right (implemented as an inline webview panel, not the webview bundle — this editor lives in the extension host, same pattern as `AgentLibraryViewProvider`).

Configurator panel sections:
- **Identity** — name, description, icon picker (reuse `ICONS`/`COLORS` from `iconPack.ts`).
- **Runtime** — picker: `claude-code` | `codex`; model sub-picker (drives `runtimeModel`); cost-source explanation string next to the picker (Phase 1 only — no enforcement).
- **Schedule** — cron input field; human-readable preview (from T2 `cronToHumanReadable`); warning banner (see T5); "convert from interval minutes" affordance if legacy field detected.
- **Capabilities** — `skills` multi-select (populated from `discoverCommands()` skills list), `allowedTools` text field, `maxBudgetUsd` numeric field (stored only).
- **Worktree** — path input with filesystem validation.

The provider writes back to the underlying `.md` file via `vscode.workspace.applyEdit` on the frontmatter block only — it never touches the markdown body.

Registration in `package.json`: add `"onCustomEditor:ritemark.agentEditor"` to `activationEvents` and a `customEditors` contribution point targeting `**/.claude/agents/*.md` and `**/.agents/agents/*.md`.

Effort: 3 days

Dependencies: T1 (for typed fields), T2 (for schedule preview)

---

#### T4 — Sidebar refactor: merge `flowsView` into `agentLibraryView`
**Files:** `extensions/ritemark/src/views/AgentLibraryViewProvider.ts`, `extensions/ritemark/src/flows/FlowsViewProvider.ts`, `extensions/ritemark/src/views/UnifiedViewProvider.ts`, `extensions/ritemark/package.json`

Current state: `ritemark.agentLibraryView` renders three sections (Agents / Skills / Commands). `ritemark.flowsView` is a separate view container entry. Phase 1 merges both into `agentLibraryView` with four sections:

| Section | Data source | + affordance |
|---|---|---|
| Agents | `discoverAgents()` | Yes — opens "New agent" modal (existing) |
| Skills | `discoverCommands()` filtered to `source === 'skills'` | Yes — opens "New skill" modal (existing) |
| Commands | `discoverCommands()` filtered to `source === 'commands'` | No (existing behaviour) |
| Flows | `FlowStorage.listFlows()` | Yes — maps to existing `ritemark.flows.new` command |

All existing context-menu actions on Agents/Skills/Commands rows are preserved verbatim. Flows rows get a subset: Run, Open in editor, Reveal in Finder, Delete.

`FlowsViewProvider` remains registered (the view type `ritemark.flowsView` stays in `package.json` to avoid breaking existing keybindings and settings serialisation) but is rendered with zero height / collapsed by default, with an informational message pointing users to `agentLibraryView`. This avoids a breaking serialisation change.

The `_sendItems()` message in `AgentLibraryViewProvider` gains a `flows` array property. The inline webview JS gains a fourth `renderSection` call.

Effort: 2 days

Dependencies: none (parallel with T2)

---

#### T5 — Schedule warning banner
**Files:** `extensions/ritemark/src/agent/AgentEditorProvider.ts` (inside the Configurator panel webview HTML), `extensions/ritemark/src/views/AgentLibraryViewProvider.ts` (sidebar badge)

Two surfaces:

1. **Configurator panel banner** — rendered inside the Schedule section whenever `schedule` is a non-empty cron string. Fixed amber banner: "Scheduled agent runs require the Ritemark app to be open. Runs are skipped while the app is closed." Uses the same amber `#F59E0B` token already present in `AgentLibraryViewProvider.ts`.

2. **Sidebar badge** — agents with a valid `schedule` field get a clock icon next to their name in the Agents section, with a tooltip showing the next scheduled run time (from `parseCronExpression().next`). No run is actually triggered in Phase 1 — the badge is informational only.

Effort: 0.5 days

Dependencies: T2 (for `parseCronExpression`), T3 (Configurator panel must exist)

---

#### T6 — Agent-attached flow indicator + bidirectional jump
**Files:** `extensions/ritemark/src/views/AgentLibraryViewProvider.ts`, `extensions/ritemark/src/agent/discovery.ts`, `extensions/ritemark/src/flows/FlowStorage.ts`

Agent `.md` files can reference flows via a frontmatter key (Phase 1 introduces a convention: `attachedFlow: <flow-id>`). The sidebar Agents section shows a flow-link chip on any agent with this key. Clicking the chip fires `'ritemark.loadFlow'` to open that flow in the editor. In the Flows section, if a flow's `id` matches a discovered agent's `attachedFlow`, the flow row shows an agent-link chip. Clicking navigates to that agent file via `vscode.open`.

Discovery implementation: extend `discoverAgentsInRoot()` to surface `attachedFlow?: string` from parsed frontmatter. `FlowStorage.listFlows()` already returns `Flow` objects including `id` — no storage change needed. The cross-reference join happens in `AgentLibraryViewProvider._sendItems()` before postMessage.

Effort: 1 day

Dependencies: T1 (extended frontmatter), T4 (Flows section must be in the sidebar)

---

#### T7 — Cost-source explanation strings in runtime picker
**Files:** `extensions/ritemark/src/agent/AgentEditorProvider.ts`

Inside the Configurator panel Runtime section, display a read-only explanation string beneath the runtime picker and model sub-picker. Content is static per selection:

- `claude-code` + any model → "Cost charged to your Anthropic API key (or Claude.ai subscription via OAuth). No budget enforcement in Ritemark yet."
- `codex` + any model → "Cost charged to your OpenAI account. No budget enforcement in Ritemark yet."

These strings are authored as constants in `AgentEditorProvider.ts`. No backend calls. `maxBudgetUsd` field is rendered as a numeric input with placeholder `e.g. 2.00` and a note: "Budget limit stored for future enforcement. Not active in this version."

Effort: 0.25 days (part of T3 build-out, listed separately for tracking)

Dependencies: T3

---

#### T8 — Telemetry events behind `analytics` flag
**Files:** `extensions/ritemark/src/analytics/events.ts`, `extensions/ritemark/src/agent/AgentEditorProvider.ts`, `extensions/ritemark/src/views/AgentLibraryViewProvider.ts`

Add three new typed event names to `EventName` union in `events.ts`:
- `agent_editor_opened` — fired when `AgentEditorProvider` resolves; properties: `{ runtime: string, hasSchedule: boolean }`.
- `agent_library_section_used` — fired when user interacts with any of the four sections; properties: `{ section: 'agents' | 'skills' | 'commands' | 'flows', action: 'open' | 'create' | 'delete' | 'move' }`.
- `agent_schedule_configured` — fired when a valid cron string is written back; properties: `{ cronExpression: string }`.

All three calls are wrapped in `if (isEnabled('analytics'))` before dispatch to PostHog. No new flag is needed — the existing `analytics` flag covers these.

Effort: 0.5 days

Dependencies: T3, T4

---

### Dependency Graph

```
T1 (types + frontmatter loader)
  ├── T3 (AgentEditorProvider)
  │     ├── T5 (schedule banner — Configurator side)
  │     ├── T7 (cost strings — inside T3)
  │     └── T8 (telemetry — editor events)
  └── T6 (bidirectional flow indicator)

T2 (cron-parser + agentSchedule.ts)
  ├── T3 (schedule preview in Configurator)
  └── T5 (sidebar badge next-run time)

T4 (sidebar merge flowsView → agentLibraryView)
  ├── T6 (Flows section needed for bidirectional jump)
  └── T8 (telemetry — library section events)

T5 depends on T2 + T3
T6 depends on T1 + T4
T7 depends on T3
T8 depends on T3 + T4
```

Critical path: T1 → T3 → T5/T7/T8 (longest chain, ~5 days end-to-end)

---

### Effort Summary

| Task | Effort |
|---|---|
| T1 — Frontmatter loader + types | 1.5 days |
| T2 — cron-parser module | 1.0 day |
| T3 — AgentEditorProvider | 3.0 days |
| T4 — Sidebar refactor | 2.0 days |
| T5 — Schedule warning banner | 0.5 days |
| T6 — Flow indicator + jump | 1.0 day |
| T7 — Cost-source strings | 0.25 days |
| T8 — Telemetry events | 0.5 days |
| **Total** | **9.75 days (~2 sprints)** |

T2 and T4 can run in parallel with T1, compressing wall-clock time to approximately 6–7 days of focused work.

---

### Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `cron-parser` bundle size blows the extension size check in `pre-commit-validator.sh` | Medium | High | Check current extension size limit in the hook before adding the package. `cron-parser` is ~35KB minified. If the limit is tight, evaluate `cronstrue` (parse only, human-readable generation; smaller) or write a minimal subset parser for Phase 1 cron patterns. |
| `CustomTextEditorProvider` for `.md` files inside `.claude/agents/` conflicts with the existing `ritemark.editor` provider (which opens all `.md` files) | High | High | The new provider must use a narrower glob (`**/.claude/agents/*.md`) and confirm VS Code resolves specificity correctly. Test in dev mode before committing. Fallback: register as a secondary editor only (user selects "Open with → Agent Editor") rather than the default. |
| Merging `FlowsViewProvider` state into `AgentLibraryViewProvider` causes the flow schedule state (`FlowScheduleState`, `workspaceState`) to be lost on sidebar refresh | Medium | Medium | Keep `FlowsViewProvider` instantiated — only its rendered view is collapsed. The sidebar's Flows section calls `FlowStorage.listFlows()` directly (read-only) for display; execution still goes through `FlowsViewProvider`. |
| Frontmatter YAML lists (`skills`, `allowedTools` as multi-value) — the current `parseFrontmatter()` treats all values as strings. YAML list syntax (leading `- item`) is not parsed | High | Medium | Extend `parseFrontmatter()` to detect and parse inline lists (`[a, b]`) and block sequences. Add tests. This is a contained change but easy to underestimate. |
| Issue #70 slips and Phase 1 starts without the `.agents/` discovery fix, causing project-scoped agents in `.agents/agents/` to appear but not be editable via the new `AgentEditorProvider` | Low | Low | Both `discoverAgents()` and `discoverCommandsInRoot()` already include `.agents/` paths (added during the #70 attempt — see discovery.ts lines 231 and 355). The remaining gap in #70 is narrower than expected (see Deliverable 4). Risk is manageable. |
| Schedule warning banner copy creates unrealistic user expectations about future automation | Low | Medium | Banner copy reviewed by Jarmo before Phase 1 ships. Keep phrasing factual: "Runs are not automatic — scheduling UI is a preview." Adjust based on Epic #69 Phase 2 timeline. |

---

## Deliverable 2: Phase 1 Explicit Non-Goals

The following items are part of Epic #69's overall scope but are **deferred to Phase 2 or later**. They must not appear in the Phase 1 PR.

### Deferred to Phase 2

1. **Budget enforcement** — `maxBudgetUsd` frontmatter field is parsed and stored in Phase 1. The agent runtime does NOT read it, clamp spend, or abort on overage. A "(not enforced)" label is shown in the Configurator. Enforcement logic (tracking spend against the cap, interrupting the agent) is Phase 2.

2. **Agent execution from the Configurator** — The Phase 1 editor is a configuration surface only. There is no "Run now" button that invokes the agent from the editor panel. Execution continues through the existing AI sidebar (`UnifiedViewProvider`).

3. **Scheduled agent execution** — The `schedule` cron field is saved to disk and displayed with a human-readable preview and warning banner. The scheduler that reads these cron strings and triggers agent runs does NOT exist in Phase 1. Phase 2 implements the execution loop (analogous to `FlowScheduler.ts` for flows).

4. **`routine` field triggering** — The `routine` key is parsed and stored, but no trigger evaluation logic is implemented. Phase 2 will define what constitutes a routine trigger event.

5. **`worktree` field enforcement** — Parsed and stored. Phase 2 will pass the worktree path to `AgentRunner` as the `workspacePath` override.

6. **Agent versioning / locking** — No git-based or filesystem-based agent version pinning in Phase 1.

7. **User-level agent scheduling** — The sidebar displays `~/.claude/agents/` items but Phase 1 scheduling UI is intentionally scope-neutral (project-scoped agents and user-scoped agents both show the Configurator). Scheduling execution in Phase 2 will need to decide whether user-scoped agents can be scheduled per-workspace or globally.

### Deferred indefinitely (out of epic scope)

8. **Agent marketplace / remote agent discovery** — Phase 1 only surfaces local filesystem agents (`.claude/agents/` and `~/.claude/agents/`).

9. **Automatic cron conversion on save** — If a user has an existing agent with `intervalMinutes`, Phase 1 shows a "convert to cron" button but does NOT auto-migrate files on discovery. Migration is user-initiated only.

10. **Flow authoring from within the Configurator** — Linking an agent to a flow (via `attachedFlow`) requires the flow to already exist. Creating a new flow from the agent editor is not in Phase 1.

11. **Budget tracking across multiple agents** — Aggregated spend dashboards or per-agent cost history are not in Phase 1 or Phase 2 scope.

---

## Deliverable 3: Phase 1 Test Plan

### Test framework in use

Extension-side tests (`extensions/ritemark/src/**/*.test.ts`) use Node's built-in `assert` module, run with `npx tsx <file>` (no test runner framework — consistent with `flowSchedule.test.ts`, `featureGate.test.ts`, `setup.test.ts`).

Webview-side tests (`extensions/ritemark/webview/src/**/*.test.ts`) use the same `npx tsx` pattern with `assert` (see `lifecycle.test.ts`, `conversationModel.test.ts`, `runtimeSwitching.test.ts`).

No Jest, no Mocha, no Vitest. New tests must follow this exact pattern: standalone `*.test.ts` files with `console.log('Testing...')` preamble and `assert.*` calls.

---

### T1 Tests — Frontmatter loader + types

**File:** `extensions/ritemark/src/agent/discovery.test.ts` (new)

Cases to cover:
- Agent file with all eight new keys present and valid — parsed correctly into typed fields.
- Agent file with no new keys — `DiscoveredAgent` loads without error; all new fields are `undefined`.
- Agent file with a YAML block list for `skills` (`- sprint-manager\n- qa-validator`) — parsed into `string[]`.
- Agent file with an inline list for `allowedTools` (`[Bash, Read, Write]`) — parsed into `string[]`.
- `maxBudgetUsd: 2.50` — parsed as number `2.5`, not string.
- `maxBudgetUsd: not-a-number` — surfaces in `warnings[]`, field is `undefined`.
- `runtime: invalid-value` — surfaces in `warnings[]`, field is `undefined`.
- `schedule: 0 9 * * 1-5` (valid cron) — `validateAgentFrontmatter()` reports no warnings for this field.
- `schedule: not-cron` — surfaces in `warnings[]`.
- Existing agent file with no frontmatter at all — `hasFrontmatter: false`, no crash.
- Existing agent files in `ritemark-native/.claude/agents/` continue to load (regression fixture).

---

### T2 Tests — Cron parser module

**File:** `extensions/ritemark/src/agent/agentSchedule.test.ts` (new)

Cases to cover:
- `parseCronExpression('0 9 * * 1-5')` — `valid: true`, `humanReadable` contains "Weekdays" and "09:00", `next` is a future `Date`.
- `parseCronExpression('*/30 * * * *')` — `valid: true`, every-30-minutes schedule.
- `parseCronExpression('not-a-cron')` — `valid: false`, `error` non-empty.
- `parseCronExpression('')` — `valid: false`.
- `cronToHumanReadable('0 9 * * *')` — returns a non-empty string that contains "09:00".
- `cronToHumanReadable('0 9 * * 1-5')` — contains "Weekday" or equivalent.
- `convertIntervalMinutesToCron(30)` — returns `'*/30 * * * *'`.
- `convertIntervalMinutesToCron(60)` — returns `'0 * * * *'`.
- `convertIntervalMinutesToCron(1440)` — returns `'0 0 * * *'` (once daily).
- Round-trip: `parseCronExpression(convertIntervalMinutesToCron(15)).valid === true`.

---

### T3/T5/T7 Tests — AgentEditorProvider (Configurator panel)

The `CustomTextEditorProvider` requires a VS Code API context and cannot be unit-tested with `npx tsx`. Instead, cover the pure logic it delegates:

**File:** `extensions/ritemark/src/agent/agentConfigurator.test.ts` (new — pure functions only)

- `buildFrontmatterPatch(existing, updates)` — given a frontmatter map and a partial update map, returns a string that can be spliced back into the file. Verifies only the updated keys change; untouched keys remain; YAML format is valid.
- Warning banner visibility logic: `shouldShowScheduleWarning(frontmatter)` returns `true` iff `schedule` is a non-empty string with a valid cron.
- Cost string selection: `getCostSourceString('claude-code')` returns a string containing "Anthropic"; `getCostSourceString('codex')` returns a string containing "OpenAI".

Manual smoke test checklist (to be verified by Jarmo before PR merge):
- Open an agent `.md` file in `.claude/agents/` — Configurator panel appears alongside the markdown source.
- Change the runtime picker — `runtimeModel` sub-picker updates.
- Enter a valid cron expression — human-readable preview updates; warning banner is visible.
- Enter an invalid cron expression — preview shows error text; banner does not appear.
- Click "Convert from interval minutes" on an agent with `intervalMinutes: 30` — field is replaced with `schedule: '*/30 * * * *'`.
- Save — frontmatter in the `.md` file on disk reflects changes.

---

### T4 Tests — Sidebar refactor

The sidebar webview is inline HTML/JS (not a React component), so automated tests cover only the TypeScript provider logic.

**File:** `extensions/ritemark/src/views/agentLibrarySections.test.ts` (new)

- `buildSidebarItemsMessage(agents, commands, flows)` — returns an object with `agents`, `skills`, `commands`, `flows` arrays; skills and commands are correctly split from the input `commands` array by `source` field.
- Flows array is passed through without mutation.
- An agent with `attachedFlow: 'flow-abc'` and a flow in `flows` with `id: 'flow-abc'` — the returned agent has `flowLink: { id: 'flow-abc', name: '...' }` and the flow has `agentLink: { id: '...', name: '...' }`.
- An agent with no `attachedFlow` — no `flowLink` property on that agent item.

Manual smoke test checklist:
- Flows section appears below Commands in the sidebar with correct count badge.
- All existing context-menu actions on Agents, Skills, Commands rows work unchanged (Open, Duplicate, Reveal in Finder, Move scope, Delete).
- Flows rows show Run, Open, Reveal in Finder, Delete context actions.
- Search bar filters across all four sections simultaneously.
- Sort (name / recently modified) applies to all four sections.

---

### T6 Tests — Bidirectional flow indicator

**File:** Extend `extensions/ritemark/src/views/agentLibrarySections.test.ts` with additional cases (see T4 tests above — cross-reference join cases).

---

### T8 Tests — Telemetry events

**File:** Extend `extensions/ritemark/src/analytics/analytics.test.ts` (existing)

- New event names (`agent_editor_opened`, `agent_library_section_used`, `agent_schedule_configured`) are present in the `EventName` union and have corresponding entries in `EventPayloads` — verified by TypeScript compilation (no runtime test needed beyond `tsc` clean build).
- `isEnabled('analytics')` gate is exercised: when flag is disabled, `track()` is not called. Verify by passing a spy/stub through the existing `featureGate.test.ts` pattern.

---

### Pre-commit hook regression

`.claude/hooks/pre-commit-validator.sh` must continue to pass with no modifications. Key checks that Phase 1 touches:

- Extension symlink: unaffected (no symlink changes).
- Webview bundle freshness + size: Phase 1 adds no webview bundle changes (Configurator is inline HTML, not Vite-bundled). The `ai-sidebar` sentinel check is unaffected.
- Extension TS compiles: `tsc --noEmit` over `extensions/ritemark/src/` must pass with new files added.
- PostCSS / Tailwind: unaffected (no new webview bundle).

Run `npx tsx src/agent/discovery.test.ts`, `npx tsx src/agent/agentSchedule.test.ts`, `npx tsx src/agent/agentConfigurator.test.ts`, and `npx tsx src/views/agentLibrarySections.test.ts` as part of the Phase 4 validation checklist before invoking `qa-validator`.

---

### Regression: existing agents still load

**Fixture requirement:** At least one existing agent file from `.claude/agents/` (e.g., `sprint-manager.md`) must be included in the `discovery.test.ts` fixture set. The test must confirm:
- File loads without throwing.
- `hasFrontmatter: true` (these files have frontmatter).
- `description` is non-empty.
- No new fields (`runtime`, `schedule`, etc.) are set — all `undefined`.
- `warnings[]` is empty (no spurious warnings from missing optional fields).

---

## Deliverable 4: Updated Issue #70 Dependency Status

### What #70 targets

Issue #70: "Codex `.agents/` discovery fix" — the Claude Code SDK (from Anthropic) changed its project configuration root from `.claude/` to `.agents/` for agent definitions. Ritemark's discovery functions need to scan both roots.

### Current state of `discovery.ts`

Reading `extensions/ritemark/src/agent/discovery.ts` in full:

The fix for `.agents/` is **already partially in place**. Both `discoverAgents()` (line 231) and `discoverCommands()` (line 355 equivalent) call their respective `*InRoot()` helpers with both paths:

```
discoverAgentsInRoot(path.join(workspacePath, '.claude'), 'project')
discoverAgentsInRoot(path.join(workspacePath, '.agents'), 'project')
```

So the workspace-level `.agents/` root is already scanned. The same dual-root pattern applies for commands.

### What remains broken per #70

Three gaps remain:

1. **`discoverAgentsInRoot()` looks for agents inside `<root>/agents/`** — i.e., it scans `<root>/agents/*.md`. For `.claude/` this is `.claude/agents/*.md` (correct). For `.agents/` this is `.agents/agents/*.md`. The Codex/Anthropic convention is `.agents/*.md` directly (no sub-directory). The subdirectory assumption means `.agents/sprint-manager.md` is NOT discovered — only `.agents/agents/sprint-manager.md` would be.

2. **CLAUDE.md / AGENTS.md root check uses `path.dirname(claudeRoot)`** — for `.claude/` this resolves to the project root (correct). For `.agents/` as the `claudeRoot`, `path.dirname('.agents/')` also resolves to the project root. This part is fine.

3. **User-level `.agents/` is not scanned** — `discoverAgents()` only checks `os.homedir() + '/.claude'` for the user scope. There is no corresponding `os.homedir() + '/.agents'` check.

### Concrete file edits needed to satisfy #70

**Edit 1 in `discoverAgentsInRoot()`** — add a secondary scan path for when `claudeRoot` ends with `.agents`:

The function currently does:
```typescript
const agentsDir = path.join(claudeRoot, 'agents');
```

For `.agents/` roots, agents live directly in the root, not in a `agents/` subdirectory. Change to:
```typescript
const rootBase = path.basename(claudeRoot);
const agentsDir = rootBase === '.agents'
  ? claudeRoot                           // .agents/*.md directly
  : path.join(claudeRoot, 'agents');     // .claude/agents/*.md
```

The same fix is needed in `discoverCommandsInRoot()` for commands and skills sub-paths.

**Edit 2 in `discoverAgents()` and `discoverCommands()`** — add user-level `.agents/` scan:

```typescript
const userAgents = path.join(os.homedir(), '.agents');
if (fs.existsSync(userAgents)) {
  addAgents(discoverAgentsInRoot(userAgents, 'user'));
}
```

Mirror this in `discoverCommands()`.

These edits touch two functions in one file (`discovery.ts`), totalling approximately 15–20 lines changed.

### Estimated remaining effort for #70

**Less than 0.5 days.** The discovery architecture already has the dual-root plumbing — the two targeted edits above are surgical. The remaining effort is:
- The code changes (1–2 hours).
- New test cases in a `discovery.test.ts` fixture: confirm `.agents/sprint-manager.md` is discovered (not `.agents/agents/sprint-manager.md`) and user-level `~/.agents/sprint-manager.md` is discovered.
- A pre-commit hook pass.

### Recommendation

**Ship #70 as its own PR before Phase 1 starts.** Reasons:

1. The fix is self-contained in one file with no dependency on any Phase 1 work. Interleaving it into the Phase 1 PR adds noise to review and makes the #70 fix harder to verify in isolation.
2. The Phase 1 `AgentEditorProvider` registers itself for `.agents/agents/*.md` glob — if #70 is not merged first, the registration glob may be incorrect and would need patching again.
3. Sprint 70 (resolving #70) is estimated at under half a day of implementation plus one day of review/merge cycle — it can close well before Phase 1 implementation begins.

If timeline pressure makes interleaving necessary, #70's two edits can be the first commit in the Phase 1 PR with a clear commit message separating the fix from the feature work.

---

## Sprint Status

**Track:** Full 6-phase
**Current Phase:** 2 — Plan
**Gate:** BLOCKED — awaiting Tier 3 approval from Jarmo

## Approval

- [ ] Jarmo approved this sprint plan
