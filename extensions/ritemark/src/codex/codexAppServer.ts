/**
 * Codex App Server Client
 *
 * JSON-RPC 2.0 client for communicating with `codex app-server` over stdio.
 *
 * Handles:
 * - JSONL parsing (newline-delimited JSON)
 * - Request/response correlation (via id)
 * - Event dispatching (server → client notifications)
 * - Error handling
 */

import { EventEmitter } from 'events';
import { CodexManager } from './codexManager';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  InitializeParams,
  InitializeResult,
  AuthStatus,
  StartLoginParams,
  StartLoginResult,
  CreateThreadParams,
  CreateThreadResult,
  StartTurnParams,
  StartTurnResult,
  ApproveCommandParams,
  ApproveFileChangeParams,
  CodexEvent,
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

    // Send initialize RPC
    return this.rpc<InitializeParams, InitializeResult>('initialize', {
      clientInfo: {
        name: 'ritemark-native',
        version: '1.3.1',
      },
      capabilities: {
        approvals: true,
        streaming: true,
      },
    });
  }

  /**
   * Get authentication status
   */
  async getAuthStatus(): Promise<AuthStatus> {
    await this.manager.ensureRunning();
    return this.rpc<void, AuthStatus>('auth/getStatus', undefined);
  }

  /**
   * Start OAuth login flow
   */
  async startLogin(params: StartLoginParams = {}): Promise<StartLoginResult> {
    await this.manager.ensureRunning();
    return this.rpc<StartLoginParams, StartLoginResult>('auth/startLogin', params);
  }

  /**
   * Logout (clear credentials)
   */
  async logout(): Promise<void> {
    await this.manager.ensureRunning();
    return this.rpc<void, void>('auth/logout', undefined);
  }

  /**
   * Create a new thread
   */
  async createThread(params: CreateThreadParams): Promise<CreateThreadResult> {
    await this.manager.ensureRunning();
    return this.rpc<CreateThreadParams, CreateThreadResult>('thread/create', params);
  }

  /**
   * Start an agent turn
   */
  async startTurn(params: StartTurnParams): Promise<StartTurnResult> {
    await this.manager.ensureRunning();
    return this.rpc<StartTurnParams, StartTurnResult>('turn/start', params);
  }

  /**
   * Interrupt current turn
   */
  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    await this.manager.ensureRunning();
    return this.rpc<{ threadId: string; turnId: string }, void>('turn/interrupt', { threadId, turnId });
  }

  /**
   * Approve/reject shell command
   */
  async approveCommand(params: ApproveCommandParams): Promise<void> {
    await this.manager.ensureRunning();
    return this.rpc<ApproveCommandParams, void>('approve/command', params);
  }

  /**
   * Approve/reject file change
   */
  async approveFileChange(params: ApproveFileChangeParams): Promise<void> {
    await this.manager.ensureRunning();
    return this.rpc<ApproveFileChangeParams, void>('approve/fileChange', params);
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

      // Timeout to prevent permanent leaks
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC call '${method}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Store pending request (clear timer on resolve/reject)
      this.pendingRequests.set(id, {
        resolve: (result: unknown) => { clearTimeout(timer); resolve(result as TResult); },
        reject: (error: Error) => { clearTimeout(timer); reject(error); },
      });

      // Send request
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

    // Split by newlines (JSONL format)
    const lines = this.buffer.split('\n');

    // Keep last incomplete line in buffer
    this.buffer = lines.pop() || '';

    // Process complete lines
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

  /**
   * Handle stderr data (debug logs)
   */
  private handleStderr(data: string): void {
    console.error('[codex stderr]', data);
  }

  /**
   * Handle process exit
   */
  private handleExit(code: number | null): void {
    console.log(`Codex app-server exited with code ${code}`);

    // Reject all pending requests
    for (const [id, { reject }] of this.pendingRequests.entries()) {
      reject(new Error('Codex app-server exited unexpectedly'));
    }
    this.pendingRequests.clear();

    this.emit('exit', code);
  }

  /**
   * Handle incoming JSON-RPC message (response or notification)
   */
  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    // Check if it's a response (has 'id')
    if ('id' in message) {
      const response = message as JsonRpcResponse;
      const pending = this.pendingRequests.get(response.id as number);

      if (pending) {
        this.pendingRequests.delete(response.id as number);

        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      } else {
        console.warn('Received response for unknown request id:', response.id);
      }
    }
    // Otherwise it's a notification (event)
    else {
      const notification = message as JsonRpcNotification;
      this.handleEvent(notification);
    }
  }

  /**
   * Handle server event (notification)
   */
  private handleEvent(notification: JsonRpcNotification): void {
    const event = notification as CodexEvent;

    // Emit event with method name
    this.emit(event.method, event.params);

    // Also emit generic 'event' for all events
    this.emit('event', event);
  }

  /**
   * Check if app-server is running
   */
  isRunning(): boolean {
    return this.manager.isRunning();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.manager.dispose();
    this.removeAllListeners();
  }
}
