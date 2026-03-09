/**
 * Codex Authentication Manager
 *
 * Uses the current Codex app-server account APIs:
 * - account/read
 * - account/rateLimits/read
 * - account/login/start
 * - account/logout
 */

import { EventEmitter } from 'events';
import { CodexAppServer } from './codexAppServer';
import type {
  AccountLoginCompletedNotification,
  AccountUpdatedNotification,
  CodexPlanType,
  GetAccountRateLimitsResponse,
} from './codexProtocol';

export interface CodexAuthStatus {
  authenticated: boolean;
  authMethod: 'apiKey' | 'chatgpt' | null;
  email: string | null;
  plan: CodexPlanType | null;
  requiresOpenaiAuth: boolean;
  rateLimits: GetAccountRateLimitsResponse | null;
}

export interface CodexLoginStartResult {
  loginId: string;
  authUrl: string;
}

const EMPTY_STATUS: CodexAuthStatus = {
  authenticated: false,
  authMethod: null,
  email: null,
  plan: null,
  requiresOpenaiAuth: false,
  rateLimits: null,
};

export class CodexAuth extends EventEmitter {
  private appServer: CodexAppServer;
  private currentAuth: CodexAuthStatus = { ...EMPTY_STATUS };
  private lastStatusError: string | null = null;

  constructor(appServer: CodexAppServer) {
    super();
    this.appServer = appServer;

    this.appServer.on('account/updated', (event: AccountUpdatedNotification) => {
      this.currentAuth = {
        ...this.currentAuth,
        authenticated: event.authMode !== null,
        authMethod: event.authMode === 'chatgpt'
          ? 'chatgpt'
          : event.authMode === 'apiKey'
            ? 'apiKey'
            : null,
        plan: event.planType ?? this.currentAuth.plan,
      };
      this.emit('statusChanged', this.currentAuth);
    });

    this.appServer.on('account/login/completed', async (event: AccountLoginCompletedNotification) => {
      if (event.success) {
        await this.getStatus();
      }
      this.emit('loginComplete', event);
      this.emit('statusChanged', this.currentAuth);
    });
  }

  async getStatus(): Promise<CodexAuthStatus> {
    try {
      const [account, rateLimits] = await Promise.all([
        this.appServer.getAccount(),
        this.appServer.getAccountRateLimits().catch(() => null),
      ]);

      this.currentAuth = {
        authenticated: account.account !== null,
        authMethod: account.account?.type === 'chatgpt'
          ? 'chatgpt'
          : account.account?.type === 'apiKey'
            ? 'apiKey'
            : null,
        email: account.account?.type === 'chatgpt' ? account.account.email : null,
        plan: account.account?.type === 'chatgpt' ? account.account.planType : null,
        requiresOpenaiAuth: account.requiresOpenaiAuth,
        rateLimits,
      };
      this.lastStatusError = null;
      return this.currentAuth;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== this.lastStatusError) {
        console.error('Failed to get auth status:', error);
        this.lastStatusError = message;
      }
      this.currentAuth = { ...EMPTY_STATUS };
      return this.currentAuth;
    }
  }

  isAuthenticated(): boolean {
    return this.currentAuth.authenticated;
  }

  getAuthMethod(): string | null {
    return this.currentAuth.authMethod;
  }

  async startLogin(): Promise<CodexLoginStartResult> {
    try {
      const result = await this.appServer.loginAccountChatGpt();
      return {
        loginId: result.loginId,
        authUrl: result.authUrl,
      };
    } catch (error) {
      console.error('Failed to start login:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.appServer.logoutAccount();
      this.currentAuth = { ...EMPTY_STATUS };
      this.emit('statusChanged', this.currentAuth);
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  }

  async waitForAuth(timeoutMs = 120000): Promise<CodexAuthStatus> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off('statusChanged', handler);
        reject(new Error('Authentication timeout'));
      }, timeoutMs);

      const handler = (status: CodexAuthStatus) => {
        if (status.authenticated) {
          clearTimeout(timeout);
          this.off('statusChanged', handler);
          resolve(status);
        }
      };

      this.on('statusChanged', handler);

      if (this.currentAuth.authenticated) {
        clearTimeout(timeout);
        this.off('statusChanged', handler);
        resolve(this.currentAuth);
      }
    });
  }
}
