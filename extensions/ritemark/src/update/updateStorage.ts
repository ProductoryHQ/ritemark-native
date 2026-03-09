import * as vscode from 'vscode';

const DAY_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEYS = {
  LAST_CHECK_TIMESTAMP: 'ritemark.update.lastCheckTimestamp',
  LAST_SUCCESSFUL_CHECK_TIMESTAMP: 'ritemark.update.lastSuccessfulCheckTimestamp',
  LAST_FAILED_CHECK_TIMESTAMP: 'ritemark.update.lastFailedCheckTimestamp',
  SKIPPED_VERSION: 'ritemark.update.skippedVersion',
  SNOOZE_UNTIL: 'ritemark.update.snoozeUntil',
  PENDING_RESTART_VERSION: 'ritemark.update.pendingRestartVersion',
  LEGACY_DISMISSED_VERSION: 'ritemark.update.dismissedVersion',
  LEGACY_DONT_SHOW_AGAIN: 'ritemark.update.dontShowAgain',
  LEGACY_MIGRATED: 'ritemark.update.legacyPreferencesMigrated'
} as const;

export class UpdateStorage {
  constructor(private globalState: vscode.Memento) {}

  async migrateLegacyPreferences(): Promise<void> {
    const migrated = this.globalState.get<boolean>(STORAGE_KEYS.LEGACY_MIGRATED, false);
    if (migrated) {
      return;
    }

    const legacyDismissedVersion = this.globalState.get<string>(STORAGE_KEYS.LEGACY_DISMISSED_VERSION, '');
    const legacyDontShowAgain = this.globalState.get<boolean>(STORAGE_KEYS.LEGACY_DONT_SHOW_AGAIN, false);

    const updates: Array<Thenable<void>> = [];

    if (legacyDismissedVersion && !this.getSkippedVersion()) {
      updates.push(this.setSkippedVersion(legacyDismissedVersion));
    }

    if (legacyDontShowAgain && !this.getSnoozeUntil()) {
      updates.push(this.setSnoozeUntil(Date.now() + (365 * DAY_MS)));
    }

    updates.push(this.globalState.update(STORAGE_KEYS.LEGACY_MIGRATED, true));
    await Promise.all(updates);
  }

  getLastCheckTimestamp(): number {
    return this.globalState.get<number>(STORAGE_KEYS.LAST_CHECK_TIMESTAMP, 0);
  }

  setLastCheckTimestamp(timestamp: number): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.LAST_CHECK_TIMESTAMP, timestamp);
  }

  getLastSuccessfulCheckTimestamp(): number {
    return this.globalState.get<number>(STORAGE_KEYS.LAST_SUCCESSFUL_CHECK_TIMESTAMP, 0);
  }

  setLastSuccessfulCheckTimestamp(timestamp: number): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.LAST_SUCCESSFUL_CHECK_TIMESTAMP, timestamp);
  }

  getLastFailedCheckTimestamp(): number {
    return this.globalState.get<number>(STORAGE_KEYS.LAST_FAILED_CHECK_TIMESTAMP, 0);
  }

  setLastFailedCheckTimestamp(timestamp: number): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.LAST_FAILED_CHECK_TIMESTAMP, timestamp);
  }

  getSkippedVersion(): string {
    return this.globalState.get<string>(STORAGE_KEYS.SKIPPED_VERSION, '');
  }

  setSkippedVersion(version: string): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.SKIPPED_VERSION, version);
  }

  clearSkippedVersion(): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.SKIPPED_VERSION, '');
  }

  getSnoozeUntil(): number {
    return this.globalState.get<number>(STORAGE_KEYS.SNOOZE_UNTIL, 0);
  }

  setSnoozeUntil(timestamp: number): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.SNOOZE_UNTIL, timestamp);
  }

  clearSnooze(): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.SNOOZE_UNTIL, 0);
  }

  isSnoozed(now: number = Date.now()): boolean {
    return this.getSnoozeUntil() > now;
  }

  getPendingRestartVersion(): string {
    return this.globalState.get<string>(STORAGE_KEYS.PENDING_RESTART_VERSION, '');
  }

  setPendingRestartVersion(version: string): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.PENDING_RESTART_VERSION, version);
  }

  clearPendingRestartVersion(): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.PENDING_RESTART_VERSION, '');
  }
}
