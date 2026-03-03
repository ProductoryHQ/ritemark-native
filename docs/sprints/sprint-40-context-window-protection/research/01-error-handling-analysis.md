# Sprint 40 Research: Error Handling Analysis

## Current Error Flow

### How "Prompt too long" reaches the user

The SDK returns errors through two paths:

**Path A: `result` message with `subtype === 'error'`**
```
AgentRunner._consumeLoop()
  → message.type === 'result' && message.subtype !== 'success'
  → errors = message.errors || []
  → errorStr = errors.join('; ') || 'Execution failed'
  → _emitProgress?.('error', errorStr)
  → _forceResolveTurn(turnId, { error: errorStr })
```
Result lands in `store.ts` `agent-result` handler → stored in `turn.result.error`.

**Path B: thrown exception from SDK**
```
AgentRunner._consumeLoop()
  → catch(error)
  → errorMessage = error.message || String(error)
  → _forceResolveTurn(turnId, { error: errorMessage })
```

In both paths, the raw SDK error string propagates directly to the UI. The UI (`AgentResponse.tsx`) renders `turn.result.error` as-is.

### Known error strings (from SDK / Anthropic API)

- `"Prompt is too long"` — literal text confirmed from the screenshot
- `"prompt is too long"` — lowercase variant possible
- `"context window exceeded"` — possible variant
- `"context_length_exceeded"` — API error code embedded in message

No detection, transformation, or special handling exists for any of these.

---

## Current Context Tracking: Zero

There is no token counting anywhere in:
- `AgentRunner.ts` — no token tracking
- `AgentSession` — no message count tracking
- `store.ts` — `agentConversation` array has no size accounting
- `ChatInput.tsx` — no pre-send size check

The only context-related feature that exists is SDK auto-compaction:
- `message.type === 'system' && message.subtype === 'status' && message.status === 'compacting'` → emits `'compacting'` progress
- `message.type === 'system' && message.subtype === 'compact_boundary'` → emits `'compacted'` progress

These are handled in `AgentRunner._consumeLoop()` and shown via `AgentView.tsx` as a `compactedEvent` banner. This is a passive reactive feature — it fires AFTER compaction happens, not before the context fills.

---

## Large Attachment Risk

`ChatInput.tsx` line 28:
```typescript
const MAX_TEXT_SIZE = 512 * 1024; // 500KB
```

At ~4 chars/token, 512KB ≈ 128,000 tokens. Claude's context window is 200K tokens. A single maximum-size text attachment plus the conversation history plus system prompt can easily exceed 200K.

Images and PDFs: no size check currently. A large PDF can be many megabytes (many tokens for vision).

---

## SDK Capabilities (Observable)

From inspection of AgentRunner.ts SDK message types:

**What the SDK exposes:**
- `result` messages include `duration_ms`, `total_cost_usd` — but NOT token counts
- `system` init message includes `model` — no context size
- `compacting` / `compact_boundary` events — indicate compaction happened, no token counts

**What we cannot access:**
- The SDK's internal token count for the conversation
- Exact context window usage percentage
- Whether a message will fit before sending

This means all token tracking must be **heuristic** (estimate based on character count, message count, attachment sizes).

---

## AgentConversationTurn Data for Heuristics

Each turn in `agentConversation[]` contains:
- `userPrompt: string` — text length measurable
- `attachments?: FileAttachment[]` — `data` field length measurable (base64 for images/PDFs, raw text for text files)
- `result?.text: string` — assistant response length measurable

**Formula for heuristic estimate:**
```
tokensForTurn = (userPrompt.length + (result?.text?.length ?? 0)) / 4
             + sum(attachment.data.length / 3)  // base64 is ~33% bigger than binary
             + systemPromptOverhead (static ~500 tokens)
             + safetyPrefixOverhead (static ~100 tokens)
```

This is not precise but gives a reasonable order-of-magnitude estimate.

---

## Key Files

| File | Role | Changes Needed |
|------|------|----------------|
| `extensions/ritemark/src/agent/AgentRunner.ts` | Error catching, progress events | Detect context errors, new progress type |
| `extensions/ritemark/src/agent/types.ts` | Progress types, AgentProgress interface | New progress type `context_warning` |
| `extensions/ritemark/webview/src/components/ai-sidebar/types.ts` | Webview types mirror | Mirror new types |
| `extensions/ritemark/webview/src/components/ai-sidebar/store.ts` | State management | Context usage tracking, warning state |
| `extensions/ritemark/webview/src/components/ai-sidebar/AgentView.tsx` | Conversation UI | Context usage indicator, error recovery UI |
| `extensions/ritemark/webview/src/components/ai-sidebar/ChatInput.tsx` | Input + attachments | Attachment size warning |
| `extensions/ritemark/webview/src/components/ai-sidebar/RunningIndicator.tsx` | Status display | No changes needed (RunningIndicator only shows running state) |
