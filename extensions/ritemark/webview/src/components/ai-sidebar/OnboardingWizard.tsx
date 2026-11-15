/**
 * OnboardingWizard — Unified first-run setup for all AI agents.
 *
 * Detects Git, Node.js, Claude CLI, and Codex CLI.
 * Guides the user through 1-click installs and authentication.
 * Replaces the fragmented per-agent setup screens during first-run.
 */

import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { useAISidebarStore } from './store';
import { deriveRuntimeAvailabilities } from './runtimeAvailability';
import type { OnboardingDependency, OnboardingInstallState, OnboardingStatus } from './types';
import { COPY, PLAN_LINES, browserOpened, reopenTip, stopWaitingTip } from '../welcome/welcomeCopy';
import { PROVIDER_NAMES, homeReopenNotOpened, signInNeedsConnection, signInProblem } from '../../../../src/welcome/words';
import type { SheetSignInAi, SheetSignInView } from '../../../../src/views/agentSidebarProtocol';

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
  const cancelSignIn = useAISidebarStore((s) => s.cancelSignIn);
  const reopenSignIn = useAISidebarStore((s) => s.reopenSignIn);
  // Sprint 160 (#696): the cards read the one availability the composer and the view rule read, so a sign-in that
  // runs (started here, on Home, in the welcome or in Settings) waits here too
  const runtimeHydration = useAISidebarStore((s) => s.runtimeHydration);
  const setupStatus = useAISidebarStore((s) => s.setupStatus);
  const codexStatus = useAISidebarStore((s) => s.codexStatus);
  const opencodeEnabled = useAISidebarStore((s) => s.opencodeEnabled);
  const acpProviders = useAISidebarStore((s) => s.acpProviders);
  const byokProviderModels = useAISidebarStore((s) => s.byokProviderModels);
  const claudeLoginState = useAISidebarStore((s) => s.claudeLoginState);
  const sheetSignIns = useAISidebarStore((s) => s.sheetSignIns);
  const isOnline = useAISidebarStore((s) => s.isOnline);

  if (!status) return null;

  const step = getWizardStep(status);
  const availabilities = deriveRuntimeAvailabilities({
    runtimeHydration,
    setupStatus,
    codexStatus,
    opencodeEnabled,
    acpProviders,
    byokProviderModels,
  });
  const cards: Record<SheetSignInAi, SignInCardState> = {
    claude: {
      // A press here waits at once, before the host's first status says the sign-in runs (`startLogin`)
      waiting: availabilities['claude-code'].state === 'auth-in-progress' || claudeLoginState === 'pending',
      signIn: sheetSignIns.claude,
    },
    chatgpt: {
      waiting: availabilities.codex.state === 'auth-in-progress',
      signIn: sheetSignIns.chatgpt,
    },
  };

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
          cards={cards}
          offline={!isOnline}
          onInstall={installDependency}
          onRecheck={recheckDependencies}
          onLoginClaude={() => startLogin()}
          onLoginCodex={startCodexLogin}
          onApiKey={openApiKeySettings}
          onCancel={cancelSignIn}
          onReopen={reopenSignIn}
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

/** Sprint 160 (#696): what one AI's sign-in card draws from. */
interface SignInCardState {
  /** Its sign-in runs, wherever it started: the welcome's frame 2, as Home's card borrows it (Sprint 156). */
  waiting: boolean;
  /** The host's page and line for it (`onboarding:sign-in`). */
  signIn: SheetSignInView;
}

function AuthenticateStep({
  status,
  installStates,
  cards,
  offline,
  onInstall,
  onRecheck,
  onLoginClaude,
  onLoginCodex,
  onApiKey,
  onCancel,
  onReopen,
}: {
  status: OnboardingStatus;
  installStates: Record<OnboardingDependency, OnboardingInstallState>;
  cards: Record<SheetSignInAi, SignInCardState>;
  offline: boolean;
  onInstall: (dep: OnboardingDependency) => void;
  onRecheck: () => void;
  onLoginClaude: () => void;
  onLoginCodex: () => void;
  onApiKey: () => void;
  onCancel: (ai: SheetSignInAi) => void;
  onReopen: (ai: SheetSignInAi) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Almost there!</h2>
        <p className="mt-1 text-xs leading-5 opacity-75">
          Sign in to start using AI in Ritemark.
        </p>
        {/* Sprint 160 (#696): offline, the AI column's own banner (Check again) is the one offline message; the Sign
            in buttons wait for the connection and say why, a key does not (the Experience lead, review of #730) */}
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
        <SignInCard
          ai="claude"
          signInLabel="Sign in with Claude.ai"
          signInTip="Sign in with your Claude account in the browser"
          card={cards.claude}
          offline={offline}
          onSignIn={onLoginClaude}
          onCancel={() => onCancel('claude')}
          onReopen={() => onReopen('claude')}
        >
          {/* A key can be saved while Claude signs in, and offline */}
          <Tooltip label="Use an Anthropic API key instead, in Settings">
            <Button type="button" variant="secondary" size="sm" className="text-xs" onClick={onApiKey}>
              <Icon name="key" size={14} />
              Use API key
            </Button>
          </Tooltip>
        </SignInCard>
      )}

      {status.codexCliInstalled && !status.codexCliAuthenticated && (
        <SignInCard
          ai="chatgpt"
          signInLabel="Sign in with ChatGPT"
          signInTip="Sign in with your ChatGPT account in the browser"
          card={cards.chatgpt}
          offline={offline}
          onSignIn={onLoginCodex}
          onCancel={() => onCancel('chatgpt')}
          onReopen={() => onReopen('chatgpt')}
        />
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

/**
 * One AI's sign-in card (Sprint 160, #696; the Experience lead's states, 15 November). Signed out, it offers Sign in
 * under which plans work, or under why the last sign-in ended. While its sign-in runs, wherever it started, it borrows
 * the welcome's frame 2 as Home's card does: the main button waits, a quiet Cancel follows it, the line says the
 * browser opened the page, and "Open the page again" is under the row, on the card's text edge, while the page is
 * known. Offline, Sign in waits for the connection and its tooltip says so; the AI column's banner is the offline
 * message; a sign-in already running keeps waiting. The words are the welcome's and Home's.
 */
function SignInCard({
  ai,
  signInLabel,
  signInTip,
  card,
  offline,
  onSignIn,
  onCancel,
  onReopen,
  children,
}: {
  ai: SheetSignInAi;
  signInLabel: string;
  signInTip: string;
  card: SignInCardState;
  offline: boolean;
  onSignIn: () => void;
  onCancel: () => void;
  onReopen: () => void;
  /** The card's other buttons (Claude's Use API key), after Sign in and its Cancel. */
  children?: ReactNode;
}) {
  const { waiting, signIn } = card;
  const name = PROVIDER_NAMES[ai];
  const ended = !waiting && signIn.line !== null && signIn.line !== 'not-opened' ? signIn.line : null;
  // The line: frame 2's while it waits; why the last sign-in ended; else which plans work
  const line = waiting ? browserOpened(ai) : ended ? signInProblem(ai, ended) : PLAN_LINES[ai];
  return (
    <div className="rounded-xl border border-[var(--r-hairline)] bg-[var(--vscode-editor-background)] p-4" aria-busy={waiting || undefined}>
      <div className="text-sm font-semibold mb-1">Sign in to {name}</div>
      <p className="text-xs leading-5 opacity-75 mb-3" role={waiting || ended ? 'status' : undefined}>
        {line}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {waiting ? (
          <>
            <Tooltip label={browserOpened(ai)}>
              <Button type="button" size="sm" className="text-xs" disabled>
                <Icon name="circle-notch" size={14} tone="inherit" className="animate-spin motion-reduce:animate-none" />
                {COPY.signingIn}
              </Button>
            </Tooltip>
            <Tooltip label={stopWaitingTip(ai)}>
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
                {COPY.cancel}
              </Button>
            </Tooltip>
          </>
        ) : (
          <Tooltip label={offline ? signInNeedsConnection(ai) : signInTip}>
            <Button type="button" size="sm" className="text-xs" disabled={offline} onClick={onSignIn}>
              <Icon name="sign-in" size={14} />
              {signInLabel}
            </Button>
          </Tooltip>
        )}
        {children}
      </div>
      {waiting && signIn.page && (
        // Its words on the card's text edge, where state 4's line sits: the quiet button's own 12 px padding is
        // pulled back (the Experience lead, review of #730)
        <div className="-ml-3 mt-1" data-reopen-row>
          <Tooltip label={reopenTip(ai)}>
            <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={onReopen}>
              {COPY.reopen}
            </Button>
          </Tooltip>
        </div>
      )}
      {waiting && signIn.line === 'not-opened' && (
        <p className="mt-2 text-xs leading-5" role="status">{homeReopenNotOpened(ai)}</p>
      )}
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
      {/* Sprint 144: a done check in ink, not green or muted; green is only ever the small ready dot (the Experience lead, 22ffe7b) */}
      <div className="w-10 h-10 rounded-full bg-[var(--r-surface-muted)] flex items-center justify-center mb-3">
        {/* Sprint 145 (#578): `inherit`, so the class colours it; the Icon's own muted tone set the fill before */}
        <Icon name="check" size={20} tone="inherit" className="text-[var(--r-ink-strong)]" />
      </div>
      <h3 className="text-sm font-semibold mb-1.5">You're all set!</h3>
      <p className="text-xs text-[var(--r-ink-muted)] mb-4">
        {agentName} is ready to help you with your documents.
      </p>
      <Tooltip label={`Start your first chat with ${agentName}`}>
        <Button type="button" size="sm" className="text-xs" onClick={onGetStarted}>
          <Icon name="rocket" size={14} />
          Get started
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
          <span className="text-xs text-[var(--r-ink-muted)]">Ready</span>
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
          <Tooltip label={disabledHint}>
            <span className="text-xs opacity-40">{disabledHint}</span>
          </Tooltip>
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
          // Sprint 145 (#578): `inherit`, so the check is the ink its class names, not the Icon's own muted tone
          <Icon name="check" size={14} tone="inherit" className="text-[var(--r-ink-body)]" />
        ) : optional ? (
          <Icon name="minus" size={14} className="opacity-30" />
        ) : (
          <Icon name="x" size={14} className="text-[var(--r-error)]" />
        )}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {suffix && (
          <span className={`text-xs ${installed ? 'text-[var(--r-ink-muted)]' : 'opacity-40'}`}>
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
    return <Icon name="circle-notch" size={14} className="animate-spin text-[var(--r-ink-body)]" />;
  }
  if (installed) {
    // Sprint 145 (#578): `inherit`, so the check is the ink its class names, not the Icon's own muted tone
    return <Icon name="check" size={14} tone="inherit" className="text-[var(--r-ink-body)]" />;
  }
  if (failed) {
    return <Icon name="x" size={14} className="text-[var(--r-error)]" />;
  }
  return <Icon name="x" size={14} className="opacity-40" />;
}
