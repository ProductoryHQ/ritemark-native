# Sprint 104 Technical Plan

## Architecture Overview

All work is webview-store-level (no `AgentRuntime`/host-protocol change; `agent-execute` already carries everything a queued item needs). One new module + surgery on `store.ts`, `ChatInput.tsx`, and the `comment:submit` handler.

```
promptQueue.ts (NEW)   — QueueItem model + pure queue ops + readiness predicate
store.ts               — promptQueues state, enqueue/drain/dispatch actions, drain triggers
ChatInput.tsx          — busy-send intercept enqueues an item; queue panel renders
QueuePanel.tsx (NEW)   — management UI (list, edit/remove/reorder, paused/full states)
threadStatus.ts        — hasQueuedPrompt accessor reads queue length
```

## Workstream 1: Queue model (R1) — `promptQueue.ts`

```ts
export const QUEUE_CAP = 10;
export interface QueueItem {
  id: string; conversationId: string;
  runtimeId: 'claude-code' | 'codex' | 'opencode';
  autonomy: 'auto' | 'ask'; planFirst: boolean; modelId?: string;
  prompt: string;                       // FINAL prompt (context already baked in)
  displayText: string;                  // user-typed text for the row
  source: 'composer' | 'comment';
  attachments?: FileAttachment[];
  skipActiveFile?: boolean; skipBrowserContext?: boolean;
  mentionedAgentPaths?: string[];
  commentIds?: string[]; documentPath?: string;
  status: 'queued' | 'sending' | 'failed'; error?: string;
  createdAt: number;
}
export type PromptQueues = Readonly<Record<string, readonly QueueItem[]>>;
// pure ops: enqueueItem (cap-aware result), removeItem, updateItemPrompt,
// moveItem, markSending, markFailed, requeueFailed, pruneQueues, queueFor
export function isReadyToDrain(state: ConversationActivityState): boolean {
  return state === 'idle' || state === 'done';
}
```

Queue pause is derived, not stored: `failed`/`cancelled` activity state ⇒ paused (resume = user action dispatches head item explicitly, which also clears the pause by starting a run).

## Workstream 2: Store actions + drain triggers (R2, R3)

- State: `promptQueues: PromptQueues` (replaces `composerQueues`); `enqueuePrompt(item)`, `removeQueued`, `editQueued`, `moveQueued`, `retryQueued`, `resumeQueue(conversationId)`, `maybeDrainQueue(conversationId)`.
- `maybeDrainQueue`: head item + `isReadyToDrain(deriveActivityState(conversation))` → `dispatchQueueItem`.
- `dispatchQueueItem(item)`: appends the turn to `item.conversationId`'s own transcript (agent turn or codex turn shape by runtime — the same objects `sendAgentMessage`/`sendCodexMessage` build, minus active-conversation reads) and posts `agent-execute` with the captured payload. Marks `sending`, removes from queue when the post succeeds; catch → `failed`.
- Drain call sites: `agent-result`, `codex-result`, `approvePlan`/`rejectPlan`, `approveCodexPlan`/`discardCodexPlan`, `answerAgentQuestion`/`answerCodexQuestion`, `handleAgentToolApproval`/`handleCodexApproval`, `enqueuePrompt` (idle case), `resumeQueue`.
- `comment:submit` handler: `resolveCommentTargetConversation(runtimeId)` — open conversations bound to that runtime (via `runtimeOfConversation`), prefer `deriveActivityState` idle/done, else least-recently-active; none → `createConversationForRuntime(runtimeId)` (new open thread, NOT activated visually); then `enqueuePrompt` + `maybeDrainQueue`. Active-thread `setPendingRuntime` retargeting is deleted.

## Workstream 3: Composer intercept (R2) — `ChatInput.tsx`

- `shouldQueueInsteadOfSend` stays; on queue-branch it now builds the full prompt (existing `buildFinalPrompt`) and calls `enqueuePrompt` with the thread's `policyOf` snapshot + attachments + flags, then clears the composer (unless enqueue returned `full` — composer keeps text + brief "Queue full (10)" notice).
- The running→idle React auto-send effect is DELETED (store drain owns it).
- Old notch UI replaced by `QueuePanel`.

## Workstream 4: Queue panel UI (R4) — `QueuePanel.tsx`

Per design.md language: 12px rows, index number faint, source icon (`chat-circle` composer / `chat-centered-text` comment), truncated `displayText`, runtime tag when it differs from the thread runtime; ghost icon-buttons edit/up/down/remove; failed row red-ink error + Retry; header "Queued · n/10"; paused banner row (amber) with Resume. Renders between transcript and composer (where the old notch sat).

## Workstream 5: Tests (R5) — `promptQueue.test.ts`

Pure-ops table tests + store-level: enqueue-on-idle dispatches immediately; busy enqueue defers; every non-ready activity state blocks; failure pauses; retry resends; isolation across two conversations; comment target resolution (idle match, busy match, no match → new conversation). Replace `composerQueue.test.ts` (module retired; keep `shouldQueueInsteadOfSend` where still used).

## Order

W1 → W2 → W3 → W4 → W5; commit per workstream; live validation with the Sprint 103 CDP method (rapid submits, parallel threads, plan-review pause).
