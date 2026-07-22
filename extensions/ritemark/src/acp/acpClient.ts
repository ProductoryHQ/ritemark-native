/**
 * ACP Client
 *
 * Sprint 76 R1: Reusable client-side Agent Client Protocol connection. Wraps
 * `@agentclientprotocol/sdk`'s ClientSideConnection over a spawned agent
 * process (JSON-RPC 2.0 / ndjson over stdio). The SDK owns the wire protocol
 * (framing, id correlation, ndjson parsing), so this file only handles process
 * lifecycle, stream wiring, and a thin typed facade over the connection.
 *
 * NOTHING in this file is OpenCode-specific — the agent command, args, cwd and
 * spawn env are all constructor parameters (spec R1: "the agent binary path is
 * a constructor parameter"). OpenCode-specific concerns (OPENCODE_PERMISSION,
 * BYOK env, cancel-as-process-kill) live in acpManager.ts.
 */

import { spawn, ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';
import type {
  InitializeResponse,
  NewSessionResponse,
  PromptResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  SessionNotification,
} from '@agentclientprotocol/sdk';

// The SDK is pure ESM ("type": "module"); the extension compiles to CommonJS.
// Mirror AgentRunner.ts: load it through a Function-wrapped dynamic import so
// TypeScript does not rewrite import() → require() (which would fail on ESM).
type AcpSdk = typeof import('@agentclientprotocol/sdk');
let sdkPromise: Promise<AcpSdk> | null = null;
function loadAcpSdk(): Promise<AcpSdk> {
  if (!sdkPromise) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<AcpSdk>;
    sdkPromise = dynamicImport('@agentclientprotocol/sdk');
  }
  return sdkPromise;
}

/**
 * Agent → client request/notification handlers the embedder must provide.
 * These are the ACP `Client` methods OpenCode (and any ACP agent) can call.
 */
export interface AcpClientHandlers {
  /** session/request_permission — gate a tool call (R4 approval surface). */
  requestPermission: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  /** session/update notifications — streaming progress (R5). */
  sessionUpdate: (params: SessionNotification) => void | Promise<void>;
  /** fs/read_text_file — proxied through vscode.workspace.fs (acpFsProxy). */
  readTextFile: (params: ReadTextFileRequest) => Promise<ReadTextFileResponse>;
  /** fs/write_text_file — proxied + approval-gated (acpFsProxy, R4). */
  writeTextFile: (params: WriteTextFileRequest) => Promise<WriteTextFileResponse>;
}

export interface AcpClientConfig {
  /** Absolute path to the agent binary (e.g. the bundled `opencode`). */
  command: string;
  /** Args passed to the binary. Defaults to ['acp']. */
  args?: string[];
  /** Working directory for the spawned process (and the default session cwd). */
  cwd: string;
  /** Full environment for the spawned process (BYOK keys, OPENCODE_PERMISSION). */
  env?: NodeJS.ProcessEnv;
  /** Agent → client handlers. */
  handlers: AcpClientHandlers;
  /** Invoked when the process exits/crashes (after pending work is rejected). */
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  /** Invoked when stderr emits a line (cold-start migration logs, etc.). */
  onStderr?: (line: string) => void;
  trace?: (scope: string, message: string, payload?: unknown) => void;
}

export class AcpClient {
  private process: ChildProcess | null = null;
  // The SDK connection object (camelCase methods → slash wire methods). Loosely
  // typed because it is created from the dynamically-imported ESM module.
  private connection: import('@agentclientprotocol/sdk').ClientSideConnection | null = null;
  private isDisposing = false;
  private readonly config: AcpClientConfig;
  private readonly trace?: AcpClientConfig['trace'];

  constructor(config: AcpClientConfig) {
    this.config = config;
    this.trace = config.trace;
  }

  /** True while the agent process is alive. */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Spawn the agent process, wire its stdio to a fresh SDK connection, and run
   * the ACP `initialize` handshake (capability negotiation, spec R1).
   */
  async initialize(): Promise<InitializeResponse> {
    if (this.connection) {
      throw new Error('ACP client is already initialized');
    }

    const acp = await loadAcpSdk();
    const args = this.config.args ?? ['acp'];

    this.isDisposing = false;
    this.process = spawn(this.config.command, args, {
      cwd: this.config.cwd,
      env: this.config.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.trace?.('client', 'spawn', { command: this.config.command, args, cwd: this.config.cwd });

    this.wireProcessLifecycle();

    if (!this.process.stdin || !this.process.stdout) {
      throw new Error('Failed to open ACP agent stdio streams');
    }

    // ndJsonStream(writableToAgent, readableFromAgent) — see the SDK example
    // client. Web stream adapters bridge Node stdio to the SDK's framing layer;
    // the SDK replaces the hand-written JSON-RPC layer codex uses.
    const toAgent = Writable.toWeb(this.process.stdin) as WritableStream<Uint8Array>;
    const fromAgent = Readable.toWeb(this.process.stdout) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(toAgent, fromAgent);

    this.connection = new acp.ClientSideConnection(() => this.buildClientHandler(), stream);

    const result = await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientInfo: { name: 'ritemark-native', version: '1.7.2' },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });
    this.trace?.('client', 'initialized', result);
    return result;
  }

  /** session/new — create a conversation session for the given cwd. */
  async newSession(cwd: string, mcpServers?: unknown[]): Promise<NewSessionResponse> {
    const connection = this.requireConnection();
    // OpenCode requires an absolute cwd and an mcpServers array (may be empty).
    const result = await connection.newSession({ cwd, mcpServers: (mcpServers ?? []) as never });
    this.trace?.('client', 'newSession', { cwd, mcpServerCount: (mcpServers ?? []).length, sessionId: result.sessionId });
    return result;
  }

  /** session/prompt — send a user text message and await the turn result. */
  async prompt(sessionId: string, text: string): Promise<PromptResponse> {
    const connection = this.requireConnection();
    this.trace?.('client', 'prompt', { sessionId, length: text.length });
    return connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text }],
    });
  }

  /**
   * Select the model for a session. OpenCode 1.15.13 routes model choice through
   * ACP session config options (audit T6), so we use setSessionConfigOption with
   * configId 'model' — NOT setSessionMode/unstable_setSessionModel. The param
   * key is `configId` (a wrong `optionId` is silently dropped with -32602).
   * `providerModel` is the `<provider>/<model>` value form.
   */
  async setModel(sessionId: string, providerModel: string): Promise<void> {
    const connection = this.requireConnection();
    this.trace?.('client', 'setModel', { sessionId, value: providerModel });
    await connection.setSessionConfigOption({
      sessionId,
      configId: 'model',
      value: providerModel,
    });
  }

  /**
   * Cancel an in-flight turn.
   *
   * OpenCode 1.15.13 does not implement `session/cancel` — it answers -32601 and
   * the turn keeps streaming to `end_turn` rather than `cancelled` (verified in
   * the Sprint 99 Phase-0 spike). So the protocol cancel is best-effort and the
   * process kill is what actually stops the work.
   *
   * The kill is NOT conditional on the protocol call failing, and cannot be:
   * `Connection.cancel` is a JSON-RPC *notification* in @agentclientprotocol/sdk
   * 0.22.1 (`dist/acp.js:838`), so it never resolves to an error — the -32601
   * only ever appears on the agent's stderr. An earlier version of this method
   * wrapped it in try/catch as though the error were observable; it was not.
   *
   * Sprint 99 (C3): several conversations now share one subprocess, so the kill
   * can no longer be unconditional — it would take every other chat down with
   * it. The caller decides via `options.killProcess`:
   *
   *  - only live session → kill, exactly as before (nothing else is harmed and
   *    the user gets a real cancel);
   *  - siblings live      → do NOT kill. AcpManager marks the session
   *    cancel-requested and discards its updates until the turn settles, so the
   *    chat goes idle immediately and the wasted upstream work stays invisible.
   *
   * Defaults to true so a single-session embedder keeps today's behaviour.
   *
   * // Sprint 100: re-check against 1.18.1 — if it implements session/cancel,
   * // this becomes a real per-session cancel and the kill goes away entirely.
   */
  async cancel(sessionId: string, options?: { killProcess?: boolean }): Promise<void> {
    if (this.connection) {
      // Fire-and-forget: correct for any agent that implements it, no-op otherwise.
      this.connection.cancel({ sessionId });
      this.trace?.('client', 'cancel:protocol-notification-sent', { sessionId });
    }
    if (options?.killProcess ?? true) {
      this.killProcess('SIGTERM');
    } else {
      this.trace?.('client', 'cancel:kill-suppressed-siblings-live', { sessionId });
    }
  }

  /** Tear down the connection and kill the agent process. */
  dispose(): void {
    this.isDisposing = true;
    this.killProcess('SIGTERM');
    this.connection = null;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private requireConnection(): import('@agentclientprotocol/sdk').ClientSideConnection {
    if (!this.connection) {
      throw new Error('ACP client is not initialized');
    }
    return this.connection;
  }

  /**
   * Build the agent → client handler object the SDK calls into. Each method
   * delegates to the embedder-supplied handlers; sessionUpdate is fire-and-
   * forget so a slow consumer never blocks the agent.
   */
  private buildClientHandler(): import('@agentclientprotocol/sdk').Client {
    const { handlers } = this.config;
    return {
      requestPermission: (params) => handlers.requestPermission(params),
      sessionUpdate: async (params) => {
        await handlers.sessionUpdate(params);
      },
      readTextFile: (params) => handlers.readTextFile(params),
      writeTextFile: (params) => handlers.writeTextFile(params),
    };
  }

  private wireProcessLifecycle(): void {
    const proc = this.process;
    if (!proc) {
      return;
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (!line) {
          return;
        }
        this.trace?.('stdio:stderr', 'message', line);
        this.config.onStderr?.(line);
      });
    }

    // Malformed JSON / framing errors surface here from the SDK stream. Log and
    // continue — a single bad line must not crash the client (spec R1).
    if (proc.stdout) {
      proc.stdout.on('error', (error: Error) => {
        this.trace?.('stdio:stdout', 'error', error.message);
      });
    }

    proc.on('error', (error: Error) => {
      this.trace?.('client', 'process-error', error.message);
      this.config.onStderr?.(error.message);
    });

    proc.on('exit', (code, signal) => {
      this.trace?.('client', 'exit', { code, signal, disposing: this.isDisposing });
      this.process = null;
      this.connection = null;
      if (!this.isDisposing) {
        this.config.onExit?.(code, signal);
      }
    });
  }

  private killProcess(signal: NodeJS.Signals): void {
    if (this.process && !this.process.killed) {
      try {
        this.process.kill(signal);
      } catch {
        // Process may already be gone; nothing to do.
      }
    }
    this.process = null;
  }
}
