/**
 * Configure API Key Command
 * Prompts user to enter their OpenAI API key
 */

import * as vscode from 'vscode';
import { getAPIKeyManager } from '../ai/apiKeyManager';

/**
 * Register the configure API key command
 */
export function registerConfigureApiKeyCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('ritemark.configureApiKey', async () => {
    const apiKeyManager = getAPIKeyManager();
    const hasKey = await apiKeyManager.hasAPIKey();

    // Show options if key already exists
    if (hasKey) {
      const maskedKey = await apiKeyManager.getMaskedKey();
      const choice = await vscode.window.showQuickPick(
        [
          { label: '$(key) Update API Key', description: 'Replace existing key', action: 'update' },
          { label: '$(trash) Delete API Key', description: 'Remove stored key', action: 'delete' },
          { label: '$(close) Cancel', description: '', action: 'cancel' }
        ],
        {
          title: 'OpenAI API Key',
          placeHolder: `Current key: ${maskedKey}`
        }
      );

      if (!choice || choice.action === 'cancel') {
        return;
      }

      if (choice.action === 'delete') {
        await apiKeyManager.deleteAPIKey();
        vscode.window.showInformationMessage('OpenAI API key deleted.');
        return;
      }

      // Fall through to update flow
    }

    // Prompt for API key
    const apiKey = await vscode.window.showInputBox({
      title: 'Configure OpenAI API Key',
      prompt: 'Enter your OpenAI API key (starts with sk-)',
      placeHolder: 'sk-...',
      password: true, // Hide input
      validateInput: (value) => {
        if (!value || !value.trim()) {
          return 'API key cannot be empty';
        }
        if (!value.startsWith('sk-')) {
          return 'Invalid format: API key must start with sk-';
        }
        return null; // Valid
      }
    });

    if (!apiKey) {
      return; // User cancelled
    }

    try {
      await apiKeyManager.storeAPIKey(apiKey);
      vscode.window.showInformationMessage('OpenAI API key saved successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to save API key: ${message}`);
    }
  });
}

/**
 * Register command to check API key status (for webview)
 */
export function registerCheckApiKeyCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('ritemark.hasApiKey', async () => {
    const apiKeyManager = getAPIKeyManager();
    return apiKeyManager.hasAPIKey();
  });
}
