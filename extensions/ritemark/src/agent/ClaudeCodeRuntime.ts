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

export class ClaudeCodeRuntime implements AgentRuntime {
  readonly id: AgentId = 'claude-code';

  private _session: AgentSession | null = null;
  private _sessionConfig: RuntimeSessionConfig | null = null;

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

    // Close any existing session before creating a new one
    this._session?.close();
    this._pendingQuestions.clear();
    this._sessionConfig = config;
    this._session = new AgentSession({
      workspacePath: config.workspacePath,
      model: config.model,
      pathToClaudeCodeExecutable: status.binaryPath,
      excludedFolders: config.excludedFolders,
      extraSystemPromptAppend: config.extraSystemPrompt,
      mcpServers: config.mcpServers,
      allowedTools: config.allowedTools,
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

    try {
      const result = await this._session.sendMessage({
        prompt: turn.prompt,
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
    // Plan approval path — AgentSession.answerPlanApproval uses toolUseId as the key
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
    this._pendingQuestions.clear();
  }
}
