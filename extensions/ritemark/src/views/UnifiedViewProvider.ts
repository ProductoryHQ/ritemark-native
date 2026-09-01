/**
 * Unified AI View Provider
 * Hosts the AI chat sidebar (Primary Sidebar) for the Claude Code and Codex runtimes.
 */

import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import {
  getAPIKeyManager,
  apiKeyChanged,
  isOnline,
  connectivityChanged,
  forceConnectivityCheck,
  type EditorSelection
} from '../ai/index';

// Read once at module load — Node's require cache makes this effectively a
// one-time read. Mirrors the pattern in RitemarkSettingsProvider so the AI
// sidebar's model picker can surface the SDK version without an extra IPC.
const CLAUDE_AGENT_SDK_VERSION: string | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('@anthropic-ai/claude-agent-sdk/package.json') as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
})();

import {
  AGENTS,
  DEFAULT_TOOLS,
  getSetupStatus,
  getAgentEnvironmentStatus,
  clearSetupCache,
  setAnthropicKeyAvailable,
  installClaude,
  openAnthropicKeySettings,
  beginClaudeLogin,
  installGit,
  installNode,
  installCodexCli,
  getOnboardingStatus,
  checkWingetAvailable,
  setClaudeLoginInProgress,
  clearClaudePendingReload,
  emitClaudeStatusInvalidated,
  onClaudeStatusInvalidated,
  type AgentId,
  type SetupStatus,
  type OnboardingStatus,
  traceClaude,
} from '../agent';
import { BrowserContextStore } from '../browser/BrowserContextStore';
import { createBrowserMcpServer, BROWSER_MCP_SERVER_NAME, BROWSER_TOOL_ALLOW_NAMES } from '../browser/browserMcpServer';
import { isCodexBrowserToolCall, dispatchCodexBrowserToolCall } from '../browser/codexBrowserTools';
import { isEnabled } from '../features';
import { discoverAgents, discoverCommands } from '../agent/discovery';
import { CodexManager, onCodexStatusInvalidated, emitCodexStatusInvalidated, traceCodex } from '../codex';
// Sprint 76 R3a/R4/R5/R6: ACP + OpenCode BYOK runtime
import { byokProviderFlags, buildByokEnv, BYOK_SECRET_KEYS, type ByokKeys, type ByokProviderFlags } from '../acp';
import { TRANSCRIPT_WORKBENCH_VIEW_TYPE, transcriptDocumentFor } from '../speech/activeTranscript';
// Sprint 79: runtime adapter wrappers + registry (registry created here; dispatch wired in W2)
import { RuntimeRegistry } from '../runtime/RuntimeRegistry';
import { createRuntime } from '../runtime/runtimeFactory';
import { CodexRuntime, type CodexSidebarStatus } from '../codex/CodexRuntime';
import * as modelCatalog from '../ai/modelCatalog';
import {
  renderCapabilityContext,
  CLAUDE_DESCRIPTOR,
  CODEX_DESCRIPTOR,
  ACP_DESCRIPTOR,
  type CapabilityDescriptor,
} from '../ai/capabilityContext';
import { UnifiedApprovalGate } from '../runtime/UnifiedApprovalGate';
import { RUNTIME_CAPABILITIES, capabilitiesFor } from '../runtime/capabilities';
import type { AgentRuntime, RuntimeSession, RuntimeSessionConfig } from '../runtime/AgentRuntime';
import { presentRuntimeError } from '../runtime/runtimeErrorPresentation';
import {
  isThinkingEffort,
  thinkingEffortLabel,
  validateThinkingEffort,
  type ExplicitThinkingEffort,
  type ThinkingEffort,
  type ThinkingEffortCapability,
} from '../runtime/thinkingEffort';
import {
  RUNTIME_CONTINUATION_ADAPTER_CONTRACT_VERSION,
  createRuntimeCompatibilityFingerprint,
  type RuntimeContinuationRequest,
} from '../runtime/continuation';
import { ConversationController } from '../conversations/ConversationController';
import { ConversationStore, ConversationStoreError, conversationStoreDir } from '../conversations/ConversationStore';
import { ConversationCutoverState } from '../conversations/ConversationCutoverState';
import { LegacyConversationMigrator } from '../conversations/LegacyConversationMigrator';
import { isConversationRequestMessage } from '../conversations/protocol';
import { resolveProjectScope } from '../conversations/projectScope';
import { ConversationTitleGenerator } from '../conversations/ConversationTitleGenerator';
import { showConversationDeleteNotification } from '../conversations/conversationDeleteNotification';
import {
  decideRuntimeAttachmentCapacity,
  PARALLEL_RUNTIME_ATTACHMENT_LIMIT,
  SINGLE_RUNTIME_ATTACHMENT_LIMIT,
} from '../conversations/runtimeAttachmentPolicy';
import { buildNormalizedContextPack } from '../conversations/contextPack';
import {
  buildAgentSidebarBootstrap,
  buildLegacyAgentSidebarConfig,
  AgentSidebarBootstrapError,
} from './agentSidebarBootstrap';
import { versionedWebviewAssetUri } from './webviewAssetUri';

/**
 * Conversation id used when a webview message predates the Sprint 99 protocol.
 * // Sprint 99 Phase 1: remove once every webview path sends conversationId.
 */
const DEFAULT_CONVERSATION_ID = 'default';

export class UnifiedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.unifiedView';

  private _view?: vscode.WebviewView;
  /**
   * Monotonic identity for the concrete webview instance. Async work may finish
   * after a view was disposed and replaced; generation + exact-webview checks
   * prevent those results from hydrating the replacement view.
   */
  private _viewGeneration = 0;
  private _hydratedViewGeneration = 0;
  private _legacySidebarViewGeneration = 0;
  private readonly _sidebarStatusRevisions: Record<AgentId | 'discovery', number> = {
    'claude-code': 0,
    codex: 0,
    opencode: 0,
    discovery: 0,
  };
  /**
   * Live runtime sessions, keyed by conversation then runtime.
   *
   * A conversation talks to one runtime at a time, but switching runtime inside
   * one conversation must not disturb any other conversation's sessions — hence
   * the nesting rather than a flat map.
   */
  private readonly _runtimeSessions = new Map<string, Map<AgentId, RuntimeSession>>();
  /** Latest accepted execution per conversation; stale provider callbacks are ignored. */
  private readonly _activeRuntimeTurnTokens = new Map<string, symbol>();
  private readonly _conversationCheckpointQueues = new Map<string, Promise<void>>();
  private readonly _runtimeSessionLastUsed = new Map<string, number>();
  /** ACP thought_level is discovered only after the existing lazy session opens. */
  private readonly _liveThinkingEffortCapabilities = new Map<string, Partial<Record<AgentId, ThinkingEffortCapability>>>();
  private _selectedConversationId: string | null = null;
  private _documentContent: string = '';
  private _currentSelection: EditorSelection = { text: '', isEmpty: true, from: 0, to: 0 };

  private _disposeCodexStatusListener: (() => void) | null = null;
  private _claudeLoginPoll: ReturnType<typeof setInterval> | null = null;
  private _disposeClaudeStatusListener: (() => void) | null = null;
  private _browserContextPoll: ReturnType<typeof setInterval> | null = null;
  /** Sprint 78 (#73): cached annotation-mode screenshot keyed by URL to avoid
   *  re-capturing every 1500ms poll when the page hasn't changed. The TTL keeps
   *  the thumbnail fresh when the user scrolls or interacts without navigating. */
  private static readonly ANNOTATION_SCREENSHOT_TTL_MS = 5000;
  private _annotationScreenshotCache: { url: string; dataUrl: string; capturedAt: number } | null = null;

  /** Sprint 78 (stretch): BYOK secret-change subscription (see constructor). */
  private _secretsChangeListener?: vscode.Disposable;

  private _runtimeRegistry: RuntimeRegistry;
  private _approvalGate: UnifiedApprovalGate;
  private readonly _conversationController: ConversationController;
  private readonly _conversationTitleGenerator: ConversationTitleGenerator;
  private _continuationHostSecretPromise: Promise<string> | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string | undefined,
    private readonly _secrets: vscode.SecretStorage | undefined,
    globalStorageUri: vscode.Uri,
  ) {
    this._disposeCodexStatusListener = onCodexStatusInvalidated((event) => {
      void this._handleExternalCodexStatusInvalidation(event.reason);
    });
    this._disposeClaudeStatusListener = onClaudeStatusInvalidated((event) => {
      void this._handleExternalClaudeStatusInvalidation(event.reason);
    });
    this._secretsChangeListener = this._secrets?.onDidChange((e) => {
      if (BYOK_SECRET_KEYS.includes(e.key)) {
        void this._sendAcpProviders();
      }
    });

    this._runtimeRegistry = new RuntimeRegistry(new Map<AgentId, AgentRuntime>([
      ['claude-code', createRuntime('claude-code')],
      ['codex', createRuntime('codex')],
      ['opencode', createRuntime('opencode')],
    ]));
    this._approvalGate = new UnifiedApprovalGate((req) => {
      this._view?.webview.postMessage({ type: 'agent-approval-request', ...req });
    });
    this._conversationTitleGenerator = new ConversationTitleGenerator(
      (runtimeId) => createRuntime(runtimeId),
    );
    const conversationStore = new ConversationStore(conversationStoreDir(globalStorageUri.fsPath));
    const conversationCutover = new ConversationCutoverState(conversationStore);
    this._conversationController = new ConversationController({
      store: conversationStore,
      currentScope: () => resolveProjectScope({
        workspaceFileUri: vscode.workspace.workspaceFile?.toString() ?? null,
        folderUris: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.toString()),
        platform: process.platform,
      }),
      stopConversation: (conversationId) => this._stopConversationSessions(conversationId),
      emit: (event) => { void this._view?.webview.postMessage(event); },
      rolloutMode: () => conversationCutover.resolve(isEnabled('durableAgentConversations')),
      markHostAuthority: () => conversationCutover.establishHostAuthority(),
      migrator: new LegacyConversationMigrator(conversationStore),
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    const viewGeneration = ++this._viewGeneration;
    this._legacySidebarViewGeneration = 0;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (isConversationRequestMessage(message)) {
        const response = await this._conversationController.handle(message);
        try {
          await webviewView.webview.postMessage(response);
        } finally {
          if (message.type === 'conversation/delete'
            && response.ok
            && 'undoToken' in response.data
            && 'title' in response.data) {
            const deletion = response.data;
            void showConversationDeleteNotification({
              undoToken: deletion.undoToken,
              title: deletion.title,
              recovery: deletion.recovery === true,
            }, {
              showInformationMessage: (text, action) => vscode.window.showInformationMessage(text, action),
              showWarningMessage: (text) => vscode.window.showWarningMessage(text),
              restore: (undoToken, recovery) => this._conversationController.handle({
                type: 'conversation/undo-delete',
                requestId: `native-undo-${randomBytes(12).toString('hex')}`,
                undoToken,
                ...(recovery ? { recovery: true } : {}),
              }),
              dismiss: (undoToken) => this._conversationController.dismissDeleteUndo(undoToken),
              deliver: async (restoreResponse) => {
                await this._view?.webview.postMessage(restoreResponse);
              },
            }).catch((error: unknown) => {
              void vscode.window.showWarningMessage(
                `Could not offer Undo for the deleted conversation: ${error instanceof Error ? error.message : String(error)}`,
              );
            });
          }
        }
        return;
      }
      switch (message.type) {
        case 'ready': // Compatibility request from an older webview bundle.
        case 'agent:bootstrap/request': {
          if (message.type === 'ready') this._legacySidebarViewGeneration = viewGeneration;
          const delivered = await this._sendAgentBootstrap(
            webviewView.webview,
            viewGeneration,
            message.type === 'ready' ? 'agent:config' : 'agent:bootstrap',
          );
          if (!delivered || !this._isCurrentSidebarView(webviewView.webview, viewGeneration)) break;
          this._sendChatFontSize();
          this._sendActiveFile();
          void this._sendActiveBrowserContext();
          this._sendConnectivityStatus();

          // Duplicate ready/bootstrap requests are idempotent. Runtime and
          // credential probes start only after the atomic local bootstrap has
          // been accepted for this concrete webview generation.
          if (this._hydratedViewGeneration !== viewGeneration) {
            this._hydratedViewGeneration = viewGeneration;
            setTimeout(() => {
              if (!this._isCurrentSidebarView(webviewView.webview, viewGeneration)) return;
              const claudeStatus = this._sendClaudeSidebarStatus();
              const codexStatus = this._sendCodexSidebarStatus();
              void this._sendAcpProviders();
              void this._sendAgentDiscovery();
              void this._sendApiKeyStatus();
              // Reuse the two runtime results for onboarding. Starting a second
              // Claude/Codex probe here doubles CLI work and reintroduces races.
              void Promise.all([claudeStatus, codexStatus]).then(([setupStatus, resolvedCodexStatus]) => {
                if (!setupStatus || !resolvedCodexStatus) return;
                void this._sendOnboardingStatus({ setupStatus, codexStatus: resolvedCodexStatus });
              });
            }, 0);
          }
          break;
        }

        case 'openExternal': {
          // The shared webview bridge already uses this message for editor
          // links. The AI sidebar has its own host, so it must handle the same
          // message explicitly rather than silently dropping policy/provider
          // link clicks. Keep this surface restricted to web URLs.
          const rawUrl = typeof message.url === 'string' ? message.url.trim() : '';
          if (!rawUrl) break;
          try {
            const target = vscode.Uri.parse(rawUrl, true);
            if (target.scheme === 'http' || target.scheme === 'https') {
              const opened = await vscode.env.openExternal(target);
              if (!opened) {
                void vscode.window.showWarningMessage(`Could not open ${target.authority} in your browser.`);
              }
            }
          } catch {
            // Ignore malformed or unsupported external targets.
          }
          break;
        }

        case 'open-source': // legacy name from inline-code path clicks (was silently dropped)
        case 'chat:open-file': {
          // Chat links/paths to workspace files open in Ritemark's own
          // editors. Confined to the workspace folder — chat content is
          // model-authored, so it never gets to open arbitrary disk paths.
          const rawPath = typeof message.filePath === 'string' ? message.filePath.trim() : '';
          if (rawPath) await this._openWorkspaceFile(rawPath);
          break;
        }

        case 'ai-configure-key':
          vscode.commands.executeCommand('ritemark.configureApiKey');
          break;

        case 'ai-cancel':
          this._disposeAllRuntimeSessions();
          break;

        case 'execute-widget':
          this._executeToolInEditor(
            message.toolName,
            message.args as Record<string, unknown>,
            message.selection as EditorSelection
          );
          break;

        case 'ai-select-agent':
          if (typeof message.conversationId === 'string') {
            this._selectedConversationId = message.conversationId;
            this._runtimeSessionLastUsed.set(message.conversationId, Date.now());
          }
          // Persist agent selection to settings
          await vscode.workspace.getConfiguration('ritemark.ai').update(
            'selectedAgent',
            message.agentId,
            vscode.ConfigurationTarget.Global
          );
          // The selected label is local bootstrap state. Runtime readiness is
          // hydrated independently and cannot delay model selection.
          await this._sendCurrentAgentBootstrap();
          void this._sendRuntimeStatus(message.agentId as AgentId);
          break;

        case 'conversation:selected':
          if (typeof message.conversationId === 'string') {
            this._selectedConversationId = message.conversationId;
            this._runtimeSessionLastUsed.set(message.conversationId, Date.now());
          }
          break;

        case 'ai-select-model':
          await vscode.workspace.getConfiguration('ritemark.ai').update(
            'selectedModel',
            modelCatalog.getModel('anthropic', message.modelId)?.id
              ?? modelCatalog.getDefault('anthropic', 'claude-code'),
            vscode.ConfigurationTarget.Global,
          );
          this._runtimeRegistry.get('claude-code')?.dispose();
          break;

        case 'pin-agent-request':
          this.pinAgent(message.agentId, message.filePath);
          break;

        case 'agent-execute': {
          const { agentId, model, attachments } = message;
          // Sprint 99: every conversation-scoped message carries its conversation.
          // A missing id means a webview path that has not been migrated yet.
          const clientConversationId: string = message.conversationId ?? DEFAULT_CONVERSATION_ID;
          const requestedModelInput = typeof model === 'string' && model
            ? model
            : agentId === 'claude-code'
              ? this._reconciledClaudeModel()
              : undefined;
          const requestedClaudeModel = agentId === 'claude-code'
            ? modelCatalog.getModel('anthropic', requestedModelInput)
            : undefined;
          const requestedModel = requestedClaudeModel?.id ?? requestedModelInput;
          const effortCapability = this._thinkingEffortCapability(
            clientConversationId,
            agentId as AgentId,
            requestedModel,
          );
          const requestedThinkingEffort: ThinkingEffort = isThinkingEffort(message.thinkingEffort)
            ? message.thinkingEffort
            : 'auto';
          const thinkingEffort = isEnabled('composer-thinking-effort')
            ? validateThinkingEffort(requestedThinkingEffort, effortCapability)
            : 'auto';
          if (thinkingEffort !== requestedThinkingEffort) {
            void this._view?.webview.postMessage({
              type: 'thinking-effort/status',
              conversationId: clientConversationId,
              runtimeId: agentId,
              requested: requestedThinkingEffort,
              applied: thinkingEffort,
              message: `${thinkingEffortLabel(requestedThinkingEffort)} isn’t available for this model. Using Auto.`,
            });
          }
          let acceptedConversation: import('../conversations/types').ConversationRecordV1 | null = null;
          let hostConversationEnabled = false;
          try {
            hostConversationEnabled = await this._conversationController.currentRolloutMode() !== 'legacy';
            if (hostConversationEnabled) {
              if (message.conversationContinuation === true) {
                const current = await this._conversationController.runtimeConversation(clientConversationId);
                const continuedTurnId = typeof message.conversationTurnId === 'string'
                  ? message.conversationTurnId
                  : current.lifecycle.state === 'working' || current.lifecycle.state === 'needs-user'
                    ? current.lifecycle.activeTurnId
                    : undefined;
                acceptedConversation = continuedTurnId
                  ? await this._conversationController.activateRuntimeContinuation({
                      conversationId: current.conversationId,
                      bindingGeneration: current.bindingGeneration,
                      runtimeId: agentId as AgentId,
                      turnId: continuedTurnId,
                    })
                  : current;
              } else {
                acceptedConversation = await this._conversationController.acceptRuntimeTurn({
                    conversationId: clientConversationId,
                    turnId: typeof message.conversationTurnId === 'string' && message.conversationTurnId.length <= 128
                      ? message.conversationTurnId
                      : undefined,
                    agentId: agentId as AgentId,
                    text: typeof message.displayPrompt === 'string'
                      ? message.displayPrompt
                      : typeof message.prompt === 'string' ? message.prompt : '',
                    mode: message.approvalMode === 'ask' ? 'ask' : message.planFirst === true ? 'plan' : 'auto',
                    thinkingEffort,
                    attachments: Array.isArray(attachments)
                      ? attachments.map((attachment: { name?: string; kind?: string; mediaType?: string; data?: string }) => ({
                          name: attachment.name ?? 'Attachment',
                          kind: attachment.kind ?? 'file',
                          mediaType: attachment.mediaType ?? null,
                          sizeBytes: typeof attachment.data === 'string' ? Buffer.byteLength(attachment.data) : null,
                        }))
                      : [],
                  });
              }
            }
          } catch (error) {
            this._view?.webview.postMessage({
              type: 'conversation/store-status',
              state: 'degraded',
              message: `Could not save your message. Nothing was sent to the agent. ${error instanceof Error ? error.message : String(error)}`,
            });
            break;
          }
          const conversationId = acceptedConversation?.conversationId ?? clientConversationId;
          const bindingGeneration = acceptedConversation?.bindingGeneration ?? 0;
          const conversationTurnId = typeof message.conversationTurnId === 'string' && message.conversationTurnId.length <= 128
            ? message.conversationTurnId
            : acceptedConversation && (acceptedConversation.lifecycle.state === 'working' || acceptedConversation.lifecycle.state === 'needs-user')
              ? acceptedConversation.lifecycle.activeTurnId
              : undefined;
          const runtimeTurnToken = Symbol(`${agentId}:${conversationTurnId ?? 'legacy'}`);
          this._activeRuntimeTurnTokens.set(conversationId, runtimeTurnToken);
          const isCurrentRuntimeTurn = () => this._activeRuntimeTurnTokens.get(conversationId) === runtimeTurnToken;
          this._disposeOtherRuntimeSessions(conversationId, agentId as AgentId);
          if (acceptedConversation && conversationId !== clientConversationId) {
            this._view?.webview.postMessage({
              type: 'conversation/canonical-id',
              clientConversationId,
              conversationId,
              bindingGeneration,
            });
          }
          let terminalCheckpointWritten = false;
          let streamedResponseText = '';
          let appliedThinkingEffort: ExplicitThinkingEffort | null = null;
          const skipActiveFile = message.skipActiveFile === true;
          const skipBrowserContext = message.skipBrowserContext === true;
          const mentionedAgentPaths: string[] | undefined = message.mentionedAgentPaths;
          // Sprint 103 R1: two independent axes — autonomy ('auto'|'ask') and
          // plan-first. Legacy webview payloads that still say 'plan' normalize
          // to auto + planFirst.
          const approvalMode: 'auto' | 'ask' = message.approvalMode === 'ask' ? 'ask' : 'auto';
          const runtime = this._runtimeRegistry.get(agentId as import('../agent/types').AgentId);
          const isClaudeCode = agentId === 'claude-code';
          const isCodex = agentId === 'codex';
          // R6: plan-first is honored only for runtimes whose capability map
          // declares it (OpenCode never receives planFirst).
          const planFirst = (message.planFirst === true || message.approvalMode === 'plan')
            && capabilitiesFor(agentId as import('../agent/types').AgentId).planFirst;
          const codexTurnMode: 'plan' | 'execute' = planFirst ? 'plan' : 'execute';
          const browserEnabled = isEnabled('browser-agent-control');

          // ── Per-turn context injection (parity with the pre-Sprint-79 handlers;
          //    Sprint 79 unifies the plumbing, NOT the behavior — see architecture.md) ──
          let prompt: string = message.prompt;
          let turnAttachments = attachments;

          // @mentioned agent definitions prepended as hidden context (Claude Code).
          if (isClaudeCode && Array.isArray(mentionedAgentPaths) && mentionedAgentPaths.length > 0) {
            const fs = require('fs') as typeof import('fs');
            const sections = mentionedAgentPaths
              .map((p) => { try { return fs.readFileSync(p, 'utf-8'); } catch { return null; } })
              .filter((s): s is string => Boolean(s));
            if (sections.length > 0) {
              prompt = `[Agent instructions — respond as this agent for this conversation]\n\n${sections.join('\n\n---\n\n')}\n\n---\n\n${prompt}`;
            }
          }

          // Browser context (page summary + screenshot). Consent-gated inside
          // buildTurnContext() — returns null unless the user shared a tab. Only
          // Claude Code + Codex received this pre-Sprint-79 (ACP did not).
          if (browserEnabled && !skipBrowserContext && (isClaudeCode || isCodex)) {
            const browserContext = await BrowserContextStore.instance.buildTurnContext({ includeScreenshot: true });
            if (browserContext) {
              prompt = `${browserContext.promptBlock}\n\n---\n\n${prompt}`;
              if (browserContext.claudeAttachments.length > 0) {
                turnAttachments = [...(turnAttachments ?? []), ...browserContext.claudeAttachments];
              }
            }
          }

          // Active file context — works for TextEditor and custom (Ritemark) editors.
          const activeFile = skipActiveFile ? undefined : this._getActiveFileContext();

          // Browser MCP server for Claude Code (in-process server)
          let mcpServers: Record<string, unknown> | undefined;
          if (isClaudeCode && browserEnabled) {
            const server = await createBrowserMcpServer();
            mcpServers = { [BROWSER_MCP_SERVER_NAME]: server };
          }

          const byokKeys = await this._readByokKeys();

          // ── Per-runtime settings (dropped during the migration — restored) ──
          const aiConfig = vscode.workspace.getConfiguration('ritemark.ai');
          const agentTimeout = aiConfig.get<number>('agentTimeout', 15);
          let excludedFolders: string[] | undefined;
          let anthropicApiKey: string | undefined;
          if (isClaudeCode) {
            excludedFolders = aiConfig.get<string[]>('excludedFolders');
            const claudeStatus = await getSetupStatus();
            // API-key auth reuses the same secret the BYOK Settings card writes.
            if (claudeStatus.authMethod === 'api-key') {
              anthropicApiKey = byokKeys.anthropic;
            }
          }
          // Codex approval is sandbox-gated: 'workspace-write' pre-approves in-workspace
          // edits regardless of policy. So Ask must use a read-only sandbox + 'untrusted'
          // to force an approval before each write/command. Auto/Plan run freely
          // (Plan gates via plan-mode approval).
          const codexConfig = vscode.workspace.getConfiguration('ritemark.codex');
          let codexApprovalPolicy: string | undefined;
          let codexSandboxMode: string | undefined;
          if (isCodex) {
            if (approvalMode === 'ask') {
              codexApprovalPolicy = 'untrusted';
              codexSandboxMode = 'read-only';
            } else {
              codexApprovalPolicy = 'never';
              codexSandboxMode = codexConfig.get<string>('sandboxMode', 'workspace-write');
            }
          }

          // Model drift fix (2026-08-05): a Claude session must NEVER start
          // without an explicit model — an absent model hands the choice to
          // the bundled CLI, which reads the USER'S personal ~/.claude.json /
          // settings and can silently run a different model than the UI shows.
          const pinnedModel = isClaudeCode
            ? requestedModel
            : model;
          const titleGeneration = ({ userPrompt, assistantResponse }: { userPrompt: string; assistantResponse: string }) =>
            this._conversationTitleGenerator.generate({
              runtimeId: agentId as AgentId,
              workspacePath: this._workspacePath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
              ...(typeof pinnedModel === 'string' && pinnedModel ? { model: pinnedModel } : {}),
              ...(anthropicApiKey ? { anthropicApiKey } : {}),
              byokEnv: buildByokEnv(byokKeys),
              userPrompt,
              assistantResponse,
            });

          let continuation: RuntimeContinuationRequest | undefined;
          let runtimeUnavailable = false;
          if (hostConversationEnabled && acceptedConversation && runtime) {
            const runtimeStatus = await runtime.getStatus();
            runtimeUnavailable = !runtimeStatus.ready;
            let runtimeVersion = runtimeStatus.version ?? 'unknown';
            let authBinding = `${agentId}:provider-managed`;
            if (agentId === 'claude-code') {
              authBinding = anthropicApiKey || 'claude-oauth';
            } else if (agentId === 'codex' && runtime instanceof CodexRuntime) {
              const codexStatus = await runtime.getCodexSidebarStatus();
              runtimeVersion = codexStatus.version ?? runtimeVersion;
              authBinding = JSON.stringify([codexStatus.authMethod, codexStatus.email]);
            } else if (agentId === 'opencode') {
              // HMAC input only: raw BYOK values are never persisted or logged.
              authBinding = JSON.stringify([
                byokKeys.google ?? null,
                byokKeys.openai ?? null,
                byokKeys.anthropic ?? null,
                byokKeys.openrouter ?? null,
              ]);
            }
            const modelId = typeof pinnedModel === 'string' && pinnedModel ? pinnedModel : null;
            const compatibility = {
              runtimeId: agentId as AgentId,
              scopeId: acceptedConversation.scopeId,
              runtimeVersion,
              adapterContractVersion: RUNTIME_CONTINUATION_ADAPTER_CONTRACT_VERSION,
              modelId,
              compatibilityFingerprint: createRuntimeCompatibilityFingerprint(
                await this._continuationHostSecret(),
                {
                  runtimeId: agentId as AgentId,
                  scopeId: acceptedConversation.scopeId,
                  runtimeVersion,
                  modelId,
                  approvalMode,
                  planFirst,
                  sandboxMode: codexSandboxMode ?? null,
                  approvalPolicy: codexApprovalPolicy ?? null,
                  authBinding,
                },
              ),
            };
            const currentUserEvent = message.conversationContinuation === true
              ? undefined
              : [...acceptedConversation.events].reverse().find(
                  (event) => event.kind === 'user-message' && event.turnId === conversationTurnId,
                );
            const descriptor = acceptedConversation.continuations?.[agentId as AgentId];
            const fallbackContext = buildNormalizedContextPack(acceptedConversation, {
              beforeEventId: currentUserEvent?.eventId,
            }) ?? undefined;
            const nativeDelta = descriptor
              ? buildNormalizedContextPack(acceptedConversation, {
                  afterEventId: descriptor.coveredThroughEventId,
                  beforeEventId: currentUserEvent?.eventId,
                }) ?? undefined
              : undefined;
            continuation = {
              compatibility,
              ...(descriptor ? { descriptor } : {}),
              ...(nativeDelta ? { nativeDelta } : {}),
              ...(fallbackContext ? { fallbackContext } : {}),
            };
          }

          const sessionConfig: RuntimeSessionConfig = {
            workspacePath: this._workspacePath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
            model: pinnedModel,
            expectedResolvedModel: isClaudeCode ? requestedClaudeModel?.resolvedModel : undefined,
            byokEnv: buildByokEnv(byokKeys),
            excludedFolders,
            anthropicApiKey,
            approvalMode,
            planFirst,
            codexApprovalPolicy,
            codexSandboxMode,
            continuation,
            onContinuationCheckpoint: hostConversationEnabled
              ? (descriptor) => {
                  if (!isCurrentRuntimeTurn()) return;
                  this._runConversationCheckpoint(conversationId,
                    () => this._conversationController.checkpointRuntimeContinuation({
                    conversationId,
                    bindingGeneration,
                    runtimeId: agentId as AgentId,
                    descriptor,
                  }),
                  );
                }
              : undefined,
            onContinuationState: (state) => {
              if (!isCurrentRuntimeTurn()) return;
              if (hostConversationEnabled && conversationTurnId && state.mode === 'transcript-restored') {
                this._runConversationCheckpoint(conversationId, () => this._conversationController.recordTranscriptRestored({
                  conversationId,
                  bindingGeneration,
                  runtimeId: agentId as AgentId,
                  turnId: conversationTurnId,
                  truncated: state.truncated === true,
                  unansweredPriorRequest: state.unansweredPriorRequest === true,
                }));
              }
              void this._view?.webview.postMessage({
                type: 'conversation/continuation-state',
                conversationId,
                turnId: conversationTurnId,
                runtimeId: agentId,
                state,
              });
            },
            onDispatchAccepted: hostConversationEnabled && conversationTurnId
              ? () => {
                  if (!isCurrentRuntimeTurn()) return;
                  this._runConversationCheckpoint(conversationId,
                    () => this._conversationController.markRuntimeDispatch({
                    conversationId,
                    bindingGeneration,
                    runtimeId: agentId as AgentId,
                    turnId: conversationTurnId,
                    state: 'accepted',
                  }),
                  );
                }
              : undefined,
            onThinkingEffortCapability: (capability) => {
              if (!isCurrentRuntimeTurn()) return;
              const existing = this._liveThinkingEffortCapabilities.get(conversationId) ?? {};
              this._liveThinkingEffortCapabilities.set(conversationId, { ...existing, [agentId as AgentId]: capability });
              void this._view?.webview.postMessage({
                type: 'thinking-effort/capability',
                conversationId,
                runtimeId: agentId,
                capability,
              });
            },
            onThinkingEffortApplied: (result) => {
              if (!isCurrentRuntimeTurn()) return;
              appliedThinkingEffort = result.applied ?? null;
              void this._view?.webview.postMessage({
                type: 'thinking-effort/status',
                conversationId,
                runtimeId: agentId,
                requested: result.requested,
                applied: result.applied ?? null,
                message: result.adjusted
                  ? result.applied
                    ? `Effort adjusted to ${thinkingEffortLabel(result.applied)} for this model.`
                    : 'Requested effort is unavailable. Using Auto for this turn.'
                  : undefined,
              });
            },
            // Unified capability context (Sprint 101 #154): ONE source
            // (src/ai/capabilityContext.ts), delivered through each runtime's own
            // mechanism — Claude appends it, Codex uses it as base instructions,
            // ACP injects it once per session. The old append/replace asymmetry
            // (browser hint reached Claude only) is gone; every runtime now gets
            // materially the same capability awareness, and the browser guidance
            // is included whenever the integrated browser is actually available.
            extraSystemPrompt: renderCapabilityContext(
              (isClaudeCode
                ? { ...CLAUDE_DESCRIPTOR, hasBrowserTools: browserEnabled }
                : isCodex
                  ? { ...CODEX_DESCRIPTOR, hasBrowserTools: browserEnabled }
                  : ACP_DESCRIPTOR) as CapabilityDescriptor
            ),
            mcpServers,
            allowedTools: isClaudeCode && browserEnabled
              ? [...DEFAULT_TOOLS, ...BROWSER_TOOL_ALLOW_NAMES]
              : undefined,
            onProgress: (progress) => {
              if (!isCurrentRuntimeTurn()) return;
              if (isClaudeCode) {
                this._view?.webview.postMessage({ type: 'agent-progress', conversationId, agentId, progress });
              } else {
                if (progress.type === 'text') {
                  streamedResponseText += progress.message;
                  this._view?.webview.postMessage({ type: 'codex-streaming', conversationId, delta: progress.message });
                } else {
                  this._view?.webview.postMessage({ type: 'codex-progress', conversationId, progress });
                }
              }
            },
            onApprovalRequest: (req) => {
              if (!isCurrentRuntimeTurn()) return;
              this._runConversationCheckpoint(conversationId, () => this._conversationController.attentionRuntimeTurn({
                conversationId,
                bindingGeneration,
                runtimeId: agentId as AgentId,
                attentionKind: 'approval',
                prompt: req.kind === 'shell-command' ? (req.command ?? 'Command approval') : (req.filePath ?? 'Approval required'),
              }), hostConversationEnabled);
              return this._approvalGate.request({ ...req, conversationId });
            },
            onComplete: (result) => {
              if (!isCurrentRuntimeTurn()) return;
              const errorPresentation = presentRuntimeError(agentId as AgentId, result.error, result.failureKind);
              const error = errorPresentation?.message;
              const failureKind = result.failureKind ?? errorPresentation?.failureKind;
              this._view?.webview.postMessage({
                type: 'agent-result', conversationId,
                agentId,
                text: result.text ?? '',
                filesModified: result.filesModified ?? [],
                metrics: result.metrics ?? { durationMs: 0, costUsd: null, model: null },
                error,
                failureKind,
              });
              this._refreshExplorerForAgentWrites(result.filesModified);
              if (!terminalCheckpointWritten) {
                terminalCheckpointWritten = true;
                this._runConversationCheckpoint(conversationId, () => this._conversationController.completeRuntimeTurn({
                  conversationId,
                  bindingGeneration,
                  runtimeId: agentId as AgentId,
                  turnId: conversationTurnId,
                  text: result.text ?? '',
                  status: error ? 'failed' : 'completed',
                  error,
                  failureKind,
                  appliedThinkingEffort,
                  generateTitle: titleGeneration,
                }), hostConversationEnabled);
              }
              if (failureKind === 'authentication' || failureKind === 'api-key-authentication') {
                // Claude authentication is app-global. OAuth siblings may hold
                // the same stale token family, while API-key siblings retain
                // the same rejected credential. Neither may survive recovery.
                this._disposeRuntimeSessionsForAgent('claude-code');
                clearSetupCache();
                emitClaudeStatusInvalidated('authentication-failed');
              } else if (error) {
                this._disposeRuntimeSession(conversationId, agentId as AgentId);
              }
            },
            onQuestion: (question) => {
              if (!isCurrentRuntimeTurn()) return;
              this._runConversationCheckpoint(conversationId, () => this._conversationController.attentionRuntimeTurn({
                conversationId,
                bindingGeneration,
                runtimeId: agentId as AgentId,
                attentionKind: 'question',
                prompt: question.questions.map((item) => item.question).join('\n'),
              }), hostConversationEnabled);
              this._view?.webview.postMessage({ type: 'agent-question', conversationId, agentId, question });
            },
            onCodexComplete: (result) => {
              if (!isCurrentRuntimeTurn()) return;
              this._view?.webview.postMessage({
                type: 'codex-result', conversationId,
                agentId,
                status: result.status,
                error: result.error,
              });
              this._refreshExplorerForAgentWrites(undefined);
              if (!terminalCheckpointWritten) {
                terminalCheckpointWritten = true;
                const runtimeCompleted = !result.error && !/error|failed|cancelled/i.test(result.status);
                this._runConversationCheckpoint(conversationId, () => this._conversationController.completeRuntimeTurn({
                  conversationId,
                  bindingGeneration,
                  runtimeId: agentId as AgentId,
                  turnId: conversationTurnId,
                  text: streamedResponseText,
                  status: runtimeCompleted ? 'completed' : 'failed',
                  error: result.error,
                  appliedThinkingEffort,
                  generateTitle: titleGeneration,
                }), hostConversationEnabled);
                if (!runtimeCompleted) this._disposeRuntimeSession(conversationId, agentId as AgentId);
              }
            },
            onExit: () => {
              if (!isCurrentRuntimeTurn()) return;
              // Codex app-server died mid-turn — finalize the turn so the webview
              // isn't stuck on "running" forever.
              this._view?.webview.postMessage({
                type: 'codex-result', conversationId,
                agentId,
                status: 'error',
                error: 'Codex exited unexpectedly. Please try again.',
              });
              if (!terminalCheckpointWritten) {
                terminalCheckpointWritten = true;
                this._runConversationCheckpoint(conversationId, () => this._conversationController.completeRuntimeTurn({
                  conversationId,
                  bindingGeneration,
                  runtimeId: agentId as AgentId,
                  turnId: conversationTurnId,
                  text: '',
                  status: 'failed',
                  error: 'Runtime exited unexpectedly.',
                }), hostConversationEnabled);
              }
              this._disposeRuntimeSession(conversationId, agentId as AgentId);
            },
            onCodexPlanDelta: (delta) => {
              if (!isCurrentRuntimeTurn()) return;
              this._view?.webview.postMessage({ type: 'codex-plan-text-delta', conversationId, delta });
            },
            onCodexPlanUpdate: (explanation, plan) => {
              if (!isCurrentRuntimeTurn()) return;
              this._runConversationCheckpoint(conversationId, () => this._conversationController.attentionRuntimeTurn({
                conversationId,
                bindingGeneration,
                runtimeId: agentId as AgentId,
                attentionKind: 'plan-review',
                prompt: explanation ?? plan.map((step) => step.step).join('\n'),
              }), hostConversationEnabled);
              this._view?.webview.postMessage({ type: 'codex-plan-update', conversationId, explanation, plan });
            },
            onCodexQuestion: (requestId, questions) => {
              if (!isCurrentRuntimeTurn()) return;
              this._runConversationCheckpoint(conversationId, () => this._conversationController.attentionRuntimeTurn({
                conversationId,
                bindingGeneration,
                runtimeId: agentId as AgentId,
                attentionKind: 'question',
                prompt: questions.map((item) => item.question).join('\n'),
              }), hostConversationEnabled);
              this._view?.webview.postMessage({ type: 'codex-question', conversationId, requestId, questions });
            },
            onRpcProgress: (_method, msg) => {
              if (!isCurrentRuntimeTurn()) return;
              this._view?.webview.postMessage({ type: 'codex-rpc-progress', conversationId, method: _method, message: msg });
            },
            // Codex dynamic browser tools (dispatched in extension host, results sent back to Codex)
            onBrowserToolCall: (agentId === 'codex' && browserEnabled)
              ? async (toolName, args, _requestId) => {
                if (!isCurrentRuntimeTurn()) {
                  return { text: 'This agent handoff is no longer active.', success: false };
                }
                if (isCodexBrowserToolCall(toolName)) {
                  return dispatchCodexBrowserToolCall(toolName, args);
                }
                return { text: `Unknown browser tool: ${toolName}`, success: false };
              }
              : undefined,
          };
          if (runtimeUnavailable) {
            sessionConfig.onContinuationState?.({
              mode: 'runtime-unavailable',
              failureCategory: 'runtime-unavailable',
            });
          }
          try {
            const session = await this._openRuntimeSession(conversationId, agentId as AgentId, runtime, sessionConfig);
            if (isCurrentRuntimeTurn() && hostConversationEnabled && conversationTurnId) {
              await this._queueConversationCheckpoint(conversationId, () => (
                this._conversationController.markRuntimeDispatch({
                  conversationId,
                  bindingGeneration,
                  runtimeId: agentId as AgentId,
                  turnId: conversationTurnId,
                  state: 'ambiguous',
                })
              ));
            }
            if (isCurrentRuntimeTurn()) {
              await session.prompt({
                prompt,
                attachments: turnAttachments,
                activeFile,
                mode: codexTurnMode,
                model,
                timeoutMinutes: agentTimeout,
                thinkingEffort,
                thinkingEffortDefault: effortCapability.defaultLevel,
              });
            }
          } catch (err) {
            // Unhandled runtime error — surface it to the webview so the turn finishes
            const errMsg = err instanceof Error ? err.message : String(err);
            if (isClaudeCode) {
              sessionConfig.onComplete?.({ text: '', filesModified: [], metrics: { durationMs: 0, costUsd: null, model: null }, error: errMsg });
            } else {
              sessionConfig.onCodexComplete?.({ status: 'error', error: errMsg });
            }
          }
          break;
        }

        case 'comment:task-status': {
          // Sprint 105 (#165): the sidebar's queue/turn facts flow back to the
          // editor webviews so margin markers can show honest task status.
          const { RitemarkEditorProvider } = require('../ritemarkEditor') as typeof import('../ritemarkEditor');
          RitemarkEditorProvider.broadcastCommentTaskStatus({
            documentPath: String(message.documentPath ?? ''),
            commentIds: Array.isArray(message.commentIds) ? message.commentIds : [],
            status: message.status,
          });
          break;
        }

        case 'agent-cancel': {
          // Cancels ONLY the named conversation; sibling conversations keep running.
          const session = this._findRuntimeSession(message.conversationId, message.agentId as AgentId);
          await session?.cancel();
          break;
        }

        case 'agent-answer-question': {
          traceClaude('webview->extension', 'agent-answer-question', { toolUseId: message.toolUseId });
          const session = this._findRuntimeSession(message.conversationId, 'claude-code');
          (session as import('../agent/ClaudeCodeRuntime').ClaudeCodeSession | undefined)
            ?.answerQuestion(message.toolUseId, message.answers || {});
          break;
        }

        case 'agent-approve': {
          const { requestId, approved, alwaysAllow, agentId: approveAgentId } = message;
          this._approvalGate.respond(requestId, approved === true, alwaysAllow === true);
          if (approveAgentId) {
            const session = this._findRuntimeSession(message.conversationId, approveAgentId as AgentId);
            // Sprint 103 R2: optional feedback rides plan rejections ("Keep planning").
            session?.respondToApproval(
              requestId,
              approved === true,
              alwaysAllow === true,
              typeof message.feedback === 'string' ? message.feedback : undefined,
            );
          }
          break;
        }

        case 'agent-setup:install':
          this._handleClaudeInstall();
          break;

        case 'agent-setup:login':
          this._handleClaudeLogin();
          break;

        case 'agent-setup:apikey':
          openAnthropicKeySettings();
          break;

        case 'agent-setup:open-git-download':
          await vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/download/win'));
          break;

        case 'agent-setup:open-node-download':
          await vscode.env.openExternal(vscode.Uri.parse('https://nodejs.org/en/download'));
          break;

        case 'agent-setup:check':
          clearSetupCache();
          // The invalidation listener is the single refresh owner. Calling the
          // probe here as well would create two revisions and duplicate CLI /
          // keychain work for one user action.
          emitClaudeStatusInvalidated('status-refresh');
          break;

        case 'agent:status/recheck':
          if (message.runtimeId === 'claude-code' || message.runtimeId === 'codex' || message.runtimeId === 'opencode') {
            void this._sendRuntimeStatus(message.runtimeId);
          }
          break;

        // ── Onboarding wizard messages ──

        case 'onboarding:install-git':
          installGit(checkWingetAvailable());
          break;

        case 'onboarding:install-node':
          installNode(checkWingetAvailable());
          break;

        case 'onboarding:install-claude':
          this._handleOnboardingClaudeInstall();
          break;

        case 'onboarding:install-codex':
          installCodexCli();
          break;

        case 'onboarding:recheck': {
          clearSetupCache();
          // The invalidation handler performs one Claude probe and reuses that
          // result when rebuilding onboarding status.
          emitClaudeStatusInvalidated('status-refresh');
          break;
        }

        case 'agent-setup:dismiss-welcome':
          vscode.workspace.getConfiguration('ritemark.ai').update('hasSeenClaudeWelcome', true, vscode.ConfigurationTarget.Global);
          break;

        case 'connectivity:recheck':
          await forceConnectivityCheck();
          this._sendConnectivityStatus();
          break;

        // Codex messages
        case 'codex:login':
          await this._handleCodexLogin();
          break;

        case 'codex:logout':
          await this._handleCodexLogout();
          break;

        case 'codex:refreshStatus':
          // The invalidation listener owns the refresh and latest-wins revision.
          emitCodexStatusInvalidated('status-refresh');
          break;

        case 'codex:repair':
          emitCodexStatusInvalidated('repair-started');
          await this._openCodexRepairTerminal();
          break;

        case 'codex:reloadWindow':
          await vscode.commands.executeCommand('workbench.action.reloadWindow');
          break;

        case 'codex:openSettings':
          await vscode.commands.executeCommand('ritemark.aiSettings');
          break;

        case 'codex-answer-question': {
          traceCodex('webview->extension', 'codex-answer-question', { requestId: message.requestId });
          const session = this._findRuntimeSession(message.conversationId, 'codex');
          (session as import('../codex/CodexRuntime').CodexSession | undefined)
            ?.answerQuestion(message.requestId, message.answers || {});
          break;
        }

        case 'conversation:reset':
          traceCodex('webview->extension', 'conversation:reset', { conversationId: message.conversationId });
          // Scoped to the named conversation. The webview sends this only when a
          // conversation is genuinely thrown away (clear / close / delete), never
          // on a switch — see webview store `resetProviderSession`.
          this._disposeRuntimeSessions(message.conversationId ?? DEFAULT_CONVERSATION_ID);
          break;

        // Sprint 76 R3a: return provider-configured booleans (never key values)
        // for the webview model-picker filter + setup prompt.
        case 'acp-get-providers':
          await this._sendAcpProviders();
          break;
      }
    });

    // Listen for API key changes
    apiKeyChanged.event(({ hasKey }) => {
      this._view?.webview.postMessage({ type: 'ai-key-status', hasKey });
    });

    // Listen for connectivity changes
    connectivityChanged.event(({ isOnline: online }) => {
      this._view?.webview.postMessage({ type: 'connectivity-status', isOnline: online });
    });

    // Listen for chat font size changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ritemark.chat.fontSize')) {
        this._sendChatFontSize();
      }
    });

    // Track active tab changes to update context chip in webview
    vscode.window.tabGroups.onDidChangeTabs(() => {
      this._sendActiveFile();
      void this._sendActiveBrowserContext();
    });

    // Browser annotation mode is toggled by a workbench BrowserView action, not
    // by the extension webview. Poll lightweight metadata while the AI sidebar
    // is visible so the composer chip reflects browser/menu changes without
    // requiring a tab switch. Polling stops when the sidebar hides or disposes.
    webviewView.onDidChangeVisibility(() => {
      this._refreshBrowserContextPolling();
    });
    webviewView.onDidDispose(() => {
      if (this._browserContextPoll) {
        clearInterval(this._browserContextPoll);
        this._browserContextPoll = null;
      }
      if (this._isCurrentSidebarView(webviewView.webview, viewGeneration)) {
        this._view = undefined;
        this._hydratedViewGeneration = 0;
        this._legacySidebarViewGeneration = 0;
      }
    });
    this._refreshBrowserContextPolling();
  }

  /**
   * Send current selection and document content from active editor.
   *
   * The editor webview supplies contextBefore/contextAfter (~80 chars
   * each side) on the selection itself; we pass them straight through.
   * The AI sidebar uses them to build an unambiguous fingerprint of the
   * selection's location for apply_patch, which is more robust than
   * line numbers (TipTap's from/to are ProseMirror positions that don't
   * map cleanly to source offsets — Jarmo, 2026-05-07: line numbers
   * pointed Codex to the wrong "runtime" occurrence in frontmatter).
   */
  public sendSelection(selection: EditorSelection, documentContent: string) {
    this._currentSelection = selection;
    this._documentContent = documentContent;
    const activeFile = this._getActiveFileContext();
    this._view?.webview.postMessage({
      type: 'selection-update',
      selection,
      activeFilePath: activeFile?.path,
    });
  }

  public show() {
    if (this._view) {
      this._view.show(true);
    }
  }

  /**
   * Sprint 94 (#81): a comment assigned to an AI agent was sent from the editor.
   * Reveal the sidebar and hand the prompt to the store, which routes it to the
   * mentioned runtime and submits (→ the normal agent-execute path). If the view
   * isn't resolved yet, focus the container first so `_view` gets populated.
   */
  public submitCommentPrompt(
    agentId: string,
    prompt: string,
    meta?: { commentIds?: string[]; documentPath?: string },
  ) {
    const dispatch = () =>
      this._view?.webview.postMessage({
        type: 'comment:submit', agentId, prompt,
        commentIds: meta?.commentIds, documentPath: meta?.documentPath,
      });
    if (this._view) {
      this.show();
      dispatch();
    } else {
      // Not resolved yet — reveal the view, then dispatch once it's ready.
      vscode.commands.executeCommand('ritemark.unifiedView.focus');
      setTimeout(dispatch, 400);
    }
  }

  /**
   * Clear chat history and start a fresh conversation.
   *
   * The webview owns which conversation is being cleared, so it answers the
   * `clear-chat` message with a scoped `conversation:reset`. This used to dispose
   * EVERY runtime for EVERY conversation, which since Sprint 99 left other
   * conversations showing a transcript whose agent had silently forgotten it.
   */
  public clearChat() {
    this._view?.webview.postMessage({ type: 'clear-chat' });
  }

  /**
   * Pin a discovered agent in the chat composer — used by Launch Chat in the Agent Library.
   * Reads the agent's .md file so the webview can include it as context on the first message.
   */
  public pinAgent(agentId: string, filePath: string) {
    let content: string | undefined;
    try {
      content = require('fs').readFileSync(filePath, 'utf-8');
    } catch {
      // File unreadable — fall back to id-only reminder
    }
    this._view?.webview.postMessage({ type: 'pin-agent', agentId, content });
  }

  /**
   * Toggle the chat history panel in the webview
   */
  public toggleHistoryPanel() {
    this._view?.webview.postMessage({ type: 'toggle-history-panel' });
  }

  public sendFilePaths(paths: string[]) {
    this._view?.webview.postMessage({ type: 'files-dropped', paths });
  }

  public dispose() {
    this._disposeAllRuntimeSessions();
    this._conversationController.dispose();
    this._runtimeRegistry.get('opencode')?.dispose();
    (this._runtimeRegistry.get('codex') as CodexRuntime).stopLoginPolling();
    this._stopClaudeLoginPolling();
    this._disposeCodexStatusListener?.();
    this._disposeClaudeStatusListener?.();
    this._secretsChangeListener?.dispose();
    this._runtimeRegistry.dispose(); // Sprint 79
    if (this._browserContextPoll) {
      clearInterval(this._browserContextPoll);
      this._browserContextPoll = null;
    }
  }

  public async prepareForShutdown(): Promise<void> {
    await this._conversationController.interruptRuntimeAttachments(this._runtimeSessions.keys(), 'restart');
  }

  private async _sendApiKeyStatus() {
    const target = this._currentSidebarContext();
    if (!target) return;
    let hasKey = false;
    try {
      const apiKeyManager = getAPIKeyManager();
      hasKey = await apiKeyManager.hasAPIKey();
    } catch {
      // Key availability is one operational domain; false is its contained
      // failure result and cannot affect bootstrap/catalog readiness.
    }
    await this._postCurrentSidebarMessage(target, { type: 'ai-key-status', hasKey }, 'OpenAI key status');
  }

  private _sendConnectivityStatus() {
    this._view?.webview.postMessage({ type: 'connectivity-status', isOnline: isOnline() });
  }

  /**
   * Send onboarding status to webview.
   */
  private async _sendOnboardingStatus(known?: {
    setupStatus?: SetupStatus;
    codexStatus?: CodexSidebarStatus;
  }): Promise<void> {
    const target = this._currentSidebarContext();
    if (!target) return;
    try {
      const status = await this._getOnboardingStatus(known);
      if (this._isCurrentSidebarView(target.webview, target.generation)) {
        await target.webview.postMessage({ type: 'onboarding:status', status });
      }
    } catch (error) {
      // Onboarding is an independent enhancement; it never owns bootstrap.
      console.error('[Agent Chat onboarding] Status check failed:', error);
    }
  }

  /**
   * Get unified onboarding status, including Codex CLI state.
   */
  private async _getOnboardingStatus(known?: {
    setupStatus?: SetupStatus;
    codexStatus?: CodexSidebarStatus;
  }): Promise<OnboardingStatus> {
    const codexEnabled = isEnabled('codex-integration');
    const codexStatus = known?.codexStatus ?? (codexEnabled
      ? await (this._runtimeRegistry.get('codex') as CodexRuntime).getCodexSidebarStatus()
      : null);
    const codexAuthenticated = codexStatus?.state === 'ready';
    const codexCliInstalled = Boolean(codexStatus
      && codexStatus.state !== 'disabled'
      && codexStatus.state !== 'broken-install');
    const keyManager = getAPIKeyManager();
    const hasOpenAiKey = keyManager ? await keyManager.hasAPIKey() : false;

    return getOnboardingStatus({
      setupStatus: known?.setupStatus,
      hasOpenAiKey,
      codexCliInstalled,
      codexCliAuthenticated: codexAuthenticated,
    });
  }

  /**
   * Handle Claude install from onboarding wizard, with progress feedback.
   */
  private async _handleOnboardingClaudeInstall(): Promise<void> {
    this._view?.webview.postMessage({ type: 'onboarding:install-progress', dependency: 'claude-cli', state: 'installing' });

    const result = await installClaude((progress) => {
      this._view?.webview.postMessage({ type: 'agent-setup:progress', progress });
    });

    if (result.success) {
      this._view?.webview.postMessage({ type: 'onboarding:install-progress', dependency: 'claude-cli', state: 'installed' });
    } else {
      this._view?.webview.postMessage({ type: 'onboarding:install-progress', dependency: 'claude-cli', state: 'failed', error: result.error });
    }

    // Refresh full onboarding status
    clearSetupCache();
    const status = await this._getOnboardingStatus();
    this._view?.webview.postMessage({ type: 'onboarding:status', status });
  }

  /** Re-send the atomic local catalog/selection after model-catalog updates. */
  public notifyModelCatalogUpdated(): void {
    void this._sendCurrentAgentBootstrap();
  }

  private _currentSidebarContext(): { webview: vscode.Webview; generation: number } | null {
    if (!this._view) return null;
    return { webview: this._view.webview, generation: this._viewGeneration };
  }

  private _isCurrentSidebarView(webview: vscode.Webview, generation: number): boolean {
    return this._view?.webview === webview && this._viewGeneration === generation;
  }

  private async _postCurrentSidebarMessage(
    target: { webview: vscode.Webview; generation: number },
    message: unknown,
    domain: string,
  ): Promise<boolean> {
    if (!this._isCurrentSidebarView(target.webview, target.generation)) return false;
    try {
      return await target.webview.postMessage(message);
    } catch (error) {
      // Disposing/replacing a webview while an async producer is finishing is a
      // normal lifecycle race. It must not become an unhandled rejection.
      console.error(`[Agent Chat ${domain}] Could not post to webview:`, error);
      return false;
    }
  }

  private _nextSidebarStatusRevision(domain: AgentId | 'discovery'): number {
    this._sidebarStatusRevisions[domain] += 1;
    return this._sidebarStatusRevisions[domain];
  }

  private _isLatestSidebarStatusRevision(domain: AgentId | 'discovery', revision: number): boolean {
    return this._sidebarStatusRevisions[domain] === revision;
  }

  /**
   * Send the selector's atomic bootstrap. Every dependency here is a synchronous
   * local authority; runtime, credential, process, network, and discovery work
   * is forbidden in this path so a model label can never wait on it.
   */
  private async _sendAgentBootstrap(
    webview: vscode.Webview,
    generation: number,
    responseType: 'agent:bootstrap' | 'agent:config' = 'agent:bootstrap',
    legacyDiscovery?: { agents: ReturnType<typeof discoverAgents>; commands: ReturnType<typeof discoverCommands> },
  ): Promise<boolean> {
    if (!this._isCurrentSidebarView(webview, generation)) return false;

    try {
      const config = vscode.workspace.getConfiguration('ritemark.ai');
      const codexEnabled = isEnabled('codex-integration');
      const opencodeEnabled = isEnabled('opencode-integration');
      const visibleAgents = Object.values(AGENTS).filter((agent) => {
        if (agent.deprecated) return false;
        if (agent.id === 'codex') return codexEnabled;
        if (agent.id === 'opencode') return opencodeEnabled;
        return true;
      });
      const message = buildAgentSidebarBootstrap({
        generation,
        agenticEnabled: isEnabled('agentic-assistant'),
        parallelChatsEnabled: isEnabled('parallelChats'),
        durableAgentConversations: isEnabled('durableAgentConversations'),
        composerThinkingEffortEnabled: isEnabled('composer-thinking-effort'),
        codexEnabled,
        opencodeEnabled,
        selectedAgent: config.get<string>('selectedAgent', 'claude-code'),
        persistedClaudeModel: config.get<string>('selectedModel', modelCatalog.getDefault('anthropic', 'claude-code')),
        defaultClaudeModel: modelCatalog.getDefault('anthropic', 'claude-code'),
        agents: visibleAgents,
        claudeModels: modelCatalog.getModels('anthropic'),
        codexModels: modelCatalog.getModels('codex'),
        byokProviderModels: opencodeEnabled ? modelCatalog.getByokProviderModels() : undefined,
        hasSeenWelcome: config.get<boolean>('hasSeenClaudeWelcome', false),
        workspacePath: this._workspacePath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        claudeSdkVersion: CLAUDE_AGENT_SDK_VERSION,
        runtimeCapabilities: RUNTIME_CAPABILITIES,
      });
      // A cache-versioned current bundle requests `agent:bootstrap`. If an old
      // bundle still reaches the host and sends its legacy `ready` handshake,
      // answer in the shape it understands — from the same pure atomic data,
      // never by reviving the removed monolithic runtime probe.
      const response = responseType === 'agent:config'
        ? buildLegacyAgentSidebarConfig(message, legacyDiscovery)
        : message;
      return this._postCurrentSidebarMessage({ webview, generation }, response, 'bootstrap');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Agent Chat bootstrap] Could not build local bootstrap:', error);
      await this._postCurrentSidebarMessage({ webview, generation }, {
        type: 'agent:bootstrap-error',
        generation,
        error: error instanceof AgentSidebarBootstrapError
          ? detail
          : 'Agent Chat could not load its local configuration. Try again.',
      }, 'bootstrap');
      return false;
    }
  }

  private async _sendCurrentAgentBootstrap(): Promise<boolean> {
    const target = this._currentSidebarContext();
    return target ? this._sendAgentBootstrap(target.webview, target.generation) : false;
  }

  private async _sendRuntimeStatus(runtimeId: AgentId): Promise<void> {
    switch (runtimeId) {
      case 'claude-code': await this._sendClaudeSidebarStatus(); break;
      case 'codex': await this._sendCodexSidebarStatus(); break;
      case 'opencode': await this._sendAcpProviders(); break;
    }
  }

  private async _sendAgentDiscovery(): Promise<void> {
    const target = this._currentSidebarContext();
    if (!target) return;
    const revision = this._nextSidebarStatusRevision('discovery');
    try {
      // Yield so bootstrap delivery is never in the same blocking stack.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const workspacePath = this._workspacePath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const agents = workspacePath ? discoverAgents(workspacePath) : [];
      const commands = workspacePath ? discoverCommands(workspacePath) : [];
      if (!this._isCurrentSidebarView(target.webview, target.generation)
        || !this._isLatestSidebarStatusRevision('discovery', revision)) return;
      await this._postCurrentSidebarMessage(target, {
        type: 'agent:discovery',
        generation: target.generation,
        revision,
        agents,
        commands,
      }, 'discovery');
      if (this._legacySidebarViewGeneration === target.generation) {
        await this._sendAgentBootstrap(target.webview, target.generation, 'agent:config', { agents, commands });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Agent Chat discovery] Could not discover agents or commands:', error);
      if (!this._isCurrentSidebarView(target.webview, target.generation)
        || !this._isLatestSidebarStatusRevision('discovery', revision)) return;
      await this._postCurrentSidebarMessage(target, {
        type: 'agent:discovery',
        generation: target.generation,
        revision,
        agents: [],
        commands: [],
        error: detail,
      }, 'discovery');
      if (this._legacySidebarViewGeneration === target.generation) {
        await this._sendAgentBootstrap(target.webview, target.generation, 'agent:config', { agents: [], commands: [] });
      }
    }
  }

  private async _sendClaudeSidebarStatus(): Promise<SetupStatus | null> {
    const target = this._currentSidebarContext();
    if (!target) return null;
    const revision = this._nextSidebarStatusRevision('claude-code');
    const checkingDelivered = await this._postCurrentSidebarMessage(target, {
      type: 'agent:status-checking',
      runtimeId: 'claude-code',
      generation: target.generation,
      revision,
    }, 'Claude status');
    if (!checkingDelivered) return null;

    try {
      // Always leave the bootstrap call stack before a CLI/keychain probe.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (this._secrets) {
        try {
          const anthropicKey = await this._secrets.get('anthropic-api-key');
          setAnthropicKeyAvailable(Boolean(anthropicKey));
        } catch (error) {
          // Keychain failure must not erase or block the local model catalog.
          setAnthropicKeyAvailable(false);
          console.error('[Agent Chat Claude status] Could not read Anthropic key:', error);
        }
      }
      const status = await getSetupStatus();
      const environmentStatus = await getAgentEnvironmentStatus({ setupStatus: status });
      if (!this._isCurrentSidebarView(target.webview, target.generation)
        || !this._isLatestSidebarStatusRevision('claude-code', revision)) return null;
      const delivered = await this._postCurrentSidebarMessage(target, {
        type: 'agent-setup:complete',
        status,
        environmentStatus,
        generation: target.generation,
        revision,
      }, 'Claude status');
      return delivered ? status : null;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Agent Chat Claude status] Runtime check failed:', error);
      if (!this._isCurrentSidebarView(target.webview, target.generation)
        || !this._isLatestSidebarStatusRevision('claude-code', revision)) return null;
      await this._postCurrentSidebarMessage(target, {
        type: 'agent-setup:error',
        error: `Claude could not be checked. ${detail}`,
        generation: target.generation,
        revision,
      }, 'Claude status');
      return null;
    }
  }

  private async _handleExternalCodexStatusInvalidation(
    reason: 'login-started' | 'login-finished' | 'logout' | 'repair-started' | 'repair-finished' | 'status-refresh'
  ): Promise<void> {
    if (!isEnabled('codex-integration')) {
      return;
    }
    const rt = this._runtimeRegistry.get('codex') as CodexRuntime;
    if (reason === 'login-started') {
      rt.setLoginInProgress(true);
      rt.startLoginPolling((s) => this._postCodexSidebarStatus(s));
    } else if (reason === 'logout' || reason === 'login-finished') {
      rt.stopLoginPolling();
      rt.dispose();
    }
    const codexStatus = await this._sendCodexSidebarStatus();
    if (codexStatus) void this._sendOnboardingStatus({ codexStatus });
  }

  private async _handleExternalClaudeStatusInvalidation(
    reason: 'install-started' | 'install-finished' | 'login-started' | 'login-finished' | 'authentication-failed' | 'status-refresh' | 'settings-updated'
  ): Promise<void> {
    if (reason === 'login-started') {
      setClaudeLoginInProgress(true);
      this._startClaudeLoginPolling();
    } else if (reason === 'login-finished') {
      setClaudeLoginInProgress(false);
      this._stopClaudeLoginPolling();
    } else if (reason === 'authentication-failed' || reason === 'install-finished' || reason === 'settings-updated' || reason === 'status-refresh') {
      setClaudeLoginInProgress(false);
      this._stopClaudeLoginPolling();
    }

    if (reason === 'login-started' || reason === 'login-finished' || reason === 'authentication-failed') {
      this._disposeRuntimeSessionsForAgent('claude-code');
    }

    // Auth/runtime context may have changed (account, binary, settings) and model
    // availability can be account-specific — re-resolve after a completed
    // transition. Do not spawn a discovery probe while auth is missing or the
    // browser login is still in flight; that creates another stale Claude process.
    // The existing in-memory catalog is a valid bootstrap authority. Do not
    // make auth/status feedback wait on a remote catalog refresh; onUpdate will
    // re-send a newer bootstrap when the independent refresh completes.
    await this._sendCurrentAgentBootstrap();
    const setupStatus = await this._sendClaudeSidebarStatus();
    if (setupStatus) void this._sendOnboardingStatus({ setupStatus });
    if (reason !== 'login-started' && reason !== 'authentication-failed') {
      void modelCatalog.refresh().catch((error) => {
        console.error('[Agent Chat catalog] Refresh after Claude status change failed:', error);
      });
    }
  }

  private _stopClaudeLoginPolling(): void {
    if (this._claudeLoginPoll) {
      clearInterval(this._claudeLoginPoll);
      this._claudeLoginPoll = null;
    }
  }

  private _startClaudeLoginPolling(): void {
    this._stopClaudeLoginPolling();

    let attempts = 0;
    this._claudeLoginPoll = setInterval(() => {
      attempts += 1;

      void (async () => {
        const status = await getSetupStatus({ refresh: true });

        if (status.state === 'ready') {
          setClaudeLoginInProgress(false);
          this._stopClaudeLoginPolling();
          emitClaudeStatusInvalidated('login-finished');
          return;
        }

        await this._sendClaudeSidebarStatus();

        if (attempts >= 60) {
          setClaudeLoginInProgress(false);
          this._stopClaudeLoginPolling();
          await this._sendClaudeSidebarStatus();
        }
      })();
    }, 2000);
  }

  private _postCodexSidebarStatus(status: CodexSidebarStatus): void {
    const target = this._currentSidebarContext();
    if (!target) return;
    const revision = this._nextSidebarStatusRevision('codex');
    void target.webview.postMessage({
      type: 'codex:status',
      status,
      generation: target.generation,
      revision,
    });
  }

  private async _sendCodexSidebarStatus(): Promise<CodexSidebarStatus | null> {
    const target = this._currentSidebarContext();
    if (!target) return null;
    const revision = this._nextSidebarStatusRevision('codex');
    const checkingDelivered = await this._postCurrentSidebarMessage(target, {
      type: 'agent:status-checking',
      runtimeId: 'codex',
      generation: target.generation,
      revision,
    }, 'Codex status');
    if (!checkingDelivered) return null;

    if (!isEnabled('codex-integration')) {
      const status: CodexSidebarStatus = {
        enabled: false,
        state: 'disabled',
        version: null,
        authMethod: null,
        email: null,
        plan: null,
        error: null,
        diagnostics: [],
        repairCommand: null,
        binaryPath: null,
        compatibility: null,
      };
      if (this._isCurrentSidebarView(target.webview, target.generation)
        && this._isLatestSidebarStatusRevision('codex', revision)) {
        const delivered = await this._postCurrentSidebarMessage(target, {
          type: 'codex:status',
          status,
          generation: target.generation,
          revision,
        }, 'Codex status');
        return delivered ? status : null;
      }
      return null;
    }

    const rt = this._runtimeRegistry.get('codex') as CodexRuntime;
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const status = await rt.getCodexSidebarStatus();
      if (!this._isCurrentSidebarView(target.webview, target.generation)
        || !this._isLatestSidebarStatusRevision('codex', revision)) return null;
      const delivered = await this._postCurrentSidebarMessage(target, {
        type: 'codex:status',
        status,
        generation: target.generation,
        revision,
      }, 'Codex status');
      return delivered ? status : null;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Agent Chat Codex status] Runtime check failed:', error);
      if (!this._isCurrentSidebarView(target.webview, target.generation)
        || !this._isLatestSidebarStatusRevision('codex', revision)) return null;
      await this._postCurrentSidebarMessage(target, {
        type: 'agent:runtime-status-error',
        runtimeId: 'codex',
        error: `Codex could not be checked. ${detail}`,
        generation: target.generation,
        revision,
      }, 'Codex status');
      return null;
    }
  }

  private async _handleCodexLogin(): Promise<void> {
    const rt = this._runtimeRegistry.get('codex') as CodexRuntime;
    try {
      const status = await rt.getCodexSidebarStatus();
      if (status.state === 'broken-install') { this._postCodexSidebarStatus(status); return; }
      rt.setLoginInProgress(true);
      this._postCodexSidebarStatus({ ...status, state: 'auth-in-progress', error: null });
      rt.startLoginPolling((s) => this._postCodexSidebarStatus(s));
      const authUrl = await rt.beginLogin();
      await vscode.env.openExternal(vscode.Uri.parse(authUrl));
      emitCodexStatusInvalidated('login-started');
    } catch (error) {
      rt.stopLoginPolling();
      const message = error instanceof Error ? error.message : String(error);
      this._postCodexSidebarStatus({ enabled: true, state: 'needs-auth', version: null, authMethod: null, email: null, plan: null, error: message, diagnostics: [], repairCommand: null, binaryPath: null, compatibility: null });
    }
  }

  private async _handleCodexLogout(): Promise<void> {
    const rt = this._runtimeRegistry.get('codex') as CodexRuntime;
    try {
      const status = await rt.getCodexSidebarStatus();
      if (status.state === 'broken-install') { this._postCodexSidebarStatus(status); return; }
      await rt.logout();
      emitCodexStatusInvalidated('logout');
    } catch (error) {
      vscode.window.showErrorMessage(`Codex sign-out failed: ${error instanceof Error ? error.message : String(error)}`);
      this._postCodexSidebarStatus(await rt.getCodexSidebarStatus());
    }
  }

  private async _openCodexRepairTerminal(): Promise<void> {
    const codexManager = new CodexManager();
    const status = await codexManager.getBinaryStatus();
    const command = status.repairCommand ?? 'npm install -g @openai/codex@latest';

    const terminal = vscode.window.createTerminal({
      name: 'Codex Repair',
      shellPath: process.platform === 'win32' ? 'powershell.exe' : undefined,
    });

    terminal.show();
    terminal.sendText(command);

    vscode.window.showInformationMessage(
      'Opened Codex repair in terminal. After it finishes, reload the window.'
    );
  }

  /**
   * Read the BYOK provider keys from SecretStorage. These are the SAME values
   * the Settings cards write ('openai-api-key', 'google-ai-key',
   * 'anthropic-api-key', 'openrouter-api-key') — OpenCode reuses them (R3a).
   * Returned only to the host-side env builder; never sent to the webview.
   */
  private async _readByokKeys(): Promise<ByokKeys> {
    if (!this._secrets) return {};
    const [openai, google, anthropic, openrouter] = await Promise.all([
      this._secrets.get('openai-api-key'),
      this._secrets.get('google-ai-key'),
      this._secrets.get('anthropic-api-key'),
      this._secrets.get('openrouter-api-key'),
    ]);
    return { openai, google, anthropic, openrouter };
  }

  /**
   * Sprint 76 R3a: send the provider-configured booleans to the webview (model
   * picker filter + setup prompt). Only booleans — never key values.
   */
  private async _sendAcpProviders(): Promise<void> {
    const target = this._currentSidebarContext();
    if (!target) return;
    const revision = this._nextSidebarStatusRevision('opencode');
    const checkingDelivered = await this._postCurrentSidebarMessage(target, {
      type: 'agent:status-checking',
      runtimeId: 'opencode',
      generation: target.generation,
      revision,
    }, 'OpenCode status');
    if (!checkingDelivered) return;

    const enabled = isEnabled('opencode-integration');
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const providers: ByokProviderFlags = enabled
        ? byokProviderFlags(await this._readByokKeys())
        : { google: false, openai: false, anthropic: false, openrouter: false };
      if (!this._isCurrentSidebarView(target.webview, target.generation)
        || !this._isLatestSidebarStatusRevision('opencode', revision)) return;
      await this._postCurrentSidebarMessage(target, {
        type: 'acp-providers',
        enabled,
        providers,
        generation: target.generation,
        revision,
      }, 'OpenCode status');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Agent Chat OpenCode status] Could not read provider keys:', error);
      if (!this._isCurrentSidebarView(target.webview, target.generation)
        || !this._isLatestSidebarStatusRevision('opencode', revision)) return;
      await this._postCurrentSidebarMessage(target, {
        type: 'acp-providers',
        enabled,
        providers: { google: false, openai: false, anthropic: false, openrouter: false },
        generation: target.generation,
        revision,
        error: `OpenCode credentials could not be checked. ${detail}`,
      }, 'OpenCode status');
    }
  }

  /**
   * Handle Claude Code CLI installation request from webview.
   */
  private async _handleClaudeInstall() {
    emitClaudeStatusInvalidated('install-started');
    const result = await installClaude((progress) => {
      this._view?.webview.postMessage({ type: 'agent-setup:progress', progress });
    });

    clearSetupCache();
    const status = await getSetupStatus({ refresh: true });
    const environmentStatus = await getAgentEnvironmentStatus({ setupStatus: status });

    if (result.success) {
      if (result.outcome === 'installed') {
        clearClaudePendingReload();
      }

      this._view?.webview.postMessage({ type: 'agent-setup:complete', status, environmentStatus });
      emitClaudeStatusInvalidated('install-finished');
      return;
    }

    this._view?.webview.postMessage({
      type: 'agent-setup:error',
      error: result.error || 'Claude install failed.',
    });
    this._view?.webview.postMessage({ type: 'agent-setup:complete', status, environmentStatus });
    emitClaudeStatusInvalidated('install-finished');
  }

  /**
   * Handle Claude login request from webview.
   */
  private async _handleClaudeLogin() {
    const status = await getSetupStatus({ refresh: true });
    const environmentStatus = await getAgentEnvironmentStatus({ setupStatus: status });

    if (status.state === 'not-installed' || status.state === 'broken-install' || !status.binaryPath || !status.runnable) {
      this._view?.webview.postMessage({
        type: 'agent-setup:error',
        error: status.error ?? 'Claude is not ready yet. Install or repair it first.',
      });
      this._view?.webview.postMessage({ type: 'agent-setup:complete', status, environmentStatus });
      await this._sendClaudeSidebarStatus();
      return;
    }

    const startResult = beginClaudeLogin(status.binaryPath, {
      onUrl: (url) => {
        vscode.window.showInformationMessage(
          'Sign-in opened in your browser. Authorize to finish.',
          'Copy backup link'
        ).then((action) => {
          if (action === 'Copy backup link') {
            void vscode.env.clipboard.writeText(url);
          }
        });
      },
      onComplete: () => {
        void (async () => {
          const completedStatus = await getSetupStatus({ refresh: true });
          const completedEnvironmentStatus = await getAgentEnvironmentStatus({ setupStatus: completedStatus });
          this._view?.webview.postMessage({
            type: 'agent-setup:complete',
            status: completedStatus,
            environmentStatus: completedEnvironmentStatus,
          });
        })();
      },
      onError: (msg) => {
        this._view?.webview.postMessage({
          type: 'agent-setup:error',
          error: `Claude sign-in failed: ${msg}`,
        });
      },
      onTimeout: () => {
        this._view?.webview.postMessage({
          type: 'agent-setup:error',
          error: 'Claude sign-in timed out after 5 minutes. Please try again.',
        });
      },
      onCancel: () => {
        this._view?.webview.postMessage({
          type: 'agent-setup:error',
          error: 'Claude sign-in was cancelled.',
        });
      },
    });

    if (startResult === 'already-running') {
      this._view?.webview.postMessage({
        type: 'agent-setup:progress',
        progress: {
          stage: 'login',
          message: 'Claude sign-in is already open. Finish it in your browser.',
        },
      });
      return;
    }

    if (startResult === 'failed-to-start') return;

    this._view?.webview.postMessage({
      type: 'agent-setup:progress',
      progress: {
        stage: 'login',
        message: 'Finish Claude.ai sign-in in your browser. Ritemark will update automatically.',
      },
    });

  }

  private _sendChatFontSize() {
    const fontSize = vscode.workspace.getConfiguration('ritemark.chat').get<number>('fontSize', 13);
    this._view?.webview.postMessage({ type: 'settings:chatFontSize', fontSize });
  }

  /**
   * Open a chat-referenced file in the workspace. Relative paths resolve
   * against the workspace root; the resolved realpath must stay INSIDE the
   * workspace (chat content is model-authored — no traversal, no symlink
   * escape). `vscode.open` routes through editor associations, so .md lands
   * in Ritemark's editor, spreadsheets in theirs, etc.
   */
  private async _openWorkspaceFile(rawPath: string): Promise<void> {
    const workspaceRoot = this._workspacePath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Open a folder to follow file links from chat.');
      return;
    }
    const fs = await import('fs');
    const path = await import('path');
    const resolved = path.isAbsolute(rawPath) ? rawPath : path.join(workspaceRoot, rawPath);
    let realTarget: string;
    let realRoot: string;
    try {
      realTarget = fs.realpathSync(resolved);
      realRoot = fs.realpathSync(workspaceRoot);
    } catch {
      void vscode.window.showWarningMessage(`File not found in this workspace: ${rawPath}`);
      return;
    }
    if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
      void vscode.window.showWarningMessage(`Chat links only open files inside the current folder: ${rawPath}`);
      return;
    }
    if (!fs.statSync(realTarget).isFile()) return;
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(realTarget));
  }

  /** The UI-selected Claude model, reconciled against the resolved catalog. */
  private _thinkingEffortCapability(
    conversationId: string,
    runtimeId: AgentId,
    modelId: string | undefined,
  ): ThinkingEffortCapability {
    const live = this._liveThinkingEffortCapabilities.get(conversationId)?.[runtimeId];
    if (live) return live;
    if (runtimeId === 'opencode') {
      return { selectable: [], source: 'runtime-live', supportsAppliedValue: false };
    }
    const provider = runtimeId === 'codex' ? 'codex' : 'anthropic';
    const model = modelCatalog.getModel(provider, modelId);
    return {
      selectable: [...(model?.thinkingEffort?.levels ?? [])],
      ...(model?.thinkingEffort?.defaultLevel ? { defaultLevel: model.thinkingEffort.defaultLevel } : {}),
      source: 'model-catalog',
      supportsAppliedValue: false,
    };
  }

  private _reconciledClaudeModel(): string {
    const selected = vscode.workspace.getConfiguration('ritemark.ai')
      .get<string>('selectedModel', modelCatalog.getDefault('anthropic', 'claude-code'));
    return modelCatalog.getModel('anthropic', selected)?.id
      ?? modelCatalog.getDefault('anthropic', 'claude-code');
  }

  private _sendActiveFile() {
    const activeFile = this._getActiveFileContext();
    this._view?.webview.postMessage({
      type: 'active-file-changed',
      path: activeFile?.path ?? null,
    });
  }

  private async _sendActiveBrowserContext() {
    const snapshot = await BrowserContextStore.instance.refreshMetadata();
    if (snapshot?.url && snapshot.pageId && !snapshot.sharedWithAgent) {
      // Fire-and-forget: triggers consent dialog the first time per pageId per session.
      // Subsequent polls see sharedWithAgent === true and skip.
      void BrowserContextStore.instance.ensureSharedForActiveTab();
    }
    const post = BrowserContextStore.instance.getLastSnapshot() ?? snapshot;

    // Sprint 78 (#73): when annotation mode is active, capture a fresh
    // viewport screenshot so the Composer can show a thumbnail chip instead
    // of the plain URL chip. The screenshot is encoded as a data URL and
    // sent only when annotation mode is on — normal-mode polls skip the
    // (expensive) Playwright capture entirely.
    //
    // Cache: re-use the last captured screenshot as long as the URL hasn't
    // changed AND the capture is recent (ANNOTATION_SCREENSHOT_TTL_MS). The TTL
    // re-captures same-URL viewport changes (scroll, modals) within a few
    // seconds while still avoiding a Playwright screenshot on every 1500ms
    // poll cycle.
    let screenshotPreview: { dataUrl: string } | null = null;
    if (post?.annotationMode && post.sharedWithAgent && post.url) {
      const cache = this._annotationScreenshotCache?.url === post.url ? this._annotationScreenshotCache : null;
      const cacheIsFresh = cache !== null
        && Date.now() - cache.capturedAt < UnifiedViewProvider.ANNOTATION_SCREENSHOT_TTL_MS;
      if (cache && cacheIsFresh) {
        // URL unchanged and capture is recent — reuse cached screenshot.
        screenshotPreview = { dataUrl: cache.dataUrl };
      } else {
        // URL changed, cache expired, or no cache — capture fresh screenshot.
        try {
          const result = await vscode.commands.executeCommand<unknown>('workbench.action.browser.captureActiveViewport');
          if (result && typeof result === 'object' && 'screenshot' in result) {
            const sr = (result as { screenshot?: { mimeType: string; base64: string } }).screenshot;
            if (sr?.mimeType && sr?.base64) {
              const dataUrl = `data:${sr.mimeType};base64,${sr.base64}`;
              this._annotationScreenshotCache = { url: post.url, dataUrl, capturedAt: Date.now() };
              screenshotPreview = { dataUrl };
            }
          }
        } catch {
          // Screenshot capture failed — handled by the stale-cache fallback below.
        }
        if (!screenshotPreview && cache) {
          // Capture failed or returned nothing — keep showing the stale
          // thumbnail for the same URL instead of flickering back to the URL chip.
          screenshotPreview = { dataUrl: cache.dataUrl };
        }
      }
    } else {
      // Annotation mode off — clear cache so next activation gets a fresh shot.
      this._annotationScreenshotCache = null;
    }

    this._view?.webview.postMessage({
      type: 'active-browser-changed',
      context: post?.url ? {
        url: post.url,
        title: post.title,
        sharedWithAgent: post.sharedWithAgent === true,
        annotationMode: post.annotationMode === true,
        screenshotPreview,
        error: post.error,
      } : null,
    });
  }

  private _refreshBrowserContextPolling() {
    const shouldPoll = this._view?.visible === true;
    if (shouldPoll && !this._browserContextPoll) {
      void this._sendActiveBrowserContext();
      this._browserContextPoll = setInterval(() => {
        void this._sendActiveBrowserContext();
      }, 1500);
    } else if (!shouldPoll && this._browserContextPoll) {
      clearInterval(this._browserContextPoll);
      this._browserContextPoll = null;
    }
  }

  private _executeToolInEditor(
    toolName: string,
    args: Record<string, unknown>,
    selection: EditorSelection
  ) {
    vscode.commands.executeCommand('ritemark.executeAITool', { toolName, args, selection });
  }

  /**
   * Get the active file context from the editor.
   * Uses tabGroups API which works for both TextEditor and custom editors (Ritemark).
   * Falls back to activeTextEditor for non-custom editors.
   */
  private _getActiveFileContext(): { path: string; selection?: string } | undefined {
    // Try tabGroups first — works for custom editors (Ritemark .md files)
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab?.input && typeof activeTab.input === 'object' && 'uri' in activeTab.input) {
      const uri = (activeTab.input as { uri: vscode.Uri }).uri;
      const viewType = (activeTab.input as { viewType?: string }).viewType;

      // Sprint 108: the Transcript Workbench's document is an AUDIO file. Hand
      // the agent the saved transcript instead — a path to an .m4a is not
      // context, it is a file it will fail to read. Until the user saves,
      // there is nothing readable to offer, and saying nothing is honest.
      if (viewType === TRANSCRIPT_WORKBENCH_VIEW_TYPE) {
        const document = transcriptDocumentFor(uri.fsPath);
        return document
          ? { path: vscode.workspace.asRelativePath(document) }
          : undefined;
      }

      return {
        path: vscode.workspace.asRelativePath(uri),
        selection: this._currentSelection.isEmpty ? undefined : this._currentSelection.text,
      };
    }

    // Fallback to activeTextEditor (standard text files)
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      return {
        path: vscode.workspace.asRelativePath(activeEditor.document.uri),
        selection: this._currentSelection.isEmpty ? undefined : this._currentSelection.text,
      };
    }

    return undefined;
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this._getNonce();

    // Match the editor provider's cache policy. Without a content version this
    // sidebar can keep executing a previous release's webview bundle while the
    // extension host has already updated its message contract.
    const scriptPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js');
    const scriptBaseUri = webview.asWebviewUri(scriptPath).toString();
    const scriptUri = versionedWebviewAssetUri(scriptBaseUri, scriptPath.fsPath);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource} data:;">
  <title>Ritemark AI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background) !important;
    }
  </style>
</head>
<body>
  <div id="root" data-editor-type="ai-sidebar"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /** Bug #33: After an agent finishes writing files, nudge the explorer so it doesn't show stale state. */
  private _refreshExplorerForAgentWrites(filesModified: string[] | undefined): void {
    const parentDirs = new Set<string>();
    if (filesModified) {
      for (const file of filesModified) {
        const parent = file.replace(/[/\\][^/\\]+$/, '');
        if (parent && parent !== file) parentDirs.add(parent);
      }
    }
    void Promise.all(
      Array.from(parentDirs).map((dir) =>
        vscode.workspace.fs.stat(vscode.Uri.file(dir)).then(undefined, () => undefined)
      )
    ).then(() =>
      vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer')
    );
  }

  // ── Runtime sessions (Sprint 99) ─────────────────────────────────────

  /**
   * A confirmed handoff makes every other runtime attachment for this
   * conversation stale. Interrupt upstream work, release its provider context,
   * and leave sibling conversations untouched.
   */
  private _disposeOtherRuntimeSessions(conversationId: string, targetAgentId: AgentId): void {
    const byAgent = this._runtimeSessions.get(conversationId);
    if (!byAgent) return;
    for (const [agentId, session] of [...byAgent.entries()]) {
      if (agentId === targetAgentId) continue;
      void session.cancel().catch(() => { /* stale runtime may already be unavailable */ });
      this._disposeRuntimeSession(conversationId, agentId);
    }
    if (byAgent.size === 0) this._runtimeSessions.delete(conversationId);
  }

  private _disposeRuntimeSession(conversationId: string, agentId: AgentId): void {
    this._runtimeRegistry.get(agentId)?.disposeSession(conversationId);
    const byAgent = this._runtimeSessions.get(conversationId);
    byAgent?.delete(agentId);
    if (byAgent?.size === 0) this._runtimeSessions.delete(conversationId);
    const liveCapabilities = this._liveThinkingEffortCapabilities.get(conversationId);
    if (liveCapabilities) {
      delete liveCapabilities[agentId];
      if (Object.keys(liveCapabilities).length === 0) {
        this._liveThinkingEffortCapabilities.delete(conversationId);
      }
    }
  }

  /** Release one app-global runtime kind across every attached conversation. */
  private _disposeRuntimeSessionsForAgent(agentId: AgentId): void {
    for (const conversationId of Array.from(this._runtimeSessions.keys())) {
      this._disposeRuntimeSession(conversationId, agentId);
      if (!this._runtimeSessions.has(conversationId)) {
        this._runtimeSessionLastUsed.delete(conversationId);
      }
    }
  }

  /**
   * Open, or re-configure, this conversation's session with a runtime.
   *
   * Reuse is strictly per conversation: a warm session keeps that chat's context
   * across turns, and no conversation is ever handed another's session.
   */
  private async _openRuntimeSession(
    conversationId: string,
    agentId: AgentId,
    runtime: AgentRuntime,
    config: RuntimeSessionConfig,
  ): Promise<RuntimeSession> {
    await this._ensureRuntimeAttachmentCapacity(conversationId);
    let byAgent = this._runtimeSessions.get(conversationId);
    if (!byAgent) {
      byAgent = new Map<AgentId, RuntimeSession>();
      this._runtimeSessions.set(conversationId, byAgent);
    }

    const session = await runtime.createSession(conversationId, config);
    byAgent.set(agentId, session);
    this._runtimeSessionLastUsed.set(conversationId, Date.now());
    return session;
  }

  private _findRuntimeSession(
    conversationId: string | undefined,
    agentId: AgentId,
  ): RuntimeSession | undefined {
    const resolvedConversationId = conversationId ?? DEFAULT_CONVERSATION_ID;
    const session = this._runtimeSessions.get(resolvedConversationId)?.get(agentId);
    if (session) this._runtimeSessionLastUsed.set(resolvedConversationId, Date.now());
    return session;
  }

  /** Tear down one conversation's sessions, leaving every other conversation alone. */
  private _disposeRuntimeSessions(conversationId: string): void {
    const byAgent = this._runtimeSessions.get(conversationId);
    if (!byAgent) return;
    for (const agentId of byAgent.keys()) {
      this._runtimeRegistry.get(agentId)?.disposeSession(conversationId);
    }
    this._runtimeSessions.delete(conversationId);
    this._runtimeSessionLastUsed.delete(conversationId);
    this._activeRuntimeTurnTokens.delete(conversationId);
    this._liveThinkingEffortCapabilities.delete(conversationId);
  }

  private async _ensureRuntimeAttachmentCapacity(incomingConversationId: string): Promise<void> {
    const capacity = isEnabled('parallelChats')
      ? PARALLEL_RUNTIME_ATTACHMENT_LIMIT
      : SINGLE_RUNTIME_ATTACHMENT_LIMIT;
    while (true) {
      const attachments = await Promise.all(Array.from(this._runtimeSessions.keys()).map(async (conversationId) => {
        try {
          const record = await this._conversationController.runtimeConversation(conversationId);
          return {
            conversationId,
            lifecycle: record.lifecycle,
            lastUsedAt: this._runtimeSessionLastUsed.get(conversationId) ?? 0,
          };
        } catch {
          // A live session without a current-project durable record is unsafe to
          // reuse. Treat it as idle so the bounded pool releases it first.
          return {
            conversationId,
            lifecycle: { state: 'idle' } as const,
            lastUsedAt: this._runtimeSessionLastUsed.get(conversationId) ?? 0,
          };
        }
      }));
      const decision = decideRuntimeAttachmentCapacity({
        attachments,
        incomingConversationId,
        currentConversationId: this._selectedConversationId,
        capacity,
      });
      if (decision.kind === 'available') return;
      if (decision.kind === 'blocked') throw new Error(decision.message);
      this._disposeRuntimeSessions(decision.conversationId);
    }
  }

  private _disposeAllRuntimeSessions(): void {
    for (const conversationId of Array.from(this._runtimeSessions.keys())) {
      this._disposeRuntimeSessions(conversationId);
    }
    this._liveThinkingEffortCapabilities.clear();
  }

  private async _stopConversationSessions(conversationId: string): Promise<void> {
    const byAgent = this._runtimeSessions.get(conversationId);
    if (!byAgent) return;
    await Promise.all(Array.from(byAgent.values()).map((session) => session.cancel()));
    this._disposeRuntimeSessions(conversationId);
  }

  private _runConversationCheckpoint(
    conversationId: string,
    operation: () => Promise<unknown>,
    enabled = true,
  ): void {
    void this._queueConversationCheckpoint(conversationId, operation, enabled)
      .catch((error: unknown) => this._handleConversationCheckpointError(error));
  }

  private _queueConversationCheckpoint(
    conversationId: string,
    operation: () => Promise<unknown>,
    enabled = true,
  ): Promise<void> {
    if (!enabled) return Promise.resolve();
    const previous = this._conversationCheckpointQueues.get(conversationId) ?? Promise.resolve();
    const next = previous.catch(() => { /* prior caller reports its own failure */ })
      .then(async () => { await operation(); });
    this._conversationCheckpointQueues.set(conversationId, next);
    void next.catch(() => { /* caller owns reporting */ }).then(() => {
      if (this._conversationCheckpointQueues.get(conversationId) === next) {
        this._conversationCheckpointQueues.delete(conversationId);
      }
    });
    return next;
  }

  private _handleConversationCheckpointError(error: unknown): void {
    if (error instanceof ConversationStoreError
      && ['deleted', 'not-found', 'stale-binding'].includes(error.code)) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Conversations] Runtime checkpoint failed:', error);
    void this._view?.webview.postMessage({
      type: 'conversation/store-status',
      state: 'degraded',
      message: `Conversation checkpoint failed: ${message}`,
    });
  }

  private _continuationHostSecret(): Promise<string> {
    if (this._continuationHostSecretPromise) return this._continuationHostSecretPromise;
    this._continuationHostSecretPromise = (async () => {
      const key = 'ritemark.conversation-continuation.installation-secret.v1';
      const existing = await this._secrets?.get(key);
      if (existing) return existing;
      const created = randomBytes(32).toString('hex');
      await this._secrets?.store(key, created);
      return created;
    })();
    return this._continuationHostSecretPromise;
  }

}
