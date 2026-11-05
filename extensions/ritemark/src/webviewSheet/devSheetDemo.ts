/**
 * The whole-window sheet's dev demo (Sprint 149, PR 5): a small page in the sheet, so the shell's
 * `_ritemark.webviewSheet` can be seen and checked before the Publish sheet uses it.
 *
 * Dev-only: it runs only in a development build (`VSCODE_DEV=1`, which `scripts/code.sh` and
 * `scripts/qa/dev-launch-isolated.sh` set and an installed Ritemark never has) started with
 * `RITEMARK_WEBVIEW_SHEET_DEMO` naming a trigger file. No command, menu or setting reaches it. Each time the trigger
 * file changes, the sheet opens; what happens (resolved, disposed, how it closed) is added to `<trigger>.log`.
 */

import * as fs from 'node:fs';
import * as vscode from 'vscode';
import { sheetDemoTrigger } from './sheetDemoTrigger';
import { closeWebviewSheet, openWebviewSheet } from './webviewSheet';

export const SHEET_DEMO_VIEW_TYPE = 'ritemark.sheet.devDemo';

export function registerWebviewSheetDemoIfAsked(context: vscode.ExtensionContext, env: Record<string, string | undefined> = process.env): void {
  const trigger = sheetDemoTrigger(env);
  if (!trigger) return;
  const log = (line: string) => fs.appendFileSync(`${trigger}.log`, `${new Date().toISOString()} ${line}\n`);

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(SHEET_DEMO_VIEW_TYPE, {
    resolveWebviewView(view) {
      log(`resolved visible=${view.visible}`);
      view.webview.options = { enableScripts: true, localResourceRoots: [] };
      view.webview.html = demoHtml(view.webview);
      view.onDidDispose(() => log('disposed'));
      view.webview.onDidReceiveMessage((message: unknown) => {
        if (message === 'close') void closeWebviewSheet(SHEET_DEMO_VIEW_TYPE).then((closed) => log(`close asked closed=${closed}`));
      });
    },
  }));

  let busy = false;
  const open = async () => {
    if (busy) return;
    busy = true;
    log('open');
    try {
      log(`outcome ${await openWebviewSheet({ viewType: SHEET_DEMO_VIEW_TYPE, title: 'Sheet demo' })}`);
    } finally {
      busy = false;
    }
  };
  fs.watchFile(trigger, { interval: 250 }, (current, previous) => {
    if (current.mtimeMs !== previous.mtimeMs && current.mtimeMs > 0) void open();
  });
  context.subscriptions.push({ dispose: () => fs.unwatchFile(trigger) });
}

function demoHtml(webview: vscode.Webview): string {
  const nonce = Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36))).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Sheet demo</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; background: transparent; color: var(--vscode-foreground); font: 13px/20px var(--vscode-font-family); }
    h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; line-height: 20px; }
    p { margin: 0 0 14px; }
    .more p { margin: 0 0 8px; }
    .foot { display: flex; justify-content: flex-end; gap: 8px; }
    button { height: 32px; padding: 0 14px; border-radius: 8px; border: none; font: inherit; cursor: pointer; white-space: nowrap; }
    button.ghost { background: transparent; color: var(--vscode-foreground); box-shadow: inset 0 0 0 1px var(--vscode-checkbox-border); }
    button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
  </style>
</head>
<body>
  <h3>Sheet demo</h3>
  <p>A webview of the extension, in the sheet over the whole window. Escape closes it.</p>
  <div class="more" id="more"></div>
  <div class="foot">
    <button class="ghost" id="grow" title="Adds a line, so the sheet grows">Grow</button>
    <button class="primary" id="close" title="Closes this">Close</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('grow').addEventListener('click', () => {
      const line = document.createElement('p');
      line.textContent = 'Line ' + (document.getElementById('more').children.length + 1) + ': the sheet follows the page\\'s height.';
      document.getElementById('more').appendChild(line);
    });
    document.getElementById('close').addEventListener('click', () => vscode.postMessage('close'));
    document.getElementById('close').focus();
    // The sheet gives the page the focus once it has drawn (round 3): Close keeps it, ringed
    window.addEventListener('focus', () => { if (document.activeElement === document.body) document.getElementById('close').focus(); });
  </script>
</body>
</html>`;
}
