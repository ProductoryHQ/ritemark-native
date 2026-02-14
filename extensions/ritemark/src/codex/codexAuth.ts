/**
 * Codex Authentication Manager
 *
 * Manages ChatGPT OAuth authentication state:
 * - Trigger OAuth flow via app-server
 * - Listen for auth status changes
 * - Provide current auth state
 */

import { CodexAppServer } from './codexAppServer';
import type { AuthStatus, AuthStatusChangedEvent } from './codexProtocol';
import { EventEmitter } from 'events';

export class CodexAuth extends EventEmitter {
  private appServer: CodexAppServer;
  private currentStatus: AuthStatus = { authenticated: false };

  constructor(appServer: CodexAppServer) {
    super();
    this.appServer = appServer;

    // Listen for auth status changes from app-server
    this.appServer.on('auth/statusChanged', (event: AuthStatusChangedEvent) => {
      this.currentStatus = event.status;
      this.emit('statusChanged', event.status);
    });
  }

  /**
   * Get current authentication status
   */
  async getStatus(): Promise<AuthStatus> {
    try {
      const status = await this.appServer.getAuthStatus();
      this.currentStatus = status;
      return status;
    } catch (error) {
      console.error('Failed to get auth status:', error);
      return { authenticated: false };
    }
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.currentStatus.authenticated;
  }

  /**
   * Get current user info (if authenticated)
   */
  getUserInfo(): Pick<AuthStatus, 'email' | 'plan' | 'credits'> | null {
    if (!this.currentStatus.authenticated) {
      return null;
    }

    return {
      email: this.currentStatus.email,
      plan: this.currentStatus.plan,
      credits: this.currentStatus.credits,
    };
  }

  /**
   * Start OAuth login flow
   *
   * This opens the system browser and redirects to ChatGPT OAuth.
   * The auth status will be updated via 'auth/statusChanged' event when complete.
   */
  async startLogin(method: 'browser' | 'device-code' = 'browser'): Promise<void> {
    try {
      const result = await this.appServer.startLogin({ method });

      if (result.status === 'failed') {
        throw new Error('OAuth login failed');
      }

      if (method === 'device-code' && result.deviceCode && result.userCode) {
        // Emit device code info for UI to display
        this.emit('deviceCode', {
          deviceCode: result.deviceCode,
          userCode: result.userCode,
          authUrl: result.authUrl,
        });
      }

      // For browser method, Codex handles everything (opens browser automatically)
      // For device-code, user needs to visit authUrl and enter userCode

    } catch (error) {
      console.error('Failed to start login:', error);
      throw error;
    }
  }

  /**
   * Logout (clear credentials)
   */
  async logout(): Promise<void> {
    try {
      await this.appServer.logout();
      this.currentStatus = { authenticated: false };
      this.emit('statusChanged', this.currentStatus);
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  }

  /**
   * Wait for authentication to complete
   *
   * Useful after calling startLogin() to wait for the OAuth flow to finish.
   */
  async waitForAuth(timeoutMs = 120000): Promise<AuthStatus> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off('statusChanged', handler);
        reject(new Error('Authentication timeout'));
      }, timeoutMs);

      const handler = (status: AuthStatus) => {
        if (status.authenticated) {
          clearTimeout(timeout);
          this.off('statusChanged', handler);
          resolve(status);
        }
      };

      this.on('statusChanged', handler);

      // Also check current status immediately
      if (this.currentStatus.authenticated) {
        clearTimeout(timeout);
        this.off('statusChanged', handler);
        resolve(this.currentStatus);
      }
    });
  }
}
