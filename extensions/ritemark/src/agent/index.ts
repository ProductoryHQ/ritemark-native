/**
 * Agent System - Public API
 *
 * ```typescript
 * import { runAgent, AgentSession, AGENTS } from './agent';
 * ```
 */

export { runAgent, AgentSession, DEFAULT_TOOLS } from './AgentRunner';
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
export { installClaude, isClaudeInstallInProgress, openClaudeLoginTerminal, openAnthropicKeySettings, logoutClaude, installGit, installNode, installCodexCli, startClaudeLoginSubprocess } from './installer';
export type { ClaudeLoginSubprocessHandle, ClaudeLoginSubprocessOptions } from './installer';
export { beginClaudeLogin, cancelClaudeLogin, isClaudeLoginActive } from './claudeLogin';
export type { ClaudeLoginStartResult } from './claudeLogin';
export {
  emitClaudeStatusInvalidated,
  onClaudeStatusInvalidated,
  type ClaudeStatusInvalidationReason,
  type ClaudeStatusInvalidationEvent,
} from './claudeStatusEvents';
export { AGENTS } from './types';
// CLAUDE_MODELS/DEFAULT_MODEL/CLAUDE_FALLBACK_MODELS deleted in Sprint 89 (GH #109);
// model lists now come from src/ai/modelCatalog. discoverModels.ts is retained and
// consumed directly by modelCatalog/providerDiscovery.ts (SDK OAuth fallback probe).
export { discoverClaudeModels } from './discoverModels';
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
