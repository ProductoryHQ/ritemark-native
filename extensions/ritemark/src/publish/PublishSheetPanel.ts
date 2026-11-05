/**
 * The Publish sheet's host side (Sprint 149, R4, R5, W3): shows a plan's sheet and waits for the person's answer.
 *
 * Sends nothing anywhere: it only asks. The answer is `cancel`, `publish`, or `publishAnyway` (the second, explicit
 * press past a key warning, decision 2); PR 4 does the publishing after it. Closing the sheet's tab is Cancel.
 *
 * The sheet gets names, folders, reasons and line numbers (`sheetModel.ts`); the only file it can ask to open is a
 * hit, by its index in this plan's own list (Open script.js). Open closes the sheet without publishing and opens the
 * file's text, a page's too, as a tab on the same desk, with the key selected as Find selects (the Experience lead,
 * 5 November). Publish on the bar then gathers and scans again. No token or value ever reaches the sheet.
 *
 * PR 4 wires it (`PublishController.publishFromBar`): frame 2 first while nothing is set up (`setup`, whose Set up
 * opens the host's own password box and carries no value), the name row and the address field, and `onConfirm`,
 * which checks a press of Publish on the host (the page part, the workers.dev name, an address already taken) before
 * the sheet closes, so "This name is taken. Try another." shows in the sheet and Publish waits. The page part the
 * sheet sends is checked here too (`isValidPagePart`), before anything else sees it.
 *
 * Until the whole-window sheet host lands (PR 5), nothing in a menu reaches this but the dev harness
 * (`devSheetHarness.ts`), which opens it as a tab with the sheet over a dimmed backdrop. The lead's place for it is over the whole window; that needs one command in patch 018
 * (`docs/development/releases/v2.2.0/sprint-149-publish/research/sheet-host.md`), built as its own shell PR.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { sheetModelOf, type SheetConfirm, type SheetConfirmReply, type SheetOptions, type SheetSetupResult } from './sheetModel';
import { isSheetWebviewMessage, isValidPagePart, PublishSheetHostMessage, PublishSheetModel, PublishSetupModel } from './sheetProtocol';
import type { KeyHit, PublishPlan } from './types';

export const PUBLISH_SHEET_VIEW_TYPE = 'ritemark.publishSheet';

export type SheetAnswer =
  | { kind: 'cancel' }
  | { kind: 'publish' | 'publishAnyway'; pagePart?: string; subdomain?: string; plan: PublishPlan };

export interface ShowSheetOptions extends SheetOptions {
  /** PR 4: a press of Publish, checked on the host before the sheet closes. Without it, the sheet closes at once. */
  onConfirm?: (confirm: SheetConfirm) => Promise<SheetConfirmReply>;
  /** PR 4: frame 2 first, while nothing is set up. `title` is the page's name; `run` is Set up. */
  setup?: { title: string; run: () => Promise<SheetSetupResult> };
}

export function showPublishSheet(
  context: vscode.ExtensionContext,
  firstPlan: PublishPlan | null,
  firstOptions: ShowSheetOptions = {},
): Promise<SheetAnswer> {
  const { onConfirm, setup, ...shown } = firstOptions;
  if (!firstPlan && !setup) return Promise.resolve({ kind: 'cancel' });
  let plan: PublishPlan | null = firstPlan;
  let model: PublishSheetModel | null = null;
  const modelFor = (p: PublishPlan, o: SheetOptions): PublishSheetModel => ({ ...sheetModelOf(p, path.basename(p.projectFolder)), ...o });
  if (plan) model = modelFor(plan, shown);
  let setupModel: PublishSetupModel = { waiting: false, line: null };
  const title = model?.title ?? setup!.title;
  const media = vscode.Uri.joinPath(context.extensionUri, 'media');
  const panel = vscode.window.createWebviewPanel(
    PUBLISH_SHEET_VIEW_TYPE,
    `Publish ${title}`,
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
    const post = (out: PublishSheetHostMessage) => { void panel.webview.postMessage(out); };
    const show = () => post(model ? { type: 'publish:sheet', model } : { type: 'publish:setup', setup: setupModel });
    let confirming = false;
    let settingUp = false;
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
          case 'publish:sheetReady':
            show();
            break;
          case 'publish:cancel':
            answer({ kind: 'cancel' });
            break;
          case 'publish:setUp': {
            // Frame 2's Set up: no value rides on it; the host's own box asks for the token
            if (model || !setup || settingUp) return;
            settingUp = true;
            setupModel = { waiting: true, line: null };
            show();
            void setup.run().then(
              (result) => {
                settingUp = false;
                if (answered) return;
                if (result && 'stop' in result) return answer({ kind: 'cancel' });
                if (result) {
                  plan = result.plan;
                  model = modelFor(result.plan, result.options);
                  panel.title = `Publish ${model.title}`;
                } else {
                  setupModel = { waiting: false, line: null };
                }
                show();
              },
              () => { settingUp = false; answer({ kind: 'cancel' }); },
            );
            break;
          }
          case 'publish:confirm': {
            const current = plan;
            if (!current || !model || confirming) return;
            // "Publish anyway" counts only when the plan has hits; a plain Publish never skips the warning
            if (current.keyHits.length > 0 && !message.anyway) return;
            if (current.tooBig.length > 0 || current.tooMany) return;
            // The page part names a Worker: checked here before anything else sees it (PR 3's blocking item)
            if (model.address?.editable && !isValidPagePart(message.pagePart)) {
              post({ type: 'publish:refused', reason: 'addressInvalid' });
              return;
            }
            const pagePart = model.address?.editable ? message.pagePart : undefined;
            const subdomain = model.nameRow ? message.subdomain : undefined;
            const done = () => answer({ kind: current.keyHits.length > 0 ? 'publishAnyway' : 'publish', pagePart, subdomain, plan: current });
            if (!onConfirm) return done();
            confirming = true;
            void onConfirm({ anyway: message.anyway, pagePart, subdomain }).then(
              (reply) => {
                confirming = false;
                if (answered) return;
                switch (reply.kind) {
                  case 'close': return done();
                  case 'stop': return answer({ kind: 'cancel' });
                  case 'refuse': return post({ type: 'publish:refused', reason: reply.reason });
                  case 'update':
                    model = modelFor(current, reply.options);
                    return show();
                }
              },
              () => { confirming = false; answer({ kind: 'cancel' }); },
            );
            break;
          }
          case 'publish:openHit': {
            const hit = plan?.keyHits[message.index];
            if (!hit) return;
            // the desk the sheet is on, read before the sheet goes
            const column = panel.viewColumn ?? vscode.ViewColumn.Active;
            answer({ kind: 'cancel' });
            void openKeyPlace(hit, column);
            break;
          }
        }
      }),
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
