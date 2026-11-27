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

import { commandStep } from '../runtime/commandStep';
import { documentReadReasonOf, documentStepKind, isDocumentReadTool, toolStepResult, type ToolStep } from '../runtime/toolStep';
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
import { AcpTurnChanges } from './acpTurnChanges';
import type { ExplicitThinkingEffort, ThinkingEffortCapability } from '../runtime/thinkingEffort';
import { isExplicitThinkingEffort } from '../runtime/thinkingEffort';
import * as path from 'path';

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
  /** Runtime-owned command directories prepended for child-process discovery. */
  pathEntries?: string[];
  /**
   * MCP stdio server descriptors to pass to session/new: Ritemark's tool
   * groups (browser, task board) from RitemarkToolsInjector.
   */
  mcpServers?: unknown[];
  /** Permission handler — Phase 4 renders the approval UI. */
  requestPermission: (params: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  /**
   * Sprint 141 R10: OpenCode's own model list, from the `model` config option of a
   * new or resumed session — every model this OpenCode can run.
   */
  onModelOptions?: (options: Array<{ value: string; name?: string }>) => void;
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

interface AcpTurnObserver {
  onActivity: () => void;
  onApproval: (waiting: boolean) => void;
  onToolRunning: (running: boolean) => void;
}

const ACP_CANCELLED_PROMPT_DRAIN_MS = 2_000;

interface AcpTurn {
  observer?: AcpTurnObserver;
  response: Promise<PromptResponse>;
  cancelled: boolean;
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
  turn?: AcpTurn;
  /**
   * Sprint 130 (G4): the text of the turn's latest assistant message. ACP marks
   * message boundaries with `messageId`; the last message is the agent's
   * conclusion, which a task shows as its result.
   */
  lastMessage: { id: string | null; text: string };
  /** Sprint 155: the files this turn's completed `edit` tool calls changed. */
  turnChanges: AcpTurnChanges;
  runningToolCalls: Set<string>;
  toolSteps: Map<string, { tool: string; step: ToolStep; command?: string }>;
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

/**
 * Sprint 141 R10: the `model` config option's choices, as `{ value, name }`. OpenCode
 * sends a flat list; grouped options are flattened.
 */
export function openCodeModelOptions(configOptions: readonly SessionConfigOption[]): Array<{ value: string; name?: string }> {
  const option = configOptions.find((candidate) => {
    const record = candidate as unknown as Record<string, unknown>;
    return record.id === 'model' || record.configId === 'model' || record.category === 'model';
  }) as unknown as { options?: unknown[] } | undefined;
  const out: Array<{ value: string; name?: string }> = [];
  const visit = (entries: unknown[] | undefined): void => {
    for (const entry of entries ?? []) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as Record<string, unknown>;
      if (Array.isArray(record.options)) visit(record.options);
      if (typeof record.value === 'string' && record.value.length <= 200) {
        out.push({ value: record.value, ...(typeof record.name === 'string' ? { name: record.name } : {}) });
      }
    }
  };
  visit(option?.options);
  return out.slice(0, 2000);
}

export class AcpManager {
  private readonly config: AcpManagerConfig;
  private client: AcpClient | null = null;
  private readonly sessions = new Map<string, AcpSessionState>();

  constructor(config: AcpManagerConfig, private readonly cancelledPromptDrainMs = ACP_CANCELLED_PROMPT_DRAIN_MS) {
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
  async start(signal?: AbortSignal): Promise<string> {
    const client = await this.ensureClient();
    signal?.throwIfAborted();
    const session = await client.newSession(this.config.workspaceRoot, this.config.mcpServers);
    signal?.throwIfAborted();
    this.sessions.set(session.sessionId, {
      sessionId: session.sessionId,
      sawContentThisTurn: false,
      thoughtBuffer: '',
      lastMessage: { id: null, text: '' },
      turnChanges: new AcpTurnChanges(),
      runningToolCalls: new Set(),
      toolSteps: new Map(),
      configOptions: session.configOptions ?? [],
      initialThoughtLevel: thoughtLevelCurrent(session.configOptions ?? []),
      currentModel: null,
    });
    this.reportModelOptions(session.configOptions ?? []);
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
      lastMessage: { id: null, text: '' },
      turnChanges: new AcpTurnChanges(),
      runningToolCalls: new Set(),
      toolSteps: new Map(),
      configOptions: session.configOptions ?? [],
      initialThoughtLevel: thoughtLevelCurrent(session.configOptions ?? []),
      currentModel: null,
    });
    this.reportModelOptions(session.configOptions ?? []);
    this.emit(sessionId, 'init', 'Resuming OpenCode session…');
    traceAcp('manager', 'resumed', { liveSessions: this.sessions.size });
  }

  /** Sprint 141 R10: hand OpenCode's model list to the catalog; never throws. */
  private reportModelOptions(configOptions: SessionConfigOption[]): void {
    if (!this.config.onModelOptions) return;
    try {
      const options = openCodeModelOptions(configOptions);
      if (options.length > 0) this.config.onModelOptions(options);
    } catch {
      // A list we can't read leaves the catalog's static rows in place.
    }
  }

  private async ensureClient(): Promise<AcpClient> {
    if (this.client) return this.client;
    const fsProxy = new AcpFsProxy({
      workspaceRoot: this.config.workspaceRoot,
      backend: this.config.fsBackend,
      approveWrite: (request) => this.withApproval(request.sessionId, false, () => this.config.approveWrite(request)),
      trace: traceAcp,
    });
    const handlers: AcpClientHandlers = {
      requestPermission: (params) => this.withApproval<RequestPermissionResponse>(
        params.sessionId, { outcome: { outcome: 'cancelled' } }, () => this.config.requestPermission(params),
      ),
      sessionUpdate: (params) => this.handleSessionUpdate(params),
      readTextFile: (params) => {
        const turn = this.sessions.get(params.sessionId)?.turn;
        if (!turn?.cancelled) turn?.observer?.onActivity();
        return fsProxy.readTextFile(params);
      },
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
  /**
   * Sprint 130 (G4): the turn's last assistant message, when OpenCode marked
   * message boundaries; otherwise the whole streamed text (no boundary seen).
   */
  lastAgentMessage(sessionId: string): string {
    return this.sessions.get(sessionId)?.lastMessage.text.trim() ?? '';
  }

  /** Sprint 155: the files the turn's completed edits changed (never its reads). */
  turnFilesModified(sessionId: string): string[] {
    return this.sessions.get(sessionId)?.turnChanges.files() ?? [];
  }

  /** Drain trailing updates before reusing a session, or replace it if the agent never settles. */
  async preparePrompt(sessionId: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    const { state } = this.requireSession(sessionId);
    const previous = state.turn;
    if (!previous?.cancelled) return sessionId;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopDrain: (() => void) | undefined;
    try {
      await Promise.race([
        previous.response.catch(() => undefined),
        new Promise<void>((resolve) => {
          stopDrain = resolve;
          timer = setTimeout(resolve, this.cancelledPromptDrainMs);
          signal?.addEventListener('abort', stopDrain, { once: true });
        }),
      ]);
    } finally {
      clearTimeout(timer);
      if (stopDrain) signal?.removeEventListener('abort', stopDrain);
    }
    signal?.throwIfAborted();
    if (this.sessions.get(sessionId) !== state) throw new Error(`ACP session is not running: ${sessionId}`);
    if (state.turn !== previous) return sessionId;

    // Notifications carry only a session ID. A new session isolates late updates
    // and permission requests from the abandoned one without stopping siblings.
    this.closeSession(sessionId);
    return this.start(signal);
  }

  async prompt(sessionId: string, text: string, observer?: AcpTurnObserver, signal?: AbortSignal): Promise<PromptResponse> {
    if (this.sessions.get(sessionId)?.turn?.cancelled) {
      sessionId = await this.preparePrompt(sessionId, signal);
    }
    signal?.throwIfAborted();
    const { client, state } = this.requireSession(sessionId);
    if (state.turn) throw new Error('An ACP prompt is already running for this session');

    state.sawContentThisTurn = false;
    state.thoughtBuffer = '';
    state.lastMessage = { id: null, text: '' };
    state.turnChanges.reset();
    state.toolSteps.clear();
    state.runningToolCalls.clear();

    const turn: AcpTurn = { observer, response: client.prompt(sessionId, text), cancelled: false };
    state.turn = turn;
    let result: PromptResponse;
    try {
      result = await turn.response;
    } catch (err) {
      if (!turn.cancelled) throw err;
      return { stopReason: 'cancelled' };
    } finally {
      if (state.turn === turn) state.turn = undefined;
    }

    if (turn.cancelled) return { stopReason: 'cancelled' };
    this.flushThoughts(state); // emit any trailing reasoning as one entry

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

  /** Cancel the in-flight prompt and preserve the session for another turn. */
  async cancelTurn(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    const turn = state?.turn;
    if (!state || !turn || turn.cancelled || !this.client) return;
    turn.cancelled = true;
    state.thoughtBuffer = '';
    await this.client.cancel(sessionId);
    traceAcp('manager', 'turn-cancelled', { sessionId });
  }

  /** Stop and discard a conversation's session. */
  async cancel(sessionId: string): Promise<void> {
    const cancelling = this.cancelTurn(sessionId);
    this.sessions.delete(sessionId);
    await cancelling;
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

  private async withApproval<T>(sessionId: string, cancelled: T, ask: () => Promise<T>): Promise<T> {
    const state = this.sessions.get(sessionId);
    if (!state || state.turn?.cancelled) return cancelled;
    const observer = state.turn?.observer;
    observer?.onApproval(true);
    try {
      return await ask();
    } finally {
      observer?.onApproval(false);
    }
  }

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
    const inheritedPath = this.config.byokEnv?.PATH ?? process.env.PATH ?? '';
    const managedPath = [...(this.config.pathEntries ?? []), inheritedPath].filter(Boolean).join(path.delimiter);
    return {
      ...process.env,
      ...this.config.byokEnv,
      ...(managedPath ? { PATH: managedPath } : {}),
      OPENCODE_PERMISSION,
    };
  }

  /**
   * Map a session/update notification to an AgentProgress event (R5). Mirrors
   * the technical-plan mapping table:
   *   agent_message_chunk → text
   *   agent_thought_chunk → thinking
   *   tool_call           → tool_use (including arguments for named steps)
   *   plan                → plan_text
   * tool_call_update refreshes named steps. available_commands_update / usage_update are ignored for
   * the baseline UI (audit R-7).
   *
   * Sprint 99: routes on `params.sessionId`. An update for an unknown or
   * cancelled turn is dropped, never delivered to another chat (R5).
   */
  private handleSessionUpdate(params: SessionNotification): void {
    const sessionId = params.sessionId as string;
    const state = this.sessions.get(sessionId);
    if (!state) {
      traceAcp('manager', 'session-update:unknown-session', { sessionId });
      return;
    }
    if (state.turn?.cancelled) {
      traceAcp('manager', 'session-update:dropped-after-cancel', { sessionId });
      return;
    }

    const update = params.update;
    if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
      state.turn?.observer?.onActivity();
    }
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
          const messageId = update.messageId ?? null;
          if (messageId && messageId !== state.lastMessage.id) state.lastMessage = { id: messageId, text };
          else state.lastMessage.text += text;
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
      case 'tool_call':
      case 'tool_call_update': {
        traceAcp('manager', `update:${update.sessionUpdate}`, { sessionId, title: update.title, kind: update.kind, status: update.status });
        // A tool_call's status is optional in ACP and defaults to pending.
        if (update.status === 'pending' || update.status === 'in_progress' || (update.sessionUpdate === 'tool_call' && update.status == null)) {
          state.runningToolCalls.add(update.toolCallId);
        } else if (update.status === 'completed' || update.status === 'failed') {
          state.runningToolCalls.delete(update.toolCallId);
        }
        state.turn?.observer?.onToolRunning(state.runningToolCalls.size > 0);
        state.turnChanges.note(update);
        const start = update.sessionUpdate === 'tool_call';
        if (start) state.sawContentThisTurn = true;
        const previous = state.toolSteps.get(update.toolCallId);
        const raw = update.rawInput as { path?: unknown; filePath?: unknown; command?: unknown; pattern?: unknown; tool?: unknown } | undefined;
        const tool = update.title ?? previous?.tool ?? '';
        const documentTool = isDocumentReadTool(tool) || (typeof raw?.tool === 'string' && isDocumentReadTool(raw.tool));
        const inputPath = raw?.path ?? raw?.filePath;
        const file = typeof inputPath === 'string' ? inputPath : update.locations?.[0]?.path ?? previous?.step.path;
        const command = typeof raw?.command === 'string' ? raw.command : previous?.command;
        let kind = previous?.step.kind;
        if (documentTool) kind = 'read';
        else if (update.kind === 'execute' || /^(?:bash|terminal)(?:$|[ :])/i.test(tool) || command) kind = 'shell';
        else if (/^(?:glob|ls|list)(?:$|[ :])/i.test(tool) || (update.kind === 'read' && file && !documentStepKind(file) && /[\\/]$/.test(file))) kind = 'folder';
        else if (update.kind === 'read') kind = 'read';

        if (kind) {
          let step: ToolStep = { id: update.toolCallId, kind, path: file, command: command ?? (kind === 'shell' ? tool : typeof raw?.pattern === 'string' ? raw.pattern : undefined) };
          if (kind === 'shell') step = commandStep(step, undefined, this.config.workspaceRoot, this.config.workspaceRoot);
          const stepTool = documentTool ? 'read_document' : tool;
          if (update.status === 'completed' || update.status === 'failed') {
            const output = update.content?.length ? update.content : update.rawOutput;
            step = toolStepResult(step, output, update.status === 'failed', documentTool, documentReadReasonOf(update.rawOutput));
            state.toolSteps.delete(update.toolCallId);
          } else {
            state.toolSteps.set(update.toolCallId, { tool: stepTool, step, command: kind === 'shell' ? step.command : undefined });
          }
          this.emit(sessionId, 'tool_use', tool, { tool: stepTool, file, step });
        } else if (start) {
          this.emit(sessionId, 'tool_use', tool, { tool, file });
        }
        break;
      }
      default:
        // available_commands_update, usage_update, etc. —
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

  private emit(sessionId: string, type: AgentProgressType, message: string, extra?: { tool?: string; file?: string; step?: ToolStep }): void {
    this.config.onProgress({
      type,
      message,
      tool: extra?.tool,
      file: extra?.file,
      ...(extra?.step ? { step: extra.step } : {}),
      timestamp: Date.now(),
    }, sessionId);
  }
}
