/**
 * Sprint 148 (R8, A5): a chat opened from search shows the matching message.
 *
 * The host's `conversation/select` may carry the message's turn. It waits here
 * until that chat is the open one and the turn is drawn; the conversation view
 * then scrolls it into view once. Any later select replaces it, with or without
 * a turn, and it lapses after a few seconds, so a stale request never moves a
 * chat the person opened another way later (the review of #636).
 */
import { useSyncExternalStore } from 'react';

/** How long a reveal waits for its chat and turn to be drawn. */
export const TURN_REVEAL_WAIT_MS = 5000;

let pending: { conversationId: string; turnId: string; at: number } | null = null;
let version = 0;
const listeners = new Set<() => void>();

export function requestTurnReveal(conversationId: string, turnId: string | null | undefined, now = Date.now()): void {
  pending = turnId ? { conversationId, turnId, at: now } : null;
  version++;
  for (const listener of listeners) listener();
}

/** The turn to show now, once: only when its chat is the open one, the turn is among those drawn, and it is fresh. */
export function takeTurnReveal(conversationId: string, turnIds: readonly string[], now = Date.now()): string | null {
  if (pending && now - pending.at > TURN_REVEAL_WAIT_MS) pending = null;
  if (!pending || pending.conversationId !== conversationId || !turnIds.includes(pending.turnId)) return null;
  const { turnId } = pending;
  pending = null;
  return turnId;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes whenever a reveal is asked for, so the view looks again. */
export function useTurnRevealVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
