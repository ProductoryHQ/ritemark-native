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

    // The draw.io app runs DIRECTLY in the webview document — not in an iframe.
    // Both iframe strategies fail on desktop VS Code (verified empirically via
    // CDP, Sprint 82 QA): a vscode-resource src iframe loads an empty document
    // (iframe navigations bypass the webview service worker), and a srcdoc
    // iframe's subresources get 404s (the service worker authorizes requests by
    // client URL, and a srcdoc client reports about:srcdoc). The webview's own
    // document is the one client whose resource requests are served, so the
    // patched draw.io index.html becomes the webview HTML itself, with the
    // bridge script appended.
    const drawioHtmlRaw = Buffer.from(
      await vscode.workspace.fs.readFile(vscode.Uri.joinPath(drawioRoot, 'index.html'))
    ).toString('utf-8');
    const drawioBaseUri = webviewPanel.webview.asWebviewUri(drawioRoot).toString();

    webviewPanel.webview.html = this.getEditorHtml(
      webviewPanel.webview,
      drawioHtmlRaw,
      drawioBaseUri
    );

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

        case 'drawio:error':
          vscode.window.showErrorMessage(
            `Diagram save failed: ${message.data ?? 'unknown error'}`
          );
          break;

        case 'drawio:save': {
          if (typeof message.data !== 'string' || message.data.length === 0 || applyingSave) {
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

  private getEditorHtml(webview: vscode.Webview, drawioHtmlRaw: string, drawioBaseUri: string): string {
    const nonce = getNonce();

    // Prepare the draw.io document for srcdoc hosting:
    // Patch the vendored index.html into webview-hostable form:
    //  - <base> makes its relative subresources resolve to vscode-resource URIs
    //    (served by the webview service worker, scoped by localResourceRoots).
    //  - CSP: scripts/styles/images/fonts/XHR from the vendored bundle
    //    (cspSource), eval (mxGraph codecs), inline styles, data: images. All
    //    executable content is the bundle we vendored — not remote code.
    //  - draw.io reads its config from location.search, which the webview
    //    document does not carry — override the parsed urlParams right after
    //    bootstrap.js defines them (embed mode, JSON protocol, offline).
    //  - window.opener = <relay iframe>: draw.io's embed protocol partner is
    //    (embedMessageSource || window.opener || window.parent), and
    //    initializeEmbedMode() refuses to start when that partner IS the app's
    //    own window — so a plain self-alias is rejected, and window.parent is
    //    VS Code's wrapper (unreachable). The bridge therefore creates a tiny
    //    same-origin srcdoc iframe and points window.opener at it: draw.io
    //    accepts it as a distinct window, sends its events into it, and the
    //    relay hands them straight back to the bridge (same-origin function
    //    calls in both directions).
    //  - the bridge script is injected right after bootstrap.js — BEFORE
    //    js/main.js runs — so its message listener is registered before the
    //    draw.io app can emit its 'init' event.
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource} data:;">`;
    return drawioHtmlRaw
      .replace('<head>', `<head><base href="${drawioBaseUri}/">${csp}`)
      .replace(
        '<script src="js/bootstrap.js"></script>',
        `<script src="js/bootstrap.js"></script>` +
        `<script nonce="${nonce}">urlParams['embed']='1';urlParams['proto']='json';urlParams['offline']='1';urlParams['lang']='en';urlParams['spin']='1';</script>` +
        this.getBridgeScript(nonce)
      );
  }

  private getBridgeScript(nonce: string): string {
    return `<script nonce="${nonce}">
    // Sprint 82 R3: bridge between the VS Code extension host and the draw.io
    // app running in THIS document (clean-room, documented JSON protocol).
    // draw.io posts its embed events to window.opener, which is aliased to
    // this window above, so both sides of the protocol meet here.
    const vscode = acquireVsCodeApi();
    // Diagnostic trail (inspectable from devtools; harmless in production).
    const trace = window.__rmBridge = { loaded: true, events: [] };

    // Relay iframe — draw.io's embed protocol partner (see provider comment).
    // Same-origin srcdoc: the app posts its events INTO this window; the relay
    // hands the strings back to this bridge via a direct same-origin call, and
    // exposes a sender whose calls reach draw.io with event.source === relay,
    // which is what the app's installMessageHandler source-check requires.
    window.__rmFromDrawio = function (data) {
      if (typeof data === 'string') { handleDrawioMessage(data); }
    };
    const relay = document.createElement('iframe');
    relay.style.display = 'none';
    relay.setAttribute('aria-hidden', 'true');
    relay.srcdoc = '<script nonce="${nonce}">' +
      'window.addEventListener("message", function (e) {' +
      '  if (e.source === window.parent) { window.parent.__rmFromDrawio(e.data); }' +
      '});' +
      'window.__rmSend = function (s) { window.parent.postMessage(s, "*"); };' +
      '<\\/script>';
    document.documentElement.appendChild(relay);
    window.opener = relay.contentWindow;

    function postToDrawio(msg) {
      trace.events.push('out:' + msg.action);
      const send = relay.contentWindow && relay.contentWindow.__rmSend;
      if (send) { send(JSON.stringify(msg)); }
    }

    // Document delivery is retried until draw.io acks with its 'load' event:
    // the app registers its embed listener late in startup (and its 'init'
    // event does not reliably fire in this hosting mode), so a single load
    // post could land before anyone is listening. The first string draw.io
    // receives also pins its embedMessageSource to this window, which is what
    // routes the app's own save/export events back to this bridge.
    let documentText = null;
    let loadAcked = false;
    let loadAttempts = 0;

    function tryLoad() {
      if (loadAcked || documentText === null) { return; }
      if (loadAttempts++ > 30) { return; }
      postToDrawio({ action: 'load', xml: documentText, autosave: 0 });
      setTimeout(tryLoad, loadAttempts < 5 ? 400 : 1500);
    }

    // draw.io protocol events, delivered by the relay iframe.
    function handleDrawioMessage(data) {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.event) { trace.events.push('drawio:' + msg.event); }
      switch (msg.event) {
        case 'init':
          // App announced readiness — deliver immediately (retry loop also covers this).
          loadAcked = false;
          tryLoad();
          break;
        case 'load':
          // App acked the document — stop the retry loop.
          loadAcked = true;
          break;
        case 'save':
          // Ctrl+S inside draw.io: ask for the full .drawio.svg content.
          postToDrawio({ action: 'export', format: 'xmlsvg' });
          break;
        case 'export': {
          // data is a data:image/svg+xml;base64,... URL of the complete file.
          try {
            const base64 = (msg.data || '').split(',')[1] || '';
            const bytes = atob(base64);
            const buf = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) { buf[i] = bytes.charCodeAt(i); }
            const svg = new TextDecoder('utf-8').decode(buf);
            if (svg.length > 0) {
              vscode.postMessage({ type: 'drawio:save', data: svg });
            } else {
              vscode.postMessage({ type: 'drawio:error', data: 'draw.io returned an empty export — file not saved' });
            }
          } catch (e) {
            vscode.postMessage({ type: 'drawio:error', data: 'Failed to decode diagram export: ' + (e && e.message ? e.message : e) });
          }
          break;
        }
      }
    }

    // Extension-host messages (objects on the main window).
    window.addEventListener('message', (event) => {
      if (event.origin && event.origin !== window.origin) { return; }
      const msg = event.data;
      if (!msg || typeof msg.type !== 'string') { return; }
      // Keep host objects away from the draw.io message handler.
      event.stopImmediatePropagation();
      trace.events.push('host:' + msg.type);
      switch (msg.type) {
        case 'drawio:load':
          documentText = msg.data;
          loadAcked = false;
          loadAttempts = 0;
          tryLoad();
          break;
        case 'drawio:saved':
          postToDrawio({ action: 'status', message: '', modified: false });
          break;
      }
    });

    vscode.postMessage({ type: 'drawio:ready' });
  </script>`;
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
