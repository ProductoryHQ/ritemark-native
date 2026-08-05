/**
 * Agent System Types
 *
 * Shared types for the agentic AI assistant.
 * Used by AgentRunner, UnifiedViewProvider, and webview.
 */

/**
 * Available agent identifiers
 */
export type AgentId = 'claude-code' | 'codex' | 'opencode';
export type AgentSettingSource = 'user' | 'project' | 'local';

/**
 * Agent metadata for the selector dropdown
 *
 * requiresApiKey: 'byok' = bring-your-own-key — the agent uses whichever
 * provider keys the user has configured in Settings (Sprint 76 R3a).
 */
export interface AgentInfo {
  id: AgentId;
  label: string;
  description: string;
  experimental: boolean;
  requiresApiKey: 'anthropic' | 'openai' | 'byok' | null;
  deprecated?: boolean;
}

/**
 * Registry of available agents
 */
export const AGENTS: Record<AgentId, AgentInfo> = {
  'claude-code': {
    id: 'claude-code',
    label: 'Claude',
    description: 'Autonomous agent that can read, write, and organize your files',
    experimental: false,
    requiresApiKey: 'anthropic',
  },
  'codex': {
    id: 'codex',
    label: 'Codex',
    description: 'OpenAI coding agent with ChatGPT authentication',
    experimental: true,
    requiresApiKey: null, // Uses ChatGPT OAuth, not API key
  },
  // Sprint 76 R2: OpenCode — open-source ACP agent, BYOK (Gemini, GPT, Claude, OpenRouter)
  'opencode': {
    id: 'opencode',
    label: 'OpenCode',
    description: 'Open-source agent that uses your own API keys (Gemini, GPT, Claude)',
    experimental: false,
    requiresApiKey: 'byok',
  },
};

/**
 * Available models for Claude agent
 */
export interface ModelOption {
  id: string;
  label: string;
  description: string;
}


/**
 * Progress event types from agent execution
 */
export type AgentProgressType = 'init' | 'thinking' | 'tool_use' | 'text' | 'plan_text' | 'plan_ready' | 'plan_autonomous' | 'session_reset' | 'done' | 'error' | 'context_overflow' | 'subagent_start' | 'subagent_progress' | 'subagent_done' | 'compacting' | 'compacted';

/**
 * Progress event emitted during agent execution
 */
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
   * source of the plan text. Streamed `plan_text` progress events are only
   * a fallback (they require EnterPlanMode + plain-text plan blocks, which
   * Claude usually skips).
   */
  plan?: string;
}

/**
 * A mutating-tool approval request emitted in 'ask' mode (unified approval
 * policy). The toolUseId is the request key answered via answerToolApproval().
 */
export interface AgentToolApprovalRequest {
  toolUseId: string;
  /** 'file-write' for Write/Edit, 'shell-command' for Bash. */
  kind: 'file-write' | 'shell-command';
  /** Target file path (Write/Edit). */
  filePath?: string;
  /** Shell command text (Bash). */
  command?: string;
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

/**
 * Metrics collected during agent execution
 */
export interface AgentMetrics {
  durationMs: number;
  costUsd: number | null;
  model: string | null;
  /**
   * Sprint 103 R7: milliseconds of `durationMs` spent waiting on the user
   * (pending plan review, question, or tool approval). UI headline duration
   * is `durationMs - waitedMs`.
   */
  waitedMs?: number;
}

/**
 * Result of an agent execution
 */
export interface AgentResult {
  text: string;
  filesModified: string[];
  metrics: AgentMetrics;
  error?: string;
}

/**
 * Setup status for Claude bootstrap/auth state
 */
export type ClaudeAuthMethod = 'claude-oauth' | 'api-key' | null;
export type ClaudeSetupState = 'not-installed' | 'broken-install' | 'needs-auth' | 'auth-in-progress' | 'ready';
export type ClaudeRepairAction = 'install' | 'repair' | 'reload' | null;
export type AgentEnvironmentRecommendedAction = 'install-git' | 'install-node' | 'reload' | null;

export interface AgentEnvironmentStatus {
  platform: NodeJS.Platform;
  gitInstalled: boolean;
  nodeInstalled: boolean;
  powershellAvailable: boolean;
  restartRequired: boolean;
  diagnostics: string[];
  recommendedAction: AgentEnvironmentRecommendedAction;
}

/**
 * Unified onboarding status — sent to the webview on first load.
 * Covers all dependencies needed for any AI agent to work.
 */
export type OnboardingInstallState = 'unknown' | 'missing' | 'installing' | 'installed' | 'failed';
export type OnboardingDependency = 'git' | 'node' | 'claude-cli' | 'codex-cli';

export interface OnboardingStatus {
  platform: 'win32' | 'darwin';
  // Package manager (Windows only)
  wingetAvailable: boolean;
  // System-level dependencies
  gitInstalled: boolean;
  nodeInstalled: boolean;
  // CLI agents
  claudeCliInstalled: boolean;
  claudeCliAuthenticated: boolean;
  codexCliInstalled: boolean;
  codexCliAuthenticated: boolean;
  // API keys (for Ritemark Agent)
  hasOpenAiKey: boolean;
  hasAnthropicKey: boolean;
  // Computed
  anyAgentReady: boolean;
}

export type ClaudeRuntimeSource = 'bundled' | 'system';

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
  runtimeSource?: ClaudeRuntimeSource;
}

/**
 * Result of Claude installation / repair attempt
 */
export interface ClaudeInstallResult {
  success: boolean;
  outcome: 'installed' | 'installed_needs_reload' | 'verification_failed' | 'install_failed';
  error?: string;
  diagnostics?: string[];
}

/**
 * Progress events during Claude installation/login
 */
export interface InstallProgress {
  stage: 'downloading' | 'installing' | 'verifying' | 'login' | 'done' | 'error';
  message: string;
  error?: string;
}

/**
 * File attachment passed from the webview.
 * Supports images (base64), PDFs (base64), and text files (raw text content).
 */
export type AttachmentKind = 'image' | 'pdf' | 'text';

export interface FileAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;           // original filename for display
  data: string;           // base64 for images/PDFs, raw text for text files
  mediaType: string;      // MIME type (image/png, application/pdf, text/plain, etc.)
}

/** @deprecated Use FileAttachment instead */
export type ImageAttachment = FileAttachment;

/**
 * Configuration for agent execution
 */
export interface AgentExecutionOptions {
  prompt: string;
  workspacePath: string;
  /** Model drift fix (2026-08-05): one-shot runs pin a model explicitly. */
  model?: string;
  attachments?: FileAttachment[];
  allowedTools?: string[];
  settingSources?: AgentSettingSource[];
  excludedFolders?: string[];
  timeoutMinutes?: number;
  abortSignal?: AbortSignal;
  onProgress?: (progress: AgentProgress) => void;
  pathToClaudeCodeExecutable?: string;
}

/**
 * Configuration for a persistent agent session (multi-turn)
 */
export interface AgentSessionConfig {
  workspacePath: string;
  excludedFolders?: string[];
  allowedTools?: string[];
  settingSources?: AgentSettingSource[];
  model?: string;
  anthropicApiKey?: string;
  pathToClaudeCodeExecutable?: string;
  /**
   * Optional MCP servers (typically in-process SDK MCP servers) to expose to
   * the agent. Used by Sprint 69 to inject browser-action tools. Loose typing
   * keeps the SDK out of this generic shape.
   */
  mcpServers?: Record<string, unknown>;
  /**
   * Optional extra text to append to the system prompt. Used by Sprint 69 to
   * push browser-tool routing instructions when browser control is on.
   */
  extraSystemPromptAppend?: string;
  /**
   * Autonomy policy (Sprint 103 R1): 'auto' (default) or 'ask'.
   * Legacy value 'plan' is accepted and normalized to auto + planFirst.
   */
  approvalMode?: 'auto' | 'ask' | 'plan';
  /**
   * Plan-first collaboration (Sprint 103 R1/R2): when true the session runs in
   * the SDK's native `permissionMode: 'plan'` until a plan is approved.
   */
  planFirst?: boolean;
}

/**
 * Context about the currently active file in the editor
 */
export interface ActiveFileContext {
  path: string;
  selection?: string;
}

/**
 * Options for a single turn within an agent session
 */
export interface AgentTurnOptions {
  prompt: string;
  attachments?: FileAttachment[];
  activeFile?: ActiveFileContext;
  timeoutMinutes?: number;
  onProgress?: (progress: AgentProgress) => void;
  onQuestion?: (question: AgentQuestion) => void;
  onPlanApproval?: (request: AgentPlanApprovalRequest) => void;
  /** Emitted in 'ask' mode before a Write/Edit/Bash tool executes. */
  onToolApproval?: (request: AgentToolApprovalRequest) => void;
}

/**
 * Minimal interface for the SDK Query object (dynamically imported).
 * Extends AsyncIterable so we can for-await over messages, plus control methods.
 */
export interface QueryHandle extends AsyncIterable<unknown> {
  interrupt(): Promise<void>;
  close(): void;
  /** Change the permission mode of a live session (used by unified approval). */
  setPermissionMode?(mode: string): Promise<void>;
}

/**
 * SDK message types (from @anthropic-ai/claude-agent-sdk)
 */
export interface SDKMessage {
  type: string;
  subtype?: string;
  model?: string;
  session_id?: string;
  /** Links this message to a parent tool_use (e.g., for subagent activity) */
  parent_tool_use_id?: string | null;
  /** For tool_progress messages */
  tool_use_id?: string;
  tool_name?: string;
  elapsed_time_seconds?: number;
  /** For task_notification messages */
  task_id?: string;
  status?: string;
  output_file?: string;
  summary?: string;
  message?: {
    content?: Array<{
      type: string;
      name?: string;
      id?: string;
      text?: string;
      input?: Record<string, unknown>;
    }>;
  };
  duration_ms?: number;
  total_cost_usd?: number;
  result?: string;
  errors?: string[];
}
