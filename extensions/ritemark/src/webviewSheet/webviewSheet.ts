/**
 * The whole-window sheet for a webview (Sprint 149, PR 5): the workbench (patch 018, `ritemarkWebviewSheet.ts`) shows a
 * webview view of this extension centred over the dimmed window, drawn as the feedback sheet is. It is never a tab.
 *
 * Register a `WebviewViewProvider` for a view type that starts with `ritemark.sheet.` (no `views` contribution; the
 * shell refuses any other name, a contributed view and another extension's provider), then
 * `openWebviewSheet`: the provider's `resolveWebviewView` fills the sheet in, its `webviewView.onDidDispose` fires as
 * the sheet closes, and the promise resolves with how it closed. The sheet is as tall as the page's `<html>` (so the
 * page must not give it a 100% height), up to the window's height less 64; the page draws its own padding and leaves
 * its background transparent, so the sheet's desk colour shows.
 */

import * as vscode from 'vscode';

export const WEBVIEW_SHEET_OPEN_COMMAND = '_ritemark.webviewSheet.open';
export const WEBVIEW_SHEET_CLOSE_COMMAND = '_ritemark.webviewSheet.close';

/** How the sheet closed; `unavailable` when the shell has no sheet (older than 2.2), so the caller can do without. */
export type WebviewSheetOutcome = 'escape' | 'closed' | 'refused' | 'failed' | 'unavailable';

export interface WebviewSheetRequest {
  readonly viewType: string;
  /** For screen readers: the sheet's name. */
  readonly title?: string;
  /** 440 when not given (the lead's), held between 280 and 960. */
  readonly width?: number;
}

const OUTCOMES: readonly WebviewSheetOutcome[] = ['escape', 'closed', 'refused', 'failed'];

/** Whether this shell has the sheet. */
export async function hasWebviewSheet(): Promise<boolean> {
  return (await vscode.commands.getCommands(false)).includes(WEBVIEW_SHEET_OPEN_COMMAND);
}

/** Show the view type's webview in the sheet; resolves when it closes. */
export async function openWebviewSheet(request: WebviewSheetRequest): Promise<WebviewSheetOutcome> {
  if (!(await hasWebviewSheet())) return 'unavailable';
  const outcome = await vscode.commands.executeCommand<unknown>(WEBVIEW_SHEET_OPEN_COMMAND, request);
  return OUTCOMES.includes(outcome as WebviewSheetOutcome) ? (outcome as WebviewSheetOutcome) : 'failed';
}

/** Close the sheet showing `viewType`; true when it was showing. */
export async function closeWebviewSheet(viewType: string): Promise<boolean> {
  return (await vscode.commands.executeCommand<unknown>(WEBVIEW_SHEET_CLOSE_COMMAND, { viewType })) === true;
}
