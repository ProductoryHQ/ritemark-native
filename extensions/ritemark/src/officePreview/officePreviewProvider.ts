import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OfficeDocument } from './officeDocument';
import { isAppInstalled, openInExternalApp, openWithDefaultApp } from '../utils/openExternal';
import { getCurrentPlatform } from '../utils/platform';
import { OFFICE_PREVIEW_LIMITS, checkOfficePackage, describeProblem, type PackageVerdict } from './officePackageCheck';
import { trackEvent } from '../analytics/posthog';
import { isEnabled } from '../features';
import { saveAsMarkdownHandler, type SaveAsMarkdownPayload } from '../export/saveAsMarkdown';

/** One app "Open externally" may send the file to. */
interface ExternalAppChoice {
  appName: string;
  label: string;
  /** Only looked for on macOS (Pages, Keynote). */
  macOnly?: boolean;
}

/** Where "Open externally" sends the file: the first installed choice, else the system default. */
interface ExternalApp {
  label: string;
  /** null: the system's default app for the file */
  appName: string | null;
}

/** What differs between the Office previews. Everything else is shared. */
export interface OfficeFormat {
  viewType: string;
  fileType: 'docx' | 'pptx';
  /** The folder the format keeps its parts in (`word/`, `ppt/`). */
  partPrefix: string;
  /** How messages name the file: "This {kind} is password-protected". */
  kind: string;
  /** The webview page's title. */
  title: string;
  /** The feature's name in a sentence: "The PowerPoint preview is turned off". */
  previewName: string;
  analyticsFeature: string;
  apps: readonly ExternalAppChoice[];
  /** Whether the preview is on; when it is off the tab says so and offers the app. */
  enabled: () => boolean;
  /** Feature state the webview needs. */
  features: () => Record<string, boolean>;
  /** The format supports Save as Markdown from the preview. */
  saveAsMarkdown: boolean;
}

export const WORD_FORMAT: OfficeFormat = {
  viewType: 'ritemark.docxViewer',
  fileType: 'docx',
  partPrefix: 'word/',
  kind: 'Word document',
  title: 'Word Preview',
  previewName: 'Word preview',
  analyticsFeature: 'word_preview',
  apps: [
    { appName: 'Microsoft Word', label: 'Open in Word' },
    { appName: 'Pages', label: 'Open in Pages', macOnly: true },
  ],
  enabled: () => true,
  features: () => ({
    voiceDictation: isEnabled('voice-dictation'),
    markdownExport: isEnabled('markdown-export'),
    saveAsMarkdownFromPreview: isEnabled('save-as-markdown-from-preview'),
  }),
  saveAsMarkdown: true,
};

/** Sprint 125 (#285): PowerPoint decks, behind the default-on `powerpoint-preview` kill switch. */
export const POWERPOINT_FORMAT: OfficeFormat = {
  viewType: 'ritemark.pptxViewer',
  fileType: 'pptx',
  partPrefix: 'ppt/',
  kind: 'presentation',
  title: 'PowerPoint Preview',
  previewName: 'PowerPoint preview',
  analyticsFeature: 'powerpoint_preview',
  apps: [
    { appName: 'Microsoft PowerPoint', label: 'Open in PowerPoint' },
    { appName: 'Keynote', label: 'Open in Keynote', macOnly: true },
  ],
  enabled: () => isEnabled('powerpoint-preview'),
  features: () => ({}),
  saveAsMarkdown: false,
};

/**
 * Read-only preview of an Office file, drawn in the webview from its own bundle
 * (media/office-preview.js, Sprint 124 #284). The host checks each file before
 * sending it (R5), follows the file on disk, and opens it in the format's app.
 * Sprint 125 (#285): one provider for Word and PowerPoint, configured by `OfficeFormat`.
 */
export class OfficePreviewProvider implements vscode.CustomReadonlyEditorProvider<OfficeDocument> {
  private fileWatchers = new Map<string, vscode.FileSystemWatcher>();
  private fileChangeDebounceTimers = new Map<string, NodeJS.Timeout>();
  private externalApp: Promise<ExternalApp> | null = null;

  public static register(context: vscode.ExtensionContext, format: OfficeFormat): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      format.viewType,
      new OfficePreviewProvider(context, format),
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    );
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly format: OfficeFormat,
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<OfficeDocument> {
    try {
      const { size } = await fs.stat(uri.fsPath);
      const buffer = size > OFFICE_PREVIEW_LIMITS.maxFileBytes ? Buffer.alloc(0) : await fs.readFile(uri.fsPath);
      return new OfficeDocument(uri, buffer, size);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read ${this.format.kind}: ${message}`);
    }
  }

  async resolveCustomEditor(
    document: OfficeDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    void trackEvent('feature_used', { feature: this.format.analyticsFeature });

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
          webviewPanel.webview.postMessage({ type: 'openStatus', openLabel: app.label });
          await this.sendDocument(document, webviewPanel.webview);
          break;
        }
        case 'refresh':
          await this.handleRefresh(document, webviewPanel.webview);
          break;
        case 'openInExternalApp':
          await this.openExternally(document.uri.fsPath);
          break;
        case 'openLink':
          // Sprint 125 R7: a link on a slide. Only web links leave the preview, and
          // they go through VS Code, which asks before opening an untrusted site.
          await this.openLink(message.url);
          break;
        case 'saveAsMarkdown':
          if (!this.format.saveAsMarkdown) break;
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

  private async sendDocument(document: OfficeDocument, webview: vscode.Webview): Promise<void> {
    const filename = path.basename(document.uri.fsPath);
    const app = await this.resolveExternalApp();
    const appName = app.appName ?? 'another app';

    // The kill switch: the editor stays registered, so say the preview is off and offer the app.
    if (!this.format.enabled()) {
      webview.postMessage({
        type: 'loadError',
        fileType: this.format.fileType,
        filename,
        title: `The ${this.format.previewName} is turned off`,
        detail: `Open it in ${appName} to see it.`,
      });
      return;
    }

    // R5: look before sending. A refused file gets a plain reason and a way out.
    const verdict: PackageVerdict = document.sizeBytes > OFFICE_PREVIEW_LIMITS.maxFileBytes
      ? { ok: false, reason: 'too-large', bytes: document.sizeBytes }
      : await checkOfficePackage(document.buffer, this.format.partPrefix);
    if (!verdict.ok) {
      const { title, detail } = describeProblem(verdict, this.format.kind, appName);
      webview.postMessage({ type: 'loadError', fileType: this.format.fileType, filename, title, detail });
      return;
    }

    webview.postMessage({
      type: 'load',
      fileType: this.format.fileType,
      content: document.buffer.toString('base64'),
      encoding: 'base64',
      filename: filename,
      sizeBytes: document.buffer.length,
      features: this.format.features(),
    });
  }

  private async handleRefresh(document: OfficeDocument, webview: vscode.Webview): Promise<void> {
    try {
      const { size } = await fs.stat(document.uri.fsPath);
      document.sizeBytes = size;
      document.buffer = size > OFFICE_PREVIEW_LIMITS.maxFileBytes ? Buffer.alloc(0) : await fs.readFile(document.uri.fsPath);
      await this.sendDocument(document, webview);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to refresh the ${this.format.kind}: ${message}`);
    }
  }

  private async openLink(url: unknown): Promise<void> {
    if (typeof url !== 'string') return;
    let parsed: vscode.Uri;
    try {
      parsed = vscode.Uri.parse(url, true);
    } catch {
      return;
    }
    if (parsed.scheme !== 'https' && parsed.scheme !== 'http') return;
    await vscode.env.openExternal(parsed);
  }

  private getHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
    const nonce = this.getNonce();
    // CSP: style-src unsafe-inline for the renderers' generated styles,
    // img-src data: blob: for embedded images, font-src data: for embedded fonts
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} data: blob:;">
  <title>${this.format.title}</title>
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

  /** The first of the format's apps that is installed; otherwise the system default. Checked once. */
  private resolveExternalApp(): Promise<ExternalApp> {
    this.externalApp ??= (async (): Promise<ExternalApp> => {
      const mac = getCurrentPlatform() === 'darwin';
      for (const choice of this.format.apps) {
        if (choice.macOnly && !mac) continue;
        if (await isAppInstalled(choice.appName)) return { label: choice.label, appName: choice.appName };
      }
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

  private createFileWatcher(document: OfficeDocument, webview: vscode.Webview): void {
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

  private handleFileChange(document: OfficeDocument, webview: vscode.Webview): void {
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
