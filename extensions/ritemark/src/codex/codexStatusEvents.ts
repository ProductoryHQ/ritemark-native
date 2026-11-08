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

/**
 * How a ChatGPT sign-in's poll ended (`CodexRuntime.stopLoginPolling`): ready; failed (Codex said the login failed);
 * gave up (2 minutes without a sign-in); or stopped (Cancel, a sign-out, the sheet closing).
 */
export type LoginPollEnd = 'ready' | 'failed' | 'gave-up' | 'stopped';

/** How the welcome's or Home's ChatGPT sign-in ended, in the welcome's terms (`welcome/words.ts`). */
export type CodexSignInOutcome = 'ready' | 'failed' | 'timed-out' | 'stopped';

export interface CodexSignInWait {
  /** Each poll's state (`startCodexSignIn`'s `onStatus`). */
  onStatus(state: string): void;
  /** The poll's end (`startCodexSignIn`'s `onEnd`). */
  onEnd(end: LoginPollEnd): void;
  /** Start the waiter's own give-up clock, once the page is asked to open. */
  arm(): void;
  /** The waiter stopped it itself (its own Cancel, a page that didn't open): nothing more is settled. */
  cancel(): void;
}

/**
 * Sprint 156 (#694): one ChatGPT sign-in's end, as the welcome and Home's card both wait for it. Whichever comes
 * first settles it, once: the poll's ready, the poll's end (a failed login, the give-up, or a stop: Cancel, a
 * sign-out), or the waiter's own give-up after `CODEX_LOGIN_TIMEOUT_MS`, for a poll the AI's sheet restarted or
 * stopped. So neither stays on "Signing in…".
 */
export function waitForCodexSignIn(settle: (outcome: CodexSignInOutcome) => void, timeoutMs = CODEX_LOGIN_TIMEOUT_MS): CodexSignInWait {
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (outcome: CodexSignInOutcome | null) => {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    if (outcome) settle(outcome);
  };
  return {
    onStatus: (state) => { if (state === 'ready') finish('ready'); },
    onEnd: (end) => finish(end === 'gave-up' ? 'timed-out' : end),
    arm: () => {
      if (!done && !timer) timer = setTimeout(() => finish('timed-out'), timeoutMs);
    },
    cancel: () => finish(null),
  };
}

export function emitCodexStatusInvalidated(reason: CodexStatusInvalidationReason): void {
  codexStatusEvents.emit('invalidate', { reason } satisfies CodexStatusInvalidationEvent);
}

export function onCodexStatusInvalidated(
  listener: (event: CodexStatusInvalidationEvent) => void
): () => void {
  codexStatusEvents.on('invalidate', listener);
  return () => codexStatusEvents.off('invalidate', listener);
}
