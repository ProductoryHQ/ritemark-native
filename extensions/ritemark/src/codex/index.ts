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
// getCodexModels() deleted in Sprint 89 (GH #109) — Codex models now resolve via
// src/ai/modelCatalog (providerDiscovery.discoverCodex reads ~/.codex/models_cache.json).
export { traceCodex, showCodexTrace } from './codexTrace';
export {
  emitCodexStatusInvalidated,
  onCodexStatusInvalidated,
  type CodexStatusInvalidationEvent,
  type CodexStatusInvalidationReason,
} from './codexStatusEvents';
export * from './codexProtocol';
export { routeApprovalRequest } from './codexApproval';
export { CodexRuntime, type CodexSidebarStatus } from './CodexRuntime';
