/**
 * AI View Provider
 * Renders AI Chat in VS Code's Secondary Side Bar
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
} from './index';

export class AIViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.aiView';

  private _view?: vscode.WebviewView;
  private _activeAbortController: AbortController | null = null;
  private _documentContent: string = '';
  private _currentSelection: EditorSelection = { text: '', isEmpty: true, from: 0, to: 0 };

  constructor(private readonly _extensionUri: vscode.Uri) {}

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
          // Send initial API key status and connectivity status
          this._sendApiKeyStatus();
          this._sendConnectivityStatus();
          break;

        case 'ai-key-status':
          this._sendApiKeyStatus();
          break;

        case 'ai-configure-key':
          console.log('[AIViewProvider] Received ai-configure-key message');
          vscode.commands.executeCommand('ritemark.configureApiKey');
          break;

        case 'ai-execute':
          await this._handleAIExecute(
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
          // User confirmed widget execution - send to editor
          this._executeToolInEditor(
            message.toolName,
            message.args as Record<string, unknown>,
            message.selection as EditorSelection
          );
          break;
      }
    });

    // Listen for API key changes
    apiKeyChanged.event(({ hasKey }) => {
      this._view?.webview.postMessage({
        type: 'ai-key-status',
        hasKey
      });
    });

    // Listen for connectivity changes
    connectivityChanged.event(({ isOnline: online }) => {
      this._view?.webview.postMessage({
        type: 'connectivity-status',
        isOnline: online
      });
    });
  }

  /**
   * Send current selection and document content from active editor to AI panel
   */
  public sendSelection(selection: EditorSelection, documentContent: string) {
    this._currentSelection = selection;
    this._documentContent = documentContent;
    this._view?.webview.postMessage({
      type: 'selection-update',
      selection
    });
  }

  /**
   * Show the AI panel
   */
  public show() {
    if (this._view) {
      this._view.show(true);
    }
  }

  private async _sendApiKeyStatus() {
    try {
      const apiKeyManager = getAPIKeyManager();
      const hasKey = await apiKeyManager.hasAPIKey();
      this._view?.webview.postMessage({
        type: 'ai-key-status',
        hasKey
      });
    } catch {
      this._view?.webview.postMessage({
        type: 'ai-key-status',
        hasKey: false
      });
    }
  }

  private _sendConnectivityStatus() {
    this._view?.webview.postMessage({
      type: 'connectivity-status',
      isOnline: isOnline()
    });
  }

  private async _handleAIExecute(
    prompt: string,
    selection: EditorSelection,
    conversationHistory: ConversationMessage[]
  ) {
    this._activeAbortController = new AbortController();
    const abortSignal = this._activeAbortController.signal;

    // Use stored document content from editor webview
    const plainText = this._documentContent;
    // Use stored selection if webview didn't send one
    const activeSelection = selection.isEmpty ? this._currentSelection : selection;

    try {
      const result = await executeCommand(
        prompt,
        plainText,
        activeSelection,
        conversationHistory,
        (content: string) => {
          this._view?.webview.postMessage({
            type: 'ai-streaming',
            content
          });
        },
        abortSignal
      );

      this._activeAbortController = null;

      if (result.success) {
        if (result.toolCall) {
          // Tool call - send to AI panel for preview
          // Execution happens when user confirms via execute-widget message
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
            message: result.message
          });
        }
      } else {
        if (result.error === '__USER_STOPPED__') {
          this._view?.webview.postMessage({ type: 'ai-stopped' });
        } else {
          this._view?.webview.postMessage({
            type: 'ai-error',
            error: result.error
          });
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

  /**
   * Execute tool in the active RiteMark editor
   */
  private _executeToolInEditor(
    toolName: string,
    args: Record<string, unknown>,
    selection: EditorSelection
  ) {
    // Broadcast tool execution to all webview panels
    vscode.commands.executeCommand('ritemark.executeAITool', {
      toolName,
      args,
      selection
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>AI Assistant</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 0 !important;
    }
    .header {
      padding: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .header h2 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .header p {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
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
    .no-key svg {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      color: var(--vscode-descriptionForeground);
    }
    .no-key h3 {
      font-size: 13px;
      margin-bottom: 8px;
    }
    .no-key p {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
    }
    .btn {
      padding: 8px 16px;
      font-size: 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
    }
    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .offline-banner {
      background: var(--vscode-inputValidation-warningBackground, #5a4a00);
      border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
      border-radius: 4px;
      padding: 10px 12px;
      margin: 8px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .offline-banner svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: var(--vscode-inputValidation-warningBorder, #b89500);
    }
    .offline-banner .offline-text {
      font-size: 12px;
      color: var(--vscode-foreground);
    }
    .offline-banner .offline-text strong {
      display: block;
      margin-bottom: 2px;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
    }
    .messages-content {
      flex: 1;
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
    .message.assistant {
      color: var(--vscode-foreground);
    }
    .message.assistant h2, .message.assistant h3, .message.assistant h4 {
      margin: 8px 0 4px 0;
      font-weight: 600;
    }
    .message.assistant h2 { font-size: 14px; }
    .message.assistant h3 { font-size: 13px; }
    .message.assistant h4 { font-size: 12px; }
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
    .message.assistant pre code {
      background: none;
      padding: 0;
    }
    .message.assistant ul {
      margin: 4px 0;
      padding-left: 16px;
    }
    .message.assistant li {
      margin: 2px 0;
    }
    .message.assistant strong {
      font-weight: 600;
    }
    .message.error {
      color: var(--vscode-errorForeground);
    }
    .streaming {
      color: var(--vscode-foreground);
    }
    .streaming .cursor {
      animation: blink 1s infinite;
    }
    @keyframes blink {
      50% { opacity: 0; }
    }
    .selection-info {
      padding: 8px 12px;
      background: var(--vscode-inputValidation-infoBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 11px;
    }
    .selection-info span {
      color: var(--vscode-inputValidation-infoForeground);
    }
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
    .input-row input:focus {
      border-color: var(--vscode-focusBorder);
    }
    .input-row button {
      padding: 6px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .input-row button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .input-row button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .input-row button.stop {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
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
    .empty-state ul {
      list-style: none;
      margin-top: 12px;
    }
    .empty-state li {
      margin: 4px 0;
      font-size: 11px;
    }
    .loading {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    /* Widget Preview Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-overlay.hidden {
      display: none;
    }
    .modal {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      max-width: 90%;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .modal-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }
    .modal-header .badge {
      font-size: 10px;
      padding: 2px 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 10px;
    }
    .modal-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }
    .preview-section {
      margin-bottom: 16px;
    }
    .preview-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
    }
    .preview-label .word-count {
      font-weight: normal;
    }
    .preview-text {
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.5;
      max-height: 150px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .preview-text.original {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }
    .preview-text.new {
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-focusBorder);
    }
    .preview-arrow {
      text-align: center;
      padding: 8px;
      color: var(--vscode-descriptionForeground);
    }
    .match-list {
      max-height: 200px;
      overflow-y: auto;
    }
    .match-item {
      padding: 8px;
      background: var(--vscode-input-background);
      border-radius: 4px;
      margin-bottom: 6px;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family);
    }
    .match-item .highlight {
      background: var(--vscode-editor-findMatchHighlightBackground);
      padding: 1px 2px;
      border-radius: 2px;
    }
    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .modal-footer button {
      padding: 6px 16px;
      font-size: 12px;
      border-radius: 2px;
      cursor: pointer;
      border: none;
    }
    .modal-footer .btn-cancel {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .modal-footer .btn-cancel:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .modal-footer .btn-execute {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .modal-footer .btn-execute:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .modal-footer .btn-execute:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body style="padding: 0 !important;">
  <div class="header">
    <h2>AI Assistant</h2>
    <p id="subtitle">Ask me to edit your document</p>
  </div>

  <div id="no-key" class="no-key" style="display: none;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
    <h3>OpenAI API Key Required</h3>
    <p>Add your API key to enable AI features</p>
    <button class="btn" id="configure-key-btn">Configure API Key</button>
  </div>

  <div id="offline-banner" class="offline-banner" style="display: none;">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 1l22 22M9 4.5C9.5 4.2 10.2 4 11 4c2.2 0 4 1.8 4 4 0 .8-.2 1.5-.5 2M7 6c-3.9 0-7 3.1-7 7 0 3.9 3.1 7 7 7h10c.3 0 .7 0 1-.1"/>
      <path d="M12.6 12.6L17 17"/>
    </svg>
    <div class="offline-text">
      <strong>You're offline</strong>
      AI features require an internet connection
    </div>
  </div>

  <div id="chat-container" style="display: none; flex: 1; display: flex; flex-direction: column;">
    <div id="selection-info" class="selection-info" style="display: none;">
      <span>Selected: </span><span id="selection-text"></span>
    </div>

    <div id="messages" class="messages">
      <div class="empty-state">
        <p>Ask me to help edit your document</p>
        <ul>
          <li>"Make this paragraph shorter"</li>
          <li>"Replace all 'user' with 'customer'"</li>
          <li>"Add a conclusion"</li>
        </ul>
      </div>
    </div>

    <div class="input-area">
      <div class="input-row">
        <input type="text" id="input" placeholder="Ask AI..." />
        <button id="send-btn" onclick="sendMessage()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
        <button id="stop-btn" class="stop" onclick="cancelRequest()" style="display: none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12"></rect>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Widget Preview Modal -->
  <div id="widget-modal" class="modal-overlay hidden">
    <div class="modal">
      <div class="modal-header">
        <h3 id="modal-title">Preview</h3>
        <span id="modal-badge" class="badge"></span>
      </div>
      <div class="modal-body" id="modal-body">
        <!-- Dynamic content -->
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" id="modal-cancel-btn">Cancel</button>
        <button class="btn-execute" id="modal-execute-btn">Apply</button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    let hasApiKey = false;
    let isLoading = false;
    let isOnline = true;
    let messages = [];
    let conversationHistory = [];
    let currentSelection = { text: '', isEmpty: true, from: 0, to: 0 };
    let streamingContent = '';

    // Widget preview state
    let activeWidget = null; // { type, args, selection }

    // Elements
    const noKeyEl = document.getElementById('no-key');
    const offlineBanner = document.getElementById('offline-banner');
    const chatContainer = document.getElementById('chat-container');
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const selectionInfo = document.getElementById('selection-info');
    const selectionText = document.getElementById('selection-text');
    const subtitle = document.getElementById('subtitle');

    // Widget modal elements
    const widgetModal = document.getElementById('widget-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBadge = document.getElementById('modal-badge');
    const modalBody = document.getElementById('modal-body');
    const modalExecuteBtn = document.getElementById('modal-execute-btn');

    // Show widget preview modal
    function showWidgetPreview(toolName, args, selection) {
      activeWidget = { type: toolName, args, selection };

      switch (toolName) {
        case 'rephraseText':
          showRephrasePreview(args, selection);
          break;
        case 'findAndReplaceAll':
          showFindReplacePreview(args);
          break;
        case 'insertText':
          showInsertPreview(args);
          break;
        default:
          // Unknown tool, execute directly
          executeWidgetDirect();
          return;
      }

      widgetModal.classList.remove('hidden');
    }

    function showRephrasePreview(args, selection) {
      const originalText = selection?.text || currentSelection.text || '';
      const newText = args.newText || '';
      const style = args.style || '';

      const originalWordCount = originalText.split(/\\s+/).filter(Boolean).length;
      const newWordCount = newText.split(/\\s+/).filter(Boolean).length;
      const wordDiff = newWordCount - originalWordCount;

      modalTitle.textContent = 'Rephrase Selection';
      modalBadge.textContent = style || '';
      modalBadge.style.display = style ? 'inline' : 'none';
      modalExecuteBtn.textContent = 'Replace';

      modalBody.innerHTML = \`
        <div class="preview-section">
          <div class="preview-label">
            <span>Original</span>
            <span class="word-count">\${originalWordCount} words</span>
          </div>
          <div class="preview-text original">\${escapeHtml(originalText)}</div>
        </div>
        <div class="preview-arrow">↓</div>
        <div class="preview-section">
          <div class="preview-label">
            <span>Rephrased</span>
            <span class="word-count">\${newWordCount} words \${wordDiff !== 0 ? '(' + (wordDiff > 0 ? '+' : '') + wordDiff + ')' : ''}</span>
          </div>
          <div class="preview-text new">\${escapeHtml(newText)}</div>
        </div>
      \`;
    }

    function showFindReplacePreview(args) {
      const searchPattern = args.searchPattern || '';
      const replacement = args.replacement || '';

      modalTitle.textContent = 'Find & Replace';
      modalBadge.textContent = '';
      modalBadge.style.display = 'none';
      modalExecuteBtn.textContent = 'Replace All';

      modalBody.innerHTML = \`
        <div class="preview-section">
          <div class="preview-label"><span>Find</span></div>
          <div class="preview-text original">\${escapeHtml(searchPattern)}</div>
        </div>
        <div class="preview-arrow">↓</div>
        <div class="preview-section">
          <div class="preview-label"><span>Replace with</span></div>
          <div class="preview-text new">\${escapeHtml(replacement)}</div>
        </div>
        <p style="margin-top: 12px; font-size: 11px; color: var(--vscode-descriptionForeground);">
          This will replace all occurrences in the document.
        </p>
      \`;
    }

    function showInsertPreview(args) {
      const content = args.content || '';
      const position = args.position || {};
      let positionDesc = 'at cursor';

      if (position.type === 'absolute') {
        positionDesc = position.location === 'end' ? 'at end of document' : 'at start of document';
      } else if (position.type === 'relative' && position.anchor) {
        positionDesc = position.placement === 'after' ? 'after "' + position.anchor + '"' : 'before "' + position.anchor + '"';
      }

      modalTitle.textContent = 'Insert Text';
      modalBadge.textContent = positionDesc;
      modalBadge.style.display = 'inline';
      modalExecuteBtn.textContent = 'Insert';

      modalBody.innerHTML = \`
        <div class="preview-section">
          <div class="preview-label"><span>Content to insert</span></div>
          <div class="preview-text new">\${escapeHtml(content)}</div>
        </div>
        <p style="margin-top: 12px; font-size: 11px; color: var(--vscode-descriptionForeground);">
          Will be inserted \${positionDesc}.
        </p>
      \`;
    }

    function cancelWidget() {
      activeWidget = null;
      widgetModal.classList.add('hidden');
      messages.push({ role: 'assistant', content: 'Cancelled.' });
      render();
    }

    function executeWidget() {
      if (!activeWidget) return;

      widgetModal.classList.add('hidden');

      // Send execution command to extension
      vscode.postMessage({
        type: 'execute-widget',
        toolName: activeWidget.type,
        args: activeWidget.args,
        selection: activeWidget.selection || currentSelection
      });

      // Show execution message
      let actionMsg = 'Done.';
      switch (activeWidget.type) {
        case 'rephraseText':
          actionMsg = 'Text rephrased.';
          break;
        case 'findAndReplaceAll':
          actionMsg = 'Replaced all occurrences.';
          break;
        case 'insertText':
          actionMsg = 'Text inserted.';
          break;
      }
      messages.push({ role: 'assistant', content: actionMsg });
      conversationHistory.push({ role: 'assistant', content: actionMsg });

      activeWidget = null;
      render();
    }

    // Execute widget directly without preview (fallback)
    function executeWidgetDirect() {
      if (!activeWidget) return;

      vscode.postMessage({
        type: 'execute-widget',
        toolName: activeWidget.type,
        args: activeWidget.args,
        selection: activeWidget.selection || currentSelection
      });

      messages.push({ role: 'assistant', content: 'Executed ' + activeWidget.type });
      activeWidget = null;
      render();
    }

    function render() {
      // Show/hide based on API key and connectivity
      if (!hasApiKey) {
        noKeyEl.style.display = 'flex';
        offlineBanner.style.display = 'none';
        chatContainer.style.display = 'none';
        subtitle.textContent = 'API key required';
      } else if (!isOnline) {
        noKeyEl.style.display = 'none';
        offlineBanner.style.display = 'flex';
        chatContainer.style.display = 'flex';
        subtitle.textContent = 'Offline - editing still works';
        inputEl.disabled = true;
        inputEl.placeholder = 'Connect to internet to use AI...';
        sendBtn.disabled = true;
      } else {
        noKeyEl.style.display = 'none';
        offlineBanner.style.display = 'none';
        chatContainer.style.display = 'flex';
        subtitle.textContent = 'Ask me to edit your document';
        inputEl.disabled = false;
        inputEl.placeholder = 'Ask AI...';
        sendBtn.disabled = false;
      }

      // Show/hide selection info
      if (currentSelection && !currentSelection.isEmpty) {
        selectionInfo.style.display = 'block';
        const text = currentSelection.text;
        selectionText.textContent = text.length > 50 ? text.substring(0, 50) + '...' : text;
      } else {
        selectionInfo.style.display = 'none';
      }

      // Render messages
      if (messages.length === 0 && !streamingContent) {
        messagesEl.innerHTML = '<div class="empty-state"><p>Ask me to help edit your document</p><ul><li>"Make this paragraph shorter"</li><li>"Replace all user with customer"</li><li>"Add a conclusion"</li></ul></div>';
      } else {
        let html = '';
        for (const msg of messages) {
          const content = msg.role === 'assistant' ? renderMarkdown(msg.content) : escapeHtml(msg.content);
          html += '<div class="message ' + msg.role + (msg.isError ? ' error' : '') + '">' + content + '</div>';
        }
        if (streamingContent) {
          html += '<div class="message assistant streaming">' + renderMarkdown(streamingContent) + '<span class="cursor">▊</span></div>';
        } else if (isLoading) {
          html += '<div class="loading">Thinking...</div>';
        }
        messagesEl.innerHTML = html;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      // Show/hide buttons
      sendBtn.style.display = isLoading ? 'none' : 'flex';
      stopBtn.style.display = isLoading ? 'flex' : 'none';
      inputEl.disabled = isLoading;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Simple markdown to HTML converter
    function renderMarkdown(text) {
      if (!text) return '';

      // Escape HTML first for safety
      let html = escapeHtml(text);

      // Code blocks - match \`\`\` ... \`\`\`
      html = html.replace(/\\\`\\\`\\\`([^]*?)\\\`\\\`\\\`/g, '<pre><code>$1</code></pre>');

      // Inline code - match \` ... \`
      html = html.replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>');

      // Bold **text**
      html = html.replace(/[*][*]([^*]+)[*][*]/g, '<strong>$1</strong>');

      // Italic *text*
      html = html.replace(/[*]([^*]+)[*]/g, '<em>$1</em>');

      // Headers
      html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
      html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

      // Lists
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

      // Line breaks (but not inside code blocks)
      html = html.replace(/\\n/g, '<br>');

      return html;
    }

    function configureKey() {
      console.log('[Webview] configureKey button clicked, posting message...');
      vscode.postMessage({ type: 'ai-configure-key' });
    }

    function sendMessage() {
      const prompt = inputEl.value.trim();
      if (!prompt || isLoading) return;

      // Add user message
      messages.push({ role: 'user', content: prompt });
      conversationHistory.push({ role: 'user', content: prompt });

      // Clear input and start loading
      inputEl.value = '';
      isLoading = true;
      streamingContent = '';
      render();

      // Send to extension
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

    // Handle Enter key
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'ai-key-status':
          hasApiKey = message.hasKey;
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
            messages.push({ role: 'assistant', content: message.message });
            conversationHistory.push({ role: 'assistant', content: message.message });
          }
          render();
          break;

        case 'ai-widget':
          isLoading = false;
          streamingContent = '';
          // Show widget preview modal
          showWidgetPreview(message.toolName, message.args, message.selection);
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
          isOnline = message.isOnline;
          render();
          break;
      }
    });

    // Attach event listeners (CSP blocks inline onclick)
    document.getElementById('modal-cancel-btn').addEventListener('click', cancelWidget);
    document.getElementById('modal-execute-btn').addEventListener('click', executeWidget);
    document.getElementById('configure-key-btn').addEventListener('click', configureKey);

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
