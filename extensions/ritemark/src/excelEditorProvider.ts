import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ExcelDocument } from './excelDocument';

const execAsync = promisify(exec);

/**
 * Custom editor provider for Excel files (.xlsx, .xls)
 * Provides read-only preview with multi-sheet support
 */
export class ExcelEditorProvider implements vscode.CustomReadonlyEditorProvider<ExcelDocument> {

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

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      async message => {
        switch (message.type) {
          case 'ready':
            // Webview is ready, send Excel data ONCE
            // Client-side caching: webview will parse and cache all sheets
            this.sendExcelData(webviewPanel.webview, document);
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
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
   * Returns true if Excel is found, false otherwise
   */
  private async checkExcelInstalled(): Promise<boolean> {
    try {
      // macOS: Use 'open -Ra' to check if app exists without launching it
      await execAsync('open -Ra "Microsoft Excel"');
      return true;
    } catch (error) {
      // Excel not found
      return false;
    }
  }

  /**
   * Open file in external application
   * @param filePath Absolute path to the file
   * @param app App identifier ('excel' or 'numbers')
   */
  private async openInExternalApp(filePath: string, app: string): Promise<void> {
    try {
      const appName = app === 'excel' ? 'Microsoft Excel' : 'Numbers';

      // macOS: Use 'open -a' to open file with specific app
      await execAsync(`open -a "${appName}" "${filePath}"`);

      vscode.window.showInformationMessage(`Opening in ${appName}...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to open in ${app}: ${errorMessage}`);
    }
  }
}
