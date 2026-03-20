# Agent Lifecycle User Flow Contract

## Purpose

This document defines the user-facing lifecycle for plan mode, questions, approvals, and execution in the AI sidebar.

It is intended to be implementation-ready:

- one shared UX contract
- provider-specific adapters underneath
- explicit state entry/exit rules
- pseudocode for the core transitions

## Product Goal

The user should experience only 3 clear phases:

1. Clarify
2. Review plan
3. Execute

The UI must not bounce back into plan review after execution has started unless the plan materially changes.

## Jarmo's Vision

1. User starts chatting.
2. User asks to enter Plan mode, optionally with guidance about what the plan is for.
3. Plan mode is activated.
4. The agent reviews the context and starts a clarification phase.
5. If needed, the agent uses `AskUserQuestion` or `request_user_input` to ask concise multiple-choice questions.
6. User answers the questions.
7. The agent shows one clear plan card as a compact to-do list with 3 actions:
   - Approve
   - Revise
   - Cancel
8. Approve:
   - Exit Plan mode
   - Enter Edit mode
   - Start implementing the approved to-do list
   - Continue until the work is complete or a real blocker requires user input
9. Revise:
   - Stay in Plan mode
   - Update the current draft plan based on feedback
   - Show the revised plan again for review
10. Cancel:
   - Exit Plan mode
   - End the plan flow cleanly
   - Say something simple like: “Plan cancelled. Is there anything else I can help with?”
11. In Edit mode:
   - Collapse the inline plan card
   - Pin a compact plan widget above the chat input
   - Show item status visually:
     - Pending: empty checkbox
     - In progress: hourglass
     - Done: filled checkbox
   - Update statuses as work progresses
12. When all items are done, finish with a short summary of what was completed.

## Shared UX Contract

### Phase 1: Clarify

- The agent may inspect context.
- If required input is missing, the agent asks one or more interactive questions.
- The user answers inside the same logical turn/session.
- The agent resumes from that answer without creating a fake follow-up conversation turn.

### Phase 2: Review Plan

- The agent produces one explicit plan.
- The UI shows one review card.
- The user can:
  - Approve
  - Revise
  - Cancel

### Phase 3: Execute

- After approval, the agent starts execution.
- The review card disappears.
- The UI shows a compact sticky tasklist widget above the input.
- That widget tracks:
  - current item
  - completed items
  - pending items
- The tasklist remains visible while execution is active and should shrink to a compact summary when no longer useful.

## What Must Never Happen

- The agent asks for plan approval repeatedly after every micro-step.
- The same plan is reviewed multiple times without a material scope change.
- Approve only changes local UI state but does not actually continue execution.
- The user sees duplicate plan boxes for the same plan.
- The user cannot tell whether the agent is planning or executing.
- The user cannot tell whether items are pending, active, or done.

## Shared State Model

The webview should normalize both Claude and Codex into one shared lifecycle model.

```ts
type AgentPhase = 'clarify' | 'review' | 'execute' | 'done' | 'cancelled' | 'error'

type TaskItemStatus = 'pending' | 'inProgress' | 'done'

interface TaskItem {
  id: string
  label: string
  status: TaskItemStatus
}

interface ActivePlan {
  summary: string
  items: TaskItem[]
  approved: boolean
  visibleInStickyWidget: boolean
}

interface LifecycleState {
  provider: 'claude' | 'codex'
  phase: AgentPhase
  pendingQuestion?: QuestionCard
  pendingPlanReview?: PlanDraft
  activePlan?: ActivePlan
}
```

## State Entry and Exit Rules

### Clarify

- Enter when:
  - the task starts and required input is missing
  - the provider explicitly requests user input
- Exit when:
  - the user answers the required questions
  - the agent has enough information to produce a plan

### Review Plan

- Enter when:
  - the agent has produced a draft plan for user confirmation
- Exit when:
  - user clicks `Approve` -> go to `Execute`
  - user clicks `Revise` -> stay in `Review Plan` and regenerate the draft
  - user clicks `Cancel` -> go to `Cancelled`

### Execute

- Enter when:
  - the user approves the plan
  - the provider has crossed from planning into real work
- Exit when:
  - all task items are done -> go to `Done`
  - execution is cancelled -> go to `Cancelled`
  - a real blocker requires fresh user input -> temporarily enter `Clarify`
  - the plan materially changes -> temporarily re-enter `Review Plan`

### Done

- Enter when:
  - the approved task items are completed
- Exit when:
  - a new user message starts a new task

### Cancelled

- Enter when:
  - the user cancels plan review
  - the user cancels execution
- Exit when:
  - a new user message starts a new task

## Task Item State Rules

### Pending

- Enter when:
  - the plan is first created
  - a new item is added during execution
  - an item is reopened because the plan materially changed
- Exit when:
  - the agent chooses it as the current working item

### In Progress

- Enter when:
  - the agent or a sub-agent starts actively working on that item
- Exit when:
  - the item is completed
  - the item is explicitly moved back to `Pending` because the plan changed

### Done

- Enter when:
  - the intended outcome of that item has been achieved
- Exit when:
  - the plan is materially revised and the item must be reopened

## UI Contract

### Question Card

- One question card per clarification checkpoint
- Must be interactive
- Must resume the same logical task after answer

### Plan Review Card

- One review card per draft plan
- Buttons:
  - `Approve`
  - `Revise`
  - `Cancel`
- After `Approve`, the review card disappears

### Sticky Tasklist Widget

- Shown only after plan approval
- Compact by default
- Placed above the chat input
- Shows:
  - summary line
  - current active item
  - pending items
  - done items, visually de-emphasized
- Must not be a plain markdown dump

## Provider Contract

### Claude

Claude has a real planning lifecycle.

- Clarification uses `AskUserQuestion`
- Review uses `ExitPlanMode`
- Approve/reject resolves the pending tool interaction
- Execution continues in the same logical turn

Claude should not require a synthetic continuation prompt after approval.

### Codex

Codex does not expose the same lifecycle primitives as Claude.

Therefore the adapter must emulate the same user-facing contract:

- clarification via `request_user_input`
- one plan review checkpoint
- explicit transition from review into execution
- no repeated plan-review loop unless scope materially changes

If Codex only provides plan text and step updates, the adapter must still preserve the same UX contract.

## Adapter Boundary

Provider-specific:

- protocol events
- tool payloads
- mode switching
- continuation mechanics

Shared:

- question card
- plan review card
- sticky tasklist widget
- phase semantics
- success / error / cancel behavior

## Current Known Failure

The current Codex lifecycle is still wrong:

- after approval, continuation can drift back into plan review
- the model can treat the approved plan as a fresh planning request instead of entering execution
- step status updates are not yet trustworthy enough to represent real tool-driven execution

This is a phase-boundary bug between:

- `plan approved`
- `execution started`

## Required Next Fix

After plan approval, Codex must enter a strict execution-oriented continuation mode:

- do not re-plan by default
- do not ask for approval again
- start tools/work immediately if the task requires them
- update task item status as work progresses
- only return to plan review if scope materially changes and that change is explained to the user

## Pseudocode

### Shared Webview Reducer

```ts
function onQuestionRequested(state, question) {
  state.phase = 'clarify'
  state.pendingQuestion = question
}

function onQuestionAnswered(state) {
  state.pendingQuestion = undefined
}

function onPlanDraftReady(state, draftPlan) {
  state.phase = 'review'
  state.pendingPlanReview = draftPlan
}

function onPlanApproved(state, approvedPlan) {
  state.phase = 'execute'
  state.pendingPlanReview = undefined
  state.activePlan = {
    summary: approvedPlan.summary,
    items: approvedPlan.items,
    approved: true,
    visibleInStickyWidget: true,
  }
}

function onPlanRevised(state, revisedDraft) {
  state.phase = 'review'
  state.pendingPlanReview = revisedDraft
}

function onPlanCancelled(state) {
  state.phase = 'cancelled'
  state.pendingPlanReview = undefined
  state.activePlan = undefined
}

function onTaskItemStarted(state, itemId) {
  for (const item of state.activePlan.items) {
    if (item.id === itemId) item.status = 'inProgress'
  }
}

function onTaskItemCompleted(state, itemId) {
  for (const item of state.activePlan.items) {
    if (item.id === itemId) item.status = 'done'
  }
}

function onExecutionCompleted(state) {
  state.phase = 'done'
}
```

### Claude Adapter

```ts
onClaudeAskUserQuestion(toolCall) -> onQuestionRequested(...)
onClaudeExitPlanMode(planDraft) -> onPlanDraftReady(...)
onClaudeApproveExitPlanMode() -> onPlanApproved(...)
onClaudeRejectExitPlanMode(feedback) -> onPlanRevised(...)
onClaudeExecutionProgress(stepUpdate) -> onTaskItemStarted/onTaskItemCompleted(...)
```

### Codex Adapter

```ts
onCodexRequestUserInput(request) -> onQuestionRequested(...)
onCodexPlanUpdate(planDraft) -> onPlanDraftReady(...)

onCodexApprovePlan() {
  onPlanApproved(...)
  startExecutionContinuation({
    mode: 'execute',
    instructions: 'Do not re-plan unless scope materially changes'
  })
}

onCodexExecutionProgress(stepUpdate) -> onTaskItemStarted/onTaskItemCompleted(...)

onCodexUnexpectedPlanReviewDuringExecution() {
  if (!scopeMateriallyChanged) suppressReplanAndContinueExecution()
  else onPlanDraftReady(newDraftPlan)
}
```

## Acceptance Test

Given a task that requires edits:

1. User asks for the task.
2. Agent asks one clarification question if needed.
3. Agent shows one plan review card.
4. User clicks `Approve`.
5. Agent starts working.
6. Sticky tasklist shows progress.
7. Agent uses tools / edits files.
8. Agent does not ask for plan approval again unless scope changed materially.

If step 8 fails, the lifecycle is still broken.
