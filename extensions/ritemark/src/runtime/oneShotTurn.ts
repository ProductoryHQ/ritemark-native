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
import type { MadePicture } from '../codex/codexProtocol';
import type { AgentRuntime, RuntimeSession, RuntimeTurnResult, UnifiedApprovalRequest, UnifiedAttachment } from './AgentRuntime';
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
  /** Pictures with ChatGPT: a picture sent with the prompt (the one to change). */
  attachments?: UnifiedAttachment[];
  /** Stops the turn: it rejects with `ONE_SHOT_CANCELLED` and the session is cancelled. */
  signal?: AbortSignal;
}

/** What a one-shot came back with: the answer, and the pictures its image tool made (Codex only). */
export interface OneShotTurnResult {
  text: string;
  picturesMade: MadePicture[];
  pictureFailure?: string;
}

/** The rejection's message when the one-shot's `signal` stopped it. */
export const ONE_SHOT_CANCELLED = 'cancelled';

/** The answer's text; rejects on a runtime error, an unexpected exit or the timeout. */
export async function runOneShotTurn(runtime: AgentRuntime, input: OneShotTurnInput): Promise<string> {
  return (await runOneShotTurnResult(runtime, input)).text;
}

/** The answer and what else the turn made; rejects as `runOneShotTurn` does, and on the signal. */
export async function runOneShotTurnResult(runtime: AgentRuntime, input: OneShotTurnInput): Promise<OneShotTurnResult> {
  let session: RuntimeSession | undefined;
  let settled = false;
  let streamedText = '';
  let resolveFinished!: (value: OneShotTurnResult) => void;
  let rejectFinished!: (error: Error) => void;
  const finished = new Promise<OneShotTurnResult>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });
  // Settled before the session exists too: a signal already aborted never starts one.
  finished.catch(() => undefined);
  const resolveOnce = (value: OneShotTurnResult): void => {
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
    else resolveOnce({ text: result.text ?? streamedText, picturesMade: [] });
  };
  // Stopped from outside: the turn is cancelled, whatever it had done.
  let stopped = false;
  const stop = (): void => {
    stopped = true;
    rejectOnce(new Error(ONE_SHOT_CANCELLED));
  };
  if (input.signal?.aborted) stop();
  input.signal?.addEventListener('abort', stop, { once: true });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    if (stopped) return await finished;
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
          resolveOnce({
            text: result.lastAgentMessage ?? streamedText,
            picturesMade: result.picturesMade ?? [],
            ...(result.pictureFailure ? { pictureFailure: result.pictureFailure } : {}),
          });
        }
      },
      onExit: () => rejectOnce(new Error(`${input.label} runtime exited unexpectedly`)),
    });
    // Stopped while the session was being made: it never gets the prompt.
    if (stopped) return await finished;

    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(input.timeoutMessage)), input.timeoutMs);
    });
    const execution = (async (): Promise<OneShotTurnResult> => {
      await session!.prompt({
        prompt: input.prompt,
        timeoutMinutes: Math.max(1, Math.ceil(input.timeoutMs / 60_000)),
        model: input.model,
        ...(input.thinkingEffort ? { thinkingEffort: input.thinkingEffort } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      });
      return finished;
    })();
    // A stop while the prompt is being sent wins at once.
    return await Promise.race([execution, timeout, finished]);
  } finally {
    input.signal?.removeEventListener('abort', stop);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (!settled || stopped) void session?.cancel();
    session?.dispose();
    runtime.dispose();
  }
}
