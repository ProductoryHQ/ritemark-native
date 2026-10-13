/**
 * oneShotTurn — one prompt on a fresh, private runtime (Sprint 130, W6).
 *
 * Conversation titles and idea review both ask an agent one thing and read the
 * answer: a new runtime from the factory, one session, one prompt, then the
 * session and the runtime are released, whatever happened. It never shares an
 * adapter, session or thread with a chat, so it creates no conversation. Any
 * approval request is refused.
 */

import { randomUUID } from 'crypto';
import type { AgentSettingSource, ClaudeModelDeclaration } from '../agent/types';
import type { AgentRuntime, RuntimeSession, RuntimeTurnResult, UnifiedApprovalRequest } from './AgentRuntime';
import type { ThinkingEffort } from './thinkingEffort';

/** Where and as whom a one-shot runs: the project, the agent's model and keys. */
export interface OneShotSettings {
  workspacePath: string;
  model?: string;
  anthropicApiKey?: string;
  /** Sprint 127 R1: a model the bundled Claude Code may not know is declared to it. */
  claudeModelDeclaration?: ClaudeModelDeclaration;
  byokEnv?: Record<string, string>;
}

export interface OneShotTurnInput extends OneShotSettings {
  /** Names the session, e.g. `conversation-title`. */
  purpose: string;
  /** Starts the error messages, e.g. "Title generation". */
  label: string;
  systemPrompt: string;
  prompt: string;
  /** Built-in tools: omitted keeps the runtime default, [] removes them (Claude Code). */
  availableTools?: string[];
  /** Setting scopes: omitted keeps the defaults, [] loads no CLAUDE.md, skills or plugins. */
  settingSources?: AgentSettingSource[];
  thinkingEffort?: ThinkingEffort;
  timeoutMs: number;
  timeoutMessage: string;
}

/** The answer's text; rejects on a runtime error, an unexpected exit or the timeout. */
export async function runOneShotTurn(runtime: AgentRuntime, input: OneShotTurnInput): Promise<string> {
  let session: RuntimeSession | undefined;
  let settled = false;
  let streamedText = '';
  let resolveFinished!: (value: string) => void;
  let rejectFinished!: (error: Error) => void;
  const finished = new Promise<string>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });
  const resolveOnce = (value: string): void => {
    if (settled) return;
    settled = true;
    resolveFinished(value);
  };
  const rejectOnce = (error: Error): void => {
    if (settled) return;
    settled = true;
    rejectFinished(error);
  };
  const rejectApproval = (request: UnifiedApprovalRequest): void => {
    session?.respondToApproval(request.requestId, false, false);
  };
  const finishAgent = (result: RuntimeTurnResult): void => {
    if (result.error) rejectOnce(new Error(result.error));
    else resolveOnce(result.text ?? streamedText);
  };

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    session = await runtime.createSession(`${input.purpose}-${randomUUID()}`, {
      workspacePath: input.workspacePath,
      model: input.model,
      anthropicApiKey: input.anthropicApiKey,
      ...(input.claudeModelDeclaration ? { claudeModelDeclaration: input.claudeModelDeclaration } : {}),
      byokEnv: input.byokEnv,
      extraSystemPrompt: input.systemPrompt,
      ...(input.availableTools ? { availableTools: input.availableTools } : {}),
      ...(input.settingSources ? { settingSources: input.settingSources } : {}),
      allowedTools: [],
      approvalMode: 'ask',
      codexApprovalPolicy: 'untrusted',
      codexSandboxMode: 'read-only',
      onProgress: (progress) => {
        if (progress.type === 'text') streamedText += progress.message;
      },
      onApprovalRequest: rejectApproval,
      onComplete: finishAgent,
      onCodexComplete: (result) => {
        if (result.error || /error|failed|cancelled/i.test(result.status)) {
          rejectOnce(new Error(result.error ?? `${input.label} ${result.status}`));
        } else {
          // The final message on its own, when the runtime can tell messages
          // apart: a one-shot's answer is its conclusion, not every note it streamed.
          resolveOnce(result.lastAgentMessage ?? streamedText);
        }
      },
      onExit: () => rejectOnce(new Error(`${input.label} runtime exited unexpectedly`)),
    });

    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(input.timeoutMessage)), input.timeoutMs);
    });
    const execution = (async (): Promise<string> => {
      await session!.prompt({
        prompt: input.prompt,
        timeoutMinutes: Math.max(1, Math.ceil(input.timeoutMs / 60_000)),
        model: input.model,
        ...(input.thinkingEffort ? { thinkingEffort: input.thinkingEffort } : {}),
      });
      return finished;
    })();
    return await Promise.race([execution, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (!settled) void session?.cancel();
    session?.dispose();
    runtime.dispose();
  }
}
