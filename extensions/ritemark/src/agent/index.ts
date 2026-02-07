/**
 * Agent System - Public API
 *
 * ```typescript
 * import { runAgent, AGENTS } from './agent';
 * ```
 */

export { runAgent } from './AgentRunner';
export { AGENTS } from './types';
export type {
  AgentId,
  AgentInfo,
  AgentProgress,
  AgentProgressType,
  AgentResult,
  AgentMetrics,
  AgentExecutionOptions,
} from './types';
