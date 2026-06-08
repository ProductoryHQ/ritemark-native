/**
 * AcpRuntime — AgentRuntime adapter for the ACP/OpenCode runtime.
 *
 * Wraps AcpManager and maps its requestPermission + approveWrite callbacks to
 * the unified AgentRuntime interface. Does NOT rewrite AcpManager internals.
 *
 * BYOK provider keys arrive via `RuntimeSessionConfig.byokEnv` (built from
 * SecretStorage in UnifiedViewProvider) and are forwarded to the OpenCode
 * subprocess in start().
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
  RuntimeSessionConfig,
  RuntimeTurnConfig,
  RuntimeStatus,
  UnifiedApprovalRequest,
} from '../runtime/AgentRuntime';

type PendingApproval = (result: { approved: boolean; alwaysAllow: boolean }) => void;

const _browserToolsInjector = new BrowserToolsInjector();

export class AcpRuntime implements AgentRuntime {
  readonly id: AgentId = 'opencode';

  private _manager: AcpManager | null = null;
  private _sessionConfig: RuntimeSessionConfig | null = null;
  private _approvalSeq = 0;
  private _ipcServer: BrowserIpcServer | null = null;

  /** Pending approval promises keyed by requestId. Resolved by respondToApproval(). */
  private readonly _pendingApprovals = new Map<string, PendingApproval>();

  /**
   * Files whose `edit` was approved via session/request_permission. The follow-up
   * fs/write_text_file for the same path is auto-allowed to avoid a double prompt
   * (mirrors UnifiedViewProvider._acpRecentlyPermissionedWrites).
   */
  private readonly _recentlyPermissionedWrites = new Set<string>();

  async start(config: RuntimeSessionConfig): Promise<void> {
    if (this._manager?.isRunning()) {
      // Live session — just update the config reference (model may change per turn)
      this._sessionConfig = config;
      return;
    }
    this._disposeManager();
    this._sessionConfig = config;

    const runtime = findBundledAgentRuntime('opencode');
    if (!runtime) {
      throw new Error(
        'OpenCode runtime not found. Reinstall Ritemark to restore the bundled agent.',
      );
    }

    // Start the browser IPC server when the feature flag is on so OpenCode can
    // reach the integrated browser through the browserMcpAdapter subprocess.
    let mcpServers: unknown[] = [];
    const browserEnabled = isEnabled('browser-agent-control');
    if (browserEnabled) {
      const sessionId = crypto.randomUUID();
      const ipcServer = new BrowserIpcServer(sessionId);
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
      onProgress: config.onProgress,
    });

    await this._manager.start();
  }

  async prompt(turn: RuntimeTurnConfig): Promise<void> {
    if (!this._manager || !this._sessionConfig) {
      throw new Error('AcpRuntime: call start() before prompt()');
    }
    const config = this._sessionConfig;

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
        await this._manager.setModel(providerModel);
      }
      const result = await this._manager.prompt(promptText);
      config.onCodexComplete?.({ status: result?.stopReason ?? 'completed' });
    } catch (err) {
      config.onCodexComplete?.({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  async cancel(): Promise<void> {
    const manager = this._manager;
    this._manager = null;
    this._rejectPendingApprovals();
    try {
      await manager?.cancel();
    } catch {
      // Process may already be gone after cancel kills it
    }
  }

  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean, _feedback?: string): void {
    const resolve = this._pendingApprovals.get(requestId);
    if (!resolve) return;
    this._pendingApprovals.delete(requestId);
    resolve({ approved, alwaysAllow });
  }

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
    this._disposeManager();
    this._sessionConfig = null;
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private _disposeManager(): void {
    this._rejectPendingApprovals();
    this._recentlyPermissionedWrites.clear();
    this._manager?.dispose();
    this._manager = null;
    this._ipcServer?.stop();
    this._ipcServer = null;
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

  private _rejectPendingApprovals(): void {
    for (const resolve of this._pendingApprovals.values()) {
      resolve({ approved: false, alwaysAllow: false });
    }
    this._pendingApprovals.clear();
  }

  private async _handlePermission(
    params: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    const config = this._sessionConfig;
    if (!config) return { outcome: { outcome: 'cancelled' } };

    // Unified 'auto' approval mode — allow without prompting the user.
    if (config.approvalMode === 'auto') {
      return this._selectOutcome(params, true);
    }

    const tool = params.toolCall?.title ?? 'tool call';
    const file = params.toolCall?.locations?.[0]?.path;
    const isFileEdit = params.toolCall?.kind === 'edit' && !!file;
    const requestId = `acp-${++this._approvalSeq}`;
    traceAcp('approval', 'permission-requested', { tool, file, kind: params.toolCall?.kind });

    const req: UnifiedApprovalRequest = isFileEdit && file
      ? { requestId, agentId: 'opencode', kind: 'file-write', filePath: file }
      : { requestId, agentId: 'opencode', kind: 'shell-command', command: tool, workingDir: file ?? '' };

    const { approved, alwaysAllow } = await new Promise<{ approved: boolean; alwaysAllow: boolean }>(
      (resolve) => {
        this._pendingApprovals.set(requestId, resolve);
        config.onApprovalRequest(req);
      },
    );

    if (approved && isFileEdit && file) {
      this._recentlyPermissionedWrites.add(file);
    }

    return this._selectOutcome(params, approved);
  }

  private async _handleWriteApproval(request: WriteTextFileRequest): Promise<boolean> {
    // Auto-allow the write when the file was already approved via request_permission
    if (this._recentlyPermissionedWrites.has(request.path)) {
      this._recentlyPermissionedWrites.delete(request.path);
      return true;
    }

    const config = this._sessionConfig;
    if (!config) return false;

    // Unified 'auto' approval mode — allow writes without prompting.
    if (config.approvalMode === 'auto') return true;

    const requestId = `acp-write-${++this._approvalSeq}`;
    traceAcp('approval', 'write-requested', { path: request.path });

    const req: UnifiedApprovalRequest = {
      requestId,
      agentId: 'opencode',
      kind: 'file-write',
      filePath: request.path,
    };

    const { approved } = await new Promise<{ approved: boolean; alwaysAllow: boolean }>(
      (resolve) => {
        this._pendingApprovals.set(requestId, resolve);
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
