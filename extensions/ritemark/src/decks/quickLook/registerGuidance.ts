import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { isDeckPath } from '../deckFileName';
import { quickLookAvailable } from './availability';
import { QuickLookGuidance, openSettingsLabel, settingsConfirmed, settingsHelp, settingsNote } from './guidance';
import { quickLookSettingsUrl } from './pluginkitState';

const run = promisify(execFile);
const options = { timeout: 1500, maxBuffer: 16 * 1024 };

export function registerQuickLookGuidance(context: vscode.ExtensionContext): (QuickLookGuidance & { onDidChange: vscode.Event<void> }) | undefined {
  if (process.platform !== 'darwin') return;
  const openSettings = () => vscode.env.openExternal(vscode.Uri.parse(quickLookSettingsUrl));
  let confirmed: Promise<boolean> | undefined;
  const confirmSettings = () => confirmed ??= run('/usr/bin/sw_vers', ['-productVersion'], options)
    .then(result => settingsConfirmed(process.platform, result.stdout.trim()), () => false);
  context.subscriptions.push(vscode.commands.registerCommand('_ritemark.deckQuickLook.showHelp', async () => {
    if (!await quickLookAvailable()) return;
    if (!await confirmSettings()) {
      await vscode.window.showInformationMessage(settingsHelp);
      return;
    }
    if (await vscode.window.showInformationMessage(settingsNote, openSettingsLabel) === openSettingsLabel) {
      await openSettings();
    }
  }));
  const change = new vscode.EventEmitter<void>();
  const guidance = new QuickLookGuidance(process.platform, context.globalState, async id => {
    const { stdout, stderr } = await run('/usr/bin/pluginkit', ['-m', '-i', id], options);
    return stderr ? '' : stdout;
  }, confirmSettings, () => change.fire(), openSettings, quickLookAvailable);
  context.subscriptions.push(
    change,
    vscode.workspace.onDidSaveTextDocument(({ uri }) => {
      if (uri.scheme === 'file' && isDeckPath(uri.fsPath)) {
        void guidance.deckSaved().catch(error => console.warn('[Quick Look] Could not record a deck save:', error));
      }
    }),
  );
  // The desktop workbench registers PRINT_COMMAND through its print contribution.
  // Defer the renderer check until synchronous extension activation has returned.
  void Promise.resolve().then(() => guidance.refresh()).catch(error => console.warn('[Quick Look] Could not refresh guidance:', error));
  return Object.assign(guidance, { onDidChange: change.event });
}
