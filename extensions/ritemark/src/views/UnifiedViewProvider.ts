/**
 * Unified AI View Provider
 * Hosts the AI chat sidebar (Primary Sidebar) for the Claude Code and Codex runtimes.
 */

import * as vscode from 'vscode';
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
  startClaudeLoginSubprocess,
  type ClaudeLoginSubprocessHandle,
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
  type AgentEnvironmentStatus,
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
import type { AgentRuntime, RuntimeSession, RuntimeSessionConfig } from '../runtime/AgentRuntime';

/**
 * Conversation id used when a webview message predates the Sprint 99 protocol.
 * // Sprint 99 Phase 1: remove once every webview path sends conversationId.
 */
const DEFAULT_CONVERSATION_ID = 'default';

export class UnifiedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.unifiedView';

  private _view?: vscode.WebviewView;
  /**
   * Live runtime sessions, keyed by conversation then runtime.
   *
   * A conversation talks to one runtime at a time, but switching runtime inside
   * one conversation must not disturb any other conversation's sessions — hence
   * the nesting rather than a flat map.
   */
  private readonly _runtimeSessions = new Map<string, Map<AgentId, RuntimeSession>>();
  private _documentContent: string = '';
  private _currentSelection: EditorSelection = { text: '', isEmpty: true, from: 0, to: 0 };

  private _disposeCodexStatusListener: (() => void) | null = null;
  private _claudeLoginPoll: ReturnType<typeof setInterval> | null = null;
  private _claudeLoginSubprocess: ClaudeLoginSubprocessHandle | null = null;
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

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string | undefined,
    private readonly _secrets?: vscode.SecretStorage
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
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          this._sendApiKeyStatus();
          this._sendConnectivityStatus();
          // Await agent config first — it boots Codex runtime and hydrates auth.
          // Onboarding status needs that to correctly detect authenticated users.
          await this._sendAgentConfig();
          this._sendChatFontSize();
          this._sendActiveFile();
          void this._sendActiveBrowserContext();
          this._sendOnboardingStatus();
          break;

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
          // Persist agent selection to settings
          await vscode.workspace.getConfiguration('ritemark.ai').update(
            'selectedAgent',
            message.agentId,
            vscode.ConfigurationTarget.Global
          );
          // Re-send config (triggers setup check for Claude Code)
          this._sendAgentConfig();
          break;

        case 'ai-select-model':
          await vscode.workspace.getConfiguration('ritemark.ai').update('selectedModel', message.modelId, vscode.ConfigurationTarget.Global);
          this._runtimeRegistry.get('claude-code')?.dispose();
          break;

        case 'pin-agent-request':
          this.pinAgent(message.agentId, message.filePath);
          break;

        case 'agent-execute': {
          const { agentId, model, attachments } = message;
          // Sprint 99: every conversation-scoped message carries its conversation.
          // A missing id means a webview path that has not been migrated yet.
          const conversationId: string = message.conversationId ?? DEFAULT_CONVERSATION_ID;
          const skipActiveFile = message.skipActiveFile === true;
          const skipBrowserContext = message.skipBrowserContext === true;
          const mentionedAgentPaths: string[] | undefined = message.mentionedAgentPaths;
          // Unified approval policy (Auto/Ask/Plan) — applies to all runtimes.
          const approvalMode: 'auto' | 'ask' | 'plan' =
            message.approvalMode === 'ask' || message.approvalMode === 'plan' ? message.approvalMode : 'auto';
          const codexTurnMode: 'plan' | 'execute' = approvalMode === 'plan' ? 'plan' : 'execute';
          const runtime = this._runtimeRegistry.get(agentId as import('../agent/types').AgentId);
          const isClaudeCode = agentId === 'claude-code';
          const isCodex = agentId === 'codex';
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

          const sessionConfig: RuntimeSessionConfig = {
            workspacePath: this._workspacePath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
            model,
            byokEnv: buildByokEnv(byokKeys),
            excludedFolders,
            anthropicApiKey,
            approvalMode,
            codexApprovalPolicy,
            codexSandboxMode,
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
              if (isClaudeCode) {
                this._view?.webview.postMessage({ type: 'agent-progress', conversationId, agentId, progress });
              } else {
                if (progress.type === 'text') {
                  this._view?.webview.postMessage({ type: 'codex-streaming', conversationId, delta: progress.message });
                } else {
                  this._view?.webview.postMessage({ type: 'codex-progress', conversationId, progress });
                }
              }
            },
            onApprovalRequest: (req) => this._approvalGate.request({ ...req, conversationId }),
            onComplete: (result) => {
              this._view?.webview.postMessage({
                type: 'agent-result', conversationId,
                agentId,
                text: result.text ?? '',
                filesModified: result.filesModified ?? [],
                metrics: result.metrics ?? { durationMs: 0, costUsd: null, model: null },
                error: result.error,
              });
              this._refreshExplorerForAgentWrites(result.filesModified);
            },
            onQuestion: (question) => {
              this._view?.webview.postMessage({ type: 'agent-question', conversationId, agentId, question });
            },
            onCodexComplete: (result) => {
              this._view?.webview.postMessage({
                type: 'codex-result', conversationId,
                agentId,
                status: result.status,
                error: result.error,
              });
              this._refreshExplorerForAgentWrites(undefined);
            },
            onExit: () => {
              // Codex app-server died mid-turn — finalize the turn so the webview
              // isn't stuck on "running" forever.
              this._view?.webview.postMessage({
                type: 'codex-result', conversationId,
                agentId,
                status: 'error',
                error: 'Codex exited unexpectedly. Please try again.',
              });
            },
            onCodexPlanDelta: (delta) => {
              this._view?.webview.postMessage({ type: 'codex-plan-text-delta', conversationId, delta });
            },
            onCodexPlanUpdate: (explanation, plan) => {
              this._view?.webview.postMessage({ type: 'codex-plan-update', conversationId, explanation, plan });
            },
            onCodexQuestion: (requestId, questions) => {
              this._view?.webview.postMessage({ type: 'codex-question', conversationId, requestId, questions });
            },
            onRpcProgress: (_method, msg) => {
              this._view?.webview.postMessage({ type: 'codex-rpc-progress', conversationId, method: _method, message: msg });
            },
            // Codex dynamic browser tools (dispatched in extension host, results sent back to Codex)
            onBrowserToolCall: (agentId === 'codex' && browserEnabled)
              ? async (toolName, args, _requestId) => {
                if (isCodexBrowserToolCall(toolName)) {
                  return dispatchCodexBrowserToolCall(toolName, args);
                }
                return { text: `Unknown browser tool: ${toolName}`, success: false };
              }
              : undefined,
          };
          try {
            const session = await this._openRuntimeSession(conversationId, agentId as AgentId, runtime, sessionConfig);
            await session.prompt({ prompt, attachments: turnAttachments, activeFile, mode: codexTurnMode, model, timeoutMinutes: agentTimeout });
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
            session?.respondToApproval(requestId, approved === true, alwaysAllow === true);
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
          emitClaudeStatusInvalidated('status-refresh');
          this._sendAgentConfig();
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
          const status = await this._getOnboardingStatus();
          this._view?.webview.postMessage({ type: 'onboarding:status', status });
          // Also refresh the agent config so per-agent views update too
          emitClaudeStatusInvalidated('status-refresh');
          this._sendAgentConfig();
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
          emitCodexStatusInvalidated('status-refresh');
          await this._sendCodexSidebarStatus();
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
  public submitCommentPrompt(agentId: string, prompt: string) {
    const dispatch = () =>
      this._view?.webview.postMessage({ type: 'comment:submit', agentId, prompt });
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

  private async _sendApiKeyStatus() {
    try {
      const apiKeyManager = getAPIKeyManager();
      const hasKey = await apiKeyManager.hasAPIKey();
      this._view?.webview.postMessage({ type: 'ai-key-status', hasKey });
    } catch {
      this._view?.webview.postMessage({ type: 'ai-key-status', hasKey: false });
    }
  }

  private _sendConnectivityStatus() {
    this._view?.webview.postMessage({ type: 'connectivity-status', isOnline: isOnline() });
  }

  /**
   * Send onboarding status to webview.
   */
  private async _sendOnboardingStatus(): Promise<void> {
    const status = await this._getOnboardingStatus();
    this._view?.webview.postMessage({ type: 'onboarding:status', status });
  }

  /**
   * Get unified onboarding status, including Codex CLI state.
   */
  private async _getOnboardingStatus(): Promise<OnboardingStatus> {
    const rt = this._runtimeRegistry.get('codex') as CodexRuntime;
    const codexStatus = await rt.getCodexSidebarStatus();
    const codexAuthenticated = codexStatus.state === 'ready';
    const codexCliInstalled = codexStatus.state !== 'disabled' && codexStatus.state !== 'broken-install';
    const keyManager = getAPIKeyManager();
    const hasOpenAiKey = keyManager ? await keyManager.hasAPIKey() : false;

    return getOnboardingStatus({
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

  /**
   * Re-send agent config to the webview. Called when the model catalog resolves
   * fresh model lists (live probe / remote fetch / 6h refresh) so the sidebar
   * dropdown updates without a reload (Sprint 89 #109, spec R1/R4).
   */
  public notifyModelCatalogUpdated(): void {
    void this._sendAgentConfig();
  }

  /**
   * Send agent configuration to webview (selected agent, available agents, feature flag state)
   */
  private async _sendAgentConfig() {
    const agenticEnabled = isEnabled('agentic-assistant');
    // Sprint 99 kill-switch. Parallel chats are almost entirely webview behaviour,
    // so the flag has to cross the boundary or it cannot switch anything off.
    const parallelChatsEnabled = isEnabled('parallelChats');
    const codexEnabled = isEnabled('codex-integration');
    const config = vscode.workspace.getConfiguration('ritemark.ai');
    const selectedAgent = config.get<string>('selectedAgent', 'claude-code');
    const selectedModel = config.get<string>('selectedModel', modelCatalog.getDefault('anthropic', 'claude-code'));

    let setupStatus: SetupStatus | undefined;
    let environmentStatus: AgentEnvironmentStatus | undefined;
    let hasSeenWelcome = false;
    if (selectedAgent === 'claude-code') {
      // Check SecretStorage for Anthropic API key before setup status check
      if (this._secrets) {
        const anthropicKey = await this._secrets.get('anthropic-api-key');
        setAnthropicKeyAvailable(!!anthropicKey);
      }
      setupStatus = await getSetupStatus();
      hasSeenWelcome = config.get<boolean>('hasSeenClaudeWelcome', false);
    }
    environmentStatus = await getAgentEnvironmentStatus({ setupStatus });

    // Discover dynamic agents and commands from .claude/ directory
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const discoveredAgents = workspacePath ? discoverAgents(workspacePath) : [];
    const discoveredCommands = workspacePath ? discoverCommands(workspacePath) : [];
    const codexStatus = await (this._runtimeRegistry.get('codex') as CodexRuntime).getCodexSidebarStatus();

    // Filter agents based on feature flags; exclude deprecated agents from the selector
    const opencodeEnabled = isEnabled('opencode-integration');
    const visibleAgents = Object.values(AGENTS).filter(a => {
      if (a.deprecated) return false;
      if (a.id === 'codex') return codexEnabled;
      // Sprint 76 R7: gate OpenCode in the agent registry exposure to the webview.
      if (a.id === 'opencode') return opencodeEnabled;
      return true;
    });

    // Sprint 76 R3a/R6: which BYOK providers are configured (booleans only —
    // never key values) + curated models, so the OpenCode model picker can
    // filter. Empty/false when the flag is off.
    const acpProviders: ByokProviderFlags = opencodeEnabled
      ? byokProviderFlags(await this._readByokKeys())
      : { google: false, openai: false, anthropic: false, openrouter: false };

    const claudeModels = modelCatalog.getModels('anthropic');
    // Reconcile a persisted-but-stale selection against the resolved list so the
    // sidebar never shows or runs a model id that no longer exists (Sprint 89 #109).
    const reconciledModel = claudeModels.some((m) => m.id === selectedModel)
      ? selectedModel
      : modelCatalog.getDefault('anthropic', 'claude-code');

    this._view?.webview.postMessage({
      type: 'agent:config',
      agenticEnabled,
      parallelChatsEnabled,
      codexEnabled,
      selectedAgent,
      selectedModel: reconciledModel,
      agents: visibleAgents,
      models: claudeModels,
      codexModels: modelCatalog.getModels('codex'),
      // Sprint 76 R6/R7: OpenCode availability + BYOK provider booleans + curated
      // models. The webview model picker filters models by configured providers.
      opencodeEnabled,
      acpProviders,
      byokProviderModels: opencodeEnabled ? modelCatalog.getByokProviderModels() : undefined,
      codexStatus,
      setupStatus,
      environmentStatus,
      hasSeenWelcome,
      discoveredAgents,
      discoveredCommands,
      workspacePath: this._workspacePath,
      claudeSdkVersion: CLAUDE_AGENT_SDK_VERSION,
    });

    // Model lists come from the model-catalog resolver (live /v1/models → remote
    // → cache → bundled). Discovery + refresh is owned by `src/ai/modelCatalog`
    // (activated in extension.ts + refreshed on Claude status changes below).
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
    await this._sendCodexSidebarStatus();
    this._sendOnboardingStatus();
  }

  private async _handleExternalClaudeStatusInvalidation(
    reason: 'install-started' | 'install-finished' | 'login-started' | 'login-finished' | 'status-refresh' | 'settings-updated'
  ): Promise<void> {
    if (reason === 'login-started') {
      setClaudeLoginInProgress(true);
      this._startClaudeLoginPolling();
    } else if (reason === 'login-finished') {
      setClaudeLoginInProgress(false);
      this._stopClaudeLoginPolling();
    } else if (reason === 'install-finished' || reason === 'settings-updated' || reason === 'status-refresh') {
      setClaudeLoginInProgress(false);
      this._stopClaudeLoginPolling();
    }

    // Auth/runtime context may have changed (account, binary, settings) and model
    // availability can be account-specific — re-resolve the catalog before sending.
    await modelCatalog.refresh();
    await this._sendAgentConfig();
    this._sendOnboardingStatus();
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

        await this._sendAgentConfig();

        if (attempts >= 60) {
          setClaudeLoginInProgress(false);
          this._stopClaudeLoginPolling();
          await this._sendAgentConfig();
        }
      })();
    }, 2000);
  }

  private _postCodexSidebarStatus(status: CodexSidebarStatus): void {
    this._view?.webview.postMessage({
      type: 'codex:status',
      status,
    });
  }

  private async _sendCodexSidebarStatus(): Promise<void> {
    const rt = this._runtimeRegistry.get('codex') as CodexRuntime;
    this._postCodexSidebarStatus(await rt.getCodexSidebarStatus());
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
    const enabled = isEnabled('opencode-integration');
    const providers: ByokProviderFlags = enabled
      ? byokProviderFlags(await this._readByokKeys())
      : { google: false, openai: false, anthropic: false, openrouter: false };
    this._view?.webview.postMessage({
      type: 'acp-providers',
      enabled,
      providers,
    });
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
      await this._sendAgentConfig();
      return;
    }

    if (this._claudeLoginSubprocess) {
      this._claudeLoginSubprocess.kill();
      this._claudeLoginSubprocess = null;
    }

    setClaudeLoginInProgress(true);
    this._startClaudeLoginPolling();
    emitClaudeStatusInvalidated('login-started');

    this._claudeLoginSubprocess = startClaudeLoginSubprocess(status.binaryPath, {
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
        this._claudeLoginSubprocess = null;
        setClaudeLoginInProgress(false);
        emitClaudeStatusInvalidated('login-finished');
      },
      onError: (msg) => {
        this._claudeLoginSubprocess = null;
        setClaudeLoginInProgress(false);
        emitClaudeStatusInvalidated('settings-updated');
        this._view?.webview.postMessage({
          type: 'agent-setup:error',
          error: `Claude sign-in failed: ${msg}`,
        });
      },
      onTimeout: () => {
        this._claudeLoginSubprocess = null;
        setClaudeLoginInProgress(false);
        emitClaudeStatusInvalidated('settings-updated');
        this._view?.webview.postMessage({
          type: 'agent-setup:error',
          error: 'Claude sign-in timed out after 5 minutes. Please try again.',
        });
      },
    });

    this._view?.webview.postMessage({
      type: 'agent-setup:progress',
      progress: {
        stage: 'login',
        message: 'Finish Claude.ai sign-in in your browser. Ritemark will update automatically.',
      },
    });

    const pendingStatus = await getSetupStatus({ refresh: true });
    const pendingEnvironmentStatus = await getAgentEnvironmentStatus({ setupStatus: pendingStatus });
    this._view?.webview.postMessage({ type: 'agent-setup:complete', status: pendingStatus, environmentStatus: pendingEnvironmentStatus });
  }

  private _sendChatFontSize() {
    const fontSize = vscode.workspace.getConfiguration('ritemark.chat').get<number>('fontSize', 13);
    this._view?.webview.postMessage({ type: 'settings:chatFontSize', fontSize });
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

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js')
    );
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
    let byAgent = this._runtimeSessions.get(conversationId);
    if (!byAgent) {
      byAgent = new Map<AgentId, RuntimeSession>();
      this._runtimeSessions.set(conversationId, byAgent);
    }

    const session = await runtime.createSession(conversationId, config);
    byAgent.set(agentId, session);
    return session;
  }

  private _findRuntimeSession(
    conversationId: string | undefined,
    agentId: AgentId,
  ): RuntimeSession | undefined {
    return this._runtimeSessions.get(conversationId ?? DEFAULT_CONVERSATION_ID)?.get(agentId);
  }

  /** Tear down one conversation's sessions, leaving every other conversation alone. */
  private _disposeRuntimeSessions(conversationId: string): void {
    const byAgent = this._runtimeSessions.get(conversationId);
    if (!byAgent) return;
    for (const session of byAgent.values()) {
      session.dispose();
    }
    this._runtimeSessions.delete(conversationId);
  }

  private _disposeAllRuntimeSessions(): void {
    for (const conversationId of Array.from(this._runtimeSessions.keys())) {
      this._disposeRuntimeSessions(conversationId);
    }
  }

}
