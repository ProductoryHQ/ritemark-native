import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { isEnabled } from '../../features';
import { PRINT_COMMAND } from '../deckPdf';
import { canStartQuickLook } from '../quickLookJobs';

export function quickLookAvailable(): Promise<boolean> {
  return canStartQuickLook(process.platform, isEnabled('deck-quick-look'), isEnabled('decks'),
    async () => (await vscode.commands.getCommands(false)).includes(PRINT_COMMAND), () => hasQuickLookBundles(vscode.env.appRoot))
    .catch(() => false);
}

async function hasQuickLookBundles(appRoot: string): Promise<boolean> {
  // appRoot is <app>/Contents/Resources/app for the packaged macOS shell.
  const plugins = path.resolve(appRoot, '..', '..', 'PlugIns');
  const found = await Promise.all(['RitemarkDeckThumbnail.appex', 'RitemarkDeckPreview.appex'].map(name =>
    fs.promises.stat(path.join(plugins, name)).then(stat => stat.isDirectory(), () => false)));
  return found.every(Boolean);
}
