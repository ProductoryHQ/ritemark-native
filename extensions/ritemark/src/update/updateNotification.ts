/**
 * Update notifications and install UI.
 */

import * as vscode from 'vscode';
import { UpdateManifest, formatSize, getTotalDownloadSize } from './updateManifest';
import { UserExtensionInstaller } from './userExtensionInstaller';

export type UpdateNotificationChoice = 'install' | 'later' | 'skip' | 'pause';

const FULL_UPDATE_ACTIONS = {
  INSTALL: 'Download Installer',
  LATER: 'Later',
  SKIP: 'Skip This Version',
  PAUSE: 'Pause 7 Days'
} as const;

const EXTENSION_UPDATE_ACTIONS = {
  INSTALL: 'Install Update',
  LATER: 'Later',
  SKIP: 'Skip This Version',
  PAUSE: 'Pause 7 Days'
} as const;

export async function showFullUpdateNotification(
  manifest: UpdateManifest
): Promise<UpdateNotificationChoice> {
  const downloadSize = getTotalDownloadSize(manifest);
  const versionLabel = manifest.version;
  const message = downloadSize > 0
    ? `Ritemark ${versionLabel} is available (${formatSize(downloadSize)})`
    : `Ritemark ${versionLabel} is available`;

  const selection = await vscode.window.showInformationMessage(
    message,
    { detail: manifest.releaseNotes || `A full app update is ready for version ${versionLabel}.` },
    FULL_UPDATE_ACTIONS.INSTALL,
    FULL_UPDATE_ACTIONS.LATER,
    FULL_UPDATE_ACTIONS.SKIP,
    FULL_UPDATE_ACTIONS.PAUSE
  );

  switch (selection) {
    case FULL_UPDATE_ACTIONS.INSTALL:
      return 'install';
    case FULL_UPDATE_ACTIONS.SKIP:
      return 'skip';
    case FULL_UPDATE_ACTIONS.PAUSE:
      return 'pause';
    case FULL_UPDATE_ACTIONS.LATER:
    default:
      return 'later';
  }
}

export async function showExtensionUpdateNotification(
  manifest: UpdateManifest
): Promise<UpdateNotificationChoice> {
  const downloadSize = formatSize(getTotalDownloadSize(manifest));
  const detail = manifest.releaseNotes
    ? `Extension ${manifest.version}: ${manifest.releaseNotes}`
    : `Extension update ${manifest.version} is ready to install.`;

  const selection = await vscode.window.showInformationMessage(
    `Extension update ${manifest.version} is available (${downloadSize})`,
    { detail },
    EXTENSION_UPDATE_ACTIONS.INSTALL,
    EXTENSION_UPDATE_ACTIONS.LATER,
    EXTENSION_UPDATE_ACTIONS.SKIP,
    EXTENSION_UPDATE_ACTIONS.PAUSE
  );

  switch (selection) {
    case EXTENSION_UPDATE_ACTIONS.INSTALL:
      return 'install';
    case EXTENSION_UPDATE_ACTIONS.SKIP:
      return 'skip';
    case EXTENSION_UPDATE_ACTIONS.PAUSE:
      return 'pause';
    case EXTENSION_UPDATE_ACTIONS.LATER:
    default:
      return 'later';
  }
}

export async function installExtensionUpdateWithProgress(
  manifest: UpdateManifest,
  installer: UserExtensionInstaller
): Promise<{ success: boolean; error?: string }> {
  let installError: string | undefined;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing Ritemark ${manifest.version}`,
      cancellable: false
    },
    async (progress) => {
      const onProgress = (downloaded: number, total: number) => {
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        progress.report({
          increment: percent,
          message: `Downloading... ${percent}%`
        });
      };

      try {
        progress.report({ message: 'Downloading files...' });
        const result = await installer.applyUpdate(manifest, onProgress);

        if (!result.success) {
          installError = result.error || 'Unknown error';
          return;
        }

        progress.report({ message: 'Installation complete' });
      } catch (error) {
        installError = error instanceof Error ? error.message : String(error);
      }
    }
  );

  if (installError) {
    await showUpdateError(installError);
    return { success: false, error: installError };
  }

  return { success: true };
}

export async function promptReloadWindow(version: string): Promise<void> {
  const selection = await vscode.window.showInformationMessage(
    `Extension ${version} is installed. Reload Ritemark to apply the update.`,
    'Reload Window',
    'Later'
  );

  if (selection === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

async function showUpdateError(error: string): Promise<void> {
  await vscode.window.showErrorMessage(`Ritemark update failed: ${error}`);
}
