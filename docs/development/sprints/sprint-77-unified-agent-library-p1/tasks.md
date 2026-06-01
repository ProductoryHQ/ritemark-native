# Sprint 77 Tasks

## SDD Setup

- [x] Create sprint branch `claude/guitar-issues-69-70-sprint-6AquJ`.
- [x] Write `spec.md` with requirements R1–R8 and acceptance criteria.
- [x] Write `scenarios.md` with BDD scenarios for all requirements.
- [x] Write `technical-plan.md` with WS1–WS5, type shapes, and message protocols.
- [x] Write `tasks.md` (this file).
- [x] Write `sprint-plan.md` with SDD artifact links and product decisions.
- [ ] Jarmo reviews and approves SDD artifacts before implementation begins.

---

## Phase 1: Discovery fix (WS1 — R1 + R2)

### 1.1 Remove erroneous .agents agent scan (R1)

- [ ] In `extensions/ritemark/src/agent/discovery.ts`, remove the `discoverAgentsInRoot(path.join(workspacePath, '.agents'), 'project')` call from `discoverAgents()`.
- [ ] Verify `discoverAgents()` still scans `.claude/` (project) and `~/.claude/` (user).
- [ ] Run `npm run compile` in `extensions/ritemark` — must pass.
- [ ] Manual smoke: open Agent Library in dev build, confirm no phantom Codex agent section.

### 1.2 Add provenance field and tracking (R2)

- [ ] Add `provenance?: 'claude' | 'codex' | 'shared'` to `DiscoveredCommand` interface in `discovery.ts`.
- [ ] Add `framework: 'claude' | 'codex' = 'claude'` parameter to `discoverCommandsInRoot`.
- [ ] Stamp `provenance: framework` on every skill item pushed inside `discoverCommandsInRoot` (only items with `source: 'skills'`; commands items leave `provenance` undefined).
- [ ] Update both `discoverCommandsInRoot` call-sites in `discoverCommands()` to pass `'claude'` and `'codex'` respectively.

### 1.3 Dedup shared skills (R2)

- [ ] After collecting all skills from both roots in `discoverCommands()`, build a dedup map keyed by skill folder name.
- [ ] When the same folder name appears from both `claude` and `codex` roots, merge to a single entry with `provenance: 'shared'`; canonical `filePath` is the `.claude/` copy.
- [ ] Verify the merged entry appears only once in the returned array.
- [ ] Write a focused unit test: given two skills with the same `id` from `claude` and `codex` roots, assert `discoverCommands()` returns one entry with `provenance: 'shared'`.

### 1.4 Provenance badge rendering (R2)

- [ ] In `AgentLibraryViewProvider.ts`, for each skill row in the HTML template, render a small inline badge based on `cmd.provenance`:
  - `'claude'` → `<span class="badge badge-claude">[claude]</span>` (indigo)
  - `'codex'` → `<span class="badge badge-codex">[codex]</span>` (emerald)
  - `'shared'` → `<span class="badge badge-shared">[shared]</span>` (slate)
  - `undefined` (commands) → no badge
- [ ] Add CSS for the three badge variants in the webview `<style>` block.
- [ ] Manual smoke: open Agent Library, confirm badges appear correctly for each provenance type.

---

## Phase 2: Frontmatter extension and validator (WS2 — R4)

### 2.1 Extend parseFrontmatter (R4)

- [ ] Update `parseFrontmatter` in `discovery.ts` to broaden its return type to `Record<string, string | string[] | number | boolean>`.
- [ ] Handle inline YAML arrays: when a value matches `^\[.*\]$`, split on commas, trim each entry, return as `string[]`.
- [ ] Handle multi-line YAML lists: when the value after the key is empty and subsequent lines begin with `  -`, accumulate items as `string[]`.
- [ ] Handle bare numeric values: when `parseFloat(value) === Number(value)` and `value !== ''`, return as `number`.
- [ ] Handle `true` / `false` string values: return as `boolean`.
- [ ] Write unit tests covering: inline array, multi-line list, numeric, boolean, plain string, empty value.

### 2.2 Extend DiscoveredAgent with new optional fields (R4)

- [ ] Add optional fields to `DiscoveredAgent` interface: `runtime?`, `runtimeModel?`, `schedule?`, `routine?`, `skills?`, `allowedTools?`, `maxBudgetUsd?`, `worktree?` (types per spec).
- [ ] In `discoverAgentsInRoot`, after calling `parseFrontmatter(content)`, read the new fields from the parsed record and assign to the agent object before pushing it.
- [ ] Run `npm run compile` — must pass.

### 2.3 Add validateAgentFrontmatter (R4)

- [ ] Add `validateAgentFrontmatter(agent: DiscoveredAgent): string[]` export to `discovery.ts`.
- [ ] Implement the three validation rules per spec (schedule+runtime, schedule+routine, routine path existence).
- [ ] Write unit tests covering all four cases: valid agent, schedule-no-runtime, schedule-no-routine, routine-file-missing.

### 2.4 Warning chip in Agent Library (R4)

- [ ] In `AgentLibraryViewProvider.ts`, for each agent row, call `validateAgentFrontmatter(agent)`.
- [ ] If the result is non-empty, append `<span class="warning-chip" title="${htmlEscape(errors[0])}">⚠</span>` after the agent name.
- [ ] Add CSS for `.warning-chip` (yellow background, small font).
- [ ] Manual smoke: create an agent with `schedule:` and no `runtime:`, confirm chip appears with correct tooltip.

---

## Phase 3: Sidebar merge (WS3 — R3 + R8)

### 3.1 Remove ritemark-flows container from package.json (R3)

- [ ] Remove the `ritemark-flows` entry from `contributes.viewsContainers.activitybar` in `extensions/ritemark/package.json`.
- [ ] Remove the `"ritemark-flows": [...]` view entry from `contributes.views`.
- [ ] Remove `"onView:ritemark.flowsView"` from `activationEvents`.

### 3.2 Remove FlowsViewProvider registration from extension.ts (R3)

- [ ] In `extensions/ritemark/src/extension.ts`, remove the `FlowsViewProvider` instantiation and `vscode.window.registerWebviewViewProvider` call for `ritemark.flowsView`.
- [ ] Keep the `import` of `FlowsViewProvider` only if it is still used elsewhere; otherwise remove the import.
- [ ] Run `npm run compile` — must pass.

### 3.3 Add Flows section to AgentLibraryViewProvider (R3 + R8)

- [ ] Import `FlowStorage` in `AgentLibraryViewProvider.ts`.
- [ ] In `resolveWebviewView`, instantiate `FlowStorage` with the current workspace path and call `storage.listFlows()` (or equivalent API) to get the flow list.
- [ ] Build the attachment map: iterate `discoverAgents()` results; for each agent with a `routine` field, extract the basename stem of the routine path and map it to the agent's display name.
- [ ] Render a "Flows" section in the HTML template below Skills/Commands. Each flow row uses the HTML shape from the tech plan, including the attachment text when present (R8).
- [ ] Add a webview message handler for `{ type: 'openFlow', flowId }` that calls `vscode.commands.executeCommand('vscode.open', vscode.Uri.file(flowFilePath))`.
- [ ] Manual smoke: Flows section appears in Agent Library; clicking a flow opens it; no second activity bar icon is present.
- [ ] Manual smoke: A flow referenced by an agent shows the attachment label; a standalone flow shows only its name.

---

## Phase 4: Agent mode in existing editor (WS4 — R5 + R6)

### 4.1 Extend RitemarkEditorProvider with agent mode (R5)

- [ ] In `extensions/ritemark/src/views/RitemarkEditorProvider.ts`, detect agent mode: `const isAgentMode = /[\/\\]\.claude[\/\\]agents[\/\\][^\/\\]+\.md$/.test(document.uri.fsPath)`.
- [ ] When `isAgentMode` is true, extend the `init` message with: `frontmatter` (parsed via `parseFrontmatter`), `flows` (list of `.flow.json` stems), `skills` (all discovered skills with provenance), `authStatus`, `k6Dismissed` (from `workspaceState`).
- [ ] Add `serializeFrontmatter` helper to the provider file (per tech plan).
- [ ] Handle `applyFrontmatter` incoming message: serialise frontmatter, apply via `vscode.workspace.applyEdit` (debounce 300 ms, body preserved).
- [ ] Handle `dismissK6Banner` incoming message: write to `workspaceState`.
- [ ] Handle `createFlow` incoming message: scaffold blank `.flow.json`, send `flowsUpdated` back.
- [ ] Run `npm run compile` — must pass.

### 4.2 Extend App.tsx with 'agent' panel slot (R5)

- [ ] Add `'agent'` to the `activePanel` union: `'none' | 'toc' | 'properties' | 'agent'`.
- [ ] In the `init` message handler: if `isAgentMode`, set `activePanel` to `'agent'` and store the agent-specific payload in state (`agentFrontmatter`, `agentFlows`, `agentSkills`, `agentAuthStatus`, `agentK6Dismissed`).
- [ ] In the panel render row, add `{activePanel === 'agent' && <AgentConfiguratorPanel ... />}` — **before** the existing TOC/Properties conditionals.
- [ ] Handle `flowsUpdated` and `authStatusUpdated` messages from extension host; update state accordingly.

### 4.3 Create AgentConfiguratorPanel (R5 + R6)

- [ ] Create `extensions/ritemark/webview/src/components/agent/AgentConfiguratorPanel.tsx`.
- [ ] Panel outer div: `w-[220px] flex-shrink-0 h-full overflow-y-auto border-r border-hairline` with `style={{ background: 'var(--vscode-editor-background)' }}` — **identical to `PropertiesSidePanel`**.
- [ ] Panel inner: `flex flex-col gap-3 px-4 py-4`.
- [ ] Section heading `h2`: `text-[15px] font-semibold text-ink-strong` — "Agent".
- [ ] All form fields use **shadcn/ui components from `webview/src/components/ui/`** — no custom inputs, no custom CSS. Use `Input`, `Textarea`, `Select`, `Label`, `Checkbox`. Use Tailwind utilities for layout only.
- [ ] Section labels: `text-[11px] font-semibold text-ink-strong uppercase tracking-wide` (matches `PropertiesSidePanel` group header style).
- [ ] Section dividers: `<hr className="border-hairline my-1" />`.
- [ ] Run `npm run build` in `webview` — must pass.

### 4.4 Configurator field wiring (R6)

All fields debounce 300 ms before posting `applyFrontmatter`. Fields:

- [ ] **Identity** — `name` (shadcn `Input`), `description` (shadcn `Textarea` rows=3), `icon` (shadcn `Select` with Phosphor icon options), `color` (7 swatch `button`s).
- [ ] **Agent runtimes** — 4 `ritemark-filter-chip` buttons (`claude_local`, `codex_local`, `openai_api`, `anthropic_api`). Each shows a `ritemark-dot` auth status. On mount and on change, read `authStatus` from prop.
- [ ] **Model** — shadcn `Select`, options from `modelConfig` filtered by selected runtime.
- [ ] **Schedule** (`ScheduleField.tsx`) — shadcn `Input` for cron; preview line using `parseCronExpression` (updated in real time, no round-trip); K6 banner when non-empty and not dismissed; banner dismiss posts `dismissK6Banner`.
- [ ] **Linked flow** — shadcn `Select`, options = `flows` prop stems + "＋ Create new flow…" at bottom. "Create new flow…" posts `createFlow`. Bound to `routine` frontmatter field.
- [ ] **Skills** — tag autocomplete: shadcn `Input` + dropdown overlay showing `skills` filtered by typed text. Selected skills shown as `ritemark-pill-soft.is-accent` tags with `ProvenanceBadge` and `×` remove button. Bound to `skills[]` frontmatter array.
- [ ] **Allowed tools** — single-column `Checkbox` list. Each row: checkbox, tool name (56px `w-14 font-medium`), description (`text-ink-faint text-[11px]`). Default from `DEFAULT_TOOLS`. Bound to `allowedTools[]`.
- [ ] Create `ProvenanceBadge.tsx` per tech plan snippet — used in skills tags and dropdown options.
- [ ] Run `npm run compile` — must pass.

---

## Phase 5: cronUtils (WS5 — R7)

### 5.1 Install cron-parser (R7)

- [ ] Run `npm install cron-parser` in `extensions/ritemark/`.
- [ ] Verify `cron-parser` appears in `extensions/ritemark/package.json` `dependencies`.
- [ ] Run `npm run compile` in `extensions/ritemark` — must pass.

### 5.2 Create cronUtils.ts (R7)

- [ ] Create `extensions/ritemark/src/agent/cronUtils.ts` exporting `parseCronExpression(expr: string): string`.
- [ ] Implement `humanizeCron` for common patterns (hourly, daily, weekday, weekly patterns, etc.).
- [ ] Fallback: return the raw validated expression with a human note (e.g. `"Runs: 0 9 * * *"`) for patterns not covered by the humanizer.
- [ ] Write unit tests: `0 */6 * * *` → contains "6 hours", `not-a-cron` → "Invalid cron expression", `0 9 * * 1-5` → contains "9".

### 5.3 Wire cronUtils into ScheduleField webview component (R7)

- [ ] Import `parseCronExpression` (or re-export a browser-compatible version) in `ScheduleField.tsx`.
- [ ] Display preview line below the schedule input using `parseCronExpression` result.
- [ ] Confirm preview updates in real time as the user types (no round-trip to extension host).

---

## Phase 6: QA and Closeout

### 6.1 Manual QA matrix

Run all scenarios from `scenarios.md` in dev build:

- [ ] Scenario: Codex workspace shows no phantom agent section (R1).
- [ ] Scenario: Removing the .agents agent scan causes no regression for Claude-only projects (R1).
- [ ] Scenario: .agents/agents/ directory exists but is silently ignored (R1).
- [ ] Scenario: Claude-only skill shows [claude] badge (R2).
- [ ] Scenario: Codex-only skill shows [codex] badge (R2).
- [ ] Scenario: Skill present in both frameworks shows [shared] badge with single row (R2).
- [ ] Scenario: Commands do not show provenance badges (R2).
- [ ] Scenario: Agents do not show provenance badges (R2).
- [ ] Scenario: Flows section appears in Agent Library (R3).
- [ ] Scenario: Clicking a flow row opens the flow editor (R3).
- [ ] Scenario: ritemark-flows activity bar container is gone (R3).
- [ ] Scenario: Empty workspace still loads Agent Library (R3).
- [ ] Scenario: YAML array skills field is parsed correctly (R4).
- [ ] Scenario: Multi-line YAML list is parsed correctly (R4).
- [ ] Scenario: Numeric maxBudgetUsd is parsed correctly (R4).
- [ ] Scenario: Agent with schedule but no runtime shows warning chip (R4).
- [ ] Scenario: Agent with schedule and runtime but no routine shows warning chip (R4).
- [ ] Scenario: Agent with routine pointing to non-existent file shows warning chip (R4).
- [ ] Scenario: Fully valid agent shows no warning chip (R4).
- [ ] Scenario: Opening an agent file activates agent mode — 220px Configurator panel appears on left (R5).
- [ ] Scenario: TipTap body initialised with content below frontmatter (R5).
- [ ] Scenario: External file edit refreshes the webview (R5).
- [ ] Scenario: Non-agent markdown files open without agent mode panel (R5).
- [ ] Scenario: Changing the name field updates frontmatter (R6).
- [ ] Scenario: Selecting a runtime shows the correct model dropdown options (R6).
- [ ] Scenario: Auth status indicators reflect credential state (R6).
- [ ] Scenario: Linked flow dropdown lists available flows (R6).
- [ ] Scenario: Create new flow scaffolds a blank flow and selects it (R6).
- [ ] Scenario: Skills tag autocomplete saves selection back to frontmatter (R6).
- [ ] Scenario: Valid cron expression shows human-readable preview (R7).
- [ ] Scenario: Invalid cron expression shows error text (R7).
- [ ] Scenario: K6 banner appears when schedule is non-empty (R7).
- [ ] Scenario: K6 banner dismiss persists across reopens (R7).
- [ ] Scenario: K6 banner reappears for a different agent file (R7).
- [ ] Scenario: Clearing the schedule field hides the K6 banner (R7).
- [ ] Scenario: Flow referenced by an agent shows attachment label (R8).
- [ ] Scenario: Standalone flow shows only the flow name (R8).
- [ ] Scenario: Flow referenced by multiple agents shows all agent names (R8).
- [ ] Scenario: Click-to-edit is unaffected by attachment label (R8).

### 6.2 Automated tests

- [ ] Run `npm run compile` in `extensions/ritemark` — must pass.
- [ ] Run `npm run build` in `extensions/ritemark/webview` — both entries must pass.
- [ ] Run focused unit tests: `parseFrontmatter`, `discoverCommands` dedup, `validateAgentFrontmatter`, `parseCronExpression`, `serializeFrontmatter` round-trip.
- [ ] Run `./scripts/validate-qa.sh` — must pass.

### 6.3 Closeout

- [ ] Invoke `qa-validator` for Phase 4→5 sign-off (route via main session).
- [ ] Update `docs/CHANGELOG.md` under `[Unreleased]`.
- [ ] Update linked GitHub issues: post summary on `#70` (closed by R1+R2), post summary on `#69` (Phase 1 complete).
- [ ] Commit all changes with message: `feat(sprint-77): unified agent library phase 1 (R1-R8)`.
- [ ] Push to `claude/guitar-issues-69-70-sprint-6AquJ`.
- [ ] Invoke `qa-validator` for prod-build sign-off before PR (route via main session).
