/**
 * ACP Manager
 *
 * Sprint 76 R1/R4/R5/R6: orchestrates an ACP agent session — spawn, prompt,
 * model selection, cancellation, dispose — and maps `session/update`
 * notifications onto Ritemark's `AgentProgress` events. This is the
 * OpenCode-aware layer (env injection, permission lever, cancel fallback) on
 * top of the agent-agnostic AcpClient.
 *
 * Sprint 99 (decision D1, confirmed by the Phase-0 spike): MULTI-SESSION inside
 * ONE subprocess. The spike proved OpenCode serves two ACP sessions
 * concurrently from one process, and that one process with 5 sessions costs
 * 339 MB against 1291 MB for 5 processes. Everything that used to be a scalar
 * here — `sessionId`, `sawContentThisTurn`, `thoughtBuffer` — is now per
 * session, and `handleSessionUpdate` routes on `params.sessionId`, which it
 * previously ignored entirely.
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
  SessionConfigOption,
} from '@agentclientprotocol/sdk';
import { AcpClient, type AcpClientHandlers } from './acpClient';
import { AcpFsProxy, type AcpFsBackend, type AcpWriteApproval } from './acpFsProxy';
import { traceAcp } from './acpTrace';
import type { ExplicitThinkingEffort, ThinkingEffortCapability } from '../runtime/thinkingEffort';
import { isExplicitThinkingEffort } from '../runtime/thinkingEffort';

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
  /**
   * Progress sink (R5 streaming). `sessionId` identifies which ACP session the
   * event came from — required under Sprint 99 multi-session so the embedder
   * can route it to the right conversation.
   */
  onProgress: (progress: AgentProgress, sessionId: string) => void;
  /** Live ACP config changes can add/remove thought-level choices mid-session. */
  onThinkingEffortCapability?: (capability: ThinkingEffortCapability, sessionId: string) => void;
  /** Filesystem backend override (tests inject a fake). */
  fsBackend?: AcpFsBackend;
}

/** Per-session turn state. Every field here used to be a manager-wide scalar. */
interface AcpSessionState {
  readonly sessionId: string;
  /** Whether the current turn produced any streamed content (for soft-error). */
  sawContentThisTurn: boolean;
  /**
   * OpenCode streams reasoning as per-word `agent_thought_chunk`s. Emitting each
   * as its own 'thinking' progress floods the activity list (hundreds of one-word
   * entries), so buffer them and flush one coalesced 'thinking' entry per burst.
   * Per-session, or two sessions' reasoning interleaves into one garbled stream.
   */
  thoughtBuffer: string;
  /**
   * Set by cancel(). The turn settles asynchronously even when OpenCode honours
   * the cancel, so its trailing updates are dropped until it does — otherwise a
   * chat the user already saw go idle would come back to life.
   */
  cancelRequested: boolean;
  /** Full live option set returned by ACP session setup / config mutation. */
  configOptions: SessionConfigOption[];
  /** Original provider selection used when Composer returns to Auto. */
  initialThoughtLevel: string | null;
  /** Avoid re-applying the same model and accidentally recapturing an override as Auto. */
  currentModel: string | null;
}

function thoughtLevelOption(options: SessionConfigOption[]): SessionConfigOption | undefined {
  return options.find((option) => option.category === 'thought_level' && option.type === 'select');
}

function optionValues(option: SessionConfigOption | undefined): string[] {
  if (!option || option.type !== 'select') return [];
  return option.options.flatMap((entry) => (
    'value' in entry ? [entry.value] : entry.options.map((child) => child.value)
  ));
}

function thoughtLevelCurrent(options: SessionConfigOption[]): string | null {
  const option = thoughtLevelOption(options);
  return option?.type === 'select' && typeof option.currentValue === 'string'
    ? option.currentValue
    : null;
}

export class AcpManager {
  private readonly config: AcpManagerConfig;
  private client: AcpClient | null = null;
  private readonly sessions = new Map<string, AcpSessionState>();

  constructor(config: AcpManagerConfig) {
    this.config = config;
  }

  /** True while the agent process is live. */
  isRunning(): boolean {
    return this.client !== null && this.client.isRunning();
  }

  /** Number of live ACP sessions sharing the subprocess. */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * The sole live session id, or null. Retained for single-session callers and
   * tests; under multi-session use the id returned by start().
   */
  get currentSessionId(): string | null {
    if (this.sessions.size !== 1) return null;
    return this.sessions.keys().next().value ?? null;
  }

  /** True when the given ACP session is open. */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Ensure the agent subprocess is up (spawn + handshake on first call) and open
   * a NEW session on it. Returns the new session id.
   *
   * Sprint 99: the old "ACP session is already running" throw is gone — opening
   * a second session on the same connection is exactly the supported case now.
   */
  async start(): Promise<string> {
    const client = await this.ensureClient();
    const session = await client.newSession(this.config.workspaceRoot, this.config.mcpServers);
    this.sessions.set(session.sessionId, {
      sessionId: session.sessionId,
      sawContentThisTurn: false,
      thoughtBuffer: '',
      cancelRequested: false,
      configOptions: session.configOptions ?? [],
      initialThoughtLevel: thoughtLevelCurrent(session.configOptions ?? []),
      currentModel: null,
    });
    this.emit(session.sessionId, 'init', 'Starting OpenCode session…');
    traceAcp('manager', 'started', { sessionId: session.sessionId, liveSessions: this.sessions.size });
    return session.sessionId;
  }

  /** Resume uses ACP session/resume only. session/load is intentionally forbidden. */
  async resume(sessionId: string): Promise<void> {
    const client = await this.ensureClient();
    const session = await client.resumeSession(sessionId, this.config.workspaceRoot, this.config.mcpServers);
    this.sessions.set(sessionId, {
      sessionId,
      sawContentThisTurn: false,
      thoughtBuffer: '',
      cancelRequested: false,
      configOptions: session.configOptions ?? [],
      initialThoughtLevel: thoughtLevelCurrent(session.configOptions ?? []),
      currentModel: null,
    });
    this.emit(sessionId, 'init', 'Resuming OpenCode session…');
    traceAcp('manager', 'resumed', { liveSessions: this.sessions.size });
  }

  private async ensureClient(): Promise<AcpClient> {
    if (this.client) return this.client;
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
    const client = new AcpClient({
      command: this.config.binaryPath,
      args: this.config.args,
      cwd: this.config.workspaceRoot,
      env: this.buildSpawnEnv(),
      handlers,
      onExit: (code, signal) => this.handleExit(code, signal),
      onStderr: (line) => traceAcp('manager', 'stderr', line),
      trace: traceAcp,
    });
    this.client = client;
    try {
      await client.initialize();
      return client;
    } catch (error) {
      if (this.client === client) this.client = null;
      throw error;
    }
  }

  /**
   * Set the session model (R6). `providerModel` is the `<provider>/<model>`
   * value (the `opencode:` composite prefix is dropped before this call).
   */
  async setModel(sessionId: string, providerModel: string): Promise<void> {
    const { client, state } = this.requireSession(sessionId);
    if (state.currentModel === providerModel) return;
    const result = await client.setModel(sessionId, providerModel);
    state.configOptions = result.configOptions;
    const thought = thoughtLevelOption(result.configOptions);
    state.initialThoughtLevel = thought?.type === 'select' && typeof thought.currentValue === 'string'
      ? thought.currentValue
      : null;
    state.currentModel = providerModel;
  }

  /** Capability is derived only from the live semantic ACP option. */
  getThinkingEffortCapability(sessionId: string): ThinkingEffortCapability {
    const state = this.sessions.get(sessionId);
    const option = thoughtLevelOption(state?.configOptions ?? []);
    const selectable = optionValues(option).filter(isExplicitThinkingEffort);
    const providerDefault = state?.initialThoughtLevel;
    return {
      selectable,
      ...(isExplicitThinkingEffort(providerDefault) ? { defaultLevel: providerDefault } : {}),
      source: 'runtime-live',
      supportsAppliedValue: true,
    };
  }

  /** Apply a manual value, or restore the original live option value for Auto. */
  async setThinkingEffort(
    sessionId: string,
    effort: ExplicitThinkingEffort | 'auto',
  ): Promise<ExplicitThinkingEffort | undefined> {
    const { client, state } = this.requireSession(sessionId);
    const option = thoughtLevelOption(state.configOptions);
    if (!option || option.type !== 'select') {
      if (effort === 'auto') return undefined;
      throw new Error('OpenCode does not advertise a thought-level option for this session');
    }
    const target = effort === 'auto' ? state.initialThoughtLevel : effort;
    if (!target) return undefined;
    if (!optionValues(option).includes(target)) {
      throw new Error(`OpenCode does not advertise thinking effort: ${target}`);
    }
    const result = await client.setSessionConfigOption(sessionId, option.id, target);
    state.configOptions = result.configOptions;
    const applied = thoughtLevelOption(result.configOptions);
    return applied?.type === 'select' && isExplicitThinkingEffort(applied.currentValue)
      ? applied.currentValue
      : undefined;
  }

  /**
   * Send a prompt and await the turn. A 0-token `end_turn` with no streamed
   * content is treated as a soft error (audit R-1: a bad/missing provider key
   * produces a silent empty turn), emitting an `error` progress event.
   */
  async prompt(sessionId: string, text: string): Promise<PromptResponse> {
    const { client, state } = this.requireSession(sessionId);

    state.sawContentThisTurn = false;
    state.cancelRequested = false;

    let result: PromptResponse;
    try {
      result = await client.prompt(sessionId, text);
    } catch (err) {
      // A cancelled turn can reject rather than resolve — historically because
      // cancelling killed the process ("ACP connection closed"), and still
      // possible if the connection drops mid-turn. Either way it is the cancel
      // working, not a failure: surfacing it showed the user a raw protocol
      // error every time they pressed Stop.
      if (state.cancelRequested) {
        state.cancelRequested = false;
        this.flushThoughts(state);
        traceAcp('manager', 'prompt rejected by user cancel — reported as cancelled', {
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
        return { stopReason: 'cancelled' } as PromptResponse;
      }
      throw err;
    }

    this.flushThoughts(state); // emit any trailing reasoning as one entry

    if (state.cancelRequested) {
      // The user already saw this chat go idle; do not resurrect it with a late
      // completion or a spurious "no output" error.
      state.cancelRequested = false;
      traceAcp('manager', 'turn settled after cancel — result discarded', { sessionId });
      return result;
    }

    const totalTokens = result.usage?.totalTokens ?? null;
    const emptyTurn = result.stopReason === 'end_turn'
      && !state.sawContentThisTurn
      && (totalTokens === 0 || (result.usage?.outputTokens ?? null) === 0);

    if (emptyTurn) {
      traceAcp('manager', 'soft-error:empty-turn', { sessionId, usage: result.usage });
      this.emit(
        sessionId,
        'error',
        'The model returned no output. This usually means the selected provider has no valid API key, or the request was rejected. Check your API keys in Settings.',
      );
    } else {
      this.emit(sessionId, 'done', '');
    }
    return result;
  }

  /**
   * Cancel the in-flight turn for ONE session.
   *
   * OpenCode implements session/cancel as of 1.18.4, so this is now a plain
   * per-session cancel: the turn settles `cancelled` and the subprocess — shared
   * with every other conversation — is left alone. Before that the only thing
   * that actually stopped the work was killing the process, which is why this
   * used to special-case being the last session standing.
   *
   * `cancelRequested` stays: the turn still settles asynchronously, and its
   * trailing updates must be discarded rather than resurrecting a chat the user
   * has already seen go idle.
   */
  async cancel(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    const client = this.client;
    if (!state || !client) return;

    state.cancelRequested = true;
    state.thoughtBuffer = '';
    this.sessions.delete(sessionId);

    await client.cancel(sessionId);
    traceAcp('manager', 'session-cancelled', { sessionId, liveSessions: this.sessions.size });
  }

  /** Close ONE session. Siblings and the subprocess keep running. */
  closeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    traceAcp('manager', 'session-closed', { sessionId, liveSessions: this.sessions.size });
  }

  /** Tear down every session and kill the agent process. */
  dispose(): void {
    this.client?.dispose();
    this.client = null;
    this.sessions.clear();
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private flushThoughts(state: AcpSessionState): void {
    if (state.thoughtBuffer) {
      this.emit(state.sessionId, 'thinking', state.thoughtBuffer);
      state.thoughtBuffer = '';
    }
  }

  private requireSession(sessionId: string): { client: AcpClient; state: AcpSessionState } {
    const state = this.sessions.get(sessionId);
    if (!this.client || !state) {
      throw new Error(`ACP session is not running: ${sessionId}`);
    }
    return { client: this.client, state };
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
   *
   * Sprint 99: routes on `params.sessionId`. An update for an unknown or
   * cancel-requested session is dropped, never delivered to another chat (R5).
   */
  private handleSessionUpdate(params: SessionNotification): void {
    const sessionId = params.sessionId as string;
    const state = this.sessions.get(sessionId);
    if (!state) {
      traceAcp('manager', 'session-update:unknown-session', { sessionId });
      return;
    }
    if (state.cancelRequested) {
      traceAcp('manager', 'session-update:dropped-after-cancel', { sessionId });
      return;
    }

    const update = params.update;
    // Any non-thought update ends the current reasoning burst — flush it as a
    // single coalesced 'thinking' entry before handling the new update.
    if (update.sessionUpdate !== 'agent_thought_chunk') {
      this.flushThoughts(state);
    }
    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const text = update.content.type === 'text' ? update.content.text : '';
        if (text) {
          state.sawContentThisTurn = true;
          this.emit(sessionId, 'text', text);
        }
        break;
      }
      case 'agent_thought_chunk': {
        const text = update.content.type === 'text' ? update.content.text : '';
        if (text) {
          state.sawContentThisTurn = true;
          state.thoughtBuffer += text;
        }
        break;
      }
      case 'tool_call': {
        traceAcp('manager', 'update:tool_call', { sessionId, title: update.title, kind: update.kind });
        state.sawContentThisTurn = true;
        this.emit(sessionId, 'tool_use', update.title, {
          tool: update.title,
          file: update.locations?.[0]?.path,
        });
        break;
      }
      case 'plan': {
        state.sawContentThisTurn = true;
        const text = update.entries.map((entry) => `- ${entry.content}`).join('\n');
        this.emit(sessionId, 'plan_text', text);
        break;
      }
      case 'config_option_update': {
        state.configOptions = update.configOptions;
        this.config.onThinkingEffortCapability?.(
          this.getThinkingEffortCapability(sessionId),
          sessionId,
        );
        break;
      }
      default:
        // tool_call_update, available_commands_update, usage_update, etc. —
        // not surfaced in the baseline UI.
        traceAcp('manager', 'session-update:ignored', { sessionId, type: update.sessionUpdate });
        break;
    }
  }

  /**
   * The shared subprocess died: EVERY session dies with it. Sprint 99 makes
   * that explicit — each live session is failed by name rather than the old
   * behaviour of nulling shared fields and emitting one anonymous error.
   */
  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    traceAcp('manager', 'agent-exit', { code, signal, liveSessions: this.sessions.size });
    const dead = [...this.sessions.keys()];
    this.client = null;
    this.sessions.clear();
    // Non-zero exit with no signal is an unexpected crash (R5: surface errors).
    if (code !== null && code !== 0) {
      for (const sessionId of dead) {
        this.emit(sessionId, 'error', `OpenCode agent exited unexpectedly (code ${code}).`);
      }
    }
  }

  private emit(sessionId: string, type: AgentProgressType, message: string, extra?: { tool?: string; file?: string }): void {
    this.config.onProgress({
      type,
      message,
      tool: extra?.tool,
      file: extra?.file,
      timestamp: Date.now(),
    }, sessionId);
  }
}
