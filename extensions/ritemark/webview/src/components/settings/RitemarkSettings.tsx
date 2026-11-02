/**
 * Ritemark Settings (Sprint 147, experience 15): a tab of plain sections, AI accounts, Appearance, Sharing, Usage data,
 * Updates and Advanced (`settingsSections.ts`), drawn by `SettingsPage.tsx`. This component holds the page's data and
 * sends today's messages; each section draws its rows. AI accounts holds today's Claude, ChatGPT, OpenCode and API key
 * cards, moved whole (PR 2 redraws them). `settingsInventory.test.ts` holds the page to every message, setting and key.
 */

import { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { vscode } from '../../lib/vscode';
import { AI_INFORMATION_URL } from '../ai-sidebar/aiDisclosure';
import { GoogleDocsSettingsCard, type GoogleDocsSettingsProjection } from './GoogleDocsSettingsCard';
import { PLAN_LINES } from '../welcome/welcomeCopy';
import { SettingsPage } from './SettingsPage';
import { FIRST_SECTION, SETTINGS_SECTIONS, isKnownLanding, landingFor, type SettingsSectionId } from './settingsSections';
import { ExternalLink, SettingsGroup, SettingsNote, TipButton } from './SettingsRow';
import { AppearanceSection } from './AppearanceSection';
import { UsageDataSection } from './UsageDataSection';
import { UpdatesSection, updatesLede } from './UpdatesSection';
import { AdvancedSection } from './AdvancedSection';

export interface SettingsData {
  codexIntegration: boolean;
  codexApprovalPolicy: 'untrusted' | 'on-request' | 'on-failure' | 'never';
  codexSandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access';
  agentRuntimePreference: 'bundled' | 'system';
  /** Sprint 133 (R12): Git and Node.js for this computer's runtime (null with Ritemark's own). */
  environment?: { gitInstalled: boolean; nodeInstalled: boolean; gitRequired: boolean; nodeRequired: boolean; restartRequired: boolean } | null;
  /** Sprint 133 (R7): usage data; on by default from the welcome (Jarmo, 19 October). */
  usageData?: { on: boolean; fromRitemark1: boolean };
  updatesEnabled: boolean;
  agentTimeout: number;
  debugTrace: boolean;
  openaiKey: string;
  openaiKeyConfigured: boolean;
  googleKey: string;
  googleKeyConfigured: boolean;
  anthropicKey: string;
  anthropicKeyConfigured: boolean;
  opencodeEnabled: boolean;
  opencodeAutoApprove: boolean;
  openrouterEnabled: boolean;
  openrouterKey: string;
  openrouterKeyConfigured: boolean;
  // Sprint 108 R4/R12: transcription key + stored-transcript footprint.
  transcriptionEnabled: boolean;
  elevenlabsKey: string;
  elevenlabsKeyConfigured: boolean;
  transcriptionStorageBytes: number;
  chatFontSize: number;
  // Sprint 119: Google Docs publishing account (null when the feature is off).
  googleDocs?: GoogleDocsSettingsProjection | null;
  currentTheme: string;
  availableThemes: ThemeInfo[];
  updateCenter: {
    state: 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'paused' | 'restart-required' | 'blocked' | 'error';
    currentAppVersion: string;
    currentExtensionVersion: string;
    updatesEnabled: boolean;
    lastCheckedAt: number;
    lastSuccessfulCheckAt: number;
    lastFailedCheckAt: number;
    skippedVersion: string;
    snoozeUntil: number;
    pendingRestartVersion: string;
    availableUpdate?: {
      action: 'full' | 'extension';
      version: string;
      summary: string;
      releaseDate?: string;
      downloadSize?: number;
    };
    feedSource: 'feed' | 'legacy' | 'none';
    error?: string;
    blockedReason?: string;
  };
  componentStatus: {
    voiceModel: {
      installed: boolean;
      modelName: string;
      filename: string;
      managedBy: 'ritemark';
      sizeBytes: number;
      sizeDisplay: string;
    };
    claudeCode: {
      installed: boolean;
      runnable: boolean;
      authenticated: boolean;
      version: string | null;
      sdkVersion: string | null;
      binaryPath: string | null;
      authMethod: 'claude-oauth' | 'api-key' | null;
      managedBy: 'user';
      state: 'ready' | 'needs-auth' | 'auth-in-progress' | 'not-installed' | 'broken';
      error: string | null;
      diagnostics: string[];
      repairAction: 'install' | 'repair' | 'reload' | null;
      runtimeStatus: RuntimeStatusModel;
    };
    codex: {
      installed: boolean;
      version: string | null;
      managedBy: 'user';
      state: 'ready' | 'broken' | 'not-installed';
      error: string | null;
      diagnostics: string[];
      repairCommand: string | null;
      compatibility: {
        state: 'compatible' | 'limited';
        summary: string;
        capabilities: {
          approvals: boolean;
          requestUserInput: boolean;
          planUpdates: boolean;
        };
        limitations: string[];
      } | null;
      runtimeStatus: RuntimeStatusModel;
    };
  };
}

interface RuntimeStatusModel {
  runtime: 'missing' | 'installed' | 'architecture_mismatch' | 'launch_failed';
  source: 'bundled' | 'system' | 'unknown';
  auth: 'ready' | 'sign_in_required' | 'unknown' | 'error';
}

interface ThemeInfo {
  id: string;
  label: string;
  description: string;
  kind: 'light' | 'dark';
}

interface CodexAuthStatus {
  enabled: boolean;
  authenticated?: boolean;
  binaryMissing?: boolean;
  binaryBroken?: boolean;
  diagnostics?: string[];
  repairCommand?: string | null;
  email?: string;
  plan?: 'free' | 'plus' | 'pro' | 'team' | 'business';
  credits?: {
    used: number;
    limit: number;
    resetAt?: string;
  };
  error?: string;
}

interface TestResult {
  key: 'openai' | 'google' | 'anthropic' | 'openrouter' | 'elevenlabs';
  success: boolean;
  error?: string;
  message?: string;
}

/** A first state, for render tests from a recorded payload (the page itself starts empty and asks the host). */
export interface RitemarkSettingsInitial {
  settings?: SettingsData;
  section?: SettingsSectionId;
  codexAuth?: CodexAuthStatus;
}

export function RitemarkSettings({ initial }: { initial?: RitemarkSettingsInitial } = {}) {
  const [settings, setSettings] = useState<SettingsData | null>(initial?.settings ?? null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [elevenlabsKey, setElevenlabsKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [showElevenlabsKey, setShowElevenlabsKey] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [testingOpenrouter, setTestingOpenrouter] = useState(false);
  const [testingElevenlabs, setTestingElevenlabs] = useState(false);
  // Track last manual update-check click. Used to show the spinner during the
  // brief gap between click and the backend's first 'checking' state push,
  // and to time-out the spinner if the backend never reports back (defensive
  // — prevents a "stuck updating" UI like Jarmo hit on 2026-05-07).
  const [updateCheckClickedAt, setUpdateCheckClickedAt] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [codexAuth, setCodexAuth] = useState<CodexAuthStatus>(initial?.codexAuth ?? { enabled: false });
  const [codexLoading, setCodexLoading] = useState(false);
  const [googleDocs, setGoogleDocs] = useState<GoogleDocsSettingsProjection | null>(initial?.settings?.googleDocs ?? null);
  // Sprint 147 (R2): one section at a time; AI accounts first (I62, I63)
  const [section, setSection] = useState<SettingsSectionId>(initial?.section ?? FIRST_SECTION);
  // Another feature opened Settings at one of today's five names (Sprint 119; I61): the row to bring into view there
  const [focusAnchor, setFocusAnchor] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'settings':
          setSettings(message.data);
          setGoogleDocs(message.data.googleDocs ?? null);
          // Don't overwrite user input if they're typing
          if (!openaiKey && message.data.openaiKey) {
            setOpenaiKey(message.data.openaiKey);
          }
          if (!googleKey && message.data.googleKey) {
            setGoogleKey(message.data.googleKey);
          }
          if (!anthropicKey && message.data.anthropicKey) {
            setAnthropicKey(message.data.anthropicKey);
          }
          if (!openrouterKey && message.data.openrouterKey) {
            setOpenrouterKey(message.data.openrouterKey);
          }
          if (!elevenlabsKey && message.data.elevenlabsKey) {
            setElevenlabsKey(message.data.elevenlabsKey);
          }
          break;

        case 'testResult':
          setTestResults((prev) => ({ ...prev, [message.key]: message }));
          if (message.key === 'openai') setTestingOpenai(false);
          if (message.key === 'google') setTestingGoogle(false);
          if (message.key === 'anthropic') setTestingAnthropic(false);
          if (message.key === 'openrouter') setTestingOpenrouter(false);
          if (message.key === 'elevenlabs') setTestingElevenlabs(false);
          break;

        case 'codex:authStatus':
          setCodexAuth(message.data);
          setCodexLoading(false);
          break;

        case 'codex:loginStarting':
          setCodexLoading(true);
          break;

        case 'google-docs/settings':
          setGoogleDocs(message.projection ?? null);
          break;

        case 'settings:focus-section': {
          // As before: a name the page doesn't know moves nothing
          if (!isKnownLanding(message.section)) break;
          const landing = landingFor(message.section);
          setSection(landing.section);
          setFocusAnchor(landing.anchor ?? null);
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Bring a way in's row into view once its section has drawn it.
  useEffect(() => {
    if (!focusAnchor || !settings) return;
    const target = document.getElementById(focusAnchor);
    if (!target) return;
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setFocusAnchor(null);
  }, [focusAnchor, settings, googleDocs, section]);

  // Reset the manual update-check click marker as soon as the backend reports
  // a non-checking state, OR after 15s as a safety net (prevents a stuck
  // spinner if the backend never pushes a state transition back).
  useEffect(() => {
    if (updateCheckClickedAt === null) return;
    const backendState = settings?.updateCenter.state;
    if (backendState && backendState !== 'checking') {
      setUpdateCheckClickedAt(null);
      return;
    }
    const timer = setTimeout(() => setUpdateCheckClickedAt(null), 15_000);
    return () => clearTimeout(timer);
  }, [updateCheckClickedAt, settings?.updateCenter.state]);

  const handleToggle = (key: string, value: boolean) => {
    vscode.postMessage({ type: 'setSetting', key, value });
  };

  const handleSettingChange = (key: string, value: string | boolean | number) => {
    vscode.postMessage({ type: 'setSetting', key, value });
  };

  const handleThemeChange = (themeId: string) => {
    setSettings((prev) => prev ? { ...prev, currentTheme: themeId } : prev);
    vscode.postMessage({ type: 'theme:set', value: themeId });
  };

  const handleUpdateAction = (
    type: 'updates:checkNow' | 'updates:install' | 'updates:skipVersion' | 'updates:pause' | 'updates:resume' | 'updates:reload'
  ) => {
    if (type === 'updates:checkNow') {
      setUpdateCheckClickedAt(Date.now());
    }
    vscode.postMessage({ type });
  };

  const handleClaudeAction = (
    type: 'claude:install' | 'claude:repair' | 'claude:login' | 'claude:logout' | 'claude:reload' | 'claude:refreshStatus' | 'claude:cancelLogin' | 'claude:enterApiKey'
  ) => {
    vscode.postMessage({ type });
  };

  const handleCodexAction = (
    type: 'codex:startLogin' | 'codex:logout' | 'codex:refreshStatus' | 'codex:cancelLogin' | 'codex:repair'
  ) => {
    vscode.postMessage({ type });
  };

  const handleSaveApiKey = (keyName: string, value: string) => {
    vscode.postMessage({ type: 'setApiKey', key: keyName, value });
    // Clear test result when key changes
    const resultKey = keyName === 'openai-api-key'
      ? 'openai'
      : keyName === 'anthropic-api-key'
        ? 'anthropic'
        : keyName === 'openrouter-api-key'
          ? 'openrouter'
          : keyName === 'elevenlabs-api-key'
            ? 'elevenlabs'
            : 'google';
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[resultKey];
      return next;
    });
  };

  const handleTestApiKey = (keyName: string) => {
    if (keyName === 'openai-api-key') {
      setTestingOpenai(true);
    } else if (keyName === 'anthropic-api-key') {
      setTestingAnthropic(true);
    } else if (keyName === 'openrouter-api-key') {
      setTestingOpenrouter(true);
    } else if (keyName === 'elevenlabs-api-key') {
      setTestingElevenlabs(true);
    } else {
      setTestingGoogle(true);
    }
    vscode.postMessage({ type: 'testApiKey', key: keyName });
  };

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-muted">
        <Icon name="circle-notch" size={20} className="animate-spin text-ink-muted" />
      </div>
    );
  }

  const checkingUpdates = settings.updateCenter.state === 'checking' || updateCheckClickedAt !== null;

  return (
    <SettingsPage
      sections={SETTINGS_SECTIONS}
      section={section}
      onSectionChange={setSection}
      lede={{ updates: updatesLede(settings.updateCenter, checkingUpdates) }}
    >
      {{
        'ai-accounts': (
          <>
        <div data-settings-row="I7 I8 I9 I10 I11 I12 I13 I14 I15 I16 I18 I19" className="p-5 rounded-lg bg-surface border border-hairline shadow-sm mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              {/* Sprint 144 P2: no "Experimental" badge; Claude is one of Ritemark's main AIs (experience 15) */}
              <label className="text-sm font-medium text-ink-strong">
                Claude Account
              </label>
            </div>
            {/* Sprint 145 (#578): Connected, Configured and a valid key are ink, here and below; green is only the ready dot */}
            {(settings.componentStatus.claudeCode.state === 'ready'
              || settings.componentStatus.claudeCode.authMethod === 'api-key') && (
              <span className="flex items-center gap-1 text-xs text-ink-strong">
                <Icon name="check" size={12} tone="inherit" />
                Connected
              </span>
            )}
          </div>

          {settings.componentStatus.claudeCode.state === 'not-installed' ? (
            <>
              <p className="text-xs text-ink-muted mb-3">
                Install Claude to use Claude agent mode in Ritemark.
              </p>
              <TipButton tip={'Installs Claude for Ritemark'}
 onClick={() => handleClaudeAction('claude:install')}
 
 >
                Install Claude
              </TipButton>
            </>
          ) : settings.componentStatus.claudeCode.state === 'broken' ? (
            <>
              <p className="text-xs text-ink-muted mb-3">
                {settings.componentStatus.claudeCode.error || 'Claude is installed, but it is not ready yet.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {settings.componentStatus.claudeCode.repairAction === 'reload' ? (
                  <TipButton tip={'Reloads this window to finish the repair'}
 onClick={() => handleClaudeAction('claude:reload')}
 
 >
                    Reload Window
                  </TipButton>
                ) : (
                  <TipButton tip={"Repairs Claude's runtime"}
 onClick={() => handleClaudeAction('claude:repair')}
 
 >
                    Repair Claude
                  </TipButton>
                )}
              </div>
            </>
          ) : settings.componentStatus.claudeCode.state === 'needs-auth' ? (
            <>
              <p className="text-xs text-ink-muted mb-3">
                {/* Sprint 139 (R1): which plans work, in the welcome's words. */}
                {PLAN_LINES.claude} Choose Claude.ai for the simplest setup, or paste an Anthropic API key if you prefer.
              </p>
              <div className="flex flex-wrap gap-2">
                <TipButton tip={"Opens Claude's sign-in in your browser"}
                  onClick={() => handleClaudeAction('claude:login')}
                  size="lg"
                >
                  Sign in with Claude.ai
                </TipButton>
                <TipButton tip={'Asks for your Anthropic API key'}
                  onClick={() => handleClaudeAction('claude:enterApiKey')}
                  variant="secondary" size="lg"
                >
                  Use Anthropic API key
                </TipButton>
              </div>
              <p className="text-xs text-ink-faint mt-3">
                Don&apos;t have an API key? Get one at{' '}
                <ExternalLink url="https://console.anthropic.com/">console.anthropic.com</ExternalLink>
                .
              </p>
            </>
          ) : settings.componentStatus.claudeCode.state === 'auth-in-progress' ? (
            <>
              <p className="text-xs text-ink-muted mb-3">
                Sign-in opened in your browser. Authorize to finish — Ritemark will refresh automatically.
              </p>
              <TipButton tip={"Stops waiting for Claude's sign-in"}
                onClick={() => handleClaudeAction('claude:cancelLogin')}
                variant="secondary" size="lg"
              >
                Cancel sign-in
              </TipButton>
            </>
          ) : (
            <>
              <div className="space-y-2 mb-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Auth method:</span>
                  <span className="text-ink-strong font-semibold">
                    {settings.componentStatus.claudeCode.authMethod === 'api-key' ? 'Anthropic API key' : 'Claude.ai'}
                  </span>
                </div>
                {settings.componentStatus.claudeCode.version && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">CLI version:</span>
                    <span className="text-ink-strong font-mono">
                      {settings.componentStatus.claudeCode.version}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Billing source:</span>
                  <span className="text-ink-strong">
                    {settings.componentStatus.claudeCode.authMethod === 'api-key' ? 'Anthropic API' : 'Claude.ai'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.componentStatus.claudeCode.authMethod === 'claude-oauth' && (
                  <TipButton tip={'Signs Claude out of your Claude.ai account here'}
                    onClick={() => handleClaudeAction('claude:logout')}
                    variant="secondary" size="lg"
                  >
                    Sign Out
                  </TipButton>
                )}
                {settings.componentStatus.claudeCode.authMethod === 'api-key' && (
                  <TipButton tip={"Opens Claude's sign-in in your browser"}
                    onClick={() => handleClaudeAction('claude:login')}
                    variant="secondary" size="lg"
                  >
                    Switch to Claude.ai sign-in
                  </TipButton>
                )}
                <TipButton tip={'Asks Claude for its state again'}
                  onClick={() => handleClaudeAction('claude:refreshStatus')}
                  variant="secondary" size="lg"
                >
                  Refresh Status
                </TipButton>
              </div>
            </>
          )}

          {(settings.componentStatus.claudeCode.binaryPath
            || settings.componentStatus.claudeCode.diagnostics.length > 0) && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-accent-deep hover:underline">
                Technical details
              </summary>
              <div className="mt-2 space-y-2 text-xs text-ink-muted">
                {settings.componentStatus.claudeCode.binaryPath && (
                  <div className="break-words [overflow-wrap:anywhere]">
                    Binary: {settings.componentStatus.claudeCode.binaryPath}
                  </div>
                )}
                {settings.componentStatus.claudeCode.diagnostics.map((detail) => (
                  <div key={detail} className="break-words [overflow-wrap:anywhere]">
                    {detail}
                  </div>
                ))}
                <TipButton tip="Asks Claude for its state again" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => handleClaudeAction('claude:refreshStatus')}>
                  Refresh Status
                </TipButton>
              </div>
            </details>
          )}

          <p className="text-xs text-ink-muted mt-3">
            Used for: Claude agents (autonomous file work), Claude Flow nodes
            <ExternalLink url="https://docs.anthropic.com/en/docs/claude-code/setup" className="ml-2">Learn more</ExternalLink>
          </p>
        </div>

        {/* Codex ChatGPT Auth. Sprint 144 P2: no "Experimental" badge (experience 15) */}
        <div data-settings-row="I20 I21 I22 I23 I24 I25 I26 I27" className="p-5 rounded-lg bg-surface border border-hairline shadow-sm mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm font-medium text-ink-strong">
                  ChatGPT Account
                </label>
              </div>
              {settings.codexIntegration && codexAuth.authenticated && (
                <span className="flex items-center gap-1 text-xs text-ink-strong">
                  <Icon name="check" size={12} tone="inherit" />
                  Connected
                </span>
              )}
            </div>

            {codexAuth.binaryMissing || codexAuth.binaryBroken ? (
              <>
                {/* Only a system install has a repair command; for the bundled
                    Codex the error below says to reinstall Ritemark. */}
                {codexAuth.repairCommand && (
                  <>
                    <p className="text-xs text-ink-muted mb-3">
                      {codexAuth.binaryMissing
                        ? 'ChatGPT is not installed. Install it first:'
                        : 'ChatGPT is installed but broken. Reinstall it first:'}
                    </p>
                    <code className="block text-xs p-2 rounded bg-surface-soft text-ink-strong font-mono break-all">
                      {codexAuth.repairCommand}
                    </code>
                  </>
                )}
                {codexAuth.error && (
                  <div className="text-xs p-2 mt-2 rounded bg-ritemark-error-soft text-ritemark-error">
                    <span className="flex items-center gap-1">
                      <Icon name="x" size={12} /> {codexAuth.error}
                    </span>
                  </div>
                )}
                {codexAuth.diagnostics && codexAuth.diagnostics.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-ink-muted">
                    {codexAuth.diagnostics.map((diagnostic) => (
                      <div key={diagnostic}>{diagnostic}</div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <TipButton tip={"Repairs ChatGPT's runtime"}
                    onClick={() => vscode.postMessage({ type: 'codex:repair' })}
                    size="lg"
                  >
                    Repair ChatGPT
                  </TipButton>
                  <TipButton tip={'Reloads this window'}
                    onClick={() => vscode.postMessage({ type: 'updates:reload' })}
                    variant="secondary" size="lg"
                  >
                    Reload Window
                  </TipButton>
                  <TipButton tip={'Asks ChatGPT for its state again'}
                    onClick={() => vscode.postMessage({ type: 'codex:refreshStatus' })}
                    variant="secondary" size="lg"
                  >
                    Refresh Status
                  </TipButton>
                </div>
                {codexAuth.repairCommand && (
                  <p className="text-xs text-ink-muted mt-2">
                    After reinstalling, use Reload Window here and then reopen Settings.
                  </p>
                )}
              </>
            ) : !codexAuth.authenticated ? (
              <>
                <p className="text-xs text-ink-muted mb-3">
                  {PLAN_LINES.chatgpt} No API key is needed. Paid plans get higher limits.
                </p>
                <div className="flex flex-wrap gap-2">
                  {codexLoading ? (
                    <>
                      <TipButton tip="Waiting for ChatGPT's sign-in in your browser" disabled aria-busy size="lg">
                        <Icon name="circle-notch" size={16} className="animate-spin" />
                        Opening browser...
                      </TipButton>
                      <TipButton tip={"Stops waiting for ChatGPT's sign-in"}
                        onClick={() => {
                          setCodexLoading(false);
                          vscode.postMessage({ type: 'codex:cancelLogin' });
                        }}
                        variant="secondary" size="lg"
                      >
                        Cancel sign-in
                      </TipButton>
                    </>
                  ) : (
                    <TipButton tip={"Opens ChatGPT's sign-in in your browser"}
                      onClick={() => {
                        setCodexLoading(true);
                        vscode.postMessage({ type: 'codex:startLogin' });
                      }}
                      size="lg"
                    >
                      Sign in with ChatGPT
                    </TipButton>
                  )}
                </div>
                {codexAuth.error && (
                  <div className="text-xs p-2 mt-2 rounded bg-ritemark-error-soft text-ritemark-error">
                    <span className="flex items-center gap-1">
                      <Icon name="x" size={12} /> {codexAuth.error}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2 mb-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Email:</span>
                    <span className="text-ink-strong font-mono">{codexAuth.email}</span>
                  </div>
                  {codexAuth.plan && (
                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted">Plan:</span>
                      <span className="text-ink-strong font-semibold">
                        ChatGPT {codexAuth.plan.charAt(0).toUpperCase() + codexAuth.plan.slice(1)}
                      </span>
                    </div>
                  )}
                  {codexAuth.credits && (
                    <div className="flex items-center justify-between">
                      <span className="text-ink-muted">API Credits:</span>
                      <span className="text-ink-strong">
                        ${(codexAuth.credits.limit - codexAuth.credits.used).toFixed(2)} / ${codexAuth.credits.limit.toFixed(2)} remaining
                      </span>
                    </div>
                  )}
                </div>
                <TipButton tip={'Signs ChatGPT out here'}
                  onClick={() => vscode.postMessage({ type: 'codex:logout' })}
                  variant="secondary" size="lg"
                >
                  Sign Out
                </TipButton>
              </>
            )}

            <p className="text-xs text-ink-muted mt-3">
              Used for: ChatGPT in chats, flows and the task board
              <ExternalLink url="https://developers.openai.com/codex/cli" className="ml-2">Learn more</ExternalLink>
            </p>

          </div>

        {/* OpenCode runtime settings — only when the opencode-integration flag is on */}
        {settings.opencodeEnabled && (
          <div data-settings-row="I30" className="mb-6 p-5 rounded-lg bg-surface border border-hairline shadow-sm">
            <label className="text-sm font-medium text-ink-strong block mb-1">
              OpenCode
            </label>
            <p className="text-xs text-ink-muted mb-2">{PLAN_LINES.opencode}</p>
          </div>
        )}

        <SettingsGroup>Other ways to connect: API keys</SettingsGroup>
        {/* OpenAI; an OpenAI step's "Add it in Settings" opens the page here (Sprint 145, #580) */}
        <div id="settings-section-openai-api-key" data-settings-row="I32 I37 I38" className="mb-6 scroll-mt-6 p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-strong">
              OpenAI API Key
            </label>
            {settings.openaiKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-ink-strong">
                <Icon name="check" size={12} tone="inherit" />
                Configured
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <input
                type={showOpenaiKey ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
              />
              <Tooltip label={showOpenaiKey ? 'Hide the key' : 'Show the key'} className="absolute right-1 top-1/2 -translate-y-1/2">
                <Button variant="ghost" size="icon-sm" aria-label={showOpenaiKey ? 'Hide the key' : 'Show the key'} onClick={() => setShowOpenaiKey(!showOpenaiKey)}>
                  {showOpenaiKey ? <Icon name="eye-slash" size={16} /> : <Icon name="eye" size={16} />}
                </Button>
              </Tooltip>
            </div>
            <TipButton tip={settings.openaiKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
              onClick={() => handleSaveApiKey('openai-api-key', openaiKey)}
              size="lg"
            >
              Save
            </TipButton>
            <TipButton tip={settings.openaiKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
              onClick={() => handleTestApiKey('openai-api-key')}
              disabled={!settings.openaiKeyConfigured || testingOpenai}
              variant="secondary"
              size="lg"
            >
              {testingOpenai ? <Icon name="circle-notch" size={16} className="animate-spin" /> : 'Test'}
            </TipButton>
          </div>

          {testResults.openai && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.openai.success
                  ? 'bg-surface-muted text-ink-strong'
                  : 'bg-ritemark-error-soft text-ritemark-error'
              }`}
            >
              {testResults.openai.success ? (
                <span className="flex items-center gap-1">
                  <Icon name="check" size={12} tone="inherit" /> API key is valid
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Icon name="x" size={12} /> {testResults.openai.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted mt-2">
            {/* No model's name here: the image steps' default moves with modelConfig (it named GPT Image 1.5 after the default became GPT Image 2) */}
            Used for: AI Chat, Flows (LLM), Image Generation{settings.opencodeEnabled ? ', OpenCode (GPT models)' : ''}
            <ExternalLink url="https://platform.openai.com/api-keys" className="ml-2">Get API key</ExternalLink>
          </p>
        </div>

        {/* Google AI; a Google image step's "Add it in Settings" opens the page here (Sprint 144) */}
        <div id="settings-section-google-ai-key" data-settings-row="I33" className="scroll-mt-6 p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-strong">
              Google AI API Key
              <span className="ml-2 text-xs text-ink-muted">(optional)</span>
            </label>
            {settings.googleKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-ink-strong">
                <Icon name="check" size={12} tone="inherit" />
                Configured
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <input
                type={showGoogleKey ? 'text' : 'password'}
                value={googleKey}
                onChange={(e) => setGoogleKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2 pr-10 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
              />
              <Tooltip label={showGoogleKey ? 'Hide the key' : 'Show the key'} className="absolute right-1 top-1/2 -translate-y-1/2">
                <Button variant="ghost" size="icon-sm" aria-label={showGoogleKey ? 'Hide the key' : 'Show the key'} onClick={() => setShowGoogleKey(!showGoogleKey)}>
                  {showGoogleKey ? <Icon name="eye-slash" size={16} /> : <Icon name="eye" size={16} />}
                </Button>
              </Tooltip>
            </div>
            <TipButton tip={settings.googleKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
              onClick={() => handleSaveApiKey('google-ai-key', googleKey)}
              size="lg"
            >
              Save
            </TipButton>
            <TipButton tip={settings.googleKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
              onClick={() => handleTestApiKey('google-ai-key')}
              disabled={!settings.googleKeyConfigured || testingGoogle}
              variant="secondary"
              size="lg"
            >
              {testingGoogle ? <Icon name="circle-notch" size={16} className="animate-spin" /> : 'Test'}
            </TipButton>
          </div>

          {testResults.google && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.google.success
                  ? 'bg-surface-muted text-ink-strong'
                  : 'bg-ritemark-error-soft text-ritemark-error'
              }`}
            >
              {testResults.google.success ? (
                <span className="flex items-center gap-1">
                  <Icon name="check" size={12} tone="inherit" /> {testResults.google.message || 'API key is valid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Icon name="x" size={12} /> {testResults.google.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted mt-2">
            Used for: {settings.opencodeEnabled ? 'Gemini models in OpenCode, Flows' : 'Gemini models, Flows'}
            <ExternalLink url="https://aistudio.google.com/apikey" className="ml-2">Get API key</ExternalLink>
          </p>
        </div>
        {/* Anthropic */}
        <div data-settings-row="I34" className="mt-6 p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-strong">
              Anthropic API Key
              <span className="ml-2 text-xs text-ink-muted">(optional)</span>
            </label>
            {settings.anthropicKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-ink-strong">
                <Icon name="check" size={12} tone="inherit" />
                Configured
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <input
                type={showAnthropicKey ? 'text' : 'password'}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 pr-10 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
              />
              <Tooltip label={showAnthropicKey ? 'Hide the key' : 'Show the key'} className="absolute right-1 top-1/2 -translate-y-1/2">
                <Button variant="ghost" size="icon-sm" aria-label={showAnthropicKey ? 'Hide the key' : 'Show the key'} onClick={() => setShowAnthropicKey(!showAnthropicKey)}>
                  {showAnthropicKey ? <Icon name="eye-slash" size={16} /> : <Icon name="eye" size={16} />}
                </Button>
              </Tooltip>
            </div>
            <TipButton tip={settings.anthropicKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
              onClick={() => handleSaveApiKey('anthropic-api-key', anthropicKey)}
              size="lg"
            >
              Save
            </TipButton>
            <TipButton tip={settings.anthropicKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
              onClick={() => handleTestApiKey('anthropic-api-key')}
              disabled={!settings.anthropicKeyConfigured || testingAnthropic}
              variant="secondary"
              size="lg"
            >
              {testingAnthropic ? <Icon name="circle-notch" size={16} className="animate-spin" /> : 'Test'}
            </TipButton>
          </div>

          {testResults.anthropic && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.anthropic.success
                  ? 'bg-surface-muted text-ink-strong'
                  : 'bg-ritemark-error-soft text-ritemark-error'
              }`}
            >
              {testResults.anthropic.success ? (
                <span className="flex items-center gap-1">
                  <Icon name="check" size={12} tone="inherit" /> {testResults.anthropic.message || 'API key is valid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Icon name="x" size={12} /> {testResults.anthropic.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted mt-2">
            Used for: Claude in Ritemark (alternative to signing in with Claude.ai){settings.opencodeEnabled ? ', OpenCode (Claude models)' : ''}
            <ExternalLink url="https://console.anthropic.com/settings/keys" className="ml-2">Get API key</ExternalLink>
          </p>
        </div>

        {/* OpenRouter API Key — optional, flag-gated */}
        {settings.openrouterEnabled && (
          <div data-settings-row="I35" className="mt-6 p-5 rounded-lg bg-surface border border-hairline shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-ink-strong">
                OpenRouter API Key
                <span className="ml-2 text-xs text-ink-muted">(optional)</span>
              </label>
              {settings.openrouterKeyConfigured && (
                <span className="flex items-center gap-1 text-xs text-ink-strong">
                  <Icon name="check" size={12} tone="inherit" />
                  Configured
                </span>
              )}
            </div>

            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <input
                  type={showOpenrouterKey ? 'text' : 'password'}
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-..."
                  className="w-full px-3 py-2 pr-10 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
                />
                <Tooltip label={showOpenrouterKey ? 'Hide the key' : 'Show the key'} className="absolute right-1 top-1/2 -translate-y-1/2">
                  <Button variant="ghost" size="icon-sm" aria-label={showOpenrouterKey ? 'Hide the key' : 'Show the key'} onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}>
                    {showOpenrouterKey ? <Icon name="eye-slash" size={16} /> : <Icon name="eye" size={16} />}
                  </Button>
                </Tooltip>
              </div>
              <TipButton tip={settings.openrouterKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
                onClick={() => handleSaveApiKey('openrouter-api-key', openrouterKey)}
                size="lg"
              >
                Save
              </TipButton>
              <TipButton tip={settings.openrouterKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
                onClick={() => handleTestApiKey('openrouter-api-key')}
                disabled={!settings.openrouterKeyConfigured || testingOpenrouter}
                variant="secondary"
                size="lg"
              >
                {testingOpenrouter ? <Icon name="circle-notch" size={16} className="animate-spin" /> : 'Test'}
              </TipButton>
            </div>

            {testResults.openrouter && (
              <div
                className={`text-xs p-2 rounded ${
                  testResults.openrouter.success
                    ? 'bg-surface-muted text-ink-strong'
                    : 'bg-ritemark-error-soft text-ritemark-error'
                }`}
              >
                {testResults.openrouter.success ? (
                  <span className="flex items-center gap-1">
                    <Icon name="check" size={12} tone="inherit" /> {testResults.openrouter.message || 'API key is valid'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Icon name="x" size={12} /> {testResults.openrouter.error}
                  </span>
                )}
              </div>
            )}

            <p className="text-xs text-ink-muted mt-2">
              Used for: OpenCode — hundreds of models from multiple providers through a single key
              <ExternalLink url="https://openrouter.ai/keys" className="ml-2">Get an OpenRouter key</ExternalLink>
            </p>
          </div>
        )}

        {/* ElevenLabs API Key — Sprint 108 R4, flag-gated with Transcribe.
            Optional: on-device transcription needs no key. What the key buys is
            speaker separation, which the on-device engine cannot do at all. */}
        {settings.transcriptionEnabled && (
          <div id="settings-section-elevenlabs-api-key" data-settings-row="I36" className="mt-6 scroll-mt-6 p-5 rounded-lg bg-surface border border-hairline shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-ink-strong">
                ElevenLabs API Key
                <span className="ml-2 text-xs text-ink-muted">(optional)</span>
              </label>
              {settings.elevenlabsKeyConfigured && (
                <span className="flex items-center gap-1 text-xs text-ink-strong">
                  <Icon name="check" size={12} tone="inherit" />
                  Configured
                </span>
              )}
            </div>

            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <input
                  type={showElevenlabsKey ? 'text' : 'password'}
                  value={elevenlabsKey}
                  onChange={(e) => setElevenlabsKey(e.target.value)}
                  placeholder="sk_..."
                  className="w-full px-3 py-2 pr-10 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
                />
                <Tooltip label={showElevenlabsKey ? 'Hide the key' : 'Show the key'} className="absolute right-1 top-1/2 -translate-y-1/2">
                  <Button variant="ghost" size="icon-sm" aria-label={showElevenlabsKey ? 'Hide the key' : 'Show the key'} onClick={() => setShowElevenlabsKey(!showElevenlabsKey)}>
                    {showElevenlabsKey ? <Icon name="eye-slash" size={16} /> : <Icon name="eye" size={16} />}
                  </Button>
                </Tooltip>
              </div>
              <TipButton tip={settings.elevenlabsKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
                onClick={() => handleSaveApiKey('elevenlabs-api-key', elevenlabsKey)}
                size="lg"
              >
                Save
              </TipButton>
              <TipButton tip={settings.elevenlabsKeyConfigured ? 'Asks the service whether the saved key works' : 'Save a key first, then test it'}
                onClick={() => handleTestApiKey('elevenlabs-api-key')}
                disabled={!settings.elevenlabsKeyConfigured || testingElevenlabs}
                variant="secondary"
                size="lg"
              >
                {testingElevenlabs ? <Icon name="circle-notch" size={16} className="animate-spin" /> : 'Test'}
              </TipButton>
            </div>

            {testResults.elevenlabs && (
              <div
                className={`text-xs p-2 rounded ${
                  testResults.elevenlabs.success
                    ? 'bg-surface-muted text-ink-strong'
                    : 'bg-ritemark-error-soft text-ritemark-error'
                }`}
              >
                {testResults.elevenlabs.success ? (
                  <span className="flex items-center gap-1">
                    <Icon name="check" size={12} tone="inherit" /> {testResults.elevenlabs.message || 'API key is valid'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Icon name="x" size={12} /> {testResults.elevenlabs.error}
                  </span>
                )}
              </div>
            )}

            <p className="text-xs text-ink-muted mt-2">
              Used for: Transcribe — speaker separation in recordings. On-device transcription works without a
              key, but cannot tell speakers apart. Audio is uploaded to ElevenLabs when you choose this engine.
              <ExternalLink url="https://elevenlabs.io/app/settings/api-keys" className="ml-2">Get an ElevenLabs key</ExternalLink>
            </p>
          </div>
        )}

            <SettingsNote icon="shield-check" row="I59">
              What each AI service may see: <ExternalLink url={AI_INFORMATION_URL} tip="Which AI services Ritemark uses, what they may see, and how to review what they write">AI information</ExternalLink>
            </SettingsNote>
          </>
        ),
        appearance: (
          <AppearanceSection
            themes={settings.availableThemes || []}
            currentTheme={settings.currentTheme}
            onTheme={handleThemeChange}
            chatFontSize={settings.chatFontSize || 13}
            onChatFontSize={(size) => {
              setSettings((prev) => prev ? { ...prev, chatFontSize: size } : prev);
              handleSettingChange('chat.fontSize', size);
            }}
          />
        ),
        sharing: (
          <>
            <GoogleDocsSettingsCard projection={googleDocs} />
            <SettingsNote icon="file-pdf">PDF and Word copies need nothing set: Share makes them on this computer.</SettingsNote>
          </>
        ),
        'usage-data': (
          <UsageDataSection
            usageData={settings.usageData}
            onChange={(value) => {
              // Answer the click at once, as the theme choice does; the host's resend confirms it.
              setSettings((prev) => prev ? { ...prev, usageData: { on: value, fromRitemark1: false } } : prev);
              vscode.postMessage({ type: 'usageData:set', on: value });
            }}
          />
        ),
        updates: (
          <UpdatesSection
            center={settings.updateCenter}
            updatesEnabled={settings.updatesEnabled}
            checking={checkingUpdates}
            onToggle={(value) => handleToggle('updates.enabled', value)}
            onAction={handleUpdateAction}
          />
        ),
        advanced: (
          <AdvancedSection
            settings={settings}
            onSetting={(key, value) => {
              setSettings((prev) => prev ? { ...prev, ...localSetting(key, value) } : prev);
              handleSettingChange(key, value);
            }}
            onClaude={handleClaudeAction}
            onCodex={handleCodexAction}
            onClearTranscripts={() => vscode.postMessage({ type: 'transcription:clearStorage' })}
            onOpenAllSettings={(type) => vscode.postMessage({ type })}
          />
        ),
      }}
    </SettingsPage>
  );
}

/** A setting's place in the page's data, so a choice shows at once; the host's resend confirms it. */
function localSetting(key: string, value: string | number | boolean): Partial<SettingsData> {
  switch (key) {
    case 'agentRuntime.preference': return { agentRuntimePreference: value as SettingsData['agentRuntimePreference'] };
    case 'ai.agentTimeout': return { agentTimeout: Number(value) };
    case 'ai.debugTrace': return { debugTrace: Boolean(value) };
    case 'codex.approvalPolicy': return { codexApprovalPolicy: value as SettingsData['codexApprovalPolicy'] };
    case 'codex.sandboxMode': return { codexSandboxMode: value as SettingsData['codexSandboxMode'] };
    case 'opencode.autoApprove': return { opencodeAutoApprove: Boolean(value) };
    default: return {};
  }
}
