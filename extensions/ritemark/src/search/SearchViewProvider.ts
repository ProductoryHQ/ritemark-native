/**
 * Sprint 148, PR 2 (R6, R8): the results view, `ritemark.searchResults`, a
 * webview view in Documents (the `explorer` container). It shows only while the
 * shell's box holds words (`when: ritemark.searchOpen`, set by patch 018 in
 * PR 3), so on a shell without the box it never shows (E3).
 *
 * The page is the shared React bundle (`data-editor-type="search"`), on the
 * ground like the other left-column lists; every message from it is decoded
 * before the host acts on it.
 */
import { createHash } from 'node:crypto';
import * as vscode from 'vscode';
import { versionedWebviewAssetUri } from '../views/webviewAssetUri';
import { decodeSearchViewMessage, type SearchHostToViewMessage, type SearchViewToHostMessage } from './protocol';

export class SearchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ritemark.searchResults';
  private view: vscode.WebviewView | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onMessage: (message: SearchViewToHostMessage) => void,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')] };
    view.webview.html = searchHtml(view.webview, this.extensionUri);
    const received = view.webview.onDidReceiveMessage((raw: unknown) => {
      const message = decodeSearchViewMessage(raw);
      if (message) this.onMessage(message);
    });
    view.onDidDispose(() => {
      received.dispose();
      if (this.view === view) this.view = null;
    });
  }

  post(message: SearchHostToViewMessage): void {
    void this.view?.webview.postMessage(message);
  }

  /** Reveal the view with the keyboard in it. */
  async focus(): Promise<void> {
    await vscode.commands.executeCommand(`${SearchViewProvider.viewType}.focus`);
  }
}

function searchHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = createHash('sha256').update(`${Math.random()}${Date.now()}`).digest('hex').slice(0, 32);
  // Versioned by the bundle's change time, as the AI sheet's and the editor's are, so an extension update's bundle
  // isn't served from the webview's cache (the review of #636)
  const scriptPath = vscode.Uri.joinPath(extensionUri, 'media', 'webview.js');
  const script = versionedWebviewAssetUri(webview.asWebviewUri(scriptPath).toString(), scriptPath.fsPath);
  // The results scroll on the ground, as the other left-column lists do (index.css, html.rm-ground)
  return `<!DOCTYPE html>
<html lang="en" class="rm-ground">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Search</title>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; } html, body { min-height: 100%; }</style>
</head>
<body>
  <div id="root" data-editor-type="search"></div>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
