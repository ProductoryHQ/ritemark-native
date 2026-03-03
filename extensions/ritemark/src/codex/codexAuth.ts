/**
 * Codex Authentication Manager
 *
 * Manages ChatGPT OAuth authentication state:
 * - Trigger OAuth flow via app-server
 * - Listen for auth status changes
 * - Provide current auth state
 */

import { CodexAppServer } from './codexAppServer';
import type { GetAuthStatusResponse, AuthStatusChangeNotification, LoginChatGptCompleteNotification } from './codexProtocol';
import { EventEmitter } from 'events';

export class CodexAuth extends EventEmitter {
  private appServer: CodexAppServer;
  private currentAuth: GetAuthStatusResponse = { authMethod: null, authToken: null, requiresOpenaiAuth: null };

  constructor(appServer: CodexAppServer) {
    super();
    this.appServer = appServer;

    // Listen for auth status changes from app-server
    this.appServer.on('authStatusChange', (event: AuthStatusChangeNotification) => {
      this.currentAuth = { ...this.currentAuth, authMethod: event.authMethod };
      this.emit('statusChanged', this.currentAuth);
    });

    // Listen for login completion
    this.appServer.on('loginChatGptComplete', (event: LoginChatGptCompleteNotification) => {
      if (event.success) {
        this.currentAuth = { ...this.currentAuth, authMethod: 'chatgpt' };
      }
      this.emit('loginComplete', event.success);
      this.emit('statusChanged', this.currentAuth);
    });
  }

  /**
   * Get current authentication status
   */
  async getStatus(): Promise<GetAuthStatusResponse> {
    try {
      const status = await this.appServer.getAuthStatus();
      this.currentAuth = status;
      return status;
    } catch (error) {
      console.error('Failed to get auth status:', error);
      return { authMethod: null, authToken: null, requiresOpenaiAuth: null };
    }
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.currentAuth.authMethod !== null;
  }

  /**
   * Get auth method (apikey, chatgpt, etc.)
   */
  getAuthMethod(): string | null {
    return this.currentAuth.authMethod;
  }

  /**
   * Start ChatGPT OAuth login flow
   */
  async startLogin(): Promise<void> {
    try {
      await this.appServer.loginChatGpt();
      // Login completion comes via 'loginChatGptComplete' notification
    } catch (error) {
      console.error('Failed to start login:', error);
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.appServer.logoutChatGpt();
      this.currentAuth = { authMethod: null, authToken: null, requiresOpenaiAuth: null };
      this.emit('statusChanged', this.currentAuth);
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  }

  /**
   * Wait for authentication to complete
   */
  async waitForAuth(timeoutMs = 120000): Promise<GetAuthStatusResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off('statusChanged', handler);
        reject(new Error('Authentication timeout'));
      }, timeoutMs);

      const handler = (status: GetAuthStatusResponse) => {
        if (status.authMethod !== null) {
          clearTimeout(timeout);
          this.off('statusChanged', handler);
          resolve(status);
        }
      };

      this.on('statusChanged', handler);

      // Check current status immediately
      if (this.currentAuth.authMethod !== null) {
        clearTimeout(timeout);
        this.off('statusChanged', handler);
        resolve(this.currentAuth);
      }
    });
  }
}
