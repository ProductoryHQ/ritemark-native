/**
 * AI Sidebar Types
 *
 * Mirrors the message protocol used between UnifiedViewProvider and the webview.
 */

// ── Agent types (mirrored from extension src/agent/types.ts) ──

export type AgentId = 'claude-code' | 'codex' | 'opencode';
export type ThinkingEffort = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';
export type ExplicitThinkingEffort = Exclude<ThinkingEffort, 'auto'>;

export interface ModelThinkingEffort {
  levels: ExplicitThinkingEffort[];
  defaultLevel?: ExplicitThinkingEffort;
}

export interface ThinkingEffortCapability {
  selectable: ExplicitThinkingEffort[];
  defaultLevel?: ExplicitThinkingEffort;
  source: 'model-catalog' | 'runtime-live';
  supportsAppliedValue: boolean;
}

export interface RuntimeCapabilityFlags {
  planFirst: boolean;
  liveModeSwitch: boolean;
  structuredPlanSteps: boolean;
  thinkingEffortSource: 'model-catalog' | 'runtime-live';
}

export interface AgentInfo {
  id: AgentId;
  label: string;
  description: string;
  experimental: boolean;
  requiresApiKey: 'anthropic' | 'openai' | null;
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  thinkingEffort?: ModelThinkingEffort;
}

export type AgentProgressType = 'init' | 'thinking' | 'tool_use' | 'text' | 'plan_text' | 'plan_ready' | 'plan_autonomous' | 'session_reset' | 'done' | 'error' | 'context_overflow' | 'subagent_start' | 'subagent_progress' | 'subagent_done' | 'compacting' | 'compacted';

export interface AgentProgress {
  type: AgentProgressType;
  message: string;
  tool?: string;
  file?: string;
  timestamp: number;
  /** For subagent events, the unique ID of the subagent */
  subagentId?: string;
  /** For subagent events, the task description */
  subagentTask?: string;
  /** For subagent events, the parent tool_use_id for correlation */
  parentToolUseId?: string;
}

export interface AgentQuestionOption {
  label: string;
  description: string;
}

export interface AgentQuestionItem {
  header: string;
  question: string;
  options: AgentQuestionOption[];
  multiSelect: boolean;
}

export interface AgentQuestion {
  toolUseId: string;
  questions: AgentQuestionItem[];
}

export interface AgentPlanApprovalRequest {
  toolUseId: string;
  /**
   * Full plan markdown from ExitPlanMode's `input.plan` — the canonical
   * source of the plan text shown in the approval card.
   */
  plan?: string;
}

/**
 * Subagent progress tracking for nested agent execution
 */
export interface SubagentProgress {
  id: string;
  parentTurnId: string;
  task: string;
  status: 'running' | 'done' | 'error';
  activities: AgentProgress[];
  result?: string;
  timestamp: number;
}

export interface AgentMetrics {
  durationMs: number;
  costUsd: number | null;
  model: string | null;
  /** Sprint 103 R7: ms of durationMs spent waiting on the user. */
  waitedMs?: number;
}

/** Sprint 103 R7: headline duration = agent working time, not human wait time. */
export function activeDurationMs(metrics: AgentMetrics): number {
  return Math.max(0, metrics.durationMs - (metrics.waitedMs ?? 0));
}

// ── Chat types ──

export interface EditorSelection {
  text: string;
  isEmpty: boolean;
  from: number;
  to: number;
  /** Surrounding text — used as an unambiguous fingerprint by buildSelectionContextBlock. */
  contextBefore?: string;
  contextAfter?: string;
}

export interface WidgetData {
  toolName: string;
  args: Record<string, unknown>;
  selection: EditorSelection;
  preview: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  widget?: WidgetData;
  timestamp: number;
}

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
}

// ── File attachment ──

export type AttachmentKind = 'image' | 'pdf' | 'text';

export interface FileAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;           // original filename for display
  data: string;           // base64 for images/PDFs, raw text for text files
  mediaType: string;      // MIME type
  thumbnail?: string;     // data URL for preview (images only)
}

/** @deprecated Use FileAttachment instead */
export type ImageAttachment = FileAttachment;

// ── Setup types (mirrored from extension src/agent/types.ts) ──

export type ClaudeAuthMethod = 'claude-oauth' | 'api-key' | null;
export type ClaudeSetupState = 'not-installed' | 'broken-install' | 'needs-auth' | 'auth-in-progress' | 'ready';
export type ClaudeRepairAction = 'install' | 'repair' | 'reload' | null;
export type AgentEnvironmentRecommendedAction = 'install-git' | 'install-node' | 'reload' | null;

export interface AgentEnvironmentStatus {
  platform: string;
  gitInstalled: boolean;
  nodeInstalled: boolean;
  powershellAvailable: boolean;
  restartRequired: boolean;
  diagnostics: string[];
  recommendedAction: AgentEnvironmentRecommendedAction;
}

// ── Onboarding types ──

export type OnboardingInstallState = 'unknown' | 'missing' | 'installing' | 'installed' | 'failed';
export type OnboardingDependency = 'git' | 'node' | 'claude-cli' | 'codex-cli';

export interface OnboardingStatus {
  platform: 'win32' | 'darwin';
  wingetAvailable: boolean;
  gitInstalled: boolean;
  nodeInstalled: boolean;
  claudeCliInstalled: boolean;
  claudeCliAuthenticated: boolean;
  codexCliInstalled: boolean;
  codexCliAuthenticated: boolean;
  hasOpenAiKey: boolean;
  hasAnthropicKey: boolean;
  anyAgentReady: boolean;
}

export interface SetupStatus {
  cliInstalled: boolean;
  runnable: boolean;
  cliVersion?: string;
  binaryPath?: string;
  authenticated: boolean;
  authMethod: ClaudeAuthMethod;
  state: ClaudeSetupState;
  diagnostics: string[];
  repairAction: ClaudeRepairAction;
  error: string | null;
}

export interface InstallProgress {
  stage: 'downloading' | 'installing' | 'verifying' | 'login' | 'done' | 'error';
  message: string;
  error?: string;
}

// ── Agent conversation types ──

export interface AgentConversationTurn {
  id: string;
  /**
   * Sprint 99 (R5): the conversation this turn belongs to. Optional so
   * pre-Sprint-99 saved conversations still load; the store stamps it on
   * every turn it creates and on every turn it rehydrates from storage.
   */
  conversationId?: string;
  userPrompt: string;
  thinkingEffort?: ThinkingEffort;
  /** Active file path that was included as context (when not skipped) */
  activeFilePath?: string;
  attachments?: FileAttachment[];
  activities: AgentProgress[];
  /** Subagents spawned during this turn */
  subagents?: SubagentProgress[];
  result?: {
    text: string;
    filesModified: string[];
    metrics: AgentMetrics;
    error?: string;
  };
  isRunning: boolean;
  /** Turn ended with a plan that needs user approval */
  isPlan: boolean;
  /** User has approved/rejected this plan */
  planHandled: boolean;
  planDecision?: 'approved' | 'rejected';
  planText?: string;
  pendingQuestion?: AgentQuestion;
  pendingPlanApproval?: AgentPlanApprovalRequest;
  /** Pending file-write / shell-command approval (Ask mode, unified gate). */
  approval?: CodexApprovalRequest;
  timestamp: number;
}

// ── Discovered agents/commands from .claude/ directory ──

export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
  filePath: string;
}

export interface DiscoveredCommand {
  id: string;
  name: string;
  description: string;
  source: 'commands' | 'skills';
  filePath: string;
}

// ── Codex types ──

export interface CodexApprovalRequest {
  approvalType: 'command' | 'fileChange';
  requestId: string | number;
  command?: string;
  workingDir?: string;
  fileChanges?: Record<string, unknown>;
}

export interface CodexQuestion {
  requestId: string | number;
  questions: Array<AgentQuestionItem & { id: string }>;
}

export interface CodexPlanStep {
  step: string;
  status: 'pending' | 'inProgress' | 'completed';
}

export type CodexSidebarState =
  | 'disabled'
  | 'checking'
  | 'broken-install'
  | 'needs-auth'
  | 'auth-in-progress'
  | 'ready';

export interface CodexCapabilityFlags {
  approvals: boolean;
  requestUserInput: boolean;
  planUpdates: boolean;
}

export interface CodexCompatibilityStatus {
  state: 'compatible' | 'limited';
  summary: string;
  capabilities: CodexCapabilityFlags;
  limitations: string[];
}

export interface CodexSidebarStatus {
  enabled: boolean;
  state: CodexSidebarState;
  version: string | null;
  authMethod: 'apiKey' | 'chatgpt' | null;
  email: string | null;
  plan: string | null;
  error: string | null;
  diagnostics: string[];
  repairCommand: string | null;
  binaryPath: string | null;
  compatibility: CodexCompatibilityStatus | null;
}

export interface CodexConversationTurn {
  id: string;
  /**
   * Sprint 99 (R5): the conversation this turn belongs to. Optional so
   * pre-Sprint-99 saved conversations still load.
   */
  conversationId?: string;
  /**
   * Which runtime produced this turn. OpenCode reuses the Codex turn shape +
   * rendering path, so this marks provenance for the header label. Absent =
   * Codex (backward compatible with saved conversations).
   */
  runtime?: 'codex' | 'opencode';
  userPrompt: string;
  thinkingEffort?: ThinkingEffort;
  requestedPlanMode?: boolean;
  /** Active file path that was included as context */
  activeFilePath?: string;
  attachments?: FileAttachment[];
  streamingText: string;
  activities: AgentProgress[];
  approval?: CodexApprovalRequest;
  pendingQuestion?: CodexQuestion;
  executionContinuation?: boolean;
  requiresPlanReview?: boolean;
  planText?: string;
  planExplanation?: string;
  planSteps?: CodexPlanStep[];
  planHandled?: boolean;
  planDecision?: 'approved' | 'rejected';
  result?: {
    status: string;
    error?: string;
  };
  isRunning: boolean;
  /**
   * Transient status string from a slow RPC call (e.g. thread/start at
   * cold start). Cleared once streamingText / activities arrive.
   */
  rpcProgressMessage?: string;
  timestamp: number;
}

// ── Messages from extension → webview ──

/** BYOK provider availability flags — one boolean per provider. */
export interface AcpProviderFlags {
  google: boolean;
  openai: boolean;
  anthropic: boolean;
  openrouter: boolean;
}

/** Curated model list for each BYOK provider. */
export interface ByokModelOption {
  id: string;
  label: string;
  description: string;
}

/**
 * Sprint 99 (R5): every host→webview message that concerns a conversation
 * carries `conversationId` at the TOP LEVEL. It is optional in the type only
 * because the extension host is migrating in parallel — the store warns once
 * per message type when it is missing and falls back to the active
 * conversation. An id the store does not know is DROPPED, never misrouted.
 */
export interface ConversationScopedMessage {
  conversationId?: string;
}

export type ExtensionMessage =
  | { type: 'ai-key-status'; hasKey: boolean }
  | { type: 'connectivity-status'; isOnline: boolean }
  // Sprint 94 (#81): a comment assigned to an agent, relayed from the editor.
  | { type: 'comment:submit'; agentId: string; prompt: string; commentIds?: string[]; documentPath?: string }
  | { type: 'agent:config'; agenticEnabled: boolean; /** Sprint 99 kill-switch (R15); absent on an older host means enabled. */ parallelChatsEnabled?: boolean; durableAgentConversations?: boolean; composerThinkingEffortEnabled?: boolean; codexEnabled?: boolean; selectedAgent: string; selectedModel: string; agents: AgentInfo[]; models: ModelOption[]; codexModels?: ModelOption[]; codexStatus?: CodexSidebarStatus; setupStatus?: SetupStatus; environmentStatus?: AgentEnvironmentStatus; hasSeenWelcome?: boolean; discoveredAgents?: DiscoveredAgent[]; discoveredCommands?: DiscoveredCommand[]; workspacePath?: string; claudeSdkVersion?: string | null; opencodeEnabled?: boolean; acpProviders?: AcpProviderFlags; byokProviderModels?: Record<string, ByokModelOption[]>; /** Sprint 103/112: per-runtime capability map. */ runtimeCapabilities?: Record<string, RuntimeCapabilityFlags> }
  | ({ type: 'thinking-effort/capability'; runtimeId: AgentId; capability: ThinkingEffortCapability } & ConversationScopedMessage)
  | ({ type: 'thinking-effort/status'; runtimeId: AgentId; requested: ThinkingEffort; applied: ThinkingEffort | null; message?: string } & ConversationScopedMessage)
  | { type: 'acp-providers'; enabled: boolean; providers: AcpProviderFlags }
  | { type: 'selection-update'; selection: EditorSelection; activeFilePath?: string }
  | { type: 'active-file-changed'; path: string | null }
  | { type: 'active-browser-changed'; context: { url: string; title?: string; sharedWithAgent?: boolean; annotationMode?: boolean; error?: string } | null }
  | { type: 'ai-streaming'; content: string }
  | { type: 'ai-result'; success: boolean; message?: string }
  | { type: 'ai-widget'; toolName: string; args: Record<string, unknown>; selection: EditorSelection }
  | { type: 'ai-error'; error: string }
  | { type: 'ai-stopped' }
  | { type: 'clear-chat' }
  | ({ type: 'agent-progress'; progress: AgentProgress } & ConversationScopedMessage)
  | ({ type: 'agent-question'; question: AgentQuestion } & ConversationScopedMessage)
  | ({ type: 'agent-plan-approval'; request: AgentPlanApprovalRequest } & ConversationScopedMessage)
  | ({ type: 'agent-result'; text?: string; filesModified?: string[]; metrics?: AgentMetrics; error?: string } & ConversationScopedMessage)
  | ({ type: 'agent-approval-request'; requestId: string; agentId: string; kind: 'file-write' | 'shell-command' | 'permission' | 'plan'; filePath?: string; diff?: string; command?: string; workingDir?: string; permissionLabel?: string; planText?: string } & ConversationScopedMessage)
  | { type: 'agent-setup:progress'; progress: InstallProgress }
  | { type: 'agent-setup:complete'; status: SetupStatus; environmentStatus?: AgentEnvironmentStatus }
  | { type: 'agent-setup:error'; error: string }
  | { type: 'settings:chatFontSize'; fontSize: number }
  | { type: 'toggle-history-panel' }
  | { type: 'conversation/canonical-id'; clientConversationId: string; conversationId: string; bindingGeneration: number }
  | {
      type: 'conversation/continuation-state';
      conversationId: string;
      turnId?: string;
      runtimeId: AgentId;
      state: {
        mode: 'not-attempted' | 'pending' | 'native-restored' | 'transcript-restored' | 'context-unavailable' | 'runtime-unavailable';
        failureCategory?: 'invalid-descriptor' | 'incompatible-descriptor' | 'authentication' | 'runtime-unavailable' | 'provider-rejected' | 'ambiguous-dispatch' | 'no-usable-context';
        truncated?: boolean;
        unansweredPriorRequest?: boolean;
      };
    }
  | import('../../../../src/conversations/protocol').ConversationResultMessage
  | import('../../../../src/conversations/protocol').ConversationHostEvent
  | { type: 'files-dropped'; paths: string[] }
  // Codex messages
  | { type: 'codex:status'; status: CodexSidebarStatus }
  | ({ type: 'codex-progress'; progress: AgentProgress } & ConversationScopedMessage)
  | ({ type: 'codex-rpc-progress'; method: string; message: string } & ConversationScopedMessage)
  | ({ type: 'codex-streaming'; delta: string } & ConversationScopedMessage)
  | ({ type: 'codex-question'; requestId: string | number; questions: Array<AgentQuestionItem & { id: string }> } & ConversationScopedMessage)
  | ({ type: 'codex-plan-text-delta'; delta: string } & ConversationScopedMessage)
  | ({ type: 'codex-plan-update'; explanation?: string | null; plan: CodexPlanStep[] } & ConversationScopedMessage)
  | ({ type: 'codex-result'; status?: string; error?: string } & ConversationScopedMessage)
  | ({ type: 'codex-approval'; approvalType: 'command' | 'fileChange'; requestId: string | number; command?: string; workingDir?: string; fileChanges?: Record<string, unknown> } & ConversationScopedMessage)
  // Onboarding messages
  | { type: 'onboarding:status'; status: OnboardingStatus }
  | { type: 'onboarding:install-progress'; dependency: OnboardingDependency; state: OnboardingInstallState; error?: string }
  // Agent pinning (Launch Chat + @mention)
  | { type: 'pin-agent'; agentId: string | null; content?: string };
