/**
 * Ritemark Settings (Sprint 147, experience 15): a tab of plain sections, AI accounts, Appearance, Sharing, Usage data,
 * Updates and Advanced (`settingsSections.ts`), drawn by `SettingsPage.tsx`. This component holds the page's data and
 * sends today's messages; each section draws its rows. AI accounts draws Claude, ChatGPT and OpenCode as rows, with
 * their Details sheets and the API keys sheet (PR 2, W4). `settingsInventory.test.ts` holds the page to every message, setting and key.
 */

import { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { vscode } from '../../lib/vscode';
import { GoogleDocsSettingsCard, type GoogleDocsSettingsProjection } from './GoogleDocsSettingsCard';
import { AiAccountsSection, type AiId, type ClaudeAction, type CodexAction } from './AiAccountsSection';
import { AiDetailsSheet } from './AiDetailsSheet';
import { API_KEY_ROWS, ApiKeysSheet, type ApiKeyRow } from './ApiKeysSheet';
import { SettingsPage } from './SettingsPage';
import { FIRST_SECTION, SETTINGS_SECTIONS, isKnownLanding, landingFor, type SettingsSectionId } from './settingsSections';
import { SettingsNote } from './SettingsRow';
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

export interface CodexAuthStatus {
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

export interface TestResult {
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
  // Sprint 147 (R3): the Details sheet's AI, and the API keys sheet with the row a way in or Set up brings into view
  const [detailsFor, setDetailsFor] = useState<AiId | null>(null);
  const [keys, setKeys] = useState<{ open: boolean; focus: ApiKeyRow['name'] | null; forOpenCode: boolean }>({ open: false, focus: null, forOpenCode: false });
  const [testing, setTesting] = useState<Partial<Record<TestResult['key'], boolean>>>({});
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
          break;

        case 'testResult':
          setTestResults((prev) => ({ ...prev, [message.key]: message }));
          setTesting((prev) => ({ ...prev, [message.key]: false }));
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
          if (landing.keyRow) {
            // A key's way in lands on the API keys sheet at that key (I61; the Experience lead, experience 15)
            setDetailsFor(null);
            setKeys({ open: true, focus: landing.keyRow, forOpenCode: false });
            setFocusAnchor(null);
          } else {
            setFocusAnchor(landing.anchor ?? null);
          }
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
    type: ClaudeAction
  ) => {
    vscode.postMessage({ type });
  };

  const handleCodexAction = (
    type: CodexAction
  ) => {
    // ChatGPT's sign-in shows at once, as before; the host's status ends it
    if (type === 'codex:startLogin') setCodexLoading(true);
    if (type === 'codex:cancelLogin') setCodexLoading(false);
    vscode.postMessage({ type });
  };

  const openKeys = (focus: ApiKeyRow['name'] | null, forOpenCode: boolean) => setKeys({ open: true, focus, forOpenCode });

  /** Save, and Remove key with an empty value: today's `setApiKey`; the host stores or deletes the secret (I32–I37). */
  const handleSaveApiKey = (keyName: ApiKeyRow['name'], value: string) => {
    vscode.postMessage({ type: 'setApiKey', key: keyName, value });
    // A changed key's last test no longer holds
    const resultKey = API_KEY_ROWS.find((row) => row.name === keyName)?.short;
    setTestResults((prev) => {
      const next = { ...prev };
      if (resultKey) delete next[resultKey];
      return next;
    });
  };

  const handleTestApiKey = (keyName: ApiKeyRow['name']) => {
    const resultKey = API_KEY_ROWS.find((row) => row.name === keyName)?.short;
    if (resultKey) setTesting((prev) => ({ ...prev, [resultKey]: true }));
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
            <AiAccountsSection
              settings={settings}
              codexAuth={codexAuth}
              codexSigningIn={codexLoading}
              testResults={testResults}
              onClaude={handleClaudeAction}
              onCodex={handleCodexAction}
              onDetails={setDetailsFor}
              onKeys={(opts) => openKeys(opts?.forOpenCode ? 'openrouter-api-key' : null, Boolean(opts?.forOpenCode))}
            />
            <AiDetailsSheet
              open={detailsFor !== null}
              ai={detailsFor ?? 'claude'}
              settings={settings}
              codexAuth={codexAuth}
              codexSigningIn={codexLoading}
              testResults={testResults}
              onClaude={handleClaudeAction}
              onCodex={handleCodexAction}
              onKeys={() => { setDetailsFor(null); openKeys(null, detailsFor === 'opencode') }}
              onDone={() => setDetailsFor(null)}
            />
            <ApiKeysSheet
              open={keys.open}
              focus={keys.focus}
              forOpenCode={keys.forOpenCode}
              settings={settings}
              testing={testing}
              results={testResults}
              onSave={handleSaveApiKey}
              onTest={handleTestApiKey}
              onDone={() => setKeys({ open: false, focus: null, forOpenCode: false })}
            />
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
