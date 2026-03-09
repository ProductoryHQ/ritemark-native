import { EventEmitter } from 'events';

export type ClaudeStatusInvalidationReason =
  | 'install-started'
  | 'install-finished'
  | 'login-started'
  | 'login-finished'
  | 'status-refresh'
  | 'settings-updated';

export interface ClaudeStatusInvalidationEvent {
  reason: ClaudeStatusInvalidationReason;
}

const claudeStatusEvents = new EventEmitter();

export function emitClaudeStatusInvalidated(reason: ClaudeStatusInvalidationReason): void {
  claudeStatusEvents.emit('invalidate', { reason } satisfies ClaudeStatusInvalidationEvent);
}

export function onClaudeStatusInvalidated(
  listener: (event: ClaudeStatusInvalidationEvent) => void
): () => void {
  claudeStatusEvents.on('invalidate', listener);
  return () => claudeStatusEvents.off('invalidate', listener);
}
