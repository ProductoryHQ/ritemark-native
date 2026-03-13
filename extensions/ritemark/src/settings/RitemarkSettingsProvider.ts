/**
 * Ritemark Settings Provider
 *
 * Branded settings page for Ritemark configuration.
 * Reads/writes VS Code settings and manages API keys in SecretStorage.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { getAssistantModels, DEFAULT_MODELS } from '../ai/modelConfig';
import { isEnabled } from '../features/featureGate';
import { CodexAppServer, CodexAuth, emitCodexStatusInvalidated } from '../codex';
import { UpdateService } from '../update';
import { AVAILABLE_MODELS, getModelPath, isModelDownloaded } from '../voiceDictation/modelManager';
import {
  getSetupStatus,
  installClaude,
  openClaudeLoginTerminal,
  logoutClaude,
  emitClaudeStatusInvalidated,
  onClaudeStatusInvalidated,
  setAnthropicKeyAvailable,
  setClaudeLoginInProgress,
} from '../agent';
import { CodexManager } from '../codex/codexManager';

export class RitemarkSettingsProvider implements vscode.WebviewPanelSerializer {
  public static readonly viewType = 'ritemark.settings';

  private static panel: vscode.WebviewPanel | undefined;
  private codexAppServer: CodexAppServer | null = null;
  private codexAuth: CodexAuth | null = null;
  private disposeClaudeStatusListener: (() => void) | null = null;
  private claudeLoginPoll: ReturnType<typeof setInterval> | null = null;

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
    message: { type: string; key?: string; value?: unknown },
    webview: vscode.Webview
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('ritemark');

    switch (message.type) {
      case 'ready':
        await this.sendCurrentSettings(webview);
        break;

      case 'setSetting':
        // Update VS Code setting
        if (message.key && message.value !== undefined) {
          await config.update(message.key, message.value, vscode.ConfigurationTarget.Global);
          // Send updated settings back
          await this.sendCurrentSettings(webview);
        }
        break;

      case 'setApiKey':
        // Store API key in SecretStorage
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
        }
        break;

      case 'claude:install':
      case 'claude:repair':
        await this.installClaudeFromSettings(webview);
        break;

      case 'claude:login':
        await this.startClaudeLogin(webview);
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

    // Get API keys (masked)
    const openaiKey = await this.context.secrets.get('openai-api-key');
    const googleKey = await this.context.secrets.get('google-ai-key');
    const anthropicKey = await this.context.secrets.get('anthropic-api-key');

    // Get available AI models from config
    const availableModels = getAssistantModels().map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      api: m.api,
    }));

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
          },
        };

    webview.postMessage({
      type: 'settings',
      data: {
        // Features
        voiceDictation: config.get('features.voice-dictation', false),
        ritemarkFlows: config.get('features.ritemark-flows', false),
        codexIntegration: config.get('features.codex-integration', true),
        codexApprovalPolicy: config.get('codex.approvalPolicy', 'on-request'),
        codexSandboxMode: config.get('codex.sandboxMode', 'workspace-write'),

        // Updates
        updatesEnabled: config.get('updates.enabled', true),
        updateCenter,

        // AI Model
        aiModel: config.get('ai.model', DEFAULT_MODELS.assistant),
        availableModels,

        // Agent
        agentTimeout: config.get('ai.agentTimeout', 15),

        // Chat appearance
        chatFontSize: config.get('chat.fontSize', 13),

        // API Keys (masked for display, full for input)
        openaiKey: openaiKey || '',
        openaiKeyConfigured: !!openaiKey,
        googleKey: googleKey || '',
        googleKeyConfigured: !!googleKey,
        anthropicKey: anthropicKey || '',
        anthropicKeyConfigured: !!anthropicKey,

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
        binaryPath: claudeStatus.binaryPath ?? null,
        authMethod: claudeStatus.authMethod,
        managedBy: 'user',
        state: claudeStatus.state === 'broken-install'
          ? 'broken'
          : claudeStatus.state,
        error: claudeStatus.error,
        diagnostics: claudeStatus.diagnostics,
        repairAction: claudeStatus.repairAction,
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
    const [claudeStatus, codexStatus, codexAuthStatus] = await Promise.all([
      getSetupStatus({ refresh: true }),
      new CodexManager().getBinaryStatus(),
      this.codexAuth?.getStatus() ?? Promise.resolve(null),
    ]);

    // Check system dependencies
    const { execSync } = require('child_process');
    let nodeInstalled = false;
    let nodeVersion: string | null = null;
    let gitInstalled = false;
    let gitVersion: string | null = null;

    try {
      nodeVersion = execSync('node --version', { timeout: 5000 }).toString().trim();
      nodeInstalled = true;
    } catch { /* not installed */ }

    try {
      gitVersion = execSync('git --version', { timeout: 5000 }).toString().trim().replace('git version ', '');
      gitInstalled = true;
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

    setClaudeLoginInProgress(true);
    emitClaudeStatusInvalidated('login-started');
    this.startClaudeLoginPolling();
    openClaudeLoginTerminal(status.binaryPath);
    vscode.window.showInformationMessage('Finish Claude.ai sign-in in the terminal and browser. Ritemark will refresh automatically.');
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
