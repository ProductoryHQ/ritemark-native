/**
 * The Publish sheet's host side (Sprint 149, R4, R5, W3): shows a plan's sheet and waits for the person's answer.
 *
 * Sends nothing anywhere: it only asks. The answer is `cancel`, `publish`, or `publishAnyway` (the second, explicit
 * press past a key warning, decision 2); PR 4 does the publishing after it. Closing the sheet's tab is Cancel.
 *
 * The sheet gets names, folders, reasons and line numbers (`sheetModel.ts`); the only file it can ask to open is a
 * hit, by its index in this plan's own list, at its line (Open script.js). No token or value ever reaches it.
 *
 * In PR 3 nothing in a menu reaches this: only the dev harness (`devSheetHarness.ts`) opens it.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { sheetModelOf } from './sheetModel';
import { isSheetWebviewMessage, PublishSheetHostMessage, PublishSheetModel } from './sheetProtocol';
import type { PublishPlan } from './types';

export const PUBLISH_SHEET_VIEW_TYPE = 'ritemark.publishSheet';

export type SheetAnswer = { kind: 'cancel' } | { kind: 'publish' | 'publishAnyway'; pagePart?: string };

export interface ShowSheetOptions {
  /** PR 4: where and the address. */
  destination?: PublishSheetModel['destination'];
  address?: PublishSheetModel['address'];
}

export function showPublishSheet(
  context: vscode.ExtensionContext,
  plan: PublishPlan,
  options: ShowSheetOptions = {},
): Promise<SheetAnswer> {
  const projectName = path.basename(plan.projectFolder);
  const model: PublishSheetModel = { ...sheetModelOf(plan, projectName), ...options };
  const media = vscode.Uri.joinPath(context.extensionUri, 'media');
  const panel = vscode.window.createWebviewPanel(
    PUBLISH_SHEET_VIEW_TYPE,
    `Publish ${model.title}`,
    { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] },
  );
  panel.webview.html = publishSheetHtml(panel.webview, context.extensionUri);

  return new Promise<SheetAnswer>((resolve) => {
    let answered = false;
    const answer = (a: SheetAnswer) => {
      if (answered) return;
      answered = true;
      resolve(a);
      panel.dispose();
    };
    const subscriptions: vscode.Disposable[] = [];
    subscriptions.push(
      panel.onDidDispose(() => {
        for (const s of subscriptions) s.dispose();
        if (!answered) {
          answered = true;
          resolve({ kind: 'cancel' });
        }
      }),
      panel.webview.onDidReceiveMessage((message: unknown) => {
        if (!isSheetWebviewMessage(message)) return;
        switch (message.type) {
          case 'publish:sheetReady': {
            const out: PublishSheetHostMessage = { type: 'publish:sheet', model };
            void panel.webview.postMessage(out);
            break;
          }
          case 'publish:cancel':
            answer({ kind: 'cancel' });
            break;
          case 'publish:confirm':
            // "Publish anyway" counts only when the plan has hits; a plain Publish never skips the warning
            if (plan.keyHits.length > 0 && !message.anyway) return;
            if (plan.tooBig.length > 0 || plan.tooMany) return;
            answer({ kind: plan.keyHits.length > 0 ? 'publishAnyway' : 'publish', pagePart: message.pagePart });
            break;
          case 'publish:openHit': {
            const hit = plan.keyHits[message.index];
            if (!hit) return;
            void openAtLine(hit.realPath, hit.line);
            break;
          }
        }
      }),
    );
  });
}

/** Opens the file as text at the line, beside the sheet (a page opens as text, not as the page). */
async function openAtLine(realPath: string, line: number): Promise<void> {
  const position = new vscode.Position(Math.max(0, line - 1), 0);
  await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(realPath), 'default', {
    selection: new vscode.Range(position, position),
    viewColumn: vscode.ViewColumn.Beside,
  });
}

export function publishSheetHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = nonceOf();
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Publish</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  </style>
</head>
<body>
  <div id="root" data-editor-type="publish-sheet"></div>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}

function nonceOf(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let index = 0; index < 32; index += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
