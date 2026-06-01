# Sprint 77 Scenarios

## Feature: Discovery correctness (R1)

### Scenario: Codex workspace shows no phantom agent section

Given a workspace that has `.agents/skills/my-skill/SKILL.md`
And the workspace has NO `.agents/agents/` directory
When the Agent Library panel loads
Then the Agents section shows no entry sourced from `.agents/`
And the Skills section shows `my-skill` from `.agents/skills/`

### Scenario: Removing the .agents agent scan causes no regression for Claude-only projects

Given a workspace that has only `.claude/agents/sprint-manager.md`
And the workspace has no `.agents/` directory at all
When the Agent Library panel loads
Then `sprint-manager` appears in the Agents section
And no error is thrown during discovery

### Scenario: .agents/agents/ directory exists but is silently ignored

Given a workspace that has `.agents/agents/codex-agent.md`
When the Agent Library panel loads
Then `codex-agent` does NOT appear in the Agents section
And no error notification is shown

## Feature: Provenance badges (R2)

### Scenario: Claude-only skill shows [claude] badge

Given a workspace with `.claude/skills/spec-driven-sprint/SKILL.md`
And no `.agents/skills/spec-driven-sprint/` directory
When the Skills section renders
Then the `spec-driven-sprint` row shows a `[claude]` indigo badge

### Scenario: Codex-only skill shows [codex] badge

Given a workspace with `.agents/skills/code-review/SKILL.md`
And no `.claude/skills/code-review/` directory
When the Skills section renders
Then the `code-review` row shows a `[codex]` emerald badge

### Scenario: Skill present in both frameworks shows [shared] badge with single row

Given a workspace with `.claude/skills/linting/SKILL.md`
And a workspace with `.agents/skills/linting/SKILL.md`
When the Skills section renders
Then only ONE `linting` row appears (not two)
And that row shows a `[shared]` slate badge
And the row's file path points to `.claude/skills/linting/SKILL.md`

### Scenario: Commands do not show provenance badges

Given a workspace with `.claude/commands/daily-standup.md`
When the Commands section renders
Then the `daily-standup` row shows no badge

### Scenario: Agents do not show provenance badges

Given a workspace with `.claude/agents/sprint-manager.md`
When the Agents section renders
Then the `sprint-manager` row shows no badge

## Feature: Sidebar merge (R3)

### Scenario: Flows section appears in Agent Library

Given the Agent Library panel is open
And the workspace has a flow at `.ritemark/flows/daily-report.flow.json`
When the panel finishes loading
Then a "Flows" section is visible below Skills
And a row labelled `daily-report` appears in that section

### Scenario: Clicking a flow row opens the flow editor

Given the Agent Library panel shows a flow `weekly-digest`
When the user clicks the `weekly-digest` row
Then the flow editor opens for `weekly-digest.flow.json`
And no second activity bar icon is required

### Scenario: ritemark-flows activity bar container is gone

Given Ritemark is freshly launched
When the user looks at the activity bar
Then there is ONE Ritemark activity bar icon, not two
And the separate Flows icon is not present

### Scenario: Empty workspace still loads Agent Library

Given a workspace with no agents, skills, or flows
When the Agent Library panel loads
Then the panel renders without error
And shows empty-state placeholder text in each section

## Feature: Frontmatter extension and validator (R4)

### Scenario: YAML array skills field is parsed correctly

Given an agent file with frontmatter:
  ```
  skills: [vscode-development, spec-driven-sprint]
  ```
When `discoverAgents()` processes the file
Then the agent's `skills` field equals `["vscode-development", "spec-driven-sprint"]`

### Scenario: Multi-line YAML list is parsed correctly

Given an agent file with frontmatter:
  ```
  allowedTools:
    - Read
    - Write
    - Edit
  ```
When `discoverAgents()` processes the file
Then the agent's `allowedTools` field equals `["Read", "Write", "Edit"]`

### Scenario: Numeric maxBudgetUsd is parsed correctly

Given an agent file with frontmatter:
  ```
  maxBudgetUsd: 2.50
  ```
When `discoverAgents()` processes the file
Then the agent's `maxBudgetUsd` field equals the number `2.50`

### Scenario: Agent with schedule but no runtime shows warning chip

Given an agent file with frontmatter:
  ```
  schedule: "0 */6 * * *"
  ```
And the frontmatter has no `runtime` field
When the Agent Library renders the agent row
Then a yellow warning chip is visible on the row
And hovering the chip shows "schedule requires runtime to be set"

### Scenario: Agent with schedule and runtime but no routine shows warning chip

Given an agent file with frontmatter:
  ```
  runtime: claude_local
  schedule: "0 9 * * 1-5"
  ```
And the frontmatter has no `routine` field
When the Agent Library renders the agent row
Then a yellow warning chip is visible on the row
And hovering the chip shows "schedule requires routine to be set"

### Scenario: Agent with routine pointing to non-existent file shows warning chip

Given an agent file located at `.claude/agents/my-agent.md`
And frontmatter contains `routine: .ritemark/flows/missing.flow.json`
And that file does not exist on disk
When the Agent Library renders the agent row
Then a yellow warning chip is visible
And hovering shows "routine path does not exist: .ritemark/flows/missing.flow.json"

### Scenario: Fully valid agent shows no warning chip

Given an agent file with frontmatter:
  ```
  runtime: claude_local
  schedule: "0 9 * * 1-5"
  routine: .ritemark/flows/standup.flow.json
  ```
And `.ritemark/flows/standup.flow.json` exists on disk
When the Agent Library renders the agent row
Then no yellow warning chip is shown

## Feature: agentEditor custom editor (R5)

### Scenario: Opening an agent file activates agent mode in the editor

Given a file at `.claude/agents/my-agent.md`
When the user opens the file (double-click or via Explorer)
Then the standard `ritemark.editor` opens in agent mode
And the LEFT panel (220px, same width as TOC/Properties panels) shows the Configurator with parsed frontmatter fields
And the RIGHT area (flex-1) shows the TipTap body editor with content below the frontmatter

### Scenario: TipTap body initialised with content below frontmatter

Given an agent file with a `---` frontmatter block followed by free-text body
When the agent editor opens
Then the TipTap body editor contains only the text below the closing `---`
And the frontmatter YAML is not visible in the TipTap body

### Scenario: External file edit refreshes the webview

Given the agent editor is open for `my-agent.md`
When another process writes new content to `my-agent.md`
Then the agent editor refreshes to show the updated body and frontmatter
And the user is not shown a stale view

### Scenario: Non-agent markdown files open without agent mode panel

Given a file at `docs/notes/meeting.md`
When the user opens the file
Then the standard `ritemark.editor` opens without the 220px Configurator panel
And no agent-mode UI is shown

## Feature: Configurator panel (R6)

### Scenario: Changing the name field updates frontmatter

Given the agent editor is open with `name: old-name` in frontmatter
When the user types `new-name` into the Name field
And 300 ms elapses (debounce)
Then the `.md` file on disk contains `name: new-name` in the frontmatter

### Scenario: Selecting a runtime shows the correct model dropdown options

Given the Configurator panel is open
When the user selects `anthropic_api` in the Runtime radio group
Then the Model dropdown shows only Anthropic models from `modelConfig.ts`

### Scenario: Auth status indicators reflect credential state

Given the Configurator panel is open
And `ANTHROPIC_API_KEY` is set in the environment
When the user views the Runtime section
Then the `anthropic_api` option shows a green auth-status dot
And `openai_api` shows a grey dot if `OPENAI_API_KEY` is not set

### Scenario: Routine dropdown lists available flows

Given the workspace has flows at `.ritemark/flows/standup.flow.json` and `weekly.flow.json`
When the Configurator Routine dropdown is opened
Then both `standup` and `weekly` appear as options
And a "Create new flow..." option is also present

### Scenario: Create new flow scaffolds a blank flow and selects it

Given the user selects "Create new flow..." in the Routine dropdown
And types the name `sprint-review`
When the scaffold action completes
Then a new `.ritemark/flows/sprint-review.flow.json` is created
And the Routine dropdown automatically selects `sprint-review`
And the frontmatter `routine:` field is updated on disk

### Scenario: Skills multiselect saves back to frontmatter

Given the Configurator panel is open
When the user checks `spec-driven-sprint` in the Skills multiselect
And 300 ms elapses
Then the `.md` file on disk contains `skills: [spec-driven-sprint]` in frontmatter

### Scenario: Budget input writes maxBudgetUsd to frontmatter

Given the Configurator panel is open
When the user enters `5.00` in the Budget field
Then the `.md` file on disk contains `maxBudgetUsd: 5` in frontmatter

## Feature: Schedule UI and K6 warning banner (R7)

### Scenario: Valid cron expression shows human-readable preview

Given the Configurator schedule field is empty
When the user types `0 */6 * * *`
Then the preview line below the input shows "Every 6 hours"
And the K6 warning banner becomes visible

### Scenario: Invalid cron expression shows error text

Given the Configurator schedule field contains `not-a-cron`
When the preview is computed
Then the preview line shows "Invalid cron expression"

### Scenario: K6 banner appears when schedule is non-empty

Given the Configurator panel is open
And the `schedule` field is empty
When the user types any cron expression into the schedule input
Then the K6 banner becomes visible
And the banner reads "Scheduled runs execute only while Ritemark is open. Background execution ships in Phase 2."

### Scenario: K6 banner dismiss persists across reopens

Given the K6 banner is visible for agent file `.claude/agents/nightly.md`
When the user clicks the dismiss button
Then the banner disappears
When the user closes and reopens the agent editor for `nightly.md`
Then the banner remains hidden

### Scenario: K6 banner reappears for a different agent file

Given the K6 banner was dismissed for `.claude/agents/nightly.md`
When the user opens `.claude/agents/morning.md` which also has a schedule
Then the K6 banner is visible for `morning.md`
Because the dismiss key is per file path

### Scenario: Clearing the schedule field hides the K6 banner

Given the K6 banner is visible because a schedule was entered
When the user clears the schedule field entirely
Then the banner hides (no schedule = no execution concern)

## Feature: Flows section attachment indicator (R8)

### Scenario: Flow referenced by an agent shows attachment label

Given a flow `standup.flow.json` exists
And agent `sprint-manager.md` has frontmatter `routine: .ritemark/flows/standup.flow.json`
When the Agent Library Flows section renders
Then the `standup` row shows "standup — used by Sprint Manager"

### Scenario: Standalone flow shows only the flow name

Given a flow `ad-hoc-report.flow.json` exists
And no agent's `routine:` field references `ad-hoc-report.flow.json`
When the Agent Library Flows section renders
Then the `ad-hoc-report` row shows only "ad-hoc-report" with no attachment label

### Scenario: Flow referenced by multiple agents shows all agent names

Given a flow `daily-brief.flow.json` exists
And two agents `agent-a.md` and `agent-b.md` both have `routine:` pointing to `daily-brief.flow.json`
When the Agent Library Flows section renders
Then the `daily-brief` row shows "daily-brief — used by Agent A, Agent B"

### Scenario: Click-to-edit is unaffected by attachment label

Given the `standup` flow row shows an attachment label
When the user clicks the row
Then the flow editor opens for `standup.flow.json`
And the attachment label is purely decorative
