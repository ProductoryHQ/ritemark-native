# Sprint 40: Context Window Protection

## Goal

Prevent users from hitting silent "Prompt too long" failures by detecting context overflow errors and providing recovery actions, adding a proactive usage indicator, and warning on large attachments.

## Feature Flag Check

- [x] Does this sprint need a feature flag? NO.
  - This is UX hardening for an existing feature (Claude Code agent).
  - All 4 levels are improvements to existing behavior, not new capabilities.
  - No platform-specific gating, no experimental behavior, no kill-switch needed.
  - Context warnings are always helpful — no reason to gate them.

## Success Criteria

- [ ] When "Prompt too long" (or equivalent) is returned from the SDK, the UI shows a human-readable message explaining what happened
- [ ] The error message includes actionable buttons: "Start fresh conversation" and "Try shorter message"
- [ ] "Start fresh conversation" resets the agent session and clears the conversation
- [ ] When estimated context usage exceeds 70%, a yellow warning banner appears above the chat input
- [ ] Warning banner includes a "/compact" suggestion and a "Start fresh" link
- [ ] Warning banner disappears when a new conversation is started
- [ ] When a text file attachment exceeds ~10K tokens (~40KB), a size warning is shown inline near the attachment
- [ ] A thin context usage progress bar is visible at the top of the conversation area when the conversation is non-empty
- [ ] Progress bar changes color: neutral below 60%, yellow 60-80%, red/orange above 80%
- [ ] All existing agent features (compaction banner, plan mode, subagents, AskUserQuestion) continue to work without regression
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Context overflow error detection | `AgentRunner.ts`: detects "prompt too long" patterns in errors, emits `context_overflow` progress type |
| Friendly error UI | `AgentResponse.tsx`: renders human-readable message + action buttons for context overflow errors |
| Token estimator | `store.ts`: heuristic token count from conversation history (4 chars/token, base64 size correction for images/PDFs) |
| Context warning state | `store.ts`: `estimatedTokens`, `contextUsagePercent`, `showContextWarning` fields |
| Warning banner | `AgentView.tsx`: yellow banner above chat input when > 70% context used |
| Context usage bar | `AgentView.tsx`: thin progress bar at top of conversation, color-coded by usage level |
| Attachment size warning | `ChatInput.tsx`: inline warning below attachment chip when file > ~10K tokens |
| New progress type | `src/agent/types.ts` + `webview/types.ts`: add `context_overflow` to `AgentProgressType` |

## Implementation Checklist

### Phase 1: Types (Foundation)

- [ ] Add `'context_overflow'` to `AgentProgressType` in `extensions/ritemark/src/agent/types.ts`
- [ ] Mirror change in `extensions/ritemark/webview/src/components/ai-sidebar/types.ts`
- [ ] Add `estimatedTokens: number`, `contextUsagePercent: number`, `showContextWarning: boolean` to `AISidebarState` in `store.ts`
- [ ] Initialize new fields to 0 / false

### Phase 2: Error Detection (AgentRunner)

- [ ] Add `isContextOverflowError(str: string): boolean` helper in `AgentRunner.ts`
  - Checks for: `"prompt is too long"`, `"context window"`, `"context_length_exceeded"`, `"too many tokens"`, `"maximum context length"` (case-insensitive)
- [ ] In `_consumeLoop()` on `result` error path: if `isContextOverflowError(errorStr)`, emit `'context_overflow'` progress type (instead of `'error'`) before resolving the turn
- [ ] In `_consumeLoop()` catch path: same detection — if context error, emit `'context_overflow'`
- [ ] In `runAgent()` (one-shot path) on `result` error path: same detection
- [ ] In `runAgent()` catch path: same detection

### Phase 3: Store — Token Estimation

- [ ] Add `estimateConversationTokens(turns: AgentConversationTurn[]): number` function in `store.ts`
  - System overhead constant: 600 tokens
  - Text content: `(userPrompt.length + result?.text?.length ?? 0) / 4`
  - Text attachments: `data.length / 4`
  - Image/PDF attachments: `Math.floor(data.length * 0.75 / 4)` (base64 → binary → tokens)
- [ ] Call `estimateConversationTokens()` and update `estimatedTokens`, `contextUsagePercent`, `showContextWarning` after every `agent-result` message is processed in `handleExtensionMessage`
- [ ] Also update on `startNewConversation()` and `clearChat()` (reset to 0 / false)
- [ ] Also update on `loadSavedConversation()` (recalculate from loaded turns)

### Phase 4: Friendly Error UI (AgentResponse)

- [ ] Add `isContextOverflowError(str: string): boolean` helper in `AgentResponse.tsx` (same pattern — a small utility, not imported from extension)
- [ ] When `turn.result?.error` matches context overflow: render `<ContextOverflowError>` inline component instead of the generic error string
- [ ] `<ContextOverflowError>` renders:
  - Explanatory text: "The conversation has exceeded Claude's context window (200K tokens)."
  - Sub-text: "Long conversations accumulate token usage. Starting fresh gives the agent full context capacity."
  - Button: "Start fresh conversation" → calls `store.startNewConversation()`
  - Button: "Dismiss" → sets local `dismissed` state to hide the special UI (falls back to plain error display)
- [ ] Buttons use existing VS Code button CSS variables (no hardcoded colors)

### Phase 5: Context Warning Banner (AgentView)

- [ ] Read `showContextWarning` and `contextUsagePercent` from store in `AgentView.tsx`
- [ ] When `showContextWarning === true` and `agentConversation.length > 0`, render warning banner between the conversation scroll area and the usage bar
- [ ] Banner content:
  - TriangleAlert icon (lucide-react, already imported in project)
  - Text: `"Conversation is getting long (~{Math.round(contextUsagePercent)}% of context used). Consider /compact or starting fresh."`
  - Inline link/button: "Start fresh" → calls `store.startNewConversation()`
- [ ] Use `--vscode-inputValidation-warningBackground` / `--vscode-editorWarning-foreground` CSS variables
- [ ] Banner is sticky — stays visible while the user scrolls the conversation

### Phase 6: Context Usage Bar (AgentView)

- [ ] Add a thin usage bar (height: 3px) at the top of the conversation container in `AgentView.tsx`
- [ ] Only visible when `agentConversation.length > 0`
- [ ] Bar width = `${contextUsagePercent}%`
- [ ] Color logic:
  - 0-60%: `--vscode-progressBar-background` (blue/normal)
  - 60-80%: `--vscode-editorWarning-foreground` (yellow)
  - 80-100%: `--vscode-errorForeground` (red)
- [ ] Transition: `width 0.4s ease` for smooth animation on update

### Phase 7: Attachment Size Warning (ChatInput)

- [ ] Add `estimateAttachmentTokens(att: FileAttachment): number` in `ChatInput.tsx`
  - Text: `Math.ceil(att.data.length / 4)`
  - Image/PDF: `Math.ceil(att.data.length * 0.75 / 4)`
- [ ] Track per-attachment token estimates in `ChatInput` local state: `Map<string, number>`
- [ ] Update estimates in `processFile()` after attachment is created
- [ ] In the attachment thumbnail strip: if `tokenCount > 10_000`, render a warning line below the chip:
  - `"~{Math.round(tokenCount / 1000)}K tokens — {Math.round(tokenCount / 2000)}% of context window"`
  - Warning color: `--vscode-editorWarning-foreground`
  - Small font (10px)
- [ ] Warning is purely informational — does not block the send

### Phase 8: Validation

- [ ] Test context overflow error: force a "Prompt too long" scenario (paste a massive document as text attachment) and verify friendly error UI appears with action buttons
- [ ] Test "Start fresh conversation" button resets the session correctly
- [ ] Test warning banner: accumulate enough conversation turns to exceed 70% threshold and verify banner appears
- [ ] Test usage bar color transitions through normal / warning / danger zones
- [ ] Test attachment size warning with a large text file (>40KB)
- [ ] Verify compaction banner still works (no regression from `compacted` event handling)
- [ ] Verify plan mode still works (no regression)
- [ ] Verify AskUserQuestion still works (no regression)
- [ ] Run `npx tsc --noEmit` in `extensions/ritemark/` and verify zero errors

## Risks & Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Token estimate is very inaccurate | Medium | Estimate is heuristic — error ±50% is acceptable because the warning is advisory, not a hard block |
| SDK changes "Prompt too long" error text | Low | Use broad pattern matching (check multiple variants); keep generic error fallback as well |
| Context usage bar causes layout shift in existing conversation | Low | Use `position: relative` bar inside existing container div; 3px height has negligible impact |
| "Start fresh" loses conversation history | Low | `startNewConversation()` already auto-saves current conversation before clearing |
| Large base64 attachment estimate wrong direction | Low | For images/PDFs, base64 strings are ~33% larger than binary; dividing by 3 corrects this before dividing by 4 for token estimate |

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** YES — awaiting Jarmo's approval before implementation

## Approval

- [ ] Jarmo approved this sprint plan
