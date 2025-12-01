/**
 * API Key Manager
 * Secure storage for OpenAI API keys using VS Code SecretStorage
 *
 * VS Code SecretStorage uses the OS keychain (Keychain on macOS,
 * Credential Manager on Windows, libsecret on Linux)
 */

import * as vscode from 'vscode';

const API_KEY_ID = 'openai-api-key';

/**
 * Event emitter for API key changes
 */
export const apiKeyChanged = new vscode.EventEmitter<{ hasKey: boolean }>();

/**
 * API Key Manager class
 * Wraps VS Code SecretStorage for OpenAI API key management
 */
export class APIKeyManager {
  constructor(private secrets: vscode.SecretStorage) {}

  /**
   * Store OpenAI API key
   * @param apiKey - OpenAI API key (must start with 'sk-')
   */
  async storeAPIKey(apiKey: string): Promise<void> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('API key cannot be empty');
    }

    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format (must start with sk-)');
    }

    await this.secrets.store(API_KEY_ID, apiKey);
    apiKeyChanged.fire({ hasKey: true });
  }

  /**
   * Retrieve OpenAI API key
   * @returns API key or undefined if not found
   */
  async getAPIKey(): Promise<string | undefined> {
    return this.secrets.get(API_KEY_ID);
  }

  /**
   * Check if API key exists
   * @returns true if key exists
   */
  async hasAPIKey(): Promise<boolean> {
    const key = await this.secrets.get(API_KEY_ID);
    return !!key;
  }

  /**
   * Delete stored API key
   */
  async deleteAPIKey(): Promise<void> {
    await this.secrets.delete(API_KEY_ID);
    apiKeyChanged.fire({ hasKey: false });
  }

  /**
   * Get masked API key for display (e.g., "sk-...****...1234")
   * @returns Masked key or null if not found
   */
  async getMaskedKey(): Promise<string | null> {
    const apiKey = await this.getAPIKey();

    if (!apiKey) {
      return null;
    }

    // Show first 7 chars (sk-proj) and last 4 chars
    if (apiKey.length > 11) {
      const start = apiKey.substring(0, 7);
      const end = apiKey.substring(apiKey.length - 4);
      return `${start}...****...${end}`;
    }

    return 'sk-...****'; // Fallback for short keys
  }
}

/**
 * Singleton instance - initialized in extension.ts
 */
let _instance: APIKeyManager | null = null;

/**
 * Initialize the API key manager with extension context
 */
export function initAPIKeyManager(context: vscode.ExtensionContext): APIKeyManager {
  _instance = new APIKeyManager(context.secrets);
  return _instance;
}

/**
 * Get the API key manager instance
 */
export function getAPIKeyManager(): APIKeyManager {
  if (!_instance) {
    throw new Error('APIKeyManager not initialized. Call initAPIKeyManager first.');
  }
  return _instance;
}
