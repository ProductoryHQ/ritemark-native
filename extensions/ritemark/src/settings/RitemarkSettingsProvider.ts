/**
 * Ritemark Settings Provider
 *
 * Branded settings page for Ritemark configuration.
 * Reads/writes VS Code settings and manages API keys in SecretStorage.
 */

import * as vscode from 'vscode';
import { getAssistantModels, DEFAULT_MODELS } from '../ai/modelConfig';

export class RitemarkSettingsProvider {
  public static readonly viewType = 'ritemark.settings';

  private static panel: vscode.WebviewPanel | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

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

        // Updates
        updatesEnabled: config.get('updates.enabled', true),

        // AI Model
        aiModel: config.get('ai.model', DEFAULT_MODELS.assistant),
        availableModels,

        // Agent
        agentTimeout: config.get('ai.agentTimeout', 15),

        // API Keys (masked for display, full for input)
        openaiKey: openaiKey || '',
        openaiKeyConfigured: !!openaiKey,
        googleKey: googleKey || '',
        googleKeyConfigured: !!googleKey,
        anthropicKey: anthropicKey || '',
        anthropicKeyConfigured: !!anthropicKey,
      },
    });
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

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
