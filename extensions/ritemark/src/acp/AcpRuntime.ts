/**
 * AcpRuntime — AgentRuntime adapter for the ACP/OpenCode runtime.
 *
 * Wraps AcpManager and maps its requestPermission + approveWrite callbacks to
 * the unified AgentRuntime interface. Does NOT rewrite AcpManager internals.
 *
 * BYOK provider keys arrive via `RuntimeSessionConfig.byokEnv` (built from
 * SecretStorage in UnifiedViewProvider) and are forwarded to the OpenCode
 * subprocess when it is first spawned.
 *
 * Sprint 99 (decision D1): one `AcpSession` per conversation, all sharing ONE
 * OpenCode subprocess and ONE AcpManager. The safety-critical part of that
 * change is the write-approval set (C1) — see `_recentlyPermissionedWrites`.
 */

import * as crypto from 'crypto';
import { AcpManager } from './acpManager';
import { traceAcp } from './acpTrace';
import { findBundledAgentRuntime } from '../utils/bundledAgentRuntime';
import { BrowserIpcServer } from '../browser/BrowserIpcServer';
import { BrowserToolsInjector } from '../runtime/BrowserToolsInjector';
import {
  browserNavigate,
  browserClick,
  browserFill,
  browserType,
  browserScroll,
  browserSnapshot,
  formatActionResultForAgent,
} from '../browser/BrowserActionTools';
import { isEnabled } from '../features';
import type { AgentId } from '../agent/types';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  WriteTextFileRequest,
} from '@agentclientprotocol/sdk';
import type { BrowserIpcRequest } from '../browser/BrowserIpcServer';
import type {
  AgentRuntime,
  RuntimeSession,
  RuntimeSessionConfig,
  RuntimeTurnConfig,
  RuntimeStatus,
  UnifiedApprovalRequest,
} from '../runtime/AgentRuntime';

type PendingApproval = (result: { approved: boolean; alwaysAllow: boolean }) => void;

const _browserToolsInjector = new BrowserToolsInjector();

/**
 * One conversation's OpenCode session (an ACP `ses_…` on the shared connection).
 */
export class AcpSession implements RuntimeSession {
  readonly agentId: AgentId = 'opencode';

  private _config: RuntimeSessionConfig;

  /** Pending approval promises keyed by requestId. Resolved by respondToApproval(). */
  readonly pendingApprovals = new Map<string, PendingApproval>();

  /**
   * Files whose `edit` was approved via session/request_permission, so the
   * follow-up fs/write_text_file for the same path is auto-allowed instead of
   * double-prompting.
   *
   * SAFETY (Sprint 99 C1): this set is PER SESSION. It used to be a
   * process-wide `Set<filePath>` on the runtime, which under multi-session is a
   * cross-chat approval bypass — chat A approving a write to `foo.md` would
   * silently auto-allow chat B's write to the same path. Any regression here
   * breaks the OpenCode permission-gate invariant and is a release blocker.
   */
  readonly recentlyPermissionedWrites = new Set<string>();

  constructor(
    readonly conversationId: string,
    /** The ACP session id on the shared connection. */
    readonly acpSessionId: string,
    config: RuntimeSessionConfig,
    private readonly _runtime: AcpRuntime,
  ) {
    this._config = config;
  }

  get config(): RuntimeSessionConfig { return this._config; }

  applyConfig(config: RuntimeSessionConfig): void {
    this._config = config;
  }

  async prompt(turn: RuntimeTurnConfig): Promise<void> {
    const manager = this._runtime.getManager();
    if (!manager) {
      throw new Error('AcpRuntime: createSession() must succeed before prompt()');
    }
    const config = this._config;

    config.onProgress({ type: 'init', message: 'Starting OpenCode…', timestamp: Date.now() });

    let promptText = turn.prompt;
    // Active file context — same `[Currently editing: …]` preamble Claude Code
    // and Codex inject, so "edit this file" prompts know the target.
    if (turn.activeFile) {
      promptText = `[Currently editing: ${turn.activeFile.path}]\n\n${promptText}`;
    }
    if (turn.attachments && turn.attachments.length > 0) {
      const blocks = turn.attachments.map(a => `**Attachment: ${a.name}**\n\`\`\`\n${a.data}\n\`\`\``);
      promptText = `${blocks.join('\n\n')}\n\n${promptText}`;
      const imageCount = turn.attachments.filter(a => a.kind === 'image').length;
      if (imageCount > 0) {
        config.onProgress({ type: 'text', message: `Note: ${imageCount} image attachment(s) converted to text (OpenCode BYOK does not support inline multimodal in this version).`, timestamp: Date.now() });
      }
    }

    try {
      // Apply model for this turn (strip 'opencode:' composite prefix if present).
      // Must be inside try/catch — setModel throws if the model ID is invalid.
      if (config.model) {
        const providerModel = config.model.startsWith('opencode:')
          ? config.model.slice('opencode:'.length)
          : config.model;
        await manager.setModel(this.acpSessionId, providerModel);
      }
      const result = await manager.prompt(this.acpSessionId, promptText);
      config.onCodexComplete?.({ status: result?.stopReason ?? 'completed' });
    } catch (err) {
      config.onCodexComplete?.({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  async cancel(): Promise<void> {
    this.rejectPendingApprovals();
    try {
      await this._runtime.getManager()?.cancel(this.acpSessionId);
    } catch {
      // Process may already be gone if this was the last session and it was killed.
    }
    this._runtime._forgetSession(this);
  }

  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean, _feedback?: string): void {
    const resolve = this.pendingApprovals.get(requestId);
    if (!resolve) return;
    this.pendingApprovals.delete(requestId);
    resolve({ approved, alwaysAllow });
  }

  dispose(): void {
    this.rejectPendingApprovals();
    this.recentlyPermissionedWrites.clear();
    this._runtime.getManager()?.closeSession(this.acpSessionId);
    this._runtime._forgetSession(this);
  }

  /** @internal */
  rejectPendingApprovals(): void {
    for (const resolve of this.pendingApprovals.values()) {
      resolve({ approved: false, alwaysAllow: false });
    }
    this.pendingApprovals.clear();
  }
}

export class AcpRuntime implements AgentRuntime {
  readonly id: AgentId = 'opencode';

  /** ONE manager / ONE OpenCode subprocess shared by every conversation (D1). */
  private _manager: AcpManager | null = null;
  private _approvalSeq = 0;
  private _ipcServer: BrowserIpcServer | null = null;

  private readonly _sessions = new Map<string, AcpSession>();
  /** Reverse index — ACP notifications and fs requests carry `sessionId`. */
  private readonly _sessionsByAcpId = new Map<string, AcpSession>();

  async createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession> {
    const existing = this._sessions.get(conversationId);
    if (existing) {
      existing.applyConfig(config);
      return existing;
    }

    await this._ensureManager(config);
    const acpSessionId = await this._manager!.start();
    const session = new AcpSession(conversationId, acpSessionId, config, this);
    this._sessions.set(conversationId, session);
    this._sessionsByAcpId.set(acpSessionId, session);
    traceAcp('runtime', 'session-created', { conversationId, acpSessionId, liveSessions: this._sessions.size });
    return session;
  }

  getSession(conversationId: string): AcpSession | undefined {
    return this._sessions.get(conversationId);
  }

  disposeSession(conversationId: string): void {
    this._sessions.get(conversationId)?.dispose();
  }

  /** @internal — the shared manager, or null before the first session. */
  getManager(): AcpManager | null { return this._manager; }

  async getStatus(): Promise<RuntimeStatus> {
    const runtime = findBundledAgentRuntime('opencode');
    if (!runtime) {
      return {
        ready: false,
        authState: 'not-installed',
        diagnostics: ['OpenCode runtime not found in Ritemark bundle.'],
      };
    }
    return {
      // BYOK: auth is via API keys, not a separate login step; the runtime is
      // considered ready when the binary is present.
      ready: true,
      authState: 'authenticated',
      diagnostics: [`OpenCode binary: ${runtime.path}`],
    };
  }

  dispose(): void {
    for (const session of [...this._sessions.values()]) {
      session.rejectPendingApprovals();
      session.recentlyPermissionedWrites.clear();
    }
    this._sessions.clear();
    this._sessionsByAcpId.clear();
    this._manager?.dispose();
    this._manager = null;
    this._stopIpcServer();
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  /**
   * @internal Drop one session from the indexes. The shared subprocess and the
   * browser IPC server stay up while siblings still need them (C4); they are
   * torn down only when the last session goes.
   */
  _forgetSession(session: AcpSession): void {
    this._sessions.delete(session.conversationId);
    this._sessionsByAcpId.delete(session.acpSessionId);
    if (this._sessions.size === 0) {
      this._manager?.dispose();
      this._manager = null;
      this._stopIpcServer();
    }
  }

  private _stopIpcServer(): void {
    this._ipcServer?.stop();
    this._ipcServer = null;
  }

  /**
   * Spawn the subprocess + browser IPC server once, on the first conversation.
   * Subsequent conversations open another ACP session on the same connection.
   */
  private async _ensureManager(config: RuntimeSessionConfig): Promise<void> {
    if (this._manager) return;

    const runtime = findBundledAgentRuntime('opencode');
    if (!runtime) {
      throw new Error(
        'OpenCode runtime not found. Reinstall Ritemark to restore the bundled agent.',
      );
    }

    // Start the browser IPC server when the feature flag is on so OpenCode can
    // reach the integrated browser through the browserMcpAdapter subprocess.
    // Under D1 all sessions share one subprocess and therefore one socket and
    // one browser-tool channel — consistent with decision D2 (one shared
    // browser). Disposing a single conversation must NOT stop it (C4).
    let mcpServers: unknown[] = [];
    if (isEnabled('browser-agent-control')) {
      const ipcSessionId = crypto.randomUUID();
      const ipcServer = new BrowserIpcServer(ipcSessionId);
      await ipcServer.start((req) => this._handleBrowserIpcRequest(req));
      this._ipcServer = ipcServer;
      mcpServers = _browserToolsInjector.getAcpMcpServers(true, ipcServer.socketPath);
      traceAcp('runtime', 'ipc-started', { socketPath: ipcServer.socketPath });
    }

    this._manager = new AcpManager({
      binaryPath: runtime.path,
      workspaceRoot: config.workspacePath,
      byokEnv: config.byokEnv ?? {},
      mcpServers,
      requestPermission: (params) => this._handlePermission(params),
      approveWrite: (request) => this._handleWriteApproval(request),
      onProgress: (progress, sessionId) => {
        this._sessionsByAcpId.get(sessionId)?.config.onProgress(progress);
      },
    });
  }

  /**
   * Dispatch an incoming BrowserIpcRequest from the adapter subprocess to the
   * appropriate BrowserActionTools function and return a formatted text result.
   */
  private async _handleBrowserIpcRequest(req: BrowserIpcRequest): Promise<string> {
    // Cast through `unknown` so TypeScript accepts the generic params object.
    const p = req.params as unknown;
    switch (req.tool) {
      case 'browser_navigate':
        return formatActionResultForAgent(await browserNavigate(p as Parameters<typeof browserNavigate>[0]));
      case 'browser_click':
        return formatActionResultForAgent(await browserClick(p as Parameters<typeof browserClick>[0]));
      case 'browser_fill':
        return formatActionResultForAgent(await browserFill(p as Parameters<typeof browserFill>[0]));
      case 'browser_type':
        return formatActionResultForAgent(await browserType(p as Parameters<typeof browserType>[0]));
      case 'browser_scroll':
        return formatActionResultForAgent(await browserScroll(p as Parameters<typeof browserScroll>[0]));
      case 'browser_snapshot':
        return formatActionResultForAgent(await browserSnapshot());
      default: {
        const exhaustive: never = req.tool;
        return `Error: Unknown browser tool: ${exhaustive as string}`;
      }
    }
  }

  private async _handlePermission(
    params: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    const session = this._sessionsByAcpId.get(params.sessionId as string);
    // An unroutable permission request is CANCELLED, never approved.
    if (!session) {
      traceAcp('approval', 'permission for unknown session — cancelled', { sessionId: params.sessionId });
      return { outcome: { outcome: 'cancelled' } };
    }
    const config = session.config;

    // Unified 'auto' approval mode — allow without prompting the user.
    if (config.approvalMode === 'auto') {
      return this._selectOutcome(params, true);
    }

    const tool = params.toolCall?.title ?? 'tool call';
    const file = params.toolCall?.locations?.[0]?.path;
    const isFileEdit = params.toolCall?.kind === 'edit' && !!file;
    const requestId = `acp-${++this._approvalSeq}`;
    traceAcp('approval', 'permission-requested', {
      conversationId: session.conversationId, tool, file, kind: params.toolCall?.kind,
    });

    const req: UnifiedApprovalRequest = isFileEdit && file
      ? { requestId, agentId: 'opencode', kind: 'file-write', filePath: file }
      : { requestId, agentId: 'opencode', kind: 'shell-command', command: tool, workingDir: file ?? '' };

    const { approved } = await new Promise<{ approved: boolean; alwaysAllow: boolean }>(
      (resolve) => {
        session.pendingApprovals.set(requestId, resolve);
        config.onApprovalRequest(req);
      },
    );

    // C1: recorded on THIS session only. Another chat writing the same path
    // still has to ask.
    if (approved && isFileEdit && file) {
      session.recentlyPermissionedWrites.add(file);
    }

    return this._selectOutcome(params, approved);
  }

  private async _handleWriteApproval(request: WriteTextFileRequest): Promise<boolean> {
    const session = this._sessionsByAcpId.get(request.sessionId as string);
    // An unroutable write is DENIED, never silently allowed (R4).
    if (!session) {
      traceAcp('approval', 'write for unknown session — denied', { sessionId: request.sessionId, path: request.path });
      return false;
    }

    // Auto-allow the write when THIS session already approved the file via
    // request_permission (C1 — never another session's approval).
    if (session.recentlyPermissionedWrites.has(request.path)) {
      session.recentlyPermissionedWrites.delete(request.path);
      return true;
    }

    const config = session.config;

    // Unified 'auto' approval mode — allow writes without prompting.
    if (config.approvalMode === 'auto') return true;

    const requestId = `acp-write-${++this._approvalSeq}`;
    traceAcp('approval', 'write-requested', { conversationId: session.conversationId, path: request.path });

    const req: UnifiedApprovalRequest = {
      requestId,
      agentId: 'opencode',
      kind: 'file-write',
      filePath: request.path,
    };

    const { approved } = await new Promise<{ approved: boolean; alwaysAllow: boolean }>(
      (resolve) => {
        session.pendingApprovals.set(requestId, resolve);
        config.onApprovalRequest(req);
      },
    );

    return approved;
  }

  /**
   * Map an approval decision to the ACP RequestPermissionResponse by matching
   * the appropriate option kind from the agent's offered options.
   */
  private _selectOutcome(
    params: RequestPermissionRequest,
    approved: boolean,
  ): RequestPermissionResponse {
    const wantKinds = approved
      ? ['allow_once', 'allow_always']
      : ['reject_once', 'reject_always'];
    const option = params.options.find((o) => wantKinds.includes(o.kind));
    if (option) {
      return { outcome: { outcome: 'selected', optionId: option.optionId } };
    }
    return { outcome: { outcome: 'cancelled' } };
  }
}
