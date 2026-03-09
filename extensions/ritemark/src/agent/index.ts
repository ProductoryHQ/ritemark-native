/**
 * Agent System - Public API
 *
 * ```typescript
 * import { runAgent, AgentSession, AGENTS } from './agent';
 * ```
 */

export { runAgent, AgentSession } from './AgentRunner';
export {
  getSetupStatus,
  clearSetupCache,
  setAnthropicKeyAvailable,
  hasCliOAuth,
  setClaudeLoginInProgress,
  setClaudePendingReload,
  clearClaudePendingReload,
} from './setup';
export { installClaude, openClaudeLoginTerminal, openAnthropicKeySettings, logoutClaude } from './installer';
export {
  emitClaudeStatusInvalidated,
  onClaudeStatusInvalidated,
  type ClaudeStatusInvalidationReason,
  type ClaudeStatusInvalidationEvent,
} from './claudeStatusEvents';
export { AGENTS, CLAUDE_MODELS, CODEX_MODELS, DEFAULT_MODEL } from './types';
export { CLAUDE_FALLBACK_MODELS } from './claudeModels';
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
  ClaudeInstallResult,
  ClaudeAuthMethod,
  ClaudeSetupState,
  ClaudeRepairAction,
} from './types';
