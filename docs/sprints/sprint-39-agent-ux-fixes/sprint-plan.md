# Sprint 39: AI Agent UX Fixes

## Goal

Fix two broken AI agent interaction patterns: Plan mode (accept/reject buttons non-functional) and AskUserQuestion (agent questions invisible and blocking the session).

## Feature Flag Check

- [x] Does this sprint need a feature flag? NO. -   Both fixes are bug fixes for existing features, not new functionality.      -   Plan mode fix restores intended behavior.      -   AskUserQuestion fix restores SDK-level interaction that was never implemented.      -   Both are within the existing `agentic-assistant` feature flag scope.

## Success Criteria

- [ ] User can type "enter plan mode" (or similar intent) in chat to trigger plan mode for that session
- [ ] A subtle "Plan mode" indicator appears in the chat feed when the agent is operating in plan mode
- [ ] When the agent produces a plan, it is displayed as a formatted, readable structured list — not a raw text dump
- [ ] "Approve plan" and "Reject" buttons appear and function correctly under the formatted plan
- [ ] Approving a plan causes the agent to proceed with execution
- [ ] Rejecting a plan (with optional feedback) causes the agent to revise the plan
- [ ] When the agent calls AskUserQuestion, a structured question UI is shown inline in the conversation
- [ ] User can select answers (single or multi-select) and submit them
- [ ] After submitting answers, the agent continues processing with those answers
- [ ] Questions are visually distinct and clearly actionable (not buried in activity feed)
- [ ] Session does not block indefinitely when AskUserQuestion is pending
- [ ] All UI elements reuse existing chat panel visual patterns (message bubbles, activity card styling)

## Deliverables

| Deliverable | Description |
| --- | --- |
| Plan mode via chat | User types "enter plan mode" in chat; agent detects intent and session switches to `permissionMode: 'plan'` |
| Plan mode indicator | Subtle separator/divider with icon and "Plan mode" label inserted in the chat feed |
| Formatted plan display | Plan steps rendered as a structured list (not raw markdown dump) using existing `RenderedMarkdown` + plan-specific styling |
| Plan approve/reject | Functional buttons shown under the plan; approve switches mode to bypass, reject sends feedback for revision |
| AskUserQuestion detection | `processAssistantMessage()` detects the tool, pauses for answer |
| Tool result injection | `AgentSession` can inject tool results mid-turn into the SDK stream |
| Question UI component | `AgentQuestion.tsx` renders structured questions with clickable option buttons, reusing chat panel styling |
| End-to-end wiring | Extension ↔ webview messaging for question/answer round-trip |

## Implementation Checklist

### Phase 1: Research (complete)

- [x] Understand SDK plan mode flow (`ExitPlanMode`, `EnterPlanMode`, `setPermissionMode`)
- [x] Understand `AskUserQuestion` tool schema and answer injection mechanism
- [x] Map current broken state in `AgentRunner.ts` and `store.ts`
- [x] Identify all files that need changes
- [x] Document tool result injection pattern

### Phase 2: Fix Plan Mode

#### 2.1 AgentRunner — expose setPermissionMode

- [x] Update `QueryHandle` interface in `types.ts` to expose optional `setPermissionMode(mode: string)`
- [x] Add `setPermissionMode(mode)` method to `AgentSession` that delegates to `_queryStream`
- [x] Update `processAssistantMessage()` to emit `enter_plan` and `exit_plan` progress types when `EnterPlanMode` / `ExitPlanMode` tool blocks are detected

#### 2.2 AgentRunner — plan mode session option

- [x] Add optional `planMode: boolean` to `AgentSessionConfig`
- [x] When `planMode: true`, start session with `permissionMode: 'plan'` instead of `bypassPermissions`
- [x] On plan approval: call `setPermissionMode('bypassPermissions')` on the live query, then enqueue the approval message

#### 2.3 UnifiedViewProvider — plan mode trigger via chat

- [x] In `_handleAgentExecution()`, detect plan mode intent from the user's message text before sending to the agent -   Intent phrases: "enter plan mode", "plan mode", "plan first", "show me the plan", etc.      -   If detected: create/recreate session with `planMode: true`; strip the trigger phrase from the prompt or leave it as context
- [x] Add message handler for `'ai-approve-plan'` webview message -   On approval: call `agentSession.setPermissionMode('bypassPermissions')` then enqueue approval confirmation
- [x] Add message handler for `'ai-reject-plan'` webview message -   On rejection: enqueue rejection feedback as user message (session stays in plan mode for revision)

#### 2.4 AgentProgress types

- [x] Add `'enter_plan'` and `'exit_plan'` to `AgentProgressType` in `src/agent/types.ts`
- [x] Mirror changes in webview `types.ts`

#### 2.5 Webview store — plan mode state and approval actions

- [x] Add `isInPlanMode: boolean` to `AgentConversationTurn` (set true when `enter_plan` activity seen)
- [x] Update `approvePlan()` to send `'ai-approve-plan'` message (not `'ai-execute-agent'`)
- [x] Update `rejectPlan()` to send `'ai-reject-plan'` message (not `'ai-execute-agent'`)
- [x] In `agent-result` handler: detect `exit_plan` activity (not `plan_ready`) to set `isPlan: true`

#### 2.6 Webview UI — plan mode indicator

- [x] In `AgentView.tsx`, when a turn has `isInPlanMode: true`, render a plan mode separator before the turn's content
- [x] In `RunningIndicator.tsx`, show "Planning..." text when the latest activity is `enter_plan` or `exit_plan`

#### 2.7 Webview UI — formatted plan display

- [x] In `AgentResponse.tsx`, when `turn.isPlan && !turn.planHandled`: -   Render plan via `<RenderedMarkdown>` wrapped in a distinct visual container (left-border accent + background)      -   Approve / Reject buttons follow the plan block

### Phase 3: Fix AskUserQuestion

#### 3.1 AgentRunner — detect AskUserQuestion

- [x] In `processAssistantMessage()`, add branch for `block.name === 'AskUserQuestion'`
- [x] Extract `toolUseId` (= `block.id`) and `questions` from `block.input`
- [x] Add `'ask_user_question'` to `AgentProgressType`
- [x] Emit `ask_user_question` progress with full question data attached (new `question` field on `AgentProgress`)
- [x] Do NOT emit a generic `tool_use` for this block — it needs dedicated handling

#### 3.2 AgentSession — tool result injection

- [x] Add `injectToolResult(toolUseId: string, content: string)` method to `AgentSession`
- [x] Enqueues an `SDKUserMessage` with `tool_result` content into `_inputQueue`

#### 3.3 AgentProgress types for questions

- [x] Add `AgentQuestion` and `AgentQuestionItem` interfaces to `src/agent/types.ts`
- [x] Add optional `question?: AgentQuestion` field to `AgentProgress`
- [x] Mirror in webview `types.ts`

#### 3.4 Conversation turn type update

- [x] Add `pendingQuestion?: AgentQuestion` to `AgentConversationTurn` in webview `types.ts`

#### 3.5 UnifiedViewProvider — answer handling

- [x] Add message handler for `'ai-answer-question'` from webview
- [x] On receipt: call `agentSession.injectToolResult(message.toolUseId, message.answersJson)`

#### 3.6 Webview store — question state

- [x] In `agent-progress` handler, when `progress.type === 'ask_user_question'`: store question in `lastTurn.pendingQuestion`
- [x] Add `answerQuestion(turnId, question, answers)` action: clears `pendingQuestion`, sends `'ai-answer-question'`

#### 3.7 AgentQuestion component

- [x] Created `extensions/ritemark/webview/src/components/ai-sidebar/AgentQuestion.tsx`
- [x] Single-select and multi-select support
- [x] "Other" free-text fallback option
- [x] Submit button disabled until all questions answered
- [x] Uses VS Code CSS variables throughout

#### 3.8 AgentView — render pending questions

- [x] Render `<AgentQuestion>` when `turn.isRunning && turn.pendingQuestion`
- [x] Hide `<RunningIndicator>` while question is pending
- [x] `ChatInput` blocks input when `pendingQuestion` is active (uses `isBlocked` derived state)

### Phase 4: Testing & Validation

- [ ] Test plan mode trigger: type "enter plan mode, then..." in chat and verify plan mode indicator appears and plan UI renders
- [ ] Test plan approve: verify agent proceeds with full execution after approval
- [ ] Test plan reject: verify agent revises and offers a new plan with feedback
- [ ] Test AskUserQuestion: trigger an agent task that naturally causes the agent to ask clarifying questions
- [ ] Test multi-select questions
- [ ] Test single-select questions
- [ ] Test "Other" free-text fallback option
- [ ] Test session does not block if question answer times out
- [ ] Verify subagent features still work (no regression)
- [ ] Verify chat history saves correctly after question/answer turns and plan mode turns

### Phase 5: Cleanup & Docs

- [ ] Remove any debug logging added during development
- [ ] Update sprint notes
- [ ] Check for TypeScript errors (`npx tsc --noEmit`)

## Technical Notes

### Plan Mode Trigger — Intent Detection

Plan mode is activated by the user's chat message, not a UI control. Intent is detected in `UnifiedViewProvider._handleAgentExecution()` before the session starts (or before the message is enqueued if a session already exists).

Trigger phrases (case-insensitive substring match):

-   "enter plan mode"
    
-   "plan mode"
    
-   "plan first"
    
-   "plan before"
    
-   "show me the plan"
    
-   "plan this out"
    

When detected:

-   If no session exists: create one with `planMode: true` (uses `permissionMode: 'plan'`)
    
-   If a session already exists in bypass mode: close it and start fresh with plan mode (plan mode cannot be retrofitted onto a running session)
    
-   The phrase is not stripped from the prompt — the agent receives the full message for context
    

### Plan Mode Sequence

```plaintext
User sends: "enter plan mode, then reorganize my notes folder"
→ UnifiedViewProvider detects "enter plan mode" intent
→ Creates AgentSession with planMode: true (permissionMode: 'plan')
→ Sends full message as first turn
→ Agent calls EnterPlanMode → emitProgress('enter_plan', ...)
→ Plan mode indicator appears in AgentView (subtle divider)
→ RunningIndicator shows "Planning..."
→ Agent writes plan text → emitProgress('thinking', plan text...)
→ Agent calls ExitPlanMode → emitProgress('exit_plan', 'Plan ready')
→ 'agent-result' arrives with isPlan: true
→ AgentResponse renders plan via RenderedMarkdown in an accented container
→ Approve / Reject buttons shown below
→ User clicks Approve:
  → store.approvePlan() → sends 'ai-approve-plan' to extension
  → UnifiedViewProvider → agentSession.setPermissionMode('bypassPermissions')
  → agentSession._enqueueInput(approval message)
  → New running turn added to UI
  → Agent executes the plan
→ 'agent-result' arrives → execution turn completes
```

### AskUserQuestion Sequence

```plaintext
Agent runs (any permission mode)
→ Agent calls AskUserQuestion tool_use block
→ processAssistantMessage detects block.name === 'AskUserQuestion'
→ emitProgress('ask_user_question', ..., question: AgentQuestion)
→ UnifiedViewProvider forwards as agent-progress to webview
→ store: lastTurn.pendingQuestion = question
→ AgentView renders <AgentQuestion> below RunningIndicator
→ ChatInput is disabled while pendingQuestion is set
→ User selects answers + clicks Submit
→ store.answerQuestion() → sends 'ai-answer-question' to extension
→ UnifiedViewProvider → agentSession.injectToolResult(toolUseId, answersJson)
→ Agent receives tool result → continues processing
→ Eventually → 'agent-result' → turn completes, pendingQuestion cleared
```

### Answer Format

```typescript
// Serialized as JSON string for the tool_result content
{
  answers: {
    "question_0": "Selected label",            // single-select
    "question_1": ["Label A", "Label B"],      // multi-select
    "question_2": "User typed text"            // "Other" free-text
  }
}
```

### Plan Display — Formatted vs Raw

The agent's plan arrives as `result.text` (markdown string). The `RenderedMarkdown` component already handles:

-   Numbered lists → `<ol>` with readable styling
    
-   Bullet lists → `<ul>`
    
-   Bold text → step emphasis
    
-   Headings → section structure
    

No custom plan parser is needed. The only addition is a visual wrapper around the `RenderedMarkdown` output when `turn.isPlan` is true — a subtle left-border accent and slightly differentiated background using existing VS Code variables.

### QueryHandle Interface Gap

Current `QueryHandle` in `src/agent/types.ts`:

```typescript
export interface QueryHandle extends AsyncIterable<unknown> {
  interrupt(): Promise<void>;
  close(): void;
}
```

Update to:

```typescript
export interface QueryHandle extends AsyncIterable<unknown> {
  interrupt(): Promise<void>;
  close(): void;
  setPermissionMode?(mode: string): Promise<void>;
}
```

The `?` makes it optional — call is always guarded with `?.` to be safe at runtime.

## Risks & Mitigation

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `setPermissionMode` not present on SDK QueryHandle at runtime | Medium | Typed as optional `?`, wrapped in try/catch, fall back to simple message-based approval if unavailable |
| AskUserQuestion answer format rejected by SDK | Low | Test with real agent invocations; inspect SDK source for exact tool\_result format expectations |
| Infinite wait if user never answers a question | Medium | Add 5-minute inactivity timeout on pending questions; auto-submit a "skipped" answer to unblock the session |
| Intent detection false-positives for plan mode phrases | Low | Use explicit multi-word phrases; user can still type those words in other contexts without issue since plan mode can be exited by interrupting |
| AgentProgress type additions break existing message handling | Low | All changes are additive — new types and new optional fields only |

## Ad-hoc: File Context & "Send to AI Chat" (2026-03-03)

Added outside the formal sprint process — file context management for the AI chat input.

### Problem

Users had no way to reference specific files in their AI prompts. The implicit `[Currently editing]` context was invisible, and there was no way to add other files. Drag-and-drop from Explorer to the webview doesn't work due to VS Code's iframe sandbox.

### What Was Built

#### 1. Explorer Context Menu — "Send to AI Chat"

Right-click any file/folder in Explorer → **"Send to AI Chat"** → file path appears as a removable chip in the chat input.

**Files changed:**
- `package.json` — added `ritemark.sendToChat` command + `explorer/context` menu contribution
- `extension.ts` — command handler receives `vscode.Uri` args, sends paths via `postMessage`
- `UnifiedViewProvider.ts` — `sendFilePaths()` method posts `files-dropped` message to webview
- `types.ts` — added `files-dropped` ExtensionMessage type
- `store.ts` — dispatches `ritemark:files-dropped` CustomEvent to ChatInput
- `ChatInput.tsx` — listens for the event, creates path chips

**How it works:**
```
Right-click file in Explorer
→ VS Code invokes ritemark.sendToChat command with Uri + selected Uris
→ Extension calls unifiedViewProvider.sendFilePaths(paths)
→ Webview receives 'files-dropped' message
→ Store dispatches CustomEvent
→ ChatInput adds path chips + focuses the AI panel
```

Supports multi-select (multiple files at once). Path chips appear as removable badges above the textarea. On send, they become `[File: /path/to/file.md]` prefixes in the prompt.

#### 2. Active File Context Chip

The currently editing file now shows as a visible, removable chip above the chat input (dimmer style than manual path chips).

**Files changed:**
- `UnifiedViewProvider.ts` — sends `active-file-changed` message on tab change, `activeFilePath` in `selection-update`
- `types.ts` — added `active-file-changed` ExtensionMessage type
- `store.ts` — `activeFilePath` state field, handles both messages
- `ChatInput.tsx` — renders context chip, `hideActiveFile` state for dismissal

**Behavior:**
- Chip auto-updates when user switches tabs (`tabGroups.onDidChangeTabs`)
- Chip resets (reappears) when switching to a different file
- X button dismisses it for the current message
- When dismissed, `skipActiveFile` flag is sent with the prompt → extension skips `[Currently editing]` injection

#### 3. Deduplication

When the same file appears as both a path chip AND the active file, the `[Currently editing]` context is skipped to avoid wasting tokens.

**File changed:** `AgentRunner.ts` — `sendMessage()` checks if `activeFile.path` already exists in path chip `[File: ...]` markers before prepending `[Currently editing]`.

#### 4. Multi-file Drag Support (text/plain fallback)

The `handleDrop` in ChatInput now splits `text/plain` on newlines to handle multi-file drags (works for terminal/Finder drops, not Explorer due to iframe sandbox).

#### 5. Drag-and-drop enabled for all agents

Previously restricted to Claude Code only. Path chip drops now work for Ritemark Agent and Codex too. File attachment processing (base64 images/PDFs) remains Claude Code only.

### Files Modified (Summary)

| File | Changes |
| --- | --- |
| `package.json` | Added `ritemark.sendToChat` command + `explorer/context` menu |
| `src/extension.ts` | Registered `sendToChat` command handler |
| `src/views/UnifiedViewProvider.ts` | `sendFilePaths()`, `_sendActiveFile()`, `skipActiveFile` param, tab change listener |
| `src/agent/AgentRunner.ts` | Dedup logic in `sendMessage()` — skip `[Currently editing]` when file in path chips |
| `webview/src/components/ai-sidebar/types.ts` | `files-dropped`, `active-file-changed` message types |
| `webview/src/components/ai-sidebar/store.ts` | `activeFilePath` state, message handlers, `skipActiveFile` option on `sendAgentMessage` |
| `webview/src/components/ai-sidebar/ChatInput.tsx` | Context chip UI, `hideActiveFile`, multi-file drop parsing, all-agent drop support |

## Ad-hoc: v1.4.1 Fixes (2026-03-06)

Batch of fixes discovered during v1.4.1 release testing.

### 1. Microphone Permissions in Webview (macOS)

**Problem:** Voice dictation showed "Microphone Access Required" dialog even though macOS had granted microphone permission to Ritemark. The Electron permission handler correctly approved the request, but the webview iframe's Permissions Policy blocked `getUserMedia()`.

**Root cause:** VS Code's webview iframes have an `allow` attribute listing permitted features (`cross-origin-isolated`, `autoplay`, `clipboard-read`, `clipboard-write`) but NOT `microphone`. The browser's Permissions Policy requires every iframe in the chain to explicitly allow a feature.

**Fix:** Added `microphone` to the `allow` attribute on both iframe levels:
- Outer iframe: `webviewElement.ts` line 403
- Inner iframe: `index.html` line 1032 + `index-no-csp.html` line 997
- Updated CSP hash in `index.html` (inline script content changed)

**Patch:** `005-ritemark-webview-microphone.patch`

**Files changed (VS Code core):**
| File | Change |
| --- | --- |
| `src/vs/workbench/contrib/webview/browser/webviewElement.ts` | Added `'microphone'` to outer iframe allowRules |
| `src/vs/workbench/contrib/webview/browser/pre/index.html` | Added `'microphone;'` to inner iframe allowRules + updated CSP hash |
| `src/vs/workbench/contrib/webview/browser/pre/index-no-csp.html` | Added `'microphone;'` to inner iframe allowRules |

### 2. Windows: "spawn node ENOENT" in Claude Code Agent

**Problem:** On Windows, clicking "Claude Code" in AI sidebar and sending a message fails with `Failed to spawn Claude Code process: spawn node ENOENT`.

**Root cause:** The `@anthropic-ai/claude-agent-sdk` spawns `node cli.js` to run the Claude CLI. On Windows, Ritemark ships as an Electron app — there is no system `node` on PATH. The SDK's `getDefaultExecutable()` returns `"node"` which doesn't exist.

**Fix:** Pass `executable: process.execPath` in both `query()` call sites in `AgentRunner.ts`. `process.execPath` is the Electron binary, which can run Node.js scripts.

**Files changed (extension):**
| File | Change |
| --- | --- |
| `src/agent/AgentRunner.ts` | Added `executable: process.execPath` to both `runAgent()` and `AgentSession._startSession()` query options |

### 3. Dynamic Model Lists

**Problem:** Claude and Codex model dropdowns were hardcoded. When models change, a code update was needed.

**Fix:** Models are now fetched dynamically. Claude models start with a fallback list and update when the SDK reports available models. Codex models are fetched from the Codex app-server.

**Files changed:**
| File | Change |
| --- | --- |
| `src/agent/claudeModels.ts` | NEW — fallback model list for Claude |
| `src/codex/codexModels.ts` | NEW — dynamic Codex model fetching |
| `src/agent/index.ts` | Export `CLAUDE_FALLBACK_MODELS` |
| `src/agent/types.ts` | Deprecated `CODEX_MODELS` constant |
| `src/codex/index.ts` | Export `getCodexModels` |
| `src/views/UnifiedViewProvider.ts` | Use dynamic model lists, added `onModelsDiscovered` callback |
| `webview/src/components/ai-sidebar/store.ts` | Handle `agent:models-update` message, smart model selection on list change |
| `webview/src/components/ai-sidebar/types.ts` | Added `agent:models-update` message type |

### 4. Codex Image URL Format Fix

**Problem:** Image attachments sent to Codex app-server used wrong format (`image_url: url` instead of `image_url: { url }`).

**Fix:** Corrected to match OpenAI API spec.

**Files changed:**
| File | Change |
| --- | --- |
| `src/codex/codexAppServer.ts` | `image_url: url` → `image_url: { url }` |
| `src/codex/codexProtocol.ts` | Updated `UserInput` type to `image_url: { url: string }` |

## Status

**Current Phase:** 4 (TEST & VALIDATE)
**Approval Required:** NO — gate requires qa-validator pass

## Approval

- [x] Jarmo approved this sprint plan