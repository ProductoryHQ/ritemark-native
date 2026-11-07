/**
 * Ritemark Settings Provider
 *
 * Branded settings page for Ritemark configuration.
 * Reads/writes VS Code settings and manages API keys in SecretStorage.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { isEnabled } from '../features/featureGate';
import { CodexAppServer, CodexAuth, emitCodexStatusInvalidated, onCodexStatusInvalidated } from '../codex';
import { UpdateService } from '../update';
import { AVAILABLE_MODELS, defaultModelFile as voiceModelFile, getModelPath, isModelDownloaded } from '../voiceDictation/modelManager';
import { SessionStore } from '../speech/SessionStore';
import { sessionStoreDir } from '../speech/paths';
import { extractApiStatus, keyTestResult } from '../speech/engines/elevenLabsEngine';
import {
  getAgentEnvironmentStatus,
  getSetupStatus,
  installClaude,
  logoutClaude,
  emitClaudeStatusInvalidated,
  onClaudeStatusInvalidated,
  setAnthropicKeyAvailable,
  setClaudeLoginInProgress,
  beginClaudeLogin,
  cancelClaudeLogin as cancelActiveClaudeLogin,
  type SetupStatus,
} from '../agent';
import { BUNDLED_CODEX_REPAIR_MESSAGE, CodexManager, type CodexCompatibilityStatus } from '../codex/codexManager';
import { CLAUDE_MODEL_IDS, ELEVENLABS_STT_MODEL_IDS } from '../ai/modelConfig';
import { geminiHeaders, geminiUrl } from '../ai/geminiRequest';
import { runProcess } from '../utils/runProcess';
import { setUsageData, usageDataState } from '../analytics/posthog';
import { settingsTimed, settingsTimingEnabled, settingsTimingMark, settingsTimingPage, settingsTimingStart } from './settingsTiming';
import { SETTINGS_KEY_NAMES, applyApiKeyMessage, isSettingsKeyName, settingsKeyAllowed, type SettingsKeyFlags, type SettingsKeyName } from './settingsKeys';
import { keysFromTestEnvironment, readProviderKey, redactTestKey } from '../ai/providerKeys';
import { PUBLISH_PREFIX } from '../publish/settingsProtocol';
import {
  ALL_PARTS,
  RECHECK_PARTS,
  SettingsProbeScheduler,
  claudeEventParts,
  codexEventParts,
  configChangeAction,
  pageSettingAllowed,
  secretChangeAction,
  settingsSummaryLine,
  shouldRecheckOnView,
  type FollowAction,
  type SettingsPartName,
  type SettingsProbe,
} from './settingsProbes';

/**
 * Phase E status model: split runtime health, source provenance, and auth
 * readiness into three independent fields so the UI can communicate them
 * separately instead of conflating them into a single ad-hoc string.
 */
type RuntimeState = 'missing' | 'installed' | 'architecture_mismatch' | 'launch_failed';
type RuntimeSource = 'bundled' | 'system' | 'unknown';
type AuthState = 'ready' | 'sign_in_required' | 'unknown' | 'error';

interface RuntimeStatusModel {
  runtime: RuntimeState;
  source: RuntimeSource;
  auth: AuthState;
}

function deriveClaudeRuntimeStatus(status: SetupStatus): RuntimeStatusModel {
  const source: RuntimeSource = status.runtimeSource ?? 'unknown';

  if (!status.cliInstalled) {
    return { runtime: 'missing', source: 'unknown', auth: 'unknown' };
  }
  if (!status.runnable) {
    return { runtime: 'launch_failed', source, auth: 'unknown' };
  }

  // Runnable from here on.
  switch (status.state) {
    case 'ready':
      return { runtime: 'installed', source, auth: 'ready' };
    case 'needs-auth':
      return { runtime: 'installed', source, auth: 'sign_in_required' };
    case 'auth-in-progress':
      return { runtime: 'installed', source, auth: 'unknown' };
    default:
      return { runtime: 'installed', source, auth: 'unknown' };
  }
}

function deriveCodexRuntimeStatus(
  status: {
    available: boolean;
    runnable: boolean;
    runtimeSource: 'bundled' | 'system' | null;
    installNodeArch: string | null;
    machineArch: string;
  },
  authState: AuthState,
): RuntimeStatusModel {
  if (!status.available) {
    return { runtime: 'missing', source: 'unknown', auth: 'unknown' };
  }
  const source: RuntimeSource = status.runtimeSource ?? 'unknown';
  if (!status.runnable) {
    return { runtime: 'launch_failed', source, auth: 'unknown' };
  }
  if (isArchMismatch(status.installNodeArch, status.machineArch)) {
    return { runtime: 'architecture_mismatch', source, auth: 'unknown' };
  }
  return { runtime: 'installed', source, auth: authState };
}

/**
 * Compare a binary's reported arch (from `file` magic) against the host arch.
 * Returns false when either side is unknown — we never flag a mismatch on
 * incomplete data.
 */
function isArchMismatch(binaryArch: string | null, machineArch: string): boolean {
  if (!binaryArch || !machineArch) return false;
  // Normalise: `file` may report 'x86_64', `process.arch` reports 'x64'.
  const normalise = (v: string): string => {
    const lower = v.toLowerCase();
    if (lower === 'x86_64' || lower === 'x86-64') return 'x64';
    if (lower === 'aarch64') return 'arm64';
    return lower;
  };
  return normalise(binaryArch) !== normalise(machineArch);
}

// Read at module load — Node's require cache makes repeat calls free, but
// resolving once here also keeps the per-settings-open path cheap and means
// we surface SDK load failures (missing peer dep, etc.) in the extension
// host log at startup rather than per request.
const CLAUDE_AGENT_SDK_VERSION: string | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('@anthropic-ai/claude-agent-sdk/package.json') as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
})();

function readClaudeAgentSdkVersion(): string | null {
  return CLAUDE_AGENT_SDK_VERSION;
}

const RITEMARK_THEMES = [
  {
    id: 'ritemark-light',
    label: 'Ritemark Light',
    description: 'Bright document surface with indigo accents',
    kind: 'light' as const,
  },
  {
    id: 'ritemark-dark',
    label: 'Ritemark Dark',
    description: 'Deep indigo surfaces with light indigo accents',
    kind: 'dark' as const,
  },
];

/** Settings sections other features can open the page at. */
export type SettingsSection = 'google-docs' | 'transcription' | 'usage-data' | 'google-ai-key' | 'openai-api-key' | 'web-pages';

export function isSettingsSection(value: unknown): value is SettingsSection {
  return value === 'google-docs' || value === 'transcription' || value === 'usage-data'
    // Sprint 144: a Google image step's "Add it in Settings"
    || value === 'google-ai-key'
    // Sprint 145 R5 (#580): an OpenAI step's "Add it in Settings"
    || value === 'openai-api-key'
    // Sprint 149, PR 4 (Codex's review of #668): the bar's Unpublish asking to connect Cloudflare again
    || value === 'web-pages';
}

export class RitemarkSettingsProvider implements vscode.WebviewPanelSerializer {
  public static readonly viewType = 'ritemark.settings';

  private static panel: vscode.WebviewPanel | undefined;
  /** A section to scroll to once the page has rendered (Sprint 119). */
  private pendingSection: SettingsSection | undefined;
  private codexAppServer: CodexAppServer | null = null;
  private codexAuth: CodexAuth | null = null;
  private disposeClaudeStatusListener: (() => void) | null = null;
  private disposeCodexStatusListener: (() => void) | null = null;
  private claudeLoginPoll: ReturnType<typeof setInterval> | null = null;
  /**
   * Sprint 147, PR 3 (R11, A2): an open tab follows every setting it shows (All settings, `settings.json`, the
   * welcome's usage-data switch) and every key saved or removed anywhere. Replaces Sprint 133's usage-data listener.
   */
  private readonly followListeners: vscode.Disposable[];
  /** Sprint 147, PR 3 (R10): this open's probes, once per open, each posting its own part. */
  private probes: SettingsProbeScheduler | null = null;
  /** The panel's creation, the clock's zero for the summary line. */
  private panelOrigin = 0;
  /** When this open's `settings` went out, in ms since the panel's creation (0 until it has). */
  private drawnMs = 0;
  /** Each part's last answer, so a page that asks again (`ready`) is drawn whole without a second probe run. */
  private readonly lastParts = new Map<SettingsPartName, unknown>();
  private lastCodexAuth: unknown = null;
  /** Changes in one turn (a theme's three writes, a key and its status event) send one `settings` and one run. */
  private baseQueued = false;
  private readonly queuedParts = new Set<SettingsPartName>();
  private queueTimer: ReturnType<typeof setTimeout> | null = null;
  /** Each `settings` send's number; only the newest posts. */
  private baseSequence = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly updateService: UpdateService
  ) {
    this.followListeners = [
      vscode.workspace.onDidChangeConfiguration((event) => {
        const action = configChangeAction((key) => event.affectsConfiguration(key));
        // The runtime choice, from this page, All settings or settings.json: which binary each AI runs moved, so
        // every surface's cached state is stale (it was emitted from this page's setSetting alone before)
        if (action.runtimeChanged) {
          emitClaudeStatusInvalidated('settings-updated');
          emitCodexStatusInvalidated('status-refresh');
        }
        this.follow(action);
      }),
      // A key saved or removed anywhere: the welcome, Configure API Key, the guidance, this page. Only the event's
      // name is read; no value leaves the store here.
      this.context.secrets.onDidChange((event) => {
        this.follow(secretChangeAction(event.key, isSettingsKeyName));
      }),
    ];

    // Initialize Codex integration if feature is enabled
    if (isEnabled('codex-integration')) {
      this.codexAppServer = new CodexAppServer();
      this.codexAuth = new CodexAuth(this.codexAppServer);

      // Listen for auth status changes and update webview
      this.codexAuth.on('statusChanged', () => {
        this.queueParts(codexEventParts());
      });
      this.codexAuth.on('loginComplete', (event: { success: boolean }) => {
        if (event.success) {
          emitCodexStatusInvalidated('login-finished');
        }
      });
    }

    this.disposeClaudeStatusListener = onClaudeStatusInvalidated((event) => {
      if (event.reason === 'login-started') {
        this.startClaudeLoginPolling();
      } else if (event.reason === 'login-finished' || event.reason === 'authentication-failed' || event.reason === 'logout' || event.reason === 'install-finished' || event.reason === 'settings-updated') {
        this.stopClaudeLoginPolling();
      }
      // Only Claude's own parts are asked again (R10): no other probe runs for a Claude event
      this.queueParts(claudeEventParts());
    });

    // Listen for Codex auth changes from other surfaces (AI sidebar) so the
    // Settings page reflects the truthful state when a user signs in/out
    // somewhere else. Settings has its own CodexAppServer instance whose
    // cached account state survives across login/logout events, so we
    // dispose+recreate the runtime on each invalidation. The next status
    // round-trip then spawns a fresh app-server subprocess that re-reads
    // ~/.codex/auth.json — the OS-level source of truth for both surfaces.
    this.disposeCodexStatusListener = onCodexStatusInvalidated((event) => {
      if (event.reason === 'login-finished' || event.reason === 'logout') {
        this.codexAppServer?.dispose();
        this.codexAuth?.removeAllListeners();
        if (isEnabled('codex-integration')) {
          this.codexAppServer = new CodexAppServer();
          this.codexAuth = new CodexAuth(this.codexAppServer);
          this.codexAuth.on('statusChanged', () => {
            this.queueParts(codexEventParts());
          });
          this.codexAuth.on('loginComplete', (e: { success: boolean }) => {
            if (e.success) {
              emitCodexStatusInvalidated('login-finished');
            }
          });
        } else {
          this.codexAppServer = null;
          this.codexAuth = null;
        }
      }
      this.queueParts(codexEventParts());
    });
  }

  /**
   * Open the settings panel (singleton), optionally scrolled to one section.
   */
  public async open(section?: SettingsSection): Promise<void> {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel exists, reveal it
    if (RitemarkSettingsProvider.panel) {
      RitemarkSettingsProvider.panel.reveal(column);
      if (section) {
        void RitemarkSettingsProvider.panel.webview.postMessage({ type: 'settings:focus-section', section });
      }
      return;
    }
    // A new page asks for its data with 'ready'; the section follows that.
    this.pendingSection = section;

    // A Settings tab the window restored is revived only when shown: bring that tab forward rather than open a
    // second one (Sprint 134 QA, the same as Home's S21)
    const restored = vscode.window.tabGroups.all.flatMap((group) => group.tabs)
      .find((tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(RitemarkSettingsProvider.viewType));
    if (restored) {
      const index = restored.group.tabs.indexOf(restored);
      if (restored.group.viewColumn === vscode.ViewColumn.One) await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
      await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', index);
      for (let waited = 0; !RitemarkSettingsProvider.panel && waited < 3000; waited += 50) await new Promise((resolve) => setTimeout(resolve, 50));
      if (RitemarkSettingsProvider.panel) return;
    }

    settingsTimingStart('created');
    const panel = vscode.window.createWebviewPanel(
      RitemarkSettingsProvider.viewType,
      'Settings',
      column || vscode.ViewColumn.One,
      this.getWebviewOptions()
    );

    await this.resolvePanel(panel);
  }

  public async deserializeWebviewPanel(panel: vscode.WebviewPanel): Promise<void> {
    settingsTimingStart('restored');
    await this.resolvePanel(panel);
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(
    message: { type: string; key?: string; value?: unknown; url?: unknown; on?: unknown; requestId?: unknown },
    webview: vscode.Webview
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('ritemark');

    // Sprint 119: every Google Docs action goes to the one host controller,
    // which answers with a fresh projection through the settings listener.
    if (typeof message.type === 'string' && message.type.startsWith('google-docs/')) {
      await RitemarkSettingsProvider.googleDocsFeature()?.controller.handleSettingsMessage(message);
      return;
    }

    // Sprint 149, PR 4: Settings ▸ Sharing ▸ Web pages. The publish controller decodes each message by its exact
    // fields; none carries a token (the token comes in through the host's own password box).
    if (typeof message.type === 'string' && message.type.startsWith(PUBLISH_PREFIX)) {
      await RitemarkSettingsProvider.publishFeature()?.controller.handleSettingsMessage(message);
      return;
    }

    switch (message.type) {
      // Sprint 147, A1: the page's timing marks (sent only when timing is on)
      case 'settings:timing':
        settingsTimingPage(message as Parameters<typeof settingsTimingPage>[0]);
        break;

      case 'ready':
        // Sprint 147, PR 3 (R10): the page draws from what needs no probe, at once; then this open's probes start,
        // together, once. A page that asks again (a reload) gets the answers already in, without a second run.
        settingsTimingMark('ready-received');
        // A page whose panel has gone (a late ready) starts nothing
        if (RitemarkSettingsProvider.panel?.webview !== webview) break;
        await this.sendBaseSettings(webview);
        if (this.pendingSection) {
          void webview.postMessage({ type: 'settings:focus-section', section: this.pendingSection });
          this.pendingSection = undefined;
        }
        this.startOpenProbes(webview);
        break;

      // Sprint 147, PR 3 (decision 2, Jarmo): the saved-key eye. The one message that carries a key's value, for the
      // one key whose eye was pressed, when it was pressed; the page drops it when the eye or the sheet closes.
      case 'apiKey:reveal':
        await this.revealApiKey(message.key, message.requestId, webview);
        break;

      case 'openExternal': {
        const rawUrl = typeof message.url === 'string' ? message.url.trim() : '';
        if (!rawUrl) break;
        try {
          const target = vscode.Uri.parse(rawUrl, true);
          if (target.scheme === 'http' || target.scheme === 'https') {
            const opened = await vscode.env.openExternal(target);
            if (!opened) {
              void vscode.window.showWarningMessage(`Could not open ${target.authority} in your browser.`);
            }
          }
        } catch {
          // Ignore malformed or unsupported external targets.
        }
        break;
      }

      case 'setSetting':
        // Sprint 147, PR 3 (the review): only the settings the page shows and writes (`PAGE_SETTING_KEYS`); it wrote
        // any `ritemark.*` key it was sent before
        if (pageSettingAllowed(message.key) && message.value !== undefined) {
          await config.update(message.key, message.value, vscode.ConfigurationTarget.Global);
          // The configuration listener answers (R11): `settings` again, no probe; the runtime choice also
          // invalidates Claude's and ChatGPT's state there (which binary runs), as it did here before.
          this.queueBase();
        }
        break;

      case 'usageData:set':
        // Sprint 133 (R7): the same choice as the welcome's switch; it takes effect at once.
        if (typeof message.on === 'boolean') {
          await setUsageData(message.on, 'settings');
          this.queueBase();
        }
        break;

      case 'theme:set':
        if (typeof message.value === 'string' && RITEMARK_THEMES.some(theme => theme.id === message.value)) {
          const workbenchConfig = vscode.workspace.getConfiguration('workbench');
          const windowConfig = vscode.workspace.getConfiguration('window');
          await windowConfig.update('autoDetectColorScheme', false, vscode.ConfigurationTarget.Global);
          await workbenchConfig.update('colorTheme', message.value, vscode.ConfigurationTarget.Global);
          if (message.value === 'ritemark-light') {
            await workbenchConfig.update('preferredLightColorTheme', message.value, vscode.ConfigurationTarget.Global);
          } else {
            await workbenchConfig.update('preferredDarkColorTheme', message.value, vscode.ConfigurationTarget.Global);
          }
          this.queueBase();
        }
        break;

      case 'setApiKey':
        // Sprint 147, PR 3: only the five keys, each with its row's flag on (`settingsKeys.ts`); it saved any secret
        // name it was sent before (Sprint 149's audit). The OpenRouter key stays inert while opencode-integration is
        // off (Sprint 76 R3a/R7), ElevenLabs' while transcription-workbench is (Sprint 108 R4).
        // Sprint 149, PR 4: the write itself is `applyApiKeyMessage`, which holds the list; its test fails if a name
        // off the list (`ritemark.publish.cloudflare.v1`, Google's) is ever stored or deleted.
        {
          const applied = await applyApiKeyMessage(message, this.keyFlags(), this.context.secrets);
          if (!applied) break;
          if (applied.key === 'anthropic-api-key') {
            setAnthropicKeyAvailable(applied.action === 'stored');
            emitClaudeStatusInvalidated('settings-updated');
          }
          // The secrets listener redraws which keys are saved; this covers a store that reports no change
          this.queueBase();

          // Show confirmation
          vscode.window.showInformationMessage(
            applied.action === 'stored'
              ? `API key saved successfully`
              : `API key removed`
          );
        }
        break;

      case 'testApiKey':
        // Test API key validity
        if (message.key === 'openai-api-key') {
          await this.testOpenAIKey(webview);
        } else if (message.key === 'google-ai-key') {
          await this.testGoogleAIKey(webview);
        } else if (message.key === 'anthropic-api-key') {
          await this.testAnthropicKey(webview);
        } else if (message.key === 'openrouter-api-key' && isEnabled('opencode-integration')) {
          // Sprint 76 R3a (Q-UX4): validate against the OpenRouter key endpoint.
          await this.testOpenRouterKey(webview);
        } else if (message.key === 'elevenlabs-api-key' && isEnabled('transcription-workbench')) {
          // Sprint 108 R4: a cheap authenticated GET, so a bad key is caught in
          // Settings rather than halfway through a 44 MB upload.
          await this.testElevenLabsKey(webview);
        }
        break;

      // Sprint 134 (R23): the foot's Advanced settings, VS Code's own settings page
      case 'settings:openAdvanced':
        await vscode.commands.executeCommand('workbench.action.openSettings');
        break;

      case 'transcription:clearStorage':
        await this.clearTranscriptionStorage(webview);
        break;

      case 'claude:install':
      case 'claude:repair':
        await this.installClaudeFromSettings(webview);
        break;

      case 'claude:login':
        await this.startClaudeLogin(webview);
        break;

      case 'claude:cancelLogin':
        this.cancelClaudeLogin();
        this.queueParts(['claudeCode']);
        break;

      case 'claude:enterApiKey':
        await this.enterAnthropicApiKey(webview);
        break;

      case 'claude:logout':
        await this.logoutClaudeFromSettings(webview);
        break;

      case 'claude:reload':
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
        break;

      case 'claude:refreshStatus':
        // The event asks Claude's parts again (the constructor's listener)
        emitClaudeStatusInvalidated('status-refresh');
        break;

      case 'codex:startLogin':
        // Start Codex ChatGPT OAuth login
        await this.startCodexLogin(webview);
        break;

      case 'codex:logout':
        // Logout from Codex
        await this.codexLogout(webview);
        break;

      case 'codex:refreshStatus':
        // Refresh Codex auth status
        emitCodexStatusInvalidated('status-refresh');
        this.queueParts(codexEventParts());
        break;

      case 'codex:cancelLogin':
        // The logout event recreates ChatGPT's runtime here and asks its part again
        emitCodexStatusInvalidated('logout');
        vscode.window.showInformationMessage(
          'ChatGPT sign-in cancelled. If a browser tab is still open, you can close it.'
        );
        break;

      case 'codex:repair':
        await this.openCodexRepairTerminal();
        this.queueParts(codexEventParts());
        break;

      case 'updates:checkNow':
        await this.updateService.checkForUpdates({ manual: true, notify: false });
        this.queueBase();
        break;

      case 'updates:install':
        await this.updateService.installResolvedUpdate();
        this.queueBase();
        break;

      case 'updates:skipVersion':
        await this.updateService.skipResolvedUpdate();
        this.queueBase();
        break;

      case 'updates:pause':
        await this.updateService.pauseNotifications();
        this.queueBase();
        break;

      case 'updates:resume':
        await this.updateService.resumeNotifications();
        this.queueBase();
        break;

      case 'updates:reload':
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
        break;
    }
  }

  private getWebviewOptions(): vscode.WebviewOptions & vscode.WebviewPanelOptions {
    return {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };
  }

  /** Sprint 149, PR 4: web-page publishing, by the same lazy require. */
  private static publishFeature() {
    const ext = require('../extension') as typeof import('../extension');
    return ext.publish;
  }

  /** Lazy require avoids a load-time circular import with ../extension. */
  private static googleDocsFeature() {
    const ext = require('../extension') as typeof import('../extension');
    return ext.googleDocs;
  }

  private async resolvePanel(panel: vscode.WebviewPanel): Promise<void> {
    RitemarkSettingsProvider.panel = panel;
    // A new open: its own probe run, once, after the page's `ready` (R10)
    this.panelOrigin = Date.now();
    this.drawnMs = 0;
    this.probes = new SettingsProbeScheduler(this.panelOrigin);
    this.lastParts.clear();
    this.lastCodexAuth = null;
    this.clearQueue();
    RitemarkSettingsProvider.googleDocsFeature()?.setSettingsListener((projection) => {
      panel.webview.postMessage({ type: 'google-docs/settings', projection }).then(undefined, () => {});
    });
    RitemarkSettingsProvider.publishFeature()?.setSettingsListener((projection) => {
      panel.webview.postMessage({ type: 'publish:settings', projection }).then(undefined, () => {});
    });
    // Sprint 147 (experience 15, frames 2–7): the tab reads Settings, with the gear, as You's menu does
    panel.title = 'Settings';
    panel.iconPath = {
      light: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings-tab-light.svg'),
      dark: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings-tab-dark.svg'),
    };
    panel.webview.options = this.getWebviewOptions();
    // Sprint 147, A1: with timing on, each message posted writes its line
    if (settingsTimingEnabled()) {
      const post = panel.webview.postMessage.bind(panel.webview);
      panel.webview.postMessage = (message: { type?: unknown }) => {
        settingsTimingMark(`post:${typeof message?.type === 'string' ? message.type : 'unknown'}`);
        return post(message);
      };
    }
    panel.webview.html = await this.getHtmlContent(panel.webview);
    settingsTimingMark('html-set');

    panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message, panel.webview);
      },
      undefined,
      this.context.subscriptions
    );

    // The Appearance choice follows the theme however it changes (the command palette, the OS's light and dark)
    const themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      this.queueBase();
    });

    // Sprint 147, PR 3 (R11): what no event reports (a sign-in in a terminal for this computer's runtime, an update
    // handled from the bell) is checked again when the tab comes back into view
    let wasVisible = panel.visible;
    const viewListener = panel.onDidChangeViewState(() => {
      const visible = panel.visible;
      const probes = this.probes;
      const recheck = probes !== null && shouldRecheckOnView({
        visible,
        wasVisible,
        started: probes.started,
        busy: probes.busy,
        lastEndedAt: probes.lastEndedAt,
        now: Date.now(),
      });
      wasVisible = visible;
      // A shown saved key goes when the tab is hidden (the page keeps its state while hidden)
      if (!visible) void panel.webview.postMessage({ type: 'settings:hidden' }).then(undefined, () => false);
      if (recheck) {
        // Claude's answer is cached until an event: ask the runtime itself, as the poll during a sign-in does
        void getSetupStatus({ refresh: true }).catch(() => undefined).finally(() => {
          this.queueBase();
          this.queueParts(RECHECK_PARTS);
        });
      }
    });

    panel.onDidDispose(() => {
      themeListener.dispose();
      viewListener.dispose();
      if (RitemarkSettingsProvider.panel === panel) {
        RitemarkSettingsProvider.panel = undefined;
        RitemarkSettingsProvider.googleDocsFeature()?.setSettingsListener(null);
        RitemarkSettingsProvider.publishFeature()?.setSettingsListener(null);
        this.probes = null;
        this.lastParts.clear();
        this.lastCodexAuth = null;
        this.clearQueue();
      }
      this.stopClaudeLoginPolling();
    });
    // Sprint 147, PR 3 (R10, #593): nothing is awaited here. A restored tab's webview is shown only once this
    // resolves (VS Code awaits the serializer), so the probes it awaited before held the page's navigation for seconds
    // (A1: 3.4 s on Windows). The page asks for its data with `ready`.
  }

  /** The flags that show the OpenRouter and ElevenLabs rows. */
  private keyFlags(): SettingsKeyFlags {
    return { opencode: isEnabled('opencode-integration'), transcription: isEnabled('transcription-workbench') };
  }

  /** A change elsewhere (A2): `settings` again and the parts it names, coalesced. */
  private follow(action: FollowAction): void {
    if (action.base) this.queueBase();
    if (action.parts.length) this.queueParts(action.parts);
  }

  /** Sends `settings` once at the end of this turn, however many changes asked for it. */
  private queueBase(): void {
    if (!RitemarkSettingsProvider.panel) return;
    this.baseQueued = true;
    this.armQueue();
  }

  /** Asks these parts again at the end of this turn, each once. Before the open's run has begun, that run answers them. */
  private queueParts(parts: readonly SettingsPartName[]): void {
    if (!RitemarkSettingsProvider.panel || !this.probes?.started) return;
    for (const part of parts) this.queuedParts.add(part);
    this.armQueue();
  }

  private armQueue(): void {
    if (this.queueTimer) return;
    this.queueTimer = setTimeout(() => {
      this.queueTimer = null;
      const panel = RitemarkSettingsProvider.panel;
      const base = this.baseQueued;
      const parts = [...this.queuedParts];
      this.baseQueued = false;
      this.queuedParts.clear();
      if (!panel) return;
      if (base) void this.sendBaseSettings(panel.webview);
      if (parts.length && this.probes) void this.probes.run(this.buildProbes(panel.webview, parts));
    }, 0);
  }

  private clearQueue(): void {
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = null;
    this.baseQueued = false;
    this.queuedParts.clear();
  }

  /** This open's probes, once: all together, each posting its part; then R10's one summary line. */
  private startOpenProbes(webview: vscode.Webview): void {
    // resolvePanel made this open's scheduler; none after dispose, and none is made here
    if (!this.probes || RitemarkSettingsProvider.panel?.webview !== webview) return;
    const run = this.probes.runOnce(this.buildProbes(webview, ALL_PARTS));
    if (!run) {
      // The page asked again (a reload): draw it whole from the answers already in. The update state is not
      // replayed: the `settings` just sent carries a newer snapshot
      for (const [part, value] of this.lastParts) {
        if (part === 'updateCenter') continue;
        void webview.postMessage({ type: 'settings:part', part, value });
      }
      if (this.lastCodexAuth) void webview.postMessage({ type: 'codex:authStatus', data: this.lastCodexAuth });
      return;
    }
    void run.then((timings) => {
      console.log(settingsSummaryLine(this.drawnMs, timings));
    });
  }

  /**
   * Sprint 147, PR 3 (R10): what the page draws first, with no probe: every setting, which keys are saved (never a
   * key's value, decision 2), the theme, Google Docs, usage data, the versions and the update state as it stands.
   */
  private async sendBaseSettings(webview: vscode.Webview): Promise<void> {
    // An older send that finishes its reads after a newer one is dropped, so it can't draw over it
    const sequence = ++this.baseSequence;
    const config = vscode.workspace.getConfiguration('ritemark');
    const workbenchConfig = vscode.workspace.getConfiguration('workbench');
    const windowConfig = vscode.workspace.getConfiguration('window');
    const autoDetectColorScheme = windowConfig.get('autoDetectColorScheme', false);
    const configuredTheme = workbenchConfig.get('colorTheme', 'ritemark-light');
    const activeTheme = autoDetectColorScheme
      ? vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
          vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast
        ? 'ritemark-dark'
        : 'ritemark-light'
      : configuredTheme;

    settingsTimingMark('send-settings-start');
    // Which of the five keys are saved, read together; only whether each is there leaves this function.
    const flags = this.keyFlags();
    const saved = await this.savedKeys(flags);
    settingsTimingMark('probe:secrets');

    // The update state as it stands (no network); a first-ever check is a probe of its own
    const updateCenter = await settingsTimed('update-snapshot', this.updateService.getStatusSnapshot())
      .catch((error: unknown) => ({ ...this.updateFallback(), error: error instanceof Error ? error.message : 'Unknown update status error' }));
    // Sprint 149, PR 4: Web pages, the host's projection (no token, no account ID)
    const webPages = await (RitemarkSettingsProvider.publishFeature()?.controller.settingsProjection() ?? Promise.resolve(null))
      .catch(() => null);
    if (sequence !== this.baseSequence) return;

    await webview.postMessage({
      type: 'settings',
      data: {
        // Codex availability is gated by the feature flag system, not the
        // (now-removed) Settings toggle. Stable status → always true on
        // supported platforms.
        codexIntegration: isEnabled('codex-integration'),
        codexApprovalPolicy: config.get('codex.approvalPolicy', 'on-request'),
        codexSandboxMode: config.get('codex.sandboxMode', 'workspace-write'),

        // Sprint 76 R4: OpenCode auto-approve mode (skip approval cards).
        opencodeAutoApprove: config.get('opencode.autoApprove', false),

        // Agent runtime preference (bundled vs system)
        agentRuntimePreference: config.get('agentRuntime.preference', 'bundled'),

        // Sprint 133 (R7): usage data, on only after the person's yes (on by default from the welcome); the welcome's words
        usageData: usageDataState(),

        // Updates
        updatesEnabled: config.get('updates.enabled', true),
        updateCenter,

        // Appearance
        currentTheme: activeTheme,
        availableThemes: RITEMARK_THEMES,

        // Agent
        agentTimeout: config.get('ai.agentTimeout', 15),
        debugTrace: config.get('ai.debugTrace', false),

        // Chat appearance
        chatFontSize: config.get('chat.fontSize', 13),

        // API keys: whether each is saved, never its value (decision 2: the eye asks for one key, `apiKey:reveal`)
        openaiKeyConfigured: saved['openai-api-key'],
        googleKeyConfigured: saved['google-ai-key'],
        anthropicKeyConfigured: saved['anthropic-api-key'],
        // Sprint 76 R3a: OpenCode flag-gating. `opencodeEnabled` tells the
        // Settings webview whether the "Used for:" lines mention OpenCode.
        // `openrouterEnabled` tells it whether to render the OpenRouter card.
        opencodeEnabled: flags.opencode,
        openrouterEnabled: flags.opencode,
        openrouterKeyConfigured: saved['openrouter-api-key'],
        // Sprint 108 R4/R12: the ElevenLabs card and the transcription-data row
        // both disappear when the feature flag is off.
        transcriptionEnabled: flags.transcription,
        elevenlabsKeyConfigured: saved['elevenlabs-api-key'],
        // Sprint 155: in the test channel only, which keys not saved come from the test environment (booleans; the
        // value stays in the host, and the eye still answers only a saved key)
        testEnvironmentKeys: keysFromTestEnvironment(saved, (name) => settingsKeyAllowed(name, flags)),

        // The voice model: a file's size on this computer, no probe
        voiceModel: this.voiceModelStatus(),

        // Sprint 119: Google Docs publishing card (redacted projection only).
        googleDocs: RitemarkSettingsProvider.googleDocsFeature()?.controller.settingsProjection() ?? null,
        // Sprint 149, PR 4: Settings ▸ Sharing ▸ Web pages
        webPages,
      },
    }).then(undefined, () => false);
    if (!this.drawnMs && this.panelOrigin) this.drawnMs = Date.now() - this.panelOrigin;
  }

  /** Whether each of the five keys is saved (a key whose flag is off reads as not saved, as before). */
  private async savedKeys(flags: SettingsKeyFlags): Promise<Record<SettingsKeyName, boolean>> {
    const entries = await Promise.all(SETTINGS_KEY_NAMES.map(async (name) => {
      if (!settingsKeyAllowed(name, flags)) return [name, false] as const;
      try {
        return [name, Boolean(await this.context.secrets.get(name))] as const;
      } catch {
        return [name, false] as const;
      }
    }));
    return Object.fromEntries(entries) as Record<SettingsKeyName, boolean>;
  }

  /**
   * The saved-key eye (decision 2): the one key asked for, to this page only, once per press. Never logged; a name off
   * the list, or a key whose row's flag is off, answers with no value.
   */
  private async revealApiKey(key: unknown, requestId: unknown, webview: vscode.Webview): Promise<void> {
    const id = typeof requestId === 'string' || typeof requestId === 'number' ? requestId : null;
    if (id === null) return;
    let value: string | null = null;
    if (settingsKeyAllowed(key, this.keyFlags())) {
      try {
        value = (await this.context.secrets.get(key)) ?? null;
      } catch {
        value = null;
      }
    }
    await webview.postMessage({ type: 'apiKey:revealed', requestId: id, key: typeof key === 'string' ? key : null, value })
      .then(undefined, () => false);
  }

  private updateFallback() {
    return {
      state: 'error' as const,
      currentAppVersion: '',
      currentExtensionVersion: '',
      updatesEnabled: true,
      lastCheckedAt: 0,
      lastSuccessfulCheckAt: 0,
      lastFailedCheckAt: 0,
      skippedVersion: '',
      snoozeUntil: 0,
      pendingRestartVersion: '',
      feedSource: 'none' as const,
    };
  }

  /** The probes for these parts, each posting `settings:part` when it answers. */
  private buildProbes(webview: vscode.Webview, parts: readonly SettingsPartName[]): SettingsProbe[] {
    // A probe that answers after its panel closed (or another opened) touches nothing
    const panel = RitemarkSettingsProvider.panel;
    const live = () => panel !== undefined && RitemarkSettingsProvider.panel === panel && panel.webview === webview;
    const post = (part: SettingsPartName, value: unknown) => {
      if (!live()) return;
      this.lastParts.set(part, value);
      void webview.postMessage({ type: 'settings:part', part, value }).then(undefined, () => false);
    };
    const probes: Record<SettingsPartName, () => SettingsProbe> = {
      claudeCode: () => ({
        part: 'claudeCode',
        run: () => settingsTimed('claude-setup-status', this.probeClaude()),
        fallback: (error) => this.claudeFallback(error),
        deliver: (value) => post('claudeCode', value),
      }),
      codex: () => ({
        part: 'codex',
        run: () => settingsTimed('codex-status', this.probeCodex()),
        fallback: (error) => ({
          part: this.codexFallback(error),
          auth: { enabled: isEnabled('codex-integration'), authenticated: false, error: errorText(error) || 'Unknown error' },
        }),
        deliver: (value) => {
          const { part, auth } = value as { part: unknown; auth: unknown };
          if (!live()) return;
          // The sign-in first, so ChatGPT's row never shows its part without its account
          this.lastCodexAuth = auth;
          void webview.postMessage({ type: 'codex:authStatus', data: auth }).then(undefined, () => false);
          post('codex', part);
        },
      }),
      environment: () => ({
        // Git's row shows whichever Claude runs (File changes needs Git); Node.js's only with this computer's runtime.
        part: 'environment',
        run: () => settingsTimed('environment', getAgentEnvironmentStatus()),
        fallback: () => null,
        deliver: (value) => post('environment', value),
      }),
      transcriptionStorageBytes: () => ({
        part: 'transcriptionStorageBytes',
        run: () => isEnabled('transcription-workbench')
          ? settingsTimed('transcription-storage', this.transcriptionStorageBytes())
          : Promise.resolve(0),
        fallback: () => 0,
        deliver: (value) => post('transcriptionStorageBytes', value),
      }),
      updateCenter: () => ({
        // The first-ever update check no longer holds the first draw (R10): the snapshot draws, the check fills in
        part: 'updateCenter',
        run: async () => {
          const snapshot = await this.updateService.getStatusSnapshot();
          if (snapshot.lastCheckedAt !== 0) return snapshot;
          return settingsTimed('update-check', this.updateService.checkForUpdates({ manual: false, notify: false }));
        },
        fallback: (error) => ({ ...this.updateFallback(), error: errorText(error) || 'Unknown update status error' }),
        deliver: (value) => post('updateCenter', value),
      }),
    };
    return parts.map((part) => probes[part]());
  }

  /** The voice model's row: whether its file is here, and its size. */
  private voiceModelStatus() {
    // Sprint 129 R13: the 8-bit model on Windows (and Intel Macs).
    const defaultModelFile = voiceModelFile();
    const modelInfo = AVAILABLE_MODELS[defaultModelFile];
    let voiceInstalled = false;
    let sizeBytes = 0;
    try {
      const modelPath = getModelPath(defaultModelFile);
      voiceInstalled = isModelDownloaded(defaultModelFile);
      sizeBytes = voiceInstalled && fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0;
    } catch {
      voiceInstalled = false;
    }
    return {
      installed: voiceInstalled,
      modelName: modelInfo?.name ?? 'large-v3-turbo',
      filename: defaultModelFile,
      managedBy: 'ritemark' as const,
      sizeBytes,
      sizeDisplay: voiceInstalled
        ? this.formatBytes(sizeBytes)
        : (modelInfo?.sizeDisplay ?? 'Unknown'),
    };
  }

  /** Claude's part: its setup status (cached until an event says it changed). */
  private async probeClaude() {
    const anthropicKey = await readProviderKey(this.context.secrets, 'anthropic-api-key');
    setAnthropicKeyAvailable(Boolean(anthropicKey));
    const claudeStatus = await getSetupStatus();
    return {
      installed: claudeStatus.cliInstalled,
      runnable: claudeStatus.runnable,
      authenticated: claudeStatus.authenticated,
      version: claudeStatus.cliVersion ?? null,
      sdkVersion: readClaudeAgentSdkVersion(),
      binaryPath: claudeStatus.binaryPath ?? null,
      authMethod: claudeStatus.authMethod,
      managedBy: 'user' as const,
      state: claudeStatus.state === 'broken-install'
        ? 'broken' as const
        : claudeStatus.state,
      error: claudeStatus.error,
      diagnostics: claudeStatus.diagnostics,
      repairAction: claudeStatus.repairAction,
      runtimeStatus: deriveClaudeRuntimeStatus(claudeStatus),
    };
  }

  private claudeFallback(error: unknown) {
    return {
      installed: false,
      runnable: false,
      authenticated: false,
      version: null,
      sdkVersion: null,
      binaryPath: null,
      authMethod: null,
      managedBy: 'user' as const,
      state: 'broken' as const,
      error: errorText(error) || 'Failed to inspect Claude',
      diagnostics: [],
      repairAction: 'repair' as const,
      runtimeStatus: { runtime: 'launch_failed' as const, source: 'unknown' as const, auth: 'unknown' as const },
    };
  }

  /**
   * ChatGPT's part and its sign-in (`codex:authStatus`) from one look: its binary is read once and its account once
   * per run (both were read twice per open before, in the parts and again for the sign-in).
   */
  private async probeCodex(): Promise<{ part: unknown; auth: unknown }> {
    const codexStatus = await new CodexManager().getBinaryStatus();
    const codexAuth = isEnabled('codex-integration') ? this.codexAuth : null;

    // Resolve Codex auth state independently of the binary inspection. This
    // can fail if the app-server is not reachable; treat any failure as
    // 'unknown' so the UI shows attention required without hiding the runtime.
    let codexAuthState: AuthState = 'unknown';
    let auth: Record<string, unknown>;
    if (!codexAuth) {
      auth = { enabled: false };
    } else if (!codexStatus.available) {
      auth = {
        enabled: true,
        authenticated: false,
        binaryMissing: true,
        error: codexStatus.error ?? 'ChatGPT was not found.',
        diagnostics: codexStatus.diagnostics,
        repairCommand: codexStatus.repairCommand,
      };
    } else if (!codexStatus.runnable) {
      auth = {
        enabled: true,
        authenticated: false,
        binaryBroken: true,
        error: codexStatus.error ?? 'ChatGPT is installed but could not start.',
        diagnostics: codexStatus.diagnostics,
        repairCommand: codexStatus.repairCommand,
      };
    } else {
      try {
        const status = await settingsTimed('codex-auth-status', codexAuth.getStatus());
        codexAuthState = status.authenticated ? 'ready' : 'sign_in_required';
        auth = { enabled: true, authenticated: status.authenticated, authMethod: status.authMethod, email: status.email, plan: status.plan };
      } catch (error) {
        codexAuthState = 'error';
        auth = { enabled: true, authenticated: false, error: errorText(error) || 'Unknown error' };
      }
    }

    const part = {
      installed: codexStatus.available,
      version: codexStatus.version,
      managedBy: 'user' as const,
      state: !codexStatus.available
        ? 'not-installed' as const
        : codexStatus.runnable
          ? 'ready' as const
          : 'broken' as const,
      error: codexStatus.runnable ? null : codexStatus.error,
      diagnostics: codexStatus.diagnostics,
      repairCommand: codexStatus.repairCommand,
      compatibility: codexStatus.compatibility,
      runtimeStatus: deriveCodexRuntimeStatus(
        {
          available: codexStatus.available,
          runnable: codexStatus.runnable,
          runtimeSource: codexStatus.runtimeSource,
          installNodeArch: codexStatus.installNodeArch,
          machineArch: codexStatus.machineArch,
        },
        codexAuthState,
      ),
    };
    return { part, auth };
  }

  private codexFallback(error: unknown) {
    return {
      installed: false,
      version: null,
      managedBy: 'user' as const,
      state: 'broken' as const,
      error: errorText(error) || 'Failed to inspect component status',
      diagnostics: [],
      repairCommand: null,
      compatibility: null,
      runtimeStatus: { runtime: 'launch_failed' as const, source: 'unknown' as const, auth: 'unknown' as const },
    };
  }

  /**
   * Public health status for the Welcome page.
   * Reuses the same data sources as Settings' probes.
   */
  async getHealthStatus(): Promise<{
    codexAvailable: boolean;
    codexAuthenticated: boolean;
    claudeAvailable: boolean;
    claudeAuthenticated: boolean;
    nodeInstalled: boolean;
    /** The Welcome page shows its Node line only when true (patch 017). */
    nodeRequired: boolean;
    nodeVersion: string | null;
    gitInstalled: boolean;
    gitVersion: string | null;
  }> {
    const [claudeStatus, environmentStatus, codexStatus, codexAuthStatus] = await Promise.all([
      getSetupStatus({ refresh: true }),
      getAgentEnvironmentStatus({ refresh: true }),
      new CodexManager().getBinaryStatus(),
      this.codexAuth?.getStatus() ?? Promise.resolve(null),
    ]);

    // Check system dependencies. The Welcome page asks for this at every launch
    // into an empty window, so the version checks run without blocking the
    // extension host; same shell and timeout as the execSync calls they replace.
    let nodeInstalled = environmentStatus.nodeInstalled;
    let gitInstalled = environmentStatus.gitInstalled;
    const [nodeProbe, gitProbe] = await Promise.all([
      runProcess('node', ['--version'], { shell: true, timeout: 5000 }),
      runProcess('git', ['--version'], { shell: true, timeout: 5000 }),
    ]);
    const nodeVersion = nodeProbe.status === 0 ? nodeProbe.stdout.trim() : null;
    const gitVersion = gitProbe.status === 0 ? gitProbe.stdout.trim().replace('git version ', '') : null;

    return {
      codexAvailable: codexStatus.available && codexStatus.runnable,
      codexAuthenticated: codexAuthStatus?.authenticated ?? false,
      claudeAvailable: claudeStatus.runnable,
      claudeAuthenticated: claudeStatus.authenticated,
      nodeInstalled,
      nodeRequired: environmentStatus.nodeRequired,
      nodeVersion,
      gitInstalled,
      gitVersion,
    };
  }

  public async startClaudeLoginFromCommand(): Promise<void> {
    const status = await getSetupStatus({ refresh: true });
    if (!status.runnable || !status.binaryPath || status.state === 'not-installed' || status.state === 'broken-install') {
      vscode.window.showErrorMessage(status.error || 'Claude is not ready yet. Install or repair it first.');
      return;
    }

    const startResult = beginClaudeLogin(status.binaryPath, {
      onUrl: (url) => {
        vscode.window.showInformationMessage(
          'Sign-in opened in your browser. Authorize to finish.',
          'Copy backup link',
        ).then((action) => {
          if (action === 'Copy backup link') void vscode.env.clipboard.writeText(url);
        });
      },
      onError: (message) => vscode.window.showErrorMessage(`Claude sign-in failed: ${message}`),
      onTimeout: () => vscode.window.showWarningMessage('Claude sign-in timed out after 5 minutes. Please try again.'),
    });
    if (startResult === 'already-running') {
      vscode.window.showInformationMessage('Claude sign-in is already open. Finish it in your browser.');
    }
  }

  public async startCodexLoginFromCommand(): Promise<void> {
    if (!this.codexAuth) {
      vscode.window.showErrorMessage('ChatGPT is turned off. Turn it on in Advanced settings.');
      return;
    }

    try {
      emitCodexStatusInvalidated('login-started');
      const login = await this.codexAuth.startLogin();
      await vscode.env.openExternal(vscode.Uri.parse(login.authUrl));
      vscode.window.showInformationMessage('ChatGPT login started. Complete authentication in your browser.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`ChatGPT sign-in failed: ${errorMessage}`);
    }
  }

  private async installClaudeFromSettings(webview: vscode.Webview): Promise<void> {
    emitClaudeStatusInvalidated('install-started');
    const result = await installClaude(() => {});
    await getSetupStatus({ refresh: true });

    if (!result.success) {
      vscode.window.showErrorMessage(result.error || 'Claude install failed.');
    } else if (result.outcome === 'installed_needs_reload') {
      vscode.window.showInformationMessage('Claude was installed. Reload the window to finish setup.');
    } else if (result.outcome === 'installed') {
      vscode.window.showInformationMessage('Claude is installed.');
    }

    emitClaudeStatusInvalidated('install-finished');
    this.queueParts(claudeEventParts());
  }

  private async startClaudeLogin(webview: vscode.Webview): Promise<void> {
    const status = await getSetupStatus({ refresh: true });
    if (!status.runnable || !status.binaryPath || status.state === 'not-installed' || status.state === 'broken-install') {
      vscode.window.showErrorMessage(status.error || 'Claude is not ready yet. Install or repair it first.');
      this.queueParts(claudeEventParts());
      return;
    }

    const startResult = beginClaudeLogin(status.binaryPath, {
      onUrl: (url) => {
        vscode.window.showInformationMessage(
          'Sign-in opened in your browser. Authorize to finish.',
          'Copy backup link'
        ).then((action) => {
          if (action === 'Copy backup link') {
            void vscode.env.clipboard.writeText(url);
          }
        });
      },
      onError: (msg) => {
        vscode.window.showErrorMessage(`Claude sign-in failed: ${msg}`);
      },
      onTimeout: () => {
        vscode.window.showWarningMessage('Claude sign-in timed out after 5 minutes. Please try again.');
      },
    });

    if (startResult === 'already-running') {
      vscode.window.showInformationMessage('Claude sign-in is already open. Finish it in your browser.');
    }

    this.queueParts(claudeEventParts());
  }

  private cancelClaudeLogin(): void {
    const cancelled = cancelActiveClaudeLogin();
    vscode.window.showInformationMessage(cancelled ? 'Sign-in cancelled.' : 'No Claude sign-in is currently open.');
  }

  private async enterAnthropicApiKey(webview: vscode.Webview): Promise<void> {
    const key = await vscode.window.showInputBox({
      prompt: 'Paste your Anthropic API key from console.anthropic.com',
      password: true,
      placeHolder: 'sk-ant-api03-...',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) return 'API key is required';
        if (!value.startsWith('sk-ant-')) return 'API keys start with sk-ant-';
        return null;
      },
    });

    if (!key) {
      this.queueParts(claudeEventParts());
      return;
    }

    await this.context.secrets.store('anthropic-api-key', key);
    setAnthropicKeyAvailable(true);
    emitClaudeStatusInvalidated('settings-updated');
    vscode.window.showInformationMessage('Anthropic API key saved.');
    this.queueBase();
  }

  private async logoutClaudeFromSettings(webview: vscode.Webview): Promise<void> {
    const status = await getSetupStatus({ refresh: true });
    if (status.authMethod !== 'claude-oauth' || !status.binaryPath) {
      vscode.window.showWarningMessage('Claude.ai sign-out is only available when Claude CLI OAuth is active.');
      this.queueParts(claudeEventParts());
      return;
    }

    try {
      await logoutClaude(status.binaryPath);
      setClaudeLoginInProgress(false);
      emitClaudeStatusInvalidated('logout');
      vscode.window.showInformationMessage('Signed out from Claude.ai.');
    } catch (error) {
      vscode.window.showErrorMessage(
        `Claude sign-out failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.queueParts(claudeEventParts());
  }

  private stopClaudeLoginPolling(): void {
    if (this.claudeLoginPoll) {
      clearInterval(this.claudeLoginPoll);
      this.claudeLoginPoll = null;
    }
  }

  private startClaudeLoginPolling(): void {
    this.stopClaudeLoginPolling();

    let attempts = 0;
    this.claudeLoginPoll = setInterval(() => {
      attempts += 1;
      void (async () => {
        const status = await getSetupStatus({ refresh: true });
        const panel = RitemarkSettingsProvider.panel;
        if (panel) {
          this.queueParts(['claudeCode']);
        }

        if (status.state === 'ready') {
          setClaudeLoginInProgress(false);
          this.stopClaudeLoginPolling();
          emitClaudeStatusInvalidated('login-finished');
          return;
        }

        if (attempts >= 60) {
          setClaudeLoginInProgress(false);
          this.stopClaudeLoginPolling();
          if (panel) {
            this.queueParts(['claudeCode']);
          }
        }
      })();
    }, 2000);
  }

  /**
   * Test OpenAI API key
   */
  private async testOpenAIKey(webview: vscode.Webview): Promise<void> {
    const key = await readProviderKey(this.context.secrets, 'openai-api-key');
    if (!key) {
      webview.postMessage({ type: 'testResult', key: 'openai', success: false, error: 'No API key configured' });
      return;
    }

    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: key });

      // Simple test - list models
      await openai.models.list();

      webview.postMessage({ type: 'testResult', key: 'openai', success: true });
    } catch (err) {
      webview.postMessage({
        type: 'testResult',
        key: 'openai',
        success: false,
        error: redactTestKey(err instanceof Error ? err.message : 'Unknown error', 'openai-api-key')
      });
    }
  }

  /**
   * Test Google AI API key
   */
  private async testGoogleAIKey(webview: vscode.Webview): Promise<void> {
    const key = await readProviderKey(this.context.secrets, 'google-ai-key');
    if (!key) {
      webview.postMessage({ type: 'testResult', key: 'google', success: false, error: 'No API key configured' });
      return;
    }

    try {
      // Test by listing models via Google AI API. Sprint 141 R12 (#558): the key
      // goes in the x-goog-api-key header, never in the URL.
      const response = await fetch(geminiUrl('v1', 'models', { pageSize: '1' }), { headers: geminiHeaders(key) });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      webview.postMessage({ type: 'testResult', key: 'google', success: true, message: 'API key is valid' });
    } catch (err) {
      webview.postMessage({
        type: 'testResult',
        key: 'google',
        success: false,
        error: redactTestKey(err instanceof Error ? err.message : 'Unknown error', 'google-ai-key')
      });
    }
  }

  /**
   * Test Anthropic API key
   */
  private async testAnthropicKey(webview: vscode.Webview): Promise<void> {
    const key = await readProviderKey(this.context.secrets, 'anthropic-api-key');
    if (!key) {
      webview.postMessage({ type: 'testResult', key: 'anthropic', success: false, error: 'No API key configured' });
      return;
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL_IDS.HAIKU_4_5,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      webview.postMessage({ type: 'testResult', key: 'anthropic', success: true, message: 'API key is valid' });
    } catch (err) {
      webview.postMessage({
        type: 'testResult',
        key: 'anthropic',
        success: false,
        error: redactTestKey(err instanceof Error ? err.message : 'Unknown error', 'anthropic-api-key'),
      });
    }
  }

  /**
   * Sprint 76 R3a (Q-UX4): test OpenRouter API key. Hits the lightweight
   * /api/v1/key endpoint (no token spend) — same card pattern as the other
   * provider keys.
   */
  /**
   * Sprint 108 R4 — validate the ElevenLabs key before a long upload. It asks the endpoint transcription uses,
   * with no audio, so nothing is charged (`keyTestResult`). It used `/v1/user`, which a restricted key that may
   * transcribe cannot read: Microsoft's certification of 2.0.0 got "rejected" for a working key.
   */
  private async testElevenLabsKey(webview: vscode.Webview): Promise<void> {
    const key = await readProviderKey(this.context.secrets, 'elevenlabs-api-key');
    if (!key) {
      webview.postMessage({ type: 'testResult', key: 'elevenlabs', success: false, error: 'No API key configured' });
      return;
    }

    try {
      const form = new FormData();
      form.append('model_id', ELEVENLABS_STT_MODEL_IDS.SCRIBE_V2);
      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': key },
        body: form,
      });
      const body = await response.text();
      const result = keyTestResult(response.status, body);
      // What ElevenLabs answered, for support and QA: the status and its reason token, never the key or a message
      const answered = { httpStatus: response.status, apiStatus: extractApiStatus(body) ?? null };
      if (!result.ok) {
        webview.postMessage({ type: 'testResult', key: 'elevenlabs', success: false, error: result.error, answered });
        return;
      }

      webview.postMessage({ type: 'testResult', key: 'elevenlabs', success: true, message: 'API key is valid', answered });
    } catch (err) {
      webview.postMessage({
        type: 'testResult',
        key: 'elevenlabs',
        success: false,
        error: redactTestKey(err instanceof Error ? err.message : 'Unknown error', 'elevenlabs-api-key'),
      });
    }
  }

  /** Sprint 108 R12 — bytes held by stored transcripts, for the Settings row. */
  private async transcriptionStorageBytes(): Promise<number> {
    try {
      const store = new SessionStore(sessionStoreDir(this.context.globalStorageUri.fsPath));
      return await store.sizeBytes();
    } catch {
      return 0;
    }
  }

  /**
   * Sprint 108 R12 — delete stored transcripts.
   *
   * Confirmed first, because sessions hold the user's speaker renames and
   * corrections (D5). Recordings and exported markdown are never touched.
   */
  private async clearTranscriptionStorage(webview: vscode.Webview): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'Delete all stored transcripts?',
      {
        modal: true,
        detail:
          'Speaker names, corrections and insights stored with your transcripts will be removed. Your recordings and any documents you saved are not affected.',
      },
      'Delete transcripts'
    );
    if (confirm !== 'Delete transcripts') return;

    try {
      const store = new SessionStore(sessionStoreDir(this.context.globalStorageUri.fsPath));
      await store.clear();
      vscode.window.showInformationMessage('Stored transcripts deleted.');
    } catch (err) {
      vscode.window.showErrorMessage(
        `Could not delete stored transcripts: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
    this.queueParts(['transcriptionStorageBytes']);
  }

  private async testOpenRouterKey(webview: vscode.Webview): Promise<void> {
    const key = await readProviderKey(this.context.secrets, 'openrouter-api-key');
    if (!key) {
      webview.postMessage({ type: 'testResult', key: 'openrouter', success: false, error: 'No API key configured' });
      return;
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/key', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      webview.postMessage({ type: 'testResult', key: 'openrouter', success: true, message: 'API key is valid' });
    } catch (err) {
      webview.postMessage({
        type: 'testResult',
        key: 'openrouter',
        success: false,
        error: redactTestKey(err instanceof Error ? err.message : 'Unknown error', 'openrouter-api-key'),
      });
    }
  }

  /**
   * Get HTML content for the webview
   */
  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} data:;">
  <title>Settings</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body, #root {
      height: 100%;
      width: 100%;
      overflow: auto;
    }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
  </style>
</head>
<body>
  <div id="root" data-editor-type="settings"${settingsTimingEnabled() ? ' data-settings-timing="1"' : ''}></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Start Codex ChatGPT OAuth login
   */
  private async startCodexLogin(webview: vscode.Webview): Promise<void> {
    if (!this.codexAuth) {
      webview.postMessage({
        type: 'codex:authStatus',
        data: { enabled: false, error: 'ChatGPT is turned off' },
      });
      return;
    }

    try {
      // Notify UI that login is starting
      webview.postMessage({
        type: 'codex:loginStarting',
      });
      emitCodexStatusInvalidated('login-started');

      // Start OAuth flow and open the returned authorization URL.
      const login = await this.codexAuth.startLogin();
      await vscode.env.openExternal(vscode.Uri.parse(login.authUrl));

      // OAuth is async - status will be updated via 'statusChanged' event
      vscode.window.showInformationMessage(
        'ChatGPT login started. Complete authentication in your browser.'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webview.postMessage({
        type: 'codex:authStatus',
        data: {
          enabled: true,
          authenticated: false,
          error: errorMessage,
        },
      });
      vscode.window.showErrorMessage(`ChatGPT sign-in failed: ${errorMessage}`);
    }
  }

  /**
   * Logout from Codex
   */
  private async codexLogout(webview: vscode.Webview): Promise<void> {
    if (!this.codexAuth) {
      return;
    }

    try {
      await this.codexAuth.logout();
      emitCodexStatusInvalidated('logout');
      vscode.window.showInformationMessage('Signed out from ChatGPT');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Logout failed: ${errorMessage}`);
    }
  }

  private async openCodexRepairTerminal(): Promise<void> {
    const codexManager = new CodexManager();
    const status = await codexManager.getBinaryStatus();
    if (!status.repairCommand) {
      vscode.window.showInformationMessage(BUNDLED_CODEX_REPAIR_MESSAGE);
      return;
    }

    const terminal = vscode.window.createTerminal({
      name: 'Repair ChatGPT',
      shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
    });

    terminal.show();
    terminal.sendText(status.repairCommand);
    emitCodexStatusInvalidated('repair-started');

    vscode.window.showInformationMessage(
      "Opened ChatGPT's repair in a terminal. When it finishes, reload the window and reopen Settings."
    );
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    for (const listener of this.followListeners) listener.dispose();
    this.clearQueue();
    this.codexAppServer?.dispose();
    this.codexAuth?.removeAllListeners();
    this.codexAuth = null;
    this.codexAppServer = null;
    this.disposeClaudeStatusListener?.();
    this.disposeClaudeStatusListener = null;
    this.disposeCodexStatusListener?.();
    this.disposeCodexStatusListener = null;
    RitemarkSettingsProvider.panel?.dispose();
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private formatBytes(bytes: number): string {
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
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : '';
}
