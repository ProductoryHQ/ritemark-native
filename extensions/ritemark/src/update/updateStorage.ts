import * as vscode from 'vscode';

const STORAGE_KEYS = {
  LAST_CHECK_TIMESTAMP: 'ritemark.update.lastCheckTimestamp',
  DISMISSED_VERSION: 'ritemark.update.dismissedVersion',
  DONT_SHOW_AGAIN: 'ritemark.update.dontShowAgain'
} as const;

export class UpdateStorage {
  constructor(private globalState: vscode.Memento) {}

  getLastCheckTimestamp(): number {
    return this.globalState.get<number>(STORAGE_KEYS.LAST_CHECK_TIMESTAMP, 0);
  }

  setLastCheckTimestamp(timestamp: number): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.LAST_CHECK_TIMESTAMP, timestamp);
  }

  getDismissedVersion(): string {
    return this.globalState.get<string>(STORAGE_KEYS.DISMISSED_VERSION, '');
  }

  setDismissedVersion(version: string): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.DISMISSED_VERSION, version);
  }

  getDontShowAgain(): boolean {
    return this.globalState.get<boolean>(STORAGE_KEYS.DONT_SHOW_AGAIN, false);
  }

  setDontShowAgain(value: boolean): Thenable<void> {
    return this.globalState.update(STORAGE_KEYS.DONT_SHOW_AGAIN, value);
  }
}
