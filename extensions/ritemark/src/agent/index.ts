/**
 * Agent System - Public API
 *
 * ```typescript
 * import { runAgent, AgentSession, AGENTS } from './agent';
 * ```
 */

export { runAgent, AgentSession } from './AgentRunner';
export { traceClaude, showClaudeTrace, getClaudeTraceLogPath } from './agentTrace';
export {
  getSetupStatus,
  getAgentEnvironmentStatus,
  getOnboardingStatus,
  checkWingetAvailable,
  clearSetupCache,
  setAnthropicKeyAvailable,
  hasCliOAuth,
  setClaudeLoginInProgress,
  setClaudePendingReload,
  clearClaudePendingReload,
} from './setup';
export { installClaude, isClaudeInstallInProgress, openClaudeLoginTerminal, openAnthropicKeySettings, logoutClaude, installGit, installNode, installCodexCli } from './installer';
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
  AgentSettingSource,
  AgentInfo,
  AgentProgress,
  AgentProgressType,
  AgentResult,
  AgentMetrics,
  AgentExecutionOptions,
  AgentSessionConfig,
  AgentTurnOptions,
  ActiveFileContext,
  AgentQuestion,
  AgentQuestionItem,
  AgentQuestionOption,
  AgentPlanApprovalRequest,
  FileAttachment,
  ImageAttachment,
  AttachmentKind,
  SetupStatus,
  AgentEnvironmentStatus,
  AgentEnvironmentRecommendedAction,
  InstallProgress,
  ClaudeInstallResult,
  ClaudeAuthMethod,
  ClaudeSetupState,
  ClaudeRepairAction,
  OnboardingStatus,
  OnboardingDependency,
  OnboardingInstallState,
} from './types';
