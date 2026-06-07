/**
 * ACP Manager
 *
 * Sprint 76 R1/R4/R5/R6: orchestrates an ACP agent session — spawn, prompt,
 * model selection, cancellation, dispose — and maps `session/update`
 * notifications onto Ritemark's `AgentProgress` events. This is the
 * OpenCode-aware layer (env injection, permission lever, cancel fallback) on
 * top of the agent-agnostic AcpClient.
 *
 * Patterned on codexManager.ts (lifecycle + progress mapping + trace logging).
 */

import type {
  AgentProgress,
  AgentProgressType,
} from '../agent/types';
import type {
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
  PromptResponse,
} from '@agentclientprotocol/sdk';
import { AcpClient, type AcpClientHandlers } from './acpClient';
import { AcpFsProxy, type AcpFsBackend, type AcpWriteApproval } from './acpFsProxy';
import { traceAcp } from './acpTrace';

/**
 * Mandatory permission env (audit T8). Without OPENCODE_PERMISSION the agent
 * writes files directly to disk and never calls the client's fs/permission
 * handlers, violating R4's "no silent writes" invariant. edit/bash/webfetch are
 * all set to "ask" so they route through session/request_permission.
 */
export const OPENCODE_PERMISSION = '{"edit":"ask","bash":"ask","webfetch":"ask"}';

export interface AcpManagerConfig {
  /** Absolute path to the resolved agent binary (Phase 2 wires discovery). */
  binaryPath: string;
  /** Workspace root — session cwd and fs-proxy boundary. */
  workspaceRoot: string;
  /** Agent args (defaults to ['acp']). */
  args?: string[];
  /** Provider/BYOK env vars injected at spawn (merged over process.env). */
  byokEnv?: Record<string, string>;
  /**
   * MCP stdio server descriptors to pass to session/new. Populated by
   * BrowserToolsInjector when the browser-agent-control feature flag is on.
   */
  mcpServers?: unknown[];
  /** Permission handler — Phase 4 renders the approval UI. */
  requestPermission: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  /** Write approval gate for the fs proxy (R4 — no silent writes). */
  approveWrite: AcpWriteApproval;
  /** Progress sink (R5 streaming). */
  onProgress: (progress: AgentProgress) => void;
  /** Filesystem backend override (tests inject a fake). */
  fsBackend?: AcpFsBackend;
}

export class AcpManager {
  private readonly config: AcpManagerConfig;
  private client: AcpClient | null = null;
  private sessionId: string | null = null;

  constructor(config: AcpManagerConfig) {
    this.config = config;
  }

  /** True while an agent session is live. */
  isRunning(): boolean {
    return this.client !== null && this.client.isRunning();
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Spawn the agent, run the handshake, and open a session. Idempotent-safe to
   * call once per session; throws if a session is already active.
   */
  async start(): Promise<string> {
    if (this.client) {
      throw new Error('ACP session is already running');
    }

    const fsProxy = new AcpFsProxy({
      workspaceRoot: this.config.workspaceRoot,
      backend: this.config.fsBackend,
      approveWrite: this.config.approveWrite,
      trace: traceAcp,
    });

    const handlers: AcpClientHandlers = {
      requestPermission: (params) => this.config.requestPermission(params),
      sessionUpdate: (params) => this.handleSessionUpdate(params),
      readTextFile: fsProxy.readTextFile,
      writeTextFile: fsProxy.writeTextFile,
    };

    this.client = new AcpClient({
      command: this.config.binaryPath,
      args: this.config.args,
      cwd: this.config.workspaceRoot,
      env: this.buildSpawnEnv(),
      handlers,
      onExit: (code, signal) => this.handleExit(code, signal),
      onStderr: (line) => traceAcp('manager', 'stderr', line),
      trace: traceAcp,
    });

    this.emit('init', 'Starting OpenCode session…');
    await this.client.initialize();
    const session = await this.client.newSession(this.config.workspaceRoot, this.config.mcpServers);
    this.sessionId = session.sessionId;
    traceAcp('manager', 'started', { sessionId: this.sessionId });
    return this.sessionId;
  }

  /**
   * Set the session model (R6). `providerModel` is the `<provider>/<model>`
   * value (the `opencode:` composite prefix is dropped before this call).
   */
  async setModel(providerModel: string): Promise<void> {
    const { client, sessionId } = this.requireSession();
    await client.setModel(sessionId, providerModel);
  }

  /**
   * Send a prompt and await the turn. A 0-token `end_turn` with no streamed
   * content is treated as a soft error (audit R-1: a bad/missing provider key
   * produces a silent empty turn), emitting an `error` progress event.
   */
  async prompt(text: string): Promise<PromptResponse> {
    const { client, sessionId } = this.requireSession();

    this.sawContentThisTurn = false;
    const result = await client.prompt(sessionId, text);
    this.flushThoughts(); // emit any trailing reasoning as one entry
    const totalTokens = result.usage?.totalTokens ?? null;
    const emptyTurn = result.stopReason === 'end_turn'
      && !this.sawContentThisTurn
      && (totalTokens === 0 || (result.usage?.outputTokens ?? null) === 0);

    if (emptyTurn) {
      traceAcp('manager', 'soft-error:empty-turn', { usage: result.usage });
      this.emit(
        'error',
        'The model returned no output. This usually means the selected provider has no valid API key, or the request was rejected. Check your API keys in Settings.',
      );
    } else {
      this.emit('done', '');
    }
    return result;
  }

  /**
   * Cancel the in-flight turn. OpenCode 1.15.13 does not implement
   * session/cancel (audit T9/R-2), so AcpClient.cancel falls back to killing
   * the process. The session is abandoned; callers must start() a new one.
   */
  async cancel(): Promise<void> {
    if (this.client && this.sessionId) {
      await this.client.cancel(this.sessionId);
    }
    this.client = null;
    this.sessionId = null;
  }

  /** Tear down the session and kill the agent process. */
  dispose(): void {
    this.client?.dispose();
    this.client = null;
    this.sessionId = null;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /** Whether the current turn produced any streamed content (for soft-error). */
  private sawContentThisTurn = false;

  /**
   * OpenCode streams reasoning as per-word `agent_thought_chunk`s. Emitting each
   * as its own 'thinking' progress floods the activity list (hundreds of one-word
   * entries), so buffer them and flush one coalesced 'thinking' entry per burst.
   */
  private thoughtBuffer = '';

  private flushThoughts(): void {
    if (this.thoughtBuffer) {
      this.emit('thinking', this.thoughtBuffer);
      this.thoughtBuffer = '';
    }
  }

  private requireSession(): { client: AcpClient; sessionId: string } {
    if (!this.client || !this.sessionId) {
      throw new Error('ACP session is not running');
    }
    return { client: this.client, sessionId: this.sessionId };
  }

  /**
   * Build the spawn env: process.env + BYOK provider keys + the mandatory
   * OPENCODE_PERMISSION lever (R4). BYOK keys are injected here, never written
   * to disk or sent to the webview.
   */
  private buildSpawnEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ...this.config.byokEnv,
      OPENCODE_PERMISSION,
    };
  }

  /**
   * Map a session/update notification to an AgentProgress event (R5). Mirrors
   * the technical-plan mapping table:
   *   agent_message_chunk → text
   *   agent_thought_chunk → thinking
   *   tool_call           → tool_use (tool title + first location path)
   *   plan                → plan_text
   * tool_call_update / available_commands_update / usage_update are ignored for
   * the baseline UI (audit R-7).
   */
  private handleSessionUpdate(params: SessionNotification): void {
    const update = params.update;
    // Any non-thought update ends the current reasoning burst — flush it as a
    // single coalesced 'thinking' entry before handling the new update.
    if (update.sessionUpdate !== 'agent_thought_chunk') {
      this.flushThoughts();
    }
    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const text = update.content.type === 'text' ? update.content.text : '';
        if (text) {
          this.sawContentThisTurn = true;
          this.emit('text', text);
        }
        break;
      }
      case 'agent_thought_chunk': {
        const text = update.content.type === 'text' ? update.content.text : '';
        if (text) {
          this.sawContentThisTurn = true;
          this.thoughtBuffer += text;
        }
        break;
      }
      case 'tool_call': {
        traceAcp('manager', 'update:tool_call', { title: update.title, kind: update.kind });
        this.sawContentThisTurn = true;
        this.emit('tool_use', update.title, {
          tool: update.title,
          file: update.locations?.[0]?.path,
        });
        break;
      }
      case 'plan': {
        this.sawContentThisTurn = true;
        const text = update.entries.map((entry) => `- ${entry.content}`).join('\n');
        this.emit('plan_text', text);
        break;
      }
      default:
        // tool_call_update, available_commands_update, usage_update, etc. —
        // not surfaced in the baseline UI.
        traceAcp('manager', 'session-update:ignored', { type: update.sessionUpdate });
        break;
    }
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    traceAcp('manager', 'agent-exit', { code, signal });
    this.client = null;
    this.sessionId = null;
    // Non-zero exit with no signal is an unexpected crash (R5: surface errors).
    if (code !== null && code !== 0) {
      this.emit('error', `OpenCode agent exited unexpectedly (code ${code}).`);
    }
  }

  private emit(type: AgentProgressType, message: string, extra?: { tool?: string; file?: string }): void {
    this.config.onProgress({
      type,
      message,
      tool: extra?.tool,
      file: extra?.file,
      timestamp: Date.now(),
    });
  }
}
