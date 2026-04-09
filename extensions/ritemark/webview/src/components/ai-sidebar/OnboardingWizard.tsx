/**
 * OnboardingWizard — Unified first-run setup for all AI agents.
 *
 * Detects Git, Node.js, Claude CLI, and Codex CLI.
 * Guides the user through 1-click installs and authentication.
 * Replaces the fragmented per-agent setup screens during first-run.
 */

import type { ReactNode } from 'react';
import { Check, X, Minus, Loader2, Download, RefreshCw, LogIn, Key, Rocket } from 'lucide-react';
import { useAISidebarStore } from './store';
import type { OnboardingDependency, OnboardingInstallState, OnboardingStatus } from './types';

type WizardStep = 'checklist' | 'authenticate' | 'ready';

function getWizardStep(status: OnboardingStatus): WizardStep {
  if (status.anyAgentReady) return 'ready';

  // At least one CLI is installed — move to auth step
  const hasAnyCli = status.claudeCliInstalled || status.codexCliInstalled;
  if (hasAnyCli) return 'authenticate';

  return 'checklist';
}

export function OnboardingWizard() {
  const status = useAISidebarStore((s) => s.onboardingStatus);
  const installStates = useAISidebarStore((s) => s.onboardingInstallStates);
  const installDependency = useAISidebarStore((s) => s.installDependency);
  const recheckDependencies = useAISidebarStore((s) => s.recheckDependencies);
  const dismissOnboarding = useAISidebarStore((s) => s.dismissOnboarding);
  const startLogin = useAISidebarStore((s) => s.startLogin);
  const startCodexLogin = useAISidebarStore((s) => s.startCodexLogin);
  const openApiKeySettings = useAISidebarStore((s) => s.openApiKeySettings);

  if (!status) return null;

  const step = getWizardStep(status);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      {step === 'checklist' && (
        <ChecklistStep
          status={status}
          installStates={installStates}
          onInstall={installDependency}
          onRecheck={recheckDependencies}
        />
      )}
      {step === 'authenticate' && (
        <AuthenticateStep
          status={status}
          installStates={installStates}
          onInstall={installDependency}
          onRecheck={recheckDependencies}
          onLoginClaude={startLogin}
          onLoginCodex={startCodexLogin}
          onApiKey={openApiKeySettings}
        />
      )}
      {step === 'ready' && (
        <ReadyStep
          status={status}
          onGetStarted={dismissOnboarding}
        />
      )}
    </div>
  );
}

// ── Step 1: Dependency Checklist ──

function ChecklistStep({
  status,
  installStates,
  onInstall,
  onRecheck,
}: {
  status: OnboardingStatus;
  installStates: Record<OnboardingDependency, OnboardingInstallState>;
  onInstall: (dep: OnboardingDependency) => void;
  onRecheck: () => void;
}) {
  const nodeBlocked = !status.gitInstalled && status.platform === 'win32';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Welcome to Ritemark</h2>
        <p className="mt-1 text-xs leading-5 opacity-75">
          Let's set up your AI assistant.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 space-y-3">
        <div className="text-xs font-medium opacity-60 uppercase tracking-wide">Requirements</div>

        <DependencyRow
          label="Git"
          installed={status.gitInstalled}
          installState={installStates.git}
          onInstall={() => onInstall('git')}

        />
        <DependencyRow
          label="Node.js"
          installed={status.nodeInstalled}
          installState={installStates.node}
          onInstall={() => onInstall('node')}
          disabled={nodeBlocked}
          disabledHint="Install Git first"

        />

        <div className="border-t border-[var(--vscode-panel-border)] my-2" />
        <div className="text-xs font-medium opacity-60 uppercase tracking-wide">AI Assistants</div>

        <DependencyRow
          label="Claude"
          installed={status.claudeCliInstalled}
          installState={installStates['claude-cli']}
          onInstall={() => onInstall('claude-cli')}
          disabled={!status.nodeInstalled}
          disabledHint="Install Node.js first"

        />
        <DependencyRow
          label="Codex"
          installed={status.codexCliInstalled}
          installState={installStates['codex-cli']}
          onInstall={() => onInstall('codex-cli')}
          disabled={!status.nodeInstalled}
          disabledHint="Install Node.js first"

        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs opacity-60">
          Install at least one AI assistant.
        </p>
        <button
          onClick={onRecheck}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          Re-check
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Authenticate ──

function AuthenticateStep({
  status,
  installStates,
  onInstall,
  onRecheck,
  onLoginClaude,
  onLoginCodex,
  onApiKey,
}: {
  status: OnboardingStatus;
  installStates: Record<OnboardingDependency, OnboardingInstallState>;
  onInstall: (dep: OnboardingDependency) => void;
  onRecheck: () => void;
  onLoginClaude: () => void;
  onLoginCodex: () => void;
  onApiKey: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Almost there!</h2>
        <p className="mt-1 text-xs leading-5 opacity-75">
          Sign in to start using AI in Ritemark.
        </p>
      </div>

      {/* Compact checklist showing current state */}
      <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4 space-y-2">
        <div className="text-xs font-medium opacity-60 uppercase tracking-wide">Requirements</div>
        <CompactRow label="Git" installed={status.gitInstalled} />
        <CompactRow label="Node.js" installed={status.nodeInstalled} />

        <div className="border-t border-[var(--vscode-panel-border)] my-2" />
        <div className="text-xs font-medium opacity-60 uppercase tracking-wide">AI Assistants</div>
        <CompactRow
          label="Claude"
          installed={status.claudeCliInstalled}
          suffix={status.claudeCliInstalled ? 'Installed' : undefined}
        />
        <CompactRow
          label="Codex"
          installed={status.codexCliInstalled}
          suffix={status.codexCliInstalled ? 'Installed' : 'Optional'}
          optional={!status.codexCliInstalled}
          onInstall={!status.codexCliInstalled && status.nodeInstalled ? () => onInstall('codex-cli') : undefined}
          installState={installStates['codex-cli']}
        />
      </div>

      {/* Auth cards for installed CLIs — show all that need auth */}
      {status.claudeCliInstalled && !status.claudeCliAuthenticated && (
        <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
          <div className="text-sm font-semibold mb-1">Sign in to Claude</div>
          <p className="text-xs leading-5 opacity-75 mb-3">
            Connect your Claude.ai account to get started.
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={onLoginClaude}>
              <LogIn className="h-3.5 w-3.5" />
              Sign in with Claude.ai
            </ActionButton>
            <SecondaryButton onClick={onApiKey}>
              <Key className="h-3.5 w-3.5" />
              Use API key
            </SecondaryButton>
          </div>
        </div>
      )}

      {status.codexCliInstalled && !status.codexCliAuthenticated && (
        <div className="rounded-xl border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-4">
          <div className="text-sm font-semibold mb-1">Sign in to Codex</div>
          <p className="text-xs leading-5 opacity-75 mb-3">
            Connect your ChatGPT account to get started.
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={onLoginCodex}>
              <LogIn className="h-3.5 w-3.5" />
              Sign in with ChatGPT
            </ActionButton>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onRecheck}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          Re-check
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Ready ──

function ReadyStep({
  status,
  onGetStarted,
}: {
  status: OnboardingStatus;
  onGetStarted: () => void;
}) {
  const agentName = status.claudeCliAuthenticated
    ? 'Claude'
    : status.codexCliAuthenticated
      ? 'Codex'
      : 'Your AI assistant';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 text-center py-8">
      <div className="w-10 h-10 rounded-full bg-[var(--vscode-testing-iconPassed)]/20 flex items-center justify-center mb-3">
        <Check size={20} className="text-[var(--vscode-testing-iconPassed)]" />
      </div>
      <h3 className="text-sm font-semibold mb-1.5">You're all set!</h3>
      <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-4">
        {agentName} is ready to help you with your documents.
      </p>
      <ActionButton onClick={onGetStarted}>
        <Rocket className="h-3.5 w-3.5" />
        Get Started
      </ActionButton>
    </div>
  );
}

// ── Shared row components ──

function DependencyRow({
  label,
  installed,
  installState,
  onInstall,
  disabled,
  disabledHint,
}: {
  label: string;
  installed: boolean;
  installState: OnboardingInstallState;
  onInstall: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const isInstalling = installState === 'installing';
  const isFailed = installState === 'failed';

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <StatusIcon installed={installed} installing={isInstalling} failed={isFailed} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div>
        {installed ? (
          <span className="text-xs text-[var(--vscode-testing-iconPassed)]">Ready</span>
        ) : isInstalling ? (
          <span className="text-xs opacity-60">Installing...</span>
        ) : isFailed ? (
          <button
            onClick={onInstall}
            className="text-xs text-[var(--vscode-testing-iconFailed)] hover:underline"
          >
            Retry
          </button>
        ) : disabled ? (
          <span className="text-xs opacity-40" title={disabledHint}>{disabledHint}</span>
        ) : (
          <button
            onClick={onInstall}
            className="inline-flex items-center gap-1 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
          >
            <Download className="h-3 w-3" />
            Install
          </button>
        )}
      </div>
    </div>
  );
}

function CompactRow({
  label,
  installed,
  suffix,
  optional,
  onInstall,
  installState,
}: {
  label: string;
  installed: boolean;
  suffix?: string;
  optional?: boolean;
  onInstall?: () => void;
  installState?: OnboardingInstallState;
}) {
  const isInstalling = installState === 'installing';

  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2">
        {installed ? (
          <Check className="h-3.5 w-3.5 text-[var(--vscode-testing-iconPassed)]" />
        ) : optional ? (
          <Minus className="h-3.5 w-3.5 opacity-30" />
        ) : (
          <X className="h-3.5 w-3.5 text-[var(--vscode-testing-iconFailed)]" />
        )}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {suffix && (
          <span className={`text-xs ${installed ? 'text-[var(--vscode-testing-iconPassed)]' : 'opacity-40'}`}>
            {suffix}
          </span>
        )}
        {onInstall && !installed && !isInstalling && (
          <button
            onClick={onInstall}
            className="inline-flex items-center gap-1 text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
          >
            <Download className="h-3 w-3" />
            Install
          </button>
        )}
        {isInstalling && (
          <span className="text-xs opacity-60">Installing...</span>
        )}
      </div>
    </div>
  );
}

function StatusIcon({
  installed,
  installing,
  failed,
}: {
  installed: boolean;
  installing: boolean;
  failed: boolean;
}) {
  if (installing) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--vscode-textLink-foreground)]" />;
  }
  if (installed) {
    return <Check className="h-3.5 w-3.5 text-[var(--vscode-testing-iconPassed)]" />;
  }
  if (failed) {
    return <X className="h-3.5 w-3.5 text-[var(--vscode-testing-iconFailed)]" />;
  }
  return <X className="h-3.5 w-3.5 opacity-40" />;
}

// ── Shared buttons ──

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
