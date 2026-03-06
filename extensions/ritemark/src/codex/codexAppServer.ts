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
  GetAuthStatusParams,
  GetAuthStatusResponse,
  ThreadStartParams,
  ThreadStartResponse,
  TurnStartParams,
  TurnStartResponse,
  TurnInterruptParams,
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
    await this.manager.ensureRunning();

    return this.rpc<InitializeParams, InitializeResult>('initialize', {
      clientInfo: {
        name: 'ritemark-native',
        title: 'Ritemark Native',
        version: '1.4.0',
      },
      capabilities: {
        experimentalApi: false,
      },
    });
  }

  /**
   * Get authentication status
   */
  async getAuthStatus(): Promise<GetAuthStatusResponse> {
    await this.manager.ensureRunning();
    return this.rpc<GetAuthStatusParams, GetAuthStatusResponse>('getAuthStatus', {
      includeToken: null,
      refreshToken: null,
    });
  }

  /**
   * Start ChatGPT OAuth login flow
   */
  async loginChatGpt(): Promise<void> {
    await this.manager.ensureRunning();
    await this.rpc<undefined, unknown>('loginChatGpt', undefined);
  }

  /**
   * Logout from ChatGPT
   */
  async logoutChatGpt(): Promise<void> {
    await this.manager.ensureRunning();
    await this.rpc<undefined, unknown>('logoutChatGpt', undefined);
  }

  /**
   * Start a new thread (conversation)
   */
  async threadStart(params: Partial<ThreadStartParams> & { cwd?: string | null }): Promise<ThreadStartResponse> {
    await this.manager.ensureRunning();
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
    await this.manager.ensureRunning();
    const input: UserInput[] = [{
      type: 'text',
      text: message,
      text_elements: [],
    }];
    if (imageDataUrls) {
      for (const url of imageDataUrls) {
        input.push({ type: 'image', image_url: { url } });
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
    await this.manager.ensureRunning();
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
    console.error('[codex stderr]', data);
  }

  private handleExit(code: number | null): void {
    console.log(`Codex app-server exited with code ${code}`);

    for (const [, { reject }] of this.pendingRequests.entries()) {
      reject(new Error('Codex app-server exited unexpectedly'));
    }
    this.pendingRequests.clear();

    this.emit('exit', code);
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
