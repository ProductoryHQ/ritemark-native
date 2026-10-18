/**
 * The welcome's webview HTML (Sprint 133, R1, E4): the shared bundle, routed
 * by `data-editor-type="welcome"`. The header illustration, the white logo and
 * the title's font are files under `media/welcome/`, served to the page, never
 * inlined into `webview.js`.
 */

import * as vscode from 'vscode';

export const WELCOME_VIEW_TYPE = 'ritemark.welcome';

export function welcomeHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = nonceOf();
  const media = (...parts: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', ...parts));
  const scriptUri = media('webview.js');
  const heroUri = media('welcome', 'welcome-hero.jpg');
  const logoUri = media('welcome', 'ritemark-logo-white.svg');
  const fontUri = media('welcome', 'SpaceGrotesk-latin.woff2');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Welcome</title>
  <style>
    @font-face {
      font-family: 'Space Grotesk';
      font-style: normal;
      font-weight: 300 700;
      font-display: block;
      src: url('${fontUri}') format('woff2');
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      color: var(--vscode-foreground);
      background: var(--vscode-ritemark-ground, var(--vscode-editor-background)) !important;
    }
  </style>
</head>
<body>
  <div id="root" data-editor-type="welcome" data-hero="${heroUri}" data-logo="${logoUri}"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function nonceOf(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let index = 0; index < 32; index += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
