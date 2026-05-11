/**
 * Ritemark Settings Component
 *
 * Branded settings page for API keys and feature configuration.
 */

import { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/button';
import { vscode } from '../../lib/vscode';
import { Slider } from '../ui/slider';

interface SettingsData {
  codexIntegration: boolean;
  codexApprovalPolicy: 'untrusted' | 'on-request' | 'on-failure' | 'never';
  codexSandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access';
  agentRuntimePreference: 'bundled' | 'system';
  htmlDefaultOpener: 'browser' | 'editor' | 'prompt'; // browser/prompt are legacy values
  updatesEnabled: boolean;
  agentTimeout: number;
  debugTrace: boolean;
  openaiKey: string;
  openaiKeyConfigured: boolean;
  googleKey: string;
  googleKeyConfigured: boolean;
  anthropicKey: string;
  anthropicKeyConfigured: boolean;
  chatFontSize: number;
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
  key: 'openai' | 'google' | 'anthropic';
  success: boolean;
  error?: string;
  message?: string;
}

export function RitemarkSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  // Track last manual update-check click. Used to show the spinner during the
  // brief gap between click and the backend's first 'checking' state push,
  // and to time-out the spinner if the backend never reports back (defensive
  // — prevents a "stuck updating" UI like Jarmo hit on 2026-05-07).
  const [updateCheckClickedAt, setUpdateCheckClickedAt] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [localAgentTimeout, setLocalAgentTimeout] = useState(15);
  const [localChatFontSize, setLocalChatFontSize] = useState(13);
  const [codexAuth, setCodexAuth] = useState<CodexAuthStatus>({ enabled: false });
  const [codexLoading, setCodexLoading] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'settings':
          setSettings(message.data);
          setLocalAgentTimeout(message.data.agentTimeout || 15);
          setLocalChatFontSize(message.data.chatFontSize || 13);
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
          break;

        case 'testResult':
          setTestResults((prev) => ({ ...prev, [message.key]: message }));
          if (message.key === 'openai') setTestingOpenai(false);
          if (message.key === 'google') setTestingGoogle(false);
          if (message.key === 'anthropic') setTestingAnthropic(false);
          break;

        case 'codex:authStatus':
          setCodexAuth(message.data);
          setCodexLoading(false);
          break;

        case 'codex:loginStarting':
          setCodexLoading(true);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    const resultKey = keyName === 'openai-api-key' ? 'openai' : keyName === 'anthropic-api-key' ? 'anthropic' : 'google';
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

  return (
    <div className="max-w-3xl mx-auto p-8 text-ink-body">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink-strong mb-2">
          Ritemark Settings
        </h1>
        <p className="text-sm text-ink-muted">
          Configure API keys and features for Ritemark AI.
        </p>
      </div>

      {/* Appearance Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="palette" size={20} className="text-ink-strong" />
          <h2 className="text-lg font-semibold text-ink-strong">
            Appearance
          </h2>
        </div>

        <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {(settings.availableThemes || []).map((theme) => (
              <ThemePreviewCard
                key={theme.id}
                theme={theme}
                selected={settings.currentTheme === theme.id}
                onSelect={() => handleThemeChange(theme.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Agent Runtime Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="gear" size={20} className="text-ink-strong" />
          <h2 className="text-lg font-semibold text-ink-strong">
            Agent Runtime
          </h2>
        </div>
        <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <label className="text-sm font-medium text-ink-strong block mb-1">
            Runtime preference
          </label>
          <select
            value={settings.agentRuntimePreference ?? 'bundled'}
            onChange={(e) => handleSettingChange('agentRuntime.preference', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
          >
            <option value="bundled">Bundled (recommended) — use the runtimes that ship with Ritemark</option>
            <option value="system">Use system install — prefer Codex/Claude installed on PATH; bundled is fallback</option>
          </select>
          <p className="text-xs text-ink-muted mt-1">
            Applies to both Codex and Claude. Bundled runtimes are pinned per Ritemark release; choose "system install" if you want to use your own up-to-date or custom builds.
          </p>

          <div className="mt-4 pt-4 border-t border-hairline space-y-2">
            <div className="text-xs font-medium text-ink-strong">Currently active</div>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-surface-soft">
                <span className="text-ink-muted">Claude</span>
                <span className="text-ink-strong">
                  {getSourceChipLabel(settings.componentStatus.claudeCode.runtimeStatus.source) ?? 'Not detected'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-surface-soft">
                <span className="text-ink-muted">Codex</span>
                <span className="text-ink-strong">
                  {getSourceChipLabel(settings.componentStatus.codex.runtimeStatus.source) ?? 'Not detected'}
                </span>
              </div>
            </div>
            {settings.agentRuntimePreference === 'system'
              && (settings.componentStatus.claudeCode.runtimeStatus.source === 'bundled'
                || settings.componentStatus.codex.runtimeStatus.source === 'bundled') && (
              <p className="text-xs text-ink-muted mt-2">
                One or more agents fell back to the bundled runtime because no system install was found on PATH.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* API Keys Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="key" size={20} className="text-ink-strong" />
          <h2 className="text-lg font-semibold text-ink-strong">
            API Keys
          </h2>
        </div>

        <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-sm font-medium text-ink-strong">
                Claude Account
              </label>
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-accent-soft text-accent-deep">
                Experimental
              </span>
            </div>
            {(settings.componentStatus.claudeCode.state === 'ready'
              || settings.componentStatus.claudeCode.authMethod === 'api-key') && (
              <span className="flex items-center gap-1 text-xs text-ritemark-success">
                <Icon name="check" size={12} />
                Connected
              </span>
            )}
          </div>

          {settings.componentStatus.claudeCode.state === 'not-installed' ? (
            <>
              <p className="text-xs text-ink-muted mb-3">
                Install Claude to use Claude agent mode in Ritemark.
              </p>
              <Button
 onClick={() => handleClaudeAction('claude:install')}
 
 >
                Install Claude
              </Button>
            </>
          ) : settings.componentStatus.claudeCode.state === 'broken' ? (
            <>
              <p className="text-xs text-ink-muted mb-3">
                {settings.componentStatus.claudeCode.error || 'Claude is installed, but it is not ready yet.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {settings.componentStatus.claudeCode.repairAction === 'reload' ? (
                  <Button
 onClick={() => handleClaudeAction('claude:reload')}
 
 >
                    Reload Window
                  </Button>
                ) : (
                  <Button
 onClick={() => handleClaudeAction('claude:repair')}
 
 >
                    Repair Claude
                  </Button>
                )}
              </div>
            </>
          ) : settings.componentStatus.claudeCode.state === 'needs-auth' ? (
            <>
              <p className="text-xs text-ink-muted mb-3">
                Sign in to start using Claude. Choose Claude.ai for the simplest setup, or paste an Anthropic API key if you prefer.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleClaudeAction('claude:login')}
                  size="lg"
                >
                  Sign in with Claude.ai
                </Button>
                <Button
                  onClick={() => handleClaudeAction('claude:enterApiKey')}
                  variant="secondary" size="lg"
                >
                  Use Anthropic API key
                </Button>
              </div>
              <p className="text-xs text-ink-faint mt-3">
                Don&apos;t have an API key? Get one at{' '}
                <a href="https://console.anthropic.com/" className="text-accent-deep hover:underline">
                  console.anthropic.com
                </a>
                .
              </p>
            </>
          ) : settings.componentStatus.claudeCode.state === 'auth-in-progress' ? (
            <>
              <p className="text-xs text-ink-muted mb-3">
                Sign-in opened in your browser. Authorize to finish — Ritemark will refresh automatically.
              </p>
              <Button
                onClick={() => handleClaudeAction('claude:cancelLogin')}
                variant="secondary" size="lg"
              >
                Cancel sign-in
              </Button>
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
                  <Button
                    onClick={() => handleClaudeAction('claude:logout')}
                    variant="secondary" size="lg"
                  >
                    Sign Out
                  </Button>
                )}
                {settings.componentStatus.claudeCode.authMethod === 'api-key' && (
                  <Button
                    onClick={() => handleClaudeAction('claude:login')}
                    variant="secondary" size="lg"
                  >
                    Switch to Claude.ai sign-in
                  </Button>
                )}
                <Button
                  onClick={() => handleClaudeAction('claude:refreshStatus')}
                  variant="secondary" size="lg"
                >
                  Refresh Status
                </Button>
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
                <button
                  onClick={() => handleClaudeAction('claude:refreshStatus')}
                  className="text-xs text-accent-deep hover:underline bg-transparent border-none p-0"
                >
                  Refresh Status
                </button>
              </div>
            </details>
          )}

          <p className="text-xs text-ink-muted mt-3">
            Used for: Claude agents (autonomous file work), Claude Flow nodes
            <a
              href="https://docs.anthropic.com/en/docs/claude-code/setup"
              className="ml-2 inline-flex items-center gap-1 text-accent-deep hover:underline"
            >
              Learn more <Icon name="arrow-square-out" size={12} />
            </a>
          </p>
        </div>

        {/* Codex ChatGPT Auth (experimental) */}
        <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm font-medium text-ink-strong">
                  ChatGPT Account
                </label>
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-accent-soft text-accent-deep">
                  Experimental
                </span>
              </div>
              {settings.codexIntegration && codexAuth.authenticated && (
                <span className="flex items-center gap-1 text-xs text-ritemark-success">
                  <Icon name="check" size={12} />
                  Connected
                </span>
              )}
            </div>

            {codexAuth.binaryMissing || codexAuth.binaryBroken ? (
              <>
                <p className="text-xs text-ink-muted mb-3">
                  {codexAuth.binaryMissing
                    ? 'Codex CLI binary not found. Install it first:'
                    : 'Codex CLI is installed but broken. Reinstall it first:'}
                </p>
                <code className="block text-xs p-2 rounded bg-surface-soft text-ink-strong font-mono break-all">
                  {codexAuth.repairCommand || 'npm install -g @openai/codex@latest'}
                </code>
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
                  <Button
                    onClick={() => vscode.postMessage({ type: 'codex:repair' })}
                    size="lg"
                  >
                    Repair Codex
                  </Button>
                  <Button
                    onClick={() => vscode.postMessage({ type: 'updates:reload' })}
                    variant="secondary" size="lg"
                  >
                    Reload Window
                  </Button>
                  <Button
                    onClick={() => vscode.postMessage({ type: 'codex:refreshStatus' })}
                    variant="secondary" size="lg"
                  >
                    Refresh Status
                  </Button>
                </div>
                <p className="text-xs text-ink-muted mt-2">
                  After reinstalling, use Reload Window here and then reopen Settings.
                </p>
              </>
            ) : !codexAuth.authenticated ? (
              <>
                <p className="text-xs text-ink-muted mb-3">
                  Sign in with your ChatGPT account to use Codex agents without an API key.
                  Requires ChatGPT Plus ($20/mo) or Pro ($200/mo) subscription.
                </p>
                <div className="flex flex-wrap gap-2">
                  {codexLoading ? (
                    <>
                      <button
                        disabled
                        className="px-[18px] py-[10px] text-sm font-medium rounded-lg bg-primary text-primary-foreground shadow-ritemark-accent opacity-70 flex items-center gap-2 cursor-default"
                      >
                        <Icon name="circle-notch" size={16} className="animate-spin" />
                        Opening browser...
                      </button>
                      <Button
                        onClick={() => {
                          setCodexLoading(false);
                          vscode.postMessage({ type: 'codex:cancelLogin' });
                        }}
                        variant="secondary" size="lg"
                      >
                        Cancel sign-in
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => {
                        setCodexLoading(true);
                        vscode.postMessage({ type: 'codex:startLogin' });
                      }}
                      size="lg"
                    >
                      Sign in with ChatGPT
                    </Button>
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
                <Button
                  onClick={() => vscode.postMessage({ type: 'codex:logout' })}
                  variant="secondary" size="lg"
                >
                  Sign Out
                </Button>
              </>
            )}

            <p className="text-xs text-ink-muted mt-3">
              Used for: Codex Agents (autonomous coding)
              <a
                href="https://developers.openai.com/codex/cli"
                className="ml-2 inline-flex items-center gap-1 text-accent-deep hover:underline"
              >
                Learn more <Icon name="arrow-square-out" size={12} />
              </a>
            </p>

            {/* Codex Approval & Sandbox settings — only show when Codex is enabled */}
            {settings.codexIntegration && (
              <div className="mt-4 pt-4 border-t border-hairline space-y-4">
                <div>
                  <label className="text-sm font-medium text-ink-strong block mb-1">
                    Approval Policy
                  </label>
                  <select
                    value={settings.codexApprovalPolicy || 'untrusted'}
                    onChange={(e) => handleSettingChange('codex.approvalPolicy', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
                  >
                    <option value="untrusted">Ask before every command and file change (safest)</option>
                    <option value="on-request">Ask only for operations outside workspace</option>
                    <option value="on-failure">Auto-approve, ask only on failure</option>
                    <option value="never">Never ask — run everything automatically</option>
                  </select>
                  <p className="text-xs text-ink-muted mt-1">
                    Controls when Codex asks for your approval before executing shell commands or modifying files.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink-strong block mb-1">
                    Sandbox Mode
                  </label>
                  <select
                    value={settings.codexSandboxMode || 'workspace-write'}
                    onChange={(e) => handleSettingChange('codex.sandboxMode', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
                  >
                    <option value="read-only">Read only — Codex can only read files</option>
                    <option value="workspace-write">Workspace write — read and write within project (recommended)</option>
                    <option value="danger-full-access">Full access — includes network and system (use with caution)</option>
                  </select>
                  <p className="text-xs text-ink-muted mt-1">
                    Controls what Codex is allowed to do on your filesystem.
                  </p>
                </div>
              </div>
            )}
          </div>

        {/* OpenAI */}
        <div className="mb-6 p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-strong">
              OpenAI API Key
            </label>
            {settings.openaiKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-ritemark-success">
                <Icon name="check" size={12} />
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
              <button
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-strong"
              >
                {showOpenaiKey ? <Icon name="eye-slash" size={16} /> : <Icon name="eye" size={16} />}
              </button>
            </div>
            <Button
              onClick={() => handleSaveApiKey('openai-api-key', openaiKey)}
              size="lg"
            >
              Save
            </Button>
            <Button
              onClick={() => handleTestApiKey('openai-api-key')}
              disabled={!settings.openaiKeyConfigured || testingOpenai}
              variant="secondary"
              size="lg"
            >
              {testingOpenai ? <Icon name="circle-notch" size={16} className="animate-spin" /> : 'Test'}
            </Button>
          </div>

          {testResults.openai && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.openai.success
                  ? 'bg-ritemark-success-soft text-ritemark-success'
                  : 'bg-ritemark-error-soft text-ritemark-error'
              }`}
            >
              {testResults.openai.success ? (
                <span className="flex items-center gap-1">
                  <Icon name="check" size={12} /> API key is valid
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Icon name="x" size={12} /> {testResults.openai.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted mt-2">
            Used for: AI Chat, Flows (LLM), Image Generation (GPT Image 1.5)
            <a
              href="https://platform.openai.com/api-keys"
              className="ml-2 inline-flex items-center gap-1 text-accent-deep hover:underline"
            >
              Get API key <Icon name="arrow-square-out" size={12} />
            </a>
          </p>
        </div>

        {/* Google AI */}
        <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-strong">
              Google AI API Key
              <span className="ml-2 text-xs text-ink-muted">(optional)</span>
            </label>
            {settings.googleKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-ritemark-success">
                <Icon name="check" size={12} />
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
              <button
                onClick={() => setShowGoogleKey(!showGoogleKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-strong"
              >
                {showGoogleKey ? <Icon name="eye-slash" size={16} /> : <Icon name="eye" size={16} />}
              </button>
            </div>
            <Button
              onClick={() => handleSaveApiKey('google-ai-key', googleKey)}
              size="lg"
            >
              Save
            </Button>
            <Button
              onClick={() => handleTestApiKey('google-ai-key')}
              disabled={!settings.googleKeyConfigured || testingGoogle}
              variant="secondary"
              size="lg"
            >
              {testingGoogle ? <Icon name="circle-notch" size={16} className="animate-spin" /> : 'Test'}
            </Button>
          </div>

          {testResults.google && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.google.success
                  ? 'bg-ritemark-success-soft text-ritemark-success'
                  : 'bg-ritemark-error-soft text-ritemark-error'
              }`}
            >
              {testResults.google.success ? (
                <span className="flex items-center gap-1">
                  <Icon name="check" size={12} /> {testResults.google.message || 'API key is valid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Icon name="x" size={12} /> {testResults.google.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted mt-2">
            Used for: Gemini models, Imagen 3 (coming soon)
            <a
              href="https://aistudio.google.com/apikey"
              className="ml-2 inline-flex items-center gap-1 text-accent-deep hover:underline"
            >
              Get API key <Icon name="arrow-square-out" size={12} />
            </a>
          </p>
        </div>
        {/* Anthropic */}
        <div className="mt-6 p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-strong">
              Anthropic API Key
              <span className="ml-2 text-xs text-ink-muted">(optional)</span>
            </label>
            {settings.anthropicKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-ritemark-success">
                <Icon name="check" size={12} />
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
              <button
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-strong"
              >
                {showAnthropicKey ? <Icon name="eye-slash" size={16} /> : <Icon name="eye" size={16} />}
              </button>
            </div>
            <Button
              onClick={() => handleSaveApiKey('anthropic-api-key', anthropicKey)}
              size="lg"
            >
              Save
            </Button>
            <Button
              onClick={() => handleTestApiKey('anthropic-api-key')}
              disabled={!settings.anthropicKeyConfigured || testingAnthropic}
              variant="secondary"
              size="lg"
            >
              {testingAnthropic ? <Icon name="circle-notch" size={16} className="animate-spin" /> : 'Test'}
            </Button>
          </div>

          {testResults.anthropic && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.anthropic.success
                  ? 'bg-ritemark-success-soft text-ritemark-success'
                  : 'bg-ritemark-error-soft text-ritemark-error'
              }`}
            >
              {testResults.anthropic.success ? (
                <span className="flex items-center gap-1">
                  <Icon name="check" size={12} /> {testResults.anthropic.message || 'API key is valid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Icon name="x" size={12} /> {testResults.anthropic.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted mt-2">
            Used for: Claude in Ritemark (alternative to signing in with Claude.ai)
            <a
              href="https://console.anthropic.com/settings/keys"
              className="ml-2 inline-flex items-center gap-1 text-accent-deep hover:underline"
            >
              Get API key <Icon name="arrow-square-out" size={12} />
            </a>
          </p>
        </div>

      </section>

      {/* Browser Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="link-simple" size={20} className="text-ink-strong" />
          <h2 className="text-lg font-semibold text-ink-strong">
            Browser
          </h2>
        </div>
        <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <label className="text-sm font-medium text-ink-strong block mb-1">
            HTML File Default
          </label>
          <select
            value={settings.htmlDefaultOpener ?? 'editor'}
            onChange={(e) => handleSettingChange('browser.htmlDefaultOpener', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded bg-surface-soft text-ink-strong border border-hairline-strong focus:outline-none focus:ring-[4px] focus:ring-[var(--r-ring-color)]"
          >
            <option value="editor">Open as Text (default)</option>
            <option value="browser">Legacy: Browser default (disabled)</option>
            <option value="prompt">Legacy: Ask each time (disabled)</option>
          </select>
          <p className="text-xs text-ink-muted mt-1">
            HTML files open as text by default. Right-click a workspace .html file and choose Open in Ritemark Browser to preview it in the native Electron browser.
          </p>
        </div>
      </section>

      {/* Agent Timeout Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="timer" size={20} className="text-ink-strong" />
          <h2 className="text-lg font-semibold text-ink-strong">
            Agent Timeout
          </h2>
        </div>

        <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <label className="text-sm font-medium text-ink-strong block mb-2">
            Inactivity Timeout
          </label>

          <div className="flex items-center gap-4">
            <Slider
              min={5}
              max={60}
              step={5}
              value={[localAgentTimeout]}
              onValueChange={([v]) => setLocalAgentTimeout(v)}
              onValueCommit={([v]) => handleSettingChange('ai.agentTimeout', v)}
              className="flex-1"
            />
            <span className="text-sm font-mono w-16 text-right text-ink-strong">
              {localAgentTimeout} min
            </span>
          </div>

          <p className="text-xs text-ink-muted mt-2">
            Claude will be stopped if it produces no activity for this duration.
            Increase if the agent times out on complex tasks. Default: 15 minutes.
          </p>

          <div className="mt-4 pt-4 border-t border-hairline">
            <ToggleRow
              label="Debug Trace Logging"
              description="Log AI agent activity to a temporary file for troubleshooting. Reload window after changing."
              checked={settings?.debugTrace ?? false}
              onChange={(v) => handleToggle('ai.debugTrace', v)}
            />
          </div>
        </div>
      </section>

      {/* Chat Appearance Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="text-t" size={20} className="text-ink-strong" />
          <h2 className="text-lg font-semibold text-ink-strong">
            Chat Appearance
          </h2>
        </div>

        <div className="p-5 rounded-lg bg-surface border border-hairline shadow-sm">
          <label className="text-sm font-medium text-ink-strong block mb-2">
            Chat Font Size
          </label>

          <div className="flex items-center gap-4">
            <Slider
              min={10}
              max={20}
              step={1}
              value={[localChatFontSize]}
              onValueChange={([v]) => setLocalChatFontSize(v)}
              onValueCommit={([v]) => handleSettingChange('chat.fontSize', v)}
              className="flex-1"
            />
            <span className="text-sm font-mono w-12 text-right text-ink-strong">
              {localChatFontSize}px
            </span>
          </div>

          <div className="mt-3 p-3 rounded bg-surface-soft border border-hairline-strong">
            <p
              className="text-ink-strong"
              style={{ fontSize: `${localChatFontSize}px` }}
            >
              Preview: This is how text will appear in the AI chat interface.
            </p>
          </div>

          <p className="text-xs text-ink-muted mt-2">
            Adjust the font size for the AI chat messages (10-20px).
          </p>
        </div>
      </section>

      {/* Updates Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="arrows-clockwise" size={20} className="text-ink-strong" />
          <h2 className="text-lg font-semibold text-ink-strong">
            Updates
          </h2>
        </div>

        <ToggleRow
          label="Check for updates on startup"
          description="Notify when a new version of Ritemark is available"
          checked={settings.updatesEnabled}
          onChange={(value) => handleToggle('updates.enabled', value)}
        />

        <div className="mt-4 p-5 rounded-lg bg-surface border border-hairline shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-ink-strong flex items-center gap-2">
                Update Center
                <StatusBadge state={settings.updateCenter.state} />
              </div>
              <div className="text-xs text-ink-muted mt-1">
                App {settings.updateCenter.currentAppVersion} · Extension {settings.updateCenter.currentExtensionVersion}
              </div>
            </div>

            {(() => {
              const isCheckingNow = settings.updateCenter.state === 'checking' || updateCheckClickedAt !== null;
              return (
                <Button
                  onClick={() => handleUpdateAction('updates:checkNow')}
                  variant="secondary"
                  size="lg"
                  aria-busy={isCheckingNow}
                  aria-label={isCheckingNow ? 'Checking for updates' : 'Check now for updates'}
                >
                  {isCheckingNow ? (
                    <Icon name="circle-notch" size={14} className="animate-spin" />
                  ) : (
                    <Icon name="arrows-clockwise" size={14} />
                  )}
                  {isCheckingNow ? 'Checking…' : 'Check Now'}
                </Button>
              );
            })()}
          </div>

          <div className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
            <div>Last successful check: {formatTimestamp(settings.updateCenter.lastSuccessfulCheckAt)}</div>
            <div>Last failed check: {formatTimestamp(settings.updateCenter.lastFailedCheckAt)}</div>
            <div>Skipped version: {settings.updateCenter.skippedVersion || 'None'}</div>
            <div>
              Notifications paused until: {settings.updateCenter.snoozeUntil ? formatTimestamp(settings.updateCenter.snoozeUntil) : 'Not paused'}
            </div>
          </div>

          <div className="text-xs text-ink-muted">
            Update source: {settings.updateCenter.feedSource === 'feed'
              ? 'Canonical release feed'
              : settings.updateCenter.feedSource === 'legacy'
                ? 'Legacy release fallback'
                : 'No release metadata available'}
          </div>

          {settings.updateCenter.pendingRestartVersion && (
            <div className="p-3 rounded bg-accent-soft border border-accent">
              <div className="text-sm font-medium text-ink-strong">
                Restart required
              </div>
              <div className="text-xs text-ink-muted mt-1">
                Extension {settings.updateCenter.pendingRestartVersion} is installed and will activate after reload.
              </div>
              <Button
 onClick={() => handleUpdateAction('updates:reload')}
 className="mt-3"
 >
                <Icon name="arrow-counter-clockwise" size={14} />
                Reload Window
              </Button>
            </div>
          )}

          {settings.updateCenter.availableUpdate && (
            <div className="p-4 rounded bg-surface-soft border border-hairline-strong">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-ink-strong">
                    {settings.updateCenter.availableUpdate.action === 'full' ? 'Full app update' : 'Extension update'} {settings.updateCenter.availableUpdate.version}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    {settings.updateCenter.availableUpdate.summary || 'No release summary available.'}
                  </div>
                </div>
                <div className="text-xs text-ink-muted">
                  {formatSize(settings.updateCenter.availableUpdate.downloadSize)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Button
 onClick={() => handleUpdateAction('updates:install')}
 
 >
                  <Icon name="download" size={14} />
                  {settings.updateCenter.availableUpdate.action === 'full' ? 'Download Installer' : 'Install Update'}
                </Button>
                <Button
                  onClick={() => handleUpdateAction('updates:skipVersion')}
                  variant="secondary" size="lg"
                >
                  Skip This Version
                </Button>
                <Button
                  onClick={() => handleUpdateAction('updates:pause')}
                  variant="secondary" size="lg"
                >
                  Pause 7 Days
                </Button>
                {(settings.updateCenter.skippedVersion || settings.updateCenter.snoozeUntil) && (
                  <Button
                    onClick={() => handleUpdateAction('updates:resume')}
                    variant="secondary" size="lg"
                  >
                    Re-enable Notifications
                  </Button>
                )}
              </div>
            </div>
          )}

          {settings.updateCenter.state === 'up-to-date' && !settings.updateCenter.pendingRestartVersion && (
            <div className="text-sm text-ink-strong">
              Ritemark is up to date.
            </div>
          )}

          {settings.updateCenter.state === 'blocked' && settings.updateCenter.blockedReason && (
            <div className="p-3 rounded bg-ritemark-warning-soft border border-ritemark-warning text-sm text-ink-strong flex items-start gap-2">
              <Icon name="warning" size={16} className="mt-0.5" />
              <span>{settings.updateCenter.blockedReason}</span>
            </div>
          )}

          {settings.updateCenter.state === 'error' && settings.updateCenter.error && (
            <div className="p-3 rounded bg-ritemark-error-soft border border-ritemark-error text-sm text-ink-strong">
              Could not check for updates: {settings.updateCenter.error}
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-ink-strong mb-3">
              Component readiness
            </div>
            {/* The single update trigger lives on the Update Center card
                above ("Check Now"). Don't duplicate it here — two buttons
                firing the same action is confusing. */}

            <div className="grid gap-3 md:grid-cols-3">
              <ComponentCard
                icon={<Icon name="hard-drive" size={16} />}
                title="Voice model"
                status={settings.componentStatus.voiceModel.installed ? 'Installed' : 'Missing'}
                details={[
                  `${settings.componentStatus.voiceModel.modelName} (${settings.componentStatus.voiceModel.filename})`,
                  settings.componentStatus.voiceModel.installed
                    ? `On disk: ${settings.componentStatus.voiceModel.sizeDisplay}`
                    : `Download size: ${settings.componentStatus.voiceModel.sizeDisplay}`,
                  'Managed by Ritemark'
                ]}
              />

              <RuntimeStatusCard
                icon={<Icon name="shield-check" size={16} />}
                title="Claude"
                runtimeStatus={settings.componentStatus.claudeCode.runtimeStatus}
                version={settings.componentStatus.claudeCode.version}
                errorMessage={settings.componentStatus.claudeCode.error}
                diagnostics={settings.componentStatus.claudeCode.diagnostics}
              >
                {settings.componentStatus.claudeCode.repairAction === 'reload' ? (
                  <button
                    onClick={() => handleClaudeAction('claude:reload')}
                    className="px-[10px] py-[6px] rounded-[4px] text-xs bg-primary text-primary-foreground shadow-ritemark-accent transition-all active:scale-[0.98] hover:bg-accent-deep hover:shadow-ritemark-accent-md"
                  >
                    Reload window
                  </button>
                ) : settings.componentStatus.claudeCode.runtimeStatus.runtime === 'missing' ? (
                  <button
                    onClick={() => handleClaudeAction('claude:install')}
                    className="px-[10px] py-[6px] rounded-[4px] text-xs bg-primary text-primary-foreground shadow-ritemark-accent transition-all active:scale-[0.98] hover:bg-accent-deep hover:shadow-ritemark-accent-md"
                  >
                    Install Claude
                  </button>
                ) : settings.componentStatus.claudeCode.runtimeStatus.auth === 'sign_in_required' ? (
                  <button
                    onClick={() => handleClaudeAction('claude:login')}
                    className="px-[10px] py-[6px] rounded-[4px] text-xs bg-primary text-primary-foreground shadow-ritemark-accent transition-all active:scale-[0.98] hover:bg-accent-deep hover:shadow-ritemark-accent-md"
                  >
                    Sign in with Claude.ai
                  </button>
                ) : settings.componentStatus.claudeCode.state === 'auth-in-progress' ? (
                  <button
                    onClick={() => handleClaudeAction('claude:refreshStatus')}
                    className="px-[10px] py-[6px] rounded-[4px] text-xs bg-transparent text-ink-body hover:bg-surface-soft hover:text-ink-strong transition-colors"
                  >
                    Refresh status
                  </button>
                ) : (
                  <button
                    onClick={() => handleClaudeAction('claude:refreshStatus')}
                    className="px-[10px] py-[6px] rounded-[4px] text-xs bg-transparent text-ink-body hover:bg-surface-soft hover:text-ink-strong transition-colors"
                  >
                    Check installation
                  </button>
                )}
                <button
                  onClick={() => handleClaudeAction('claude:repair')}
                  className="px-[10px] py-[6px] rounded-[4px] text-xs bg-transparent text-ink-body hover:bg-surface-soft hover:text-ink-strong transition-colors"
                >
                  Repair runtime
                </button>
              </RuntimeStatusCard>

              <RuntimeStatusCard
                icon={<Icon name="robot" size={16} />}
                title="Codex"
                runtimeStatus={settings.componentStatus.codex.runtimeStatus}
                version={settings.componentStatus.codex.version}
                errorMessage={settings.componentStatus.codex.error}
                diagnostics={settings.componentStatus.codex.diagnostics}
              >
                {settings.componentStatus.codex.runtimeStatus.auth === 'sign_in_required' ? (
                  <button
                    onClick={() => handleCodexAction('codex:startLogin')}
                    className="px-[10px] py-[6px] rounded-[4px] text-xs bg-primary text-primary-foreground shadow-ritemark-accent transition-all active:scale-[0.98] hover:bg-accent-deep hover:shadow-ritemark-accent-md"
                  >
                    Sign in with OpenAI
                  </button>
                ) : (
                  <button
                    onClick={() => handleCodexAction('codex:refreshStatus')}
                    className="px-[10px] py-[6px] rounded-[4px] text-xs bg-transparent text-ink-body hover:bg-surface-soft hover:text-ink-strong transition-colors"
                  >
                    Check installation
                  </button>
                )}
                <button
                  onClick={() => handleCodexAction('codex:repair')}
                  className="px-[10px] py-[6px] rounded-[4px] text-xs bg-transparent text-ink-body hover:bg-surface-soft hover:text-ink-strong transition-colors"
                >
                  Repair runtime
                </button>
              </RuntimeStatusCard>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) {
    return 'Never';
  }

  return new Date(timestamp).toLocaleString();
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return 'Size unknown';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  badge?: string;
}

function StatusBadge({ state }: { state: SettingsData['updateCenter']['state'] }) {
  const label = state === 'update-available'
    ? 'Update available'
    : state === 'up-to-date'
      ? 'Up to date'
      : state === 'restart-required'
        ? 'Restart required'
        : state === 'paused'
          ? 'Paused'
          : state === 'blocked'
            ? 'Blocked'
            : state === 'error'
              ? 'Error'
              : state === 'checking'
                ? 'Checking'
                : 'Idle';

  return (
    <span className="text-xs px-2 py-0.5 rounded bg-accent-soft text-accent-deep">
      {label}
    </span>
  );
}

function ComponentCard({
  icon,
  title,
  status,
  details,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  details: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 p-4 rounded-lg bg-surface border border-hairline shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-ink-strong">
        {icon}
        {title}
      </div>
      <div className="mt-2 text-sm text-ink-strong">{status}</div>
      <div className="mt-2 space-y-1 text-xs text-ink-muted">
        {details.map((detail) => (
          <div key={detail} className="break-words [overflow-wrap:anywhere]">
            {detail}
          </div>
        ))}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function getRuntimeStatusCopy(model: RuntimeStatusModel): { label: string; sub: string | null } {
  if (model.runtime === 'missing') {
    return { label: 'Runtime missing', sub: 'The agent runtime was not found' };
  }
  if (model.runtime === 'architecture_mismatch') {
    return { label: 'Architecture mismatch', sub: 'The installed runtime does not match this Mac' };
  }
  if (model.runtime === 'launch_failed') {
    return { label: 'Launch failed', sub: 'The runtime could not start — see diagnostics' };
  }
  // runtime === 'installed'
  switch (model.auth) {
    case 'ready':
      return { label: 'Ready', sub: null };
    case 'sign_in_required':
      return { label: 'Sign in required', sub: 'Runtime is installed — connect your account to continue' };
    case 'unknown':
      return { label: 'Status unknown', sub: 'Could not verify account connection' };
    case 'error':
      return { label: 'Account error', sub: 'There was a problem verifying your account' };
  }
}

function getRuntimeDotClass(model: RuntimeStatusModel): { bg: string; pulse: boolean; ariaLabel: string } {
  if (model.runtime === 'installed' && model.auth === 'ready') {
    return { bg: 'bg-emerald-500', pulse: false, ariaLabel: 'Status: ready' };
  }
  if (model.runtime === 'installed' && model.auth === 'sign_in_required') {
    return { bg: 'bg-amber-500', pulse: true, ariaLabel: 'Status: attention required' };
  }
  if (model.runtime === 'installed') {
    return { bg: 'bg-amber-500', pulse: false, ariaLabel: 'Status: attention required' };
  }
  return { bg: 'bg-rose-500', pulse: false, ariaLabel: 'Status: error' };
}

function getSourceChipLabel(source: RuntimeStatusModel['source']): string | null {
  if (source === 'bundled') return 'Bundled with app';
  if (source === 'system') return 'System installation';
  return null;
}

function RuntimeStatusCard({
  icon,
  title,
  runtimeStatus,
  version,
  errorMessage,
  diagnostics,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  runtimeStatus: RuntimeStatusModel;
  version: string | null;
  errorMessage: string | null;
  diagnostics: string[];
  children?: React.ReactNode;
}) {
  const copy = getRuntimeStatusCopy(runtimeStatus);
  const dot = getRuntimeDotClass(runtimeStatus);
  const sourceLabel = getSourceChipLabel(runtimeStatus.source);
  const versionLabel = version ? `v${version.replace(/^v/, '')}` : null;
  // Auto-expand diagnostics when launch failed — user needs the detail immediately.
  const autoOpenDiagnostics = runtimeStatus.runtime === 'launch_failed';
  const showError = errorMessage && runtimeStatus.runtime !== 'installed';

  return (
    <div className="min-w-0 p-4 rounded-lg bg-surface border border-hairline shadow-sm">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-hairline">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-strong">
          {icon}
          {title}
        </div>
        <span
          className={`inline-block w-2 h-2 rounded-full ${dot.bg} ${dot.pulse ? 'animate-pulse' : ''}`}
          aria-label={dot.ariaLabel}
          role="status"
        />
      </div>

      <div className="mt-3">
        <div className="text-[13px] font-medium text-ink-strong leading-snug">
          {copy.label}
        </div>
        {copy.sub && (
          <div className="mt-0.5 text-xs text-ink-muted leading-normal">
            {copy.sub}
          </div>
        )}
        {showError && (
          <div className="mt-1 text-xs text-rose-700 break-words [overflow-wrap:anywhere]">
            {errorMessage}
          </div>
        )}
      </div>

      {(sourceLabel || versionLabel) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {sourceLabel && (
            <span className="px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-surface-soft text-ink-body">
              {sourceLabel}
            </span>
          )}
          {versionLabel && (
            <span className="px-2 py-0.5 rounded-[3px] text-[11px] font-medium bg-surface-soft text-ink-body">
              {versionLabel}
            </span>
          )}
        </div>
      )}

      {children && (
        <div className="mt-3 pt-3 border-t border-hairline flex flex-wrap gap-2">
          {children}
        </div>
      )}

      {diagnostics.length > 0 && (
        <details className="mt-3" open={autoOpenDiagnostics}>
          <summary className="cursor-pointer text-xs text-accent-deep hover:underline">
            Diagnostics
          </summary>
          <div className="mt-2 space-y-1 text-xs text-ink-muted">
            {diagnostics.map((detail) => (
              <div key={detail} className="break-words [overflow-wrap:anywhere]">
                {detail}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ThemePreviewCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemeInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  const dark = theme.kind === 'dark';
  const swatches = dark
    ? {
        frame: '#020617',
        sidebar: '#020617',
        surface: '#0F172A',
        soft: '#1E293B',
        hairline: '#334155',
        text: '#F8FAFC',
        muted: '#94A3B8',
        body: '#CBD5E1',
        accent: '#818CF8',
      }
    : {
        frame: '#F8FAFC',
        sidebar: '#F8FAFC',
        surface: '#FFFFFF',
        soft: '#F1F5F9',
        hairline: '#CBD5E1',
        text: '#1E1B4B',
        muted: '#64748B',
        body: '#475569',
        accent: '#4338CA',
      };

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group text-left rounded-lg border p-3 transition-all focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)] ${
        selected
          ? 'border-accent shadow-ritemark-accent'
          : 'border-hairline hover:border-hairline-strong hover:bg-surface-soft'
      }`}
    >
      <div
        className="overflow-hidden rounded-md border"
        style={{
          background: swatches.frame,
          borderColor: swatches.hairline,
        }}
      >
        <div
          className="h-5 border-b"
          style={{
            background: swatches.frame,
            borderColor: swatches.hairline,
          }}
        >
          <div className="flex h-full items-center gap-1 px-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F87171]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
            <span
              className="ml-auto h-2 w-8 rounded-sm"
              style={{ background: swatches.soft }}
            />
          </div>
        </div>
        <div className="grid h-28 grid-cols-[44px_1fr]">
          <div
            className="border-r p-2"
            style={{
              background: swatches.sidebar,
              borderColor: swatches.hairline,
            }}
          >
            <div className="mb-2 h-2 w-5 rounded-sm" style={{ background: swatches.accent }} />
            <div className="space-y-1.5">
              <div className="h-1.5 w-7 rounded-sm" style={{ background: swatches.muted }} />
              <div className="h-1.5 w-5 rounded-sm" style={{ background: swatches.muted }} />
              <div className="h-1.5 w-6 rounded-sm" style={{ background: swatches.soft }} />
              <div className="h-1.5 w-4 rounded-sm" style={{ background: swatches.muted }} />
            </div>
          </div>
          <div
            className="p-3"
            style={{ background: swatches.surface }}
          >
            <div className="mb-3 h-3 w-24 rounded-sm" style={{ background: swatches.text }} />
            <div className="space-y-2">
              <div className="h-2 w-full rounded-sm" style={{ background: swatches.body }} />
              <div className="h-2 w-5/6 rounded-sm" style={{ background: swatches.body }} />
              <div className="h-2 w-2/3 rounded-sm" style={{ background: swatches.muted }} />
            </div>
            <div className="mt-3 flex gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: swatches.accent }} />
              <div className="h-2 w-16 rounded-sm" style={{ background: swatches.body }} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-strong">{theme.label}</div>
          <div className="mt-0.5 text-xs text-ink-muted">{theme.description}</div>
        </div>
        {selected && (
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon name="check" size={12} />
          </span>
        )}
      </div>
    </button>
  );
}

function ToggleRow({ label, description, checked, onChange, badge }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-hairline shadow-sm">
      <div>
        <div className="text-sm font-medium text-ink-strong flex items-center gap-2">
          {label}
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded bg-accent-soft text-accent-deep">
              {badge}
            </span>
          )}
        </div>
        <div className="text-xs text-ink-muted">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-[var(--r-ring-color)] ${
          checked
            ? 'bg-primary shadow-ritemark-accent'
            : 'bg-surface-soft border border-hairline-strong'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
