# Sprint 39 Research: AI Agent UX Fixes

**Date:** 2026-02-20

## Summary of Issues

Two distinct broken interaction patterns in the Claude Code agent UI:

1. **PLAN MODE — Accept/Reject buttons are broken**
2. **AskUserQuestion — Questions from the agent are not displayed or answerable**

---

## Issue 1: Plan Mode Accept/Reject

### How Plan Mode Works in the SDK

The Claude Code SDK has a `permissionMode: 'plan'` option that puts the agent into planning mode — it shows a plan but does NOT execute any tools.

When the agent is ready to show its plan, it calls the `ExitPlanMode` tool in a `tool_use` content block. The `ExitPlanModeInput` interface (from `sdk-tools.d.ts`) shows:

```typescript
interface ExitPlanModeInput {
  allowedPrompts?: Array<{ tool: "Bash"; prompt: string }>;
  pushToRemote?: boolean;
  remoteSessionId?: string;
  remoteSessionUrl?: string;
  remoteSessionTitle?: string;
}
```

The agent also calls `EnterPlanMode` at the start of plan mode.

### How the Current Implementation Handles Plan Mode

In `AgentRunner.ts` `processAssistantMessage()`:

```typescript
if (block.name === 'ExitPlanMode') {
  emitProgress('plan_ready', 'Plan ready for review');
  continue;
} else if (block.name === 'EnterPlanMode') {
  emitProgress('tool_use', 'Entering plan mode');
  continue;
}
```

This emits a `plan_ready` progress event, but **it never actually enters plan mode** — the session is running with `permissionMode: 'bypassPermissions'`, not `permissionMode: 'plan'`.

### How the Webview Detects Plans

In `store.ts` `handleExtensionMessage()`, case `agent-result`:

```typescript
const hasPlanActivity = lastTurn.activities.some(a => a.type === 'plan_ready');
conv[conv.length - 1] = {
  ...lastTurn,
  isRunning: false,
  isPlan: hasPlanActivity,
  ...
};
```

So the plan detection relies on seeing a `plan_ready` activity in the activities array.

### Root Problem: Session Mode vs Message Handling

**The current session never uses plan mode.** The session starts with `permissionMode: 'bypassPermissions'`. The `ExitPlanMode` tool block in the assistant message would only appear if the SDK is in plan mode. In bypass mode, the agent just executes tools directly — so the user would never see `ExitPlanMode` in the stream.

Even if the agent text mentions a "plan", the `isPlan` flag never becomes `true` because `plan_ready` progress is never emitted.

### Why Approve/Reject Buttons Don't Work

Looking at `AgentResponse.tsx`:

```typescript
const needsApproval = turn.isPlan && !turn.planHandled;
```

The buttons only show when `turn.isPlan === true`. Since the plan mode detection is broken (never emits `plan_ready`), the buttons never appear.

When `approvePlan()` IS called (from `store.ts`):

```typescript
approvePlan: (turnId) => {
  // Marks turn as planHandled
  // Sends 'ai-execute-agent' with prompt: 'Plan approved. Proceed with implementation.'
  // Creates a new running turn
}
```

This sends a follow-up message to the agent session. Since the session is already using `bypassPermissions`, the "proceed" message may work — but the agent would need to have previously generated a plan for this to be meaningful.

### The Real Fix Needed

Option A: Use `permissionMode: 'plan'` for the first turn, then switch to `bypassPermissions` after approval. The SDK's `Query.setPermissionMode()` control method can change mode on a live session.

Option B: Keep current mode but detect "plan" language in the agent's text output and show approval UI. This is fragile — depends on text parsing.

Option C: Hybrid — use the SDK's `canUseTool` callback to intercept tool usage requests and present them to the user before execution. This is the proper "permission mode" flow.

**Best approach: Option A** — Use `permissionMode: 'plan'` initially. The SDK will call `ExitPlanMode` when the agent is done planning. At that point, we present the plan to the user. On approval, call `query.setPermissionMode('bypassPermissions')` and send the approval message. This matches the SDK's design intent.

**Key API for switching modes:** The `Query` interface has:
```typescript
setPermissionMode(mode: PermissionMode): Promise<void>;
```

This is only available in streaming input mode (which we ARE using — `AgentSession` uses the streaming input pattern).

### How Plan Mode is Triggered — Chat Intent (Jarmo's Decision)

Plan mode is triggered via the chat message itself — the user simply types something like "enter plan mode" or "plan first" as part of their message. There is NO separate UI toggle, button, or control for switching modes.

`UnifiedViewProvider._handleAgentExecution()` inspects the user's message for intent phrases before creating the session:
- "enter plan mode", "plan mode", "plan first", "plan before", "show me the plan", "plan this out"

When detected, the session is started with `permissionMode: 'plan'`. The trigger phrase is left in the message — the agent uses it as context.

This keeps the UI clean: no extra controls, no toggles. Plan mode is a conversational intent, consistent with how Claude Code works natively.

---

## Issue 2: AskUserQuestion

### What AskUserQuestion Is

`AskUserQuestion` is a built-in Claude Code tool. From `sdk-tools.d.ts`:

```typescript
interface AskUserQuestionInput {
  questions: Array<{
    question: string;   // The full question text
    header: string;     // Short label (max 12 chars) shown as chip
    options: Array<{    // 2-4 choices
      label: string;
      description: string;
    }>;
    multiSelect: boolean;
  }>;  // 1-4 questions
  answers?: { [k: string]: string };
  metadata?: { source?: string };
}
```

It's a structured question UI — the agent asks 1-4 multiple-choice questions with 2-4 options each. The user selects answers, and those answers are sent back to the agent as a tool result.

### How It Appears in the SDK Stream

`AskUserQuestion` appears as a `tool_use` content block in an `SDKAssistantMessage`:

```
{
  type: 'assistant',
  message: {
    content: [{
      type: 'tool_use',
      name: 'AskUserQuestion',
      id: 'tool_use_123',
      input: { questions: [...] }
    }]
  }
}
```

The session then **waits** for the tool result to be injected. The answer must be sent back as an `SDKUserMessage` with `tool_use_result` containing the answers.

### Current Handling

In `processAssistantMessage()` in `AgentRunner.ts`:

```typescript
} else if (block.name === 'Agent' || block.name === 'Task') {
  // Subagent spawned
} else if (block.name === 'Write' && input?.file_path) {
  // Write tool
} // ... etc
```

There is **NO handling for `AskUserQuestion`**. The tool block falls through to:

```typescript
emitProgress('tool_use', toolMessage, block.name, input?.file_path);
```

So it shows up as a generic `tool_use` activity item ("Using AskUserQuestion") in the activity feed with no questions displayed and no way for the user to respond.

Because no tool result is injected into the stream, the session is **blocked waiting forever** for the answer. This causes the agent to appear stuck.

### The Fix Required

Two parts:

**Part 1 — Extension (AgentRunner.ts):**
- Detect `AskUserQuestion` tool_use blocks
- Pause the session (or handle tool result injection)
- Send the question to the webview as a special message type
- Wait for the user's answer
- Inject the answer as a tool result into the session stream

**The SDK mechanism for injecting tool results:** The session uses streaming input (`_createMessageStream`). We need to inject an `SDKUserMessage` with `tool_use_result`. The format is:

```typescript
{
  type: 'user',
  message: {
    role: 'user',
    content: [{
      type: 'tool_result',
      tool_use_id: 'tool_use_123',  // matches the AskUserQuestion id
      content: JSON.stringify({ answers: { "Question 1": "Option A" } })
    }]
  },
  parent_tool_use_id: null,
  session_id: ''
}
```

**Part 2 — Webview:**
- Render a proper question UI when `AskUserQuestion` is received
- Allow user to select answers (with multi-select support)
- Submit answers back to extension
- Extension injects them into the agent session

---

## Current Architecture Constraints

### AgentSession Message Queue

The `AgentSession` class uses a long-lived message stream (`_createMessageStream`). The `_enqueueInput` / `_dequeueInput` mechanism feeds user messages to the SDK.

To inject a tool result, we need to enqueue an `SDKUserMessage` with `tool_use_result`. This is the same queue used for user messages — so we need to:

1. Recognize the `AskUserQuestion` in the assistant message stream
2. Pause the current turn's timeout (it's waiting for the agent)
3. Send the question to webview
4. When user responds, enqueue the tool result message
5. The agent continues processing with the answer

The key challenge: Currently, `sendMessage()` waits for a `result` message from the SDK. During `AskUserQuestion`, no `result` will come until we respond. We need to handle this mid-turn interaction.

### Communication Architecture

Current flow:
```
User → sendAgentMessage() → store → vscode.postMessage('ai-execute-agent')
→ UnifiedViewProvider → AgentSession.sendMessage() → SDK stream
→ agent-progress events → webview store → UI
→ agent-result → webview store → UI
```

For AskUserQuestion, we need:
```
SDK stream → 'AskUserQuestion' tool_use block
→ emitProgress('ask_user_question', ...) with questions data
→ UnifiedViewProvider forwards as 'agent-question' message
→ webview store handles → shows question UI (blocks input)
→ user answers → 'agent-answer' message to extension
→ UnifiedViewProvider → AgentSession injects tool result
→ SDK continues → eventual result
```

---

## Key Files to Modify

### Extension Side
- `extensions/ritemark/src/agent/AgentRunner.ts` — detect AskUserQuestion, expose method to inject tool results
- `extensions/ritemark/src/agent/types.ts` — add `ask_user_question` progress type + question data type
- `extensions/ritemark/src/views/UnifiedViewProvider.ts` — handle `agent-answer` message from webview, wire injection

### Webview Side
- `extensions/ritemark/webview/src/components/ai-sidebar/types.ts` — add question types to ExtensionMessage
- `extensions/ritemark/webview/src/components/ai-sidebar/store.ts` — handle `agent-question` message, expose `answerQuestion` action
- New component: `AgentQuestion.tsx` — renders the structured question UI with chips/buttons
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentView.tsx` — render pending questions within the running turn
- `extensions/ritemark/webview/src/components/ai-sidebar/AgentRunner.ts` (in processAssistantMessage) — detect AskUserQuestion

---

## Plan Mode Implementation Path

### SDK API for Plan Mode Switch

The `AgentSession._queryStream` is typed as `QueryHandle` which we defined ourselves:

```typescript
export interface QueryHandle extends AsyncIterable<unknown> {
  interrupt(): Promise<void>;
  close(): void;
}
```

This is missing `setPermissionMode()`. We need to update `QueryHandle` to expose it:

```typescript
export interface QueryHandle extends AsyncIterable<unknown> {
  interrupt(): Promise<void>;
  close(): void;
  setPermissionMode?(mode: string): Promise<void>;
}
```

Then in `AgentSession`, when plan approval comes in, call:
```typescript
await this._queryStream?.setPermissionMode?.('bypassPermissions');
```

And enqueue the approval message.

### Plan Mode Detection — What Actually Triggers ExitPlanMode

The agent only uses `ExitPlanMode` tool when running in `permissionMode: 'plan'`. With `bypassPermissions`, there's no plan mode.

To enable plan mode properly:
1. User's message contains a plan mode intent phrase
2. `UnifiedViewProvider` detects the phrase → creates session with `permissionMode: 'plan'`
3. Agent sees the plan-only restriction, writes its plan, calls `ExitPlanMode`
4. We detect `ExitPlanMode` in the assistant message → mark turn as `isPlan: true`
5. User approves → we call `setPermissionMode('bypassPermissions')` on the live query
6. We enqueue the approval message → agent proceeds with execution

The default session mode remains `bypassPermissions` (execute immediately). Plan mode is an on-demand behavior triggered conversationally — no UI controls involved.

### Plan Mode UI — Indicator and Display (Jarmo's Decisions)

**Plan mode indicator:** When the agent enters plan mode (`enter_plan` activity detected), a subtle separator/divider is inserted in the `AgentView` chat feed above the turn. It contains a small icon (e.g., `ClipboardList`) and the text "Plan mode" in the description foreground color. This is compact and non-intrusive — it signals context without demanding attention.

**Plan content display:** When the plan is ready (`isPlan: true`), the plan text (`result.text`) is rendered via the existing `RenderedMarkdown` component — the same component used for all agent responses. The agent naturally generates numbered lists or bullet steps in markdown; `RenderedMarkdown` renders them legibly. A subtle visual wrapper (left-border accent, slight background tint) distinguishes the plan block from normal responses. No custom step parser is needed.

**Reuse existing patterns:** All plan mode UI reuses existing chat panel visual language — activity card styling, VS Code CSS variables, font size variables. No new component patterns or custom design elements.

### AskUserQuestion UI — Reuse Existing Patterns (Jarmo's Decision)

The `AgentQuestion.tsx` component must reuse the visual language already present in the chat panel:
- Container background and borders: `--vscode-input-background`, `--vscode-panel-border`
- Font sizing: `--chat-font-size` CSS variable
- Button states: selected uses `--vscode-button-background`, unselected uses `--vscode-button-secondaryBackground`
- No new icons or custom layouts — options are presented as rows of buttons, consistent with how activity cards display tool info

No new design patterns. No custom CSS. No hardcoded colors.

---

## Gaps in Current Types

Missing from `types.ts`:

```typescript
// For plan mode
'enter_plan' | 'exit_plan'  // new AgentProgressType values

// For AskUserQuestion
'ask_user_question'         // new AgentProgressType value

// Question data structure
export interface AgentQuestion {
  toolUseId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>;
}
```

Missing from `AgentConversationTurn`:
```typescript
pendingQuestion?: AgentQuestion;  // When AskUserQuestion is pending
```

Missing from `ExtensionMessage` union:
```typescript
| { type: 'agent-question'; question: AgentQuestion }
```

---

## Summary of Root Causes

| Issue | Root Cause |
|-------|-----------|
| Plan mode buttons never appear | Session uses `bypassPermissions` — `ExitPlanMode` never emitted by agent. `isPlan` always false. |
| Plan approve does nothing useful | `approvePlan` sends a follow-up message, but agent already ran in full — there's no plan to approve. |
| AskUserQuestion invisible | No detection in `processAssistantMessage`. Falls through as generic `tool_use`. |
| AskUserQuestion blocks session | No tool result injected → session waits indefinitely for user answer it never gets. |

---

## What Works Well (Don't Break)

- `AgentSession` warm process pattern (fast follow-ups)
- `sendMessage()` → `agent-progress` → `agent-result` flow
- Subagent detection and SubagentCard UI
- Chat history persistence
- Cancel/interrupt mechanism
