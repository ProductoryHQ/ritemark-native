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
  CollaborationMode,
  LoginAccountChatGptParams,
  LoginAccountChatGptResponse,
  LogoutAccountResponse,
  UserInput,
  ExecCommandApprovalResponse,
  ApplyPatchApprovalResponse,
  ToolRequestUserInputAnswer,
  ToolRequestUserInputResponse,
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
  private readonly trace?: (scope: string, message: string, payload?: unknown) => void;

  constructor(config: { trace?: (scope: string, message: string, payload?: unknown) => void } = {}) {
    super();
    this.trace = config.trace;

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
          experimentalApi: true,
        },
      });

      this.sendNotification('initialized');
      this.trace?.('app-server', 'initialized', result);
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
   *
   * thread/start can be slow on first invocation (binary warm-up, network
   * handshake, model download). Sprint 69 also adds `dynamicTools` schema
   * validation to the first thread/start, which can extend cold-start
   * latency. We give it a 120s timeout (bumped from 60s in Sprint 69) and
   * emit a 'progress' event after 10s so the AI sidebar can show
   * "Starting Codex session, this may take a moment…" instead of looking
   * frozen. On timeout we attach a diagnostics snapshot to the error so
   * the user sees actionable info (binary path, source, arch, last
   * stderr).
   */
  async threadStart(params: Partial<ThreadStartParams> & { cwd?: string | null }): Promise<ThreadStartResponse> {
    await this.ensureInitialized();
    return this.rpc<ThreadStartParams, ThreadStartResponse>('thread/start', {
      experimentalRawEvents: false,
      persistExtendedHistory: false,
      ...params,
    }, 120_000, {
      progressAfterMs: 10_000,
      progressMessage: 'Starting Codex session, this may take a moment…',
      diagnosticsOnTimeout: () => this.buildThreadStartDiagnostics(),
    });
  }

  /**
   * Build a diagnostics snapshot for thread/start timeouts. Includes the
   * resolved binary path, runtime source (bundled/system), arch, and the
   * last stderr line — enough to triage without opening the developer
   * console.
   */
  private async buildThreadStartDiagnostics(): Promise<string[]> {
    const lines: string[] = [];
    try {
      const status = await this.manager.getBinaryStatus();
      if (status.binaryPath) lines.push(`Binary: ${status.binaryPath}`);
      if (status.runtimeSource) lines.push(`Source: ${status.runtimeSource}`);
      if (status.machineArch) lines.push(`Machine arch: ${status.machineArch}`);
      if (status.installNodeArch) lines.push(`Binary arch: ${status.installNodeArch}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lines.push(`Diagnostics probe failed: ${message}`);
    }
    if (this.lastStderrMessage) {
      lines.push(`Last stderr: ${this.lastStderrMessage}`);
    }
    return lines;
  }

  /**
   * Start an agent turn (send user message)
   */
  async turnStart(
    threadId: string,
    message: string,
    model?: string,
    imageDataUrls?: string[],
    collaborationMode?: CollaborationMode | null
  ): Promise<TurnStartResponse> {
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
      collaborationMode: collaborationMode ?? null,
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
    this.sendServerRequestResponse(
      requestId,
      { decision } as ExecCommandApprovalResponse | ApplyPatchApprovalResponse,
      'approval response'
    );
  }

  sendToolRequestUserInputResponse(requestId: string | number, answers: Record<string, ToolRequestUserInputAnswer>): void {
    this.sendServerRequestResponse(
      requestId,
      { answers } as ToolRequestUserInputResponse,
      'request_user_input response'
    );
  }

  /**
   * Respond to a server-initiated `item/tool/call` request for a dynamic
   * tool (Sprint 69 / experimental Codex App Server feature). The client
   * MUST respond using the same request id with `{ contentItems, success }`
   * — see DynamicToolDefinition for the protocol contract.
   */
  sendToolCallResponse(requestId: string | number, text: string, success: boolean): void {
    this.sendServerRequestResponse(
      requestId,
      {
        contentItems: [{ type: 'inputText', text }],
        success,
      },
      'tool_call response'
    );
  }

  private sendServerRequestResponse(requestId: string | number, result: unknown, label: string): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: requestId,
      result,
    };
    try {
      this.manager.send(JSON.stringify(response));
    } catch (error) {
      console.error(`Failed to send ${label}:`, error);
    }
  }

  /**
   * Generic JSON-RPC call with timeout.
   *
   * Optional `options.progressAfterMs` + `options.progressMessage` schedule a
   * 'progress' event emission while the call is still in flight — useful
   * for slow operations like thread/start where the user otherwise sees a
   * frozen UI for tens of seconds. Optional `options.diagnosticsOnTimeout`
   * is invoked when the timeout fires; the returned lines are appended to
   * the error message so callers don't have to dig through extension host
   * logs to triage.
   */
  private rpc<TParams, TResult>(
    method: string,
    params: TParams,
    timeoutMs = 30_000,
    options?: {
      progressAfterMs?: number;
      progressMessage?: string;
      diagnosticsOnTimeout?: () => Promise<string[]>;
    },
  ): Promise<TResult> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      let progressTimer: ReturnType<typeof setTimeout> | null = null;
      if (options?.progressAfterMs && options.progressMessage) {
        const progressMessage = options.progressMessage;
        progressTimer = setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.trace?.('rpc:progress', method, { id, message: progressMessage });
            this.emit('progress', { method, message: progressMessage });
          }
        }, options.progressAfterMs);
      }

      const finalize = () => {
        if (progressTimer) clearTimeout(progressTimer);
      };

      const timer = setTimeout(async () => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          finalize();
          let message = `RPC call '${method}' timed out after ${timeoutMs}ms`;
          if (options?.diagnosticsOnTimeout) {
            try {
              const lines = await options.diagnosticsOnTimeout();
              if (lines.length > 0) {
                message += `\n${lines.join('\n')}`;
              }
            } catch {
              // Diagnostics probe must never throw further errors at the user.
            }
          }
          reject(new Error(message));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (result: unknown) => {
          clearTimeout(timer);
          finalize();
          this.trace?.('rpc:result', method, { id, result });
          resolve(result as TResult);
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          finalize();
          this.trace?.('rpc:error', method, { id, error: error.message });
          reject(error);
        },
      });

      try {
        this.trace?.('rpc:request', method, { id, params });
        this.manager.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timer);
        finalize();
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Handle stdout data (JSONL parsing)
   */
  private handleStdout(data: string): void {
    this.trace?.('stdio:stdout', 'chunk', data);
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
    this.trace?.('stdio:stderr', 'message', normalized);
    console.error('[codex stderr]', normalized);
  }

  private handleExit(code: number | null): void {
    this.trace?.('app-server', 'exit', { code });
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

    this.trace?.('rpc:notification', method, params);
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
      this.trace?.('rpc:server-request', String(message.method), {
        id: message.id,
        params: message.params,
      });
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
      this.trace?.('rpc:event', String(notification.method), notification.params);
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
