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
// Fires once, when a probe round first succeeds (Sprint 144, P3): until then `isOnline()` is only the starting guess.
export const internetAnswered = new vscode.EventEmitter<void>();

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
let _hasAnswered = false;
let _pendingCheck: Promise<void> | null = null;
let _firstRound: Promise<void> | null = null;
let _checkInterval: NodeJS.Timeout | null = null;
let _quickRecheckTimer: NodeJS.Timeout | null = null;

/**
 * Get current connectivity status
 */
export function isOnline(): boolean {
  return _isOnline;
}

/**
 * Whether the internet has answered at least once since activation. `isOnline()` starts true and one failed round
 * leaves it true (GH #193), so an offline start reads as online until the second failed round; anything that would
 * claim the internet works (the status bar's "Claude ready") waits for this instead.
 */
export function hasInternetAnswered(): boolean {
  return _hasAnswered;
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
  const firstAnswer = probeOk && !_hasAnswered;
  if (firstAnswer) _hasAnswered = true;

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
  }
  if (firstAnswer) internetAnswered.fire();
}

/**
 * Resolves after the first probe round, so a reader of `isOnline()` doesn't start on the initial guess. The status
 * bar's AI item (`aiStatusItem.ts`, Sprint 144 P3) waits on it; this module no longer draws a status bar item of its
 * own, since "AI Ready" claimed what a network probe can't know.
 */
export function whenFirstConnectivityRound(): Promise<void> {
  return _firstRound ?? Promise.resolve();
}

/**
 * Initialize connectivity monitoring
 */
export function initConnectivity(context: vscode.ExtensionContext): void {
  // Initial check
  _firstRound = updateStatus();

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
      internetAnswered.dispose();
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
