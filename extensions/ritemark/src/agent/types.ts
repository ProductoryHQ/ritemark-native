/**
 * Agent System Types
 *
 * Shared types for the agentic AI assistant.
 * Used by AgentRunner, UnifiedViewProvider, and webview.
 */

/**
 * Available agent identifiers
 */
export type AgentId = 'ritemark-agent' | 'claude-code' | 'codex';

/**
 * Agent metadata for the selector dropdown
 */
export interface AgentInfo {
  id: AgentId;
  label: string;
  description: string;
  experimental: boolean;
  requiresApiKey: 'anthropic' | 'openai' | null;
}

/**
 * Registry of available agents
 */
export const AGENTS: Record<AgentId, AgentInfo> = {
  'ritemark-agent': {
    id: 'ritemark-agent',
    label: 'Ritemark Agent',
    description: 'Chat & document search',
    experimental: false,
    requiresApiKey: null, // Uses whatever AI provider is configured
  },
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
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
};

/**
 * Available models for Claude Code agent
 */
export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-sonnet-4-5', label: 'Sonnet', description: 'Fast & capable' },
  { id: 'claude-opus-4-6', label: 'Opus', description: 'Most powerful' },
  { id: 'claude-haiku-4-5', label: 'Haiku', description: 'Quick & light' },
];

export const DEFAULT_MODEL = 'claude-sonnet-4-5';

export const CODEX_MODELS: ModelOption[] = [
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', description: 'Most capable' },
  { id: 'codex-spark', label: 'Codex Spark', description: 'Fast & light' },
  { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', description: 'Balanced' },
];

/**
 * Progress event types from agent execution
 */
export type AgentProgressType = 'init' | 'thinking' | 'tool_use' | 'text' | 'plan_ready' | 'done' | 'error' | 'context_overflow' | 'subagent_start' | 'subagent_progress' | 'subagent_done' | 'compacting' | 'compacted';

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
 * Setup status for Claude Code CLI
 */
export interface SetupStatus {
  cliInstalled: boolean;
  cliVersion?: string;
  authenticated: boolean;
}

/**
 * Progress events during Claude Code installation/login
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
  attachments?: FileAttachment[];
  allowedTools?: string[];
  excludedFolders?: string[];
  timeoutMinutes?: number;
  abortSignal?: AbortSignal;
  onProgress?: (progress: AgentProgress) => void;
}

/**
 * Configuration for a persistent agent session (multi-turn)
 */
export interface AgentSessionConfig {
  workspacePath: string;
  excludedFolders?: string[];
  allowedTools?: string[];
  model?: string;
  anthropicApiKey?: string;
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
}

/**
 * Minimal interface for the SDK Query object (dynamically imported).
 * Extends AsyncIterable so we can for-await over messages, plus control methods.
 */
export interface QueryHandle extends AsyncIterable<unknown> {
  interrupt(): Promise<void>;
  close(): void;
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
