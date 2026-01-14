/**
 * Update Notifications
 *
 * Shows update notifications to users and handles user actions.
 * Supports both full app updates (DMG) and extension-only updates.
 */

import * as vscode from 'vscode';
import { UpdateStorage } from './updateStorage';
import { UpdateManifest, formatSize, getTotalDownloadSize } from './updateManifest';
import { UserExtensionInstaller } from './userExtensionInstaller';

// ─────────────────────────────────────────────────────────────────────────────
// Full App Update Notification (existing flow)
// ─────────────────────────────────────────────────────────────────────────────

const FULL_UPDATE_TEXT = 'A new version of RiteMark is available';

const FULL_UPDATE_ACTIONS = {
  INSTALL_NOW: 'Install Now',
  LATER: 'Later',
  DONT_SHOW: "Don't Show Again"
} as const;

/**
 * Show update notification for full app updates (opens DMG download)
 */
export async function showUpdateNotification(
  version: string,
  downloadUrl: string,
  storage: UpdateStorage
): Promise<void> {
  const selection = await vscode.window.showInformationMessage(
    FULL_UPDATE_TEXT,
    FULL_UPDATE_ACTIONS.INSTALL_NOW,
    FULL_UPDATE_ACTIONS.LATER,
    FULL_UPDATE_ACTIONS.DONT_SHOW
  );

  switch (selection) {
    case FULL_UPDATE_ACTIONS.INSTALL_NOW:
      // Open DMG download URL in browser
      await vscode.env.openExternal(vscode.Uri.parse(downloadUrl));
      // Mark this version as dismissed so we don't show again
      await storage.setDismissedVersion(version);
      break;

    case FULL_UPDATE_ACTIONS.LATER:
      // Do nothing, notification dismissed
      // Will show again on next startup
      break;

    case FULL_UPDATE_ACTIONS.DONT_SHOW:
      // Persist preference - never show update notifications again
      await storage.setDontShowAgain(true);
      break;

    default:
      // User clicked X or dismissed without selecting
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension-Only Update Notification (new flow)
// ─────────────────────────────────────────────────────────────────────────────

const EXT_UPDATE_ACTIONS = {
  INSTALL_NOW: 'Install Now',
  LATER: 'Later',
  DONT_SHOW: "Don't Show Again"
} as const;

/**
 * Show update notification for extension-only updates
 * Downloads and installs directly without opening browser
 */
export async function showExtensionUpdateNotification(
  manifest: UpdateManifest,
  storage: UpdateStorage,
  installer: UserExtensionInstaller
): Promise<void> {
  const downloadSize = formatSize(getTotalDownloadSize(manifest));
  const message = `Extension update available (${downloadSize})`;

  // Build detail text from release notes
  const detail = manifest.releaseNotes
    ? `New in ${manifest.version}: ${manifest.releaseNotes.slice(0, 100)}${manifest.releaseNotes.length > 100 ? '...' : ''}`
    : `Version ${manifest.version} is available`;

  const selection = await vscode.window.showInformationMessage(
    message,
    { detail },
    EXT_UPDATE_ACTIONS.INSTALL_NOW,
    EXT_UPDATE_ACTIONS.LATER,
    EXT_UPDATE_ACTIONS.DONT_SHOW
  );

  switch (selection) {
    case EXT_UPDATE_ACTIONS.INSTALL_NOW:
      await performExtensionUpdate(manifest, storage, installer);
      break;

    case EXT_UPDATE_ACTIONS.LATER:
      // Do nothing, will show again on next startup
      break;

    case EXT_UPDATE_ACTIONS.DONT_SHOW:
      await storage.setDontShowAgain(true);
      break;

    default:
      // User dismissed
      break;
  }
}

/**
 * Perform the extension update with progress UI
 */
async function performExtensionUpdate(
  manifest: UpdateManifest,
  storage: UpdateStorage,
  installer: UserExtensionInstaller
): Promise<void> {
  const totalSize = getTotalDownloadSize(manifest);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Updating RiteMark Extension',
      cancellable: false
    },
    async (progress) => {
      // Update progress as files download
      const onProgress = (downloaded: number, total: number) => {
        const percent = Math.round((downloaded / total) * 100);
        progress.report({
          increment: percent,
          message: `Downloading... ${percent}%`
        });
      };

      try {
        // Perform the update
        progress.report({ message: 'Downloading files...' });
        const result = await installer.applyUpdate(manifest, onProgress);

        if (result.success) {
          // Mark version as installed
          await storage.setDismissedVersion(manifest.version);

          // Show success and prompt reload
          progress.report({ message: 'Installation complete!' });

          // Small delay to show success message
          await new Promise(resolve => setTimeout(resolve, 500));

          // Prompt user to reload
          await promptReloadWindow(manifest.version);
        } else {
          // Show error
          await showUpdateError(result.error || 'Unknown error');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await showUpdateError(errorMessage);
      }
    }
  );
}

/**
 * Prompt user to reload window after successful update
 */
async function promptReloadWindow(version: string): Promise<void> {
  const selection = await vscode.window.showInformationMessage(
    `Extension updated to ${version}. Reload to apply changes.`,
    'Reload Window',
    'Later'
  );

  if (selection === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

/**
 * Show update error notification
 */
async function showUpdateError(error: string): Promise<void> {
  const selection = await vscode.window.showErrorMessage(
    `Extension update failed: ${error}`,
    'Retry',
    'Dismiss'
  );

  if (selection === 'Retry') {
    // User can retry by triggering update check again
    vscode.window.showInformationMessage(
      'Please restart RiteMark to retry the update.'
    );
  }
}
