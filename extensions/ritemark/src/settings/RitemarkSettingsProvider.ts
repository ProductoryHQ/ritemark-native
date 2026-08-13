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
import { AVAILABLE_MODELS, getModelPath, isModelDownloaded } from '../voiceDictation/modelManager';
import { SessionStore } from '../speech/SessionStore';
import { sessionStoreDir } from '../speech/paths';
import {
  getAgentEnvironmentStatus,
  getSetupStatus,
  installClaude,
  openClaudeLoginTerminal,
  logoutClaude,
  emitClaudeStatusInvalidated,
  onClaudeStatusInvalidated,
  setAnthropicKeyAvailable,
  setClaudeLoginInProgress,
  startClaudeLoginSubprocess,
  type ClaudeLoginSubprocessHandle,
  type SetupStatus,
} from '../agent';
import { CodexManager, type CodexCompatibilityStatus } from '../codex/codexManager';

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
    description: 'Slate editor surface with restrained indigo accents',
    kind: 'dark' as const,
  },
];

export class RitemarkSettingsProvider implements vscode.WebviewPanelSerializer {
  public static readonly viewType = 'ritemark.settings';

  private static panel: vscode.WebviewPanel | undefined;
  private codexAppServer: CodexAppServer | null = null;
  private codexAuth: CodexAuth | null = null;
  private disposeClaudeStatusListener: (() => void) | null = null;
  private disposeCodexStatusListener: (() => void) | null = null;
  private claudeLoginPoll: ReturnType<typeof setInterval> | null = null;
  private claudeLoginSubprocess: ClaudeLoginSubprocessHandle | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly updateService: UpdateService
  ) {
    // Initialize Codex integration if feature is enabled
    if (isEnabled('codex-integration')) {
      this.codexAppServer = new CodexAppServer();
      this.codexAuth = new CodexAuth(this.codexAppServer);

      // Listen for auth status changes and update webview
      this.codexAuth.on('statusChanged', (status) => {
        if (RitemarkSettingsProvider.panel) {
          this.sendCodexAuthStatus(RitemarkSettingsProvider.panel.webview);
        }
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
      } else if (event.reason === 'login-finished' || event.reason === 'install-finished' || event.reason === 'settings-updated') {
        this.stopClaudeLoginPolling();
      }
      const panel = RitemarkSettingsProvider.panel;
      if (panel) {
        void this.sendCurrentSettings(panel.webview);
      }
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
          this.codexAuth.on('statusChanged', (_status) => {
            if (RitemarkSettingsProvider.panel) {
              void this.sendCodexAuthStatus(RitemarkSettingsProvider.panel.webview);
            }
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
      const panel = RitemarkSettingsProvider.panel;
      if (panel) {
        void this.sendCodexAuthStatus(panel.webview);
        void this.sendCurrentSettings(panel.webview);
      }
    });
  }

  /**
   * Open the settings panel (singleton)
   */
  public async open(): Promise<void> {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel exists, reveal it
    if (RitemarkSettingsProvider.panel) {
      RitemarkSettingsProvider.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      RitemarkSettingsProvider.viewType,
      'Ritemark Settings',
      column || vscode.ViewColumn.One,
      this.getWebviewOptions()
    );

    await this.resolvePanel(panel);
  }

  public async deserializeWebviewPanel(panel: vscode.WebviewPanel): Promise<void> {
    await this.resolvePanel(panel);
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(
    message: { type: string; key?: string; value?: unknown; url?: unknown },
    webview: vscode.Webview
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('ritemark');

    switch (message.type) {
      case 'ready':
        await this.sendCurrentSettings(webview);
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
        // Update VS Code setting
        if (message.key && message.value !== undefined) {
          await config.update(message.key, message.value, vscode.ConfigurationTarget.Global);
          // Changing the runtime preference invalidates Claude/Codex resolver state
          // (which binary is selected, source chip readout, capabilities). Force a
          // refresh so the Settings page reflects the active choice immediately.
          if (message.key === 'agentRuntime.preference') {
            emitClaudeStatusInvalidated('settings-updated');
            emitCodexStatusInvalidated('status-refresh');
          }
          // Send updated settings back
          await this.sendCurrentSettings(webview);
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
          await this.sendCurrentSettings(webview);
        }
        break;

      case 'setApiKey':
        // Sprint 76 R3a/R7: the OpenRouter key handler is inert while the
        // opencode-integration flag is off (the card is hidden too). All other
        // provider keys are unaffected.
        if (message.key === 'openrouter-api-key' && !isEnabled('opencode-integration')) {
          break;
        }
        // Store API key in SecretStorage. Generic on `message.key`, so the new
        // 'openrouter-api-key' (Sprint 76 R3a) saves/clears with no extra branch.
        if (message.key && typeof message.value === 'string') {
          if (message.value.trim()) {
            await this.context.secrets.store(message.key, message.value.trim());
          } else {
            await this.context.secrets.delete(message.key);
          }
          if (message.key === 'anthropic-api-key') {
            setAnthropicKeyAvailable(Boolean(message.value.trim()));
            emitClaudeStatusInvalidated('settings-updated');
          }
          // Send updated settings back
          await this.sendCurrentSettings(webview);

          // Show confirmation
          vscode.window.showInformationMessage(
            message.value.trim()
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
        await this.sendCurrentSettings(webview);
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
        emitClaudeStatusInvalidated('status-refresh');
        await this.sendCurrentSettings(webview);
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
        await this.sendCodexAuthStatus(webview);
        break;

      case 'codex:cancelLogin':
        emitCodexStatusInvalidated('logout');
        await this.sendCodexAuthStatus(webview);
        vscode.window.showInformationMessage(
          'ChatGPT sign-in cancelled. If a browser tab is still open, you can close it.'
        );
        break;

      case 'codex:repair':
        await this.openCodexRepairTerminal();
        await this.sendCurrentSettings(webview);
        break;

      case 'updates:checkNow':
        await this.updateService.checkForUpdates({ manual: true, notify: false });
        await this.sendCurrentSettings(webview);
        break;

      case 'updates:install':
        await this.updateService.installResolvedUpdate();
        await this.sendCurrentSettings(webview);
        break;

      case 'updates:skipVersion':
        await this.updateService.skipResolvedUpdate();
        await this.sendCurrentSettings(webview);
        break;

      case 'updates:pause':
        await this.updateService.pauseNotifications();
        await this.sendCurrentSettings(webview);
        break;

      case 'updates:resume':
        await this.updateService.resumeNotifications();
        await this.sendCurrentSettings(webview);
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

  private async resolvePanel(panel: vscode.WebviewPanel): Promise<void> {
    RitemarkSettingsProvider.panel = panel;
    panel.title = 'Ritemark Settings';
    panel.webview.options = this.getWebviewOptions();
    panel.webview.html = await this.getHtmlContent(panel.webview);

    panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message, panel.webview);
      },
      undefined,
      this.context.subscriptions
    );

    panel.onDidDispose(() => {
      if (RitemarkSettingsProvider.panel === panel) {
        RitemarkSettingsProvider.panel = undefined;
      }
      this.stopClaudeLoginPolling();
    });

    await this.sendCurrentSettings(panel.webview);
  }

  /**
   * Send current settings to webview
   */
  private async sendCurrentSettings(webview: vscode.Webview): Promise<void> {
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

    // Get API keys (masked)
    // SecretStorage key names (single source for BYOK / Sprint 76 R3a):
    //   'openai-api-key', 'google-ai-key', 'anthropic-api-key', and the new
    //   'openrouter-api-key'. These same values power the OpenCode runtime —
    //   no separate key store (spec R3a: configure each provider once).
    const openaiKey = await this.context.secrets.get('openai-api-key');
    const googleKey = await this.context.secrets.get('google-ai-key');
    const anthropicKey = await this.context.secrets.get('anthropic-api-key');
    // Sprint 76 R3a: OpenRouter card is only surfaced when opencode-integration
    // is on. When off the key handlers are inert (R7 gating).
    const openrouterEnabled = isEnabled('opencode-integration');
    const openrouterKey = openrouterEnabled
      ? await this.context.secrets.get('openrouter-api-key')
      : undefined;
    // Sprint 108 R4: 'elevenlabs-api-key' joins the same SecretStorage list.
    // Gated on the transcription flag so the card disappears with the feature.
    const transcriptionEnabled = isEnabled('transcription-workbench');
    const elevenlabsKey = transcriptionEnabled
      ? await this.context.secrets.get('elevenlabs-api-key')
      : undefined;
    const transcriptionStorageBytes = transcriptionEnabled ? await this.transcriptionStorageBytes() : 0;

    const initialUpdateSnapshot = await this.updateService.getStatusSnapshot();
    const updateCenterPromise = initialUpdateSnapshot.lastCheckedAt === 0
      ? this.updateService.checkForUpdates({ manual: false, notify: false })
      : Promise.resolve(initialUpdateSnapshot);

    const [updateCenterResult, componentStatusResult] = await Promise.allSettled([
      updateCenterPromise,
      this.getComponentStatus()
    ]);

    const updateCenter = updateCenterResult.status === 'fulfilled'
      ? updateCenterResult.value
      : {
          ...initialUpdateSnapshot,
          state: 'error' as const,
          error: updateCenterResult.reason instanceof Error
            ? updateCenterResult.reason.message
            : 'Unknown update status error',
        };

    const componentStatus = componentStatusResult.status === 'fulfilled'
      ? componentStatusResult.value
      : {
          voiceModel: {
            installed: false,
            modelName: 'large-v3-turbo',
            filename: 'ggml-large-v3-turbo.bin',
            managedBy: 'ritemark' as const,
            sizeBytes: 0,
            sizeDisplay: 'Unknown',
          },
          claudeCode: {
            installed: false,
            runnable: false,
            authenticated: false,
            version: null,
            sdkVersion: null,
            binaryPath: null,
            authMethod: null,
            managedBy: 'user' as const,
            state: 'not-installed' as const,
            error: null,
            diagnostics: [],
            repairAction: 'install' as const,
          },
          codex: {
            installed: false,
            version: null,
            managedBy: 'user' as const,
            state: 'broken' as const,
            error: componentStatusResult.reason instanceof Error
              ? componentStatusResult.reason.message
              : 'Failed to inspect component status',
            diagnostics: [],
            repairCommand: null,
            compatibility: null,
          },
        };

    webview.postMessage({
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

        // API Keys (masked for display, full for input)
        openaiKey: openaiKey || '',
        openaiKeyConfigured: !!openaiKey,
        googleKey: googleKey || '',
        googleKeyConfigured: !!googleKey,
        anthropicKey: anthropicKey || '',
        anthropicKeyConfigured: !!anthropicKey,
        // Sprint 76 R3a: OpenCode flag-gating. `opencodeEnabled` tells the
        // Settings webview whether the "Used for:" lines mention OpenCode.
        // `openrouterEnabled` tells it whether to render the OpenRouter card.
        opencodeEnabled: openrouterEnabled,
        openrouterEnabled,
        openrouterKey: openrouterKey || '',
        openrouterKeyConfigured: !!openrouterKey,
        // Sprint 108 R4/R12: the ElevenLabs card and the transcription-data row
        // both disappear when the feature flag is off.
        transcriptionEnabled,
        elevenlabsKey: elevenlabsKey || '',
        elevenlabsKeyConfigured: !!elevenlabsKey,
        transcriptionStorageBytes,

        // Update-adjacent components
        componentStatus,
      },
    });

    // Also send Codex auth status
    void this.sendCodexAuthStatus(webview);
  }

  private async getComponentStatus(): Promise<{
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
      compatibility: CodexCompatibilityStatus | null;
      runtimeStatus: RuntimeStatusModel;
    };
  }> {
    const defaultModelFile = 'ggml-large-v3-turbo.bin';
    const modelInfo = AVAILABLE_MODELS[defaultModelFile];
    const modelPath = getModelPath(defaultModelFile);
    const voiceInstalled = isModelDownloaded(defaultModelFile);
    const sizeBytes = voiceInstalled && fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0;

    const anthropicKey = await this.context.secrets.get('anthropic-api-key');
    setAnthropicKeyAvailable(Boolean(anthropicKey));
    const claudeStatus = await getSetupStatus();

    const codexManager = new CodexManager();
    const codexStatus = await codexManager.getBinaryStatus();

    // Resolve Codex auth state independently of the binary inspection. This
    // can fail if the app-server is not reachable; treat any failure as
    // 'unknown' so the UI shows attention required without hiding the runtime.
    let codexAuthState: AuthState = 'unknown';
    if (codexStatus.runnable && this.codexAuth) {
      try {
        const authStatus = await this.codexAuth.getStatus();
        codexAuthState = authStatus.authenticated ? 'ready' : 'sign_in_required';
      } catch {
        codexAuthState = 'error';
      }
    }

    const claudeRuntimeStatus = deriveClaudeRuntimeStatus(claudeStatus);
    const codexRuntimeStatus = deriveCodexRuntimeStatus(
      {
        available: codexStatus.available,
        runnable: codexStatus.runnable,
        runtimeSource: codexStatus.runtimeSource,
        installNodeArch: codexStatus.installNodeArch,
        machineArch: codexStatus.machineArch,
      },
      codexAuthState,
    );

    return {
      voiceModel: {
        installed: voiceInstalled,
        modelName: modelInfo?.name ?? 'large-v3-turbo',
        filename: defaultModelFile,
        managedBy: 'ritemark',
        sizeBytes,
        sizeDisplay: voiceInstalled
          ? this.formatBytes(sizeBytes)
          : (modelInfo?.sizeDisplay ?? 'Unknown')
      },
      claudeCode: {
        installed: claudeStatus.cliInstalled,
        runnable: claudeStatus.runnable,
        authenticated: claudeStatus.authenticated,
        version: claudeStatus.cliVersion ?? null,
        sdkVersion: readClaudeAgentSdkVersion(),
        binaryPath: claudeStatus.binaryPath ?? null,
        authMethod: claudeStatus.authMethod,
        managedBy: 'user',
        state: claudeStatus.state === 'broken-install'
          ? 'broken'
          : claudeStatus.state,
        error: claudeStatus.error,
        diagnostics: claudeStatus.diagnostics,
        repairAction: claudeStatus.repairAction,
        runtimeStatus: claudeRuntimeStatus,
      },
      codex: {
        installed: codexStatus.available,
        version: codexStatus.version,
        managedBy: 'user',
        state: !codexStatus.available
          ? 'not-installed'
          : codexStatus.runnable
            ? 'ready'
            : 'broken',
        error: codexStatus.runnable ? null : codexStatus.error,
        diagnostics: codexStatus.diagnostics,
        repairCommand: codexStatus.repairCommand,
        compatibility: codexStatus.compatibility,
        runtimeStatus: codexRuntimeStatus,
      }
    };
  }

  /**
   * Public health status for the Welcome page.
   * Reuses the same data sources as sendCurrentSettings().
   */
  async getHealthStatus(): Promise<{
    codexAvailable: boolean;
    codexAuthenticated: boolean;
    claudeAvailable: boolean;
    claudeAuthenticated: boolean;
    nodeInstalled: boolean;
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

    // Check system dependencies
    const { execSync } = require('child_process');
    let nodeInstalled = environmentStatus.nodeInstalled;
    let nodeVersion: string | null = null;
    let gitInstalled = environmentStatus.gitInstalled;
    let gitVersion: string | null = null;

    try {
      nodeVersion = execSync('node --version', { timeout: 5000 }).toString().trim();
    } catch { /* not installed */ }

    try {
      gitVersion = execSync('git --version', { timeout: 5000 }).toString().trim().replace('git version ', '');
    } catch { /* not installed */ }

    return {
      codexAvailable: codexStatus.available && codexStatus.runnable,
      codexAuthenticated: codexAuthStatus?.authenticated ?? false,
      claudeAvailable: claudeStatus.runnable,
      claudeAuthenticated: claudeStatus.authenticated,
      nodeInstalled,
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

    setClaudeLoginInProgress(true);
    emitClaudeStatusInvalidated('login-started');
    this.startClaudeLoginPolling();
    openClaudeLoginTerminal(status.binaryPath);
    vscode.window.showInformationMessage('Finish Claude.ai sign-in in the terminal and browser. Ritemark will refresh automatically.');
  }

  public async startCodexLoginFromCommand(): Promise<void> {
    if (!this.codexAuth) {
      vscode.window.showErrorMessage('Codex integration not enabled.');
      return;
    }

    try {
      emitCodexStatusInvalidated('login-started');
      const login = await this.codexAuth.startLogin();
      await vscode.env.openExternal(vscode.Uri.parse(login.authUrl));
      vscode.window.showInformationMessage('ChatGPT login started. Complete authentication in your browser.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Codex login failed: ${errorMessage}`);
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
    await this.sendCurrentSettings(webview);
  }

  private async startClaudeLogin(webview: vscode.Webview): Promise<void> {
    const status = await getSetupStatus({ refresh: true });
    if (!status.runnable || !status.binaryPath || status.state === 'not-installed' || status.state === 'broken-install') {
      vscode.window.showErrorMessage(status.error || 'Claude is not ready yet. Install or repair it first.');
      await this.sendCurrentSettings(webview);
      return;
    }

    if (this.claudeLoginSubprocess) {
      this.claudeLoginSubprocess.kill();
      this.claudeLoginSubprocess = null;
    }

    setClaudeLoginInProgress(true);
    emitClaudeStatusInvalidated('login-started');
    this.startClaudeLoginPolling();

    this.claudeLoginSubprocess = startClaudeLoginSubprocess(status.binaryPath, {
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
      onComplete: () => {
        this.claudeLoginSubprocess = null;
        setClaudeLoginInProgress(false);
        emitClaudeStatusInvalidated('login-finished');
      },
      onError: (msg) => {
        this.claudeLoginSubprocess = null;
        setClaudeLoginInProgress(false);
        emitClaudeStatusInvalidated('settings-updated');
        vscode.window.showErrorMessage(`Claude sign-in failed: ${msg}`);
      },
      onTimeout: () => {
        this.claudeLoginSubprocess = null;
        setClaudeLoginInProgress(false);
        emitClaudeStatusInvalidated('settings-updated');
        vscode.window.showWarningMessage('Claude sign-in timed out after 5 minutes. Please try again.');
      },
    });

    await this.sendCurrentSettings(webview);
  }

  private cancelClaudeLogin(): void {
    if (this.claudeLoginSubprocess) {
      this.claudeLoginSubprocess.kill();
      this.claudeLoginSubprocess = null;
    }
    setClaudeLoginInProgress(false);
    emitClaudeStatusInvalidated('settings-updated');
    vscode.window.showInformationMessage('Sign-in cancelled.');
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
      await this.sendCurrentSettings(webview);
      return;
    }

    await this.context.secrets.store('anthropic-api-key', key);
    setAnthropicKeyAvailable(true);
    emitClaudeStatusInvalidated('settings-updated');
    vscode.window.showInformationMessage('Anthropic API key saved.');
    await this.sendCurrentSettings(webview);
  }

  private async logoutClaudeFromSettings(webview: vscode.Webview): Promise<void> {
    const status = await getSetupStatus({ refresh: true });
    if (status.authMethod !== 'claude-oauth' || !status.binaryPath) {
      vscode.window.showWarningMessage('Claude.ai sign-out is only available when Claude CLI OAuth is active.');
      await this.sendCurrentSettings(webview);
      return;
    }

    try {
      await logoutClaude(status.binaryPath);
      setClaudeLoginInProgress(false);
      emitClaudeStatusInvalidated('settings-updated');
      vscode.window.showInformationMessage('Signed out from Claude.ai.');
    } catch (error) {
      vscode.window.showErrorMessage(
        `Claude sign-out failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    await this.sendCurrentSettings(webview);
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
          await this.sendCurrentSettings(panel.webview);
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
            await this.sendCurrentSettings(panel.webview);
          }
        }
      })();
    }, 2000);
  }

  /**
   * Test OpenAI API key
   */
  private async testOpenAIKey(webview: vscode.Webview): Promise<void> {
    const key = await this.context.secrets.get('openai-api-key');
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
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * Test Google AI API key
   */
  private async testGoogleAIKey(webview: vscode.Webview): Promise<void> {
    const key = await this.context.secrets.get('google-ai-key');
    if (!key) {
      webview.postMessage({ type: 'testResult', key: 'google', success: false, error: 'No API key configured' });
      return;
    }

    try {
      // Test by listing models via Google AI API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${key}`
      );

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
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * Test Anthropic API key
   */
  private async testAnthropicKey(webview: vscode.Webview): Promise<void> {
    const key = await this.context.secrets.get('anthropic-api-key');
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
          model: 'claude-haiku-4-5-20251001',
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
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Sprint 76 R3a (Q-UX4): test OpenRouter API key. Hits the lightweight
   * /api/v1/key endpoint (no token spend) — same card pattern as the other
   * provider keys.
   */
  /**
   * Sprint 108 R4 — validate the ElevenLabs key against a cheap authenticated
   * endpoint. `/v1/user` returns the account, costs nothing, and needs no audio.
   */
  private async testElevenLabsKey(webview: vscode.Webview): Promise<void> {
    const key = await this.context.secrets.get('elevenlabs-api-key');
    if (!key) {
      webview.postMessage({ type: 'testResult', key: 'elevenlabs', success: false, error: 'No API key configured' });
      return;
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: { 'xi-api-key': key },
      });

      if (!response.ok) {
        // 401 is the case that matters, and "rejected the key" is more useful
        // to the reader than the status line.
        throw new Error(
          response.status === 401
            ? 'ElevenLabs rejected this key'
            : `ElevenLabs returned an error (${response.status})`
        );
      }

      webview.postMessage({ type: 'testResult', key: 'elevenlabs', success: true, message: 'API key is valid' });
    } catch (err) {
      webview.postMessage({
        type: 'testResult',
        key: 'elevenlabs',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
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
          'Speaker names, corrections and insights stored with your transcripts will be removed. Your recordings and any exported Markdown files are not affected.',
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
    await this.sendCurrentSettings(webview);
  }

  private async testOpenRouterKey(webview: vscode.Webview): Promise<void> {
    const key = await this.context.secrets.get('openrouter-api-key');
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
        error: err instanceof Error ? err.message : 'Unknown error',
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} data:; connect-src https://api.openai.com https://api.anthropic.com;">
  <title>Ritemark Settings</title>
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
  <div id="root" data-editor-type="settings"></div>
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
        data: { enabled: false, error: 'Codex integration not enabled' },
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
      vscode.window.showErrorMessage(`Codex login failed: ${errorMessage}`);
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
      await this.sendCodexAuthStatus(webview);
      vscode.window.showInformationMessage('Signed out from ChatGPT');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Logout failed: ${errorMessage}`);
    }
  }

  private async openCodexRepairTerminal(): Promise<void> {
    const codexManager = new CodexManager();
    const status = await codexManager.getBinaryStatus();
    const command = status.repairCommand ?? 'npm install -g @openai/codex@latest';

    const terminal = vscode.window.createTerminal({
      name: 'Codex Repair',
      shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
    });

    terminal.show();
    terminal.sendText(command);
    emitCodexStatusInvalidated('repair-started');

    vscode.window.showInformationMessage(
      'Opened Codex repair in terminal. After it finishes, reload the window and reopen Settings.'
    );
  }

  /**
   * Send Codex auth status to webview
   */
  private async sendCodexAuthStatus(webview: vscode.Webview): Promise<void> {
    // Check if feature is enabled
    if (!isEnabled('codex-integration') || !this.codexAuth) {
      webview.postMessage({
        type: 'codex:authStatus',
        data: { enabled: false },
      });
      return;
    }

    // Pre-flight: check if codex binary is installed
    const codexManager = this.codexAppServer
      ? new (await import('../codex/codexManager')).CodexManager()
      : null;
    const binaryStatus = codexManager
      ? await codexManager.getBinaryStatus()
      : {
          available: false,
          runnable: false,
          version: null,
          error: null,
          binaryPath: null,
          installNodeVersion: null,
          runtimeNodeVersion: process.version.replace(/^v/, ''),
          diagnostics: [],
          repairCommand: null,
          installNodeArch: null,
          runtimeNodeArch: process.arch,
          machineArch: process.arch,
        };

    if (!binaryStatus.available) {
      webview.postMessage({
        type: 'codex:authStatus',
        data: {
          enabled: true,
          authenticated: false,
          binaryMissing: true,
          error: 'Codex CLI not found. Install with: npm install -g @openai/codex',
          diagnostics: binaryStatus.diagnostics,
          repairCommand: binaryStatus.repairCommand,
        },
      });
      return;
    }

    if (!binaryStatus.runnable) {
      webview.postMessage({
        type: 'codex:authStatus',
        data: {
          enabled: true,
          authenticated: false,
          binaryBroken: true,
          error: binaryStatus.error ?? 'Codex CLI is installed but could not be started.',
          diagnostics: binaryStatus.diagnostics,
          repairCommand: binaryStatus.repairCommand,
        },
      });
      return;
    }

    try {
      const status = await this.codexAuth.getStatus();
      webview.postMessage({
        type: 'codex:authStatus',
        data: {
          enabled: true,
          authenticated: status.authenticated,
          authMethod: status.authMethod,
          email: status.email,
          plan: status.plan,
        },
      });
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
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
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
