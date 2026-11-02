/**
 * Sprint 148 (R8, A5): a chat opened from search shows the matching message.
 *
 * The host's `conversation/select` may carry the message's turn. It waits here
 * until that chat is the open one and the turn is drawn; the conversation view
 * then scrolls it into view once. Any later select replaces it, with or without
 * a turn, so a stale request never moves a chat the person opened another way.
 */
import { useSyncExternalStore } from 'react';

let pending: { conversationId: string; turnId: string } | null = null;
let version = 0;
const listeners = new Set<() => void>();

export function requestTurnReveal(conversationId: string, turnId: string | null | undefined): void {
  pending = turnId ? { conversationId, turnId } : null;
  version++;
  for (const listener of listeners) listener();
}

/** The turn to show now, once: only when its chat is the open one and the turn is among those drawn. */
export function takeTurnReveal(conversationId: string, turnIds: readonly string[]): string | null {
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
