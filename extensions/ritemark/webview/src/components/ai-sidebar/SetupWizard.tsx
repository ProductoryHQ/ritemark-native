import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { EnvironmentStatusNotice } from './EnvironmentStatusNotice';
import { useAISidebarStore } from './store';

export function SetupWizard() {
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const environmentStatus = useAISidebarStore((s) => s.environmentStatus);
  const setupInProgress = useAISidebarStore((s) => s.setupInProgress);
  const setupError = useAISidebarStore((s) => s.setupError);
  const isOnline = useAISidebarStore((s) => s.isOnline);
  const startInstall = useAISidebarStore((s) => s.startInstall);
  const startLogin = useAISidebarStore((s) => s.startLogin);
  const openApiKeySettings = useAISidebarStore((s) => s.openApiKeySettings);
  const openGitDownload = useAISidebarStore((s) => s.openGitDownload);
  const openNodeDownload = useAISidebarStore((s) => s.openNodeDownload);
  const configureApiKey = useAISidebarStore((s) => s.configureApiKey);
  const reloadWindow = useAISidebarStore((s) => s.reloadWindow);

  if (!setupStatus) return null;

  const isBroken = setupStatus.state === 'broken-install';
  const needsInstall = setupStatus.state === 'not-installed';
  const needsAuth = setupStatus.state === 'needs-auth';
  const loginInProgress = setupStatus.state === 'auth-in-progress';
  const missingGit = environmentStatus?.platform === 'win32' && !environmentStatus?.gitInstalled;
  const missingNode = environmentStatus?.platform === 'win32' && !environmentStatus?.nodeInstalled;
  const missingPowerShell = environmentStatus?.platform === 'win32' && !environmentStatus?.powershellAvailable;
  const installOrRepairStep = needsInstall || (isBroken && setupStatus.repairAction !== 'reload');
  const installBlockedByEnvironment = installOrRepairStep && (missingGit || missingNode || missingPowerShell);
  const loginBlockedByEnvironment = needsAuth && missingPowerShell;
  const offlineBlocked = !isOnline && (needsAuth || loginInProgress);

  const title = needsInstall
    ? 'Install Claude'
    : isBroken
      ? setupStatus.repairAction === 'reload'
        ? 'Reload to finish Claude setup'
        : 'Could not verify Claude'
      : loginInProgress
        ? 'Finish sign-in in your browser'
        : offlineBlocked
          ? 'Connect to the internet'
          : 'Sign in with Claude.ai';

  // Filter out version-looking error strings: when getClaudeVersion fails on
  // a non-zero exit but stdout contains "1.2.3 (Claude Code)" the upstream
  // setupStatus.error gets that version verbatim. Showing a version number as
  // a failure description is the worst kind of misleading UX, so we fall
  // back to a generic explanation when the error looks like a version.
  const errorLooksLikeVersion = Boolean(
    setupStatus.error && /^\s*\d+\.\d+\.\d+/.test(setupStatus.error),
  );
  const brokenDescription = errorLooksLikeVersion || !setupStatus.error
    ? "Claude was found, but Ritemark couldn't confirm it's working. Reinstalling restores the bundled runtime."
    : setupStatus.error;

  const description = needsInstall
    ? 'Install Claude to use file-aware agent mode in Ritemark.'
    : isBroken
      ? brokenDescription
      : loginInProgress
        ? 'Your terminal and browser were opened for Claude.ai sign-in. Ritemark will update automatically when sign-in completes.'
        : offlineBlocked
          ? 'Claude sign-in needs an internet connection.'
          : 'To use Claude in Ritemark, sign in with Claude.ai or use an Anthropic API key.';

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      <div className="rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {setupInProgress && (needsInstall || isBroken) ? (
              <Icon name="circle-notch" size={20} className="animate-spin opacity-60" />
            ) : isBroken ? (
              <Icon name="warning" size={20} className="text-[var(--vscode-testing-iconFailed)]" />
            ) : loginInProgress ? (
              <Icon name="circle-notch" size={20} className="animate-spin text-[var(--r-accent)]" />
            ) : needsAuth ? (
              <Icon name="sign-in" size={20} className="text-[var(--r-accent)]" />
            ) : (
              <Icon name="wrench" size={20} className="text-[var(--r-accent)]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{title}</div>
            <p className="mt-1 text-xs leading-5 opacity-75">{description}</p>

            {setupError && (
              <div className="mt-3 rounded-lg border border-[var(--vscode-inputValidation-errorBorder)]/40 bg-[var(--vscode-inputValidation-errorBackground)]/20 px-3 py-2 text-xs leading-5 text-[var(--r-error)] break-words">
                {setupError}
              </div>
            )}

            <EnvironmentStatusNotice environmentStatus={environmentStatus} />

            <div className="mt-4 flex flex-wrap gap-2">
              {needsInstall && !installBlockedByEnvironment && (
                <PrimaryButton onClick={startInstall} disabled={setupInProgress}>
                  {setupInProgress ? <Icon name="circle-notch" size={14} className="animate-spin" /> : <Icon name="wrench" size={14} />}
                  Install Claude
                </PrimaryButton>
              )}

              {isBroken && setupStatus.repairAction !== 'reload' && !installBlockedByEnvironment && (
                <PrimaryButton onClick={startInstall} disabled={setupInProgress}>
                  {setupInProgress ? <Icon name="circle-notch" size={14} className="animate-spin" /> : <Icon name="wrench" size={14} />}
                  Repair Claude
                </PrimaryButton>
              )}

              {setupStatus.repairAction === 'reload' && (
                <PrimaryButton onClick={reloadWindow}>
                  <Icon name="arrows-clockwise" size={14} />
                  Reload Window
                </PrimaryButton>
              )}

              {needsAuth && !loginBlockedByEnvironment && (
                <PrimaryButton onClick={() => startLogin()} disabled={offlineBlocked}>
                  <Icon name="sign-in" size={14} />
                  Sign in with Claude.ai
                </PrimaryButton>
              )}

              {installOrRepairStep && missingGit && (
                <SecondaryButton onClick={openGitDownload}>
                  <Icon name="wrench" size={14} />
                  Get Git for Windows
                </SecondaryButton>
              )}

              {installOrRepairStep && missingNode && (
                <SecondaryButton onClick={openNodeDownload}>
                  <Icon name="wrench" size={14} />
                  Get Node.js
                </SecondaryButton>
              )}

              {needsAuth && (
                <SecondaryButton onClick={openApiKeySettings}>
                  <Icon name="key" size={14} />
                  Use API key instead
                </SecondaryButton>
              )}
            </div>

            {(installBlockedByEnvironment || loginBlockedByEnvironment) && missingPowerShell && (
              <p className="mt-3 text-xs leading-5 opacity-75">
                Claude install and Claude.ai sign-in use Windows PowerShell. Restore the
                <code className="mx-1 rounded bg-[var(--vscode-textCodeBlock-background)] px-1 py-0.5">powershell.exe</code>
                command, then reload Ritemark and retry.
              </p>
            )}

            {(needsInstall || needsAuth) && (
              <button
                onClick={configureApiKey}
                className="mt-3 text-xs text-[var(--r-accent)] hover:underline"
              >
                Prefer using an Anthropic API key?
              </button>
            )}

            {(setupStatus.binaryPath || setupStatus.cliVersion || setupStatus.diagnostics.length > 0) && (
              <details className="mt-4">
                <summary className="cursor-pointer list-none text-xs font-medium text-[var(--r-accent)] hover:underline">
                  Technical details
                </summary>
                <div className="mt-2 space-y-1.5 text-xs leading-5 opacity-75">
                  {setupStatus.cliVersion && <div>Version: {setupStatus.cliVersion}</div>}
                  {setupStatus.binaryPath && <div className="break-all">Binary: {setupStatus.binaryPath}</div>}
                  {setupStatus.authMethod === 'api-key' && <div>Auth: Anthropic API key</div>}
                  {setupStatus.authMethod === 'claude-oauth' && <div>Auth: Claude.ai</div>}
                  {dedupeDiagnostics(setupStatus.diagnostics, setupStatus.binaryPath, setupStatus.cliVersion).map((line) => (
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

/**
 * deriveClaudeSetupStatus prepends `Binary: <path>` and `Version: <v>` to
 * the diagnostics array, but the technical-details panel renders those two
 * fields explicitly above. Strip duplicates here so the user doesn't see the
 * same path three times. We also drop the legacy "Claude binary detected at
 * <path>" string from inspectClaudeBinary's fallback — it's the same
 * information, expressed as a fallback diagnostic, and adds no value when
 * Binary is already shown above.
 */
function dedupeDiagnostics(
  diagnostics: string[],
  binaryPath?: string,
  version?: string,
): string[] {
  const seen = new Set<string>();
  return diagnostics.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    if (binaryPath && line === `Binary: ${binaryPath}`) return false;
    if (version && line === `Version: ${version}`) return false;
    if (binaryPath && line === `Claude binary detected at ${binaryPath}`) return false;
    return true;
  });
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
