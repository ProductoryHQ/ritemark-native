/**
 * Ritemark Settings Component
 *
 * Branded settings page for API keys and feature configuration.
 */

import { useState, useEffect } from 'react';
import {
  Key,
  Zap,
  RefreshCw,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Bot,
  Type,
  Timer,
  Download,
  RotateCcw,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { vscode } from '../../lib/vscode';
import { getDefaultAssistantModel } from '../../config/modelConfig';
import { Slider } from '../ui/slider';

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  api: 'responses' | 'chat';
}

interface SettingsData {
  voiceDictation: boolean;
  ritemarkFlows: boolean;
  codexIntegration: boolean;
  updatesEnabled: boolean;
  aiModel: string;
  availableModels: ModelInfo[];
  agentTimeout: number;
  openaiKey: string;
  openaiKeyConfigured: boolean;
  googleKey: string;
  googleKeyConfigured: boolean;
  anthropicKey: string;
  anthropicKeyConfigured: boolean;
  chatFontSize: number;
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
    };
    codex: {
      installed: boolean;
      version: string | null;
      managedBy: 'user';
      state: 'ready' | 'broken' | 'not-installed';
      error: string | null;
      diagnostics: string[];
      repairCommand: string | null;
    };
  };
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

  const handleToggle = (key: string, value: boolean) => {
    vscode.postMessage({ type: 'setSetting', key, value });
  };

  const handleSettingChange = (key: string, value: string | boolean | number) => {
    vscode.postMessage({ type: 'setSetting', key, value });
  };

  const handleUpdateAction = (
    type: 'updates:checkNow' | 'updates:install' | 'updates:skipVersion' | 'updates:pause' | 'updates:resume' | 'updates:reload'
  ) => {
    vscode.postMessage({ type });
  };

  const handleClaudeAction = (
    type: 'claude:install' | 'claude:repair' | 'claude:login' | 'claude:logout' | 'claude:reload' | 'claude:refreshStatus'
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
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--vscode-descriptionForeground)]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--vscode-foreground)] mb-2">
          Ritemark Settings
        </h1>
        <p className="text-sm text-[var(--vscode-descriptionForeground)]">
          Configure API keys and features for Ritemark AI.
        </p>
      </div>

      {/* API Keys Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            API Keys
          </h2>
        </div>

        <div className="p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-sm font-medium text-[var(--vscode-foreground)]">
                Claude Account
              </label>
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                Experimental
              </span>
            </div>
            {(settings.componentStatus.claudeCode.state === 'ready'
              || settings.componentStatus.claudeCode.authMethod === 'api-key') && (
              <span className="flex items-center gap-1 text-xs text-[var(--vscode-testing-iconPassed)]">
                <Check size={12} />
                Connected
              </span>
            )}
          </div>

          {settings.componentStatus.claudeCode.state === 'not-installed' ? (
            <>
              <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">
                Install Claude to use Claude agent mode in Ritemark.
              </p>
              <button
                onClick={() => handleClaudeAction('claude:install')}
                className="px-4 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
              >
                Install Claude
              </button>
            </>
          ) : settings.componentStatus.claudeCode.state === 'broken' ? (
            <>
              <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">
                {settings.componentStatus.claudeCode.error || 'Claude is installed, but it is not ready yet.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {settings.componentStatus.claudeCode.repairAction === 'reload' ? (
                  <button
                    onClick={() => handleClaudeAction('claude:reload')}
                    className="px-4 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                  >
                    Reload Window
                  </button>
                ) : (
                  <button
                    onClick={() => handleClaudeAction('claude:repair')}
                    className="px-4 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                  >
                    Repair Claude
                  </button>
                )}
              </div>
            </>
          ) : settings.componentStatus.claudeCode.state === 'needs-auth' ? (
            <>
              <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">
                Sign in with Claude.ai to use Claude without an API key, or use your Anthropic API key instead.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleClaudeAction('claude:login')}
                  className="px-4 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                >
                  Sign in with Claude.ai
                </button>
              </div>
            </>
          ) : settings.componentStatus.claudeCode.state === 'auth-in-progress' ? (
            <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">
              Finish Claude.ai sign-in in your terminal and browser. Ritemark will refresh automatically when sign-in completes.
            </p>
          ) : (
            <>
              <div className="space-y-2 mb-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--vscode-descriptionForeground)]">Auth method:</span>
                  <span className="text-[var(--vscode-foreground)] font-semibold">
                    {settings.componentStatus.claudeCode.authMethod === 'api-key' ? 'Anthropic API key' : 'Claude.ai'}
                  </span>
                </div>
                {settings.componentStatus.claudeCode.version && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--vscode-descriptionForeground)]">CLI version:</span>
                    <span className="text-[var(--vscode-foreground)] font-mono">
                      {settings.componentStatus.claudeCode.version}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[var(--vscode-descriptionForeground)]">Billing source:</span>
                  <span className="text-[var(--vscode-foreground)]">
                    {settings.componentStatus.claudeCode.authMethod === 'api-key' ? 'Anthropic API' : 'Claude.ai'}
                  </span>
                </div>
              </div>
              {settings.componentStatus.claudeCode.authMethod === 'claude-oauth' && (
                <button
                  onClick={() => handleClaudeAction('claude:logout')}
                  className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                >
                  Sign Out
                </button>
              )}
            </>
          )}

          {(settings.componentStatus.claudeCode.binaryPath
            || settings.componentStatus.claudeCode.diagnostics.length > 0) && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-[var(--vscode-textLink-foreground)] hover:underline">
                Technical details
              </summary>
              <div className="mt-2 space-y-2 text-xs text-[var(--vscode-descriptionForeground)]">
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
                  className="text-xs text-[var(--vscode-textLink-foreground)] hover:underline bg-transparent border-none p-0"
                >
                  Refresh Status
                </button>
              </div>
            </details>
          )}

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-3">
            Used for: Claude agents (autonomous file work), Claude Flow nodes
            <a
              href="https://docs.anthropic.com/en/docs/claude-code/setup"
              className="ml-2 inline-flex items-center gap-1 text-[var(--vscode-textLink-foreground)] hover:underline"
            >
              Learn more <ExternalLink size={10} />
            </a>
          </p>
        </div>

        {/* Codex ChatGPT Auth (experimental) */}
        <div className="p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm font-medium text-[var(--vscode-foreground)]">
                  ChatGPT Account
                </label>
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                  Experimental
                </span>
              </div>
              {settings.codexIntegration && codexAuth.authenticated && (
                <span className="flex items-center gap-1 text-xs text-[var(--vscode-testing-iconPassed)]">
                  <Check size={12} />
                  Connected
                </span>
              )}
            </div>

            {!settings.codexIntegration ? (
              <>
                <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">
                  Turn on Codex Integration in Features to connect your ChatGPT account and use Codex agents in Ritemark.
                </p>
                <div className="text-xs p-2 rounded bg-[var(--vscode-badge-background)]/35 text-[var(--vscode-descriptionForeground)]">
                  The feature toggle is currently off.
                </div>
              </>
            ) : codexAuth.binaryMissing || codexAuth.binaryBroken ? (
              <>
                <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">
                  {codexAuth.binaryMissing
                    ? 'Codex CLI binary not found. Install it first:'
                    : 'Codex CLI is installed but broken. Reinstall it first:'}
                </p>
                <code className="block text-xs p-2 rounded bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] font-mono break-all">
                  {codexAuth.repairCommand || 'npm install -g @openai/codex@latest'}
                </code>
                {codexAuth.error && (
                  <div className="text-xs p-2 mt-2 rounded bg-[var(--vscode-testing-iconFailed)]/10 text-[var(--vscode-testing-iconFailed)]">
                    <span className="flex items-center gap-1">
                      <X size={12} /> {codexAuth.error}
                    </span>
                  </div>
                )}
                {codexAuth.diagnostics && codexAuth.diagnostics.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-[var(--vscode-descriptionForeground)]">
                    {codexAuth.diagnostics.map((diagnostic) => (
                      <div key={diagnostic}>{diagnostic}</div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => vscode.postMessage({ type: 'codex:repair' })}
                    className="px-4 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                  >
                    Repair Codex
                  </button>
                  <button
                    onClick={() => vscode.postMessage({ type: 'updates:reload' })}
                    className="px-4 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                  >
                    Reload Window
                  </button>
                  <button
                    onClick={() => vscode.postMessage({ type: 'codex:refreshStatus' })}
                    className="px-4 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                  >
                    Refresh Status
                  </button>
                </div>
                <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
                  After reinstalling, use Reload Window here and then reopen Settings.
                </p>
              </>
            ) : !codexAuth.authenticated ? (
              <>
                <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-3">
                  Sign in with your ChatGPT account to use Codex agents without an API key.
                  Requires ChatGPT Plus ($20/mo) or Pro ($200/mo) subscription.
                </p>
                <button
                  onClick={() => {
                    setCodexLoading(true);
                    vscode.postMessage({ type: 'codex:startLogin' });
                    setTimeout(() => setCodexLoading(false), 60_000);
                  }}
                  disabled={codexLoading}
                  className="px-4 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 flex items-center gap-2"
                >
                  {codexLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Opening browser...
                    </>
                  ) : (
                    'Sign in with ChatGPT'
                  )}
                </button>
                {codexAuth.error && (
                  <div className="text-xs p-2 mt-2 rounded bg-[var(--vscode-testing-iconFailed)]/10 text-[var(--vscode-testing-iconFailed)]">
                    <span className="flex items-center gap-1">
                      <X size={12} /> {codexAuth.error}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2 mb-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--vscode-descriptionForeground)]">Email:</span>
                    <span className="text-[var(--vscode-foreground)] font-mono">{codexAuth.email}</span>
                  </div>
                  {codexAuth.plan && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--vscode-descriptionForeground)]">Plan:</span>
                      <span className="text-[var(--vscode-foreground)] font-semibold">
                        ChatGPT {codexAuth.plan.charAt(0).toUpperCase() + codexAuth.plan.slice(1)}
                      </span>
                    </div>
                  )}
                  {codexAuth.credits && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--vscode-descriptionForeground)]">API Credits:</span>
                      <span className="text-[var(--vscode-foreground)]">
                        ${(codexAuth.credits.limit - codexAuth.credits.used).toFixed(2)} / ${codexAuth.credits.limit.toFixed(2)} remaining
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => vscode.postMessage({ type: 'codex:logout' })}
                  className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                >
                  Sign Out
                </button>
              </>
            )}

            <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-3">
              Used for: Codex Agents (autonomous coding)
              <a
                href="https://developers.openai.com/codex/cli"
                className="ml-2 inline-flex items-center gap-1 text-[var(--vscode-textLink-foreground)] hover:underline"
              >
                Learn more <ExternalLink size={10} />
              </a>
            </p>
          </div>

        {/* OpenAI */}
        <div className="mb-6 p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--vscode-foreground)]">
              OpenAI API Key
            </label>
            {settings.openaiKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-[var(--vscode-testing-iconPassed)]">
                <Check size={12} />
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
                className="w-full px-3 py-2 pr-10 text-sm rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              />
              <button
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
              >
                {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={() => handleSaveApiKey('openai-api-key', openaiKey)}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              Save
            </button>
            <button
              onClick={() => handleTestApiKey('openai-api-key')}
              disabled={!settings.openaiKeyConfigured || testingOpenai}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
            >
              {testingOpenai ? <Loader2 size={16} className="animate-spin" /> : 'Test'}
            </button>
          </div>

          {testResults.openai && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.openai.success
                  ? 'bg-[var(--vscode-testing-iconPassed)]/10 text-[var(--vscode-testing-iconPassed)]'
                  : 'bg-[var(--vscode-testing-iconFailed)]/10 text-[var(--vscode-testing-iconFailed)]'
              }`}
            >
              {testResults.openai.success ? (
                <span className="flex items-center gap-1">
                  <Check size={12} /> API key is valid
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <X size={12} /> {testResults.openai.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            Used for: AI Chat, Flows (LLM), Image Generation (GPT Image 1.5)
            <a
              href="https://platform.openai.com/api-keys"
              className="ml-2 inline-flex items-center gap-1 text-[var(--vscode-textLink-foreground)] hover:underline"
            >
              Get API key <ExternalLink size={10} />
            </a>
          </p>
        </div>

        {/* Google AI */}
        <div className="p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--vscode-foreground)]">
              Google AI API Key
              <span className="ml-2 text-xs text-[var(--vscode-descriptionForeground)]">(optional)</span>
            </label>
            {settings.googleKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-[var(--vscode-testing-iconPassed)]">
                <Check size={12} />
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
                className="w-full px-3 py-2 pr-10 text-sm rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              />
              <button
                onClick={() => setShowGoogleKey(!showGoogleKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
              >
                {showGoogleKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={() => handleSaveApiKey('google-ai-key', googleKey)}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              Save
            </button>
            <button
              onClick={() => handleTestApiKey('google-ai-key')}
              disabled={!settings.googleKeyConfigured || testingGoogle}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
            >
              {testingGoogle ? <Loader2 size={16} className="animate-spin" /> : 'Test'}
            </button>
          </div>

          {testResults.google && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.google.success
                  ? 'bg-[var(--vscode-testing-iconPassed)]/10 text-[var(--vscode-testing-iconPassed)]'
                  : 'bg-[var(--vscode-testing-iconFailed)]/10 text-[var(--vscode-testing-iconFailed)]'
              }`}
            >
              {testResults.google.success ? (
                <span className="flex items-center gap-1">
                  <Check size={12} /> {testResults.google.message || 'API key is valid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <X size={12} /> {testResults.google.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            Used for: Gemini models, Imagen 3 (coming soon)
            <a
              href="https://aistudio.google.com/apikey"
              className="ml-2 inline-flex items-center gap-1 text-[var(--vscode-textLink-foreground)] hover:underline"
            >
              Get API key <ExternalLink size={10} />
            </a>
          </p>
        </div>
        {/* Anthropic */}
        <div className="mt-6 p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--vscode-foreground)]">
              Anthropic API Key
              <span className="ml-2 text-xs text-[var(--vscode-descriptionForeground)]">(optional)</span>
            </label>
            {settings.anthropicKeyConfigured && (
              <span className="flex items-center gap-1 text-xs text-[var(--vscode-testing-iconPassed)]">
                <Check size={12} />
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
                className="w-full px-3 py-2 pr-10 text-sm rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
              />
              <button
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
              >
                {showAnthropicKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={() => handleSaveApiKey('anthropic-api-key', anthropicKey)}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              Save
            </button>
            <button
              onClick={() => handleTestApiKey('anthropic-api-key')}
              disabled={!settings.anthropicKeyConfigured || testingAnthropic}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-50"
            >
              {testingAnthropic ? <Loader2 size={16} className="animate-spin" /> : 'Test'}
            </button>
          </div>

          {testResults.anthropic && (
            <div
              className={`text-xs p-2 rounded ${
                testResults.anthropic.success
                  ? 'bg-[var(--vscode-testing-iconPassed)]/10 text-[var(--vscode-testing-iconPassed)]'
                  : 'bg-[var(--vscode-testing-iconFailed)]/10 text-[var(--vscode-testing-iconFailed)]'
              }`}
            >
              {testResults.anthropic.success ? (
                <span className="flex items-center gap-1">
                  <Check size={12} /> {testResults.anthropic.message || 'API key is valid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <X size={12} /> {testResults.anthropic.error}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            Used for: Claude in Ritemark (alternative to signing in with Claude.ai)
            <a
              href="https://console.anthropic.com/settings/keys"
              className="ml-2 inline-flex items-center gap-1 text-[var(--vscode-textLink-foreground)] hover:underline"
            >
              Get API key <ExternalLink size={10} />
            </a>
          </p>
        </div>

      </section>

      {/* AI Model Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            AI Model
          </h2>
        </div>

        <div className="p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <label className="text-sm font-medium text-[var(--vscode-foreground)] block mb-2">
            Model for Ritemark AI Assistant
          </label>

          <select
            value={settings.aiModel || getDefaultAssistantModel()}
            onChange={(e) => handleSettingChange('ai.model', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            {(settings.availableModels || []).map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
          </select>

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            GPT-5 models use the newer Responses API with enhanced reasoning.
            GPT-4 models use Chat Completions API with tool support.
          </p>
        </div>
      </section>

      {/* Agent Timeout Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            Agent Timeout
          </h2>
        </div>

        <div className="p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <label className="text-sm font-medium text-[var(--vscode-foreground)] block mb-2">
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
            <span className="text-sm font-mono w-16 text-right text-[var(--vscode-foreground)]">
              {localAgentTimeout} min
            </span>
          </div>

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            Claude will be stopped if it produces no activity for this duration.
            Increase if the agent times out on complex tasks. Default: 15 minutes.
          </p>
        </div>
      </section>

      {/* Chat Appearance Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            Chat Appearance
          </h2>
        </div>

        <div className="p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
          <label className="text-sm font-medium text-[var(--vscode-foreground)] block mb-2">
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
            <span className="text-sm font-mono w-12 text-right text-[var(--vscode-foreground)]">
              {localChatFontSize}px
            </span>
          </div>

          <div className="mt-3 p-3 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)]">
            <p
              className="text-[var(--vscode-foreground)]"
              style={{ fontSize: `${localChatFontSize}px` }}
            >
              Preview: This is how text will appear in the AI chat interface.
            </p>
          </div>

          <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
            Adjust the font size for the AI chat messages (10-20px).
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            Features
          </h2>
        </div>

        <div className="space-y-3">
          <ToggleRow
            label="Voice Dictation"
            description="Speech-to-text using Whisper (experimental, macOS only)"
            checked={settings.voiceDictation}
            onChange={(value) => handleToggle('features.voice-dictation', value)}
          />

          <ToggleRow
            label="Ritemark Flows"
            description="Visual automation workflows with AI and file operations"
            checked={settings.ritemarkFlows}
            onChange={(value) => handleToggle('features.ritemark-flows', value)}
          />

          <ToggleRow
            label="Codex Integration"
            description="ChatGPT-authenticated coding agents (experimental, requires codex binary)"
            checked={settings.codexIntegration}
            onChange={(value) => handleToggle('features.codex-integration', value)}
            badge="Experimental"
          />
        </div>
      </section>

      {/* Updates Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-[var(--vscode-foreground)]" />
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
            Updates
          </h2>
        </div>

        <ToggleRow
          label="Check for updates on startup"
          description="Notify when a new version of Ritemark is available"
          checked={settings.updatesEnabled}
          onChange={(value) => handleToggle('updates.enabled', value)}
        />

        <div className="mt-4 p-4 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-[var(--vscode-foreground)] flex items-center gap-2">
                Update Center
                <StatusBadge state={settings.updateCenter.state} />
              </div>
              <div className="text-xs text-[var(--vscode-descriptionForeground)] mt-1">
                App {settings.updateCenter.currentAppVersion} · Extension {settings.updateCenter.currentExtensionVersion}
              </div>
            </div>

            <button
              onClick={() => handleUpdateAction('updates:checkNow')}
              className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Check Now
            </button>
          </div>

          <div className="grid gap-2 text-xs text-[var(--vscode-descriptionForeground)] sm:grid-cols-2">
            <div>Last successful check: {formatTimestamp(settings.updateCenter.lastSuccessfulCheckAt)}</div>
            <div>Last failed check: {formatTimestamp(settings.updateCenter.lastFailedCheckAt)}</div>
            <div>Skipped version: {settings.updateCenter.skippedVersion || 'None'}</div>
            <div>
              Notifications paused until: {settings.updateCenter.snoozeUntil ? formatTimestamp(settings.updateCenter.snoozeUntil) : 'Not paused'}
            </div>
          </div>

          <div className="text-xs text-[var(--vscode-descriptionForeground)]">
            Update source: {settings.updateCenter.feedSource === 'feed'
              ? 'Canonical release feed'
              : settings.updateCenter.feedSource === 'legacy'
                ? 'Legacy release fallback'
                : 'No release metadata available'}
          </div>

          {settings.updateCenter.pendingRestartVersion && (
            <div className="p-3 rounded bg-[var(--vscode-inputValidation-infoBackground)] border border-[var(--vscode-focusBorder)]">
              <div className="text-sm font-medium text-[var(--vscode-foreground)]">
                Restart required
              </div>
              <div className="text-xs text-[var(--vscode-descriptionForeground)] mt-1">
                Extension {settings.updateCenter.pendingRestartVersion} is installed and will activate after reload.
              </div>
              <button
                onClick={() => handleUpdateAction('updates:reload')}
                className="mt-3 px-3 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] flex items-center gap-2"
              >
                <RotateCcw size={14} />
                Reload Window
              </button>
            </div>
          )}

          {settings.updateCenter.availableUpdate && (
            <div className="p-4 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-[var(--vscode-foreground)]">
                    {settings.updateCenter.availableUpdate.action === 'full' ? 'Full app update' : 'Extension update'} {settings.updateCenter.availableUpdate.version}
                  </div>
                  <div className="text-xs text-[var(--vscode-descriptionForeground)] mt-1">
                    {settings.updateCenter.availableUpdate.summary || 'No release summary available.'}
                  </div>
                </div>
                <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                  {formatSize(settings.updateCenter.availableUpdate.downloadSize)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => handleUpdateAction('updates:install')}
                  className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] flex items-center gap-2"
                >
                  <Download size={14} />
                  {settings.updateCenter.availableUpdate.action === 'full' ? 'Download Installer' : 'Install Update'}
                </button>
                <button
                  onClick={() => handleUpdateAction('updates:skipVersion')}
                  className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                >
                  Skip This Version
                </button>
                <button
                  onClick={() => handleUpdateAction('updates:pause')}
                  className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                >
                  Pause 7 Days
                </button>
                {(settings.updateCenter.skippedVersion || settings.updateCenter.snoozeUntil) && (
                  <button
                    onClick={() => handleUpdateAction('updates:resume')}
                    className="px-3 py-2 text-sm rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                  >
                    Re-enable Notifications
                  </button>
                )}
              </div>
            </div>
          )}

          {settings.updateCenter.state === 'up-to-date' && !settings.updateCenter.pendingRestartVersion && (
            <div className="text-sm text-[var(--vscode-foreground)]">
              Ritemark is up to date.
            </div>
          )}

          {settings.updateCenter.state === 'blocked' && settings.updateCenter.blockedReason && (
            <div className="p-3 rounded bg-[var(--vscode-inputValidation-warningBackground)] border border-[var(--vscode-inputValidation-warningBorder)] text-sm text-[var(--vscode-foreground)] flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5" />
              <span>{settings.updateCenter.blockedReason}</span>
            </div>
          )}

          {settings.updateCenter.state === 'error' && settings.updateCenter.error && (
            <div className="p-3 rounded bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)] text-sm text-[var(--vscode-foreground)]">
              Could not check for updates: {settings.updateCenter.error}
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-[var(--vscode-foreground)] mb-3">
              Component readiness
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <ComponentCard
                icon={<HardDrive className="w-4 h-4" />}
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

              <ComponentCard
                icon={<ShieldCheck className="w-4 h-4" />}
                title="Claude"
                status={
                  settings.componentStatus.claudeCode.state === 'ready'
                    ? 'Ready'
                    : settings.componentStatus.claudeCode.state === 'broken'
                      ? 'Broken'
                      : settings.componentStatus.claudeCode.state === 'auth-in-progress'
                        ? 'Signing in'
                    : settings.componentStatus.claudeCode.state === 'needs-auth'
                      ? 'Needs login'
                      : 'Not installed'
                }
                details={[
                  settings.componentStatus.claudeCode.version
                    ? `Version: ${settings.componentStatus.claudeCode.version}`
                    : settings.componentStatus.claudeCode.state === 'broken'
                      ? 'CLI detected but not runnable'
                      : 'CLI not detected',
                  settings.componentStatus.claudeCode.state === 'ready'
                    ? settings.componentStatus.claudeCode.authMethod === 'api-key'
                      ? 'Connected with Anthropic API key'
                      : 'Connected with Claude.ai'
                    : settings.componentStatus.claudeCode.state === 'broken'
                      ? (settings.componentStatus.claudeCode.error ?? 'Repair Claude to continue.')
                      : settings.componentStatus.claudeCode.state === 'auth-in-progress'
                        ? 'Finish Claude.ai sign-in in your terminal and browser.'
                      : settings.componentStatus.claudeCode.state === 'needs-auth'
                        ? 'Sign in with Claude.ai or use an Anthropic API key.'
                        : 'Install Claude to use agent mode.',
                  ...(settings.componentStatus.claudeCode.binaryPath
                    ? [`Binary: ${settings.componentStatus.claudeCode.binaryPath}`]
                    : []),
                  'Managed by user'
                ]}
              >
                <div className="flex flex-wrap gap-2">
                  {(settings.componentStatus.claudeCode.repairAction === 'install'
                    || settings.componentStatus.claudeCode.state === 'not-installed') && (
                    <button
                      onClick={() => handleClaudeAction('claude:install')}
                      className="px-3 py-1.5 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                    >
                      Install Claude
                    </button>
                  )}
                  {(settings.componentStatus.claudeCode.repairAction === 'repair'
                    || settings.componentStatus.claudeCode.state === 'broken') && (
                    <button
                      onClick={() => handleClaudeAction('claude:repair')}
                      className="px-3 py-1.5 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                    >
                      Repair Claude
                    </button>
                  )}
                  {settings.componentStatus.claudeCode.repairAction === 'reload' && (
                    <button
                      onClick={() => handleClaudeAction('claude:reload')}
                      className="px-3 py-1.5 text-xs rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                    >
                      Reload Window
                    </button>
                  )}
                  {(settings.componentStatus.claudeCode.state === 'needs-auth'
                    || settings.componentStatus.claudeCode.state === 'auth-in-progress') && (
                    <button
                      onClick={() => handleClaudeAction(
                        settings.componentStatus.claudeCode.state === 'auth-in-progress'
                          ? 'claude:refreshStatus'
                          : 'claude:login'
                      )}
                      className="px-3 py-1.5 text-xs rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                    >
                      {settings.componentStatus.claudeCode.state === 'auth-in-progress'
                        ? 'Refresh Status'
                        : 'Sign in with Claude.ai'}
                    </button>
                  )}
                </div>
                {settings.componentStatus.claudeCode.diagnostics.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-[var(--vscode-textLink-foreground)] hover:underline">
                      Technical details
                    </summary>
                    <div className="mt-2 space-y-1 text-xs text-[var(--vscode-descriptionForeground)]">
                      {settings.componentStatus.claudeCode.diagnostics.map((detail) => (
                        <div key={detail} className="break-words [overflow-wrap:anywhere]">
                          {detail}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </ComponentCard>

              <ComponentCard
                icon={<Bot className="w-4 h-4" />}
                title="Codex CLI"
                status={
                  settings.componentStatus.codex.state === 'ready'
                    ? 'Ready'
                    : settings.componentStatus.codex.state === 'broken'
                      ? 'Broken'
                      : 'Not installed'
                }
                details={[
                  settings.componentStatus.codex.version
                    ? `Version: ${settings.componentStatus.codex.version}`
                    : settings.componentStatus.codex.state === 'broken'
                      ? 'CLI failed to start'
                      : settings.componentStatus.codex.installed
                        ? 'Version unavailable'
                        : 'CLI not detected',
                  settings.componentStatus.codex.error
                    ? settings.componentStatus.codex.error
                    : settings.componentStatus.codex.installed
                      ? 'Managed by user'
                      : 'CLI not detected',
                  ...settings.componentStatus.codex.diagnostics,
                ]}
              />
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
    <span className="text-xs px-2 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
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
    <div className="min-w-0 p-3 rounded bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--vscode-foreground)]">
        {icon}
        {title}
      </div>
      <div className="mt-2 text-sm text-[var(--vscode-foreground)]">{status}</div>
      <div className="mt-2 space-y-1 text-xs text-[var(--vscode-descriptionForeground)]">
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

function ToggleRow({ label, description, checked, onChange, badge }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)]">
      <div>
        <div className="text-sm font-medium text-[var(--vscode-foreground)] flex items-center gap-2">
          {label}
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
              {badge}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--vscode-descriptionForeground)]">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          checked
            ? 'bg-[var(--vscode-button-background)]'
            : 'bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)]'
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
