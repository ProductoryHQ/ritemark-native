/**
 * Codex App Server Client
 *
 * JSON-RPC 2.0 client for communicating with `codex app-server` over stdio.
 *
 * Handles:
 * - JSONL parsing (newline-delimited JSON)
 * - Request/response correlation (via id)
 * - Server-initiated requests (approvals) — responded via sendResponse()
 * - Event dispatching (server → client notifications)
 */

import { EventEmitter } from 'events';
import { CodexManager } from './codexManager';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  InitializeParams,
  InitializeResult,
  GetAccountParams,
  GetAccountResponse,
  GetAccountRateLimitsResponse,
  ThreadStartParams,
  ThreadStartResponse,
  TurnStartParams,
  TurnStartResponse,
  TurnInterruptParams,
  LoginAccountChatGptParams,
  LoginAccountChatGptResponse,
  LogoutAccountResponse,
  UserInput,
  ExecCommandApprovalResponse,
  ApplyPatchApprovalResponse,
  ReviewDecision,
} from './codexProtocol';

export class CodexAppServer extends EventEmitter {
  private manager: CodexManager;
  private nextId = 1;
  private pendingRequests = new Map<number, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';
  private lastStderrMessage: string | null = null;
  private sawStderrSinceStart = false;
  private initializePromise: Promise<InitializeResult> | null = null;

  constructor() {
    super();

    this.manager = new CodexManager({
      onStdout: (data) => this.handleStdout(data),
      onStderr: (data) => this.handleStderr(data),
      onExit: (code) => this.handleExit(code),
    });
  }

  /**
   * Ensure app-server is running and initialized
   */
  async ensureInitialized(): Promise<InitializeResult> {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = (async () => {
      await this.manager.ensureRunning();

      const result = await this.rpc<InitializeParams, InitializeResult>('initialize', {
        clientInfo: {
          name: 'ritemark-native',
          title: 'Ritemark Native',
          version: '1.4.0',
        },
        capabilities: {
          experimentalApi: false,
        },
      });

      this.sendNotification('initialized');
      return result;
    })();

    return this.initializePromise;
  }

  /**
   * Get current account/authentication status
   */
  async getAccount(): Promise<GetAccountResponse> {
    await this.ensureInitialized();
    return this.rpc<GetAccountParams, GetAccountResponse>('account/read', {
      refreshToken: false,
    });
  }

  /**
   * Get current account rate limits / plan usage snapshot.
   */
  async getAccountRateLimits(): Promise<GetAccountRateLimitsResponse> {
    await this.ensureInitialized();
    return this.rpc<Record<string, never>, GetAccountRateLimitsResponse>('account/rateLimits/read', {});
  }

  /**
   * Start ChatGPT OAuth login flow.
   */
  async loginAccountChatGpt(): Promise<LoginAccountChatGptResponse> {
    await this.ensureInitialized();
    return this.rpc<LoginAccountChatGptParams, LoginAccountChatGptResponse>('account/login/start', { type: 'chatgpt' });
  }

  /**
   * Logout from the current account.
   */
  async logoutAccount(): Promise<LogoutAccountResponse> {
    await this.ensureInitialized();
    return this.rpc<Record<string, never>, LogoutAccountResponse>('account/logout', {});
  }

  /**
   * Start a new thread (conversation)
   */
  async threadStart(params: Partial<ThreadStartParams> & { cwd?: string | null }): Promise<ThreadStartResponse> {
    await this.ensureInitialized();
    return this.rpc<ThreadStartParams, ThreadStartResponse>('thread/start', {
      experimentalRawEvents: false,
      persistExtendedHistory: false,
      ...params,
    });
  }

  /**
   * Start an agent turn (send user message)
   */
  async turnStart(threadId: string, message: string, model?: string, imageDataUrls?: string[]): Promise<TurnStartResponse> {
    await this.ensureInitialized();
    const input: UserInput[] = [{
      type: 'text',
      text: message,
      text_elements: [],
    }];
    if (imageDataUrls) {
      for (const url of imageDataUrls) {
        input.push({ type: 'image', url });
      }
    }
    return this.rpc<TurnStartParams, TurnStartResponse>('turn/start', {
      threadId,
      input,
      model: model || null,
    });
  }

  /**
   * Interrupt current turn
   */
  async turnInterrupt(threadId: string, turnId: string): Promise<void> {
    await this.ensureInitialized();
    await this.rpc<TurnInterruptParams, unknown>('turn/interrupt', { threadId, turnId });
  }

  /**
   * Respond to a server-initiated approval request.
   * The server sends a JSON-RPC request (with an id) for approval.
   * We respond with our decision using that same id.
   */
  sendApprovalResponse(requestId: string | number, decision: ReviewDecision): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: requestId,
      result: { decision } as ExecCommandApprovalResponse | ApplyPatchApprovalResponse,
    };
    try {
      this.manager.send(JSON.stringify(response));
    } catch (error) {
      console.error('Failed to send approval response:', error);
    }
  }

  /**
   * Generic JSON-RPC call with timeout
   */
  private rpc<TParams, TResult>(method: string, params: TParams, timeoutMs = 30_000): Promise<TResult> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC call '${method}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (result: unknown) => { clearTimeout(timer); resolve(result as TResult); },
        reject: (error: Error) => { clearTimeout(timer); reject(error); },
      });

      try {
        this.manager.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Handle stdout data (JSONL parsing)
   */
  private handleStdout(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse JSONL line:', line, error);
        }
      }
    }
  }

  private handleStderr(data: string): void {
    const normalized = data.trim();
    if (!normalized || normalized === this.lastStderrMessage) {
      return;
    }

    this.lastStderrMessage = normalized;
    this.sawStderrSinceStart = true;
    console.error('[codex stderr]', normalized);
  }

  private handleExit(code: number | null): void {
    for (const [, { reject }] of this.pendingRequests.entries()) {
      reject(new Error('Codex app-server exited unexpectedly'));
    }
    this.pendingRequests.clear();
    this.lastStderrMessage = null;
    this.sawStderrSinceStart = false;
    this.initializePromise = null;

    this.emit('exit', code);
  }

  private sendNotification(method: string, params?: unknown): void {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.manager.send(JSON.stringify(notification));
  }

  /**
   * Handle incoming JSON-RPC message
   *
   * Messages can be:
   * 1. Response to our request (has 'id' + 'result'/'error')
   * 2. Server-initiated request (has 'id' + 'method') — approvals
   * 3. Notification (no 'id', has 'method') — events
   */
  private handleMessage(message: Record<string, unknown>): void {
    const hasId = 'id' in message && message.id !== undefined;
    const hasMethod = 'method' in message;

    if (hasId && !hasMethod) {
      // Response to our request
      const response = message as unknown as JsonRpcResponse;
      const pending = this.pendingRequests.get(response.id as number);

      if (pending) {
        this.pendingRequests.delete(response.id as number);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } else if (hasId && hasMethod) {
      // Server-initiated request (approval)
      // Emit with method name so UnifiedViewProvider can handle & respond
      this.emit('server-request', {
        id: message.id,
        method: message.method,
        params: message.params,
      });
    } else if (hasMethod) {
      // Notification (event)
      const notification = message as unknown as JsonRpcNotification;
      this.emit(notification.method as string, notification.params);
      this.emit('notification', notification);
    }
  }

  isRunning(): boolean {
    return this.manager.isRunning();
  }

  dispose(): void {
    this.manager.dispose();
    this.removeAllListeners();
  }
}
