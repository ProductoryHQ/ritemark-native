import * as vscode from 'vscode';
import { UpdateStorage } from './updateStorage';

const NOTIFICATION_TEXT = 'A new version of RiteMark is available';

const ACTIONS = {
  INSTALL_NOW: 'Install Now',
  LATER: 'Later',
  DONT_SHOW: "Don't Show Again"
} as const;

/**
 * Show update notification to user with action buttons
 * @param version - New version number
 * @param downloadUrl - URL to download DMG
 * @param storage - Storage service for persistence
 */
export async function showUpdateNotification(
  version: string,
  downloadUrl: string,
  storage: UpdateStorage
): Promise<void> {
  const selection = await vscode.window.showInformationMessage(
    NOTIFICATION_TEXT,
    ACTIONS.INSTALL_NOW,
    ACTIONS.LATER,
    ACTIONS.DONT_SHOW
  );

  switch (selection) {
    case ACTIONS.INSTALL_NOW:
      // Open DMG download URL in browser
      await vscode.env.openExternal(vscode.Uri.parse(downloadUrl));
      // Mark this version as dismissed so we don't show again
      await storage.setDismissedVersion(version);
      break;

    case ACTIONS.LATER:
      // Do nothing, notification dismissed
      // Will show again on next startup
      break;

    case ACTIONS.DONT_SHOW:
      // Persist preference - never show update notifications again
      await storage.setDontShowAgain(true);
      break;

    default:
      // User clicked X or dismissed without selecting
      break;
  }
}
