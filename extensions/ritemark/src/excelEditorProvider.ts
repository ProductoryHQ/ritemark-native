import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ExcelDocument } from './excelDocument';
import { isAppInstalled, openInExternalApp, getSpreadsheetAppName } from './utils/openExternal';

/**
 * Custom editor provider for Excel files (.xlsx, .xls)
 * Provides read-only preview with multi-sheet support
 */
export class ExcelEditorProvider implements vscode.CustomReadonlyEditorProvider<ExcelDocument> {
  // File watchers and debounce timers
  private fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  private fileChangeDebounceTimers = new Map<string, NodeJS.Timeout>();

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.excelViewer',
      new ExcelEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Called when VS Code needs to open an Excel file
   * Reads the binary file asynchronously and returns a document
   */
  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<ExcelDocument> {
    try {
      // Use async file IO (refinement from Codex review)
      const buffer = await fs.readFile(uri.fsPath);
      return new ExcelDocument(uri, buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read Excel file: ${message}`);
    }
  }

  /**
   * Called to setup the webview for an Excel document
   * Sends Base64-encoded content to webview ONCE
   * Webview handles sheet parsing and caching client-side
   */
  async resolveCustomEditor(
    document: ExcelDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview options
    const scriptPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js');
    const scriptUri = webviewPanel.webview.asWebviewUri(scriptPath);

    // Debug logging for Windows path issues
    console.log('[Ritemark Excel] Extension URI:', this.context.extensionUri.toString());
    console.log('[Ritemark Excel] Script path:', scriptPath.toString());
    console.log('[Ritemark Excel] Script URI:', scriptUri.toString());

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media')
      ]
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, scriptUri);

    // Create file watcher for external changes
    this.createFileWatcher(document, webviewPanel.webview);

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      async message => {
        switch (message.type) {
          case 'ready':
            // Webview is ready, send Excel data ONCE
            // Client-side caching: webview will parse and cache all sheets
            this.sendExcelData(webviewPanel.webview, document);
            break;

          case 'refresh':
            // Refresh: re-read file and send fresh content
            await this.handleRefresh(webviewPanel.webview, document);
            break;

          case 'checkExcel':
            // Check if Excel is installed
            const hasExcel = await this.checkExcelInstalled();
            webviewPanel.webview.postMessage({
              type: 'excelStatus',
              hasExcel
            });
            break;

          case 'openInExternalApp':
            // Open file in external app (Excel or Numbers)
            const app = message.app as string;
            await this.openInExternalApp(document.uri.fsPath, app);
            break;

          case 'error':
            // Webview encountered an error (display in VS Code)
            vscode.window.showErrorMessage(`Excel Preview: ${message.message}`);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Clean up file watcher when webview is disposed
    webviewPanel.onDidDispose(() => {
      this.disposeFileWatcher(document.uri.fsPath);
    });
  }

  /**
   * Handle refresh: re-read file from disk and send fresh content
   */
  private async handleRefresh(
    webview: vscode.Webview,
    document: ExcelDocument
  ): Promise<void> {
    try {
      // Re-read file from disk
      const buffer = await fs.readFile(document.uri.fsPath);
      const filename = path.basename(document.uri.fsPath);
      const ext = path.extname(document.uri.fsPath).toLowerCase();

      // Send fresh content to webview
      webview.postMessage({
        type: 'load',
        fileType: ext === '.xlsx' || ext === '.xls' ? 'xlsx' : 'xlsx',
        content: buffer.toString('base64'),
        encoding: 'base64',
        filename: filename,
        sizeBytes: buffer.length
      });

      // Show success notification
      vscode.window.showInformationMessage(`Refreshed ${filename}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to refresh: ${message}`);
    }
  }

  /**
   * Send Excel data to webview (called ONCE on load)
   * Webview will handle multi-sheet parsing and caching
   */
  private sendExcelData(
    webview: vscode.Webview,
    document: ExcelDocument
  ): void {
    const base64 = document.buffer.toString('base64');
    const filename = path.basename(document.uri.fsPath);
    const ext = path.extname(document.uri.fsPath).toLowerCase();

    webview.postMessage({
      type: 'load',
      fileType: ext === '.xlsx' || ext === '.xls' ? 'xlsx' : 'xlsx',
      content: base64,
      encoding: 'base64',
      filename: filename,
      sizeBytes: document.buffer.length
    });
  }

  private getHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
    const nonce = this.getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
  <title>Excel Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background, #ffffff);
      color: var(--vscode-editor-foreground, #333333);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Check if Microsoft Excel is installed
   */
  private async checkExcelInstalled(): Promise<boolean> {
    return isAppInstalled('Microsoft Excel');
  }

  /**
   * Open file in external application
   * @param filePath Absolute path to the file
   * @param app App identifier ('excel' or 'numbers')
   */
  private async openInExternalApp(filePath: string, app: string): Promise<void> {
    try {
      const hasExcel = app === 'excel';
      const appName = getSpreadsheetAppName(hasExcel);

      await openInExternalApp(filePath, appName);

      vscode.window.showInformationMessage(`Opening in ${appName}...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to open in ${app}: ${errorMessage}`);
    }
  }

  /**
   * Create file watcher to detect external changes
   */
  private createFileWatcher(
    document: ExcelDocument,
    webview: vscode.Webview
  ): void {
    const filePath = document.uri.fsPath;

    // Don't create duplicate watchers
    if (this.fileWatchers.has(filePath)) {
      return;
    }

    // Create watcher for this specific file
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath))
    );

    // Listen for file changes
    watcher.onDidChange(() => {
      this.handleFileChange(document, webview);
    });

    // Listen for file deletion
    watcher.onDidDelete(() => {
      webview.postMessage({
        type: 'fileDeleted',
        filename: path.basename(filePath)
      });
    });

    this.fileWatchers.set(filePath, watcher);
  }

  /**
   * Handle file change event (debounced)
   */
  private handleFileChange(
    document: ExcelDocument,
    webview: vscode.Webview
  ): void {
    const filePath = document.uri.fsPath;

    // Clear existing debounce timer
    const existingTimer = this.fileChangeDebounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounce changes (500ms) to avoid spam
    const timer = setTimeout(() => {
      const filename = path.basename(filePath);

      // Excel is read-only, so never dirty
      webview.postMessage({
        type: 'fileChanged',
        filename,
        isDirty: false
      });

      this.fileChangeDebounceTimers.delete(filePath);
    }, 500);

    this.fileChangeDebounceTimers.set(filePath, timer);
  }

  /**
   * Dispose file watcher for a specific file
   */
  private disposeFileWatcher(filePath: string): void {
    const watcher = this.fileWatchers.get(filePath);
    if (watcher) {
      watcher.dispose();
      this.fileWatchers.delete(filePath);
    }

    // Clear any pending debounce timer
    const timer = this.fileChangeDebounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.fileChangeDebounceTimers.delete(filePath);
    }
  }
}
