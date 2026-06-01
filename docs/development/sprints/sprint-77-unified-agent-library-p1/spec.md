# Sprint 77 Spec

## Purpose

Unify Ritemark's two separate agent-related sidebars (Agent Library and Flows) into a single coherent panel, fix a discovery bug that causes Codex skills to be missed, and introduce a first-class editing experience for agent definition files. Users who work with both Claude Code and Codex agents will see all their tools in one place, with correct provenance labelling, and will be able to configure agents through a structured editor rather than manually editing YAML frontmatter.

This spec is the source of truth for Sprint 77 implementation. If implementation reveals the spec is wrong, update the spec before changing code.

## Principles

- One sidebar owns agent + skill + flow discovery. The parallel `ritemark-flows` container is removed.
- Provenance is shown, not guessed. Claude Code items are labelled `[claude]`, Codex items `[codex]`, items that exist in both are labelled `[shared]`.
- The agent editor lowers the barrier to configuring agents. No YAML knowledge required for common fields.
- All new behaviour is on by default. Feature flags are not used for this sprint (nothing experimental; everything is expected to work on first open).
- Markdown files stay portable. The agent editor writes valid YAML frontmatter that other tools can read.

## Requirements

### R1: Discovery correctness

As an agent author using Codex, I want `.agents/skills/*/SKILL.md` files to appear in the Agent Library without any duplicate `.agents/agents/` artefact being created, so Codex-convention projects are correctly represented.

Acceptance criteria:

- `discoverAgents()` no longer calls `discoverAgentsInRoot` with a `.agents`-rooted path. The `.agents/agents/*.md` scan is removed entirely.
- `.agents/skills/*/SKILL.md` files continue to appear in the Skills section (this path already works; R1 must not regress it).
- Removing the erroneous scan causes no visible change for workspaces that have no `.agents/agents/` directory (the common case).
- The change is a single-line removal in `discoverAgents()`.

### R2: Provenance badges

As an agent author, I want each skill item in the Agent Library to display a small badge indicating whether it came from Claude Code (`.claude/skills/`), Codex (`.agents/skills/`), or both, so I can tell at a glance which framework owns each skill.

Acceptance criteria:

- `DiscoveredCommand` gains an optional `provenance: 'claude' | 'codex' | 'shared'` field.
- `discoverCommandsInRoot` is updated to accept a `framework: 'claude' | 'codex'` parameter and stamps the correct provenance on every item it returns.
- When a skill folder name appears in both `.claude/skills/` and `.agents/skills/`, `discoverCommands()` merges the two entries into a single `DiscoveredCommand` with `provenance: 'shared'`. The `filePath` of the merged entry points to the `.claude/skills/` copy as the canonical file.
- The Agent Library HTML renders a small inline pill for skills:
  - `[claude]` — indigo background.
  - `[codex]` — emerald background.
  - `[shared]` — slate background.
- Commands (`.claude/commands/*.md`) do not show a provenance badge (they have no Codex equivalent).
- Agents do not show a provenance badge (agent discovery is Claude Code only).

### R3: Sidebar merge

As a Ritemark user, I want all my agent tools (agents, skills, commands, and flows) accessible from a single sidebar panel, so I do not have to switch between two activity bar icons to manage my automation.

Acceptance criteria:

- The `ritemark-flows` activity bar container is removed from `package.json`. The `ritemark.flowsView` view registration is removed.
- The Agent Library panel gains a collapsible **Flows** section below the existing Skills/Commands section.
- The Flows section lists all flows returned by `FlowStorage`. Each row shows the flow name.
- Clicking a flow row sends an `openFlow` message to the extension host, which opens the flow file in the flow editor (same behaviour as clicking a flow in the old Flows panel).
- Activation events in `package.json` for `onView:ritemark.flowsView` are removed.
- The `FlowsViewProvider` class is NOT deleted (it may still be used as the flow editor target). Only its sidebar panel registration is removed.

### R4: Frontmatter extension and validator

As an agent author, I want Ritemark to read and validate the extended frontmatter fields that Claude Code and Codex agents support (`runtime`, `model`, `schedule`, `routine`, `skills`, `allowedTools`, `maxBudgetUsd`, `worktree`), so the Agent Library can surface configuration state and warn me when my agent definition is invalid.

Acceptance criteria:

- `parseFrontmatter()` correctly parses YAML arrays (e.g. `skills: [a, b, c]` or multi-line `- item` lists) and returns them as `string[]` on the `Record`.
- `parseFrontmatter()` correctly parses numeric values and returns them as numbers.
- `DiscoveredAgent` is extended with optional typed fields: `runtime?: string`, `runtimeModel?: string`, `schedule?: string`, `routine?: string`, `skills?: string[]`, `allowedTools?: string[]`, `maxBudgetUsd?: number`, `worktree?: boolean`.
- A new `validateAgentFrontmatter(agent: DiscoveredAgent): string[]` export is added to `discovery.ts`. It returns an array of human-readable error strings:
  - `"schedule requires runtime to be set"` if `schedule` is non-empty and `runtime` is absent.
  - `"schedule requires routine to be set"` if `schedule` is non-empty and `routine` is absent.
  - `"routine path does not exist: <path>"` if `routine` resolves to a path that does not exist on disk (path resolved relative to agent file's directory).
- Agents with one or more validation errors show a yellow warning chip in the Agent Library item row. Hovering the chip shows the first error string.
- Agents with no validation errors show no chip.

### R5: `ritemark.agentEditor` custom editor

As an agent author, I want opening an agent definition file (`.claude/agents/*.md`) to show a structured editor instead of raw Markdown text, so I can configure agents without manually editing YAML.

Acceptance criteria:

- A new `AgentEditorProvider` implements `vscode.CustomTextEditorProvider` and is registered in `package.json` as a custom editor with:
  - `viewType: 'ritemark.agentEditor'`
  - `selector: [{ "filenamePattern": "**/.claude/agents/*.md" }]`
  - `priority: "default"`
- Opening a file matching `**/.claude/agents/*.md` launches the agent editor webview instead of VS Code's text editor.
- The agent editor webview is served from a new Vite bundle entry (`agent-editor.js`), loaded via a dedicated HTML file.
- The webview displays a two-panel layout: a TipTap body editor on the left (~60% width) for the free-text body of the `.md` file, and a Configurator panel on the right (~40% width) for structured frontmatter fields.
- The TipTap body editor is initialised with the file content below the frontmatter block (i.e. everything after the closing `---` line).
- Changes in the TipTap body are reflected back to the `.md` file via `vscode.workspace.applyEdit`.
- The webview is initialised with the current file state on open. When the file is modified externally (e.g. by git or another editor), the webview refreshes.

### R6: Configurator panel

As an agent author, I want the Configurator panel to let me edit all supported frontmatter fields through a structured UI, so changes write back to the `.md` file without me touching YAML directly.

Acceptance criteria:

- The Configurator panel exposes the following field groups, each described below:
  - **Identity:** `name` (text input), `icon` (Phosphor icon picker), `color` (swatch picker — 8 Ritemark brand colors), `description` (textarea).
  - **Runtime:** radio group with options `claude_local`, `codex_local`, `openai_api`, `anthropic_api`. Each option shows a small auth-status indicator (green dot = credentials present, grey dot = not configured). Credential presence is checked on the extension host and sent to the webview via an `authStatus` message.
  - **Model:** dropdown scoped to the chosen runtime. Model lists are sourced from `extensions/ritemark/src/ai/modelConfig.ts` and delivered via a `modelConfig` message (same pattern as the main webview).
  - **Schedule:** cron expression text input. When non-empty, shows a human-readable preview line below the input (e.g. "Every 6 hours") computed by `cronUtils.parseCronExpression()`.
  - **Routine:** dropdown listing `.ritemark/flows/*.flow.json` files in the workspace, plus a "Create new flow…" option that scaffolds a new blank flow and selects it.
  - **Skills:** multiselect from all discovered skills (both `.claude/skills/` and `.agents/skills/`), each item showing its provenance badge from R2.
  - **Allowed Tools:** multiselect checkboxes. Default preset is `DEFAULT_TOOLS` from `AgentRunner.ts`.
  - **Budget:** USD number input bound to `maxBudgetUsd`.
  - **Worktree:** boolean toggle.
- Every field change immediately calls `vscode.workspace.applyEdit` to write the updated frontmatter back to the `.md` file. Edits are debounced 300 ms to avoid excessive file I/O.
- The Configurator initialises from the parsed frontmatter when the webview opens. It reflects external edits (same mechanism as R5).
- The TipTap body and Configurator panel share a single webview HTML context and communicate via local React state (no separate bridge).

### R7: Schedule UI and K6 warning banner

As an agent author adding a `schedule:` field, I want a human-readable preview of when the schedule will run, and a clear notice that background execution is not yet available, so I understand the current limitations before publishing my agent.

Acceptance criteria:

- `npm install cron-parser` is added to `extensions/ritemark/package.json` dependencies.
- `extensions/ritemark/src/agent/cronUtils.ts` exports `parseCronExpression(expr: string): string` which returns:
  - A human-readable description (e.g. `"Every 6 hours"`, `"Weekdays at 9:00 AM"`, `"At 2:30 PM on Sundays"`) for valid cron expressions.
  - `"Invalid cron expression"` for invalid input.
- The K6 banner is shown in the Configurator Schedule field whenever the `schedule` input is non-empty. Banner text: `"Scheduled runs execute only while Ritemark is open. Background execution ships in Phase 2."`
- The banner has a dismiss button. Dismissal is persisted per-agent file path in `workspaceState` (key: `agentEditor.k6Dismissed.<filePath>`).
- The banner reappears if the agent file path changes (e.g. agent renamed) or if the user reopens the workspace.
- The `cronUtils.parseCronExpression` helper is used for the human-readable preview only; it has no effect on whether the schedule actually runs (execution is out of scope for Phase 1).

### R8: Flows section attachment indicator

As an agent author, I want flows that are referenced as a `routine:` by an agent to show which agent uses them, so I can see at a glance which flows are "attached" to an agent and which are standalone.

Acceptance criteria:

- In the Agent Library Flows section, each flow row shows one of two states:
  - **Attached** — the flow's filename (without `.flow.json` extension and path prefix) matches the basename of the `routine:` field of at least one discovered agent. The row shows the agent name(s) next to the flow name, formatted as `"My Flow — used by Sprint Agent"`.
  - **Standalone** — the flow is not referenced by any agent's `routine:` field. The row shows only the flow name with no additional text.
- The attachment check is done on the extension host at render time by comparing discovered agent `routine` values against the list of available flow filenames.
- The attachment indicator does not affect click-to-edit behavior from R3.

## Non-Requirements

- No execution of scheduled agents in this sprint (Phase 2 work).
- No Codex agent discovery via `.agents/agents/` — the directory convention does not exist and the scan is removed (see R1).
- No changes to the main Ritemark Markdown editor (`ritemark.editor`).
- No UI for creating new flows from scratch (beyond the "Create new flow…" scaffold in the Routine dropdown of R6).
- No sync of agent definitions to a remote server.
- No changes to `.claude/agents/*.md` file format beyond what YAML frontmatter already supports.
- No commands schedule support (only agents can have a `schedule:` field in this sprint).
- No auth-expiry recovery flow (Phase 2). Phase 1 shows a grey credential-indicator dot and, on next open, notifies the user if credentials are expired.

## Resolved Questions

- **Sprint scope**: Full solution in one sprint — issue #70 (discovery fix) plus issue #69 Phase 1 (UX unification). Decided by Jarmo before sprint kickoff.
- **Phase 1 mandatory items**: All four Phase 1 items from issue #69 are in scope: agentEditor custom editor, frontmatter extension + validator, sidebar merge, and schedule UI + K6 banner.
- **Open questions from #69**: Resolved as follows — local timezone for cron previews; per-agent configurable approval (default: auto-approve); broken routine = warning + disable; no commands schedule support; auth-expiry = notify-on-next-open (Phase 2 recovery flow is deferred).
- **agentEditor implementation**: New combined webview — brand new custom editor with TipTap body + Configurator panel in the same webview, not a sidebar panel. New Vite entry in `webview/vite.config.ts`.
- **Flows section scope**: List + click-to-edit only. Run/schedule controls stay in the flow editor; R3 does not replicate the Flows panel's execution controls in the sidebar.
- **Feature flags**: No flag for this sprint. All features on by default per CLAUDE.md hard rule.

## Open Questions

- The `ritemark.agentEditor` glob (`**/.claude/agents/*.md`) will also match user-level `~/.claude/agents/` files if VS Code resolves the glob against the home directory. Should the editor activate for user-scope agents too? Deferred to implementation — the tech plan notes the risk; the acceptance criteria do not require user-scope agent editing in Phase 1.
- `cron-parser` v4 vs v5 API surface difference: v5 changed the import. Pin to v4 unless v5 is already installed elsewhere in the repo.
