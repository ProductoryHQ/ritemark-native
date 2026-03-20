/**
 * Codex CLI Integration Module
 *
 * Provides ChatGPT-authenticated coding agents via OpenAI Codex CLI.
 *
 * Main components:
 * - CodexManager: Binary lifecycle management
 * - CodexAppServer: JSON-RPC client for app-server protocol
 * - CodexAuth: Authentication state management
 *
 * Feature flag: 'codex-integration' (experimental)
 */

export {
  CodexManager,
  type CodexBinaryStatus,
  type CodexCapabilityFlags,
  type CodexCompatibilityStatus,
} from './codexManager';
export { CodexAppServer } from './codexAppServer';
export { CodexAuth } from './codexAuth';
export { getCodexModels } from './codexModels';
export { traceCodex, showCodexTrace } from './codexTrace';
export {
  emitCodexStatusInvalidated,
  onCodexStatusInvalidated,
  type CodexStatusInvalidationEvent,
  type CodexStatusInvalidationReason,
} from './codexStatusEvents';
export * from './codexProtocol';
export { routeApprovalRequest } from './codexApproval';
