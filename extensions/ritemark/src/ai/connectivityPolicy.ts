/**
 * Pure connectivity verdict policy (GH #193) — no vscode dependency, unit-tested.
 *
 * A single failed probe round must never flip the UI to offline: real networks
 * show occasional tail-latency failures against any single endpoint (measured
 * ~10% against api.openai.com on 2026-08-07 with a healthy connection). The
 * offline verdict needs FAILURES_TO_GO_OFFLINE consecutive failed rounds; one
 * successful round recovers immediately.
 */

export const FAILURES_TO_GO_OFFLINE = 2;

export interface ConnectivityDecision {
  isOnline: boolean;
  failStreak: number;
  /** First failure of a streak: re-probe after a short delay instead of waiting a full interval. */
  scheduleQuickRecheck: boolean;
}

export function nextConnectivityState(
  wasOnline: boolean,
  failStreak: number,
  probeOk: boolean,
): ConnectivityDecision {
  if (probeOk) {
    return { isOnline: true, failStreak: 0, scheduleQuickRecheck: false };
  }
  const streak = failStreak + 1;
  if (streak >= FAILURES_TO_GO_OFFLINE) {
    return { isOnline: false, failStreak: streak, scheduleQuickRecheck: false };
  }
  return { isOnline: wasOnline, failStreak: streak, scheduleQuickRecheck: true };
}

/**
 * Resolves true as soon as ANY probe resolves true; false only after ALL
 * probes resolved false. Probes must resolve, never reject.
 */
export function anyProbeSucceeds(probes: ReadonlyArray<Promise<boolean>>): Promise<boolean> {
  if (probes.length === 0) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let pending = probes.length;
    for (const probe of probes) {
      void probe.then((ok) => {
        if (ok) {
          resolve(true);
        } else if (--pending === 0) {
          resolve(false);
        }
      });
    }
  });
}
