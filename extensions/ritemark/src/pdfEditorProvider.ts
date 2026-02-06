import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PdfDocument } from './pdfDocument';

/**
 * Custom editor provider for PDF files
 * Provides read-only preview with page navigation and zoom
 */
export class PdfEditorProvider implements vscode.CustomReadonlyEditorProvider<PdfDocument> {
  private fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  private fileChangeDebounceTimers = new Map<string, NodeJS.Timeout>();

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.pdfViewer',
      new PdfEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<PdfDocument> {
    try {
      const buffer = await fs.readFile(uri.fsPath);
      return new PdfDocument(uri, buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read PDF file: ${message}`);
    }
  }

  async resolveCustomEditor(
    document: PdfDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const scriptUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
    );

    // PDF.js worker must be served as a webview resource
    const workerUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'pdf.worker.min.mjs')
    );

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
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          await this.sendPdfData(document, webviewPanel.webview, workerUri);
          break;
        case 'refresh':
          await this.handleRefresh(document, webviewPanel.webview, workerUri);
          break;
      }
    });

    // Cleanup on dispose
    webviewPanel.onDidDispose(() => {
      const filePath = document.uri.fsPath;
      const watcher = this.fileWatchers.get(filePath);
      if (watcher) {
        watcher.dispose();
        this.fileWatchers.delete(filePath);
      }
      const timer = this.fileChangeDebounceTimers.get(filePath);
      if (timer) {
        clearTimeout(timer);
        this.fileChangeDebounceTimers.delete(filePath);
      }
    });
  }

  private async sendPdfData(
    document: PdfDocument,
    webview: vscode.Webview,
    workerUri: vscode.Uri
  ): Promise<void> {
    const base64 = document.buffer.toString('base64');
    const filename = path.basename(document.uri.fsPath);

    webview.postMessage({
      type: 'load',
      fileType: 'pdf',
      content: base64,
      encoding: 'base64',
      filename: filename,
      sizeBytes: document.buffer.length,
      workerSrc: workerUri.toString()
    });
  }

  private async handleRefresh(
    document: PdfDocument,
    webview: vscode.Webview,
    workerUri: vscode.Uri
  ): Promise<void> {
    try {
      const newBuffer = await fs.readFile(document.uri.fsPath);
      (document as any).buffer = newBuffer;
      await this.sendPdfData(document, webview, workerUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to refresh PDF: ${message}`);
    }
  }

  private getHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
    const nonce = this.getNonce();
    // CSP: worker-src needed for PDF.js worker, img-src for rendered pages
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource}; img-src ${webview.cspSource} data: blob:; worker-src ${webview.cspSource} blob:;">
  <title>PDF Preview</title>
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

  private createFileWatcher(document: PdfDocument, webview: vscode.Webview): void {
    const filePath = document.uri.fsPath;
    if (this.fileWatchers.has(filePath)) return;

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath))
    );

    watcher.onDidChange(() => {
      this.handleFileChange(document, webview);
    });

    watcher.onDidDelete(() => {
      webview.postMessage({
        type: 'fileDeleted',
        filename: path.basename(filePath)
      });
    });

    this.fileWatchers.set(filePath, watcher);
  }

  private handleFileChange(document: PdfDocument, webview: vscode.Webview): void {
    const filePath = document.uri.fsPath;
    const existingTimer = this.fileChangeDebounceTimers.get(filePath);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.fileChangeDebounceTimers.delete(filePath);
      webview.postMessage({
        type: 'fileChanged',
        filename: path.basename(filePath),
        isDirty: false
      });
    }, 500);

    this.fileChangeDebounceTimers.set(filePath, timer);
  }
}
