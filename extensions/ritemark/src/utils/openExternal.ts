/**
 * Platform-aware external app opening utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getCurrentPlatform } from './platform';

const execAsync = promisify(exec);

/**
 * Check if an application is installed
 * @param appName - Application name (e.g., 'Microsoft Excel', 'Microsoft Word')
 * @returns true if the app is found
 */
export async function isAppInstalled(appName: string): Promise<boolean> {
  const platform = getCurrentPlatform();

  try {
    if (platform === 'darwin') {
      // macOS: open -Ra checks if app exists without launching it
      await execAsync(`open -Ra "${appName}"`);
      return true;
    } else if (platform === 'win32') {
      // Windows: check registry for Office installations
      if (appName === 'Microsoft Excel') {
        await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\excel.exe" /ve');
        return true;
      } else if (appName === 'Microsoft Word') {
        await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\winword.exe" /ve');
        return true;
      }
      // For unknown apps, assume file association will handle it
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Open a file in an external application
 * @param filePath - Absolute path to the file
 * @param appName - Application name (e.g., 'Microsoft Excel', 'Numbers')
 */
export async function openInExternalApp(filePath: string, appName: string): Promise<void> {
  const platform = getCurrentPlatform();

  if (platform === 'darwin') {
    await execAsync(`open -a "${appName}" "${filePath}"`);
  } else if (platform === 'win32') {
    // Windows: use start command to open with default app for this file type
    // Double-quoting: first "" is the window title, second is the file path
    await execAsync(`start "" "${filePath}"`);
  } else {
    // Linux: xdg-open
    await execAsync(`xdg-open "${filePath}"`);
  }
}

/**
 * Get the platform-appropriate spreadsheet app name
 * @param preferExcel - true if Excel is installed
 * @returns Display name for the spreadsheet app
 */
export function getSpreadsheetAppName(preferExcel: boolean): string {
  const platform = getCurrentPlatform();

  if (preferExcel) {
    return 'Microsoft Excel';
  }

  if (platform === 'darwin') {
    return 'Numbers';
  }
  // Windows/Linux: no Numbers equivalent, use generic
  return 'default spreadsheet app';
}

/**
 * Get the platform-appropriate word processor app name
 * @param preferWord - true if Word is installed
 * @returns Display name for the word processor app
 */
export function getWordProcessorAppName(preferWord: boolean): string {
  const platform = getCurrentPlatform();

  if (preferWord) {
    return 'Microsoft Word';
  }

  if (platform === 'darwin') {
    return 'Pages';
  }
  return 'default application';
}

/**
 * Open platform-specific microphone settings
 */
export function openMicrophoneSettings(): void {
  const platform = getCurrentPlatform();

  if (platform === 'darwin') {
    exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
  } else if (platform === 'win32') {
    exec('start ms-settings:privacy-microphone');
  }
}
