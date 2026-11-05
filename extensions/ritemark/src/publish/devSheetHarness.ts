/**
 * The Publish sheet's dev harness (Sprint 149, PR 3): Publish can't be pressed until PR 4, so a test run shows the
 * real sheet for real pages this way, to look at it and capture it.
 *
 * Dev-only: it runs only in a development build (`VSCODE_DEV=1`, which `scripts/code.sh` and
 * `scripts/qa/dev-launch-isolated.sh` set and an installed Ritemark never has) started with
 * `RITEMARK_PUBLISH_SHEET_HARNESS` naming one or more page files (separated as `PATH` is). No command, menu or
 * setting reaches it, and the `web-page-publishing` flag gates it as it gates Publish.
 *
 * For each page in the open project, in turn: the real gather and key scan, then the real sheet. The To and Address
 * rows show a labelled stand-in, since the account arrives in PR 4. Whatever is answered, nothing is sent: the answer
 * goes to the log (never a value), and the next page's sheet opens.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { locatePage } from '../browser/localPage';
import { isEnabled } from '../features';
import { gatherPage } from './gather';
import { showPublishSheet } from './PublishSheetPanel';

export const HARNESS_SETTING = 'RITEMARK_PUBLISH_SHEET_HARNESS';

/** The pages a launch asked for (pure, tested): none outside a development build. */
export function harnessPages(env: Record<string, string | undefined>, delimiter: string = path.delimiter): string[] {
  if (env.VSCODE_DEV !== '1') return [];
  const value = env[HARNESS_SETTING];
  if (!value) return [];
  return value.split(delimiter).map((p) => p.trim()).filter(Boolean);
}

export function openPublishSheetHarnessIfAsked(
  context: vscode.ExtensionContext,
  env: Record<string, string | undefined> = process.env,
): void {
  const pages = harnessPages(env);
  if (pages.length === 0 || !isEnabled('web-page-publishing')) return;
  void (async () => {
    const folders = (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === 'file').map((f) => f.uri.fsPath);
    for (const page of pages) {
      const location = await locatePage(page, folders);
      if (location.kind !== 'project') {
        console.log(`[publish-harness] ${path.basename(page)}: not a page in this project (${location.kind})`);
        continue;
      }
      try {
        const plan = await gatherPage(location.realPath, location.projectFolder);
        const title = path.basename(location.realPath).replace(/\.html?$/i, '');
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
        const answer = await showPublishSheet(context, plan, {
          destination: { name: 'Your Cloudflare', detail: 'Test account (preview: nothing is sent)' },
          address: { page: `${slug}-7f3a2c`, suffix: '.pages-4821.workers.dev' },
        });
        console.log(
          `[publish-harness] ${path.basename(page)}: ${plan.files.length} file(s), ${plan.leftOut.length} left out, ` +
            `${plan.keyHits.length} key-shaped place(s); answered ${answer.kind}; nothing sent`,
        );
      } catch (error) {
        console.log(`[publish-harness] ${path.basename(page)}: ${(error as Error).name}`);
      }
    }
  })();
}
