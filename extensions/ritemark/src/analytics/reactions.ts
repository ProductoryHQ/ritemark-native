/**
 * All commands' "Send feedback" (`ritemark.reactions`; the editor title's
 * hidden feedback button runs it too).
 *
 * Sprint 140 (J2; experience 34, decision 2: only a message): it opens the
 * feedback sheet, the same one as the status bar's door and Help ▸ Send
 * feedback. The four reactions (love it, good, okay, needs work) retire with
 * it; what the person writes goes by the sheet's straight route, with usage
 * data on or off, as before. The command keeps its id, so patch 003's palette
 * policy does not change.
 */

import * as vscode from 'vscode';
import { FEEDBACK_OPEN_COMMAND } from '../feedback/feedbackSheet';

export function registerReactionCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ritemark.reactions', () => vscode.commands.executeCommand(FEEDBACK_OPEN_COMMAND, { from: 'command' })),
  );
}
