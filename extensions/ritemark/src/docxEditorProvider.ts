import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocxDocument } from './docxDocument';
import { isAppInstalled, openInExternalApp, getWordProcessorAppName } from './utils/openExternal';
import { trackEvent } from './analytics/posthog';

/**
 * Custom editor provider for DOCX files
 * Provides read-only preview with faithful visual rendering via docx-preview
 */
export class DocxEditorProvider implements vscode.CustomReadonlyEditorProvider<DocxDocument> {
  private fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  private fileChangeDebounceTimers = new Map<string, NodeJS.Timeout>();

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.docxViewer',
      new DocxEditorProvider(context),
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
  ): Promise<DocxDocument> {
    try {
      const buffer = await fs.readFile(uri.fsPath);
      return new DocxDocument(uri, buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read DOCX file: ${message}`);
    }
  }

  async resolveCustomEditor(
    document: DocxDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    void trackEvent('feature_used', { feature: 'word_preview' });

    const scriptUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js')
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
          await this.sendDocxData(document, webviewPanel.webview);
          // Check if Word is installed
          const hasWord = await this.checkWordInstalled();
          webviewPanel.webview.postMessage({ type: 'wordStatus', hasWord });
          break;
        case 'refresh':
          await this.handleRefresh(document, webviewPanel.webview);
          break;
        case 'openInExternalApp':
          await this.openInExternalApp(document.uri.fsPath, message.app || 'word');
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

  private async sendDocxData(document: DocxDocument, webview: vscode.Webview): Promise<void> {
    const base64 = document.buffer.toString('base64');
    const filename = path.basename(document.uri.fsPath);

    webview.postMessage({
      type: 'load',
      fileType: 'docx',
      content: base64,
      encoding: 'base64',
      filename: filename,
      sizeBytes: document.buffer.length
    });
  }

  private async handleRefresh(document: DocxDocument, webview: vscode.Webview): Promise<void> {
    try {
      const newBuffer = await fs.readFile(document.uri.fsPath);
      (document as any).buffer = newBuffer;
      await this.sendDocxData(document, webview);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to refresh DOCX: ${message}`);
    }
  }

  private getHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
    const nonce = this.getNonce();
    // CSP: style-src unsafe-inline for docx-preview generated styles,
    // img-src data: for base64 images, font-src data: for embedded fonts
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} data: blob:;">
  <title>DOCX Preview</title>
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

  private async checkWordInstalled(): Promise<boolean> {
    return isAppInstalled('Microsoft Word');
  }

  private async openInExternalApp(filePath: string, app: string): Promise<void> {
    try {
      const hasWord = app === 'word';
      const appName = getWordProcessorAppName(hasWord);

      await openInExternalApp(filePath, appName);

      vscode.window.showInformationMessage(`Opening in ${appName}...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to open in ${app}: ${errorMessage}`);
    }
  }

  private createFileWatcher(document: DocxDocument, webview: vscode.Webview): void {
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

  private handleFileChange(document: DocxDocument, webview: vscode.Webview): void {
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
