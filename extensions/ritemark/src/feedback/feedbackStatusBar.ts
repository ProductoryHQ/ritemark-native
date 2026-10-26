/**
 * The status bar's door (Sprint 140, R10; experience 34; Jarmo, 19 October:
 * "Send feedback in status bar in very bottom"). "Send feedback" with the
 * chat-text icon, in the right group immediately before the bell, in body ink;
 * its tooltip names AI issues, so Store policy 11.16's always-visible way to
 * report AI output stays (with AI information's labelled link).
 *
 * PLACEMENT: right-aligned at priority 97: right of the AI status (100) and
 * scheduled tasks (98), left of VS Code's bell. It replaces Sprint 126's
 * "Report AI issue" item (priority 99); `ritemark.reportAIOutput` stays as a
 * command and opens the same sheet, ready for an AI issue.
 */

import * as vscode from 'vscode';
import { FEEDBACK_COPY } from './feedbackCopy';
import { FEEDBACK_OPEN_COMMAND } from './feedbackSheet';
import { REPORT_COMMAND_ID } from '../reporting/reportStatusBar';

export const FEEDBACK_STATUS_BAR_PRIORITY = 97;

export function registerFeedbackStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  context.subscriptions.push(
    // Sprint 126's command keeps working, for anyone who bound a key to it (R16).
    vscode.commands.registerCommand(REPORT_COMMAND_ID, () => vscode.commands.executeCommand(FEEDBACK_OPEN_COMMAND, { from: 'command', kind: 'ai-issue' })),
  );
  const item = vscode.window.createStatusBarItem('ritemark.feedback', vscode.StatusBarAlignment.Right, FEEDBACK_STATUS_BAR_PRIORITY);
  item.name = 'Send feedback';
  // $(feedback) is Phosphor's chat-centered-text in Ritemark's product icons.
  item.text = `$(feedback) ${FEEDBACK_COPY.door.label}`;
  item.tooltip = FEEDBACK_COPY.door.tooltip;
  item.command = { title: FEEDBACK_COPY.door.label, command: FEEDBACK_OPEN_COMMAND, arguments: [{ from: 'status_bar' }] };
  item.show();
  context.subscriptions.push(item);
  return item;
}
