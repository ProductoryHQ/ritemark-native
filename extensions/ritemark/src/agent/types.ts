/**
 * Agent System Types
 *
 * Shared types for the agentic AI assistant.
 * Used by AgentRunner, UnifiedViewProvider, and webview.
 */

/**
 * Available agent identifiers
 */
export type AgentId = 'ritemark-agent' | 'claude-code';

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
    description: 'Chat assistant with RAG search and image generation',
    experimental: false,
    requiresApiKey: null, // Uses whatever AI provider is configured
  },
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    description: 'Autonomous agent that can read, write, and organize your files',
    experimental: true,
    requiresApiKey: 'anthropic',
  },
};

/**
 * Progress event types from agent execution
 */
export type AgentProgressType = 'init' | 'thinking' | 'tool_use' | 'text' | 'done' | 'error';

/**
 * Progress event emitted during agent execution
 */
export interface AgentProgress {
  type: AgentProgressType;
  message: string;
  tool?: string;
  file?: string;
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
 * Configuration for agent execution
 */
export interface AgentExecutionOptions {
  prompt: string;
  workspacePath: string;
  allowedTools?: string[];
  excludedFolders?: string[];
  timeoutMinutes?: number;
  abortSignal?: AbortSignal;
  onProgress?: (progress: AgentProgress) => void;
}

/**
 * SDK message types (from @anthropic-ai/claude-agent-sdk)
 */
export interface SDKMessage {
  type: string;
  model?: string;
  message?: {
    content?: Array<{
      type: string;
      name?: string;
      text?: string;
      input?: Record<string, unknown>;
    }>;
  };
  duration_ms?: number;
  total_cost_usd?: number;
  subtype?: string;
  result?: string;
  errors?: string[];
}
