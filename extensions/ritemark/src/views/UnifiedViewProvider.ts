/**
 * Unified AI View Provider
 * Merges AI Assistant + RAG into one chat in the left sidebar (Primary Sidebar).
 *
 * Features:
 * - Smart context detection (selection → edit, question → RAG search)
 * - Document search with citations
 * - Text editing (rephrase, find-replace, insert)
 * - Index status footer
 */

import * as vscode from 'vscode';
import {
  executeCommand,
  getAPIKeyManager,
  apiKeyChanged,
  isOnline,
  connectivityChanged,
  type EditorSelection,
  type ConversationMessage
} from '../ai/index';
import { searchDocuments, buildRAGContext, RAGSearchResult } from '../rag/search';
import { VectorStore, getDefaultDbPath } from '../rag/vectorStore';
import {
  AgentSession,
  AGENTS,
  CLAUDE_FALLBACK_MODELS,
  DEFAULT_MODEL,
  getSetupStatus,
  getAgentEnvironmentStatus,
  clearSetupCache,
  setAnthropicKeyAvailable,
  installClaude,
  openClaudeLoginTerminal,
  openAnthropicKeySettings,
  setClaudeLoginInProgress,
  clearClaudePendingReload,
  emitClaudeStatusInvalidated,
  onClaudeStatusInvalidated,
  type AgentId,
  type AgentPlanApprovalRequest,
  type AgentProgress,
  type AgentQuestion,
  type FileAttachment,
  type SetupStatus,
  type AgentEnvironmentStatus,
  traceClaude,
} from '../agent';
import { isEnabled } from '../features';
import { discoverAgents, discoverCommands } from '../agent/discovery';
import { CodexAppServer, CodexAuth, CodexManager, getCodexModels, onCodexStatusInvalidated, emitCodexStatusInvalidated, routeApprovalRequest, traceCodex, type CodexCompatibilityStatus } from '../codex';

type CodexSidebarStatus = {
  enabled: boolean;
  state: 'disabled' | 'checking' | 'broken-install' | 'needs-auth' | 'auth-in-progress' | 'ready';
  version: string | null;
  authMethod: 'apiKey' | 'chatgpt' | null;
  email: string | null;
  plan: string | null;
  error: string | null;
  diagnostics: string[];
  repairCommand: string | null;
  binaryPath: string | null;
  compatibility: CodexCompatibilityStatus | null;
};

const CODEX_BASE_INSTRUCTIONS = [
  'You are running inside Ritemark.',
  'Prefer structured protocol features over free-form text when the protocol supports them.',
].join(' ');

const CODEX_DEVELOPER_INSTRUCTIONS = [
  'When you need the user to choose between options or provide required clarifications before continuing, you must use the request_user_input tool instead of asking in plain assistant text.',
  'Do not present a question as normal chat text if request_user_input can express it.',
  'When you produce a plan, prefer structured plan updates over embedding the whole plan only in prose.',
  'If you already asked for user input via request_user_input, wait for the answer instead of ending the turn with the question rendered as plain text.',
].join(' ');

const CODEX_TURN_REMINDER = [
  'Ritemark runtime reminder:',
  '- If you need the user to answer a question or choose from options, you must call request_user_input.',
  '- Do not ask the question in normal assistant text when request_user_input can represent it.',
  '- If the user explicitly asked for multiple-choice questions, use request_user_input for them.',
  '- After calling request_user_input, wait for the answer instead of finishing the turn with the question in prose.',
].join('\n');

function shouldStartCodexInPlanMode(prompt: string): boolean {
  return /\bplan mode\b/i.test(prompt)
    || /\bwork in plan\b/i.test(prompt)
    || /\benter plan mode\b/i.test(prompt);
}

export class UnifiedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.unifiedView';

  private _view?: vscode.WebviewView;
  private _activeAbortController: AbortController | null = null;
  private _agentSession: AgentSession | null = null;
  private _documentContent: string = '';
  private _currentSelection: EditorSelection = { text: '', isEmpty: true, from: 0, to: 0 };
  private _vectorStore: VectorStore | null = null;

  // Codex state
  private _codexAppServer: CodexAppServer | null = null;
  private _codexAuth: CodexAuth | null = null;
  private _codexThreadId: string | null = null;
  private _codexTurnId: string | null = null;
  private _codexLoginInProgress = false;
  private _codexLoginPoll: ReturnType<typeof setInterval> | null = null;
  private _disposeCodexStatusListener: (() => void) | null = null;
  private _claudeLoginPoll: ReturnType<typeof setInterval> | null = null;
  private _disposeClaudeStatusListener: (() => void) | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string | undefined,
    private readonly _secrets?: vscode.SecretStorage
  ) {
    // Initialize vector store if workspace is available
    if (_workspacePath) {
      this._initVectorStore(_workspacePath);
    }

    this._disposeCodexStatusListener = onCodexStatusInvalidated((event) => {
      void this._handleExternalCodexStatusInvalidation(event.reason);
    });
    this._disposeClaudeStatusListener = onClaudeStatusInvalidated((event) => {
      void this._handleExternalClaudeStatusInvalidation(event.reason);
    });
  }

  private async _initVectorStore(workspacePath: string): Promise<void> {
    try {
      const dbPath = getDefaultDbPath(workspacePath);
      this._vectorStore = new VectorStore(dbPath);
      await this._vectorStore.init();
    } catch (err) {
      console.warn('[UnifiedViewProvider] Vector store init failed:', err);
      this._vectorStore = null;
    }
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
          this._sendIndexStatus();
          this._sendAgentConfig();
          this._sendChatFontSize();
          this._sendActiveFile();
          break;

        case 'ai-configure-key':
          vscode.commands.executeCommand('ritemark.configureApiKey');
          break;

        case 'ai-execute':
          await this._handleExecute(
            message.prompt,
            message.selection,
            message.conversationHistory || []
          );
          break;

        case 'ai-cancel':
          if (this._activeAbortController) {
            this._activeAbortController.abort();
            this._activeAbortController = null;
          }
          break;

        case 'execute-widget':
          this._executeToolInEditor(
            message.toolName,
            message.args as Record<string, unknown>,
            message.selection as EditorSelection
          );
          break;

        case 'reindex':
          vscode.commands.executeCommand('ritemark.reindexDocuments');
          break;

        case 'cancelIndex':
          vscode.commands.executeCommand('ritemark.cancelIndexing');
          break;

        case 'open-source':
          // Open source document at specific location
          this._openSourceDocument(message.filePath, message.page);
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
          // Persist model selection and recreate session with new model
          await vscode.workspace.getConfiguration('ritemark.ai').update(
            'selectedModel',
            message.modelId,
            vscode.ConfigurationTarget.Global
          );
          // Close existing session so next message uses the new model
          if (this._agentSession) {
            this._agentSession.close();
            this._agentSession = null;
          }
          break;

        case 'ai-execute-agent':
          traceClaude('webview->extension', 'ai-execute-agent', {
            promptPreview: message.prompt?.slice(0, 200),
            imageCount: Array.isArray(message.images) ? message.images.length : 0,
            skipActiveFile: message.skipActiveFile === true,
          });
          await this._handleAgentExecution(message.prompt, message.images, message.skipActiveFile);
          break;

        case 'ai-cancel-agent':
          traceClaude('webview->extension', 'ai-cancel-agent');
          if (this._agentSession?.isActive) {
            this._agentSession.interrupt();
          }
          break;

        case 'agent-answer-question':
          traceClaude('webview->extension', 'agent-answer-question', {
            toolUseId: message.toolUseId,
            answerKeys: Object.keys(message.answers || {}),
          });
          this._handleAgentQuestionAnswer(message.toolUseId, message.answers || {});
          break;

        case 'agent-answer-plan':
          traceClaude('webview->extension', 'agent-answer-plan', {
            toolUseId: message.toolUseId,
            approved: message.approved === true,
            hasFeedback: Boolean(message.feedback?.trim()),
          });
          this._handleAgentPlanAnswer(message.toolUseId, message.approved === true, message.feedback);
          break;

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

        case 'agent-setup:check':
          clearSetupCache();
          emitClaudeStatusInvalidated('status-refresh');
          this._sendAgentConfig();
          break;

        case 'agent-setup:dismiss-welcome':
          vscode.workspace.getConfiguration('ritemark.ai').update('hasSeenClaudeWelcome', true, vscode.ConfigurationTarget.Global);
          break;

        // Codex messages
        case 'codex-execute':
          traceCodex('webview->extension', 'codex-execute', {
            promptPreview: typeof message.prompt === 'string' ? message.prompt.slice(0, 200) : '',
            model: message.model,
            mode: message.mode,
            attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
          });
          await this._handleCodexExecution(message.prompt, message.model, message.attachments, message.mode);
          break;

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

        case 'codex-cancel':
          traceCodex('webview->extension', 'codex-cancel');
          this._handleCodexCancel();
          break;

        case 'codex-approve':
          traceCodex('webview->extension', 'codex-approve', {
            requestId: message.requestId,
            approved: message.approved,
          });
          this._handleCodexApproval(message.requestId, message.approved);
          break;

        case 'codex-answer-question':
          traceCodex('webview->extension', 'codex-answer-question', {
            requestId: message.requestId,
            answers: message.answers,
          });
          this._handleCodexQuestionAnswer(
            message.requestId,
            message.answers && typeof message.answers === 'object' ? message.answers : {}
          );
          break;

        case 'conversation:reset':
          traceCodex('webview->extension', 'conversation:reset');
          this._resetProviderSessions();
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
      // Reset Codex thread when approval/sandbox settings change so new values take effect
      if (e.affectsConfiguration('ritemark.codex.approvalPolicy') || e.affectsConfiguration('ritemark.codex.sandboxMode')) {
        this._codexThreadId = null;
      }
    });

    // Track active tab changes to update context chip in webview
    vscode.window.tabGroups.onDidChangeTabs(() => {
      this._sendActiveFile();
    });
  }

  /**
   * Send current selection and document content from active editor
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

  /**
   * Update index status in the UI (called by indexer when docs change)
   */
  public updateIndexStatus() {
    this._sendIndexStatus();
  }

  /**
   * Send indexing progress to webview (called during indexing)
   */
  public sendIndexProgress(processed: number, total: number, current: string) {
    this._view?.webview.postMessage({
      type: 'index-progress',
      processed,
      total,
      current,
    });
  }

  /**
   * Signal indexing completed to webview
   */
  public async sendIndexDone() {
    this._view?.webview.postMessage({ type: 'index-done' });
    // Reload vector store from disk to get fresh stats
    if (this._vectorStore) {
      await this._vectorStore.init();
    }
    this._sendIndexStatus();
  }

  public show() {
    if (this._view) {
      this._view.show(true);
    }
  }

  /**
   * Clear chat history and start fresh conversation
   */
  public clearChat() {
    this._resetProviderSessions();
    this._view?.webview.postMessage({ type: 'clear-chat' });
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
    this._agentSession?.close();
    this._vectorStore?.close();
    this._codexAppServer?.dispose();
    this._stopCodexLoginPolling();
    this._stopClaudeLoginPolling();
    this._disposeCodexStatusListener?.();
    this._disposeClaudeStatusListener?.();
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
   * Send agent configuration to webview (selected agent, available agents, feature flag state)
   */
  private async _sendAgentConfig() {
    const agenticEnabled = isEnabled('agentic-assistant');
    const codexEnabled = isEnabled('codex-integration');
    const config = vscode.workspace.getConfiguration('ritemark.ai');
    const selectedAgent = config.get<string>('selectedAgent', 'ritemark-agent');
    const selectedModel = config.get<string>('selectedModel', DEFAULT_MODEL);

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
    const codexStatus = await this._getCodexSidebarStatus();

    // Filter agents based on feature flags
    const visibleAgents = Object.values(AGENTS).filter(a => {
      if (a.id === 'codex') return codexEnabled;
      return true;
    });

    this._view?.webview.postMessage({
      type: 'agent:config',
      agenticEnabled,
      codexEnabled,
      selectedAgent,
      selectedModel,
      agents: visibleAgents,
      models: CLAUDE_FALLBACK_MODELS,
      codexModels: getCodexModels(),
      codexStatus,
      setupStatus,
      environmentStatus,
      hasSeenWelcome,
      discoveredAgents,
      discoveredCommands,
      workspacePath: this._workspacePath,
    });
  }

  private async _handleExternalCodexStatusInvalidation(
    reason: 'login-started' | 'login-finished' | 'logout' | 'repair-started' | 'repair-finished' | 'status-refresh'
  ): Promise<void> {
    if (!isEnabled('codex-integration')) {
      return;
    }

    if (reason === 'login-started') {
      this._codexLoginInProgress = true;
      this._startCodexLoginPolling();
    } else if (reason === 'logout') {
      this._codexLoginInProgress = false;
      this._stopCodexLoginPolling();
      this._resetCodexSessionState();
    } else if (reason === 'login-finished') {
      this._codexLoginInProgress = false;
      this._stopCodexLoginPolling();
    }

    await this._sendCodexSidebarStatus();
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

    await this._sendAgentConfig();
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

  private _ensureCodexRuntime(): CodexAppServer {
    if (this._codexAppServer) {
      return this._codexAppServer;
    }

    this._codexAppServer = new CodexAppServer({ trace: traceCodex });
    this._codexAuth = new CodexAuth(this._codexAppServer);
    traceCodex('runtime', 'created codex app-server runtime');

    this._codexAuth.on('statusChanged', (status) => {
      if (!status.authenticated) {
        this._resetCodexSessionState();
      }
      void this._sendCodexSidebarStatus();
    });

    this._codexAuth.on('loginComplete', (event: { success: boolean }) => {
      this._codexLoginInProgress = false;
      this._stopCodexLoginPolling();
      if (event.success) {
        emitCodexStatusInvalidated('login-finished');
      }
      void this._sendCodexSidebarStatus();
    });

    this._setupCodexEventListeners();
    return this._codexAppServer;
  }

  private _disposeCodexRuntime(): void {
    traceCodex('runtime', 'disposing codex runtime', {
      hadThreadId: this._codexThreadId,
      hadTurnId: this._codexTurnId,
    });
    this._codexAppServer?.dispose();
    this._codexAppServer = null;
    this._codexAuth = null;
    this._codexLoginInProgress = false;
    this._stopCodexLoginPolling();
    this._resetCodexSessionState();
  }

  private _resetProviderSessions(): void {
    traceCodex('runtime', 'reset provider sessions');
    this._agentSession?.close();
    this._agentSession = null;
    this._disposeCodexRuntime();
  }

  private _resetCodexSessionState(): void {
    traceCodex('runtime', 'reset session state', {
      threadId: this._codexThreadId,
      turnId: this._codexTurnId,
    });
    this._codexThreadId = null;
    this._codexTurnId = null;
  }

  private _stopCodexLoginPolling(): void {
    if (this._codexLoginPoll) {
      clearInterval(this._codexLoginPoll);
      this._codexLoginPoll = null;
    }
  }

  private _startCodexLoginPolling(): void {
    this._stopCodexLoginPolling();

    let attempts = 0;
    this._codexLoginPoll = setInterval(() => {
      attempts += 1;

      void (async () => {
        const status = await this._getCodexSidebarStatus();
        this._postCodexSidebarStatus(status);

        if (status.state === 'ready') {
          this._codexLoginInProgress = false;
          this._stopCodexLoginPolling();
          return;
        }

        if (attempts >= 60) {
          this._codexLoginInProgress = false;
          this._stopCodexLoginPolling();
          await this._sendCodexSidebarStatus();
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
    this._postCodexSidebarStatus(await this._getCodexSidebarStatus());
  }

  private async _getCodexSidebarStatus(): Promise<CodexSidebarStatus> {
    if (!isEnabled('codex-integration')) {
      return {
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
    }

    const codexManager = new CodexManager();
    const binaryStatus = await codexManager.getBinaryStatus();

    if (!binaryStatus.available || !binaryStatus.runnable) {
      return {
        enabled: true,
        state: 'broken-install',
        version: binaryStatus.version,
        authMethod: null,
        email: null,
        plan: null,
        error: binaryStatus.error ?? 'Codex CLI is not available.',
        diagnostics: binaryStatus.diagnostics,
        repairCommand: binaryStatus.repairCommand,
        binaryPath: binaryStatus.binaryPath,
        compatibility: binaryStatus.compatibility,
      };
    }

    try {
      this._ensureCodexRuntime();
      const authStatus = await this._codexAuth!.getStatus();
      const authenticated = authStatus.authenticated;

      return {
        enabled: true,
        state: authenticated
          ? 'ready'
          : this._codexLoginInProgress
            ? 'auth-in-progress'
            : 'needs-auth',
        version: binaryStatus.version,
        authMethod: authStatus.authMethod,
        email: authStatus.email,
        plan: authStatus.plan,
        error: null,
        diagnostics: binaryStatus.diagnostics,
        repairCommand: binaryStatus.repairCommand,
        binaryPath: binaryStatus.binaryPath,
        compatibility: binaryStatus.compatibility,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        enabled: true,
        state: 'broken-install',
        version: binaryStatus.version,
        authMethod: null,
        email: null,
        plan: null,
        error: message,
        diagnostics: binaryStatus.diagnostics,
        repairCommand: binaryStatus.repairCommand,
        binaryPath: binaryStatus.binaryPath,
        compatibility: binaryStatus.compatibility,
      };
    }
  }

  private async _handleCodexLogin(): Promise<void> {
    try {
      const status = await this._getCodexSidebarStatus();
      if (status.state === 'broken-install') {
        this._postCodexSidebarStatus(status);
        return;
      }

      this._ensureCodexRuntime();
      this._codexLoginInProgress = true;
      this._postCodexSidebarStatus({
        ...status,
        state: 'auth-in-progress',
        error: null,
      });
      this._startCodexLoginPolling();

      const login = await this._codexAuth!.startLogin();
      await vscode.env.openExternal(vscode.Uri.parse(login.authUrl));
      emitCodexStatusInvalidated('login-started');
    } catch (error) {
      this._codexLoginInProgress = false;
      this._stopCodexLoginPolling();
      const message = error instanceof Error ? error.message : String(error);
      this._postCodexSidebarStatus({
        enabled: true,
        state: 'needs-auth',
        version: null,
        authMethod: null,
        email: null,
        plan: null,
        error: message,
        diagnostics: [],
        repairCommand: null,
        binaryPath: null,
        compatibility: null,
      });
    }
  }

  private async _handleCodexLogout(): Promise<void> {
    try {
      const status = await this._getCodexSidebarStatus();
      if (status.state === 'broken-install') {
        this._postCodexSidebarStatus(status);
        return;
      }

      this._ensureCodexRuntime();
      await this._codexAuth!.logout();
      this._codexLoginInProgress = false;
      this._stopCodexLoginPolling();
      this._resetCodexSessionState();
      emitCodexStatusInvalidated('logout');
    } catch (error) {
      vscode.window.showErrorMessage(
        `Codex sign-out failed: ${error instanceof Error ? error.message : String(error)}`
      );
      await this._sendCodexSidebarStatus();
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
   * Execute a prompt using the Claude Code agent (persistent session).
   * Reuses the same process across turns so the agent retains context.
   */
  private async _handleAgentExecution(prompt: string, images?: Array<{ id: string; data: string; mediaType: string }>, skipActiveFile?: boolean) {
    if (!isEnabled('agentic-assistant')) {
      this._view?.webview.postMessage({
        type: 'agent-result',
        error: 'Agentic assistant is not enabled. Enable it in Settings > Ritemark Features.',
      });
      return;
    }

    // Guard: check if Claude Code is set up
    const status = await getSetupStatus({ refresh: true });
    if (status.state !== 'ready') {
      this._view?.webview.postMessage({
        type: 'agent-result',
        error: status.error
          ?? (status.state === 'broken-install'
            ? 'Claude is installed but not ready. Repair it first.'
            : status.state === 'needs-auth' || status.state === 'auth-in-progress'
              ? 'Claude is not signed in yet. Finish Claude.ai sign-in first.'
              : 'Claude is not installed yet. Complete setup first.'),
      });
      await this._sendAgentConfig();
      return;
    }

    if (!this._workspacePath) {
      traceClaude('execution', 'blocked: no workspace');
      this._view?.webview.postMessage({
        type: 'agent-result',
        error: 'No workspace folder open. Please open a folder first.',
      });
      return;
    }

    // Create or reuse persistent session
    if (!this._agentSession) {
      const config = vscode.workspace.getConfiguration('ritemark.ai');
      const excludedFolders = config.get<string[]>('excludedFolders');
      const model = config.get<string>('selectedModel', DEFAULT_MODEL);

      let anthropicApiKey: string | undefined;
      if (status.authMethod === 'api-key' && this._secrets) {
        anthropicApiKey = await this._secrets.get('anthropic-api-key');
      }

      this._agentSession = new AgentSession({
        workspacePath: this._workspacePath,
        model,
        pathToClaudeCodeExecutable: status.binaryPath,
        ...(excludedFolders ? { excludedFolders } : {}),
        ...(anthropicApiKey ? { anthropicApiKey } : {}),
      });
      traceClaude('execution', 'created AgentSession', {
        model,
        workspacePath: this._workspacePath,
      });

      // When SDK reports available models, update the webview dropdown
      this._agentSession.onModelsDiscovered = (models) => {
        this._view?.webview.postMessage({
          type: 'agent:models-update',
          models,
        });
      };
    }

    // Get active file context — works for both TextEditor and custom editors (Ritemark)
    // Skip if user explicitly dismissed the context chip in the UI
    const activeFile = skipActiveFile ? undefined : this._getActiveFileContext();

    // Read agent timeout from settings (default 15 min)
    const agentTimeout = vscode.workspace.getConfiguration('ritemark.ai').get<number>('agentTimeout', 15);

    try {
      const result = await this._agentSession.sendMessage({
        prompt,
        attachments: images as FileAttachment[] | undefined,
        activeFile,
        timeoutMinutes: agentTimeout,
        onProgress: (progress: AgentProgress) => {
          traceClaude('bridge', 'agent-progress', {
            type: progress.type,
            message: progress.message,
            tool: progress.tool ?? null,
          });
          this._view?.webview.postMessage({
            type: 'agent-progress',
            progress,
          });
        },
        onQuestion: (question: AgentQuestion) => {
          traceClaude('bridge', 'agent-question', {
            toolUseId: question.toolUseId,
            questionHeaders: question.questions.map((item) => item.header),
          });
          this._view?.webview.postMessage({
            type: 'agent-question',
            question,
          });
        },
        onPlanApproval: (request: AgentPlanApprovalRequest) => {
          traceClaude('bridge', 'agent-plan-approval', request);
          this._view?.webview.postMessage({
            type: 'agent-plan-approval',
            request,
          });
        },
      });

      traceClaude('bridge', 'agent-result', {
        hasText: Boolean(result.text),
        filesModified: result.filesModified,
        error: result.error ?? null,
      });
      this._view?.webview.postMessage({
        type: 'agent-result',
        text: result.text,
        filesModified: result.filesModified,
        metrics: result.metrics,
        error: result.error,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      traceClaude('bridge', 'agent-result error', { error: errorMessage });
      this._view?.webview.postMessage({
        type: 'agent-result',
        error: errorMessage,
      });
    }
  }

  private _handleAgentQuestionAnswer(toolUseId: string, answers: Record<string, string>) {
    if (!this._agentSession) {
      traceClaude('bridge', 'agent-answer-question without session', { toolUseId });
      return;
    }

    const answered = this._agentSession.answerQuestion(toolUseId, answers);
    if (!answered) {
      traceClaude('bridge', 'agent-answer-question lost state', { toolUseId });
      this._view?.webview.postMessage({
        type: 'agent-result',
        error: 'Claude question state was lost. Please retry your last message.',
      });
    }
  }

  private _handleAgentPlanAnswer(toolUseId: string, approved: boolean, feedback?: string) {
    if (!this._agentSession) {
      traceClaude('bridge', 'agent-answer-plan without session', { toolUseId });
      return;
    }

    const answered = this._agentSession.answerPlanApproval(toolUseId, approved, feedback);
    if (!answered) {
      traceClaude('bridge', 'agent-answer-plan lost state', { toolUseId, approved });
      this._view?.webview.postMessage({
        type: 'agent-result',
        error: 'Claude plan approval state was lost. Please retry your last message.',
      });
    }
  }

  /**
   * Execute a prompt using the Codex agent (persistent thread).
   */
  private async _handleCodexExecution(
    prompt: string,
    model?: string,
    attachments?: Array<{ kind: string; data: string; mediaType: string }>,
    mode?: 'plan' | 'execute'
  ) {
    if (!isEnabled('codex-integration')) {
      this._view?.webview.postMessage({
        type: 'codex-result',
        error: 'Codex integration is not enabled.',
      });
      return;
    }

    try {
      const status = await this._getCodexSidebarStatus();
      traceCodex('execution', 'status before execute', status);
      this._postCodexSidebarStatus(status);
      if (status.state === 'broken-install') {
        this._view?.webview.postMessage({
          type: 'codex-result',
          error: status.error ?? 'Codex CLI is not ready.',
        });
        return;
      }
      if (status.state === 'needs-auth' || status.state === 'auth-in-progress') {
        this._view?.webview.postMessage({
          type: 'codex-result',
          error: status.state === 'auth-in-progress'
            ? 'Finish ChatGPT sign-in first.'
            : 'Sign in with ChatGPT before using Codex.',
        });
        return;
      }

      const appServer = this._ensureCodexRuntime();
      await appServer.ensureInitialized();

      // Create thread if needed
      if (!this._codexThreadId) {
        const codexConfig = vscode.workspace.getConfiguration('ritemark.codex');
        const approvalPolicy = codexConfig.get<string>('approvalPolicy', 'untrusted') as 'untrusted' | 'on-request' | 'on-failure' | 'never';
        const sandbox = codexConfig.get<string>('sandboxMode', 'workspace-write') as 'read-only' | 'workspace-write' | 'danger-full-access';
        const result = await appServer.threadStart({
          cwd: this._workspacePath || null,
          model: model || null,
          approvalPolicy,
          sandbox,
          baseInstructions: CODEX_BASE_INSTRUCTIONS,
          developerInstructions: CODEX_DEVELOPER_INSTRUCTIONS,
        });
        this._codexThreadId = result.thread.id;
        traceCodex('execution', 'thread started', {
          threadId: result.thread.id,
          model: result.model,
          approvalPolicy,
          sandbox,
        });
      }

      // Convert image attachments to data URLs for Codex
      const imageDataUrls = attachments
        ?.filter(a => a.kind === 'image')
        .map(a => `data:${a.mediaType};base64,${a.data}`);

      const resolvedModel = model || getCodexModels()[0]?.id || 'gpt-5.3-codex';
      const shouldUsePlanMode = mode === 'plan' || (mode !== 'execute' && shouldStartCodexInPlanMode(prompt));
      const collaborationMode = shouldUsePlanMode
        ? {
            mode: 'plan' as const,
            settings: {
              model: resolvedModel,
              reasoning_effort: null,
              developer_instructions: CODEX_DEVELOPER_INSTRUCTIONS,
            },
          }
        : null;
      traceCodex('execution', 'prepared turn start', {
        threadId: this._codexThreadId,
        model: resolvedModel,
        mode: mode ?? (shouldUsePlanMode ? 'plan' : 'execute'),
        collaborationMode,
        hasImages: Boolean(imageDataUrls && imageDataUrls.length > 0),
      });

      // Prepend active file context to prompt (same pattern as Claude Code agent)
      const activeFile = this._getActiveFileContext();
      const promptBody = activeFile
        ? `[Currently editing: ${activeFile.path}]\n\n${prompt}`
        : prompt;
      const enrichedPrompt = `${CODEX_TURN_REMINDER}\n\n${promptBody}`;

      // Start turn (send user message)
      const turnResult = await appServer.turnStart(
        this._codexThreadId,
        enrichedPrompt,
        resolvedModel,
        imageDataUrls && imageDataUrls.length > 0 ? imageDataUrls : undefined,
        collaborationMode,
      );
      this._codexTurnId = turnResult.turn.id;
      traceCodex('execution', 'turn start acknowledged', {
        threadId: this._codexThreadId,
        turnId: turnResult.turn.id,
        status: turnResult.turn.status,
      });

      this._view?.webview.postMessage({
        type: 'codex-progress',
        progress: { type: 'init', message: 'Starting...', timestamp: Date.now() },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      traceCodex('execution', 'turn start failed', { error: errorMessage });
      this._view?.webview.postMessage({
        type: 'codex-result',
        error: errorMessage,
      });
    }
  }

  /**
   * Cancel current Codex turn.
   */
  private _handleCodexCancel() {
    if (this._codexAppServer && this._codexThreadId && this._codexTurnId) {
      this._codexAppServer.turnInterrupt(this._codexThreadId, this._codexTurnId).catch(() => {});
    }
  }

  /**
   * Handle approval/rejection from webview for Codex tool execution.
   * Approvals are bidirectional: the server sends a JSON-RPC request with an id,
   * and we respond using that same id.
   */
  private _handleCodexApproval(requestId: string | number, approved: boolean) {
    if (!this._codexAppServer) return;
    this._codexAppServer.sendApprovalResponse(requestId, approved ? 'accept' : 'decline');
  }

  private _handleCodexQuestionAnswer(requestId: string | number, answers: Record<string, { answers: string[] }>) {
    if (!this._codexAppServer) return;
    this._codexAppServer.sendToolRequestUserInputResponse(requestId, answers);
  }

  /**
   * Set up event listeners on CodexAppServer to forward events to webview.
   */
  private _setupCodexEventListeners() {
    if (!this._codexAppServer) return;

    // V2 notifications
    this._codexAppServer.on('turn/started', (params: { threadId: string; turn: { id: string }; collaborationModeKind?: 'plan' | 'default' }) => {
      traceCodex('event', 'turn/started', params);
      if (params.collaborationModeKind) {
        console.log(`[codex] turn started in ${params.collaborationModeKind} mode`);
      }
    });

    this._codexAppServer.on('item/started', (params: { item: { type: string; id: string; text?: string }; threadId: string; turnId: string }) => {
      traceCodex('event', 'item/started', params);
      // Only show activity for actual tool use, not userMessage/reasoning
      const itemType = params.item?.type;
      if (itemType && itemType !== 'userMessage' && itemType !== 'reasoning') {
        const label = itemType === 'agentMessage' ? 'Thinking...' : `Running: ${itemType}`;
        this._view?.webview.postMessage({
          type: 'codex-progress',
          progress: { type: 'tool_use', message: label, tool: itemType, timestamp: Date.now() },
        });
      }
    });

    this._codexAppServer.on('item/agentMessage/delta', (params: { delta: string }) => {
      traceCodex('event', 'item/agentMessage/delta', {
        preview: params.delta.slice(0, 200),
      });
      this._view?.webview.postMessage({
        type: 'codex-streaming',
        delta: params.delta,
      });
    });

    this._codexAppServer.on('turn/plan/updated', (params: {
      threadId: string;
      turnId: string;
      explanation: string | null;
      plan: Array<{ step: string; status: 'pending' | 'inProgress' | 'completed' }>;
    }) => {
      traceCodex('event', 'turn/plan/updated', params);
      this._view?.webview.postMessage({
        type: 'codex-plan-update',
        explanation: params.explanation,
        plan: params.plan,
      });
    });

    this._codexAppServer.on('item/plan/delta', (params: { delta: string }) => {
      traceCodex('event', 'item/plan/delta', {
        preview: params.delta.slice(0, 200),
      });
      this._view?.webview.postMessage({
        type: 'codex-plan-text-delta',
        delta: params.delta,
      });
    });

    this._codexAppServer.on('item/completed', (params: { item: { type: string; id: string; text?: string }; threadId: string; turnId: string }) => {
      traceCodex('event', 'item/completed', params);
      const itemType = params.item?.type;
      // Only show completion for tool items, not userMessage/reasoning/agentMessage
      if (itemType && itemType !== 'userMessage' && itemType !== 'reasoning' && itemType !== 'agentMessage') {
        this._view?.webview.postMessage({
          type: 'codex-progress',
          progress: { type: 'done', message: `Done: ${itemType}`, tool: itemType, timestamp: Date.now() },
        });
      }
    });

    this._codexAppServer.on('turn/completed', (params: { threadId: string; turn: { id: string; status: string; error: unknown } }) => {
      traceCodex('event', 'turn/completed', params);
      this._codexTurnId = null;
      this._view?.webview.postMessage({
        type: 'codex-result',
        status: params.turn.status,
        error: params.turn.error ? String(params.turn.error) : undefined,
      });
    });

    // Server-initiated requests (approvals are bidirectional RPC)
    this._codexAppServer.on('server-request', (request: { id: string | number; method: string; params: Record<string, unknown> }) => {
      traceCodex('event', 'server-request', {
        requestId: request.id,
        method: request.method,
        params: request.params,
      });
      const routed = routeApprovalRequest(request);
      if (request.method === 'item/tool/requestUserInput') {
        console.log('[codex] request_user_input received');
        const params = request.params;
        const questions = Array.isArray(params.questions)
          ? params.questions
              .filter((question): question is {
                id?: unknown;
                header?: unknown;
                question?: unknown;
                options?: unknown;
              } => Boolean(question) && typeof question === 'object')
              .map((question) => ({
                id: typeof question.id === 'string' && question.id.trim()
                  ? question.id.trim()
                  : crypto.randomUUID(),
                header: typeof question.header === 'string' && question.header.trim()
                  ? question.header.trim()
                  : 'Input',
                question: typeof question.question === 'string' ? question.question : '',
                options: Array.isArray(question.options)
                  ? question.options.flatMap((option: unknown) => {
                      if (!option || typeof option !== 'object') {
                        return [];
                      }
                      const normalizedOption = option as { label?: unknown; description?: unknown };
                      const label = typeof normalizedOption.label === 'string' ? normalizedOption.label.trim() : '';
                      if (!label) {
                        return [];
                      }
                      return [{
                        label,
                        description: typeof normalizedOption.description === 'string' ? normalizedOption.description.trim() : '',
                      }];
                    })
                  : [],
                multiSelect: false,
              }))
              .filter((question) => question.question.trim().length > 0)
          : [];

        this._view?.webview.postMessage({
          type: 'codex-question',
          requestId: request.id,
          questions,
        });
      } else if (routed.type === 'command') {
        this._view?.webview.postMessage({
          type: 'codex-approval',
          approvalType: 'command',
          requestId: routed.requestId,
          command: routed.command,
          workingDir: routed.workingDir,
        });
      } else if (routed.type === 'fileChange') {
        this._view?.webview.postMessage({
          type: 'codex-approval',
          approvalType: 'fileChange',
          requestId: routed.requestId,
          fileChanges: routed.fileChanges,
        });
      } else {
        // Unknown server request — decline to be safe (log for debugging)
        console.warn(`[codex] → UNKNOWN method "${routed.method}" — declining request ${routed.requestId}`);
        this._codexAppServer?.sendApprovalResponse(routed.requestId, 'decline');
      }
    });

    this._codexAppServer.on('exit', () => {
      traceCodex('event', 'app-server exit');
      this._codexAppServer = null;
      this._codexAuth = null;
      this._codexThreadId = null;
      this._codexTurnId = null;
      this._codexLoginInProgress = false;
      this._stopCodexLoginPolling();
      void this._sendCodexSidebarStatus();
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

    setClaudeLoginInProgress(true);
    this._startClaudeLoginPolling();
    emitClaudeStatusInvalidated('login-started');
    openClaudeLoginTerminal(status.binaryPath);

    this._view?.webview.postMessage({
      type: 'agent-setup:progress',
      progress: {
        stage: 'login',
        message: 'Finish Claude.ai sign-in in the terminal and browser. Ritemark will update automatically.',
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

  private async _sendIndexStatus() {
    if (!this._vectorStore) {
      this._view?.webview.postMessage({
        type: 'index-status',
        totalDocs: 0,
        totalChunks: 0,
        sources: []
      });
      return;
    }

    try {
      const stats = await this._vectorStore.getStats();
      this._view?.webview.postMessage({
        type: 'index-status',
        totalDocs: stats.totalSources,
        totalChunks: stats.totalChunks,
        sources: stats.sources
      });
    } catch {
      this._view?.webview.postMessage({
        type: 'index-status',
        totalDocs: 0,
        totalChunks: 0,
        sources: []
      });
    }
  }

  /**
   * Smart context detection + execution.
   * If text is selected → editing mode.
   * If question about docs → RAG mode.
   */
  private async _handleExecute(
    prompt: string,
    selection: EditorSelection,
    conversationHistory: ConversationMessage[]
  ) {
    this._activeAbortController = new AbortController();
    const abortSignal = this._activeAbortController.signal;

    const activeSelection = selection.isEmpty ? this._currentSelection : selection;
    const hasSelection = !activeSelection.isEmpty && activeSelection.text.length > 0;

    try {
      // Determine mode: RAG or Edit
      let ragContext = '';
      let ragResults: RAGSearchResult[] = [];

      if (!hasSelection && this._vectorStore) {
        // No text selected → try RAG search
        ragResults = await searchDocuments(this._vectorStore, prompt, { topK: 5 });
        if (ragResults.length > 0) {
          ragContext = buildRAGContext(ragResults);

          // Send RAG results to webview for citation display
          this._view?.webview.postMessage({
            type: 'rag-results',
            results: ragResults.map(r => ({
              source: r.source,
              page: r.page,
              section: r.section,
              score: r.score,
              citation: r.citation,
              snippet: r.content.substring(0, 150) + '...'
            }))
          });
        }
      }

      // Build enhanced prompt with RAG context
      const enhancedPrompt = ragContext
        ? `Context from workspace documents:\n${ragContext}\n\nUser question: ${prompt}`
        : prompt;

      const result = await executeCommand(
        enhancedPrompt,
        this._documentContent,
        activeSelection,
        conversationHistory,
        (content: string) => {
          this._view?.webview.postMessage({ type: 'ai-streaming', content });
        },
        abortSignal
      );

      this._activeAbortController = null;

      if (result.success) {
        if (result.toolCall) {
          this._view?.webview.postMessage({
            type: 'ai-widget',
            toolName: result.toolCall.name,
            args: result.toolCall.arguments,
            selection: activeSelection
          });
        } else {
          this._view?.webview.postMessage({
            type: 'ai-result',
            success: true,
            message: result.message,
            hasRagContext: ragResults.length > 0
          });
        }
      } else {
        if (result.error === '__USER_STOPPED__') {
          this._view?.webview.postMessage({ type: 'ai-stopped' });
        } else {
          this._view?.webview.postMessage({ type: 'ai-error', error: result.error });
        }
      }
    } catch (error) {
      this._activeAbortController = null;
      this._view?.webview.postMessage({
        type: 'ai-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private _executeToolInEditor(
    toolName: string,
    args: Record<string, unknown>,
    selection: EditorSelection
  ) {
    vscode.commands.executeCommand('ritemark.executeAITool', { toolName, args, selection });
  }

  private _openSourceDocument(filePath: string, page?: number) {
    const uri = vscode.Uri.file(filePath);
    vscode.commands.executeCommand('vscode.open', uri);
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
}
