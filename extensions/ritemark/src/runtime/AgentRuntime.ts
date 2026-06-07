import type { AgentId, AgentProgress, AgentQuestion, AgentQuestionItem, ActiveFileContext } from '../agent/types';

export type { AgentId };

export interface RuntimeTurnResult {
  text?: string;
  filesModified?: string[];
  metrics?: { durationMs: number; costUsd: number | null; model: string | null };
  error?: string;
}

export interface AgentRuntime {
  readonly id: AgentId;

  start(config: RuntimeSessionConfig): Promise<void>;

  prompt(turn: RuntimeTurnConfig): Promise<void>;

  cancel(): Promise<void>;

  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean, feedback?: string): void;

  getStatus(): Promise<RuntimeStatus>;

  dispose(): void;
}

export interface RuntimeSessionConfig {
  workspacePath: string;
  model?: string;
  excludedFolders?: string[];
  extraSystemPrompt?: string;
  mcpServers?: Record<string, unknown>;
  allowedTools?: string[];
  /** API key for Claude Code (api-key auth method) */
  anthropicApiKey?: string;
  /** BYOK provider env vars for AcpRuntime */
  byokEnv?: Record<string, string>;
  onProgress: (p: AgentProgress) => void;
  onApprovalRequest: (req: UnifiedApprovalRequest) => void;
  /** Called when a turn completes with its final result (Claude Code) */
  onComplete?: (result: RuntimeTurnResult) => void;
  /** Called when a Codex turn completes with its status and optional error */
  onCodexComplete?: (result: { status: string; error?: string }) => void;
  /** Codex approval policy (passed to threadStart) */
  codexApprovalPolicy?: string;
  /** Codex sandbox mode (passed to threadStart) */
  codexSandboxMode?: string;
  /** Codex plan-mode developer instructions (injected into collaborationMode settings) */
  codexPlanDeveloperInstructions?: string | null;
  /** Called when Claude emits a multi-choice question for the user */
  onQuestion?: (question: AgentQuestion) => void;
  /** Called when Codex emits a requestUserInput question */
  onCodexQuestion?: (requestId: string | number, questions: Array<AgentQuestionItem & { id: string }>) => void;
  /** Called when Codex emits a plan update (plan mode) */
  onCodexPlanUpdate?: (explanation: string | null, plan: Array<{ step: string; status: string }>) => void;
  /** Called when Codex emits a plan text delta (plan mode) */
  onCodexPlanDelta?: (delta: string) => void;
  /** Called when Codex app-server exits unexpectedly */
  onExit?: () => void;
  /** Called with slow-RPC progress (thread/start etc.) to show UI feedback */
  onRpcProgress?: (method: string, message: string) => void;
  /** Called when Codex requests a browser tool call (dynamic tools) */
  onBrowserToolCall?: (toolName: string, args: Record<string, unknown>, requestId: string | number) => Promise<{ text: string; success: boolean }>;
}

export interface RuntimeTurnConfig {
  prompt: string;
  attachments?: UnifiedAttachment[];
  activeFile?: ActiveFileContext;
  timeoutMinutes?: number;
  /** Codex collaboration mode: 'plan' = plan-first, 'execute' = direct execution */
  mode?: 'plan' | 'execute';
  /** Per-turn model override (Codex uses this; Claude Code ignores it) */
  model?: string;
}

export interface UnifiedAttachment {
  id: string;
  kind: 'image' | 'pdf' | 'text';
  name: string;
  data: string;
  mediaType: string;
}

export interface UnifiedApprovalRequest {
  requestId: string;
  agentId: AgentId;
  kind: 'file-write' | 'shell-command' | 'permission' | 'plan';
  filePath?: string;
  diff?: string;
  command?: string;
  workingDir?: string;
  permissionLabel?: string;
  planText?: string;
}

export interface RuntimeStatus {
  ready: boolean;
  authState: 'authenticated' | 'needs-auth' | 'not-installed' | 'error';
  version?: string;
  diagnostics: string[];
}
