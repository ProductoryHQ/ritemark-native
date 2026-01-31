/**
 * Flows View Provider
 *
 * Manages the Flows sidebar webview panel.
 * Handles flow listing, execution, and management.
 */

import * as vscode from 'vscode';
import { FlowStorage } from './FlowStorage';
import { executeFlow } from './FlowExecutor';
import type { Flow } from './types';

export class FlowsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.flowsView';

  private _view?: vscode.WebviewView;
  private _storage: FlowStorage;
  private _activeAbortController: AbortController | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspacePath: string
  ) {
    this._storage = new FlowStorage(_workspacePath);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          await this._sendFlowList();
          break;

        case 'flow:list':
          await this._sendFlowList();
          break;

        case 'flow:load':
          await this._handleLoadFlow(message.id);
          break;

        case 'flow:save':
          await this._handleSaveFlow(message.flow);
          break;

        case 'flow:delete':
          await this._handleDeleteFlow(message.id);
          break;

        case 'flow:run':
          await this._handleRunFlow(message.id, message.inputs);
          break;

        case 'flow:cancel':
          this._handleCancelFlow();
          break;

        case 'flow:edit':
          await this._handleEditFlow(message.id);
          break;
      }
    });
  }

  /**
   * Send list of all flows to webview
   */
  private async _sendFlowList(): Promise<void> {
    try {
      const flows = await this._storage.listFlows();
      this._view?.webview.postMessage({
        type: 'flow:list',
        flows,
      });
    } catch (err) {
      console.error('[FlowsViewProvider] Failed to list flows:', err);
      this._view?.webview.postMessage({
        type: 'flow:error',
        error: 'Failed to load flows',
      });
    }
  }

  /**
   * Load and send a specific flow
   */
  private async _handleLoadFlow(id: string): Promise<void> {
    try {
      const flow = await this._storage.loadFlow(id);
      this._view?.webview.postMessage({
        type: 'flow:loaded',
        flow,
      });
    } catch (err) {
      console.error('[FlowsViewProvider] Failed to load flow:', err);
      this._view?.webview.postMessage({
        type: 'flow:error',
        error: `Failed to load flow: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /**
   * Save a flow
   */
  private async _handleSaveFlow(flow: Flow): Promise<void> {
    try {
      await this._storage.saveFlow(flow);
      this._view?.webview.postMessage({
        type: 'flow:saved',
        id: flow.id,
      });
      await this._sendFlowList();
    } catch (err) {
      console.error('[FlowsViewProvider] Failed to save flow:', err);
      this._view?.webview.postMessage({
        type: 'flow:error',
        error: `Failed to save flow: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /**
   * Delete a flow
   */
  private async _handleDeleteFlow(id: string): Promise<void> {
    try {
      await this._storage.deleteFlow(id);
      this._view?.webview.postMessage({
        type: 'flow:deleted',
        id,
      });
      await this._sendFlowList();
    } catch (err) {
      console.error('[FlowsViewProvider] Failed to delete flow:', err);
      this._view?.webview.postMessage({
        type: 'flow:error',
        error: `Failed to delete flow: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /**
   * Execute a flow
   */
  private async _handleRunFlow(
    id: string,
    inputs: Record<string, unknown>
  ): Promise<void> {
    try {
      // Load flow
      const flow = await this._storage.loadFlow(id);

      // Create abort controller
      this._activeAbortController = new AbortController();

      // Execute flow with progress updates
      const result = await executeFlow(
        flow,
        inputs,
        this._workspacePath,
        (progress) => {
          this._view?.webview.postMessage({
            type: 'flow:progress',
            step: progress.step,
            total: progress.total,
            currentNode: progress.currentNode,
            currentNodeLabel: progress.currentNodeLabel,
          });
        },
        this._activeAbortController.signal
      );

      // Send result
      if (result.success) {
        this._view?.webview.postMessage({
          type: 'flow:complete',
          outputs: result.outputs,
        });
      } else {
        this._view?.webview.postMessage({
          type: 'flow:error',
          error: result.error || 'Flow execution failed',
        });
      }
    } catch (err) {
      console.error('[FlowsViewProvider] Flow execution error:', err);
      this._view?.webview.postMessage({
        type: 'flow:error',
        error: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      this._activeAbortController = null;
    }
  }

  /**
   * Cancel flow execution
   */
  private _handleCancelFlow(): void {
    if (this._activeAbortController) {
      this._activeAbortController.abort();
      this._activeAbortController = null;
      console.log('[FlowsViewProvider] Flow execution cancelled');
    }
  }

  /**
   * Open flow JSON file in editor
   */
  private async _handleEditFlow(id: string): Promise<void> {
    try {
      const flowPath = this._storage.getFlowPath(id);
      const uri = vscode.Uri.file(flowPath);
      await vscode.commands.executeCommand('vscode.open', uri);
    } catch (err) {
      console.error('[FlowsViewProvider] Failed to open flow for editing:', err);
      vscode.window.showErrorMessage(`Failed to open flow: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Refresh flow list (called from command)
   */
  public async refresh(): Promise<void> {
    await this._sendFlowList();
  }

  /**
   * Get HTML for webview (custom HTML UI for Phase 1)
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Flows</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
      overflow-y: auto;
    }
    .flow-list { display: flex; flex-direction: column; gap: 8px; }
    .flow-item {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      background: var(--vscode-editor-background);
    }
    .flow-item:hover { background: var(--vscode-list-hoverBackground); }
    .flow-name { font-weight: 600; margin-bottom: 4px; }
    .flow-description {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .flow-meta {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }
    .flow-actions { display: flex; gap: 8px; margin-top: 8px; }
    button {
      padding: 6px 12px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      border-radius: 2px;
      font-size: 0.9em;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal.show { display: flex; }
    .modal-content {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 20px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-header {
      font-size: 1.1em;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .modal-body { margin-bottom: 16px; }
    .modal-footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .form-group { margin-bottom: 12px; }
    .form-label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
    }
    input[type="text"] {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
    }
    .progress {
      width: 100%;
      height: 8px;
      background: var(--vscode-progressBar-background);
      border-radius: 4px;
      overflow: hidden;
      margin: 12px 0;
    }
    .progress-bar {
      height: 100%;
      background: var(--vscode-progressBar-foreground);
      transition: width 0.3s;
    }
    .output {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .error {
      color: var(--vscode-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
      padding: 12px;
      border-radius: 4px;
      border-left: 3px solid var(--vscode-inputValidation-errorBorder);
    }
    .success {
      color: var(--vscode-terminal-ansiGreen);
      padding: 12px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div id="content">
    <div class="loading">Loading flows...</div>
  </div>

  <!-- Run Flow Modal -->
  <div id="runModal" class="modal">
    <div class="modal-content">
      <div class="modal-header" id="modalTitle">Run Flow</div>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-footer" id="modalFooter"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let flows = [];
    let currentFlow = null;
    let isRunning = false;

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'flow:list':
          flows = message.flows;
          renderFlowList();
          break;

        case 'flow:deleted':
          flows = flows.filter(f => f.id !== message.id);
          renderFlowList();
          break;

        case 'flow:progress':
          updateProgress(message.step, message.total, message.currentNodeLabel);
          break;

        case 'flow:complete':
          showSuccess(message.outputs);
          break;

        case 'flow:error':
          showError(message.error);
          break;
      }
    });

    function renderFlowList() {
      const content = document.getElementById('content');

      if (flows.length === 0) {
        content.innerHTML = \`
          <div class="empty-state">
            <p style="margin-bottom: 8px;">No flows yet</p>
            <p style="font-size: 0.9em;">Visual flow editor coming in Phase 2</p>
          </div>
        \`;
        return;
      }

      const html = flows.map(flow => \`
        <div class="flow-item">
          <div class="flow-name">\${escapeHtml(flow.name)}</div>
          \${flow.description ? \`<div class="flow-description">\${escapeHtml(flow.description)}</div>\` : ''}
          <div class="flow-actions">
            <button data-action="run" data-id="\${flow.id}">▶ Run</button>
            <button class="secondary" data-action="edit" data-id="\${flow.id}">✏️ Edit</button>
            <button class="secondary" data-action="delete" data-id="\${flow.id}">🗑 Delete</button>
          </div>
          <div class="flow-meta">Modified: \${new Date(flow.modified).toLocaleDateString()}</div>
        </div>
      \`).join('');

      content.innerHTML = \`<div class="flow-list">\${html}</div>\`;

      // Add event listeners (CSP-compliant)
      content.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = btn.getAttribute('data-action');
          const id = btn.getAttribute('data-id');
          if (action === 'run') runFlow(id);
          else if (action === 'edit') editFlow(id);
          else if (action === 'delete') deleteFlow(id);
        });
      });
    }

    function runFlow(id) {
      currentFlow = flows.find(f => f.id === id);
      if (!currentFlow) return;

      showRunModal();
    }

    function showRunModal() {
      const modal = document.getElementById('runModal');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');
      const footer = document.getElementById('modalFooter');

      title.textContent = \`Run Flow: \${currentFlow.name}\`;

      // Build input form
      if (currentFlow.inputs.length === 0) {
        body.innerHTML = '<p style="color: var(--vscode-descriptionForeground); padding: 20px; text-align: center;">This flow has no inputs. Click Run to execute.</p>';
      } else {
        const inputHtml = currentFlow.inputs.map(input => \`
          <div class="form-group">
            <label class="form-label">
              \${escapeHtml(input.label)}
              \${input.required ? '<span style="color: var(--vscode-errorForeground);">*</span>' : ''}
            </label>
            <input type="text" id="input_\${input.id}" value="\${input.defaultValue || ''}" placeholder="Enter \${input.label.toLowerCase()}..." />
          </div>
        \`).join('');
        body.innerHTML = inputHtml;
      }

      footer.innerHTML = \`
        <button class="secondary" id="btnCancel">Cancel</button>
        <button id="btnExecute">▶ Run Flow</button>
      \`;

      document.getElementById('btnCancel').addEventListener('click', closeModal);
      document.getElementById('btnExecute').addEventListener('click', executeFlow);

      modal.classList.add('show');
    }

    function executeFlow() {
      const inputs = {};

      // Collect inputs
      for (const input of currentFlow.inputs) {
        const el = document.getElementById(\`input_\${input.id}\`);
        if (el) {
          inputs[input.id] = el.value;
          if (input.required && !inputs[input.id]) {
            alert(\`Required input: \${input.label}\`);
            return;
          }
        }
      }

      isRunning = true;

      // Update modal to show progress
      const body = document.getElementById('modalBody');
      const footer = document.getElementById('modalFooter');

      body.innerHTML = \`
        <div style="padding: 20px; text-align: center;">
          <p id="progressLabel" style="margin-bottom: 12px;">Starting...</p>
          <div class="progress">
            <div id="progressBar" class="progress-bar" style="width: 0%"></div>
          </div>
        </div>
      \`;

      footer.innerHTML = '<button class="secondary" id="btnCancelExec">Cancel</button>';
      document.getElementById('btnCancelExec').addEventListener('click', cancelExecution);

      // Send run command
      vscode.postMessage({
        type: 'flow:run',
        id: currentFlow.id,
        inputs
      });
    }

    function updateProgress(step, total, label) {
      const percent = (step / total) * 100;
      const progressBar = document.getElementById('progressBar');
      const progressLabel = document.getElementById('progressLabel');

      if (progressBar) {
        progressBar.style.width = \`\${percent}%\`;
      }

      if (progressLabel) {
        progressLabel.textContent = \`Running step \${step} of \${total}\${label ? \`: \${label}\` : ''}\`;
      }
    }

    function showSuccess(outputs) {
      isRunning = false;
      const body = document.getElementById('modalBody');
      const footer = document.getElementById('modalFooter');

      let outputHtml = '';
      if (Object.keys(outputs).length > 0) {
        const outputList = Object.entries(outputs).map(([nodeId, output]) => {
          const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
          const preview = outputStr.length > 500 ? outputStr.substring(0, 500) + '...' : outputStr;
          return \`
            <div style="margin-bottom: 12px;">
              <div style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-bottom: 4px;">Node: \${nodeId}</div>
              <div class="output">\${escapeHtml(preview)}</div>
            </div>
          \`;
        }).join('');
        outputHtml = \`<div style="margin-top: 12px;">\${outputList}</div>\`;
      }

      body.innerHTML = \`
        <div class="success">✓ Flow completed successfully!</div>
        \${outputHtml}
      \`;

      footer.innerHTML = '<button id="btnClose">Close</button>';
      document.getElementById('btnClose').addEventListener('click', closeModal);
    }

    function showError(error) {
      isRunning = false;
      const body = document.getElementById('modalBody');
      const footer = document.getElementById('modalFooter');

      body.innerHTML = \`
        <div class="error">
          <strong>Error:</strong><br>
          \${escapeHtml(error)}
        </div>
      \`;

      footer.innerHTML = '<button id="btnCloseError">Close</button>';
      document.getElementById('btnCloseError').addEventListener('click', closeModal);
    }

    function cancelExecution() {
      vscode.postMessage({ type: 'flow:cancel' });
      closeModal();
    }

    function editFlow(id) {
      vscode.postMessage({
        type: 'flow:edit',
        id
      });
    }

    function deleteFlow(id) {
      const flow = flows.find(f => f.id === id);
      if (!flow) return;

      if (confirm(\`Delete flow "\${flow.name}"?\`)) {
        vscode.postMessage({
          type: 'flow:delete',
          id
        });
      }
    }

    function closeModal() {
      const modal = document.getElementById('runModal');
      modal.classList.remove('show');
      currentFlow = null;
      isRunning = false;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Request initial flow list
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

/**
 * Generate a random nonce for CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
