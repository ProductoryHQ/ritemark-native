/**
 * The always-visible way to report AI output — Sprint 126 (RQ1).
 *
 * Microsoft Store policy 11.16 asks for a "discoverable, working user action".
 * An earlier design put the control on each conversation turn, which is only
 * discoverable once a turn exists and means inventing a per-turn action row
 * the transcript has never had. The status bar is on screen from launch,
 * whether or not the sidebar is open, and is one thing to point a reviewer at.
 *
 * PLACEMENT: right-aligned at priority 99, which puts it immediately right of
 * the AI status indicator. The neighbours, all right-aligned, are the word
 * count (101), the AI status and update items (100) and scheduled tasks (98) —
 * higher priority sits further left, so 99 is the gap between "AI Ready" and
 * the scheduled-tasks bell. Changing this number moves the item.
 */

import * as vscode from 'vscode';
import { REPORT_COPY } from './reportCopy';

export const REPORT_COMMAND_ID = 'ritemark.reportAIOutput';

/** See PLACEMENT above — this is a layout decision, not an arbitrary constant. */
export const REPORT_STATUS_BAR_PRIORITY = 99;

/**
 * Register the status bar item and the command behind it.
 *
 * `openReportWindow` reveals the AI panel and asks the webview to open the
 * report dialog. It is passed in rather than reached for, so the command has
 * no opinion about which view hosts the dialog.
 */
export function registerReportStatusBar(
  context: vscode.ExtensionContext,
  openReportWindow: () => void | Promise<void>,
): vscode.StatusBarItem {
  context.subscriptions.push(
    vscode.commands.registerCommand(REPORT_COMMAND_ID, async () => {
      await openReportWindow();
    }),
  );

  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    REPORT_STATUS_BAR_PRIORITY,
  );
  item.name = 'Ritemark AI Report';
  item.text = `$(report) ${REPORT_COPY.statusBarLabel}`;
  item.tooltip = REPORT_COPY.statusBarTooltip;
  item.command = REPORT_COMMAND_ID;
  item.show();

  context.subscriptions.push(item);
  return item;
}
