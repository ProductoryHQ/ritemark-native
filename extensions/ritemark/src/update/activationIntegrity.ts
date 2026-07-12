/**
 * Activation-integrity tracking and rollback (Sprint 93 R9).
 *
 * cleanupOldVersions() (userExtensionInstaller.ts) had zero call sites before
 * this sprint — nothing verified a staged/installed version actually
 * activated before treating install as terminal-success. This module closes
 * that gap for RUNTIME activation failures (an exception thrown synchronously
 * inside activate()): each launch records "I started activating version X";
 * only a clean return from activate() promotes that to "confirmed good." If
 * the NEXT launch of the SAME version sees a dangling "started but never
 * confirmed" record, that version crashed mid-activation last time — this
 * module quarantines it (removes its own ~/.ritemark/extensions directory)
 * so the next restart falls through to the kept N-1 version via VS Code's
 * own extension-directory dedup (confirmed in tasks.md W3.4: core's scanner
 * always picks the highest-semver directory that's still present on disk).
 *
 * Known limitation (documented, not solved here — see tasks.md W3.5's
 * go/no-go note): a LOAD-TIME failure (a syntax error or module-level throw,
 * the v1.7.1 "Invalid or unexpected token" precedent) prevents this file's
 * own code from ever running, so it cannot self-heal on the very first
 * broken launch. That specific class is substantially mitigated already by
 * W2.1's preflight (release-extension-preflight.sh blocks releasing when
 * `npm run compile`'s tsc typecheck fails) and W3.1-era validate-build-output
 * content-sentinel checks — a genuinely broken TypeScript source can no
 * longer ship via the fast lane in the first place. A true belt-and-suspenders
 * fix for the load-time case would need a check before the extension host
 * even attempts to load the module, which is out of reach without a VS Code
 * core patch — explicitly flagged to Jarmo rather than silently expanding
 * this sprint's scope into shell-tier territory.
 */

import * as vscode from 'vscode';
import { UserExtensionInstaller } from './userExtensionInstaller';

const KEYS = {
  LAST_ATTEMPTED_VERSION: 'ritemark.activation.lastAttemptedVersion',
  LAST_CONFIRMED_VERSION: 'ritemark.activation.lastConfirmedVersion'
} as const;

export class ActivationIntegrityTracker {
  constructor(private globalState: vscode.Memento) {}

  getLastAttemptedVersion(): string {
    return this.globalState.get<string>(KEYS.LAST_ATTEMPTED_VERSION, '');
  }

  getLastConfirmedVersion(): string {
    return this.globalState.get<string>(KEYS.LAST_CONFIRMED_VERSION, '');
  }

  async setLastAttemptedVersion(version: string): Promise<void> {
    await this.globalState.update(KEYS.LAST_ATTEMPTED_VERSION, version);
  }

  async setLastConfirmedVersion(version: string): Promise<void> {
    await this.globalState.update(KEYS.LAST_CONFIRMED_VERSION, version);
  }

  /**
   * Call once, at the very start of activate(). Returns true if the
   * currently-loading version already failed to confirm on a prior launch
   * (a repeat activation attempt of the same bad version) — the caller
   * should quarantine it and prompt for a reload.
   */
  didPreviousAttemptFail(currentVersion: string): boolean {
    const lastAttempted = this.getLastAttemptedVersion();
    const lastConfirmed = this.getLastConfirmedVersion();
    return lastAttempted === currentVersion && lastConfirmed !== currentVersion;
  }
}

/**
 * Remove the currently-running version's own installed directory (it is
 * confirmed bad — repeat activation failure), so VS Code's own scanner falls
 * through to the next-highest remaining version on the next restart.
 *
 * Safe to call from inside the bad version's own activate(): the running
 * process already has this directory's files loaded into memory: Node does
 * not need the files on disk again until the NEXT process start.
 */
export async function quarantineVersion(version: string): Promise<void> {
  const installer = new UserExtensionInstaller();
  await installer.removeInstalledVersion(version);
}

/**
 * Call once, at the end of a successful activate() (after the function body
 * completes with no synchronous throw). Marks the current version confirmed
 * and trims old installs down to N-1 (current + the previously-confirmed
 * version), never just "the newest one" — so a bad NEW version can still
 * roll back to a good PREVIOUS one.
 */
export async function confirmActivationAndCleanup(
  tracker: ActivationIntegrityTracker,
  currentVersion: string
): Promise<void> {
  const previousConfirmed = tracker.getLastConfirmedVersion();
  await tracker.setLastConfirmedVersion(currentVersion);

  const keepVersions = [currentVersion];
  if (previousConfirmed && previousConfirmed !== currentVersion) {
    keepVersions.push(previousConfirmed);
  }

  const installer = new UserExtensionInstaller();
  await installer.cleanupOldVersions(keepVersions);
}
