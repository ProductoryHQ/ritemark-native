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

export { CodexManager } from './codexManager';
export { CodexAppServer } from './codexAppServer';
export { CodexAuth } from './codexAuth';
export * from './codexProtocol';
