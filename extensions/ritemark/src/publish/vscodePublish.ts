/**
 * Composes web-page publishing for the extension host (Sprint 149, PR 4). Everything with behaviour is in the
 * vscode-free modules beside this one; this file supplies SecretStorage, global storage, the system browser, the
 * host's own password box, PR 3's sheet, the bar's commands and the `ritemark.publish.ready` context key.
 *
 * Always composed, even with `web-page-publishing` off: the flag hides creating and connecting, but Settings still
 * lists the published pages with Open and Unpublish, and Disconnect still works (S28b).
 *
 * **Reachability.** Publish is ready only when the whole-window sheet host is there (PR 5's `_ritemark.webviewSheet`
 * command, patch 018): until it lands the sheet would open as a tab, which the Experience lead ruled out, so the bar's
 * Publish stays hidden.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { setPublishHandler } from '../browser/pageCommands';
import { CloudflareAccount, CONNECTION_SECRET_KEY } from './cloudflare/account';
import { CloudflareClient } from './cloudflare/client';
import { CloudflareHost } from './cloudflare/CloudflareHost';
import { gatherPage } from './gather';
import { PublishRecordStore } from './publishRecords';
import { PublishController, sheetHostAvailable, type PageBarState, type PublishUi } from './PublishController';
import { showPublishSheet } from './PublishSheetPanel';
import type { WebPagesSettingsProjection } from './settingsProtocol';

export const PUBLISH_READY_CONTEXT = 'ritemark.publish.ready';
export const UNPUBLISH_PAGE_COMMAND = 'ritemark.page.unpublish';
export const COPY_LINK_COMMAND = 'ritemark.page.copyLink';
export const OPEN_PUBLISHED_COMMAND = 'ritemark.page.openPublished';
/** For patch 010's bar: the page's state (`PageBarState`), by its file URL. */
export const PAGE_STATE_COMMAND = '_ritemark.publish.pageState';
/** Patch 010's: the bar asks `PAGE_STATE_COMMAND` again for this page's URL. */
export const BAR_REFRESH_COMMAND = '_ritemark.browser.publishStateChanged';

export interface PublishFeature {
  controller: PublishController;
  /** The Settings page plugs in here while it is open. */
  setSettingsListener(listener: ((projection: WebPagesSettingsProjection) => void) | null): void;
}

/** The host's own password box (answer 8): hidden text, kept open with the words under it on a failure. */
function askToken(options: Parameters<PublishUi['askToken']>[0]): Promise<void> {
  return new Promise((resolve) => {
    const box = vscode.window.createInputBox();
    box.title = options.title;
    box.prompt = options.prompt;
    box.password = true;
    box.ignoreFocusOut = true;
    let checking = false;
    const disposables: vscode.Disposable[] = [];
    const finish = () => { disposables.forEach((d) => d.dispose()); box.dispose(); resolve(); };
    disposables.push(
      box.onDidChangeValue(() => { box.validationMessage = undefined; }),
      box.onDidAccept(async () => {
        if (checking) return;
        const value = box.value;
        if (!value.trim()) return;
        checking = true;
        box.busy = true;
        box.enabled = false;
        try {
          const line = await options.check(value);
          if (line === null) { box.hide(); return; }
          box.validationMessage = line;
        } finally {
          checking = false;
          box.busy = false;
          box.enabled = true;
        }
      }),
      box.onDidHide(finish),
    );
    box.show();
  });
}

function filePathOf(arg: unknown): string | undefined {
  try {
    const uri = arg instanceof vscode.Uri ? arg : typeof arg === 'string' ? vscode.Uri.parse(arg, true) : undefined;
    return uri?.scheme === 'file' ? uri.fsPath : undefined;
  } catch {
    return undefined;
  }
}

/** The page's real path, as the records are keyed (PR 3: by real path). */
async function pagePathOf(arg: unknown): Promise<string | undefined> {
  const fsPath = filePathOf(arg);
  return fsPath ? fs.promises.realpath(fsPath).catch(() => fsPath) : undefined;
}

export function createPublishFeature(
  context: vscode.ExtensionContext,
  isFeatureEnabled: () => boolean,
  log: (message: string) => void,
): PublishFeature {
  let settingsListener: ((projection: WebPagesSettingsProjection) => void) | null = null;

  const account = new CloudflareAccount({
    secrets: context.secrets,
    makeClient: (token) => new CloudflareClient({ fetch: (url, init) => fetch(url, init as RequestInit), token, log }),
  });
  const host = new CloudflareHost(account, { log });
  const records = new PublishRecordStore(context.globalStorageUri.fsPath);

  const controller = new PublishController({
    host,
    records,
    gather: (pagePath, projectFolder) => gatherPage(pagePath, projectFolder),
    ui: {
      openExternal: async (url) => vscode.env.openExternal(vscode.Uri.parse(url, true)),
      askToken,
      showSheet: async ({ plan, options, setup, onConfirm }) => {
        const answer = await showPublishSheet(context, plan, { ...options, setup, onConfirm });
        return answer;
      },
      showFailure: (line, retry) => {
        void vscode.window.showWarningMessage(line, 'Try again').then((pick) => { if (pick === 'Try again') retry(); });
      },
    },
    isFeatureEnabled,
    postSettings: (projection) => settingsListener?.(projection),
    setReady: (ready) => { void vscode.commands.executeCommand('setContext', PUBLISH_READY_CONTEXT, ready); },
    // The bar asks again; a build without patch 010's command has no bar to tell
    onPageState: (pagePath) => {
      void vscode.commands.executeCommand(BAR_REFRESH_COMMAND, vscode.Uri.file(pagePath).toString()).then(undefined, () => undefined);
    },
    log,
  });
  setPublishHandler((page) => controller.publishFromBar(page));

  context.subscriptions.push(
    { dispose: () => setPublishHandler(null) },
    // Another window connected or disconnected: read the entry again. Only the event's name is read here.
    context.secrets.onDidChange((event) => {
      if (event.key === CONNECTION_SECRET_KEY) void account.reload().then(() => controller.refreshReady());
    }),
    vscode.commands.registerCommand(UNPUBLISH_PAGE_COMMAND, async (arg?: unknown) => {
      const pagePath = await pagePathOf(arg);
      if (!pagePath) return;
      const record = await controller.recordFor(pagePath);
      if (!record) return;
      const answer = await vscode.window.showWarningMessage(
        `Unpublish ${path.basename(record.pagePath).replace(/\.html?$/i, '')}?`,
        { modal: true, detail: 'The link stops working for everyone who has it. The file stays in this project.' },
        'Unpublish',
      );
      if (answer === 'Unpublish') await controller.unpublishPage(pagePath);
    }),
    vscode.commands.registerCommand(COPY_LINK_COMMAND, async (arg?: unknown) => {
      const pagePath = await pagePathOf(arg);
      const record = pagePath ? await controller.recordFor(pagePath) : undefined;
      if (record) await vscode.env.clipboard.writeText(record.address);
    }),
    vscode.commands.registerCommand(OPEN_PUBLISHED_COMMAND, async (arg?: unknown) => {
      const pagePath = await pagePathOf(arg);
      const record = pagePath ? await controller.recordFor(pagePath) : undefined;
      if (record) await controller.openSite(record.siteName);
    }),
    vscode.commands.registerCommand(PAGE_STATE_COMMAND, async (arg?: unknown): Promise<PageBarState | undefined> => {
      const pagePath = await pagePathOf(arg);
      if (!pagePath) return undefined;
      // "Published · changed" compares PR 3's content hash of what would go now with the record's
      let currentHash: string | undefined;
      const record = await controller.recordFor(pagePath);
      const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(pagePath));
      if (record && folder?.uri.scheme === 'file') {
        const projectFolder = await fs.promises.realpath(folder.uri.fsPath).catch(() => folder.uri.fsPath);
        currentHash = await gatherPage(pagePath, projectFolder).then((plan) => plan.contentHash, () => undefined);
      }
      return controller.pageState(pagePath, currentHash);
    }),
  );

  void account.load()
    .catch(() => log('[publish] could not read the stored Cloudflare connection'))
    .finally(() => {
      controller.refreshReady();
      // Ready only with the whole-window sheet host (PR 5); until then Publish stays out of reach
      void sheetHostAvailable((filterInternal) => vscode.commands.getCommands(filterInternal)).then((available) => controller.setPublishEntryAvailable(available));
    });

  return {
    controller,
    setSettingsListener: (listener) => { settingsListener = listener; },
  };
}
