/**
 * Codex App Server Protocol Types
 *
 * JSON-RPC 2.0 over stdio protocol for communicating with `codex app-server`.
 *
 * Based on: https://developers.openai.com/codex/app-server/
 * Generated from: codex app-server generate-ts
 */

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 Notification (no id, server → client events)
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================================================
// RPC Methods (Client → Server)
// ============================================================================

/**
 * Initialize session
 */
export interface InitializeParams {
  clientInfo?: {
    name: string;
    version: string;
  };
  capabilities?: {
    approvals?: boolean;
    streaming?: boolean;
  };
}

export interface InitializeResult {
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    approvals: boolean;
    streaming: boolean;
    tools: string[];
  };
}

/**
 * Auth status
 */
export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  plan?: 'free' | 'plus' | 'pro' | 'team' | 'business';
  credits?: {
    used: number;
    limit: number;
    resetAt?: string;
  };
}

/**
 * Start OAuth login
 */
export interface StartLoginParams {
  method?: 'browser' | 'device-code';
}

export interface StartLoginResult {
  status: 'pending' | 'success' | 'failed';
  authUrl?: string;
  deviceCode?: string;
  userCode?: string;
}

/**
 * Thread creation
 */
export interface CreateThreadParams {
  workingDir?: string;
  instructions?: string;
}

export interface CreateThreadResult {
  threadId: string;
}

/**
 * Start agent turn
 */
export interface StartTurnParams {
  threadId: string;
  message: string;
  model?: string;
}

export interface StartTurnResult {
  turnId: string;
}

/**
 * Approve command
 */
export interface ApproveCommandParams {
  threadId: string;
  turnId: string;
  itemId: string;
  approved: boolean;
}

/**
 * Approve file change
 */
export interface ApproveFileChangeParams {
  threadId: string;
  turnId: string;
  itemId: string;
  filePath: string;
  approved: boolean;
}

// ============================================================================
// Events (Server → Client notifications)
// ============================================================================

/**
 * Auth status changed
 */
export interface AuthStatusChangedEvent {
  status: AuthStatus;
}

/**
 * Item started (tool execution beginning)
 */
export interface ItemStartedEvent {
  threadId: string;
  turnId: string;
  itemId: string;
  type: 'shell' | 'apply_patch' | 'web_search' | 'update_plan' | 'agent_message';
  data?: unknown;
}

/**
 * Item completed (tool execution finished)
 */
export interface ItemCompletedEvent {
  threadId: string;
  turnId: string;
  itemId: string;
  type: 'shell' | 'apply_patch' | 'web_search' | 'update_plan' | 'agent_message';
  result?: unknown;
  error?: string;
}

/**
 * Agent message delta (streaming text token)
 */
export interface AgentMessageDeltaEvent {
  threadId: string;
  turnId: string;
  itemId: string;
  delta: string;
}

/**
 * Turn completed
 */
export interface TurnCompletedEvent {
  threadId: string;
  turnId: string;
  status: 'success' | 'failed' | 'interrupted';
  error?: string;
}

/**
 * Command approval required
 */
export interface CommandApprovalRequiredEvent {
  threadId: string;
  turnId: string;
  itemId: string;
  command: string;
  workingDir: string;
}

/**
 * File change approval required
 */
export interface FileChangeApprovalRequiredEvent {
  threadId: string;
  turnId: string;
  itemId: string;
  filePath: string;
  diff: string;
}

// ============================================================================
// Event Union Type
// ============================================================================

export type CodexEvent =
  | { method: 'auth/statusChanged'; params: AuthStatusChangedEvent }
  | { method: 'item/started'; params: ItemStartedEvent }
  | { method: 'item/completed'; params: ItemCompletedEvent }
  | { method: 'item/agentMessage/delta'; params: AgentMessageDeltaEvent }
  | { method: 'turn/completed'; params: TurnCompletedEvent }
  | { method: 'approval/commandRequired'; params: CommandApprovalRequiredEvent }
  | { method: 'approval/fileChangeRequired'; params: FileChangeApprovalRequiredEvent };
