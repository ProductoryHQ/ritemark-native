# Sprint 74 Scenarios

## Feature: Plan Review Card — Approve/Reject (R1)

### Scenario: Plan approval UI appears when agent requests approval
Given the user sent a prompt in plan mode and Claude produced a plan
When the extension dispatches `agent-plan-approval` with `request.toolUseId = "tool-123"`
Then the store updates the last turn with `isPlan = true`, `planHandled = false`, `pendingPlanApproval = { toolUseId: "tool-123" }`
And the `AgentPlanApproval` card is rendered in `AgentView` showing the plan text
And the "Approve plan" and "Reject" buttons are visible and clickable

### Scenario: Approve button sends approval to extension host
Given the plan approval UI is visible with `pendingPlanApproval.toolUseId = "tool-123"`
When the user clicks "Approve plan"
Then `approvePlan(turnId)` is called in the store
And a `agent-answer-plan` message is posted to the extension with `{ approved: true, toolUseId: "tool-123" }`
And the turn updates to `planHandled = true`, `planDecision = "approved"`, `pendingPlanApproval = undefined`
And the approval buttons are replaced by the label "Plan approved"

### Scenario: Reject button with feedback sends rejection
Given the plan approval UI is visible
When the user clicks "Reject" and types "Skip the database migration step" and presses Enter
Then `rejectPlan(turnId, "Skip the database migration step")` is called
And a `agent-answer-plan` message is posted with `{ approved: false, toolUseId: "...", feedback: "Skip the database migration step" }`
And the label "Plan sent back for revision" appears

### Scenario: Plan text is rendered as Markdown in the preview
Given the turn has `planText = "## Steps\n1. Read files\n2. Write output"`
When the plan approval UI renders
Then `extractPlanDisplayText(turn.planText)` extracts the Markdown content
And `RenderedMarkdown` renders it with heading and list formatting (not as raw text)

### Scenario: Approve button is not shown for turns without pending approval
Given a completed turn with `isPlan = false` or `planHandled = true`
When the turn is rendered in conversation history
Then no Approve/Reject buttons are visible
And no plan preview card is shown

### Scenario: Plan approval state is cleared when agent is cancelled
Given the plan approval UI is visible and the user clicks Stop
When the `agent-result` message arrives with an error
Then the approval buttons are replaced by the error display
And `pendingPlanApproval` is cleared (turn no longer awaiting approval)

---

## Feature: Composer Input Unlock During Agent Run (R2 Level 1)

### Scenario: Textarea accepts input while agent is running
Given the user sent a message and the agent is currently running (`agentRunning = true`)
When the user clicks in the chat input textarea
Then the textarea is focusable and accepts keystrokes
And the typed content appears in the textarea

### Scenario: Send button is disabled while agent runs
Given the user has typed "my follow-up" in the textarea while the agent is running
When the user presses Enter or sees the send button
Then nothing is sent (the action is blocked)
And the Stop button is visible and functional

### Scenario: Typed content is preserved when agent finishes
Given the user typed "follow-up question" in the textarea while the agent was running
When the agent finishes and `agentRunning` becomes false
Then the textarea still contains "follow-up question"
And the Send button becomes active

### Scenario: Placeholder text changes during agent run
Given the textarea is empty and the agent is running
Then the textarea placeholder reads "Agent is running — type your next message…"
When the agent finishes
Then the placeholder reverts to the normal prompt hint

---

## Feature: Composer Prompt Queue (R2 Level 2)

### Scenario: Pressing Enter while agent runs queues the prompt
Given the textarea contains "my queued follow-up" and `agentRunning = true`
When the user presses Enter (or clicks Send)
Then `queuedPrompt` is set to "my queued follow-up"
And a queue indicator chip appears showing "Queued: my queued follow-up"
And the textarea is cleared and disabled

### Scenario: Queue chip shows truncated text for long prompts
Given the user queued "This is a very long follow-up prompt that exceeds the chip width"
Then the queue chip displays a visually truncated version of the prompt text
And hovering the chip shows the full text via the browser's built-in title tooltip

### Scenario: Queued prompt auto-sends when agent completes
Given `queuedPrompt = "my queued follow-up"` and the agent just finished
When `agentRunning` transitions to `false`
Then `handleSend` is triggered automatically with the queued content
And the queue chip disappears
And the agent begins processing "my queued follow-up"

### Scenario: User discards queued prompt via X button
Given the queue chip is visible showing "Queued: some prompt"
When the user clicks the X button on the chip
Then `queuedPrompt` is cleared
And the textarea is re-enabled and empty
And no message is sent

### Scenario: Only one prompt can be queued at a time
Given `queuedPrompt` is already set and the agent is still running
Then the textarea is disabled (cannot type a second queued message)
And the queue chip and discard button are the only active controls

---

## Feature: Code Block — No Spurious Horizontal Scrollbar (R3)

### Scenario: Short code block shows no horizontal scrollbar
Given a code block containing a single short line: `const x = 1`
When the block is rendered in the editor at normal sidebar width
Then no horizontal scrollbar or scrollbar gutter is visible below the code

### Scenario: Long code block still scrolls horizontally
Given a code block containing a line 200 characters long
When the block is rendered in the editor at normal sidebar width (narrower than 200 chars)
Then a horizontal scrollbar appears allowing the user to scroll right to see the full line

### Scenario: Mermaid blocks are unaffected
Given a mermaid code block with a diagram
When the block is rendered
Then the mermaid rendering, toolbar buttons, and expand overlay continue to work normally
And no unintended scrollbar behaviour is introduced

### Scenario: Copy-button tooltip is not clipped
Given a code block and the cursor hovering over the copy button
When the tooltip text appears ("Copy code")
Then the tooltip is fully visible and not cut off by any container boundary

---

## Feature: Edit Link Modal — Display Text Field (R4)

### Scenario: Display text field is shown in the link dialog
Given the user opens the Edit Link dialog (via Cmd+K or clicking a link)
Then the dialog contains a "Display text (optional)" input field below the URL field

### Scenario: Display text pre-populated from selection when adding new link
Given the user has selected the text "Ritemark documentation" in the editor
When the user opens the Add Link dialog (Cmd+K)
Then the Display text field is pre-populated with "Ritemark documentation"
And the URL field is empty

### Scenario: Display text pre-populated when editing existing link
Given the cursor is inside a link with text "old display text" and href "https://example.com"
When the user opens the Edit Link dialog
Then the URL field contains "https://example.com"
And the Display text field contains "old display text"

### Scenario: Saving with empty Display text does not change link text
Given the Edit Link dialog is open with Display text field empty
When the user enters "https://example.com" in the URL field and clicks Update
Then the link href is updated to "https://example.com"
And the visible link text in the document is unchanged

### Scenario: Saving with non-empty Display text updates link text (selection case)
Given the user has "old text" selected and the dialog has URL "https://example.com" and Display text "new text"
When the user clicks Update
Then the document shows "new text" as a link pointing to "https://example.com"
And the original "old text" is replaced

### Scenario: Saving with non-empty Display text inserts linked text (cursor case)
Given the cursor is positioned with no selection and the dialog has URL "https://example.com" and Display text "click here"
When the user clicks Add
Then "click here" is inserted at the cursor position as a link pointing to "https://example.com"

### Scenario: Display text field is hidden in file-search mode
Given the user has typed "@readme" in the URL field (file-search mode)
Then the Display text field is hidden
And only the file-search autocomplete dropdown is shown

### Scenario: Tab order through dialog is correct
Given the Edit Link dialog is open
When the user presses Tab from the URL field
Then focus moves to the Display text field
And subsequent Tab presses move to Cancel then Update/Add
