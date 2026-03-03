/**
 * Ritemark Settings Provider
 *
 * Branded settings page for Ritemark configuration.
 * Reads/writes VS Code settings and manages API keys in SecretStorage.
 */

import * as vscode from 'vscode';
import { getAssistantModels, DEFAULT_MODELS } from '../ai/modelConfig';
import { isEnabled } from '../features/featureGate';
import { CodexAppServer, CodexAuth } from '../codex';

export class RitemarkSettingsProvider {
  public static readonly viewType = 'ritemark.settings';

  private static panel: vscode.WebviewPanel | undefined;
  private codexAppServer: CodexAppServer | null = null;
  private codexAuth: CodexAuth | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
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
    }
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

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      RitemarkSettingsProvider.viewType,
      'Ritemark Settings',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        ],
      }
    );

    RitemarkSettingsProvider.panel = panel;

    // Get webview content
    panel.webview.html = await this.getHtmlContent(panel.webview);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message, panel.webview);
      },
      undefined,
      this.context.subscriptions
    );

    // Clean up on close
    panel.onDidDispose(() => {
      RitemarkSettingsProvider.panel = undefined;
    });

    // Send initial data
    await this.sendCurrentSettings(panel.webview);
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
        await this.sendCodexAuthStatus(webview);
        break;
    }
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

    webview.postMessage({
      type: 'settings',
      data: {
        // Features
        voiceDictation: config.get('features.voice-dictation', false),
        ritemarkFlows: config.get('features.ritemark-flows', false),
        codexIntegration: config.get('features.codex-integration', false),

        // Updates
        updatesEnabled: config.get('updates.enabled', true),

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
      },
    });

    // Also send Codex auth status
    await this.sendCodexAuthStatus(webview);
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:; connect-src https://api.openai.com https://api.anthropic.com;">
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

      // Start OAuth flow (opens browser)
      await this.codexAuth.startLogin();

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
      await this.sendCodexAuthStatus(webview);
      vscode.window.showInformationMessage('Signed out from ChatGPT');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Logout failed: ${errorMessage}`);
    }
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
    const binaryInstalled = this.codexAppServer
      ? await new (await import('../codex/codexManager')).CodexManager().isInstalled()
      : false;

    if (!binaryInstalled) {
      webview.postMessage({
        type: 'codex:authStatus',
        data: {
          enabled: true,
          authenticated: false,
          binaryMissing: true,
          error: 'Codex CLI not found. Install with: npm install -g @openai/codex',
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
          authenticated: status.authMethod !== null,
          authMethod: status.authMethod,
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
}
