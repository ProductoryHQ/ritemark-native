import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocxDocument } from './docxDocument';
import { isAppInstalled, openInExternalApp, openWithDefaultApp } from './utils/openExternal';
import { getCurrentPlatform } from './utils/platform';
import { OFFICE_PREVIEW_LIMITS, checkOfficePackage, describeProblem, type PackageVerdict } from './officePreview/officePackageCheck';
import { trackEvent } from './analytics/posthog';
import { isEnabled } from './features';
import { saveAsMarkdownHandler, type SaveAsMarkdownPayload } from './export/saveAsMarkdown';

/** Where "Open externally" sends the file: Word, else Pages on a Mac, else the system default. */
interface ExternalApp {
  label: string;
  /** null: the system's default app for .docx */
  appName: string | null;
}

/**
 * Custom editor provider for DOCX files
 * Provides read-only preview with faithful visual rendering via docx-preview.
 * Sprint 124 (#284): the preview runs from its own bundle (media/office-preview.js),
 * and the host checks each file before sending it (R5).
 */
export class DocxEditorProvider implements vscode.CustomReadonlyEditorProvider<DocxDocument> {
  private fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  private fileChangeDebounceTimers = new Map<string, NodeJS.Timeout>();
  private externalApp: Promise<ExternalApp> | null = null;

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
      const { size } = await fs.stat(uri.fsPath);
      const buffer = size > OFFICE_PREVIEW_LIMITS.maxFileBytes ? Buffer.alloc(0) : await fs.readFile(uri.fsPath);
      return new DocxDocument(uri, buffer, size);
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
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'office-preview.js')
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
        case 'ready': {
          const app = await this.resolveExternalApp();
          webviewPanel.webview.postMessage({
            type: 'wordStatus',
            hasWord: app.appName === 'Microsoft Word',
            openLabel: app.label,
          });
          await this.sendDocxData(document, webviewPanel.webview);
          break;
        }
        case 'refresh':
          await this.handleRefresh(document, webviewPanel.webview);
          break;
        case 'openInExternalApp':
          await this.openExternally(document.uri.fsPath);
          break;
        case 'saveAsMarkdown':
          await saveAsMarkdownHandler(
            message.payload as SaveAsMarkdownPayload,
            document.uri,
            webviewPanel.webview
          );
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
    const filename = path.basename(document.uri.fsPath);

    // R5: look before sending. A refused file gets a plain reason and a way out.
    const verdict: PackageVerdict = document.sizeBytes > OFFICE_PREVIEW_LIMITS.maxFileBytes
      ? { ok: false, reason: 'too-large', bytes: document.sizeBytes }
      : checkOfficePackage(document.buffer, 'word/');
    if (!verdict.ok) {
      const app = await this.resolveExternalApp();
      const { title, detail } = describeProblem(verdict, 'Word document', app.appName ?? 'another app');
      webview.postMessage({ type: 'loadError', filename, title, detail });
      return;
    }

    const base64 = document.buffer.toString('base64');
    webview.postMessage({
      type: 'load',
      fileType: 'docx',
      content: base64,
      encoding: 'base64',
      filename: filename,
      sizeBytes: document.buffer.length,
      features: {
        voiceDictation: isEnabled('voice-dictation'),
        markdownExport: isEnabled('markdown-export'),
        saveAsMarkdownFromPreview: isEnabled('save-as-markdown-from-preview')
      }
    });
  }

  private async handleRefresh(document: DocxDocument, webview: vscode.Webview): Promise<void> {
    try {
      const { size } = await fs.stat(document.uri.fsPath);
      document.sizeBytes = size;
      document.buffer = size > OFFICE_PREVIEW_LIMITS.maxFileBytes ? Buffer.alloc(0) : await fs.readFile(document.uri.fsPath);
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
  <title>Word Preview</title>
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

  /** Word if installed; on a Mac, Pages if installed; otherwise the system default. Checked once. */
  private resolveExternalApp(): Promise<ExternalApp> {
    this.externalApp ??= (async (): Promise<ExternalApp> => {
      if (await isAppInstalled('Microsoft Word')) return { label: 'Open in Word', appName: 'Microsoft Word' };
      if (getCurrentPlatform() === 'darwin' && (await isAppInstalled('Pages'))) return { label: 'Open in Pages', appName: 'Pages' };
      return { label: 'Open in default app', appName: null };
    })();
    return this.externalApp;
  }

  private async openExternally(filePath: string): Promise<void> {
    const app = await this.resolveExternalApp();
    const name = app.appName ?? 'the default app';
    try {
      if (app.appName && getCurrentPlatform() === 'darwin') await openInExternalApp(filePath, app.appName);
      else await openWithDefaultApp(filePath);
      vscode.window.showInformationMessage(`Opening in ${name}...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to open in ${name}: ${errorMessage}`);
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
