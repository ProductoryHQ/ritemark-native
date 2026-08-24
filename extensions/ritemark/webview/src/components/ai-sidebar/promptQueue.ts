/**
 * Sprint 104 (#162) — bounded per-conversation prompt queue.
 *
 * Pure data model + operations, no React and no store access, so every rule
 * (cap, order, capture immutability, readiness) is unit-testable in isolation.
 *
 * Design contract (spec R1–R3):
 * - An item FREEZES its target at enqueue: conversation, runtime, policy,
 *   final prompt, attachments. Later UI changes must not retarget it.
 * - The queue is per conversation; no accessor ever falls back to another
 *   conversation's items (the Sprint 99 composer-slot invariant, upgraded).
 * - Draining is allowed only in truly-ready activity states — a pending plan
 *   review / question / approval is NOT ready (Sprint 103 state model).
 */

import type { ConversationActivityState } from './activityState';
import type { FileAttachment, ThinkingEffort } from './types';

export const QUEUE_CAP = 10;

export interface QueueItem {
  id: string;
  /** Immutable target conversation — never the "currently visible" one. */
  conversationId: string;
  runtimeId: 'claude-code' | 'codex' | 'opencode';
  autonomy: 'auto' | 'ask';
  planFirst: boolean;
  modelId?: string;
  /** Frozen with the item; later Composer changes cannot affect this turn. */
  thinkingEffort: ThinkingEffort;
  /** Final prompt with all context baked in at enqueue time. */
  prompt: string;
  /** What the user typed — shown in the queue row. */
  displayText: string;
  source: 'composer' | 'comment';
  attachments?: FileAttachment[];
  skipActiveFile?: boolean;
  skipBrowserContext?: boolean;
  mentionedAgentPaths?: string[];
  /** Comment-originated metadata (Sprint 105 consumes). */
  commentIds?: string[];
  documentPath?: string;
  status: 'queued' | 'sending' | 'failed';
  error?: string;
  createdAt: number;
}

export type PromptQueues = Readonly<Record<string, readonly QueueItem[]>>;

export interface EnqueueResult {
  queues: PromptQueues;
  outcome: 'queued' | 'full';
}

/** Read one conversation's queue. Never another's. */
export function queueFor(queues: PromptQueues, conversationId: string | null): readonly QueueItem[] {
  if (!conversationId) return [];
  return queues[conversationId] ?? [];
}

export function enqueueItem(queues: PromptQueues, item: QueueItem): EnqueueResult {
  const existing = queueFor(queues, item.conversationId);
  if (existing.length >= QUEUE_CAP) {
    return { queues, outcome: 'full' };
  }
  return {
    queues: { ...queues, [item.conversationId]: [...existing, item] },
    outcome: 'queued',
  };
}

export function removeItem(queues: PromptQueues, conversationId: string, itemId: string): PromptQueues {
  const existing = queueFor(queues, conversationId);
  const next = existing.filter((i) => i.id !== itemId);
  if (next.length === existing.length) return queues;
  return { ...queues, [conversationId]: next };
}

export function updateItemPrompt(queues: PromptQueues, conversationId: string, itemId: string, displayText: string, prompt: string): PromptQueues {
  const existing = queueFor(queues, conversationId);
  return {
    ...queues,
    [conversationId]: existing.map((i) => (i.id === itemId ? { ...i, displayText, prompt } : i)),
  };
}

/** Move an item one step up (-1) or down (+1). No-op at the edges. */
export function moveItem(queues: PromptQueues, conversationId: string, itemId: string, direction: -1 | 1): PromptQueues {
  const existing = [...queueFor(queues, conversationId)];
  const idx = existing.findIndex((i) => i.id === itemId);
  const target = idx + direction;
  if (idx === -1 || target < 0 || target >= existing.length) return queues;
  const [item] = existing.splice(idx, 1);
  existing.splice(target, 0, item);
  return { ...queues, [conversationId]: existing };
}

export function markStatus(queues: PromptQueues, conversationId: string, itemId: string, status: QueueItem['status'], error?: string): PromptQueues {
  const existing = queueFor(queues, conversationId);
  return {
    ...queues,
    [conversationId]: existing.map((i) => (i.id === itemId ? { ...i, status, error } : i)),
  };
}

/** A failed item retries by returning to 'queued' at its current position. */
export function requeueFailed(queues: PromptQueues, conversationId: string, itemId: string): PromptQueues {
  return markStatus(queues, conversationId, itemId, 'queued', undefined);
}

/** Drop queues of conversations that are no longer open (id-collision guard). */
export function pruneQueues(queues: PromptQueues, openConversationIds: readonly string[]): PromptQueues {
  const open = new Set(openConversationIds);
  const next: Record<string, readonly QueueItem[]> = {};
  let changed = false;
  for (const [id, items] of Object.entries(queues)) {
    if (open.has(id)) next[id] = items;
    else changed = true;
  }
  return changed ? next : queues;
}

/** The next dispatchable item: the head, only if it is actually 'queued'. */
export function nextDispatchable(queues: PromptQueues, conversationId: string): QueueItem | null {
  const head = queueFor(queues, conversationId)[0];
  return head && head.status === 'queued' ? head : null;
}

/**
 * Sprint 103 handshake (spec R3): drain only when the conversation is truly
 * ready for a new turn. `failed`/`cancelled` deliberately do NOT drain —
 * they pause the queue for an explicit user resume.
 */
export function isReadyToDrain(state: ConversationActivityState): boolean {
  return state === 'idle' || state === 'done';
}

/** Paused = something is queued but the last turn ended failed/cancelled. */
export function isQueuePaused(state: ConversationActivityState, queueLength: number): boolean {
  return queueLength > 0 && (state === 'failed' || state === 'cancelled');
}
