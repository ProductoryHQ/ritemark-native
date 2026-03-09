import * as vscode from 'vscode';
import { UpdateService } from './updateService';

const STARTUP_DELAY_MS = 10_000; // 10 seconds after activation

/**
 * Schedule a single update check on startup (delayed by 10 seconds)
 * Respects user settings and preferences
 */
export function scheduleStartupCheck(
  updateService: UpdateService
): void {
  // Single delayed check on startup
  setTimeout(async () => {
    const settings = vscode.workspace.getConfiguration('ritemark.updates');
    const enabled = settings.get<boolean>('enabled', true);

    if (!enabled) {
      console.log('Update checks disabled via settings');
      return; // User disabled update checks
    }

    console.log('Running startup update check...');
    await updateService.checkAndNotify();
  }, STARTUP_DELAY_MS);
}
