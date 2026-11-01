/**
 * The control catalogue's panel (Sprint 146, R2): a webview tab of every shared control in every state, for the
 * Experience lead's approval and `scripts/qa/control-states.mjs`.
 *
 * It opens at activation only when Ritemark was started with `RITEMARK_CONTROL_CATALOGUE=1`, an environment variable
 * only test scripts set, in a dev instance and in a release build alike, so Gate 1 runs the same check on every
 * candidate (decision 5), and its flag (`control-catalogue` in `features/flags.ts`, ON: a code-level kill switch) is
 * on. Otherwise nothing is registered: no command, menu or palette entry, no serializer. The page
 * is the shared bundle (`data-editor-type="control-catalogue"`) with the same CSP as Home; it reads nothing from the
 * host and its one message, its ready note, needs no answer.
 */

import * as vscode from 'vscode';
import { isEnabled } from '../features';

export const CONTROL_CATALOGUE_VIEW_TYPE = 'ritemark.controlCatalogue';
export const CONTROL_CATALOGUE_SETTING = 'RITEMARK_CONTROL_CATALOGUE';

/** Whether this launch asked for the catalogue (pure, tested): the setting is exactly "1". */
export function controlCatalogueAsked(env: Record<string, string | undefined>): boolean {
  return env[CONTROL_CATALOGUE_SETTING] === '1';
}

/** At activation: open the catalogue as a tab on the desk, only when the launch asked for it and its flag is on. */
export function openControlCatalogueIfAsked(
  context: vscode.ExtensionContext,
  env: Record<string, string | undefined> = process.env,
  flagOn: () => boolean = () => isEnabled('control-catalogue'),
): void {
  if (!controlCatalogueAsked(env) || !flagOn()) return;
  const media = vscode.Uri.joinPath(context.extensionUri, 'media');
  const panel = vscode.window.createWebviewPanel(
    CONTROL_CATALOGUE_VIEW_TYPE,
    'Control catalogue',
    { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] },
  );
  panel.webview.html = controlCatalogueHtml(panel.webview, context.extensionUri);
  context.subscriptions.push(panel);
}

export function controlCatalogueHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = nonceOf();
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js'));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:;">
  <title>Control catalogue</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  </style>
</head>
<body>
  <div id="root" data-editor-type="control-catalogue"></div>
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
