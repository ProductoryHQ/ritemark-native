# Sprint 40 Research: UX Design Decisions

## Level 1: Error Recovery UX

### Error Detection

The raw SDK error string must be inspected for context-overflow patterns:

```typescript
function isContextOverflowError(errorStr: string): boolean {
  const lower = errorStr.toLowerCase();
  return (
    lower.includes('prompt is too long') ||
    lower.includes('context window') ||
    lower.includes('context_length_exceeded') ||
    lower.includes('too many tokens') ||
    lower.includes('maximum context length')
  );
}
```

This check runs in:
- `AgentRunner._consumeLoop()` on the `result` path (where errors come from)
- `AgentRunner._consumeLoop()` on the `catch` path (where thrown errors come from)

### User-Facing Error Message

Instead of showing raw `"Prompt is too long"`, show:

```
The conversation has exceeded Claude's context window (200K tokens).

To continue:
  [Start fresh conversation]  [Try a shorter message]
```

Action buttons:
- **Start fresh conversation** — calls `store.startNewConversation()`. This resets the agent session on the extension side. The previous conversation can be auto-saved to history before resetting.
- **Try shorter message** — closes the error state but keeps the conversation. The user can edit and resend a shorter version.

### New Progress Type

A new `AgentProgressType` value is needed: `'context_overflow'`

This allows the error to be differentiated from generic errors in the UI layer, enabling context-specific action buttons to be rendered by `AgentResponse.tsx`.

### Where to Render

`AgentResponse.tsx` already handles `turn.result.error`. We add a branch:

```tsx
if (turn.result?.error && isContextOverflowError(turn.result.error)) {
  return <ContextOverflowError onNewConversation={...} />;
}
```

The `ContextOverflowError` component shows the friendly message + action buttons.

---

## Level 2: Proactive Warning

### Token Estimation Model

Claude 3 / Claude 4 models: 200,000 token context window.

Warning threshold: **70% = 140,000 tokens**. This leaves ~60K for the current turn's response.

Heuristic calculation (runs client-side in webview store):

```typescript
function estimateTokens(conversation: AgentConversationTurn[]): number {
  const SYSTEM_OVERHEAD = 600; // system prompt + safety prefix
  const CHARS_PER_TOKEN = 4;   // conservative average for English/code

  let chars = 0;
  for (const turn of conversation) {
    chars += turn.userPrompt.length;
    chars += turn.result?.text?.length ?? 0;

    for (const att of turn.attachments ?? []) {
      if (att.kind === 'text') {
        chars += att.data.length;
      } else {
        // base64 encoded: actual size = data.length * 3/4
        chars += Math.floor(att.data.length * 0.75);
      }
    }
  }

  return SYSTEM_OVERHEAD + Math.ceil(chars / CHARS_PER_TOKEN);
}
```

### Warning Banner

Shown above the `ChatInput` when estimated usage exceeds 70%:

```
[TriangleAlert icon] Conversation is getting long (~X% of context used).
Consider /compact or [Start fresh].
```

Color: yellow/warning tones using VS Code variables (`--vscode-editorWarning-foreground`, `--vscode-inputValidation-warningBackground`).

The banner appears in `AgentView.tsx` as a sticky element above `ChatInput`.

### State in Store

```typescript
interface AISidebarState {
  // ... existing ...
  estimatedTokens: number;          // computed on each conversation update
  contextUsagePercent: number;      // 0-100
  showContextWarning: boolean;      // true when > 70%
}
```

---

## Level 3: Attachment Protection

### Size Warning Trigger

When user selects or drops a file, compute:

```typescript
function estimateAttachmentTokens(att: FileAttachment): number {
  if (att.kind === 'text') return Math.ceil(att.data.length / 4);
  // Images and PDFs: base64 back to binary size
  return Math.ceil(att.data.length * 0.75 / 4);
}
```

If `estimateAttachmentTokens(att) > 10_000` (10K tokens, ~2.5% of context), show inline warning:

```
[icon] large-file.md is ~45K tokens (~22% of context window).
```

This warning is informational only — does not block attachment. It gives the user context to make an informed decision.

The warning appears in the attachment thumbnail strip in `ChatInput.tsx`, below the attachment chip.

### Reduced MAX_TEXT_SIZE (Optional)

The current 512KB limit is very permissive. We could reduce it, but Jarmo's description says "dynamic size control based on remaining context estimate" — meaning the limit should be contextual, not fixed. This is complex and could be deferred to a future sprint. For this sprint: just show the warning.

---

## Level 4: Context Usage Indicator

### Visual Design

A thin horizontal progress bar at the top of the `AgentView` container (above the conversation scroll area), only visible when `agentConversation.length > 0`.

```
[==========---------] 52% context used
```

- Green (0-60%): normal, no label
- Yellow (60-80%): `warn` styling, label appears
- Orange/red (80%+): `danger` styling, label appears

At 100%: shows critical state (not functional at this point — context overflow error would already have occurred).

### Minimal Implementation

The indicator is a `div` with a background gradient progress bar:

```tsx
<div className="context-bar" style={{ width: `${contextUsagePercent}%` }} />
```

VS Code CSS variables for color:
- Normal: `--vscode-progressBar-background`
- Warning: `--vscode-editorWarning-foreground`
- Danger: `--vscode-errorForeground`

---

## Implementation Scope — What Goes Where

| Level | Component | File |
|-------|-----------|------|
| L1 error detection | `AgentRunner._consumeLoop()` | `AgentRunner.ts` |
| L1 friendly message | `AgentResponse.tsx` | New component in existing file |
| L2 token estimation | `store.ts` computed in `agent-result` handler | `store.ts` |
| L2 warning banner | `AgentView.tsx` | `AgentView.tsx` |
| L3 attachment warning | `ChatInput.tsx` in `processFile()` | `ChatInput.tsx` |
| L4 usage bar | `AgentView.tsx` above conversation | `AgentView.tsx` |

All levels are additive — no existing functionality is removed or stubbed.
