/**
 * Network Connectivity Detection
 * Monitors online/offline status and notifies subscribers.
 *
 * Verdict policy (GH #193): a single failed probe must never flip the UI.
 * Each round races several independent endpoints (online if ANY responds),
 * and the offline verdict needs two consecutive failed rounds — see
 * connectivityPolicy.ts for the pure, unit-tested decision logic.
 */

import * as vscode from 'vscode';
import * as https from 'https';
import { anyProbeSucceeds, nextConnectivityState } from './connectivityPolicy';

// Event emitter for connectivity changes
export const connectivityChanged = new vscode.EventEmitter<{ isOnline: boolean }>();

// Online if ANY of these responds. A single vendor's outage — or a network
// that blocks one of them — must not read as "offline". Any HTTP response
// counts, even 401/404: it proves the network path works.
const PROBE_ENDPOINTS: ReadonlyArray<{ hostname: string; path: string }> = [
  { hostname: 'api.anthropic.com', path: '/' },
  { hostname: 'api.openai.com', path: '/v1/models' },
  { hostname: 'captive.apple.com', path: '/hotspot-detect.html' },
];
// 5s sat below real-world tail latency (VPN/mobile links, vendor edge spikes)
// and produced false offline verdicts on healthy connections.
const PROBE_TIMEOUT_MS = 8000;
const CHECK_INTERVAL_MS = 30000;
const QUICK_RECHECK_DELAY_MS = 5000;

let _isOnline = true;
let _failStreak = 0;
let _pendingCheck: Promise<void> | null = null;
let _statusBarItem: vscode.StatusBarItem | null = null;
let _checkInterval: NodeJS.Timeout | null = null;
let _quickRecheckTimer: NodeJS.Timeout | null = null;

/**
 * Get current connectivity status
 */
export function isOnline(): boolean {
  return _isOnline;
}

function probeEndpoint(endpoint: { hostname: string; path: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: endpoint.hostname,
        port: 443,
        path: endpoint.path,
        method: 'HEAD',
        timeout: PROBE_TIMEOUT_MS
      },
      () => {
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
 * One probe round: race all endpoints, succeed on the first response.
 */
function checkConnectivity(): Promise<boolean> {
  return anyProbeSucceeds(PROBE_ENDPOINTS.map(probeEndpoint));
}

/**
 * Update status and notify if changed. Concurrent callers (interval, quick
 * recheck, webview "Check again") share one in-flight round.
 */
function updateStatus(): Promise<void> {
  if (_pendingCheck) return _pendingCheck;
  _pendingCheck = runCheckRound().finally(() => {
    _pendingCheck = null;
  });
  return _pendingCheck;
}

async function runCheckRound(): Promise<void> {
  const probeOk = await checkConnectivity();
  const wasOnline = _isOnline;
  const next = nextConnectivityState(_isOnline, _failStreak, probeOk);
  _isOnline = next.isOnline;
  _failStreak = next.failStreak;

  if (_quickRecheckTimer) {
    clearTimeout(_quickRecheckTimer);
    _quickRecheckTimer = null;
  }
  if (next.scheduleQuickRecheck) {
    _quickRecheckTimer = setTimeout(() => {
      _quickRecheckTimer = null;
      void updateStatus();
    }, QUICK_RECHECK_DELAY_MS);
  }

  if (wasOnline !== _isOnline) {
    console.log(
      `[ritemark connectivity] ${_isOnline ? 'back online' : `offline after ${_failStreak} consecutive failed probe rounds`}`
    );
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

  // Periodic check
  _checkInterval = setInterval(() => {
    void updateStatus();
  }, CHECK_INTERVAL_MS);

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose: () => {
      if (_checkInterval) {
        clearInterval(_checkInterval);
      }
      if (_quickRecheckTimer) {
        clearTimeout(_quickRecheckTimer);
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
