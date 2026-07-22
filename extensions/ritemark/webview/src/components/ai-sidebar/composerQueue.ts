/**
 * Composer queue logic (Sprint 74, R2 / issue #82).
 *
 * Pure decision functions for the "queue next prompt while agent runs" flow,
 * extracted from ChatInput so they can be regression-tested without React.
 *
 * Flow:
 *  1. Agent is running → composer stays unlocked → user types and presses Enter
 *  2. shouldQueueInsteadOfSend → prompt is parked in local queue state (notch UI)
 *  3. Agent finishes → shouldAutoSendQueuedPrompt fires on the running→idle
 *     transition → queued prompt is sent as the next turn
 */

export interface QueueSendContext {
  /** Agent (Claude Code / Codex) is currently running or chat is streaming */
  isLoading: boolean;
  /** Composer is in agent mode (Claude Code or Codex selected) */
  isAgentMode: boolean;
  /** The send call carries an explicit override prompt (auto-send path) */
  hasOverridePrompt: boolean;
}

/**
 * Decide whether a send action should park the prompt in the queue instead of
 * sending it immediately. True only while an agent run is in flight and the
 * call is a user-initiated send (not the auto-send of an already-queued prompt).
 */
export function shouldQueueInsteadOfSend(ctx: QueueSendContext): boolean {
  return ctx.isLoading && ctx.isAgentMode && !ctx.hasOverridePrompt;
}

export interface QueueAutoSendContext {
  /** agentRunning value before the latest store update */
  wasRunning: boolean;
  /** agentRunning value after the latest store update */
  isRunning: boolean;
  /** Currently queued prompt, if any */
  queuedPrompt: string | null;
}

/**
 * Decide whether the queued prompt should auto-send now. Fires exactly on the
 * running → idle transition and only when something is queued. This prevents
 * double-sends (idle → idle re-renders) and premature sends (running → running).
 */
export function shouldAutoSendQueuedPrompt(ctx: QueueAutoSendContext): boolean {
  return ctx.wasRunning && !ctx.isRunning && !!ctx.queuedPrompt && ctx.queuedPrompt.trim().length > 0;
}

// ── Sprint 99 (E5 / R14): the queue is per THREAD ────────────────────────
//
// Before Sprint 99 there was one composer and one conversation, so a single
// `queuedPrompt` string was the whole model. With parallel threads the composer
// is still one component, but its contents belong to the ACTIVE thread — so the
// queue (and the draft) must be stored per conversation id and swapped on
// switch. Queue *semantics* are untouched; redesigning them is issue #95.
//
// The invariant these helpers exist to protect: **a prompt queued in thread A
// can never be read, sent, or cleared as thread B's.** Every accessor is keyed.

/** Per-conversation composer slots (queued prompt, or draft text). */
export type ComposerSlots = Readonly<Record<string, string>>;

/** Read one thread's slot. Never falls back to another thread's value. */
export function slotFor(slots: ComposerSlots, conversationId: string | null): string | null {
  if (!conversationId) return null;
  const value = slots[conversationId];
  return value ?? null;
}

/** Set one thread's slot, leaving every other thread's untouched. */
export function setSlot(slots: ComposerSlots, conversationId: string, value: string): ComposerSlots {
  return { ...slots, [conversationId]: value };
}

/** Clear one thread's slot, leaving every other thread's untouched. */
export function clearSlot(slots: ComposerSlots, conversationId: string | null): ComposerSlots {
  if (!conversationId || !(conversationId in slots)) return slots;
  const next = { ...slots };
  delete next[conversationId];
  return next;
}

/**
 * Drop slots belonging to threads that are no longer open, so a closed thread's
 * queued prompt can never be resurrected by an id collision later.
 */
export function pruneSlots(slots: ComposerSlots, openConversationIds: readonly string[]): ComposerSlots {
  const open = new Set(openConversationIds);
  const next: Record<string, string> = {};
  let changed = false;
  for (const [id, value] of Object.entries(slots)) {
    if (open.has(id)) next[id] = value;
    else changed = true;
  }
  return changed ? next : slots;
}
