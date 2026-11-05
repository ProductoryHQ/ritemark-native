/**
 * The Publish sheet's host side (Sprint 149, R4, R5, W3): shows a plan's sheet and waits for the person's answer.
 *
 * Sends nothing anywhere: it only asks. The answer is `cancel`, `publish`, or `publishAnyway` (the second, explicit
 * press past a key warning, decision 2); PR 4 does the publishing after it. Closing the sheet (Escape, Cancel) is Cancel.
 *
 * The sheet gets names, folders, reasons and line numbers (`sheetModel.ts`); the only file it can ask to open is a
 * hit, by its index in this plan's own list (Open script.js). Open closes the sheet without publishing and opens the
 * file's text, a page's too, as a tab on the same desk, with the key selected as Find selects (the Experience lead,
 * 5 November). Publish on the bar then gathers and scans again. No token or value ever reaches the sheet.
 *
 * Where it shows (PR 5): over the whole window, centred, the window dimmed behind it, never a tab (the lead, 5
 * November; publish.html frame 3). The workbench draws that frame (patch 018, `_ritemark.webviewSheet`); the page is
 * this extension's webview view `ritemark.sheet.publish`, registered here once (`webviewSheet.ts`). A shell without the
 * sheet answers cancel: Publish on the bar needs a 2.2 shell anyway.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { closeWebviewSheet, openWebviewSheet } from '../webviewSheet/webviewSheet';
import { sheetModelOf } from './sheetModel';
import { isSheetWebviewMessage, PublishSheetHostMessage, PublishSheetModel } from './sheetProtocol';
import type { KeyHit, PublishPlan } from './types';

export const PUBLISH_SHEET_VIEW_TYPE = 'ritemark.sheet.publish';

export type SheetAnswer = { kind: 'cancel' } | { kind: 'publish' | 'publishAnyway'; pagePart?: string };

export interface ShowSheetOptions {
  /** PR 4: where and the address. */
  destination?: PublishSheetModel['destination'];
  address?: PublishSheetModel['address'];
}

/** The view type's one provider: each sheet the workbench opens is handed to the request that asked for it. */
class PublishSheetViews implements vscode.WebviewViewProvider {
  next: ((view: vscode.WebviewView) => void) | undefined;
  resolveWebviewView(view: vscode.WebviewView): void {
    const take = this.next;
    this.next = undefined;
    if (take) take(view);
    else void closeWebviewSheet(PUBLISH_SHEET_VIEW_TYPE); // nobody asked: an empty sheet never stays
  }
}
let views: PublishSheetViews | undefined;
function publishSheetViews(context: vscode.ExtensionContext): PublishSheetViews {
  if (!views) {
    const created = new PublishSheetViews();
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(PUBLISH_SHEET_VIEW_TYPE, created),
      { dispose: () => { if (views === created) views = undefined; } },
    );
    views = created;
  }
  return views;
}

export function showPublishSheet(
  context: vscode.ExtensionContext,
  plan: PublishPlan,
  options: ShowSheetOptions = {},
): Promise<SheetAnswer> {
  const projectName = path.basename(plan.projectFolder);
  const model: PublishSheetModel = { ...sheetModelOf(plan, projectName), ...options };
  const media = vscode.Uri.joinPath(context.extensionUri, 'media');
  const sheets = publishSheetViews(context);
  // The desk the sheet opened over: the sheet takes no group, so it is the active one, read before the sheet shows
  const desk = vscode.window.tabGroups?.activeTabGroup?.viewColumn ?? vscode.ViewColumn.Active;

  return new Promise<SheetAnswer>((resolve) => {
    let answered = false;
    const subscriptions: vscode.Disposable[] = [];
    const answer = async (a: SheetAnswer): Promise<void> => {
      if (answered) return;
      answered = true;
      resolve(a);
      await closeWebviewSheet(PUBLISH_SHEET_VIEW_TYPE);
    };

    const take = (view: vscode.WebviewView): void => {
      view.webview.options = { enableScripts: true, localResourceRoots: [media] };
      view.webview.html = publishSheetHtml(view.webview, context.extensionUri);
      subscriptions.push(
        view.onDidDispose(() => {
          for (const s of subscriptions) s.dispose();
          void answer({ kind: 'cancel' });
        }),
        view.webview.onDidReceiveMessage((message: unknown) => {
          if (!isSheetWebviewMessage(message)) return;
          switch (message.type) {
            case 'publish:sheetReady': {
              const out: PublishSheetHostMessage = { type: 'publish:sheet', model };
              void view.webview.postMessage(out);
              break;
            }
            case 'publish:cancel':
              void answer({ kind: 'cancel' });
              break;
            case 'publish:confirm':
              // "Publish anyway" counts only when the plan has hits; a plain Publish never skips the warning
              if (plan.keyHits.length > 0 && !message.anyway) return;
              if (plan.tooBig.length > 0 || plan.tooMany) return;
              void answer({ kind: plan.keyHits.length > 0 ? 'publishAnyway' : 'publish', pagePart: message.pagePart });
              break;
            case 'publish:openHit': {
              const hit = plan.keyHits[message.index];
              if (!hit) return;
              // the sheet goes first (the focus back on the bar), then the file opens on that desk and takes the focus
              void answer({ kind: 'cancel' }).then(() => openKeyPlace(hit, desk));
              break;
            }
          }
        }),
      );
    };
    sheets.next = take;

    void openWebviewSheet({ viewType: PUBLISH_SHEET_VIEW_TYPE, title: `Publish ${model.title}` }).then(
      (outcome) => {
        if (sheets.next === take) sheets.next = undefined; // never shown (no sheet in this shell, or one already showing)
        if (outcome !== 'escape' && outcome !== 'closed') console.log(`[publish] the sheet did not show: ${outcome}`);
        void answer({ kind: 'cancel' });
      },
      () => void answer({ kind: 'cancel' }),
    );
  });
}

/**
 * Opens the file's text in the text editor (`'default'`: an `.html` page opens as text, not in the browser) as a tab
 * on the desk the sheet was on. With the key's columns the key is selected, as Find selects; else the caret at the
 * line's start.
 */
export function keyPlaceSelection(hit: Pick<KeyHit, 'line' | 'column' | 'endColumn'>): vscode.Range {
  const line = Math.max(0, hit.line - 1);
  const known = typeof hit.column === 'number' && typeof hit.endColumn === 'number' && hit.endColumn > hit.column;
  return known
    ? new vscode.Range(new vscode.Position(line, hit.column!), new vscode.Position(line, hit.endColumn!))
    : new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0));
}

async function openKeyPlace(hit: KeyHit, viewColumn: vscode.ViewColumn): Promise<void> {
  await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(hit.realPath), 'default', {
    selection: keyPlaceSelection(hit),
    viewColumn,
    preview: false,
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
    /* The workbench's sheet is as tall as this page and draws the desk's colour behind it (patch 018), so the page
       keeps its own height (no 100%) and no background */
    html body { color: var(--vscode-foreground); background: transparent; }
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
