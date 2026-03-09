import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Key, Loader2, LogIn, RefreshCw, Wrench } from 'lucide-react';
import { useAISidebarStore } from './store';

export function SetupWizard() {
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const setupInProgress = useAISidebarStore((s) => s.setupInProgress);
  const setupError = useAISidebarStore((s) => s.setupError);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const startInstall = useAISidebarStore((s) => s.startInstall);
  const startLogin = useAISidebarStore((s) => s.startLogin);
  const openApiKeySettings = useAISidebarStore((s) => s.openApiKeySettings);
  const configureApiKey = useAISidebarStore((s) => s.configureApiKey);
  const reloadWindow = useAISidebarStore((s) => s.reloadWindow);
  const dismissWelcome = useAISidebarStore((s) => s.dismissWelcome);

  if (!setupStatus) return null;

  const isBroken = setupStatus.state === 'broken-install';
  const needsInstall = setupStatus.state === 'not-installed';
  const needsAuth = setupStatus.state === 'needs-auth';
  const loginInProgress = setupStatus.state === 'auth-in-progress';
  const isReady = setupStatus.state === 'ready';
  const offlineBlocked = !isOnline && (needsAuth || loginInProgress);

  const title = needsInstall
    ? 'Install Claude'
    : isBroken
      ? setupStatus.repairAction === 'reload'
        ? 'Reload to finish Claude setup'
        : 'Claude needs repair'
      : loginInProgress
        ? 'Finish sign-in in your browser'
        : isReady
          ? 'Claude is ready'
          : offlineBlocked
            ? 'Connect to the internet'
            : 'Sign in with Claude.ai';

  const description = needsInstall
    ? 'Install Claude to use file-aware agent mode in Ritemark.'
    : isBroken
      ? setupStatus.error ?? 'Claude was found, but it could not start correctly.'
      : loginInProgress
        ? 'Your terminal and browser were opened for Claude.ai sign-in. Ritemark will update automatically when sign-in completes.'
        : isReady
          ? 'Claude can now work with your files in this workspace.'
          : offlineBlocked
            ? 'Claude sign-in needs an internet connection.'
            : 'To use Claude in Ritemark, sign in with Claude.ai or use an Anthropic API key.';

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {setupInProgress && (needsInstall || isBroken) ? (
              <Loader2 className="h-5 w-5 animate-spin opacity-60" />
            ) : isBroken ? (
              <AlertTriangle className="h-5 w-5 text-[var(--vscode-testing-iconFailed)]" />
            ) : loginInProgress ? (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--vscode-textLink-foreground)]" />
            ) : isReady ? (
              <CheckCircle2 className="h-5 w-5 text-[var(--vscode-testing-iconPassed)]" />
            ) : needsAuth ? (
              <LogIn className="h-5 w-5 text-[var(--vscode-textLink-foreground)]" />
            ) : (
              <Wrench className="h-5 w-5 text-[var(--vscode-textLink-foreground)]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{title}</div>
            <p className="mt-1 text-xs leading-5 opacity-75">{description}</p>

            {setupError && (
              <div className="mt-3 rounded-lg border border-[var(--vscode-inputValidation-errorBorder)]/40 bg-[var(--vscode-inputValidation-errorBackground)]/20 px-3 py-2 text-xs leading-5 text-[var(--vscode-errorForeground)] break-words">
                {setupError}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {needsInstall && (
                <PrimaryButton onClick={startInstall} disabled={setupInProgress}>
                  {setupInProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                  Install Claude
                </PrimaryButton>
              )}

              {isBroken && setupStatus.repairAction !== 'reload' && (
                <PrimaryButton onClick={startInstall} disabled={setupInProgress}>
                  {setupInProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                  Repair Claude
                </PrimaryButton>
              )}

              {setupStatus.repairAction === 'reload' && (
                <PrimaryButton onClick={reloadWindow}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reload Window
                </PrimaryButton>
              )}

              {needsAuth && (
                <PrimaryButton onClick={startLogin} disabled={offlineBlocked}>
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in with Claude.ai
                </PrimaryButton>
              )}

              {needsAuth && (
                <SecondaryButton onClick={openApiKeySettings}>
                  <Key className="h-3.5 w-3.5" />
                  Use API key instead
                </SecondaryButton>
              )}

              {isReady && (
                <PrimaryButton onClick={dismissWelcome}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Get Started
                </PrimaryButton>
              )}
            </div>

            {(needsInstall || needsAuth) && (
              <button
                onClick={configureApiKey}
                className="mt-3 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
              >
                Prefer using an Anthropic API key?
              </button>
            )}

            {(setupStatus.binaryPath || setupStatus.cliVersion || setupStatus.diagnostics.length > 0) && (
              <details className="mt-4">
                <summary className="cursor-pointer list-none text-xs font-medium text-[var(--vscode-textLink-foreground)] hover:underline">
                  Technical details
                </summary>
                <div className="mt-2 space-y-1.5 text-xs leading-5 opacity-75">
                  {setupStatus.cliVersion && <div>Version: {setupStatus.cliVersion}</div>}
                  {setupStatus.binaryPath && <div className="break-all">Binary: {setupStatus.binaryPath}</div>}
                  {setupStatus.authMethod === 'api-key' && <div>Auth: Anthropic API key</div>}
                  {setupStatus.authMethod === 'claude-oauth' && <div>Auth: Claude.ai</div>}
                  {setupStatus.diagnostics.map((line) => (
                    <div key={line} className="break-words">
                      {line}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrimaryButton({
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
      className="inline-flex items-center gap-2 rounded-md bg-[var(--vscode-button-background)] px-3 py-2 text-xs font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:cursor-not-allowed disabled:opacity-50"
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
