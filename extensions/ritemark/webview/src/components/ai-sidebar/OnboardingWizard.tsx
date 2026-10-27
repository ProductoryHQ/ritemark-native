/**
 * OnboardingWizard — Unified first-run setup for all AI agents.
 *
 * Detects Git, Node.js, Claude CLI, and Codex CLI.
 * Guides the user through 1-click installs and authentication.
 * Replaces the fragmented per-agent setup screens during first-run.
 */

import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { useAISidebarStore } from './store';
import type { OnboardingDependency, OnboardingInstallState, OnboardingStatus } from './types';
import { PLAN_LINES } from '../welcome/welcomeCopy';

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
          onLoginClaude={() => startLogin()}
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

      <div className="rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4 space-y-3">
        {/* Git and Node.js are only needed by a system-installed runtime; the bundled ones need neither. */}
        {(status.gitRequired || status.nodeRequired) && (
          <>
            <div className="text-xs font-medium opacity-60 uppercase tracking-wide">Requirements</div>

            {status.gitRequired && (
              <DependencyRow
                label="Git"
                installed={status.gitInstalled}
                installState={installStates.git}
                onInstall={() => onInstall('git')}

              />
            )}
            {status.nodeRequired && (
              <DependencyRow
                label="Node.js"
                installed={status.nodeInstalled}
                installState={installStates.node}
                onInstall={() => onInstall('node')}
                disabled={nodeBlocked}
                disabledHint="Install Git first"

              />
            )}

            <div className="border-t border-[var(--r-hairline)] my-2" />
          </>
        )}
        <div className="text-xs font-medium opacity-60 uppercase tracking-wide">AI Assistants</div>

        {/* Claude's installer needs no Node.js. */}
        <DependencyRow
          label="Claude"
          installed={status.claudeCliInstalled}
          installState={installStates['claude-cli']}
          onInstall={() => onInstall('claude-cli')}

        />
        {/* This install runs npm. Without Node.js, the bundled Codex is restored by reinstalling Ritemark. */}
        <DependencyRow
          label="ChatGPT"
          installed={status.codexCliInstalled}
          installState={installStates['codex-cli']}
          onInstall={() => onInstall('codex-cli')}
          disabled={!status.nodeInstalled}
          disabledHint={status.nodeRequired ? 'Install Node.js first' : 'Reinstall Ritemark'}

        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs opacity-60">
          Install at least one AI assistant.
        </p>
        <Tooltip label="Check again what is installed and signed in">
          <Button type="button" variant="link" size="sm" className="h-auto gap-1.5 p-0 text-xs" onClick={onRecheck}>
            <Icon name="arrows-clockwise" size={12} />
            Re-check
          </Button>
        </Tooltip>
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
      <div className="rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4 space-y-2">
        {(status.gitRequired || status.nodeRequired) && (
          <>
            <div className="text-xs font-medium opacity-60 uppercase tracking-wide">Requirements</div>
            {status.gitRequired && <CompactRow label="Git" installed={status.gitInstalled} />}
            {status.nodeRequired && <CompactRow label="Node.js" installed={status.nodeInstalled} />}

            <div className="border-t border-[var(--r-hairline)] my-2" />
          </>
        )}
        <div className="text-xs font-medium opacity-60 uppercase tracking-wide">AI Assistants</div>
        <CompactRow
          label="Claude"
          installed={status.claudeCliInstalled}
          suffix={status.claudeCliInstalled ? 'Installed' : undefined}
        />
        <CompactRow
          label="ChatGPT"
          installed={status.codexCliInstalled}
          suffix={status.codexCliInstalled ? 'Installed' : 'Optional'}
          optional={!status.codexCliInstalled}
          onInstall={!status.codexCliInstalled && status.nodeInstalled ? () => onInstall('codex-cli') : undefined}
          installState={installStates['codex-cli']}
        />
      </div>

      {/* Auth cards for installed CLIs — show all that need auth */}
      {status.claudeCliInstalled && !status.claudeCliAuthenticated && (
        <div className="rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4">
          <div className="text-sm font-semibold mb-1">Sign in to Claude</div>
          <p className="text-xs leading-5 opacity-75 mb-3">
            {PLAN_LINES.claude}
          </p>
          <div className="flex flex-wrap gap-2">
            <Tooltip label="Sign in with your Claude account in the browser">
              <Button type="button" size="sm" className="text-xs" onClick={onLoginClaude}>
                <Icon name="sign-in" size={14} />
                Sign in with Claude.ai
              </Button>
            </Tooltip>
            <Tooltip label="Use an Anthropic API key instead, in Settings">
              <Button type="button" variant="secondary" size="sm" className="text-xs" onClick={onApiKey}>
                <Icon name="key" size={14} />
                Use API key
              </Button>
            </Tooltip>
          </div>
        </div>
      )}

      {status.codexCliInstalled && !status.codexCliAuthenticated && (
        <div className="rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4">
          <div className="text-sm font-semibold mb-1">Sign in to ChatGPT</div>
          <p className="text-xs leading-5 opacity-75 mb-3">
            {PLAN_LINES.chatgpt}
          </p>
          <div className="flex flex-wrap gap-2">
            <Tooltip label="Sign in with your ChatGPT account in the browser">
              <Button type="button" size="sm" className="text-xs" onClick={onLoginCodex}>
                <Icon name="sign-in" size={14} />
                Sign in with ChatGPT
              </Button>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Tooltip label="Check again what is installed and signed in">
          <Button type="button" variant="link" size="sm" className="h-auto gap-1.5 p-0 text-xs" onClick={onRecheck}>
            <Icon name="arrows-clockwise" size={12} />
            Re-check
          </Button>
        </Tooltip>
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
      ? 'ChatGPT'
      : 'Your AI assistant';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 text-center py-8">
      <div className="w-10 h-10 rounded-full bg-[var(--vscode-testing-iconPassed)]/20 flex items-center justify-center mb-3">
        <Icon name="check" size={20} className="text-[var(--vscode-testing-iconPassed)]" />
      </div>
      <h3 className="text-sm font-semibold mb-1.5">You're all set!</h3>
      <p className="text-xs text-[var(--r-ink-muted)] mb-4">
        {agentName} is ready to help you with your documents.
      </p>
      <Tooltip label={`Start your first chat with ${agentName}`}>
        <Button type="button" size="sm" className="text-xs" onClick={onGetStarted}>
          <Icon name="rocket" size={14} />
          Get Started
        </Button>
      </Tooltip>
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
          <Tooltip label={`Try installing ${label} again`}>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-[color:var(--vscode-testing-iconFailed)]"
              onClick={onInstall}
            >
              Retry
            </Button>
          </Tooltip>
        ) : disabled ? (
          <span className="text-xs opacity-40" title={disabledHint}>{disabledHint}</span>
        ) : (
          <Tooltip label={`Install ${label}`}>
            <Button type="button" variant="link" size="sm" className="h-auto gap-1 p-0 text-xs" onClick={onInstall}>
              <Icon name="download" size={12} />
              Install
            </Button>
          </Tooltip>
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
          <Icon name="check" size={14} className="text-[var(--vscode-testing-iconPassed)]" />
        ) : optional ? (
          <Icon name="minus" size={14} className="opacity-30" />
        ) : (
          <Icon name="x" size={14} className="text-[var(--vscode-testing-iconFailed)]" />
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
          <Tooltip label={`Install ${label}`}>
            <Button type="button" variant="link" size="sm" className="h-auto gap-1 p-0 text-xs" onClick={onInstall}>
              <Icon name="download" size={12} />
              Install
            </Button>
          </Tooltip>
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
    return <Icon name="circle-notch" size={14} className="animate-spin text-[var(--r-accent)]" />;
  }
  if (installed) {
    return <Icon name="check" size={14} className="text-[var(--vscode-testing-iconPassed)]" />;
  }
  if (failed) {
    return <Icon name="x" size={14} className="text-[var(--vscode-testing-iconFailed)]" />;
  }
  return <Icon name="x" size={14} className="opacity-40" />;
}
