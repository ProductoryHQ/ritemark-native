# Sprint 112 Scenarios

BDD examples for [spec.md](./spec.md). These are the manual QA matrix; ★ scenarios require automated/live evidence where credentials are available.

## Feature: Composer effort control (R1–R3)

### ★ Scenario: Effort is selected where the message is composed
Given Claude or Codex is selected with a model that supports explicit effort
When I open the Composer effort control
Then it is anchored beside the runtime/model and mode controls
And it shows Auto plus only the manual levels supported by that model
And the scale is labeled Faster and More thorough

### Scenario: Auto is the safe default
Given I start a new conversation
When I send a prompt without changing effort
Then the trigger says Effort
And the host sends no explicit provider effort override

### Scenario: Popover closes without changing state
Given Effort · High is selected
When I open the popover and press Escape or click outside
Then the popover closes
And focus returns to the trigger
And High remains selected

### ★ Scenario: Keyboard and screen-reader operation
Given I use only a keyboard and screen reader
When I focus the trigger, open the range control, move through levels, and select Extra
Then every option and the current value are announced textually
And unsupported options are absent from focus order
And focus uses the standard Ritemark ring

### Scenario: Narrow width and zoom
Given the Agent sidebar is at its minimum supported width and browser zoom is 200%
When the effort trigger and popover are visible
Then the Composer footer wraps predictably without covering Send
And all options remain readable and operable

## Feature: Turn snapshots and conversation state (R4, R5)

### ★ Scenario: Queued prompt keeps enqueue-time effort
Given one turn is running with the Composer set to High
When I queue Prompt B and then change the Composer to Low before Prompt B starts
Then Prompt B starts with High
And the new Low choice applies only to later prompts

### Scenario: Editing while running affects the next turn
Given a Codex turn is already running with Medium
When I change the Composer to Extra
Then the running turn remains Medium
And the next accepted prompt snapshots Extra

### ★ Scenario: Runtime preferences remain isolated
Given this conversation uses Claude High and Codex Low at different times
When I switch Claude → Codex → Claude
Then Codex restores Low
And Claude restores High
And another conversation’s preferences are unchanged

### Scenario: Reload restores the durable draft
Given I selected Extra for Claude and closed Ritemark without sending
When I reopen the project and conversation
Then Claude’s Composer draft shows Extra if the model still supports it
And no runtime or network request starts merely because the conversation opened

## Feature: Claude mapping (R6)

### ★ Scenario: Explicit Claude effort reaches the SDK
Given the selected Claude model supports Extra
When I send a prompt with Effort · Extra
Then the turn uses the SDK `effort: xhigh` setting
And no hidden prompt or fixed thinking-token budget is injected

### Scenario: Claude Auto preserves adaptive defaults
Given the Claude model supports adaptive thinking
When I send with Auto
Then no explicit effort override is supplied
And the SDK/model chooses its default behavior

### Scenario: Claude reports a downgrade
Given I request Extra and the selected Claude model applies High
When the turn begins
Then the transcript metadata stores requested Extra and applied High
And the UI says Effort adjusted to High for this model
And the prompt continues normally

## Feature: Codex mapping (R7)

### ★ Scenario: Codex execute and plan turns honor effort
Given the selected Codex model supports High
When I send one execute turn and one plan-first turn with High
Then both turns carry the measured Codex reasoning-effort field
And plan mode does not replace it with null

### ★ Scenario: Concurrent Codex efforts do not cross-bind
Given Conversation A selects Low and Conversation B selects Extra
When both Codex turns run concurrently
Then each thread receives only its own effort
And neither conversation’s draft changes

### Scenario: Model switch invalidates Extra
Given Extra is selected and I choose a model that supports only Low, Medium, and High
When model capability is revalidated
Then the draft changes to Auto
And the UI says Extra isn’t available for this model. Using Auto.
And sending remains available

## Feature: Capability-driven OpenCode (R8)

### Scenario: Opening a conversation does not start OpenCode
Given OpenCode is selected but no ACP session exists
When I open or select the saved conversation
Then no runtime, auth, or network action starts
And the first prompt can still be sent with provider defaults

### ★ Scenario: ACP thought level becomes available after session evidence
Given the OpenCode session advertises a select option categorized thought_level
When the first turn has established the session
Then subsequent Composer turns expose the advertised choices
And Ritemark sets that advertised option before the associated prompt

### Scenario: ACP does not advertise thought level
Given the selected OpenCode provider/model exposes no thought_level option
When I use the Composer
Then Ritemark does not fabricate effort choices
And explanatory text says the selected OpenCode model controls its own effort

### Scenario: ACP rejects a selected level
Given OpenCode previously advertised High but rejects the setting
When I send the next prompt
Then Ritemark falls back to Auto/provider default with a visible notice
And the conversation record and later turns remain usable

## Feature: Flag and error safety (R9)

### ★ Scenario: Feature flag is off
Given composer-thinking-effort is disabled
When I open a conversation containing saved effort metadata and send a prompt
Then the effort control is hidden
And the metadata remains readable
And no runtime receives an explicit override

### Scenario: Stale webview sends an unknown value
Given the host receives an effort value outside the canonical union
When it validates agent-execute
Then the unknown value is rejected or normalized to omission with diagnostics
And it is never forwarded to a runtime
