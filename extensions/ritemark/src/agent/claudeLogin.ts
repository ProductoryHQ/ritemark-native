import {
  startClaudeLoginSubprocess,
  type ClaudeLoginSubprocessHandle,
  type ClaudeLoginSubprocessOptions,
} from './installer';
import { emitClaudeStatusInvalidated } from './claudeStatusEvents';
import { clearSetupCache, setClaudeLoginInProgress } from './setup';

export type ClaudeLoginStartResult = 'started' | 'already-running';

let activeLogin: ClaudeLoginSubprocessHandle | null = null;

function settle(reason: 'login-finished' | 'settings-updated'): void {
  activeLogin = null;
  setClaudeLoginInProgress(false);
  clearSetupCache();
  emitClaudeStatusInvalidated(reason);
}

/**
 * One app-global Claude login flow shared by Settings, commands, and chat.
 * OAuth credentials are app-global too, so opening competing browser login
 * subprocesses from different surfaces is both confusing and unsafe.
 */
export function beginClaudeLogin(
  binaryPath: string,
  options: ClaudeLoginSubprocessOptions = {},
): ClaudeLoginStartResult {
  if (activeLogin) return 'already-running';

  setClaudeLoginInProgress(true);
  clearSetupCache();
  emitClaudeStatusInvalidated('login-started');

  activeLogin = startClaudeLoginSubprocess(binaryPath, {
    ...options,
    onComplete: () => {
      settle('login-finished');
      options.onComplete?.();
    },
    onError: (error) => {
      settle('settings-updated');
      options.onError?.(error);
    },
    onTimeout: () => {
      settle('settings-updated');
      options.onTimeout?.();
    },
  });

  return 'started';
}

export function cancelClaudeLogin(): boolean {
  if (!activeLogin) return false;
  const login = activeLogin;
  // Clear first: the subprocess kill intentionally settles without firing a
  // completion callback, and a synchronous exit must not see a stale handle.
  activeLogin = null;
  login.kill();
  setClaudeLoginInProgress(false);
  clearSetupCache();
  emitClaudeStatusInvalidated('settings-updated');
  return true;
}

export function isClaudeLoginActive(): boolean {
  return activeLogin !== null;
}
