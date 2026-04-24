import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { EnvironmentStatusNotice } from './EnvironmentStatusNotice';
import { useAISidebarStore } from './store';

export function CodexSetupView() {
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const environmentStatus = useAISidebarStore((s) => s.environmentStatus);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const startCodexLogin = useAISidebarStore((s) => s.startCodexLogin);
  const logoutCodex = useAISidebarStore((s) => s.logoutCodex);
  const repairCodex = useAISidebarStore((s) => s.repairCodex);
  const reloadWindow = useAISidebarStore((s) => s.reloadWindow);

  if (codexStatus.state === 'ready') {
    return null;
  }

  const isChecking = codexStatus.state === 'checking';
  const isBroken = codexStatus.state === 'broken-install';
  const needsAuth = codexStatus.state === 'needs-auth';
  const loginInProgress = codexStatus.state === 'auth-in-progress';
  const environmentReloadRequired = environmentStatus?.recommendedAction === 'reload';
  const offlineBlocked = !isOnline && (needsAuth || loginInProgress);

  const title = isChecking
    ? 'Checking Codex'
    : isBroken
      ? 'Codex CLI needs repair'
      : offlineBlocked
        ? 'Connect to the internet'
        : loginInProgress
          ? 'Finish sign-in in your browser'
          : 'Sign in with ChatGPT';

  const description = isBroken
    ? 'Codex is installed, but it could not start correctly.'
    : offlineBlocked
      ? 'Codex sign-in needs an internet connection. Reconnect, then try again.'
      : loginInProgress
        ? 'Your browser was opened for ChatGPT sign-in. When you finish there, Codex will become ready here.'
        : needsAuth
          ? 'To use Codex in Ritemark, sign in with your ChatGPT account.'
          : 'Preparing Codex for this workspace.';

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      <div className="rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {isChecking ? (
              <Icon name="circle-notch" size={20} className="animate-spin opacity-60" />
            ) : isBroken ? (
              <Icon name="warning" size={20} className="text-[var(--vscode-testing-iconFailed)]" />
            ) : loginInProgress ? (
              <Icon name="circle-notch" size={20} className="animate-spin text-[var(--r-accent)]" />
            ) : (
              <Icon name="sign-in" size={20} className="text-[var(--r-accent)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{title}</div>
            <p className="mt-1 text-xs leading-5 opacity-75">{description}</p>

            {codexStatus.email && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Icon name="check-circle" size={14} className="text-[var(--vscode-testing-iconPassed)]" />
                <span className="font-medium">{codexStatus.email}</span>
                {codexStatus.plan && <span className="opacity-70">({codexStatus.plan})</span>}
              </div>
            )}

            {codexStatus.error && (
              <div className="mt-3 rounded-lg border border-[var(--vscode-inputValidation-errorBorder)]/40 bg-[var(--vscode-inputValidation-errorBackground)]/20 px-3 py-2 text-xs leading-5 text-[var(--r-error)] break-words">
                {codexStatus.error}
              </div>
            )}

            <EnvironmentStatusNotice environmentStatus={environmentStatus} />

            {codexStatus.repairCommand && isBroken && (
              <p className="mt-3 text-xs leading-5 opacity-75">
                Ritemark can open the repair command for you in a terminal.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {needsAuth && (
                <ActionButton onClick={startCodexLogin} disabled={offlineBlocked}>
                  <Icon name="sign-in" size={14} />
                  Sign in with ChatGPT
                </ActionButton>
              )}

              {isBroken && (
                <ActionButton onClick={repairCodex}>
                  <Icon name="wrench" size={14} />
                  Repair Codex
                </ActionButton>
              )}

              {(isBroken || loginInProgress || environmentReloadRequired) && (
                <SecondaryButton onClick={reloadWindow}>
                  <Icon name="arrows-clockwise" size={14} />
                  Reload Window
                </SecondaryButton>
              )}

              {codexStatus.email && (
                <SecondaryButton onClick={logoutCodex}>
                  <Icon name="terminal-window" size={14} />
                  Sign Out
                </SecondaryButton>
              )}
            </div>

            {(codexStatus.binaryPath || codexStatus.version || codexStatus.diagnostics.length > 0 || codexStatus.repairCommand) && (
              <details className="mt-4">
                <summary className="cursor-pointer list-none text-xs font-medium text-[var(--r-accent)] hover:underline">
                  Technical details
                </summary>
                <div className="mt-2 space-y-1.5 text-xs leading-5 opacity-75">
                  {codexStatus.version && <div>Version: {codexStatus.version}</div>}
                  {codexStatus.binaryPath && <div className="break-all">Binary: {codexStatus.binaryPath}</div>}
                  {codexStatus.diagnostics.map((line) => (
                    <div key={line} className="break-words">{line}</div>
                  ))}
                  {codexStatus.repairCommand && (
                    <div className="rounded bg-[var(--vscode-textCodeBlock-background)] px-2 py-1 font-mono break-all">
                      {codexStatus.repairCommand}
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-md bg-[var(--r-accent)] px-3 py-2 text-xs font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md bg-[var(--vscode-button-secondaryBackground)] px-3 py-2 text-xs font-medium text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
    >
      {children}
    </button>
  );
}
