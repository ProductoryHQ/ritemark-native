/**
 * Sprint 139 (R7): a Flow's Claude or ChatGPT step is an agent turn, counted as
 * `agent_used` with `source: flow` when it ends, with its outcome. No text.
 * Pure: `FlowExecutor` passes the count.
 */

import { randomUUID } from 'crypto';
import type { AgentId } from '../agent/types';
import type { TurnOutcome } from '../analytics/events';
import { classifyRuntimeError } from '../runtime/runtimeErrorPresentation';
import { turnOutcome } from '../runtime/turnFailureCopy';

export type CountTurnEnded = (turnKey: string, runtimeId: string, source: 'chat' | 'flow', outcome: TurnOutcome) => unknown;

export async function countedAgentStep<T>(
  runtimeId: AgentId,
  abortSignal: AbortSignal | undefined,
  run: () => Promise<T>,
  count: CountTurnEnded,
): Promise<T> {
  const turnKey = `flow:${randomUUID()}`;
  const failed = (message: string): void => {
    const kind = abortSignal?.aborted ? undefined : classifyRuntimeError(runtimeId, message)?.kind;
    void count(turnKey, runtimeId, 'flow', turnOutcome(abortSignal?.aborted ? 'cancelled' : 'failed', kind));
  };
  try {
    const result = await run();
    // A step can also end with its error in the result (a timeout, the AI's own failure).
    const error = result && typeof result === 'object' ? (result as { error?: unknown }).error : undefined;
    if (typeof error === 'string' && error.trim()) failed(error);
    else void count(turnKey, runtimeId, 'flow', 'arrived');
    return result;
  } catch (error) {
    failed(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
