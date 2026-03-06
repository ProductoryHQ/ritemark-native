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
import { AgentSession, AGENTS, CLAUDE_FALLBACK_MODELS, DEFAULT_MODEL, getSetupStatus, clearSetupCache, setAnthropicKeyAvailable, hasCliOAuth, installClaude, openClaudeLoginTerminal, openAnthropicKeySettings, type AgentId, type AgentProgress, type FileAttachment, type SetupStatus } from '../agent';
import { isEnabled } from '../features';
import { discoverAgents, discoverCommands } from '../agent/discovery';
import { CodexAppServer, getCodexModels } from '../codex';

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
  private _codexThreadId: string | null = null;
  private _codexTurnId: string | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string | undefined,
    private readonly _secrets?: vscode.SecretStorage
  ) {
    // Initialize vector store if workspace is available
    if (_workspacePath) {
      this._initVectorStore(_workspacePath);
    }
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
          await this._handleAgentExecution(message.prompt, message.images, message.skipActiveFile);
          break;

        case 'ai-cancel-agent':
          if (this._agentSession?.isActive) {
            this._agentSession.interrupt();
          }
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

        case 'agent-setup:check':
          clearSetupCache();
          this._sendAgentConfig();
          break;

        case 'agent-setup:dismiss-welcome':
          vscode.workspace.getConfiguration('ritemark.ai').update('hasSeenClaudeWelcome', true, vscode.ConfigurationTarget.Global);
          break;

        // Codex messages
        case 'codex-execute':
          await this._handleCodexExecution(message.prompt, message.model, message.attachments);
          break;

        case 'codex-cancel':
          this._handleCodexCancel();
          break;

        case 'codex-approve':
          this._handleCodexApproval(message.requestId, message.approved);
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
    this._agentSession?.close();
    this._agentSession = null;
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

    // Discover dynamic agents and commands from .claude/ directory
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const discoveredAgents = workspacePath ? discoverAgents(workspacePath) : [];
    const discoveredCommands = workspacePath ? discoverCommands(workspacePath) : [];

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
      setupStatus,
      hasSeenWelcome,
      discoveredAgents,
      discoveredCommands,
      workspacePath: this._workspacePath,
    });
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
    const status = await getSetupStatus();
    if (!status.cliInstalled || !status.authenticated) {
      this._view?.webview.postMessage({
        type: 'agent-result',
        error: 'Claude Code is not fully set up. Please complete the setup wizard first.',
      });
      return;
    }

    if (!this._workspacePath) {
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

      // Only use the API key as fallback when user doesn't have CLI OAuth.
      // CLI OAuth uses Claude.ai billing; API key uses Anthropic API billing.
      // Injecting the API key when CLI OAuth exists would override their billing.
      let anthropicApiKey: string | undefined;
      if (!hasCliOAuth() && this._secrets) {
        anthropicApiKey = await this._secrets.get('anthropic-api-key');
      }

      this._agentSession = new AgentSession({
        workspacePath: this._workspacePath,
        model,
        ...(excludedFolders ? { excludedFolders } : {}),
        ...(anthropicApiKey ? { anthropicApiKey } : {}),
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
          this._view?.webview.postMessage({
            type: 'agent-progress',
            progress,
          });
        },
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
      this._view?.webview.postMessage({
        type: 'agent-result',
        error: errorMessage,
      });
    }
  }

  /**
   * Execute a prompt using the Codex agent (persistent thread).
   */
  private async _handleCodexExecution(prompt: string, model?: string, attachments?: Array<{ kind: string; data: string; mediaType: string }>) {
    if (!isEnabled('codex-integration')) {
      this._view?.webview.postMessage({
        type: 'codex-result',
        error: 'Codex integration is not enabled.',
      });
      return;
    }

    try {
      // Lazy-init the app server
      if (!this._codexAppServer) {
        this._codexAppServer = new CodexAppServer();
        this._setupCodexEventListeners();
        await this._codexAppServer.ensureInitialized();
      }

      // Create thread if needed
      if (!this._codexThreadId) {
        const result = await this._codexAppServer.threadStart({
          cwd: this._workspacePath || null,
          model: model || null,
        });
        this._codexThreadId = result.thread.id;
      }

      // Convert image attachments to data URLs for Codex
      const imageDataUrls = attachments
        ?.filter(a => a.kind === 'image')
        .map(a => `data:${a.mediaType};base64,${a.data}`);

      // Prepend active file context to prompt (same pattern as Claude Code agent)
      const activeFile = this._getActiveFileContext();
      const enrichedPrompt = activeFile
        ? `[Currently editing: ${activeFile.path}]\n\n${prompt}`
        : prompt;

      // Start turn (send user message)
      const turnResult = await this._codexAppServer.turnStart(
        this._codexThreadId,
        enrichedPrompt,
        model,
        imageDataUrls && imageDataUrls.length > 0 ? imageDataUrls : undefined,
      );
      this._codexTurnId = turnResult.turn.id;

      this._view?.webview.postMessage({
        type: 'codex-progress',
        progress: { type: 'init', message: 'Starting...', timestamp: Date.now() },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
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
    this._codexAppServer.sendApprovalResponse(requestId, approved ? 'approved' : 'denied');
  }

  /**
   * Set up event listeners on CodexAppServer to forward events to webview.
   */
  private _setupCodexEventListeners() {
    if (!this._codexAppServer) return;

    // Log ALL notifications for debugging
    this._codexAppServer.on('notification', (notification: { method: string; params: unknown }) => {
      console.log('[Codex] notification:', notification.method, JSON.stringify(notification.params).slice(0, 300));
    });

    // V2 notifications
    this._codexAppServer.on('item/started', (params: { item: { type: string; id: string; text?: string }; threadId: string; turnId: string }) => {
      console.log('[Codex] item/started:', params.item?.type, params.item?.id);
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
      this._view?.webview.postMessage({
        type: 'codex-streaming',
        delta: params.delta,
      });
    });

    this._codexAppServer.on('item/completed', (params: { item: { type: string; id: string; text?: string }; threadId: string; turnId: string }) => {
      const itemType = params.item?.type;
      console.log('[Codex] item/completed:', itemType, params.item?.id);
      // Only show completion for tool items, not userMessage/reasoning/agentMessage
      if (itemType && itemType !== 'userMessage' && itemType !== 'reasoning' && itemType !== 'agentMessage') {
        this._view?.webview.postMessage({
          type: 'codex-progress',
          progress: { type: 'done', message: `Done: ${itemType}`, tool: itemType, timestamp: Date.now() },
        });
      }
    });

    this._codexAppServer.on('turn/completed', (params: { threadId: string; turn: { id: string; status: string; error: unknown } }) => {
      console.log('[Codex] turn/completed:', JSON.stringify(params).slice(0, 200));
      this._codexTurnId = null;
      this._view?.webview.postMessage({
        type: 'codex-result',
        status: params.turn.status,
        error: params.turn.error ? String(params.turn.error) : undefined,
      });
    });

    // Server-initiated requests (approvals are bidirectional RPC)
    this._codexAppServer.on('server-request', (request: { id: string | number; method: string; params: Record<string, unknown> }) => {
      console.log('[Codex] server-request:', request.method, JSON.stringify(request.params).slice(0, 200));
      if (request.method === 'execCommandApproval') {
        const p = request.params;
        this._view?.webview.postMessage({
          type: 'codex-approval',
          approvalType: 'command',
          requestId: request.id,
          command: (p.command as string[]).join(' '),
          workingDir: p.cwd as string,
        });
      } else if (request.method === 'applyPatchApproval') {
        const p = request.params;
        this._view?.webview.postMessage({
          type: 'codex-approval',
          approvalType: 'fileChange',
          requestId: request.id,
          fileChanges: p.fileChanges,
        });
      } else {
        // Unknown server request — auto-deny to not block the agent
        console.log('[Codex] auto-denying unknown server request:', request.method);
        this._codexAppServer?.sendApprovalResponse(request.id, 'denied');
      }
    });

    this._codexAppServer.on('exit', () => {
      this._codexAppServer = null;
      this._codexThreadId = null;
      this._codexTurnId = null;
    });
  }

  /**
   * Handle Claude Code CLI installation request from webview.
   */
  private async _handleClaudeInstall() {
    const result = await installClaude((progress) => {
      this._view?.webview.postMessage({ type: 'agent-setup:progress', progress });
    });

    if (result.success) {
      clearSetupCache();
      const status = await getSetupStatus();
      this._view?.webview.postMessage({ type: 'agent-setup:complete', status });
    } else {
      this._view?.webview.postMessage({ type: 'agent-setup:error', error: result.error || 'Installation failed' });
    }
  }

  /**
   * Handle Claude Code login request from webview.
   * Opens a VS Code terminal with `claude` — the CLI prompts for login on first launch.
   * User authenticates via browser, then clicks "Recheck" in the wizard.
   */
  private _handleClaudeLogin() {
    openClaudeLoginTerminal();
    // Don't send complete — the user needs to finish login in the terminal,
    // then click "Recheck" in the wizard which triggers agent-setup:check.
    this._view?.webview.postMessage({
      type: 'agent-setup:progress',
      progress: { stage: 'login', message: 'Complete login in the terminal, then click Recheck.' },
    });
    // Reset inProgress so the wizard doesn't stay in loading state
    this._view?.webview.postMessage({
      type: 'agent-setup:complete',
      status: { cliInstalled: true, authenticated: false },
    });
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
