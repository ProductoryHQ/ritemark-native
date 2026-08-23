/**
 * ClaudeCodeRuntime — AgentRuntime adapter for the Claude Code SDK.
 *
 * Wraps AgentSession (AgentRunner.ts) and maps its progress/approval callbacks
 * to the unified AgentRuntime interface. Does NOT rewrite AgentSession internals.
 *
 * Sprint 99: one `ClaudeCodeSession` per conversation. The Phase-2 audit
 * established that `AgentSession` is already a clean per-conversation unit — every
 * turn field is an instance field and there is no module-level singleton — so
 * concurrency here is a matter of holding several instances rather than one, and
 * of never handing one conversation's session to another.
 */

import { AgentSession } from './AgentRunner';
import { getSetupStatus } from './setup';
import type {
  AgentId,
  AgentQuestion,
  AgentPlanApprovalRequest,
  FileAttachment,
} from './types';
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

/** One conversation's Claude Code session. */
export class ClaudeCodeSession implements RuntimeSession {
  readonly agentId: AgentId = 'claude-code';

  private _session: AgentSession;
  private _config: RuntimeSessionConfig;
  private readonly _binaryPath: string | undefined;
  /** Model of the live session — used to decide reuse vs recreate. */
  private _activeModel: string | undefined;

  /**
   * Pending question requests, so respondToApproval() can look them up.
   * Key = toolUseId from AgentQuestion.
   *
   * Note (W2): the unified respondToApproval interface only carries `approved: boolean`,
   * which cannot represent multi-choice question answers. The W2 webview message bridge
   * will extend this with a full answer payload or route question answers out-of-band.
   * For now, approved=true → first available option; approved=false → empty answers.
   */
  private readonly _pendingQuestions = new Map<string, AgentQuestion>();

  constructor(
    readonly conversationId: string,
    config: RuntimeSessionConfig,
    binaryPath: string | undefined,
  ) {
    this._config = config;
    this._binaryPath = binaryPath;
    this._activeModel = config.model;
    this._session = ClaudeCodeSession._build(config, binaryPath);
  }

  private static _build(config: RuntimeSessionConfig, binaryPath: string | undefined): AgentSession {
    const continuation = resolveRuntimeContinuation('claude-code', config.continuation);
    if (continuation.kind === 'native') config.onContinuationState?.({ mode: 'pending' });
    if (continuation.kind === 'fallback') {
      config.onContinuationState?.(config.continuation?.fallbackContext
        ? transcriptRestoredState(config.continuation.fallbackContext)
        : { mode: 'context-unavailable', failureCategory: continuation.failureCategory });
    }
    const compatibility = config.continuation?.compatibility;
    return new AgentSession({
      workspacePath: config.workspacePath,
      model: config.model,
      pathToClaudeCodeExecutable: binaryPath,
      excludedFolders: config.excludedFolders,
      extraSystemPromptAppend: config.extraSystemPrompt,
      mcpServers: config.mcpServers,
      allowedTools: config.allowedTools,
      approvalMode: config.approvalMode ?? 'auto',
      planFirst: config.planFirst === true,
      ...(config.anthropicApiKey ? { anthropicApiKey: config.anthropicApiKey } : {}),
      ...(continuation.kind === 'native' ? { resumeSessionId: continuation.descriptor.nativeReference } : {}),
      onSessionCheckpoint: (sessionId) => {
        if (compatibility) {
          config.onContinuationCheckpoint?.(continuationCheckpoint(
            sessionId,
            compatibility,
            continuation.kind === 'native'
              ? continuation.descriptor.coveredThroughEventId
              : config.continuation?.fallbackContext?.coveredThroughEventId ?? null,
          ));
        }
        config.onContinuationState?.(continuation.kind === 'native'
          ? { mode: 'native-restored' }
          : config.continuation?.fallbackContext
            ? transcriptRestoredState(config.continuation.fallbackContext)
            : { mode: 'not-attempted' });
      },
    });
  }

  /**
   * Re-apply per-turn config to THIS conversation's session.
   *
   * Sprint 103 R3 (audit F8): the warm session is kept across EVERY policy
   * change — autonomy and plan-first switch live via the SDK's
   * `setPermissionMode`, so conversation context survives. The session is
   * recreated only when the model changes or the process died, and that reset
   * is announced to the transcript instead of happening silently.
   */
  applyConfig(config: RuntimeSessionConfig, binaryPath: string | undefined): void {
    this._config = config;

    if (this._session.isActive && this._activeModel === config.model) {
      this._session.setApprovalMode(config.approvalMode ?? 'auto', config.planFirst === true);
      return;
    }

    const hadLiveSession = this._session.isActive;
    this._session.close();
    this._pendingQuestions.clear();
    this._activeModel = config.model;
    this._session = ClaudeCodeSession._build(config, binaryPath);
    if (hadLiveSession) {
      config.onProgress({
        type: 'session_reset',
        message: "New session — earlier conversation isn't carried over.",
        timestamp: Date.now(),
      });
    }
  }

  async prompt(turn: RuntimeTurnConfig): Promise<void> {
    const config = this._config;

    // UnifiedAttachment is structurally identical to FileAttachment — safe cast
    const attachments = turn.attachments as FileAttachment[] | undefined;

    // Sprint 103 R2: no prompt-level plan reminder — plan behavior comes from
    // the SDK's native plan mode (permissionMode 'plan' + planModeInstructions).
    const continuation = resolveRuntimeContinuation('claude-code', config.continuation);
    let promptText = frameRuntimePrompt(
      turn.prompt,
      continuation.kind === 'native'
        ? config.continuation?.nativeDelta
        : config.continuation?.fallbackContext,
    );

    try {
      let providerAccepted = false;
      const send = () => this._session.sendMessage({
        prompt: promptText,
        attachments,
        activeFile: turn.activeFile,
        timeoutMinutes: turn.timeoutMinutes,
        onProgress: config.onProgress,
        onPlanApproval: (request: AgentPlanApprovalRequest) => {
          const req: UnifiedApprovalRequest = {
            requestId: request.toolUseId,
            agentId: 'claude-code',
            kind: 'plan',
            planText: request.plan,
          };
          config.onApprovalRequest(req);
        },
        onToolApproval: (request) => {
          // 'ask' mode — surface a unified file-write/shell-command approval card.
          const req: UnifiedApprovalRequest = {
            requestId: request.toolUseId,
            agentId: 'claude-code',
            kind: request.kind,
            filePath: request.filePath,
            command: request.command,
          };
          config.onApprovalRequest(req);
        },
        onQuestion: (question: AgentQuestion) => {
          this._pendingQuestions.set(question.toolUseId, question);
          // Surface via onQuestion callback (UI question card) rather than the
          // approval gate — questions need multi-choice answers, not approve/reject.
          config.onQuestion?.(question);
        },
        onDispatchAccepted: () => {
          providerAccepted = true;
          config.onDispatchAccepted?.();
        },
      });
      let result = await send();
      // An invalid/expired resume can fail before the SDK emits any provider
      // event. In that proven-unsent case retry this same accepted user prompt
      // once in a fresh session with the full transcript pack. Once any
      // provider evidence exists, never retry silently.
      if (result.error
        && continuation.kind === 'native'
        && config.continuation?.fallbackContext
        && !providerAccepted) {
        this._session.close();
        const fallbackConfig: RuntimeSessionConfig = {
          ...config,
          continuation: {
            ...config.continuation,
            descriptor: undefined,
            nativeDelta: undefined,
          },
        };
        this._config = fallbackConfig;
        this._session = ClaudeCodeSession._build(fallbackConfig, this._binaryPath);
        promptText = frameRuntimePrompt(turn.prompt, config.continuation.fallbackContext);
        result = await send();
      }
      config.onComplete?.({
        text: result.text,
        filesModified: result.filesModified,
        metrics: result.metrics,
        error: result.error,
      });
    } catch (err) {
      config.onComplete?.({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Answer a multi-choice question from the agent. Called when the webview posts agent-answer-question. */
  answerQuestion(toolUseId: string, answers: Record<string, string>): void {
    this._session.answerQuestion(toolUseId, answers);
  }

  /** True when this session raised the given approval/question id. */
  owns(requestId: string): boolean {
    return this._pendingQuestions.has(requestId);
  }

  async cancel(): Promise<void> {
    this._session.interrupt();
  }

  respondToApproval(requestId: string, approved: boolean, _alwaysAllow: boolean, feedback?: string): void {
    // Both tool ('ask') and plan approvals key on toolUseId. Try the tool gate
    // first; if it didn't match, route to plan approval.
    if (this._session.answerToolApproval(requestId, approved)) return;
    this._session.answerPlanApproval(requestId, approved, feedback);
  }

  dispose(): void {
    this._session.close();
    this._pendingQuestions.clear();
  }
}

export class ClaudeCodeRuntime implements AgentRuntime {
  readonly id: AgentId = 'claude-code';

  private readonly _sessions = new Map<string, ClaudeCodeSession>();

  async createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession> {
    // Verify Claude Code is ready before creating a session
    const status = await getSetupStatus();
    if (status.state !== 'ready') {
      throw new Error(
        status.error ??
          (status.state === 'broken-install'
            ? 'Claude is installed but not ready. Repair it first.'
            : status.state === 'needs-auth' || status.state === 'auth-in-progress'
              ? 'Claude is not signed in yet. Finish Claude.ai sign-in first.'
              : 'Claude is not installed yet. Complete setup first.'),
      );
    }

    // Reuse strictly per conversation. There is deliberately no "reuse if the
    // model matches" shortcut across conversations — that would hand one chat the
    // session, and therefore the context, belonging to another.
    const existing = this._sessions.get(conversationId);
    if (existing) {
      const continuation = resolveRuntimeContinuation('claude-code', config.continuation);
      if (continuation.kind === 'native' || !config.continuation?.fallbackContext) {
        existing.applyConfig(config, status.binaryPath);
        return existing;
      }
      // A descriptor/config mismatch must not keep using an in-memory session
      // that the host has declared incompatible or ambiguous.
      this.disposeSession(conversationId);
    }

    const session = new ClaudeCodeSession(conversationId, config, status.binaryPath);
    this._sessions.set(conversationId, session);
    return session;
  }

  /** Live session for a conversation, if one is open. */
  getSession(conversationId: string): ClaudeCodeSession | undefined {
    return this._sessions.get(conversationId);
  }

  disposeSession(conversationId: string): void {
    const session = this._sessions.get(conversationId);
    if (!session) return;
    session.dispose();
    this._sessions.delete(conversationId);
  }

  async getStatus(): Promise<RuntimeStatus> {
    try {
      const status = await getSetupStatus();
      const authState: RuntimeStatus['authState'] =
        status.state === 'ready' ? 'authenticated' :
        (status.state === 'needs-auth' || status.state === 'auth-in-progress') ? 'needs-auth' :
        (status.state === 'not-installed' || status.state === 'broken-install') ? 'not-installed' :
        'error';
      return {
        ready: status.state === 'ready',
        authState,
        version: status.cliVersion ?? undefined,
        diagnostics: status.diagnostics,
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
    for (const session of this._sessions.values()) {
      session.dispose();
    }
    this._sessions.clear();
  }
}
