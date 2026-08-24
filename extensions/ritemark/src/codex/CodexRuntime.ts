/**
 * CodexRuntime — AgentRuntime adapter for the Codex (app-server) runtime.
 *
 * Wraps CodexAppServer + CodexAuth and maps Codex events / approvals to the
 * unified AgentRuntime interface. Does NOT rewrite CodexAppServer internals.
 *
 * Sprint 99: one `CodexSession` per conversation, ONE shared `codex-app-server`
 * process for all of them. The app-server protocol is natively multi-thread
 * (`thread/start` mints an id; `turn/start` / `turn/interrupt` take `threadId`)
 * and `rpc()` has no mutex or in-flight guard, so the concurrency was always
 * there — this adapter used to collapse it onto a single set of scalars.
 *
 * Event listeners stay registered ONCE on the shared app-server (registering per
 * thread would multiply listeners on one emitter and trip max-listener warnings);
 * only the destination lookup inside each callback became thread-aware.
 */

import * as crypto from 'crypto';
import { CodexAppServer } from './codexAppServer';
import { CodexAuth } from './codexAuth';
import { CodexManager } from './codexManager';
import type { CodexCompatibilityStatus } from './codexManager';
import type { ToolRequestUserInputAnswer } from './codexProtocol';
import { routeApprovalRequest, threadIdOf } from './codexApproval';
import { traceCodex } from './codexTrace';
import { emitCodexStatusInvalidated } from './codexStatusEvents';
import { buildCodexBrowserDynamicTools } from '../browser/codexBrowserTools';
import { isEnabled } from '../features';
import type { AgentId } from '../agent/types';
import type {
  AgentRuntime,
  RuntimeSession,
  RuntimeSessionConfig,
  RuntimeTurnConfig,
  RuntimeStatus,
  UnifiedApprovalRequest,
} from '../runtime/AgentRuntime';
import {
  continuationCheckpoint,
  frameRuntimePrompt,
  resolveRuntimeContinuation,
  transcriptRestoredState,
} from '../runtime/continuation';
import { isExplicitThinkingEffort } from '../runtime/thinkingEffort';
import type { ExplicitThinkingEffort } from '../runtime/thinkingEffort';

// ── Codex-specific constants ────────────────────────────────────────────────

/**
 * Defensive fallback base instructions. In normal operation Codex receives the
 * shared capability context (a superset of this) via `config.extraSystemPrompt`
 * — see `buildCodexBaseInstructions`. This const only applies if that context is
 * somehow absent, so it keeps the minimum markdown-editor framing.
 */
const CODEX_BASE_INSTRUCTIONS = [
  'You are running inside Ritemark — a markdown editor, not a code IDE.',
  'When the user asks you to modify, edit, simplify, rewrite, translate, or change text in the active file, use your file editing tools (apply_patch) to make the change directly in the file.',
  'Do NOT paraphrase the modification in chat when the user clearly wants a file edit — actually apply it.',
  'Reply text after a file edit should briefly confirm what changed, not restate the new text.',
  'Prefer structured protocol features over free-form text when the protocol supports them.',
].join(' ');

/**
 * Choose Codex's `baseInstructions`. Sprint 101 (#154): the shared capability
 * context (`src/ai/capabilityContext.ts`, rendered for the Codex descriptor) is
 * passed in via `extraSystemPrompt` and IS the base — it subsumes
 * `CODEX_BASE_INSTRUCTIONS` (same markdown-editor framing, plus comments/links/
 * user-only/browser/fallback awareness).
 *
 * This replaces the previous `config.extraSystemPrompt ?? CODEX_BASE_INSTRUCTIONS`
 * where `extraSystemPrompt` carried ONLY the browser hint and thus silently wiped
 * Codex's Ritemark-aware base. It no longer can: the only thing placed in
 * `extraSystemPrompt` now is the full capability context. `CODEX_BASE_INSTRUCTIONS`
 * survives purely as a defensive fallback when the context is absent.
 */
export function buildCodexBaseInstructions(extraSystemPrompt: string | undefined): string {
  return extraSystemPrompt && extraSystemPrompt.trim()
    ? extraSystemPrompt
    : CODEX_BASE_INSTRUCTIONS;
}

const CODEX_PLAN_DEVELOPER_INSTRUCTIONS = [
  // Sprint 103 R5: plan turns run in a READ-ONLY sandbox — the model must know
  // it is planning, not executing, or it wastes the turn on blocked edits and
  // ends with an apology instead of a plan.
  'You are in a PLANNING phase: the workspace is read-only for this turn, so do not attempt to edit files or run write commands.',
  'Read what you need, then present a short, reviewable plan of the intended changes (files, sections, new content). The user approves the plan before any execution happens.',
  'When you need the user to choose between options or provide required clarifications before continuing, you must use the request_user_input tool instead of asking in plain assistant text.',
  'Do not present a question as normal chat text if request_user_input can express it.',
  'When you produce a plan, prefer structured plan updates over embedding the whole plan only in prose.',
  'If you already asked for user input via request_user_input, wait for the answer instead of ending the turn with the question rendered as plain text.',
].join(' ');

const CODEX_PLAN_TURN_REMINDER = [
  'Ritemark runtime reminder:',
  '- This is a PLANNING turn: the workspace is read-only. Do not attempt edits; present a reviewable plan instead.',
  '- If you need the user to answer a question or choose from options, you must call request_user_input.',
  '- Do not ask the question in normal assistant text when request_user_input can represent it.',
  '- If the user explicitly asked for multiple-choice questions, use request_user_input for them.',
  '- After calling request_user_input, wait for the answer instead of finishing the turn with the question in prose.',
].join('\n');

// Sprint 103 R1: prompt-text sniffing removed (decision D4) — plan-first is an
// explicit UI choice carried on `turn.mode`; words like "plan mode" in a prompt
// must never silently retarget permissions.

/**
 * Render a Codex turn error into a user-readable string.
 */
function formatCodexTurnError(error: unknown): string | undefined {
  if (error == null) return undefined;
  if (typeof error === 'string') return error.trim() || undefined;
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    try { return JSON.stringify(error); } catch { return undefined; }
  }
  return String(error);
}

export type CodexSidebarStatus = {
  enabled: boolean;
  state: 'disabled' | 'checking' | 'broken-install' | 'needs-auth' | 'auth-in-progress' | 'ready';
  version: string | null;
  authMethod: 'apiKey' | 'chatgpt' | null;
  email: string | null;
  plan: string | null;
  error: string | null;
  diagnostics: string[];
  repairCommand: string | null;
  binaryPath: string | null;
  compatibility: CodexCompatibilityStatus | null;
};

/**
 * One conversation's Codex thread.
 *
 * Everything that used to be a scalar on the adapter lives here. That is the
 * whole point of the class: with N conversations sharing one adapter, a scalar
 * `_threadId` / `_threadApprovalKey` / `_browserToolsEnabledForThread` meant
 * chat B toggling browser control (or switching Auto↔Ask) nulled chat A's
 * thread id and silently destroyed A's entire context.
 */
export class CodexSession implements RuntimeSession {
  readonly agentId: AgentId = 'codex';

  private _config: RuntimeSessionConfig;
  private _threadId: string | null = null;
  private _turnId: string | null = null;

  /**
   * Whether browser tools were wired into THIS conversation's thread, so a
   * thread reset is triggered when its browser-control state changes between
   * turns. Per-conversation since Sprint 99 (B1).
   */
  private _browserToolsEnabledForThread = false;

  /**
   * Approval policy + sandbox THIS conversation's thread was started with
   * ("<policy>:<sandbox>"). A change (e.g. Auto↔Ask) forces a reset of this
   * thread only, since both are fixed at threadStart. Per-conversation since
   * Sprint 99 (B1).
   */
  private _threadApprovalKey = '';

  /** Provider default captured before this session applies a manual override. */
  private _defaultThinkingEffort: ExplicitThinkingEffort | null = null;
  /** Auto only needs an explicit reset after a manual value changed the thread. */
  private _manualThinkingEffortApplied = false;

  /** Approval/question request ids raised by this conversation and still open. */
  private readonly _openRequestIds = new Set<string>();

  constructor(
    readonly conversationId: string,
    config: RuntimeSessionConfig,
    private readonly _runtime: CodexRuntime,
  ) {
    this._config = config;
  }

  get config(): RuntimeSessionConfig { return this._config; }
  get threadId(): string | null { return this._threadId; }
  get turnId(): string | null { return this._turnId; }

  /** Re-apply per-turn config to THIS conversation. Never touches siblings. */
  applyConfig(config: RuntimeSessionConfig): void {
    this._config = config;
  }

  /** True when browser dynamic tools are wired into this conversation's thread. */
  getBrowserToolsEnabled(): boolean { return this._browserToolsEnabledForThread; }

  /** Drop this conversation's thread (e.g. after logout). Siblings keep theirs. */
  resetThread(): void {
    this._clearThread();
    this._threadApprovalKey = '';
    this._runtime._clearRequestsFor(this.conversationId, this._openRequestIds, false);
  }

  async prompt(turn: RuntimeTurnConfig): Promise<void> {
    const appServer = this._runtime.getAppServer();
    if (!appServer) {
      throw new Error('CodexRuntime: createSession() must succeed before prompt()');
    }
    const config = this._config;
    const continuation = resolveRuntimeContinuation('codex', config.continuation);
    let useNativeContext = false;
    const resolvedModel = turn.model ?? config.model ?? null;
    // Sprint 103 R1 (D4): only the explicit turn mode selects plan-first.
    const shouldUsePlanMode = turn.mode === 'plan';

    const approvalPolicy = (config.codexApprovalPolicy ?? 'untrusted') as 'untrusted' | 'on-request' | 'on-failure' | 'never';
    // Sprint 103 R5: plan turns run in a READ-ONLY sandbox so "No files changed
    // yet" is enforced, not narrated. Sandbox is fixed at threadStart, so the
    // approvalKey below (which includes it) makes the existing reset machinery
    // recreate the thread when crossing the plan boundary; the approved-plan
    // continuation prompt re-carries the task context (audit Repro C).
    const sandbox = (shouldUsePlanMode
      ? 'read-only'
      : (config.codexSandboxMode ?? 'workspace-write')) as 'read-only' | 'workspace-write' | 'danger-full-access';
    const approvalKey = `${approvalPolicy}:${sandbox}`;

    // Reset THIS conversation's thread when its browser-tools state OR its
    // approval policy/sandbox would change — both are fixed at threadStart, so a
    // live thread must be recreated for a new unified approval mode (Auto↔Ask)
    // to take effect. Sibling conversations are untouched.
    const browserToolsNeeded = Boolean(config.onBrowserToolCall);
    if (this._threadId && browserToolsNeeded !== this._browserToolsEnabledForThread) {
      traceCodex('execution', 'resetting thread: browser-tools state changed', {
        conversationId: this.conversationId,
        was: this._browserToolsEnabledForThread,
        now: browserToolsNeeded,
      });
      this._clearThread();
    }
    if (this._threadId && approvalKey !== this._threadApprovalKey) {
      traceCodex('execution', 'resetting thread: approval config changed', {
        conversationId: this.conversationId,
        was: this._threadApprovalKey,
        now: approvalKey,
      });
      this._clearThread();
    }
    if (this._threadId) {
      useNativeContext = true;
      config.onContinuationState?.({ mode: 'native-restored' });
    }

    // Resume an exact-compatible provider thread on first turn. A rejected
    // native id falls through to a new thread; transcript fallback framing is
    // injected by the host coordinator, never by provider history replay.
    if (!this._threadId) {
      const dynamicTools = browserToolsNeeded ? buildCodexBrowserDynamicTools() : undefined;
      const planDevInstructions = config.codexPlanDeveloperInstructions ?? CODEX_PLAN_DEVELOPER_INSTRUCTIONS;
      let result: { thread: { id: string }; reasoningEffort?: string | null } | null = null;
      if (continuation.kind === 'native') {
        config.onContinuationState?.({ mode: 'pending' });
        try {
          result = await appServer.threadResume({
            threadId: continuation.descriptor.nativeReference,
            cwd: config.workspacePath || null,
            approvalPolicy,
            sandbox,
          });
          useNativeContext = true;
          config.onContinuationState?.({ mode: 'native-restored' });
        } catch (error) {
          traceCodex('execution', 'native thread resume rejected; starting fresh', {
            conversationId: this.conversationId,
            error: error instanceof Error ? error.message : String(error),
          });
          config.onContinuationState?.(config.continuation?.fallbackContext
            ? transcriptRestoredState(config.continuation.fallbackContext)
            : { mode: 'context-unavailable', failureCategory: 'provider-rejected' });
        }
      } else if (continuation.kind === 'fallback') {
        config.onContinuationState?.(config.continuation?.fallbackContext
          ? transcriptRestoredState(config.continuation.fallbackContext)
          : { mode: 'context-unavailable', failureCategory: continuation.failureCategory });
      }
      if (!result) {
        if (continuation.kind === 'fresh' && config.continuation?.fallbackContext) {
          config.onContinuationState?.(transcriptRestoredState(config.continuation.fallbackContext));
        }
        result = await appServer.threadStart({
          cwd: config.workspacePath || null,
          model: resolvedModel,
          approvalPolicy,
          sandbox,
          baseInstructions: buildCodexBaseInstructions(config.extraSystemPrompt),
          developerInstructions: shouldUsePlanMode ? planDevInstructions : null,
          ...(dynamicTools ? { dynamicTools } : {}),
        }, this.conversationId);
      }
      this._threadId = result.thread.id;
      const providerDefault = result.reasoningEffort;
      this._defaultThinkingEffort = isExplicitThinkingEffort(providerDefault)
        ? providerDefault
        : turn.thinkingEffortDefault ?? null;
      this._runtime._bindThread(result.thread.id, this);
      this._browserToolsEnabledForThread = Boolean(dynamicTools?.length);
      this._threadApprovalKey = approvalKey;
      const compatibility = config.continuation?.compatibility;
      if (compatibility) {
        config.onContinuationCheckpoint?.(continuationCheckpoint(
          result.thread.id,
          compatibility,
          continuation.kind === 'native'
            ? continuation.descriptor.coveredThroughEventId
            : config.continuation?.fallbackContext?.coveredThroughEventId ?? null,
        ));
      }
      traceCodex('execution', 'thread started', {
        conversationId: this.conversationId,
        approvalPolicy,
        sandbox,
        browserTools: this._browserToolsEnabledForThread,
      });
    }

    config.onProgress({ type: 'init', message: 'Starting Codex…', timestamp: Date.now() });

    // Convert image attachments to data URLs (Codex image input format)
    const imageDataUrls = turn.attachments
      ?.filter(a => a.kind === 'image')
      .map(a => `data:${a.mediaType};base64,${a.data}`) ?? [];

    // Inject active file context into prompt (mirrors Claude Code pattern)
    let enrichedPrompt = turn.prompt;
    if (turn.activeFile) {
      enrichedPrompt = `[Currently editing: ${turn.activeFile.path}]\n\n${enrichedPrompt}`;
    }
    // Inject plan reminder for plan mode turns
    if (shouldUsePlanMode) {
      enrichedPrompt = `${CODEX_PLAN_TURN_REMINDER}\n\n${enrichedPrompt}`;
    }
    enrichedPrompt = frameRuntimePrompt(
      enrichedPrompt,
      useNativeContext ? config.continuation?.nativeDelta : config.continuation?.fallbackContext,
    );

    const requestedThinkingEffort = turn.thinkingEffort ?? 'auto';
    const effectiveThinkingEffort = requestedThinkingEffort === 'auto'
      ? (this._manualThinkingEffortApplied ? this._defaultThinkingEffort ?? undefined : undefined)
      : requestedThinkingEffort;

    const collaborationMode = shouldUsePlanMode
      ? {
          mode: 'plan' as const,
          settings: {
            model: resolvedModel ?? 'gpt-5.6-sol',
            reasoning_effort: effectiveThinkingEffort ?? null,
            developer_instructions: config.codexPlanDeveloperInstructions ?? CODEX_PLAN_DEVELOPER_INSTRUCTIONS,
          },
        }
      : null;

    traceCodex('execution', 'prepared turn start', {
      conversationId: this.conversationId,
      threadId: this._threadId,
      model: resolvedModel,
      mode: turn.mode ?? (shouldUsePlanMode ? 'plan' : 'execute'),
      collaborationMode,
      hasImages: imageDataUrls.length > 0,
    });

    const turnResult = await appServer.turnStart(
      this._threadId,
      enrichedPrompt,
      resolvedModel ?? undefined,
      imageDataUrls.length > 0 ? imageDataUrls : undefined,
      collaborationMode,
      effectiveThinkingEffort,
    );
    this._manualThinkingEffortApplied = requestedThinkingEffort !== 'auto';
    config.onThinkingEffortApplied?.({
      requested: requestedThinkingEffort,
      adjusted: false,
    });
    this._turnId = turnResult.turn.id;
    config.onDispatchAccepted?.();
    traceCodex('execution', 'turn start acknowledged', {
      conversationId: this.conversationId,
      threadId: this._threadId,
      turnId: turnResult.turn.id,
      status: turnResult.turn.status,
    });
  }

  async cancel(): Promise<void> {
    const appServer = this._runtime.getAppServer();
    if (appServer && this._threadId && this._turnId) {
      await appServer.turnInterrupt(this._threadId, this._turnId).catch(() => {});
    }
    // Decline anything this conversation had outstanding. Interrupting the turn
    // does not answer an approval the app-server is already blocked on, so
    // pressing Stop while an approval card was up used to leave that request
    // dangling for the rest of the process's life. dispose() and resetThread()
    // already did this; cancel() did not.
    this._runtime._clearRequestsFor(this.conversationId, this._openRequestIds, true);
  }

  respondToApproval(requestId: string, approved: boolean, _alwaysAllow: boolean): void {
    const appServer = this._runtime.getAppServer();
    if (!appServer) return;
    this._openRequestIds.delete(requestId);
    // Translate the string requestId back to the original server request id
    const origId = this._runtime._takeServerRequestId(requestId) ?? requestId;
    appServer.sendApprovalResponse(origId, approved ? 'accept' : 'decline');
  }

  /** Answer a Codex request_user_input question raised by this conversation. */
  answerQuestion(requestId: string | number, answers: Record<string, unknown>): void {
    this._openRequestIds.delete(`codex-${String(requestId)}`);
    this._runtime.getAppServer()?.sendToolRequestUserInputResponse(
      requestId,
      answers as Record<string, ToolRequestUserInputAnswer>,
    );
  }

  dispose(): void {
    // Outstanding approvals this conversation raised must be declined, not left
    // dangling on the shared app-server.
    this._runtime._clearRequestsFor(this.conversationId, this._openRequestIds, true);
    this._clearThread();
    this._threadApprovalKey = '';
  }

  // ── Internal (adapter-facing) ──────────────────────────────────────────────

  /** @internal — event listeners on the shared app-server call these. */
  _onTurnCompleted(): void { this._turnId = null; }
  /** @internal */
  _trackRequest(requestId: string): void { this._openRequestIds.add(requestId); }
  /** @internal — the app-server died; drop this conversation's thread state. */
  _onServerExit(): void {
    this._clearThread();
    this._threadApprovalKey = '';
    this._openRequestIds.clear();
  }

  private _clearThread(): void {
    if (this._threadId) this._runtime._unbindThread(this._threadId);
    this._threadId = null;
    this._turnId = null;
    this._defaultThinkingEffort = null;
    this._manualThinkingEffortApplied = false;
  }
}

export class CodexRuntime implements AgentRuntime {
  readonly id: AgentId = 'codex';

  private _appServer: CodexAppServer | null = null;
  private _auth: CodexAuth | null = null;
  private _loginInProgress = false;
  private _loginPoll: ReturnType<typeof setInterval> | null = null;

  /** One session per conversation, all sharing the single app-server process. */
  private readonly _sessions = new Map<string, CodexSession>();
  /** Reverse index for routing wire events, which carry `threadId`, not ours. */
  private readonly _sessionsByThread = new Map<string, CodexSession>();

  /**
   * Maps the string requestId we expose externally (e.g. "codex-42") back to
   * the original server request id for response routing via sendApprovalResponse().
   *
   * Needs no re-keying for multi-thread: `codex-${request.id}` uses the
   * app-server's connection-wide JSON-RPC id, which is unique across threads.
   */
  private readonly _requestIdMap = new Map<string, string | number>();
  /** Parallel index: which conversation raised each outstanding request. */
  private readonly _requestConversation = new Map<string, string>();

  /** Expose the underlying app server for auth operations in UnifiedViewProvider. */
  getAppServer(): CodexAppServer | null { return this._appServer; }
  /** Expose the auth object for login/logout/status in UnifiedViewProvider. */
  getAuth(): CodexAuth | null { return this._auth; }

  /**
   * Reset EVERY conversation's thread (e.g. after logout or de-auth).
   * Sprint 99: this used to be the only reset path and it nulled one scalar;
   * with N threads live it must fan out.
   */
  resetSession(): void {
    for (const session of this._sessions.values()) session.resetThread();
  }

  /** Reset one conversation's thread. */
  resetConversation(conversationId: string): void {
    this._sessions.get(conversationId)?.resetThread();
  }

  async createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession> {
    this._ensureAppServer();
    await this._appServer!.ensureInitialized();

    const existing = this._sessions.get(conversationId);
    if (existing) {
      const continuation = resolveRuntimeContinuation('codex', config.continuation);
      if (continuation.kind === 'native' || !config.continuation?.fallbackContext) {
        existing.applyConfig(config);
        return existing;
      }
      this.disposeSession(conversationId);
    }
    const session = new CodexSession(conversationId, config, this);
    this._sessions.set(conversationId, session);
    return session;
  }

  /** Live session for a conversation, if one is open. */
  getSession(conversationId: string): CodexSession | undefined {
    return this._sessions.get(conversationId);
  }

  disposeSession(conversationId: string): void {
    const session = this._sessions.get(conversationId);
    if (!session) return;
    session.dispose();
    this._sessions.delete(conversationId);
  }

  /** Whether browser dynamic tools are wired into a conversation's thread. */
  getBrowserToolsEnabled(conversationId: string): boolean {
    return this._sessions.get(conversationId)?.getBrowserToolsEnabled() ?? false;
  }

  setLoginInProgress(v: boolean): void { this._loginInProgress = v; }

  isLoginInProgress(): boolean { return this._loginInProgress; }

  stopLoginPolling(): void {
    if (this._loginPoll) {
      clearInterval(this._loginPoll);
      this._loginPoll = null;
    }
  }

  startLoginPolling(onStatus: (status: CodexSidebarStatus) => void): void {
    this.stopLoginPolling();
    let attempts = 0;
    this._loginPoll = setInterval(() => {
      attempts += 1;
      void (async () => {
        const status = await this.getCodexSidebarStatus();
        onStatus(status);
        if (status.state === 'ready') {
          this._loginInProgress = false;
          this.stopLoginPolling();
          return;
        }
        if (attempts >= 60) {
          this._loginInProgress = false;
          this.stopLoginPolling();
          onStatus(await this.getCodexSidebarStatus());
        }
      })();
    }, 2000);
  }

  async beginLogin(): Promise<string> {
    this._ensureAppServer();
    const login = await this._auth!.startLogin();
    return login.authUrl;
  }

  async logout(): Promise<void> {
    this._ensureAppServer();
    await this._auth!.logout();
    this._loginInProgress = false;
    this.stopLoginPolling();
    this.resetSession();
  }

  async getCodexSidebarStatus(): Promise<CodexSidebarStatus> {
    if (!isEnabled('codex-integration')) {
      return { enabled: false, state: 'disabled', version: null, authMethod: null, email: null, plan: null, error: null, diagnostics: [], repairCommand: null, binaryPath: null, compatibility: null };
    }
    const codexManager = new CodexManager();
    const binaryStatus = await codexManager.getBinaryStatus();
    if (!binaryStatus.available || !binaryStatus.runnable) {
      return { enabled: true, state: 'broken-install', version: binaryStatus.version ?? null, authMethod: null, email: null, plan: null, error: binaryStatus.error ?? 'Codex CLI is not available.', diagnostics: binaryStatus.diagnostics, repairCommand: binaryStatus.repairCommand ?? null, binaryPath: binaryStatus.binaryPath ?? null, compatibility: binaryStatus.compatibility ?? null };
    }
    try {
      this._ensureAppServer();
      const authStatus = await this._auth!.getStatus();
      return {
        enabled: true,
        state: authStatus.authenticated ? 'ready' : this._loginInProgress ? 'auth-in-progress' : 'needs-auth',
        version: binaryStatus.version ?? null,
        authMethod: authStatus.authMethod ?? null,
        email: authStatus.email ?? null,
        plan: authStatus.plan ?? null,
        error: null,
        diagnostics: binaryStatus.diagnostics,
        repairCommand: binaryStatus.repairCommand ?? null,
        binaryPath: binaryStatus.binaryPath ?? null,
        compatibility: binaryStatus.compatibility ?? null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { enabled: true, state: 'broken-install', version: binaryStatus.version ?? null, authMethod: null, email: null, plan: null, error: message, diagnostics: binaryStatus.diagnostics, repairCommand: binaryStatus.repairCommand ?? null, binaryPath: binaryStatus.binaryPath ?? null, compatibility: binaryStatus.compatibility ?? null };
    }
  }

  async getStatus(): Promise<RuntimeStatus> {
    try {
      const manager = new CodexManager();
      const binaryStatus = await manager.getBinaryStatus();
      const authenticated = this._auth?.isAuthenticated() ?? false;
      const authState: RuntimeStatus['authState'] =
        !binaryStatus.available ? 'not-installed' :
        !binaryStatus.runnable ? 'error' :
        authenticated ? 'authenticated' :
        'needs-auth';
      return {
        ready: binaryStatus.runnable && authenticated,
        authState,
        version: binaryStatus.version ?? undefined,
        diagnostics: binaryStatus.diagnostics,
      };
    } catch (err) {
      return {
        ready: false,
        authState: 'error',
        diagnostics: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  dispose(): void {
    this.stopLoginPolling();
    for (const session of this._sessions.values()) session.dispose();
    this._sessions.clear();
    this._sessionsByThread.clear();
    this._requestIdMap.clear();
    this._requestConversation.clear();
    this._appServer?.dispose();
    this._appServer = null;
    this._auth = null;
  }

  // ── Internal wiring used by CodexSession ───────────────────────────────────

  /** @internal */
  _bindThread(threadId: string, session: CodexSession): void {
    this._sessionsByThread.set(threadId, session);
  }

  /** @internal */
  _unbindThread(threadId: string): void {
    this._sessionsByThread.delete(threadId);
  }

  /** @internal Consume the server request id for an exposed requestId. */
  _takeServerRequestId(requestId: string): string | number | undefined {
    const id = this._requestIdMap.get(requestId);
    this._requestIdMap.delete(requestId);
    this._requestConversation.delete(requestId);
    return id;
  }

  /**
   * @internal Drop one conversation's outstanding request ids, optionally
   * declining them upstream first so the agent is not left waiting forever.
   */
  _clearRequestsFor(conversationId: string, ids: Set<string>, decline: boolean): void {
    for (const requestId of ids) {
      const origId = this._requestIdMap.get(requestId);
      this._requestIdMap.delete(requestId);
      this._requestConversation.delete(requestId);
      if (decline && origId !== undefined) {
        this._appServer?.sendApprovalResponse(origId, 'decline');
      }
    }
    ids.clear();
    // Defensive: anything else still attributed to this conversation.
    for (const [requestId, owner] of this._requestConversation) {
      if (owner !== conversationId) continue;
      this._requestIdMap.delete(requestId);
      this._requestConversation.delete(requestId);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Resolve the conversation an event belongs to from its `threadId`.
   *
   * When the id is missing or unknown we fall back to the sole live session if
   * there is exactly one — that is unambiguous. With several live sessions an
   * unattributable event is DROPPED rather than misrouted into whichever chat
   * happens to be first (R5).
   */
  private _sessionForThread(threadId: string | undefined, what: string): CodexSession | undefined {
    if (threadId) {
      const hit = this._sessionsByThread.get(threadId);
      if (hit) return hit;
    }
    if (this._sessions.size === 1) {
      return this._sessions.values().next().value;
    }
    traceCodex('event', 'dropped unattributable event', { event: what, threadId, liveSessions: this._sessions.size });
    return undefined;
  }

  private _ensureAppServer(): void {
    if (this._appServer) return;
    this._appServer = new CodexAppServer({ trace: traceCodex });
    this._auth = new CodexAuth(this._appServer);
    this._auth.on('statusChanged', (status: { authenticated: boolean }) => {
      // De-auth invalidates every thread, not just one.
      if (!status.authenticated) this.resetSession();
      emitCodexStatusInvalidated('status-refresh');
    });
    this._auth.on('loginComplete', (event: { success: boolean }) => {
      this._loginInProgress = false;
      this.stopLoginPolling();
      emitCodexStatusInvalidated(event.success ? 'login-finished' : 'status-refresh');
    });
    this._setupEventListeners();
  }

  /**
   * Registered ONCE on the shared app-server. Each callback resolves its
   * destination from `params.threadId`; nothing here may reach for "the"
   * session config.
   */
  private _setupEventListeners(): void {
    if (!this._appServer) return;

    this._appServer.on(
      'item/started',
      (params: { item: { type: string; id: string }; threadId: string; turnId: string }) => {
        const config = this._sessionForThread(params.threadId, 'item/started')?.config;
        if (!config) return;
        const itemType = params.item?.type;
        if (itemType && itemType !== 'userMessage' && itemType !== 'reasoning') {
          const label = itemType === 'agentMessage' ? 'Thinking...' : `Running: ${itemType}`;
          config.onProgress({ type: 'tool_use', message: label, tool: itemType, timestamp: Date.now() });
        }
      },
    );

    // The main streaming path. Before Sprint 99 this did not even destructure
    // threadId, so every chat's text landed in whichever config was last set.
    this._appServer.on('item/agentMessage/delta', (params: { delta: string; threadId?: string }) => {
      const config = this._sessionForThread(params.threadId, 'item/agentMessage/delta')?.config;
      config?.onProgress({ type: 'text', message: params.delta, timestamp: Date.now() });
    });

    this._appServer.on('item/plan/delta', (params: { delta: string; threadId?: string }) => {
      const config = this._sessionForThread(params.threadId, 'item/plan/delta')?.config;
      config?.onCodexPlanDelta?.(params.delta);
    });

    this._appServer.on('turn/plan/updated', (params: {
      threadId: string; turnId: string;
      explanation: string | null;
      plan: Array<{ step: string; status: string }>;
    }) => {
      traceCodex('event', 'turn/plan/updated', params);
      const config = this._sessionForThread(params.threadId, 'turn/plan/updated')?.config;
      config?.onCodexPlanUpdate?.(params.explanation, params.plan);
    });

    this._appServer.on('item/completed', (params: { item: { type: string; id: string }; threadId?: string }) => {
      const config = this._sessionForThread(params.threadId, 'item/completed')?.config;
      if (!config) return;
      const itemType = params.item?.type;
      if (itemType && itemType !== 'userMessage' && itemType !== 'reasoning' && itemType !== 'agentMessage') {
        config.onProgress({ type: 'done', message: `Done: ${itemType}`, tool: itemType, timestamp: Date.now() });
      }
    });

    this._appServer.on(
      'turn/completed',
      (params: { threadId: string; turn: { id: string; status: string; error: unknown } }) => {
        // Clear ONLY the completing thread's turn id. This used to clear a shared
        // scalar, so thread B completing wiped thread A's turn id and made A's
        // later cancel() a silent no-op.
        const session = this._sessionForThread(params.threadId, 'turn/completed');
        if (!session) return;
        session._onTurnCompleted();
        const config = session.config;
        const errorMsg = formatCodexTurnError(params.turn.error);
        config.onCodexComplete?.({ status: params.turn.status, error: errorMsg });
        config.onProgress({ type: 'done', message: '', timestamp: Date.now() });
      },
    );

    // Synthetic, client-side, and the ONE event with no threadId on the wire —
    // it is fired by rpc()'s progressAfterMs timer. The conversation id is
    // threaded through threadStart() instead (B4).
    this._appServer.on('progress', (event: { method: string; message: string; conversationId?: string }) => {
      if (event.conversationId) {
        this._sessions.get(event.conversationId)?.config.onRpcProgress?.(event.method, event.message);
        return;
      }
      if (this._sessions.size === 1) {
        this._sessions.values().next().value?.config.onRpcProgress?.(event.method, event.message);
      }
    });

    // Correctly global — but it must reach EVERY conversation, not just one.
    this._appServer.on('exit', () => {
      this._auth = null;
      this._appServer = null;
      this._sessionsByThread.clear();
      this._requestIdMap.clear();
      this._requestConversation.clear();
      for (const session of this._sessions.values()) {
        session._onServerExit();
        session.config.onExit?.();
      }
    });

    // Server-initiated requests (approvals + questions + browser tools).
    this._appServer.on(
      'server-request',
      (request: { id: string | number; method: string; params: Record<string, unknown> }) => {
        // Browser dynamic tool calls
        if (request.method === 'item/tool/call') {
          const params = request.params as Record<string, unknown>;
          const config = this._sessionForThread(threadIdOf(params), 'item/tool/call')?.config;
          const toolName = typeof params.tool === 'string' ? params.tool : '';
          let toolArgs: Record<string, unknown> = {};
          if (params.arguments && typeof params.arguments === 'object') {
            toolArgs = params.arguments as Record<string, unknown>;
          } else if (typeof params.arguments === 'string') {
            try { toolArgs = JSON.parse(params.arguments) as Record<string, unknown>; } catch { toolArgs = {}; }
          }
          if (config?.onBrowserToolCall) {
            void config.onBrowserToolCall(toolName, toolArgs, request.id).then(
              (reply) => this._appServer?.sendToolCallResponse(request.id, reply.text, reply.success),
              () => this._appServer?.sendToolCallResponse(request.id, `Browser tool error: ${toolName}`, false),
            );
          } else {
            this._appServer?.sendToolCallResponse(request.id, `Unknown dynamic tool: ${toolName}`, false);
          }
          return;
        }

        // Codex question (requestUserInput)
        if (request.method === 'item/tool/requestUserInput') {
          const params = request.params as Record<string, unknown>;
          const session = this._sessionForThread(threadIdOf(params), 'item/tool/requestUserInput');
          if (!session) return;
          const questions = Array.isArray(params.questions)
            ? (params.questions as Array<Record<string, unknown>>)
                .filter(Boolean)
                .map((q) => ({
                  id: typeof q.id === 'string' && q.id.trim() ? q.id.trim() : crypto.randomUUID(),
                  header: typeof q.header === 'string' && q.header.trim() ? q.header.trim() : 'Input',
                  question: typeof q.question === 'string' ? q.question : '',
                  options: Array.isArray(q.options)
                    ? (q.options as Array<Record<string, unknown>>).flatMap((o) => {
                        const label = typeof o.label === 'string' ? o.label.trim() : '';
                        return label ? [{ label, description: typeof o.description === 'string' ? o.description : '' }] : [];
                      })
                    : [],
                  multiSelect: false,
                }))
                .filter((q) => q.question.trim())
            : [];
          session._trackRequest(`codex-${String(request.id)}`);
          session.config.onCodexQuestion?.(request.id, questions);
          return;
        }

        // Approval requests (shell commands, file changes)
        const routed = routeApprovalRequest(request);
        if (routed.type === 'denied') {
          console.warn(`[CodexRuntime] → UNKNOWN method "${routed.method}" — declining ${routed.requestId}`);
          this._appServer?.sendApprovalResponse(routed.requestId, 'decline');
          return;
        }

        const session = this._sessionForThread(routed.threadId, request.method);
        if (!session) {
          // Never approve on behalf of an unknown conversation.
          this._appServer?.sendApprovalResponse(routed.requestId, 'decline');
          return;
        }

        const requestId = `codex-${String(request.id)}`;
        this._requestIdMap.set(requestId, request.id);
        this._requestConversation.set(requestId, session.conversationId);
        session._trackRequest(requestId);

        let req: UnifiedApprovalRequest;
        if (routed.type === 'command') {
          req = { requestId, agentId: 'codex', kind: 'shell-command', command: routed.command, workingDir: routed.workingDir };
        } else {
          req = { requestId, agentId: 'codex', kind: 'file-write', diff: JSON.stringify(routed.fileChanges, null, 2) };
        }
        session.config.onApprovalRequest(req);
      },
    );
  }
}
