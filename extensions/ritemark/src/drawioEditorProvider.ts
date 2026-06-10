import * as vscode from 'vscode';
import * as path from 'path';
import { trackEvent } from './analytics/posthog';

/**
 * Custom editor provider for .drawio.svg files (Sprint 82, R1 + R3).
 *
 * Hosts the vendored draw.io webapp (media/drawio/, Apache 2.0) in an iframe
 * inside the editor webview and bridges VS Code <-> draw.io embed messages.
 * Clean-room implementation of the documented draw.io embed protocol
 * (?embed=1&proto=json): https://www.drawio.com/doc/faq/embed-mode
 *
 * Save flow (verified by the Phase 0 audit): the draw.io `save` event fires
 * on Ctrl+S inside the iframe; the bridge then requests `export xmlsvg`,
 * which returns the complete .drawio.svg file content (SVG with the diagram
 * XML embedded) — that string replaces the document text and is saved.
 * The `load` action accepts the full .drawio.svg file content directly,
 * so no XML extraction is needed on load either.
 */
export class DrawioEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'ritemark.drawioEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      DrawioEditorProvider.viewType,
      new DrawioEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    void trackEvent('feature_used', { feature: 'drawio_editor' });

    const drawioRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'drawio');

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [drawioRoot]
    };

    const drawioIndexUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(drawioRoot, 'index.html')
    );

    webviewPanel.webview.html = this.getEditorHtml(webviewPanel.webview, drawioIndexUri);

    // Tracks whether the latest document text came from our own save edit,
    // so a future external-change sync (if added) wouldn't echo. Also guards
    // against overlapping saves.
    let applyingSave = false;

    webviewPanel.webview.onDidReceiveMessage(async (message: { type: string; data?: string }) => {
      switch (message.type) {
        case 'drawio:ready':
          // The draw.io load action accepts the full .drawio.svg file text;
          // an empty string yields a blank canvas (new/empty files).
          webviewPanel.webview.postMessage({
            type: 'drawio:load',
            data: document.getText()
          });
          break;

        case 'drawio:save': {
          if (typeof message.data !== 'string' || applyingSave) {
            break;
          }
          applyingSave = true;
          try {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              document.uri,
              new vscode.Range(0, 0, document.lineCount, 0),
              message.data
            );
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
              await document.save();
              // Clear the modified indicator inside the draw.io editor.
              webviewPanel.webview.postMessage({ type: 'drawio:saved' });
            } else {
              vscode.window.showErrorMessage(
                `Failed to apply diagram changes to ${path.basename(document.uri.fsPath)}`
              );
            }
          } finally {
            applyingSave = false;
          }
          break;
        }
      }
    });
  }

  private getEditorHtml(webview: vscode.Webview, drawioIndexUri: vscode.Uri): string {
    const nonce = getNonce();
    // The iframe is a separate document: the drawio webapp's own scripts run in
    // the iframe context and are not constrained by this page's CSP. The outer
    // page only needs frame-src for the webview resource origin and a nonce
    // for the bridge script. Verified by the Sprint 82 Phase 0 audit.
    const iframeSrc = `${drawioIndexUri.toString()}?embed=1&proto=json&offline=1&lang=en&spin=1`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${webview.cspSource}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Draw.io Editor</title>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
    iframe { display: block; width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe id="drawio-frame" src="${iframeSrc}"></iframe>
  <script nonce="${nonce}">
    // Sprint 82 R3: bridge between the VS Code extension host and the
    // draw.io embed iframe (clean-room, documented JSON protocol).
    const vscode = acquireVsCodeApi();
    const frame = document.getElementById('drawio-frame');
    let pendingDocumentText = null;
    let drawioInitialized = false;

    function postToDrawio(msg) {
      frame.contentWindow.postMessage(JSON.stringify(msg), '*');
    }

    window.addEventListener('message', (event) => {
      // Messages from the extension host arrive as objects; messages from
      // the draw.io iframe arrive as JSON strings.
      if (typeof event.data === 'string') {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        switch (msg.event) {
          case 'init':
            drawioInitialized = true;
            if (pendingDocumentText !== null) {
              postToDrawio({ action: 'load', xml: pendingDocumentText, autosave: 0 });
              pendingDocumentText = null;
            }
            break;
          case 'save':
            // Ctrl+S inside draw.io: ask for the full .drawio.svg content.
            postToDrawio({ action: 'export', format: 'xmlsvg' });
            break;
          case 'export': {
            // data is a data:image/svg+xml;base64,... URL of the complete file.
            const base64 = (msg.data || '').split(',')[1] || '';
            const bytes = atob(base64);
            const buf = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) { buf[i] = bytes.charCodeAt(i); }
            const svg = new TextDecoder('utf-8').decode(buf);
            vscode.postMessage({ type: 'drawio:save', data: svg });
            break;
          }
        }
        return;
      }

      const msg = event.data;
      if (!msg || typeof msg.type !== 'string') { return; }
      switch (msg.type) {
        case 'drawio:load':
          if (drawioInitialized) {
            postToDrawio({ action: 'load', xml: msg.data, autosave: 0 });
          } else {
            pendingDocumentText = msg.data;
          }
          break;
        case 'drawio:saved':
          postToDrawio({ action: 'status', message: '', modified: false });
          break;
      }
    });

    vscode.postMessage({ type: 'drawio:ready' });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
