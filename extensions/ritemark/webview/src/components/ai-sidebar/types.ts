/**
 * AI Sidebar Types
 *
 * Mirrors the message protocol used between UnifiedViewProvider and the webview.
 */

// ── Agent types (mirrored from extension src/agent/types.ts) ──

export type AgentId = 'ritemark-agent' | 'claude-code' | 'codex';

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
}

export type AgentProgressType = 'init' | 'thinking' | 'tool_use' | 'text' | 'plan_text' | 'plan_ready' | 'done' | 'error' | 'context_overflow' | 'subagent_start' | 'subagent_progress' | 'subagent_done' | 'compacting' | 'compacted';

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
}

// ── Chat types ──

export interface EditorSelection {
  text: string;
  isEmpty: boolean;
  from: number;
  to: number;
}

export interface RAGCitation {
  source: string;
  page?: number;
  section?: string;
  score: number;
  citation: string;
  snippet: string;
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
  citations?: RAGCitation[];
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
  userPrompt: string;
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
  timestamp: number;
}

// ── Index types ──

export interface IndexStatus {
  totalDocs: number;
  totalChunks: number;
}

export interface IndexProgress {
  processed: number;
  total: number;
  current: string;
}

// ── Discovered agents/commands from .claude/ directory ──

export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
}

export interface DiscoveredCommand {
  id: string;
  name: string;
  description: string;
  source: 'commands' | 'skills';
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
  state: 'compatible' | 'limited' | 'untested';
  summary: string;
  auditedRange: string;
  versionInAuditedRange: boolean;
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
  userPrompt: string;
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
  timestamp: number;
}

// ── Messages from extension → webview ──

export type ExtensionMessage =
  | { type: 'ai-key-status'; hasKey: boolean }
  | { type: 'connectivity-status'; isOnline: boolean }
  | { type: 'agent:config'; agenticEnabled: boolean; codexEnabled?: boolean; selectedAgent: string; selectedModel: string; agents: AgentInfo[]; models: ModelOption[]; codexModels?: ModelOption[]; codexStatus?: CodexSidebarStatus; setupStatus?: SetupStatus; environmentStatus?: AgentEnvironmentStatus; hasSeenWelcome?: boolean; discoveredAgents?: DiscoveredAgent[]; discoveredCommands?: DiscoveredCommand[]; workspacePath?: string }
  | { type: 'selection-update'; selection: EditorSelection; activeFilePath?: string }
  | { type: 'active-file-changed'; path: string | null }
  | { type: 'ai-streaming'; content: string }
  | { type: 'ai-result'; success: boolean; message?: string; hasRagContext?: boolean }
  | { type: 'rag-results'; results: RAGCitation[] }
  | { type: 'ai-widget'; toolName: string; args: Record<string, unknown>; selection: EditorSelection }
  | { type: 'ai-error'; error: string }
  | { type: 'ai-stopped' }
  | { type: 'clear-chat' }
  | { type: 'index-status'; totalDocs: number; totalChunks: number }
  | { type: 'index-progress'; processed: number; total: number; current: string }
  | { type: 'index-done' }
  | { type: 'agent-progress'; progress: AgentProgress }
  | { type: 'agent-question'; question: AgentQuestion }
  | { type: 'agent-plan-approval'; request: AgentPlanApprovalRequest }
  | { type: 'agent-result'; text?: string; filesModified?: string[]; metrics?: AgentMetrics; error?: string }
  | { type: 'agent-setup:progress'; progress: InstallProgress }
  | { type: 'agent-setup:complete'; status: SetupStatus; environmentStatus?: AgentEnvironmentStatus }
  | { type: 'agent-setup:error'; error: string }
  | { type: 'settings:chatFontSize'; fontSize: number }
  | { type: 'toggle-history-panel' }
  | { type: 'agent:models-update'; models: ModelOption[] }
  | { type: 'files-dropped'; paths: string[] }
  // Codex messages
  | { type: 'codex:status'; status: CodexSidebarStatus }
  | { type: 'codex-progress'; progress: AgentProgress }
  | { type: 'codex-streaming'; delta: string }
  | { type: 'codex-question'; requestId: string | number; questions: Array<AgentQuestionItem & { id: string }> }
  | { type: 'codex-plan-text-delta'; delta: string }
  | { type: 'codex-plan-update'; explanation?: string | null; plan: CodexPlanStep[] }
  | { type: 'codex-result'; status?: string; error?: string }
  | { type: 'codex-approval'; approvalType: 'command' | 'fileChange'; requestId: string | number; command?: string; workingDir?: string; fileChanges?: Record<string, unknown> };
