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
  private sessionResumeAdvertised = false;
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
    this.sessionResumeAdvertised = result.agentCapabilities?.sessionCapabilities?.resume != null;
    this.trace?.('client', 'initialized', result);
    return result;
  }

  /** Capability negotiated during initialize; absence means resume is unsafe. */
  supportsSessionResume(): boolean {
    return this.sessionResumeAdvertised;
  }

  /** session/new — create a conversation session for the given cwd. */
  async newSession(cwd: string, mcpServers?: unknown[]): Promise<NewSessionResponse> {
    const connection = this.requireConnection();
    // OpenCode requires an absolute cwd and an mcpServers array (may be empty).
    const result = await connection.newSession({ cwd, mcpServers: (mcpServers ?? []) as never });
    this.trace?.('client', 'newSession', { cwd, mcpServerCount: (mcpServers ?? []).length, sessionId: result.sessionId });
    return result;
  }

  /** session/resume — reconnect to an existing provider session without load replay. */
  async resumeSession(sessionId: string, cwd: string, mcpServers?: unknown[]): Promise<void> {
    if (!this.sessionResumeAdvertised) {
      throw new Error('ACP agent does not advertise session/resume support');
    }
    const connection = this.requireConnection();
    await connection.resumeSession({ sessionId, cwd, mcpServers: (mcpServers ?? []) as never });
    this.trace?.('client', 'resumeSession', { cwd, mcpServerCount: (mcpServers ?? []).length, sessionId });
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
   * OpenCode implements `session/cancel` as of 1.18.4 (upstream commit 50b4ad89b,
   * "honor session/cancel by aborting the running turn"): the backing session is
   * aborted and the turn settles `stopReason: "cancelled"`. Before that it
   * answered -32601 and kept streaming to `end_turn`, which is why Ritemark used
   * to kill the process to make cancel mean anything.
   *
   * That kill is gone. Under Sprint 99 several conversations share one
   * subprocess, so killing it would take every other chat down — and on 1.18.4
   * it is not merely unnecessary but harmful, discarding a warm subprocess that
   * a working protocol cancel preserves and forcing a cold start on the next
   * prompt.
   *
   * Still sent as a notification (`Connection.cancel` is `sendNotification` in
   * @agentclientprotocol/sdk 1.4.0), so there is no response to await; the
   * outcome is observed as the turn settling `cancelled`.
   */
  async cancel(sessionId: string): Promise<void> {
    if (!this.connection) {
      return;
    }
    this.connection.cancel({ sessionId });
    this.trace?.('client', 'cancel:sent', { sessionId });
  }

  /** Tear down the connection and kill the agent process. */
  dispose(): void {
    this.isDisposing = true;
    this.killProcess('SIGTERM');
    this.connection = null;
    this.sessionResumeAdvertised = false;
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
