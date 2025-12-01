/**
 * Network Connectivity Detection
 * Monitors online/offline status and notifies subscribers
 */

import * as vscode from 'vscode';
import * as https from 'https';

// Event emitter for connectivity changes
export const connectivityChanged = new vscode.EventEmitter<{ isOnline: boolean }>();

let _isOnline = true;
let _statusBarItem: vscode.StatusBarItem | null = null;
let _checkInterval: NodeJS.Timeout | null = null;

/**
 * Get current connectivity status
 */
export function isOnline(): boolean {
  return _isOnline;
}

/**
 * Check connectivity by pinging a reliable endpoint
 */
async function checkConnectivity(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/models',
        method: 'HEAD',
        timeout: 5000
      },
      (res) => {
        // Any response (even 401) means we're online
        resolve(true);
      }
    );

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Update status and notify if changed
 */
async function updateStatus(): Promise<void> {
  const wasOnline = _isOnline;
  _isOnline = await checkConnectivity();

  if (wasOnline !== _isOnline) {
    connectivityChanged.fire({ isOnline: _isOnline });
    updateStatusBar();
  }
}

/**
 * Update status bar indicator
 */
function updateStatusBar(): void {
  if (!_statusBarItem) return;

  if (_isOnline) {
    _statusBarItem.text = '$(cloud) AI Ready';
    _statusBarItem.tooltip = 'Connected to AI service';
    _statusBarItem.backgroundColor = undefined;
  } else {
    _statusBarItem.text = '$(cloud-offline) AI Offline';
    _statusBarItem.tooltip = 'No internet connection - AI features unavailable';
    _statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }
}

/**
 * Initialize connectivity monitoring
 */
export function initConnectivity(context: vscode.ExtensionContext): void {
  // Create status bar item
  _statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  _statusBarItem.name = 'RiteMark AI Status';
  _statusBarItem.command = 'ritemark.showAIPanel';
  context.subscriptions.push(_statusBarItem);

  // Initial check - always update status bar on init
  updateStatus().then(() => {
    updateStatusBar();
    _statusBarItem?.show();
  });

  // Periodic check every 30 seconds
  _checkInterval = setInterval(() => {
    updateStatus();
  }, 30000);

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose: () => {
      if (_checkInterval) {
        clearInterval(_checkInterval);
      }
      connectivityChanged.dispose();
    }
  });
}

/**
 * Force a connectivity check (e.g., after wake from sleep)
 */
export async function forceConnectivityCheck(): Promise<boolean> {
  await updateStatus();
  return _isOnline;
}
