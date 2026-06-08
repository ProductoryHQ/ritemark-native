/**
 * ClaudeCodeRuntime — AgentRuntime adapter for the Claude Code SDK.
 *
 * Wraps AgentSession (AgentRunner.ts) and maps its progress/approval callbacks
 * to the unified AgentRuntime interface. Does NOT rewrite AgentSession internals.
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
  RuntimeSessionConfig,
  RuntimeTurnConfig,
  RuntimeStatus,
  UnifiedApprovalRequest,
} from '../runtime/AgentRuntime';

/**
 * Per-turn reminder injected in 'plan' mode so Claude proposes a reviewable
 * plan (via ExitPlanMode → plan-approval card) before mutating the workspace.
 */
const CLAUDE_PLAN_TURN_REMINDER = [
  'Ritemark plan-mode reminder:',
  '- Produce a short, reviewable plan and call ExitPlanMode to request approval.',
  '- Do NOT edit files or run commands until the plan is approved.',
].join('\n');

export class ClaudeCodeRuntime implements AgentRuntime {
  readonly id: AgentId = 'claude-code';

  private _session: AgentSession | null = null;
  private _sessionConfig: RuntimeSessionConfig | null = null;
  /** Model of the live session — used to decide reuse vs recreate. */
  private _activeModel: string | undefined;
  /** Whether the live session was started in Ask permission mode (SDK 'default'). */
  private _activeAskMode = false;

  /**
   * Pending question requests — stored so respondToApproval() can look them up.
   * Key = toolUseId from AgentQuestion.
   *
   * Note (W2): the unified respondToApproval interface only carries `approved: boolean`,
   * which cannot represent multi-choice question answers. The W2 webview message bridge
   * will extend this with a full answer payload or route question answers out-of-band.
   * For now, approved=true → first available option; approved=false → empty answers.
   */
  private readonly _pendingQuestions = new Map<string, AgentQuestion>();

  async start(config: RuntimeSessionConfig): Promise<void> {
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

    this._sessionConfig = config;
    const approvalMode = config.approvalMode ?? 'auto';
    const needsAsk = approvalMode === 'ask';

    // Reuse the warm session across turns to preserve conversation context
    // (start() is called every turn). Recreate when there's no live session,
    // the model changed, or we cross the Ask boundary (Ask uses a different SDK
    // permission mode fixed at session start). Mirrors Codex/ACP session reuse.
    if (this._session?.isActive && this._activeModel === config.model && this._activeAskMode === needsAsk) {
      this._session.setApprovalMode(approvalMode);
      return;
    }

    // Close any stale session before creating a new one
    this._session?.close();
    this._pendingQuestions.clear();
    this._activeModel = config.model;
    this._activeAskMode = needsAsk;
    this._session = new AgentSession({
      workspacePath: config.workspacePath,
      model: config.model,
      pathToClaudeCodeExecutable: status.binaryPath,
      excludedFolders: config.excludedFolders,
      extraSystemPromptAppend: config.extraSystemPrompt,
      mcpServers: config.mcpServers,
      allowedTools: config.allowedTools,
      approvalMode,
      ...(config.anthropicApiKey ? { anthropicApiKey: config.anthropicApiKey } : {}),
    });
  }

  async prompt(turn: RuntimeTurnConfig): Promise<void> {
    if (!this._session || !this._sessionConfig) {
      throw new Error('ClaudeCodeRuntime: call start() before prompt()');
    }
    const config = this._sessionConfig;

    // UnifiedAttachment is structurally identical to FileAttachment — safe cast
    const attachments = turn.attachments as FileAttachment[] | undefined;

    // In 'plan' mode, nudge Claude to propose a plan (ExitPlanMode) first.
    const promptText = config.approvalMode === 'plan'
      ? `${CLAUDE_PLAN_TURN_REMINDER}\n\n${turn.prompt}`
      : turn.prompt;

    try {
      const result = await this._session.sendMessage({
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
      });
      config.onComplete?.({
        text: result.text,
        filesModified: result.filesModified,
        metrics: result.metrics,
      });
    } catch (err) {
      config.onComplete?.({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Answer a multi-choice question from the agent. Called when the webview posts agent-answer-question. */
  answerQuestion(toolUseId: string, answers: Record<string, string>): void {
    if (!this._session) return;
    const answered = this._session.answerQuestion(toolUseId, answers);
    if (!answered) {
      // State was lost — the question may have timed out or been interrupted.
    }
  }

  async cancel(): Promise<void> {
    this._session?.interrupt();
  }

  respondToApproval(requestId: string, approved: boolean, _alwaysAllow: boolean, feedback?: string): void {
    if (!this._session) return;
    // Both tool ('ask') and plan approvals key on toolUseId. Try the tool gate
    // first; if it didn't match, route to plan approval.
    if (this._session.answerToolApproval(requestId, approved)) return;
    this._session.answerPlanApproval(requestId, approved, feedback);
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
    this._session?.close();
    this._session = null;
    this._sessionConfig = null;
    this._activeModel = undefined;
    this._pendingQuestions.clear();
  }
}
