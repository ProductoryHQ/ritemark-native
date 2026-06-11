import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ExcelDocument } from './excelDocument';
import { isAppInstalled, openInExternalApp, openCsvInExcelWithHints, getSpreadsheetAppName } from './utils/openExternal';
import { trackEvent } from './analytics/posthog';

/**
 * Custom editor provider for Excel files (.xlsx, .xls)
 * Multi-sheet preview with basic editing for .xlsx (cell edits, add row/column).
 * .xls stays read-only (SheetJS would re-encode it as xlsx on save).
 */
export class ExcelEditorProvider implements vscode.CustomEditorProvider<ExcelDocument> {
  // File watchers and debounce timers
  private fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  private fileChangeDebounceTimers = new Map<string, NodeJS.Timeout>();
  // Webview panels per document (for revert/refresh pushes)
  private webviewPanels = new Map<string, vscode.WebviewPanel>();
  // Documents with unsaved webview edits (uri.toString())
  private dirtyDocuments = new Set<string>();
  // Files currently being saved by us — suppresses our own watcher events
  private savingFiles = new Set<string>();
  // One-time-per-session caveat about basic editing fidelity
  private editCaveatShown = false;

  private readonly _onDidChangeCustomDocument =
    new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<ExcelDocument>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.excelViewer',
      new ExcelEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Only .xlsx supports editing; .xls is read-only
   */
  private isEditable(document: ExcelDocument): boolean {
    return document.uri.fsPath.toLowerCase().endsWith('.xlsx');
  }

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
      // Restore from hot-exit backup when present
      const dataPath = openContext.backupId ? vscode.Uri.parse(openContext.backupId).fsPath : uri.fsPath;
      const buffer = await fs.readFile(dataPath);
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
    void trackEvent('feature_used', { feature: 'excel_preview' });

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

    this.webviewPanels.set(document.uri.toString(), webviewPanel);

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

          case 'contentChanged':
            // Webview edited the workbook — update document and mark dirty
            this.handleContentChanged(document, message.content as string);
            break;

          case 'refresh':
            // Refresh: unsaved edits require an explicit discard confirmation
            // (the webview shows a ConflictDialog and answers with
            // confirmRefresh / cancelRefresh)
            if (this.dirtyDocuments.has(document.uri.toString())) {
              webviewPanel.webview.postMessage({ type: 'confirmDiscard' });
            } else {
              await this.handleRefresh(webviewPanel.webview, document);
            }
            break;

          case 'confirmRefresh':
            // User confirmed discarding local edits in favor of disk state
            await this.discardEditsAndRefresh(document, webviewPanel.webview);
            break;

          case 'cancelRefresh':
            // User kept their local edits — nothing to do
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
      if (this.webviewPanels.get(document.uri.toString()) === webviewPanel) {
        this.webviewPanels.delete(document.uri.toString());
      }
      this.dirtyDocuments.delete(document.uri.toString());
    });
  }

  /**
   * Apply a webview edit (full serialized workbook, base64) to the document
   */
  private handleContentChanged(document: ExcelDocument, base64Content: string): void {
    if (!this.isEditable(document) || typeof base64Content !== 'string') {
      return;
    }

    document.update(Buffer.from(base64Content, 'base64'));
    this.dirtyDocuments.add(document.uri.toString());
    this._onDidChangeCustomDocument.fire({ document });

    if (!this.editCaveatShown) {
      this.editCaveatShown = true;
      void trackEvent('feature_used', { feature: 'excel_edit' });
      vscode.window.showInformationMessage(
        'Excel editing is basic: edited cells replace formulas with plain values, and complex formatting may be simplified when the file is saved.'
      );
    }
  }

  // ── Save / revert / backup (vscode.CustomEditorProvider) ──────────────

  async saveCustomDocument(document: ExcelDocument, _token: vscode.CancellationToken): Promise<void> {
    await this.writeFileSuppressingWatcher(document.uri.fsPath, document.buffer, document.uri.fsPath);
    this.dirtyDocuments.delete(document.uri.toString());
  }

  async saveCustomDocumentAs(
    document: ExcelDocument,
    destination: vscode.Uri,
    _token: vscode.CancellationToken
  ): Promise<void> {
    await this.writeFileSuppressingWatcher(destination.fsPath, document.buffer, document.uri.fsPath);
  }

  async revertCustomDocument(document: ExcelDocument, _token: vscode.CancellationToken): Promise<void> {
    const buffer = await fs.readFile(document.uri.fsPath);
    document.update(buffer);
    this.dirtyDocuments.delete(document.uri.toString());
    // Push fresh content so the webview re-renders the reverted workbook
    const panel = this.webviewPanels.get(document.uri.toString());
    if (panel) {
      this.sendExcelData(panel.webview, document);
    }
  }

  /**
   * Confirmed refresh of a dirty document: discard local edits and reload
   * from disk. Goes through VS Code's revert so the dirty indicator clears
   * (the webview that sent the request is the active editor); falls back to
   * a manual reload if the command fails.
   */
  private async discardEditsAndRefresh(document: ExcelDocument, webview: vscode.Webview): Promise<void> {
    this.dirtyDocuments.delete(document.uri.toString());
    try {
      await vscode.commands.executeCommand('workbench.action.files.revert', document.uri);
    } catch {
      await this.handleRefresh(webview, document);
    }
  }

  async backupCustomDocument(
    document: ExcelDocument,
    context: vscode.CustomDocumentBackupContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    const destination = context.destination;
    await fs.mkdir(path.dirname(destination.fsPath), { recursive: true });
    await fs.writeFile(destination.fsPath, document.buffer);
    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await fs.unlink(destination.fsPath);
        } catch {
          // Backup already gone — nothing to do
        }
      }
    };
  }

  /**
   * Write the buffer to disk while suppressing our own file watcher,
   * so saving doesn't surface a "file changed externally" badge.
   */
  private async writeFileSuppressingWatcher(
    targetPath: string,
    buffer: Buffer,
    watchedPath: string
  ): Promise<void> {
    this.savingFiles.add(watchedPath);
    try {
      await fs.writeFile(targetPath, buffer);
    } finally {
      // Keep suppression slightly longer than the watcher debounce window
      setTimeout(() => this.savingFiles.delete(watchedPath), 1000);
    }
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

      // Keep the document in sync so a later save doesn't resurrect stale edits
      document.update(buffer);

      // Send fresh content to webview
      this.sendExcelData(webview, document);

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

    webview.postMessage({
      type: 'load',
      fileType: 'xlsx',
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

      if (hasExcel && filePath.toLowerCase().endsWith('.csv')) {
        await openCsvInExcelWithHints(filePath, appName);
      } else {
        await openInExternalApp(filePath, appName);
      }

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

    // Ignore changes caused by our own save
    if (this.savingFiles.has(filePath)) {
      return;
    }

    // Clear existing debounce timer
    const existingTimer = this.fileChangeDebounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounce changes (500ms) to avoid spam
    const timer = setTimeout(() => {
      const filename = path.basename(filePath);

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
