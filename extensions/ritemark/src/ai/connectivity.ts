/**
 * Network Connectivity Detection
 * Monitors online/offline status and notifies subscribers
 */

import * as vscode from 'vscode';
import * as https from 'https';

// Event emitter for connectivity changes
export const connectivityChanged = new vscode.EventEmitter<{ isOnline: boolean }>();

// Consecutive failed checks required before flipping online -> offline.
// A single transient blip (VPN handshake, edge slowdown) no longer flips the UI.
const FAILURE_THRESHOLD = 2;
// Per-request timeout for the offline verdict; 5s was below real-world tail
// latency on VPN/mobile links and caused false positives.
const PROBE_TIMEOUT_MS = 8000;
// Short backoff before a single retry of a failed probe.
const RETRY_DELAY_MS = 1000;

// Multiple vendor endpoints so an outage/block of one provider alone
// doesn't read as "no internet" for users of the other runtime.
const PROBE_ENDPOINTS: Array<{ hostname: string; path: string }> = [
  { hostname: 'api.anthropic.com', path: '/v1/models' },
  { hostname: 'api.openai.com', path: '/v1/models' }
];

let _isOnline = true;
let _consecutiveFailures = 0;
let _statusBarItem: vscode.StatusBarItem | null = null;
let _checkInterval: NodeJS.Timeout | null = null;

/**
 * Get current connectivity status
 */
export function isOnline(): boolean {
  return _isOnline;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Probe a single endpoint once. Any response (even 401) counts as reachable.
 */
function probeOnce(hostname: string, path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname,
        port: 443,
        path,
        method: 'HEAD',
        timeout: PROBE_TIMEOUT_MS
      },
      () => resolve(true)
    );

    req.on('error', () => resolve(false));

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Probe one endpoint, retrying once (short backoff) before treating it as failed.
 */
async function probeEndpointWithRetry(hostname: string, path: string): Promise<boolean> {
  if (await probeOnce(hostname, path)) return true;
  await delay(RETRY_DELAY_MS);
  return probeOnce(hostname, path);
}

/**
 * True if any probe result indicates reachability.
 */
export function combineProbeResults(results: boolean[]): boolean {
  return results.some(Boolean);
}

/**
 * Check connectivity by probing multiple endpoints; online if any responds.
 */
async function checkConnectivity(): Promise<boolean> {
  const results = await Promise.all(
    PROBE_ENDPOINTS.map((endpoint) => probeEndpointWithRetry(endpoint.hostname, endpoint.path))
  );
  return combineProbeResults(results);
}

/**
 * Pure state transition: applies hysteresis so a single failed probe
 * doesn't flip an online UI to offline. Returns to online on the first
 * successful probe.
 */
export function nextOnlineState(
  currentlyOnline: boolean,
  probeSucceeded: boolean,
  consecutiveFailures: number,
  threshold: number = FAILURE_THRESHOLD
): { isOnline: boolean; consecutiveFailures: number } {
  if (probeSucceeded) {
    return { isOnline: true, consecutiveFailures: 0 };
  }

  const failures = consecutiveFailures + 1;
  if (currentlyOnline && failures < threshold) {
    return { isOnline: true, consecutiveFailures: failures };
  }
  return { isOnline: false, consecutiveFailures: failures };
}

/**
 * Update status and notify if changed
 */
async function updateStatus(): Promise<void> {
  const wasOnline = _isOnline;
  const probeSucceeded = await checkConnectivity();
  const next = nextOnlineState(_isOnline, probeSucceeded, _consecutiveFailures);
  _isOnline = next.isOnline;
  _consecutiveFailures = next.consecutiveFailures;

  if (wasOnline !== _isOnline) {
    console.log(`[Ritemark] Connectivity changed: ${wasOnline ? 'online' : 'offline'} -> ${_isOnline ? 'online' : 'offline'} (consecutive failures: ${_consecutiveFailures})`);
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
  _statusBarItem.name = 'Ritemark AI Status';
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
