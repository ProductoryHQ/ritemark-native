import {
  startClaudeLoginSubprocess,
  type ClaudeLoginSubprocessHandle,
  type ClaudeLoginSubprocessOptions,
} from './installer';
import { emitClaudeStatusInvalidated } from './claudeStatusEvents';
import { clearSetupCache, setClaudeLoginInProgress } from './setup';

export interface ClaudeLoginOptions extends ClaudeLoginSubprocessOptions {
  onCancel?: () => void;
}

export type ClaudeLoginStartResult = 'started' | 'already-running' | 'failed-to-start';

interface ActiveClaudeLogin {
  handle: ClaudeLoginSubprocessHandle | null;
  subscribers: ClaudeLoginOptions[];
}

let activeLogin: ActiveClaudeLogin | null = null;

function notifySubscribers(
  subscribers: ClaudeLoginOptions[],
  notify: (subscriber: ClaudeLoginOptions) => void,
): void {
  for (const subscriber of subscribers) {
    try {
      notify(subscriber);
    } catch (error) {
      console.error('[claude-login] Subscriber callback failed:', error);
    }
  }
}

function settle(
  login: ActiveClaudeLogin,
  reason: 'login-finished' | 'settings-updated',
  notify: (subscriber: ClaudeLoginOptions) => void,
): void {
  if (activeLogin !== login) return;
  const subscribers = [...login.subscribers];
  activeLogin = null;
  setClaudeLoginInProgress(false);
  clearSetupCache();
  emitClaudeStatusInvalidated(reason);
  notifySubscribers(subscribers, notify);
}

/**
 * One app-global Claude login flow shared by Settings, commands, and chat.
 * OAuth credentials are app-global too, so opening competing browser login
 * subprocesses from different surfaces is both confusing and unsafe.
 */
export function beginClaudeLogin(
  binaryPath: string,
  options: ClaudeLoginOptions = {},
): ClaudeLoginStartResult {
  if (activeLogin) {
    // The OAuth process is shared, but every surface that joined it still
    // needs the terminal callback so its own busy/error state can settle.
    activeLogin.subscribers.push(options);
    return 'already-running';
  }

  setClaudeLoginInProgress(true);
  clearSetupCache();
  emitClaudeStatusInvalidated('login-started');

  const login: ActiveClaudeLogin = { handle: null, subscribers: [options] };
  activeLogin = login;
  try {
    login.handle = startClaudeLoginSubprocess(binaryPath, {
      onUrl: (url) => {
        notifySubscribers(login.subscribers, (subscriber) => subscriber.onUrl?.(url));
      },
      onComplete: () => settle(login, 'login-finished', (subscriber) => subscriber.onComplete?.()),
      onError: (error) => settle(login, 'settings-updated', (subscriber) => subscriber.onError?.(error)),
      onTimeout: () => settle(login, 'settings-updated', (subscriber) => subscriber.onTimeout?.()),
      timeoutMs: options.timeoutMs,
    });
  } catch (error) {
    settle(login, 'settings-updated', (subscriber) => subscriber.onError?.(
      error instanceof Error ? error.message : String(error),
    ));
    return 'failed-to-start';
  }

  return 'started';
}

export function cancelClaudeLogin(): boolean {
  if (!activeLogin) return false;
  const login = activeLogin;
  // Clear first: the subprocess kill intentionally settles without firing a
  // completion callback, and a synchronous exit must not see a stale handle.
  activeLogin = null;
  login.handle?.kill();
  setClaudeLoginInProgress(false);
  clearSetupCache();
  emitClaudeStatusInvalidated('settings-updated');
  notifySubscribers(login.subscribers, (subscriber) => subscriber.onCancel?.());
  return true;
}

export function isClaudeLoginActive(): boolean {
  return activeLogin !== null;
}
