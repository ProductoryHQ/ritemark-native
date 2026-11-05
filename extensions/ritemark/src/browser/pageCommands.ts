/**
 * The page's commands (Sprint 149, R2, W1):
 *
 * - `ritemark.page.openInSystemBrowser`: opens a local `.html` page, inside the project or not, in
 *   the system's default browser (`vscode.env.openExternal`). Today's `ritemark.browser.openInBrowser`
 *   (the integrated browser) is separate and unchanged.
 * - `ritemark.page.publish`: the way in for Publish. It refuses a page outside the open project by
 *   real path, before anything else, then hands the project page to PR 4's publish flow
 *   (`setPublishHandler`: the sheet, the gather and the upload). `package.json` hides both commands
 *   from the palette, and patch 010's Publish shows only once `ritemark.publish.ready` is set, which
 *   needs the whole-window sheet host (PR 5).
 *
 * Both take the page as a `vscode.Uri` or a `file:` URL string (the bar passes the tab's URL).
 */

import * as vscode from 'vscode';
import { isEnabled } from '../features';
import { PageLocation, PageTarget, locatePage, localPagePath } from './localPage';

export const OPEN_IN_SYSTEM_BROWSER_COMMAND = 'ritemark.page.openInSystemBrowser';
export const PUBLISH_PAGE_COMMAND = 'ritemark.page.publish';

export const NOT_A_PAGE_MESSAGE = 'This works on a web page file (.html) on this computer.';
export const OUTSIDE_PROJECT_MESSAGE =
  'Only pages in this project can be published. Move the page into the project folder to publish it.';
export const MISSING_PAGE_MESSAGE = "This page's file can't be found. It may have been moved or deleted.";

type PublishHandler = (page: { realPath: string; projectFolder: string }) => Promise<void>;
let publishHandler: PublishHandler | null = null;

/** PR 4: what Publish does with a project page once the boundary check passed (`PublishController.publishFromBar`). */
export function setPublishHandler(handler: PublishHandler | null): void {
  publishHandler = handler;
}

function targetOf(arg: unknown): PageTarget | undefined {
  if (arg === undefined) return vscode.window.activeTextEditor?.document.uri;
  if (typeof arg === 'string') return arg;
  if (arg instanceof vscode.Uri) return arg;
  return undefined; // anything else is not a page, never the active editor's file
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
  const location = await locatePage(fsPath, projectFolders());
  // Exhaustive: a new kind of location fails to compile here, so nothing opens by default.
  switch (location.kind) {
    case 'missing':
      void vscode.window.showInformationMessage(MISSING_PAGE_MESSAGE);
      return false;
    case 'notAPage':
      // a `.html` name that is a link to a program or a folder (security review of PR 2)
      void vscode.window.showInformationMessage(NOT_A_PAGE_MESSAGE);
      return false;
    case 'project':
    case 'outside':
      // The OS's handler for .html opens the resolved file (normally the default browser).
      return vscode.env.openExternal(vscode.Uri.file(location.realPath));
    default:
      return unhandledLocation(location);
  }
}

function unhandledLocation(location: never): never {
  throw new Error(`Unhandled page location: ${JSON.stringify(location)}`);
}

/**
 * Publish's boundary check. Returns the page's location when it is a project page; shows the
 * reason and returns undefined otherwise. Nothing is read beyond the paths, and nothing is sent.
 */
export async function publishPage(arg?: unknown): Promise<PageLocation | undefined> {
  // The kill switch: with `web-page-publishing` off, a direct executeCommand does nothing.
  if (!isEnabled('web-page-publishing')) return undefined;
  const fsPath = localPagePath(targetOf(arg));
  if (!fsPath) {
    void vscode.window.showInformationMessage(NOT_A_PAGE_MESSAGE);
    return undefined;
  }
  const location = await locatePage(fsPath, projectFolders());
  switch (location.kind) {
    case 'outside':
      void vscode.window.showInformationMessage(OUTSIDE_PROJECT_MESSAGE);
      return undefined;
    case 'missing':
      void vscode.window.showInformationMessage(MISSING_PAGE_MESSAGE);
      return undefined;
    case 'notAPage':
      void vscode.window.showInformationMessage(NOT_A_PAGE_MESSAGE);
      return undefined;
    case 'project':
      if (publishHandler) void publishHandler({ realPath: location.realPath, projectFolder: location.projectFolder });
      return location;
    default:
      return unhandledLocation(location);
  }
}

export function registerPageCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_IN_SYSTEM_BROWSER_COMMAND, openPageInSystemBrowser),
    vscode.commands.registerCommand(PUBLISH_PAGE_COMMAND, publishPage),
  );
}
