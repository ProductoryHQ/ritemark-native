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

export class UnifiedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.unifiedView';

  private _view?: vscode.WebviewView;
  private _activeAbortController: AbortController | null = null;
  private _documentContent: string = '';
  private _currentSelection: EditorSelection = { text: '', isEmpty: true, from: 0, to: 0 };
  private _vectorStore: VectorStore | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string | undefined
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
  }

  /**
   * Send current selection and document content from active editor
   */
  public sendSelection(selection: EditorSelection, documentContent: string) {
    this._currentSelection = selection;
    this._documentContent = documentContent;
    this._view?.webview.postMessage({ type: 'selection-update', selection });
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
  public sendIndexDone() {
    this._view?.webview.postMessage({ type: 'index-done' });
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
    this._view?.webview.postMessage({ type: 'clear-chat' });
  }

  public dispose() {
    this._vectorStore?.close();
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

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>RiteMark AI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 0 !important;
      overflow: hidden;
    }
    .no-key {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
    }
    .no-key h3 { font-size: 13px; margin-bottom: 8px; }
    .no-key p { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 16px; }
    .btn {
      padding: 8px 16px;
      font-size: 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground); }
    .offline-banner {
      background: var(--vscode-inputValidation-warningBackground, #5a4a00);
      border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
      border-radius: 4px;
      padding: 8px 12px;
      margin: 8px 12px;
      font-size: 11px;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
    }
    .message {
      margin-bottom: 12px;
      font-size: 12px;
      line-height: 1.5;
    }
    .message.user {
      background: var(--vscode-input-background);
      padding: 8px 10px;
      border-radius: 4px;
    }
    .message.assistant { color: var(--vscode-foreground); }
    .message.assistant code {
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
    }
    .message.assistant pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }
    .message.assistant pre code { background: none; padding: 0; }
    .message.assistant strong { font-weight: 600; }
    .message.error { color: var(--vscode-errorForeground); }
    .streaming .cursor { animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .selection-info {
      padding: 6px 12px;
      background: var(--vscode-inputValidation-infoBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .selection-info .label { color: var(--vscode-descriptionForeground); }
    .selection-info .text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Citations */
    .citations {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .citation-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 10px;
      font-size: 10px;
      cursor: pointer;
      text-decoration: none;
    }
    .citation-chip:hover {
      opacity: 0.8;
    }
    /* Widget inline actions */
    .widget-actions {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }
    .widget-actions button {
      padding: 4px 12px;
      font-size: 11px;
      border-radius: 2px;
      cursor: pointer;
      border: none;
    }
    .btn-apply {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-apply:hover { background: var(--vscode-button-hoverBackground); }
    .btn-discard {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-discard:hover { background: var(--vscode-button-secondaryHoverBackground); }
    /* Preview block for edits */
    .edit-preview {
      margin-top: 8px;
      padding: 8px;
      border-radius: 4px;
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-focusBorder);
      font-size: 12px;
      white-space: pre-wrap;
    }
    /* Input area */
    .input-area {
      padding: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .input-row {
      display: flex;
      gap: 8px;
    }
    .input-row input {
      flex: 1;
      padding: 6px 10px;
      font-size: 12px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      outline: none;
    }
    .input-row input:focus { border-color: var(--vscode-focusBorder); }
    .input-row button {
      padding: 6px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .input-row button:hover { background: var(--vscode-button-hoverBackground); }
    .input-row button:disabled { opacity: 0.5; cursor: default; }
    .input-row button.stop {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    /* Index status footer */
    .index-footer {
      padding: 6px 12px;
      border-top: 1px solid var(--vscode-panel-border);
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .index-footer button {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      font-size: 10px;
      padding: 2px 4px;
    }
    .index-footer button:hover { text-decoration: underline; }
    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
    }
    .empty-state ul { list-style: none; margin-top: 12px; }
    .empty-state li { margin: 4px 0; font-size: 11px; }
  </style>
</head>
<body style="padding: 0 !important;">

  <div id="no-key" class="no-key" style="display: none;">
    <h3>OpenAI API Key Required</h3>
    <p>Add your API key to enable AI features</p>
    <button class="btn" id="configure-key-btn">Configure API Key</button>
  </div>

  <div id="offline-banner" class="offline-banner" style="display: none;">
    <strong>Offline</strong> - AI features require internet connection
  </div>

  <div id="chat-container" style="display: none; flex: 1; flex-direction: column; overflow: hidden;">
    <div id="selection-info" class="selection-info" style="display: none;">
      <span class="label">Selected:</span>
      <span class="text" id="selection-text"></span>
    </div>

    <div id="messages" class="messages">
      <div class="empty-state">
        <p>Ask about your documents or edit text</p>
        <ul>
          <li>"What does the contract say about deadlines?"</li>
          <li>"Summarize report.pdf"</li>
          <li>"Make this paragraph shorter"</li>
        </ul>
      </div>
    </div>

    <div class="input-area">
      <div class="input-row">
        <input type="text" id="input" placeholder="Ask anything..." />
        <button id="send-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
        <button id="stop-btn" class="stop" style="display: none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12"></rect>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div id="index-footer" class="index-footer">
    <span id="index-stats"></span>
    <button id="reindex-btn">Re-index</button>
    <button id="cancel-index-btn" style="display:none; color: var(--vscode-errorForeground);">Cancel</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let hasApiKey = false;
    let isLoading = false;
    let online = true;
    let messages = [];
    let conversationHistory = [];
    let currentSelection = { text: '', isEmpty: true, from: 0, to: 0 };
    let streamingContent = '';
    let indexStatus = { totalDocs: 0, totalChunks: 0 };
    let indexingInProgress = false;
    let activeWidget = null;
    let ragResults = [];

    const noKeyEl = document.getElementById('no-key');
    const offlineBanner = document.getElementById('offline-banner');
    const chatContainer = document.getElementById('chat-container');
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const selectionInfo = document.getElementById('selection-info');
    const selectionText = document.getElementById('selection-text');
    const indexStats = document.getElementById('index-stats');

    function render() {
      if (!hasApiKey) {
        noKeyEl.style.display = 'flex';
        offlineBanner.style.display = 'none';
        chatContainer.style.display = 'none';
      } else if (!online) {
        noKeyEl.style.display = 'none';
        offlineBanner.style.display = 'block';
        chatContainer.style.display = 'flex';
        inputEl.disabled = true;
        sendBtn.disabled = true;
      } else {
        noKeyEl.style.display = 'none';
        offlineBanner.style.display = 'none';
        chatContainer.style.display = 'flex';
        inputEl.disabled = false;
        sendBtn.disabled = false;
      }

      // Selection indicator
      if (currentSelection && !currentSelection.isEmpty) {
        selectionInfo.style.display = 'flex';
        const text = currentSelection.text;
        selectionText.textContent = text.length > 60 ? text.substring(0, 60) + '...' : text;
      } else {
        selectionInfo.style.display = 'none';
      }

      // Index status and buttons
      const reindexBtn = document.getElementById('reindex-btn');
      const cancelBtn = document.getElementById('cancel-index-btn');
      if (indexingInProgress) {
        reindexBtn.style.display = 'none';
        cancelBtn.style.display = 'inline';
      } else {
        reindexBtn.style.display = 'inline';
        cancelBtn.style.display = 'none';
        if (indexStatus.totalDocs > 0) {
          indexStats.textContent = indexStatus.totalDocs + ' docs';
        } else {
          indexStats.textContent = '';
        }
      }

      // Messages
      if (messages.length === 0 && !streamingContent) {
        messagesEl.innerHTML = '<div class="empty-state"><p>Ask about your documents or edit text</p><ul><li>"What does the contract say about deadlines?"</li><li>"Summarize report.pdf"</li><li>"Make this paragraph shorter"</li></ul></div>';
      } else {
        let html = '';
        for (const msg of messages) {
          html += renderMessage(msg);
        }
        if (streamingContent) {
          html += '<div class="message assistant streaming">' + renderMarkdown(streamingContent) + '<span class="cursor">|</span></div>';
        } else if (isLoading) {
          html += '<div class="message assistant" style="color: var(--vscode-descriptionForeground)">Searching & thinking...</div>';
        }
        messagesEl.innerHTML = html;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      sendBtn.style.display = isLoading ? 'none' : 'flex';
      stopBtn.style.display = isLoading ? 'flex' : 'none';
      inputEl.disabled = isLoading;
    }

    function renderMessage(msg) {
      if (msg.role === 'user') {
        return '<div class="message user">' + escapeHtml(msg.content) + '</div>';
      }

      let html = '<div class="message assistant' + (msg.isError ? ' error' : '') + '">';
      html += renderMarkdown(msg.content);

      // Citations
      if (msg.citations && msg.citations.length > 0) {
        html += '<div class="citations">';
        for (const c of msg.citations) {
          html += '<span class="citation-chip" data-path="' + escapeHtml(c.source) + '" data-page="' + (c.page || '') + '">';
          html += c.citation;
          html += '</span>';
        }
        html += '</div>';
      }

      // Widget preview (inline)
      if (msg.widget) {
        html += '<div class="edit-preview">' + escapeHtml(msg.widget.preview) + '</div>';
        html += '<div class="widget-actions">';
        html += '<button class="btn-apply" data-widget-id="' + msg.widgetId + '">Apply</button>';
        html += '<button class="btn-discard" data-widget-id="' + msg.widgetId + '">Discard</button>';
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    function renderMarkdown(text) {
      if (!text) return '';
      let html = escapeHtml(text);
      html = html.replace(/\\\`\\\`\\\`([^]*?)\\\`\\\`\\\`/g, '<pre><code>$1</code></pre>');
      html = html.replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>');
      html = html.replace(/[*][*]([^*]+)[*][*]/g, '<strong>$1</strong>');
      html = html.replace(/[*]([^*]+)[*]/g, '<em>$1</em>');
      html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
      html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
      html = html.replace(/\\n/g, '<br>');
      return html;
    }

    function sendMessage() {
      const prompt = inputEl.value.trim();
      if (!prompt || isLoading) return;

      messages.push({ role: 'user', content: prompt });
      conversationHistory.push({ role: 'user', content: prompt });
      inputEl.value = '';
      isLoading = true;
      streamingContent = '';
      ragResults = [];
      render();

      vscode.postMessage({
        type: 'ai-execute',
        prompt,
        selection: currentSelection,
        conversationHistory
      });
    }

    function cancelRequest() {
      vscode.postMessage({ type: 'ai-cancel' });
      isLoading = false;
      streamingContent = '';
      render();
    }

    // Event listeners
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);
    stopBtn.addEventListener('click', cancelRequest);
    document.getElementById('configure-key-btn').addEventListener('click', () => {
      vscode.postMessage({ type: 'ai-configure-key' });
    });
    document.getElementById('reindex-btn').addEventListener('click', () => {
      vscode.postMessage({ type: 'reindex' });
    });
    document.getElementById('cancel-index-btn').addEventListener('click', () => {
      vscode.postMessage({ type: 'cancelIndex' });
    });

    // Handle clicks on citations and widget actions
    messagesEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.citation-chip');
      if (chip) {
        vscode.postMessage({
          type: 'open-source',
          filePath: chip.dataset.path,
          page: chip.dataset.page ? parseInt(chip.dataset.page) : undefined
        });
        return;
      }

      const applyBtn = e.target.closest('.btn-apply');
      if (applyBtn && activeWidget) {
        vscode.postMessage({
          type: 'execute-widget',
          toolName: activeWidget.type,
          args: activeWidget.args,
          selection: activeWidget.selection || currentSelection
        });
        messages.push({ role: 'assistant', content: 'Applied.' });
        activeWidget = null;
        render();
        return;
      }

      const discardBtn = e.target.closest('.btn-discard');
      if (discardBtn) {
        activeWidget = null;
        messages.push({ role: 'assistant', content: 'Discarded.' });
        render();
      }
    });

    // Messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'ai-key-status':
          hasApiKey = message.hasKey;
          render();
          break;

        case 'clear-chat':
          messages = [];
          conversationHistory = [];
          streamingContent = '';
          ragResults = [];
          activeWidget = null;
          render();
          break;

        case 'ai-streaming':
          streamingContent = message.content;
          render();
          break;

        case 'ai-result':
          isLoading = false;
          streamingContent = '';
          if (message.message) {
            const msg = { role: 'assistant', content: message.message };
            if (message.hasRagContext && ragResults.length > 0) {
              msg.citations = ragResults;
            }
            messages.push(msg);
            conversationHistory.push({ role: 'assistant', content: message.message });
          }
          render();
          break;

        case 'rag-results':
          ragResults = message.results || [];
          break;

        case 'ai-widget':
          isLoading = false;
          streamingContent = '';
          activeWidget = { type: message.toolName, args: message.args, selection: message.selection };
          // Show inline preview
          const preview = message.args.newText || message.args.content || JSON.stringify(message.args);
          messages.push({
            role: 'assistant',
            content: 'Here\\'s what I\\'ll do:',
            widget: { preview: typeof preview === 'string' ? preview : JSON.stringify(preview) },
            widgetId: Date.now()
          });
          render();
          break;

        case 'ai-error':
          isLoading = false;
          streamingContent = '';
          messages.push({ role: 'assistant', content: message.error, isError: true });
          render();
          break;

        case 'ai-stopped':
          isLoading = false;
          streamingContent = '';
          render();
          break;

        case 'selection-update':
          currentSelection = message.selection;
          render();
          break;

        case 'connectivity-status':
          online = message.isOnline;
          render();
          break;

        case 'index-status':
          indexStatus = { totalDocs: message.totalDocs, totalChunks: message.totalChunks };
          indexingInProgress = false;
          render();
          break;

        case 'index-progress':
          indexingInProgress = true;
          indexStats.textContent = 'Indexing ' + message.processed + '/' + message.total + ': ' + message.current;
          render();
          break;

        case 'index-done':
          indexingInProgress = false;
          render();
          break;
      }
    });

    // Initialize
    vscode.postMessage({ type: 'ready' });
    render();
  </script>
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
