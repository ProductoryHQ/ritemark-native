import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { isDeckPath } from '../deckFileName';
import { QuickLookGuidance, openSettingsLabel, settingsConfirmed, settingsHelp, settingsNote } from './guidance';
import { quickLookSettingsUrl } from './pluginkitState';

const run = promisify(execFile);
const options = { timeout: 1500, maxBuffer: 16 * 1024 };

export function registerQuickLookGuidance(context: vscode.ExtensionContext): (QuickLookGuidance & { onDidChange: vscode.Event<void> }) | undefined {
  if (process.platform !== 'darwin') return;
  const change = new vscode.EventEmitter<void>();
  const openSettings = () => vscode.env.openExternal(vscode.Uri.parse(quickLookSettingsUrl));
  const confirmed = run('/usr/bin/sw_vers', ['-productVersion'], options)
    .then(result => settingsConfirmed(process.platform, result.stdout.trim()), () => false);
  const guidance = new QuickLookGuidance(process.platform, context.globalState, async id => {
    const { stdout, stderr } = await run('/usr/bin/pluginkit', ['-m', '-i', id], options);
    return stderr ? '' : stdout;
  }, confirmed, () => change.fire(), openSettings);
  context.subscriptions.push(
    change,
    vscode.workspace.onDidSaveTextDocument(({ uri }) => {
      if (uri.scheme === 'file' && isDeckPath(uri.fsPath)) {
        void guidance.deckSaved().catch(error => console.warn('[Quick Look] Could not record a deck save:', error));
      }
    }),
    vscode.commands.registerCommand('_ritemark.deckQuickLook.showHelp', async () => {
      if (!(await confirmed)) {
        await vscode.window.showInformationMessage(settingsHelp);
        return;
      }
      if (await vscode.window.showInformationMessage(settingsNote, openSettingsLabel) === openSettingsLabel) {
        await openSettings();
      }
    }),
  );
  void guidance.refresh();
  return Object.assign(guidance, { onDidChange: change.event });
}
