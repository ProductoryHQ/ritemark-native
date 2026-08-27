import type { AgentId, AgentProgress, AgentQuestion, AgentQuestionItem, AgentSettingSource, ActiveFileContext } from '../agent/types';
import type {
  RuntimeContinuationDescriptorV1,
  RuntimeContinuationRequest,
  RuntimeContinuationState,
} from './continuation';
import type {
  ExplicitThinkingEffort,
  ThinkingEffort,
  ThinkingEffortApplied,
  ThinkingEffortCapability,
} from './thinkingEffort';

export type { AgentId };
export type {
  ContinuationFailureCategory,
  ContinuationMode,
  NormalizedRuntimeContext,
  RuntimeContinuationDescriptorV1,
  RuntimeContinuationRequest,
  RuntimeContinuationState,
} from './continuation';
export type {
  ExplicitThinkingEffort,
  ThinkingEffort,
  ThinkingEffortApplied,
  ThinkingEffortCapability,
} from './thinkingEffort';

export interface RuntimeTurnResult {
  text?: string;
  filesModified?: string[];
  metrics?: { durationMs: number; costUsd: number | null; model: string | null };
  error?: string;
}

/**
 * A runtime adapter. One instance per runtime KIND (see RuntimeRegistry), which
 * mints one session per conversation.
 *
 * Sprint 99: `start()`/`prompt()`/`cancel()` used to live here and were called
 * against the shared adapter on every turn, so a second chat overwrote the first
 * chat's callbacks. Turn-scoped operations now belong to `RuntimeSession`.
 */
export interface AgentRuntime {
  readonly id: AgentId;

  /**
   * Open a session for one conversation. Sessions are independent: a call on
   * session A must never mutate session B's state.
   */
  createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession>;

  /** Release exactly one conversation's provider session. */
  disposeSession(conversationId: string): void;

  /**
   * Adapter-level, deliberately NOT per-conversation: this reports on the
   * installed binary and auth, which are properties of the runtime rather than
   * of any one conversation.
   */
  getStatus(): Promise<RuntimeStatus>;

  /** Tear down every session and any shared process. */
  dispose(): void;
}

/**
 * One conversation's live session with a runtime.
 *
 * Maps onto each runtime's own concept: a Codex thread, a Claude `AgentSession`,
 * an ACP session. The callbacks in `RuntimeSessionConfig` are captured when the
 * session is created, so they can close over the conversation and cannot fire
 * against a different one.
 */
export interface RuntimeSession {
  readonly conversationId: string;
  readonly agentId: AgentId;

  prompt(turn: RuntimeTurnConfig): Promise<void>;

  cancel(): Promise<void>;

  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean, feedback?: string): void;

  /** Tear down only this conversation's session; siblings keep running. */
  dispose(): void;
}

export interface RuntimeSessionConfig {
  workspacePath: string;
  /** Provider request id sent to the runtime. */
  model?: string;
  /** Canonical identity the provider reports after resolving that request id. */
  expectedResolvedModel?: string;
  excludedFolders?: string[];
  extraSystemPrompt?: string;
  mcpServers?: Record<string, unknown>;
  /** Built-in tools exposed to the model. Omitted keeps the runtime default; [] removes them. */
  availableTools?: string[];
  /** Provider setting scopes to load. Omitted keeps defaults; [] loads none. */
  settingSources?: AgentSettingSource[];
  allowedTools?: string[];
  /** API key for Claude Code (api-key auth method) */
  anthropicApiKey?: string;
  /** BYOK provider env vars for AcpRuntime */
  byokEnv?: Record<string, string>;
  /** Host-owned native descriptor and/or deterministic transcript fallback. */
  continuation?: RuntimeContinuationRequest;
  /** Runtime reports a new opaque checkpoint; the host persists it. */
  onContinuationCheckpoint?: (descriptor: RuntimeContinuationDescriptorV1) => void;
  /** Runtime reports the truthful continuation result; no provider IDs. */
  onContinuationState?: (state: RuntimeContinuationState) => void;
  /** First audit-approved positive signal that the current turn was accepted. */
  onDispatchAccepted?: () => void;
  /** Session-local capability update (ACP discovers thought_level lazily). */
  onThinkingEffortCapability?: (capability: ThinkingEffortCapability) => void;
  /** Truthful requested/applied value, when the provider exposes it. */
  onThinkingEffortApplied?: (result: ThinkingEffortApplied) => void;
  /**
   * Autonomy policy applied across all runtimes (Sprint 103 R1):
   * - 'auto'  — agents act without asking (no approval prompts)
   * - 'ask'   — file writes + shell commands require approval
   * Legacy value 'plan' is still accepted and normalized to auto + planFirst.
   */
  approvalMode?: 'auto' | 'ask' | 'plan';
  /**
   * Plan-first collaboration (Sprint 103 R1/R2/R5): the runtime plans in an
   * enforced no-write phase and presents a reviewable plan before executing.
   * Only honored by runtimes whose capability map declares `planFirst` —
   * see `runtime/capabilities.ts`.
   */
  planFirst?: boolean;
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
  /** Immutable accepted-turn snapshot. Auto restores the provider default. */
  thinkingEffort?: ThinkingEffort;
  /** Catalog/live default captured before any manual override. */
  thinkingEffortDefault?: ExplicitThinkingEffort;
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
  /**
   * Which conversation raised this. Adapters do not set it — the view provider
   * stamps it on the way to the gate, where it already closes over the
   * conversation. Without it the webview cannot tell which chat's card to show.
   */
  conversationId?: string;
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
