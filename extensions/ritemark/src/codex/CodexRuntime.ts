/**
 * CodexRuntime — AgentRuntime adapter for the Codex (app-server) runtime.
 *
 * Wraps CodexAppServer + CodexAuth and maps Codex events / approvals to the
 * unified AgentRuntime interface. Does NOT rewrite CodexAppServer internals.
 */

import * as crypto from 'crypto';
import { CodexAppServer } from './codexAppServer';
import { CodexAuth } from './codexAuth';
import { CodexManager } from './codexManager';
import type { CodexCompatibilityStatus } from './codexManager';
import type { ToolRequestUserInputAnswer } from './codexProtocol';
import { routeApprovalRequest } from './codexApproval';
import { traceCodex } from './codexTrace';
import { emitCodexStatusInvalidated } from './codexStatusEvents';
import { buildCodexBrowserDynamicTools } from '../browser/codexBrowserTools';
import { isEnabled } from '../features';
import type { AgentId } from '../agent/types';
import type {
  AgentRuntime,
  RuntimeSessionConfig,
  RuntimeTurnConfig,
  RuntimeStatus,
  UnifiedApprovalRequest,
} from '../runtime/AgentRuntime';

// ── Codex-specific constants ────────────────────────────────────────────────

const CODEX_BASE_INSTRUCTIONS = [
  'You are running inside Ritemark — a markdown editor, not a code IDE.',
  'When the user asks you to modify, edit, simplify, rewrite, translate, or change text in the active file, use your file editing tools (apply_patch) to make the change directly in the file.',
  'Do NOT paraphrase the modification in chat when the user clearly wants a file edit — actually apply it.',
  'Reply text after a file edit should briefly confirm what changed, not restate the new text.',
  'Prefer structured protocol features over free-form text when the protocol supports them.',
].join(' ');

const CODEX_PLAN_DEVELOPER_INSTRUCTIONS = [
  'When you need the user to choose between options or provide required clarifications before continuing, you must use the request_user_input tool instead of asking in plain assistant text.',
  'Do not present a question as normal chat text if request_user_input can express it.',
  'When you produce a plan, prefer structured plan updates over embedding the whole plan only in prose.',
  'If you already asked for user input via request_user_input, wait for the answer instead of ending the turn with the question rendered as plain text.',
].join(' ');

const CODEX_PLAN_TURN_REMINDER = [
  'Ritemark runtime reminder:',
  '- If you need the user to answer a question or choose from options, you must call request_user_input.',
  '- Do not ask the question in normal assistant text when request_user_input can represent it.',
  '- If the user explicitly asked for multiple-choice questions, use request_user_input for them.',
  '- After calling request_user_input, wait for the answer instead of finishing the turn with the question in prose.',
].join('\n');

function shouldStartCodexInPlanMode(prompt: string): boolean {
  return /\bplan mode\b/i.test(prompt)
    || /\bwork in plan\b/i.test(prompt)
    || /\benter plan mode\b/i.test(prompt);
}

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

export class CodexRuntime implements AgentRuntime {
  readonly id: AgentId = 'codex';

  private _appServer: CodexAppServer | null = null;
  private _auth: CodexAuth | null = null;
  private _sessionConfig: RuntimeSessionConfig | null = null;
  private _threadId: string | null = null;
  private _turnId: string | null = null;
  private _loginInProgress = false;
  private _loginPoll: ReturnType<typeof setInterval> | null = null;

  /**
   * Migrated from UnifiedViewProvider._codexBrowserToolsEnabledForThread.
   * Tracks whether browser tools were wired into the current thread so a thread
   * reset is triggered when the browser-control state changes between turns.
   */
  private _browserToolsEnabledForThread = false;

  /**
   * Maps the string requestId we expose externally (e.g. "codex-42") back to
   * the original server request id for response routing via sendApprovalResponse().
   */
  private readonly _requestIdMap = new Map<string, string | number>();

  /** Expose the underlying app server for auth operations in UnifiedViewProvider. */
  getAppServer(): CodexAppServer | null { return this._appServer; }
  /** Expose the auth object for login/logout/status in UnifiedViewProvider. */
  getAuth(): CodexAuth | null { return this._auth; }
  /** Reset the codex thread (e.g. after logout or conversation reset). */
  resetSession(): void { this._threadId = null; this._turnId = null; this._requestIdMap.clear(); }

  async start(config: RuntimeSessionConfig): Promise<void> {
    this._sessionConfig = config;
    this._ensureAppServer();
    await this._appServer!.ensureInitialized();
  }

  /** Returns true if browser dynamic tools are wired into the current thread. */
  getBrowserToolsEnabled(): boolean { return this._browserToolsEnabledForThread; }

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

  answerQuestion(requestId: string | number, answers: Record<string, unknown>): void {
    this._appServer?.sendToolRequestUserInputResponse(
      requestId,
      answers as Record<string, ToolRequestUserInputAnswer>,
    );
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

  async prompt(turn: RuntimeTurnConfig): Promise<void> {
    if (!this._appServer || !this._sessionConfig) {
      throw new Error('CodexRuntime: call start() before prompt()');
    }
    const config = this._sessionConfig;
    const resolvedModel = turn.model ?? config.model ?? null;
    const shouldUsePlanMode = turn.mode === 'plan'
      || (turn.mode !== 'execute' && shouldStartCodexInPlanMode(turn.prompt));

    // Reset thread when browser-tools state would change (to apply the tool list)
    const browserToolsNeeded = Boolean(config.onBrowserToolCall);
    if (this._threadId && browserToolsNeeded !== this._browserToolsEnabledForThread) {
      traceCodex('execution', 'resetting thread: browser-tools state changed', {
        was: this._browserToolsEnabledForThread,
        now: browserToolsNeeded,
      });
      this._threadId = null;
      this._turnId = null;
    }

    // Create thread on first turn or after reset
    if (!this._threadId) {
      const approvalPolicy = (config.codexApprovalPolicy ?? 'untrusted') as 'untrusted' | 'on-request' | 'on-failure' | 'never';
      const sandbox = (config.codexSandboxMode ?? 'workspace-write') as 'read-only' | 'workspace-write' | 'danger-full-access';
      const dynamicTools = browserToolsNeeded ? buildCodexBrowserDynamicTools() : undefined;
      const planDevInstructions = config.codexPlanDeveloperInstructions ?? CODEX_PLAN_DEVELOPER_INSTRUCTIONS;

      const result = await this._appServer.threadStart({
        cwd: config.workspacePath || null,
        model: resolvedModel,
        approvalPolicy,
        sandbox,
        baseInstructions: config.extraSystemPrompt ?? CODEX_BASE_INSTRUCTIONS,
        developerInstructions: shouldUsePlanMode ? planDevInstructions : null,
        ...(dynamicTools ? { dynamicTools } : {}),
      });
      this._threadId = result.thread.id;
      this._browserToolsEnabledForThread = Boolean(dynamicTools?.length);
      traceCodex('execution', 'thread started', {
        threadId: result.thread.id,
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

    const collaborationMode = shouldUsePlanMode
      ? {
          mode: 'plan' as const,
          settings: {
            model: resolvedModel ?? 'gpt-5.3-codex',
            reasoning_effort: null,
            developer_instructions: config.codexPlanDeveloperInstructions ?? CODEX_PLAN_DEVELOPER_INSTRUCTIONS,
          },
        }
      : null;

    traceCodex('execution', 'prepared turn start', {
      threadId: this._threadId,
      model: resolvedModel,
      mode: turn.mode ?? (shouldUsePlanMode ? 'plan' : 'execute'),
      collaborationMode,
      hasImages: imageDataUrls.length > 0,
    });

    const turnResult = await this._appServer.turnStart(
      this._threadId,
      enrichedPrompt,
      resolvedModel ?? undefined,
      imageDataUrls.length > 0 ? imageDataUrls : undefined,
      collaborationMode,
    );
    this._turnId = turnResult.turn.id;
    traceCodex('execution', 'turn start acknowledged', {
      threadId: this._threadId,
      turnId: turnResult.turn.id,
      status: turnResult.turn.status,
    });
  }

  async cancel(): Promise<void> {
    if (this._appServer && this._threadId && this._turnId) {
      await this._appServer.turnInterrupt(this._threadId, this._turnId).catch(() => {});
    }
  }

  respondToApproval(requestId: string, approved: boolean, _alwaysAllow: boolean): void {
    if (!this._appServer) return;
    // Translate the string requestId back to the original server request id
    const origId = this._requestIdMap.get(requestId) ?? requestId;
    this._requestIdMap.delete(requestId);
    this._appServer.sendApprovalResponse(origId, approved ? 'accept' : 'decline');
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
    this._threadId = null;
    this._turnId = null;
    this._requestIdMap.clear();
    this._appServer?.dispose();
    this._appServer = null;
    this._auth = null;
    this._sessionConfig = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _ensureAppServer(): void {
    if (this._appServer) return;
    this._appServer = new CodexAppServer({ trace: traceCodex });
    this._auth = new CodexAuth(this._appServer);
    this._auth.on('statusChanged', (status: { authenticated: boolean }) => {
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

  private _setupEventListeners(): void {
    if (!this._appServer) return;

    this._appServer.on(
      'item/started',
      (params: { item: { type: string; id: string }; threadId: string; turnId: string }) => {
        const config = this._sessionConfig;
        if (!config) return;
        const itemType = params.item?.type;
        if (itemType && itemType !== 'userMessage' && itemType !== 'reasoning') {
          const label = itemType === 'agentMessage' ? 'Thinking...' : `Running: ${itemType}`;
          config.onProgress({ type: 'tool_use', message: label, tool: itemType, timestamp: Date.now() });
        }
      },
    );

    this._appServer.on('item/agentMessage/delta', (params: { delta: string }) => {
      this._sessionConfig?.onProgress({ type: 'text', message: params.delta, timestamp: Date.now() });
    });

    this._appServer.on('item/plan/delta', (params: { delta: string }) => {
      this._sessionConfig?.onCodexPlanDelta?.(params.delta);
    });

    this._appServer.on('turn/plan/updated', (params: {
      threadId: string; turnId: string;
      explanation: string | null;
      plan: Array<{ step: string; status: string }>;
    }) => {
      traceCodex('event', 'turn/plan/updated', params);
      this._sessionConfig?.onCodexPlanUpdate?.(params.explanation, params.plan);
    });

    this._appServer.on('item/completed', (params: { item: { type: string; id: string } }) => {
      const config = this._sessionConfig;
      if (!config) return;
      const itemType = params.item?.type;
      if (itemType && itemType !== 'userMessage' && itemType !== 'reasoning' && itemType !== 'agentMessage') {
        config.onProgress({ type: 'done', message: `Done: ${itemType}`, tool: itemType, timestamp: Date.now() });
      }
    });

    this._appServer.on(
      'turn/completed',
      (params: { threadId: string; turn: { id: string; status: string; error: unknown } }) => {
        this._turnId = null;
        const config = this._sessionConfig;
        if (!config) return;
        const errorMsg = formatCodexTurnError(params.turn.error);
        config.onCodexComplete?.({ status: params.turn.status, error: errorMsg });
        config.onProgress({ type: 'done', message: '', timestamp: Date.now() });
      },
    );

    this._appServer.on('progress', (event: { method: string; message: string }) => {
      this._sessionConfig?.onRpcProgress?.(event.method, event.message);
    });

    this._appServer.on('exit', () => {
      this._threadId = null;
      this._turnId = null;
      this._auth = null;
      this._appServer = null;
      this._requestIdMap.clear();
      this._sessionConfig?.onExit?.();
    });

    // Server-initiated requests (approvals + questions + browser tools).
    this._appServer.on(
      'server-request',
      (request: { id: string | number; method: string; params: Record<string, unknown> }) => {
        const config = this._sessionConfig;
        if (!config) return;

        // Browser dynamic tool calls
        if (request.method === 'item/tool/call') {
          const params = request.params as Record<string, unknown>;
          const toolName = typeof params.tool === 'string' ? params.tool : '';
          let toolArgs: Record<string, unknown> = {};
          if (params.arguments && typeof params.arguments === 'object') {
            toolArgs = params.arguments as Record<string, unknown>;
          } else if (typeof params.arguments === 'string') {
            try { toolArgs = JSON.parse(params.arguments) as Record<string, unknown>; } catch { toolArgs = {}; }
          }
          if (config.onBrowserToolCall) {
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
          config.onCodexQuestion?.(request.id, questions);
          return;
        }

        // Approval requests (shell commands, file changes)
        const routed = routeApprovalRequest(request);
        if (routed.type === 'denied') {
          console.warn(`[CodexRuntime] → UNKNOWN method "${routed.method}" — declining ${routed.requestId}`);
          this._appServer?.sendApprovalResponse(routed.requestId, 'decline');
          return;
        }

        const requestId = `codex-${String(request.id)}`;
        this._requestIdMap.set(requestId, request.id);

        let req: UnifiedApprovalRequest;
        if (routed.type === 'command') {
          req = { requestId, agentId: 'codex', kind: 'shell-command', command: routed.command, workingDir: routed.workingDir };
        } else {
          req = { requestId, agentId: 'codex', kind: 'file-write', diff: JSON.stringify(routed.fileChanges, null, 2) };
        }
        config.onApprovalRequest(req);
      },
    );
  }
}
