/**
 * The page's commands (Sprint 149, R2, W1):
 *
 * - `ritemark.page.openInSystemBrowser`: opens a local `.html` page, inside the project or not, in
 *   the system's default browser (`vscode.env.openExternal`). Today's `ritemark.browser.openInBrowser`
 *   (the integrated browser) is separate and unchanged.
 * - `ritemark.page.publish`: the way in for Publish. It refuses a page outside the open project by
 *   real path, before anything else. PR 4 adds the sheet behind it; until then no menu, button or
 *   palette entry reaches it (`package.json` hides both commands from the palette, and patch 010's
 *   bar arrives in PR 2, its Publish button gated on `ritemark.publish.ready`, which PR 4 sets).
 *
 * Both take the page as a `vscode.Uri` or a `file:` URL string (the bar passes the tab's URL).
 */

import * as vscode from 'vscode';
import { PageLocation, PageTarget, locatePage, localPagePath } from './localPage';

export const OPEN_IN_SYSTEM_BROWSER_COMMAND = 'ritemark.page.openInSystemBrowser';
export const PUBLISH_PAGE_COMMAND = 'ritemark.page.publish';

export const NOT_A_PAGE_MESSAGE = 'This works on a web page file (.html) on this computer.';
export const OUTSIDE_PROJECT_MESSAGE =
  'Only pages in this project can be published. Move the page into the project folder to publish it.';
export const MISSING_PAGE_MESSAGE = "This page's file can't be found. It may have been moved or deleted.";

function targetOf(arg: unknown): PageTarget | undefined {
  if (typeof arg === 'string') return arg;
  if (arg instanceof vscode.Uri) return arg;
  return vscode.window.activeTextEditor?.document.uri;
}

function projectFolders(): string[] {
  return (vscode.workspace.workspaceFolders ?? [])
    .filter((f) => f.uri.scheme === 'file')
    .map((f) => f.uri.fsPath);
}

export async function openPageInSystemBrowser(arg?: unknown): Promise<boolean> {
  const fsPath = localPagePath(targetOf(arg));
  if (!fsPath) {
    void vscode.window.showInformationMessage(NOT_A_PAGE_MESSAGE);
    return false;
  }
  return vscode.env.openExternal(vscode.Uri.file(fsPath));
}

/**
 * Publish's boundary check. Returns the page's location when it is a project page; shows the
 * reason and returns undefined otherwise. Nothing is read beyond the paths, and nothing is sent.
 */
export async function publishPage(arg?: unknown): Promise<PageLocation | undefined> {
  const fsPath = localPagePath(targetOf(arg));
  if (!fsPath) {
    void vscode.window.showInformationMessage(NOT_A_PAGE_MESSAGE);
    return undefined;
  }
  const location = await locatePage(fsPath, projectFolders());
  if (location.kind === 'outside') {
    void vscode.window.showInformationMessage(OUTSIDE_PROJECT_MESSAGE);
    return undefined;
  }
  if (location.kind === 'missing') {
    void vscode.window.showInformationMessage(MISSING_PAGE_MESSAGE);
    return undefined;
  }
  return location;
}

export function registerPageCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_IN_SYSTEM_BROWSER_COMMAND, openPageInSystemBrowser),
    vscode.commands.registerCommand(PUBLISH_PAGE_COMMAND, publishPage),
  );
}
