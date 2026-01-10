import * as vscode from 'vscode';
import { UpdateService } from './updateService';
import { UpdateStorage } from './updateStorage';

const STARTUP_DELAY_MS = 10_000; // 10 seconds after activation

/**
 * Schedule a single update check on startup (delayed by 10 seconds)
 * Respects user settings and preferences
 */
export function scheduleStartupCheck(
  updateService: UpdateService,
  storage: UpdateStorage
): void {
  // Single delayed check on startup
  setTimeout(async () => {
    const settings = vscode.workspace.getConfiguration('ritemark.updates');
    const enabled = settings.get<boolean>('enabled', true);

    if (!enabled) {
      console.log('Update checks disabled via settings');
      return; // User disabled update checks
    }

    if (storage.getDontShowAgain()) {
      console.log('Update notifications disabled by user preference');
      return; // User clicked "Don't show again"
    }

    console.log('Running startup update check...');
    await updateService.checkAndNotify();
  }, STARTUP_DELAY_MS);
}
