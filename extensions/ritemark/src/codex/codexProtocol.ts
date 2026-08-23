/**
 * Codex App Server Protocol Types
 *
 * JSON-RPC 2.0 over stdio protocol for communicating with `codex app-server`.
 *
 * Generated from: codex app-server generate-ts (v0.106.0)
 * Simplified to the subset used by Ritemark Native.
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================================================
// Initialize
// ============================================================================

export interface InitializeParams {
  clientInfo: {
    name: string;
    title: string | null;
    version: string;
  };
  capabilities: {
    experimentalApi: boolean;
  } | null;
}

export interface InitializeResult {
  userAgent: string;
}

// ============================================================================
// Account / Auth (Client → Server)
// ============================================================================

export type CodexPlanType =
  | 'free'
  | 'go'
  | 'plus'
  | 'pro'
  | 'team'
  | 'business'
  | 'enterprise'
  | 'edu'
  | 'unknown';

export interface GetAccountParams {
  refreshToken: boolean;
}

export type CodexAccount =
  | { type: 'apiKey' }
  | { type: 'chatgpt'; email: string; planType: CodexPlanType };

export interface GetAccountResponse {
  account: CodexAccount | null;
  requiresOpenaiAuth: boolean;
}

export interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number;
  resetsAt: number;
}

export interface CreditsSnapshot {
  hasCredits: boolean;
  unlimited: boolean;
  balance: string | null;
}

export interface RateLimitSnapshot {
  limitId: string | null;
  limitName: string | null;
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
  credits: CreditsSnapshot | null;
  planType: CodexPlanType | null;
}

export interface GetAccountRateLimitsResponse {
  rateLimits: RateLimitSnapshot;
  rateLimitsByLimitId: Record<string, RateLimitSnapshot> | null;
}

export interface LoginAccountChatGptParams {
  type: 'chatgpt';
}

export interface LoginAccountChatGptResponse {
  type: 'chatgpt';
  loginId: string;
  authUrl: string;
}

export interface LogoutAccountResponse {
  [key: string]: never;
}

// ============================================================================
// Thread Management (Client → Server)
// ============================================================================

/**
 * Codex App Server custom tool definition (experimental).
 *
 * Passed in `ThreadStartParams.dynamicTools`. When the model invokes one,
 * the App Server sends an `item/tool/call` JSON-RPC REQUEST back to the
 * client; the client must respond with `ToolCallResponse` using the same
 * request id.
 *
 * Tool `name` must match `^[a-zA-Z0-9_-]+$` and must not collide with the
 * built-in tool namespaces (`functions`, `browser`, `computer`, `terminal`,
 * `python`, `web`, etc.). Ritemark uses the `ritemark_browser_*` prefix.
 *
 * Requires `initialize.params.capabilities.experimentalApi = true`.
 */
export interface DynamicToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ThreadStartParams {
  model?: string | null;
  modelProvider?: string | null;
  cwd?: string | null;
  approvalPolicy?: 'untrusted' | 'on-failure' | 'on-request' | 'never' | null;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access' | null;
  baseInstructions?: string | null;
  developerInstructions?: string | null;
  experimentalRawEvents: boolean;
  persistExtendedHistory: boolean;
  /** Experimental Codex App Server feature — see DynamicToolDefinition. */
  dynamicTools?: DynamicToolDefinition[];
}

/**
 * Server → client `item/tool/call` request params for a dynamic tool.
 * The client responds with a `ToolCallResponse` keyed by the request id.
 */
export interface ToolCallRequestParams {
  threadId: string;
  turnId: string;
  callId: string;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResponseContentItem {
  type: 'inputText';
  text: string;
}

export interface ToolCallResponse {
  contentItems: ToolCallResponseContentItem[];
  success: boolean;
}

export interface ThreadStartResponse {
  thread: ThreadInfo;
  model: string;
  modelProvider: string;
  cwd: string;
  approvalPolicy: string;
  sandbox: unknown;
  reasoningEffort: string | null;
}

export interface ThreadResumeParams {
  threadId: string;
  cwd?: string | null;
  approvalPolicy?: 'untrusted' | 'on-failure' | 'on-request' | 'never' | null;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access' | null;
}

export interface ThreadResumeResponse {
  thread: ThreadInfo;
}

export interface ThreadReadResponse {
  thread: ThreadInfo;
}

export interface ThreadInfo {
  id: string;
  preview: string;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  status: string;
  cwd: string;
  name: string | null;
}

// ============================================================================
// Turn Management (Client → Server)
// ============================================================================

export type UserInput =
  | { type: 'text'; text: string; text_elements: unknown[] }
  | { type: 'image'; url: string }
  | { type: 'localImage'; path: string };

export interface TurnStartParams {
  threadId: string;
  input: UserInput[];
  model?: string | null;
  collaborationMode?: CollaborationMode | null;
}

export interface TurnStartResponse {
  turn: TurnInfo;
}

export interface TurnInfo {
  id: string;
  status: string;
  error: unknown | null;
}

export interface TurnInterruptParams {
  threadId: string;
  turnId: string;
}

// ============================================================================
// Server Requests (Server → Client, bidirectional RPC)
// Approvals: server sends a request, client responds with a decision.
// ============================================================================

export type ReviewDecision = 'accept' | 'acceptForSession' | 'decline' | 'cancel';

/**
 * Server asks client to approve a shell command.
 *
 * Sprint 99 (B6): this used to declare `conversationId`, which the wire never
 * sends. The real payload is `threadId`/`turnId` + `itemId` — see the recorded
 * fixtures in codexApproval.test.ts. The old field misattributed approvals once
 * more than one thread was live.
 */
export interface ExecCommandApprovalParams {
  threadId: string;
  turnId: string;
  itemId: string;
  callId?: string;
  approvalId?: string | null;
  command: string[];
  cwd: string;
  reason: string | null;
}

export interface ExecCommandApprovalResponse {
  decision: ReviewDecision;
}

/**
 * Server asks client to approve a file change (apply_patch).
 *
 * Sprint 99 (B6): `conversationId` corrected to `threadId`/`turnId` — see the
 * note on ExecCommandApprovalParams.
 */
export interface ApplyPatchApprovalParams {
  threadId: string;
  turnId: string;
  itemId: string;
  callId?: string;
  fileChanges: Record<string, FileChange>;
  reason: string | null;
  grantRoot?: string | null;
}

export interface ApplyPatchApprovalResponse {
  decision: ReviewDecision;
}

/** Server asks client to answer a request_user_input prompt */
export interface ToolRequestUserInputOption {
  label: string;
  description: string;
}

export interface ToolRequestUserInputQuestion {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: ToolRequestUserInputOption[] | null;
}

export interface ToolRequestUserInputParams {
  threadId: string;
  turnId: string;
  itemId: string;
  questions: ToolRequestUserInputQuestion[];
}

export interface ToolRequestUserInputAnswer {
  answers: string[];
}

export interface ToolRequestUserInputResponse {
  answers: Record<string, ToolRequestUserInputAnswer>;
}

export type FileChange =
  | { type: 'add'; content: string }
  | { type: 'delete'; content: string }
  | { type: 'update'; unified_diff: string; move_path: string | null };

// ============================================================================
// Server Notifications (Events)
// ============================================================================

/** turn/started notification */
export interface TurnStartedNotification {
  threadId: string;
  turn: TurnInfo;
  collaborationModeKind?: ModeKind;
}

export type ModeKind = 'plan' | 'default';

export interface CollaborationModeSettings {
  model: string;
  reasoning_effort: string | null;
  developer_instructions: string | null;
}

export interface CollaborationMode {
  mode: ModeKind;
  settings: CollaborationModeSettings;
}

/** turn/completed notification */
export interface TurnCompletedNotification {
  threadId: string;
  turn: TurnInfo;
}

/** item/agentMessage/delta notification */
export interface AgentMessageDeltaNotification {
  threadId: string;
  turnId: string;
  itemId: string;
  delta: string;
}

/** item/started notification */
export interface ItemStartedNotification {
  item: unknown;
  threadId: string;
  turnId: string;
}

/** item/completed notification */
export interface ItemCompletedNotification {
  item: unknown;
  threadId: string;
  turnId: string;
}

export type TurnPlanStepStatus = 'pending' | 'inProgress' | 'completed';

export interface TurnPlanStep {
  step: string;
  status: TurnPlanStepStatus;
}

/** turn/plan/updated notification */
export interface TurnPlanUpdatedNotification {
  threadId: string;
  turnId: string;
  explanation: string | null;
  plan: TurnPlanStep[];
}

/** item/plan/delta notification */
export interface PlanDeltaNotification {
  threadId: string;
  turnId: string;
  itemId: string;
  delta: string;
}

/** account/updated notification */
export interface AccountUpdatedNotification {
  authMode: 'apiKey' | 'chatgpt' | 'chatgptAuthTokens' | null;
  planType: CodexPlanType | null;
}

/** account/login/completed notification */
export interface AccountLoginCompletedNotification {
  loginId: string | null;
  success: boolean;
  error: string | null;
}

/** exec_approval_request event (legacy EventMsg) */
export interface ExecApprovalRequestEvent {
  call_id: string;
  approval_id?: string;
  turn_id: string;
  command: string[];
  cwd: string;
  reason: string | null;
}

/** apply_patch_approval_request event (legacy EventMsg) */
export interface ApplyPatchApprovalRequestEvent {
  call_id: string;
  turn_id: string;
  changes: Record<string, FileChange>;
  reason: string | null;
  grant_root: string | null;
}

/** exec_command_begin event */
export interface ExecCommandBeginEvent {
  call_id: string;
  turn_id: string;
  command: string[];
  cwd: string;
}

/** exec_command_end event */
export interface ExecCommandEndEvent {
  call_id: string;
  turn_id: string;
  command: string[];
  exit_code: number;
  stdout: string;
  stderr: string;
  status: string;
}

/** patch_apply_begin event */
export interface PatchApplyBeginEvent {
  call_id: string;
  turn_id: string;
}

/** patch_apply_end event */
export interface PatchApplyEndEvent {
  call_id: string;
  turn_id: string;
  status: string;
}

// ============================================================================
// Union type for all events we handle
// ============================================================================

export type CodexServerNotification =
  | { method: 'turn/started'; params: TurnStartedNotification }
  | { method: 'turn/completed'; params: TurnCompletedNotification }
  | { method: 'item/started'; params: ItemStartedNotification }
  | { method: 'item/completed'; params: ItemCompletedNotification }
  | { method: 'item/agentMessage/delta'; params: AgentMessageDeltaNotification }
  | { method: 'account/updated'; params: AccountUpdatedNotification }
  | { method: 'account/login/completed'; params: AccountLoginCompletedNotification };

// Legacy event types are emitted when codex sends EventMsg as part of the
// session event stream. These arrive as JSON-RPC notifications with method
// "codex/event" and a params.type field.
export type CodexEvent = CodexServerNotification;
