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
import { findBundledAgentRuntime, findBundledOpenCodePathEntries, readBundledRuntimeVersion } from '../utils/bundledAgentRuntime';
import { RitemarkIpcServer } from '../runtime/RitemarkIpcServer';
import type { RitemarkIpcRequest, RitemarkIpcResult } from '../runtime/RitemarkIpcServer';
import { RitemarkToolsInjector } from '../runtime/RitemarkToolsInjector';
import { BOARD_TOOL_GROUP, toolGroupsFor } from '../runtime/ritemarkTools';
import { isEnabled } from '../features';
import type { AgentId } from '../agent/types';
import type { BrowserTurnPage } from '../browser/BrowserActionTools';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  WriteTextFileRequest,
} from '@agentclientprotocol/sdk';
import type {
  AgentRuntime,
  RuntimeSession,
  RuntimeSessionConfig,
  RuntimeTurnConfig,
  RuntimeStatus,
  UnifiedApprovalRequest,
} from '../runtime/AgentRuntime';
import {
  continuationCheckpoint,
  frameRuntimePrompt,
  resolveRuntimeContinuation,
  transcriptRestoredState,
  type NormalizedRuntimeContext,
} from '../runtime/continuation';
import type { ExplicitThinkingEffort } from '../runtime/thinkingEffort';
import { thinkingEffortLabel } from '../runtime/thinkingEffort';
import { ACP_QUIET_STREAM_ERROR, acpTurnErrorCode } from '../runtime/runtimeErrorPresentation';
import { noteOpenCodeModels } from '../ai/modelCatalog';
import { workspaceFilesOnly } from '../runtime/turnFiles';
import { activeFileLines } from '../decks/currentSlide';

type ApprovalDecision = { approved: boolean; alwaysAllow: boolean };
type PendingApproval = (result: ApprovalDecision | undefined) => void;

const _toolsInjector = new RitemarkToolsInjector();

/** #658: OpenCode's browser requests name no conversation, so two conversations mid-turn cannot share the browser. */
export const ANOTHER_OPENCODE_CONVERSATION_ERROR =
  'Another OpenCode conversation is using the browser right now. Nothing was done. Try again when that conversation has finished.';

/**
 * #658: an OpenCode turn timed out and is still stopping. A browser call that arrives now may be that turn's, and the
 * requests name no conversation, so it is refused rather than sent to another conversation's page.
 */
export const ENDED_OPENCODE_TURN_ERROR =
  'An OpenCode turn that timed out is still stopping. Nothing was done in the browser. Try again in a moment.';

/**
 * #658: how long a timed-out turn's browser calls are refused at most, when its prompt never settles after the cancel
 * (a provider that hangs for good): another conversation's browser actions are refused only that long because of it.
 */
export const ENDED_OPENCODE_TURN_HOLD_MS = 60_000;

/**
 * A permission request for one of the board tools (Phase 0, P3). With
 * Ritemark's OpenCode permissions they never ask; this covers a user whose own
 * OpenCode config asks for everything, and OpenCode's `doom_loop` check on
 * three identical calls in a row. Edits and shell commands keep asking.
 */
export function isBoardToolPermission(params: RequestPermissionRequest): boolean {
  const call = params.toolCall as { title?: unknown; rawInput?: unknown } | undefined;
  const title = typeof call?.title === 'string' ? call.title : '';
  const prefix = `${BOARD_TOOL_GROUP.server}_`;
  if (title.startsWith(prefix)) return true;
  if (title === 'doom_loop') {
    const raw = call?.rawInput as { tool?: unknown } | undefined;
    return typeof raw?.tool === 'string' && raw.tool.startsWith(prefix);
  }
  return false;
}

// The 90-second quiet window is separate from the inactivity setting, which sets the turn ceiling.
const ACP_QUIET_STREAM_MS = 90_000;
const ACP_TURN_CEILING_MS = 15 * 60_000;
// Give the notification time to flush before completion can dispose the subprocess.
const ACP_CANCEL_WRITE_MS = 1_000;

/**
 * Compose the text sent to OpenCode for one turn. Pure — no I/O — so the
 * injection order and once-per-session capability-context behaviour are
 * unit-testable without a live process (Sprint 101 S6.2).
 *
 * Order (top → bottom): capability context (first turn only) · attachments ·
 * `[Currently editing: …]` · the user's prompt.
 */
export function buildAcpPromptText(
  turn: RuntimeTurnConfig,
  opts: { capabilityContext?: string } = {},
): { text: string; imageAttachmentCount: number } {
  let promptText = turn.prompt;
  // Active file context — same `[Currently editing: …]` preamble Claude Code and
  // Codex inject, so "edit this file" prompts know the target.
  if (turn.activeFile) {
    promptText = `${activeFileLines(turn.activeFile).join('\n')}\n\n${promptText}`;
  }
  let imageAttachmentCount = 0;
  if (turn.attachments && turn.attachments.length > 0) {
    const blocks = turn.attachments.map(a => `**Attachment: ${a.name}**\n\`\`\`\n${a.data}\n\`\`\``);
    promptText = `${blocks.join('\n\n')}\n\n${promptText}`;
    imageAttachmentCount = turn.attachments.filter(a => a.kind === 'image').length;
  }
  // Capability context (Sprint 101 #154): ACP has no system prompt, so the shared
  // context rides in as a standing preamble on the first turn of the session.
  if (opts.capabilityContext && opts.capabilityContext.trim()) {
    promptText = `${opts.capabilityContext}\n\n${promptText}`;
  }
  return { text: promptText, imageAttachmentCount };
}

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

  /**
   * Whether this session has already injected the shared capability context
   * (`config.extraSystemPrompt`). ACP has no system-prompt mechanism, so the
   * context is prepended to the FIRST turn only — OpenCode retains earlier turn
   * text in the session, so once is enough and per-turn injection would bloat
   * every prompt. See Sprint 101 technical-plan §4.
   */
  private _capabilityContextInjected = false;
  private _dispatchAccepted = false;
  private _manualThinkingEffortApplied = false;
  private _stopPreparation?: () => void;
  private _restartSession = false;

  constructor(
    readonly conversationId: string,
    /** The ACP session id on the shared connection. */
    private _acpSessionId: string,
    config: RuntimeSessionConfig,
    private readonly _runtime: AcpRuntime,
    private _continuationContext?: NormalizedRuntimeContext,
    private readonly _quietStreamMs = ACP_QUIET_STREAM_MS,
    private readonly _turnCeilingMs = ACP_TURN_CEILING_MS,
  ) {
    this._config = config;
  }

  get config(): RuntimeSessionConfig { return this._config; }

  applyConfig(config: RuntimeSessionConfig): void {
    this._config = config;
    const continuation = resolveRuntimeContinuation('opencode', config.continuation);
    this._continuationContext = continuation.kind === 'native'
      ? config.continuation?.nativeDelta
      : config.continuation?.fallbackContext;
  }

  get acpSessionId(): string { return this._acpSessionId; }

  async prompt(turn: RuntimeTurnConfig): Promise<void> {
    const manager = this._runtime.getManager();
    if (!manager) {
      throw new Error('AcpRuntime: createSession() must succeed before prompt()');
    }
    const config = this._config;
    this._dispatchAccepted = false;

    config.onProgress({ type: 'init', message: 'Starting OpenCode…', timestamp: Date.now() });

    const ceilingMinutes = turn.timeoutMinutes ?? this._turnCeilingMs / 60_000;
    const ceilingMs = turn.timeoutMinutes === undefined ? this._turnCeilingMs : ceilingMinutes * 60_000;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let approvals = 0;
    let toolsRunning = false;
    let finished = false;
    const abort = new AbortController();
    let fail!: (error: Error) => void;
    const failed = new Promise<never>((_, reject) => { fail = reject; });
    const stop = (error: Error) => {
      if (finished || abort.signal.aborted) return;
      fail(error);
      abort.abort(error);
      clearTimeout(quietTimer);
      clearTimeout(ceilingTimer);
    };
    const onActivity = () => {
      clearTimeout(quietTimer);
      if (finished || abort.signal.aborted || approvals > 0 || toolsRunning) return;
      quietTimer = setTimeout(() => {
        stop(Object.assign(new Error('OpenCode did not respond'), { code: ACP_QUIET_STREAM_ERROR }));
      }, this._quietStreamMs);
    };

    const ceilingTimer = setTimeout(() => {
      stop(new Error(`OpenCode did not respond within ${ceilingMinutes} minutes. The selected model or provider may be unavailable or rate-limited — try again, or pick a different model.`));
    }, ceilingMs);
    onActivity();
    let stoppedByUser = false;
    let browserTurn = false;
    let cancelWriteTimer: ReturnType<typeof setTimeout> | undefined;
    this._stopPreparation = () => {
      stoppedByUser = true;
      stop(new Error('OpenCode preparation stopped'));
    };
    const prepare = async <T>(step: Promise<T>): Promise<T> => {
      const result = await Promise.race([step, failed]);
      abort.signal.throwIfAborted();
      return result;
    };

    try {
      const previousSessionId = this.acpSessionId;
      const readySessionId = await prepare(this._restartSession
        ? manager.start(abort.signal)
        : manager.preparePrompt(previousSessionId, abort.signal));
      this._restartSession = false;
      if (readySessionId !== previousSessionId) {
        this._runtime._replaceSessionId(this, previousSessionId, readySessionId, manager);
        this._acpSessionId = readySessionId;
        this._capabilityContextInjected = false;
        this._manualThinkingEffortApplied = false;
        this._continuationContext = config.continuation?.fallbackContext;
        const compatibility = config.continuation?.compatibility;
        if (compatibility) {
          config.onContinuationCheckpoint?.(continuationCheckpoint(
            readySessionId, compatibility, this._continuationContext?.coveredThroughEventId ?? null,
          ));
        }
      }

      // Inject the shared capability context once per session (ACP has no system
      // prompt). config.extraSystemPrompt is set by UnifiedViewProvider to the
      // ACP-flavoured render of src/ai/capabilityContext.ts.
      const capabilityContext = this._capabilityContextInjected ? undefined : config.extraSystemPrompt;
      const { text: rawPromptText, imageAttachmentCount } = buildAcpPromptText(turn, { capabilityContext });
      const continuationContext = this._continuationContext;
      this._continuationContext = undefined;
      const promptText = frameRuntimePrompt(rawPromptText, continuationContext);
      if (capabilityContext && capabilityContext.trim()) {
        this._capabilityContextInjected = true;
      }
      if (imageAttachmentCount > 0) {
        config.onProgress({ type: 'text', message: `Note: ${imageAttachmentCount} image attachment(s) converted to text (OpenCode BYOK does not support inline multimodal in this version).`, timestamp: Date.now() });
      }

      // Apply model for this turn (strip 'opencode:' composite prefix if present).
      // Must be inside try/catch — setModel throws if the model ID is invalid.
      if (config.model) {
        const providerModel = config.model.startsWith('opencode:')
          ? config.model.slice('opencode:'.length)
          : config.model;
        await prepare(manager.setModel(this.acpSessionId, providerModel));
        config.onThinkingEffortCapability?.(manager.getThinkingEffortCapability(this.acpSessionId));
      }

      const requestedThinkingEffort = turn.thinkingEffort ?? 'auto';
      let appliedThinkingEffort: ExplicitThinkingEffort | undefined;
      let effortFallback = false;
      if (requestedThinkingEffort !== 'auto' || this._manualThinkingEffortApplied) {
        try {
          appliedThinkingEffort = await prepare(manager.setThinkingEffort(
            this.acpSessionId,
            requestedThinkingEffort,
          ));
        } catch (error) {
          if (abort.signal.aborted || requestedThinkingEffort === 'auto') throw error;
          effortFallback = true;
          appliedThinkingEffort = await prepare(manager.setThinkingEffort(this.acpSessionId, 'auto').catch(() => undefined));
          this._manualThinkingEffortApplied = false;
          config.onThinkingEffortApplied?.({
            requested: requestedThinkingEffort,
            ...(appliedThinkingEffort ? { applied: appliedThinkingEffort } : {}),
            adjusted: true,
          });
          config.onProgress({
            type: 'text',
            message: `${thinkingEffortLabel(requestedThinkingEffort)} isn’t available for this OpenCode session. Using Auto.`,
            timestamp: Date.now(),
          });
        }
      }
      if (!effortFallback && (requestedThinkingEffort === 'auto' || appliedThinkingEffort)) {
        this._manualThinkingEffortApplied = requestedThinkingEffort !== 'auto';
        config.onThinkingEffortApplied?.({
          requested: requestedThinkingEffort,
          ...(appliedThinkingEffort ? { applied: appliedThinkingEffort } : {}),
          adjusted: false,
        });
      }

      abort.signal.throwIfAborted();
      this._stopPreparation = undefined;
      // #658: hold this conversation's browser page only while its prompt is active.
      this._runtime.beginBrowserTurn(this, config.browserPage);
      browserTurn = true;
      const prompted = manager.prompt(this.acpSessionId, promptText, {
        onActivity,
        onApproval: (waiting) => {
          approvals += waiting ? 1 : -1;
          onActivity();
        },
        onToolRunning: (running) => {
          toolsRunning = running;
          onActivity();
        },
      }, abort.signal);
      try {
        const result = await Promise.race([prompted, failed]);
        this.markDispatchAccepted();
        // ACP calls a successful terminal state `end_turn`, while the shared
        // Ritemark/Codex result contract calls it `completed`. Forwarding the
        // wire value made the webview show a red Failed marker after OpenCode
        // had already edited the document and streamed its final answer.
        const status = result?.stopReason === 'end_turn' || !result?.stopReason
          ? 'completed'
          : result.stopReason === 'cancelled'
            ? 'interrupted'
            : result.stopReason;
        const lastAgentMessage = manager.lastAgentMessage(this.acpSessionId);
        // Sprint 155: the files its completed edits changed, workspace files only.
        const filesModified = workspaceFilesOnly(manager.turnFilesModified?.(this.acpSessionId) ?? [], config.workspacePath);
        config.onCodexComplete?.({
          status,
          ...(lastAgentMessage ? { lastAgentMessage } : {}),
          ...(filesModified.length ? { filesModified } : {}),
        });
      } catch (err) {
        // The prompt may still be pending after a timeout.
        if (abort.signal.aborted) {
          // #658: its browser calls still in flight are refused until its prompt settles, not sent to another page.
          this._runtime.holdEndedBrowserTurn(this, prompted);
          this.rejectPendingApprovals();
          this.recentlyPermissionedWrites.clear();
          await Promise.race([
            manager.cancelTurn(this.acpSessionId).catch(() => { /* already failing */ }),
            new Promise<void>((resolve) => { cancelWriteTimer = setTimeout(resolve, ACP_CANCEL_WRITE_MS); }),
          ]);
        }
        throw err;
      }
    } catch (err) {
      if (stoppedByUser) {
        config.onCodexComplete?.({ status: 'interrupted' });
        return;
      }
      if (abort.signal.aborted && !browserTurn) {
        // A pending configuration reply or update belongs to the old session.
        manager.closeSession(this.acpSessionId);
        this._restartSession = true;
      }
      const raw = err instanceof Error ? err.message : String(err);
      const errorCode = acpTurnErrorCode(err);
      config.onCodexComplete?.({
        status: 'error', error: describeAcpTurnError(raw),
        ...(errorCode ? { errorCode } : {}),
      });
    } finally {
      finished = true;
      this._stopPreparation = undefined;
      clearTimeout(quietTimer);
      clearTimeout(cancelWriteTimer);
      clearTimeout(ceilingTimer);
      if (browserTurn) this._runtime.endBrowserTurn(this);
    }
  }

  async cancel(): Promise<void> {
    this._stopPreparation?.();
    this.rejectPendingApprovals();
    try {
      await this._runtime.getManager()?.cancel(this.acpSessionId);
    } catch {
      // Best-effort: the session may already have settled or the connection dropped.
    }
    this._runtime._forgetSession(this);
  }

  /** First provider-originated progress/tool/final signal for this turn. */
  markDispatchAccepted(): void {
    if (this._dispatchAccepted) return;
    this._dispatchAccepted = true;
    this._config.onDispatchAccepted?.();
  }

  respondToApproval(requestId: string, approved: boolean, alwaysAllow: boolean, _feedback?: string): void {
    const resolve = this.pendingApprovals.get(requestId);
    if (!resolve) return;
    this.pendingApprovals.delete(requestId);
    resolve({ approved, alwaysAllow });
  }

  dispose(): void {
    this._stopPreparation?.();
    this.rejectPendingApprovals();
    this.recentlyPermissionedWrites.clear();

    // Cancel BEFORE forgetting the session. closeSession() only drops local
    // state, so without this the upstream turn keeps running against a
    // conversation nobody is watching. The approval gate does hold — an
    // unroutable permission is cancelled and an unroutable write denied
    // (see _handlePermission / _handleWriteApproval) — but leaving a turn
    // executing after the user discarded its conversation is wrong on its own,
    // and burns tokens with no way to observe or stop it.
    const manager = this._runtime.getManager();
    void manager?.cancel(this.acpSessionId).catch(() => { /* disposing anyway */ });
    manager?.closeSession(this.acpSessionId);
    this._runtime._forgetSession(this);
  }

  /** @internal */
  rejectPendingApprovals(): void {
    for (const resolve of this.pendingApprovals.values()) {
      resolve(undefined);
    }
    this.pendingApprovals.clear();
  }
}

/**
 * Turn an ACP turn failure into something a user can act on.
 *
 * OpenCode 1.18.4 has no default model — `configOptions.model.current` is
 * undefined — so prompting before one is selected throws "No provider
 * available". Sprint 100 verified 1.15.13 had no default either, but it failed
 * differently: a silent `end_turn` with zero tokens, which Ritemark reported via
 * its empty-turn soft error. The bump turned a silent failure into a loud one,
 * which is an improvement — but the raw message says nothing about what to do.
 */
export function describeAcpTurnError(raw: string): string {
  if (/no provider available/i.test(raw)) {
    return 'No model is selected for OpenCode. Pick one in the model selector below the message box, then try again.';
  }
  return raw;
}

export class AcpRuntime implements AgentRuntime {
  readonly id: AgentId = 'opencode';

  /** ONE manager / ONE OpenCode subprocess shared by every conversation (D1). */
  private _manager: AcpManager | null = null;
  private _approvalSeq = 0;
  private _ipcServer: RitemarkIpcServer | null = null;

  private readonly _sessions = new Map<string, AcpSession>();
  /** Reverse index — ACP notifications and fs requests carry `sessionId`. */
  private readonly _sessionsByAcpId = new Map<string, AcpSession>();

  async createSession(conversationId: string, config: RuntimeSessionConfig): Promise<RuntimeSession> {
    const existing = this._sessions.get(conversationId);
    if (existing) {
      const continuation = resolveRuntimeContinuation('opencode', config.continuation);
      if (continuation.kind === 'native' || !config.continuation?.fallbackContext) {
        existing.applyConfig(config);
        return existing;
      }
      this.disposeSession(conversationId);
    }

    await this._ensureManager(config);
    const continuation = resolveRuntimeContinuation('opencode', config.continuation);
    let acpSessionId: string | null = null;
    let useNativeContext = false;
    if (continuation.kind === 'native') {
      config.onContinuationState?.({ mode: 'pending' });
      try {
        await this._manager!.resume(continuation.descriptor.nativeReference);
        acpSessionId = continuation.descriptor.nativeReference;
        useNativeContext = true;
        config.onContinuationState?.({ mode: 'native-restored' });
      } catch (error) {
        traceAcp('runtime', 'native session resume rejected; starting fresh', {
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        });
        config.onContinuationState?.(config.continuation?.fallbackContext
          ? transcriptRestoredState(config.continuation.fallbackContext)
          : { mode: 'context-unavailable', failureCategory: 'provider-rejected' });
      }
    } else if (continuation.kind === 'fallback') {
      config.onContinuationState?.(config.continuation?.fallbackContext
        ? transcriptRestoredState(config.continuation.fallbackContext)
        : { mode: 'context-unavailable', failureCategory: continuation.failureCategory });
    }
    if (!acpSessionId) {
      if (continuation.kind === 'fresh' && config.continuation?.fallbackContext) {
        config.onContinuationState?.(transcriptRestoredState(config.continuation.fallbackContext));
      }
      acpSessionId = await this._manager!.start();
    }
    const session = new AcpSession(
      conversationId,
      acpSessionId,
      config,
      this,
      useNativeContext ? config.continuation?.nativeDelta : config.continuation?.fallbackContext,
    );
    this._sessions.set(conversationId, session);
    this._sessionsByAcpId.set(acpSessionId, session);
    config.onThinkingEffortCapability?.(this._manager!.getThinkingEffortCapability(acpSessionId));
    const compatibility = config.continuation?.compatibility;
    if (compatibility) {
      config.onContinuationCheckpoint?.(continuationCheckpoint(
        acpSessionId,
        compatibility,
        continuation.kind === 'native'
          ? continuation.descriptor.coveredThroughEventId
          : config.continuation?.fallbackContext?.coveredThroughEventId ?? null,
      ));
    }
    traceAcp('runtime', 'session-created', { conversationId, liveSessions: this._sessions.size });
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
      version: readBundledRuntimeVersion(runtime.path) ?? undefined,
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
    this._releaseEndedTurn(session);
    this._sessions.delete(session.conversationId);
    this._sessionsByAcpId.delete(session.acpSessionId);
    if (this._sessions.size === 0) {
      this._manager?.dispose();
      this._manager = null;
      this._stopIpcServer();
    }
  }

  /** @internal Route updates and approvals to the existing conversation after session replacement. */
  _replaceSessionId(session: AcpSession, previousId: string, nextId: string, manager: AcpManager): void {
    if (this._manager !== manager || this._sessions.get(session.conversationId) !== session) {
      manager.closeSession(nextId);
      throw new Error('OpenCode conversation was closed while restarting its session.');
    }
    this._sessionsByAcpId.delete(previousId);
    this._sessionsByAcpId.set(nextId, session);
  }

  private _stopIpcServer(): void {
    this._ipcServer?.stop();
    this._ipcServer = null;
  }

  /**
   * #658: the browser page holder the browser tools act in: that of the session mid-turn (the one that began last,
   * when two are), or none when no session is mid-turn.
   */
  private _browserPage: BrowserTurnPage | undefined;

  /** #658: the sessions mid-turn, with the browser page holder of each one's conversation. */
  private readonly _turnPages = new Map<AcpSession, BrowserTurnPage | undefined>();

  /** #658: a session starts a turn; its conversation's browser page is the one OpenCode's browser tools act in. */
  beginBrowserTurn(session: AcpSession, page: BrowserTurnPage | undefined): void {
    this._turnPages.set(session, page);
    this._browserPage = page;
  }

  /**
   * #658: a session's turn ended. The browser tools now act in the page of a session still mid-turn (the one that
   * began last), or in none: never in the page of the turn that ended.
   */
  endBrowserTurn(session: AcpSession): void {
    this._turnPages.delete(session);
    const stillMidTurn = [...this._turnPages.values()];
    this._browserPage = stillMidTurn.length ? stillMidTurn[stillMidTurn.length - 1] : undefined;
  }

  /**
   * #658: OpenCode's browser requests name no conversation. While two sessions are mid-turn with different turn pages,
   * which one asked cannot be told, so a browser action would land in the wrong conversation's page: refuse it.
   */
  chatsContested(): boolean {
    return new Set(this._turnPages.values()).size > 1;
  }

  browserContested(): boolean {
    const pageIds = new Set([...this._turnPages.values()].map((page) => page?.pageId ?? ''));
    return this._turnPages.size > 1 && pageIds.size > 1;
  }

  /** #658: the sessions whose turn timed out and whose prompt has not settled yet; see `holdEndedBrowserTurn`. */
  private readonly _endedTurns = new Map<AcpSession, { timer?: ReturnType<typeof setTimeout> }>();

  /**
   * #658: a session's turn timed out. Sending cancel does not guarantee that its prompt has settled, and a browser
   * call already on its way from that turn names no conversation: it would go to another conversation's page.
   * So every browser call is refused until the timed-out prompt settles, the session is forgotten, or
   * `ENDED_OPENCODE_TURN_HOLD_MS` passes.
   */
  holdEndedBrowserTurn(session: AcpSession, prompted: Promise<unknown>): void {
    const hold: { timer?: ReturnType<typeof setTimeout> } = {};
    this._releaseEndedTurn(session);
    this._endedTurns.set(session, hold);
    const release = () => {
      if (this._endedTurns.get(session) === hold) this._releaseEndedTurn(session);
    };
    hold.timer = setTimeout(release, ENDED_OPENCODE_TURN_HOLD_MS);
    hold.timer.unref?.();
    prompted.then(release, release);
  }

  private _releaseEndedTurn(session: AcpSession): void {
    const hold = this._endedTurns.get(session);
    if (!hold) return;
    if (hold.timer) clearTimeout(hold.timer);
    this._endedTurns.delete(session);
  }

  /** #658: an adapter's request, the browser's refused while another conversation's turn holds a different page. */
  async handleToolRequest(req: RitemarkIpcRequest): Promise<RitemarkIpcResult> {
    if (req.op === 'call' && req.group === 'browser' && this._endedTurns.size) {
      return { text: ENDED_OPENCODE_TURN_ERROR, isError: true };
    }
    if (req.op === 'call' && req.group === 'browser' && this.browserContested()) {
      return { text: ANOTHER_OPENCODE_CONVERSATION_ERROR, isError: true };
    }
    // Sprint 162 PR 5: a theme write is recorded under its chat and, in Ask mode, asks there first; with two OpenCode
    // chats mid-turn, which one asked can't be told, so the writing theme tools are refused as the browser's are
    if (req.op === 'call' && req.group === 'deck' && (req.tool === 'set_deck_theme' || req.tool === 'set_theme_draft_colours') && this.chatsContested()) {
      return { text: 'Another OpenCode conversation is working right now, so Ritemark cannot tell which chat this theme change belongs to. Nothing was written: try again when it has finished.', isError: true };
    }
    return _toolsInjector.handleIpc(req, 'opencode', this._browserPage);
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

    // Ritemark's tools reach OpenCode through the stdio adapter, one adapter
    // process per group (the browser with its feature flag, the task board when
    // this window has one), all answered over one IPC socket. Under D1 all
    // sessions share one subprocess and therefore one socket — consistent with
    // decision D2 (one shared browser). Disposing a single conversation must
    // NOT stop it (C4). The groups are fixed for the process's life.
    let mcpServers: unknown[] = [];
    const groups = toolGroupsFor({ browser: isEnabled('browser-agent-control') });
    if (groups.length) {
      const ipcSessionId = crypto.randomUUID();
      const ipcServer = new RitemarkIpcServer(ipcSessionId);
      // #658: the requests name no conversation; the page is the last-prompted conversation's (one shared browser, D2).
      await ipcServer.start((req) => this.handleToolRequest(req));
      this._ipcServer = ipcServer;
      mcpServers = _toolsInjector.acpMcpServers(groups, ipcServer.socketPath);
      traceAcp('runtime', 'ipc-started', { socketPath: ipcServer.socketPath, groups: groups.map((group) => group.id) });
    }

    this._manager = new AcpManager({
      binaryPath: runtime.path,
      pathEntries: findBundledOpenCodePathEntries(runtime.path),
      workspaceRoot: config.workspacePath,
      byokEnv: config.byokEnv ?? {},
      mcpServers,
      requestPermission: (params) => this._handlePermission(params),
      approveWrite: (request) => this._handleWriteApproval(request),
      // Sprint 141 R10: OpenCode's own model list feeds the model menu.
      onModelOptions: (options) => noteOpenCodeModels(options),
      onProgress: (progress, sessionId) => {
        const session = this._sessionsByAcpId.get(sessionId);
        session?.markDispatchAccepted();
        session?.config.onProgress(progress);
      },
      onThinkingEffortCapability: (capability, sessionId) => {
        this._sessionsByAcpId.get(sessionId)?.config.onThinkingEffortCapability?.(capability);
      },
    });
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
    session.markDispatchAccepted();
    const config = session.config;

    // Board tools change only the board, in every mode (Phase 0, P3).
    if (isBoardToolPermission(params)) {
      traceAcp('approval', 'board tool allowed', { conversationId: session.conversationId, tool: params.toolCall?.title });
      return this._selectOutcome(params, true);
    }

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

    const decision = await new Promise<ApprovalDecision | undefined>(
      (resolve) => {
        session.pendingApprovals.set(requestId, resolve);
        config.onApprovalRequest(req);
      },
    );

    if (!decision) return { outcome: { outcome: 'cancelled' } };
    const { approved } = decision;

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
    session.markDispatchAccepted();

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

    const decision = await new Promise<ApprovalDecision | undefined>(
      (resolve) => {
        session.pendingApprovals.set(requestId, resolve);
        config.onApprovalRequest(req);
      },
    );

    return decision?.approved ?? false;
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
