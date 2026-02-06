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

        case 'flow:delete-confirm':
          await this._handleDeleteFlowConfirm(message.id, message.name);
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

        case 'flow:open':
          await this._handleEditFlow(message.id);
          break;

        case 'flow:new':
          await this._handleNewFlow();
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
   * Show confirmation dialog for flow deletion
   */
  private async _handleDeleteFlowConfirm(id: string, name: string): Promise<void> {
    const answer = await vscode.window.showWarningMessage(
      `Delete flow "${name}"?`,
      { modal: true },
      'Delete'
    );

    if (answer === 'Delete') {
      await this._handleDeleteFlow(id);
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
    }
  }

  /**
   * Open flow in visual editor
   */
  private async _handleEditFlow(id: string): Promise<void> {
    try {
      const flowPath = this._storage.getFlowPath(id);
      const uri = vscode.Uri.file(flowPath);
      // Open with the visual flow editor, not the default text editor
      await vscode.commands.executeCommand('vscode.openWith', uri, 'ritemark.flowEditor');
    } catch (err) {
      console.error('[FlowsViewProvider] Failed to open flow for editing:', err);
      vscode.window.showErrorMessage(`Failed to open flow: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Create a new flow and open in editor
   */
  private async _handleNewFlow(): Promise<void> {
    try {
      const newFlow = this._storage.createNewFlow('New Flow');
      await this._storage.saveFlow(newFlow);

      // Open the new flow in the editor
      const flowPath = this._storage.getFlowPath(newFlow.id);
      const uri = vscode.Uri.file(flowPath);
      await vscode.commands.executeCommand('vscode.openWith', uri, 'ritemark.flowEditor');

      // Refresh the flows list
      await this._sendFlowList();
    } catch (err) {
      console.error('[FlowsViewProvider] Failed to create new flow:', err);
      vscode.window.showErrorMessage(`Failed to create flow: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Refresh flow list (called from command)
   */
  public async refresh(): Promise<void> {
    await this._sendFlowList();
  }

  /**
   * Get HTML for webview using React bundle
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    // Get the React bundle
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
  <title>Flows</title>
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
  <div id="root" data-editor-type="flows-panel"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
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
