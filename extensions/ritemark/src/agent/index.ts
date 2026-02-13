/**
 * Agent System - Public API
 *
 * ```typescript
 * import { runAgent, AgentSession, AGENTS } from './agent';
 * ```
 */

export { runAgent, AgentSession } from './AgentRunner';
export { getSetupStatus, clearSetupCache, setAnthropicKeyAvailable, hasCliOAuth } from './setup';
export { installClaude, openClaudeLoginTerminal, openAnthropicKeySettings } from './installer';
export { AGENTS, CLAUDE_MODELS, DEFAULT_MODEL } from './types';
export type {
  ModelOption,
  AgentId,
  AgentInfo,
  AgentProgress,
  AgentProgressType,
  AgentResult,
  AgentMetrics,
  AgentExecutionOptions,
  AgentSessionConfig,
  AgentTurnOptions,
  ActiveFileContext,
  FileAttachment,
  ImageAttachment,
  AttachmentKind,
  SetupStatus,
  InstallProgress,
} from './types';
