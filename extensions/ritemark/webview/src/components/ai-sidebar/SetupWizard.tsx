/**
 * SetupWizard — Guides users through installing Claude Code CLI and signing in.
 *
 * Shown when Claude Code agent is selected but the CLI is not installed
 * or not authenticated. Follows the layout pattern from NoApiKey.tsx.
 */

import { Bot, Check, Circle, Loader2, ExternalLink, Terminal, Key, RefreshCw } from 'lucide-react';
import { useAISidebarStore } from './store';

function ChecklistItem({
  label,
  detail,
  status,
}: {
  label: string;
  detail?: string;
  status: 'done' | 'inProgress' | 'pending';
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <div className="mt-0.5">
        {status === 'done' && (
          <Check size={14} className="text-green-400 shrink-0" />
        )}
        {status === 'inProgress' && (
          <Loader2 size={14} className="animate-spin opacity-70 shrink-0" />
        )}
        {status === 'pending' && (
          <Circle size={14} className="opacity-30 shrink-0" />
        )}
      </div>
      <div>
        <span className={status === 'done' ? 'line-through opacity-50' : ''}>
          {label}
        </span>
        {detail && status !== 'done' && (
          <div className="text-[10px] opacity-50 mt-0.5">{detail}</div>
        )}
      </div>
    </div>
  );
}

export function SetupWizard() {
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const setupInProgress = useAISidebarStore((s) => s.setupInProgress);
  const setupError = useAISidebarStore((s) => s.setupError);
  const startInstall = useAISidebarStore((s) => s.startInstall);
  const startLogin = useAISidebarStore((s) => s.startLogin);
  const openApiKeySettings = useAISidebarStore((s) => s.openApiKeySettings);
  const recheckSetup = useAISidebarStore((s) => s.recheckSetup);
  const configureApiKey = useAISidebarStore((s) => s.configureApiKey);
  const dismissWelcome = useAISidebarStore((s) => s.dismissWelcome);

  if (!setupStatus) return null;

  const { cliInstalled, authenticated } = setupStatus;
  const needsInstall = !cliInstalled;
  const needsAuth = cliInstalled && !authenticated;

  // Determine checklist item statuses
  const installStatus = cliInstalled
    ? 'done'
    : setupInProgress && needsInstall
      ? 'inProgress'
      : 'pending';

  const authStatus = authenticated
    ? 'done'
    : setupInProgress && needsAuth
      ? 'inProgress'
      : cliInstalled
        ? 'pending'
        : 'pending';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
      {/* Icon */}
      <div className="w-10 h-10 rounded-full bg-[var(--vscode-input-background)] flex items-center justify-center mb-3">
        <Bot size={18} className="opacity-60" />
      </div>

      {/* Title + description */}
      <h3 className="text-[13px] font-medium mb-1.5">Set up Claude Code</h3>
      <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-4 max-w-[220px]">
        {needsInstall
          ? "Claude Code helps you read, write and organize files. We'll install it for you in a few seconds."
          : needsAuth
            ? 'Claude Code is installed. Sign in to start using it.'
            : 'All set! Claude Code is ready to use.'}
      </p>

      {/* Checklist */}
      <div className="flex flex-col gap-2 mb-4 text-left w-full max-w-[240px]">
        <ChecklistItem
          label="Claude Code CLI"
          detail={cliInstalled ? undefined : 'Auto-installs in ~30 seconds'}
          status={installStatus}
        />
        <ChecklistItem
          label="Authentication"
          detail={authenticated ? undefined : 'Sign in or use an API key'}
          status={authStatus}
        />
      </div>

      {/* Error message */}
      {setupError && (
        <div className="mb-3 px-3 py-2 rounded text-xs bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)] max-w-[260px]">
          {setupError}
        </div>
      )}

      {/* Install button — only when CLI is missing */}
      {needsInstall && (
        <button
          onClick={startInstall}
          disabled={setupInProgress}
          className="px-4 py-1.5 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {setupInProgress ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Installing...
            </>
          ) : (
            'Install Claude Code'
          )}
        </button>
      )}

      {/* Auth buttons — when CLI is installed but no auth */}
      {needsAuth && !setupInProgress && (
        <div className="flex flex-col gap-2 w-full max-w-[220px]">
          {/* Primary: Open terminal for OAuth login */}
          <button
            onClick={startLogin}
            className="w-full px-4 py-1.5 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] flex items-center justify-center gap-1.5"
          >
            <Terminal size={12} />
            Sign in with Claude.ai
          </button>

          {/* Secondary: Open settings for API key */}
          <button
            onClick={openApiKeySettings}
            className="w-full px-4 py-1.5 text-xs rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] flex items-center justify-center gap-1.5"
          >
            <Key size={12} />
            Use API key instead
          </button>

          {/* Recheck button */}
          <button
            onClick={recheckSetup}
            className="mt-1 text-[11px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-textLink-foreground)] flex items-center justify-center gap-1"
          >
            <RefreshCw size={10} />
            Recheck status
          </button>
        </div>
      )}

      {/* Retry after error */}
      {setupError && !setupInProgress && needsInstall && (
        <button
          onClick={recheckSetup}
          className="mt-2 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
        >
          Retry
        </button>
      )}

      {/* Ready state — everything is configured */}
      {!needsInstall && !needsAuth && (
        <button
          onClick={dismissWelcome}
          className="px-5 py-1.5 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] flex items-center gap-1.5"
        >
          Get Started
        </button>
      )}

      {/* API key fallback (visible during install phase) */}
      {needsInstall && !setupInProgress && (
        <button
          onClick={configureApiKey}
          className="mt-4 text-[11px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-textLink-foreground)] flex items-center gap-1"
        >
          Have an API key? Use key instead
          <ExternalLink size={10} />
        </button>
      )}
    </div>
  );
}
