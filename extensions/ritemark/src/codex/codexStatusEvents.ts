import { EventEmitter } from 'events';

export type CodexStatusInvalidationReason =
  | 'login-started'
  | 'login-finished'
  | 'logout'
  | 'repair-started'
  | 'repair-finished'
  | 'status-refresh';

export interface CodexStatusInvalidationEvent {
  reason: CodexStatusInvalidationReason;
}

const codexStatusEvents = new EventEmitter();

export function emitCodexStatusInvalidated(reason: CodexStatusInvalidationReason): void {
  codexStatusEvents.emit('invalidate', { reason } satisfies CodexStatusInvalidationEvent);
}

export function onCodexStatusInvalidated(
  listener: (event: CodexStatusInvalidationEvent) => void
): () => void {
  codexStatusEvents.on('invalidate', listener);
  return () => codexStatusEvents.off('invalidate', listener);
}
