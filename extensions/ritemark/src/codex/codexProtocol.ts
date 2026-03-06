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
// Auth (Client → Server)
// ============================================================================

/** getAuthStatus params */
export interface GetAuthStatusParams {
  includeToken: boolean | null;
  refreshToken: boolean | null;
}

/** getAuthStatus response */
export interface GetAuthStatusResponse {
  authMethod: 'apikey' | 'chatgpt' | 'chatgptAuthTokens' | null;
  authToken: string | null;
  requiresOpenaiAuth: boolean | null;
}

// loginChatGpt: no params (undefined), response: LoginChatGptResponse
export interface LoginChatGptResponse {
  // empty response — auth completion comes via notification
}

// logoutChatGpt: no params, no meaningful response

// ============================================================================
// Thread Management (Client → Server)
// ============================================================================

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
  | { type: 'image'; image_url: { url: string } }
  | { type: 'local_image'; path: string };

export interface TurnStartParams {
  threadId: string;
  input: UserInput[];
  model?: string | null;
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

export type ReviewDecision = 'approved' | 'approved_for_session' | 'denied' | 'abort';

/** Server asks client to approve a shell command */
export interface ExecCommandApprovalParams {
  conversationId: string;
  callId: string;
  approvalId: string | null;
  command: string[];
  cwd: string;
  reason: string | null;
}

export interface ExecCommandApprovalResponse {
  decision: ReviewDecision;
}

/** Server asks client to approve a file change (apply_patch) */
export interface ApplyPatchApprovalParams {
  conversationId: string;
  callId: string;
  fileChanges: Record<string, FileChange>;
  reason: string | null;
  grantRoot: string | null;
}

export interface ApplyPatchApprovalResponse {
  decision: ReviewDecision;
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

/** authStatusChange notification */
export interface AuthStatusChangeNotification {
  authMethod: 'apikey' | 'chatgpt' | 'chatgptAuthTokens' | null;
}

/** loginChatGptComplete notification */
export interface LoginChatGptCompleteNotification {
  success: boolean;
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
  | { method: 'authStatusChange'; params: AuthStatusChangeNotification }
  | { method: 'loginChatGptComplete'; params: LoginChatGptCompleteNotification };

// Legacy event types are emitted when codex sends EventMsg as part of the
// session event stream. These arrive as JSON-RPC notifications with method
// "codex/event" and a params.type field.
export type CodexEvent = CodexServerNotification;
