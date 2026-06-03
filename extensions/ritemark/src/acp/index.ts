/**
 * ACP (Agent Client Protocol) Integration Module
 *
 * Sprint 76 R1: a reusable, agent-agnostic ACP client. Spawns any
 * ACP-compatible agent binary and runs a full session over JSON-RPC 2.0/stdio
 * via `@agentclientprotocol/sdk`. OpenCode is the bundled default agent
 * (wired in later phases), but nothing in this module is OpenCode-specific
 * except the OPENCODE_PERMISSION lever in AcpManager.
 *
 * Main components:
 * - AcpClient:  wraps the SDK ClientSideConnection + process lifecycle
 * - AcpManager: session orchestration + session/update → AgentProgress mapping
 * - AcpFsProxy: fs/read_text_file + fs/write_text_file via vscode.workspace.fs
 *
 * Feature flag: 'opencode-integration' (wired in a later phase).
 */

export { AcpClient } from './acpClient';
export type { AcpClientConfig, AcpClientHandlers } from './acpClient';
export { AcpManager, OPENCODE_PERMISSION } from './acpManager';
export type { AcpManagerConfig } from './acpManager';
export { AcpFsProxy, resolveWithinWorkspace } from './acpFsProxy';
export type { AcpFsBackend, AcpFsProxyConfig, AcpWriteApproval } from './acpFsProxy';
export { traceAcp, showAcpTrace, getAcpTraceLogPath } from './acpTrace';
// Sprint 76 R3a: BYOK key → spawn-env mapping (vscode-free, testable).
export { buildByokEnv, byokProviderFlags, BYOK_SECRET_KEYS } from './acpKeyEnv';
export type { ByokKeys, ByokProviderFlags } from './acpKeyEnv';
