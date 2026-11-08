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

/**
 * How ChatGPT's sign-in is waited for (`CodexRuntime.startLoginPolling`): a poll every 2 s, 60 times, so 2 minutes
 * before it gives up. The welcome's timeout; Home's card gives up after the same time (Sprint 156).
 */
export const CODEX_LOGIN_POLL_MS = 2000;
export const CODEX_LOGIN_POLL_ATTEMPTS = 60;
export const CODEX_LOGIN_TIMEOUT_MS = CODEX_LOGIN_POLL_MS * CODEX_LOGIN_POLL_ATTEMPTS;

export function emitCodexStatusInvalidated(reason: CodexStatusInvalidationReason): void {
  codexStatusEvents.emit('invalidate', { reason } satisfies CodexStatusInvalidationEvent);
}

export function onCodexStatusInvalidated(
  listener: (event: CodexStatusInvalidationEvent) => void
): () => void {
  codexStatusEvents.on('invalidate', listener);
  return () => codexStatusEvents.off('invalidate', listener);
}
