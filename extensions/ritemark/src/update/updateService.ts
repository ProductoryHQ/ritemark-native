/**
 * Update Service
 *
 * Resolves the best next update action from the canonical feed and exposes
 * that state to both startup notifications and Settings UI.
 */

import * as vscode from 'vscode';
import { UpdateStorage } from './updateStorage';
import { getCurrentAppVersion, getCurrentVersion } from './versionService';
import {
  fetchLatestRelease,
  fetchUpdateManifest,
  getDownloadUrl,
  parseVersionFromTag,
  buildFallbackManifest
} from './githubClient';
import { UserExtensionInstaller } from './userExtensionInstaller';
import { UpdateManifest, getTotalDownloadSize } from './updateManifest';
import {
  fetchUpdateFeed,
} from './updateFeed';
import { resolveUpdate, ResolvedUpdateResult } from './updateResolver';
import {
  installExtensionUpdateWithProgress,
  promptReloadWindow,
  showExtensionUpdateNotification,
  showFullUpdateNotification
} from './updateNotification';
import { compareVersions } from './versionComparison';

const STARTUP_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PAUSE_FOR_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type UpdateStatusState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'paused'
  | 'restart-required'
  | 'blocked'
  | 'error';

export interface UpdateStatusSnapshot {
  state: UpdateStatusState;
  currentAppVersion: string;
  currentExtensionVersion: string;
  updatesEnabled: boolean;
  lastCheckedAt: number;
  lastSuccessfulCheckAt: number;
  lastFailedCheckAt: number;
  skippedVersion: string;
  snoozeUntil: number;
  pendingRestartVersion: string;
  availableUpdate?: {
    action: 'full' | 'extension';
    version: string;
    summary: string;
    releaseDate?: string;
    downloadSize?: number;
  };
  feedSource: 'feed' | 'legacy' | 'none';
  error?: string;
  blockedReason?: string;
}

export class UpdateService {
  private installer: UserExtensionInstaller;
  private lastResolved: ResolvedUpdateResult | null = null;
  private lastKnownFeedSource: 'feed' | 'legacy' | 'none' = 'none';
  private lastError = '';
  private isChecking = false;
  private initialized = false;

  constructor(private storage: UpdateStorage) {
    this.installer = new UserExtensionInstaller();
  }

  async checkAndNotify(): Promise<UpdateStatusSnapshot> {
    return this.checkForUpdates({ manual: false, notify: true });
  }

  async checkForUpdates(options: { manual?: boolean; notify?: boolean } = {}): Promise<UpdateStatusSnapshot> {
    const { manual = false, notify = false } = options;

    await this.prepareState();

    if (this.isChecking) {
      return this.getStatusSnapshot('checking');
    }

    const lastCheckTimestamp = this.storage.getLastCheckTimestamp();
    if (!manual && lastCheckTimestamp > 0 && (Date.now() - lastCheckTimestamp) < STARTUP_CHECK_INTERVAL_MS) {
      return this.getStatusSnapshot();
    }

    this.isChecking = true;
    await this.storage.setLastCheckTimestamp(Date.now());

    try {
      await this.installer.cleanupStaging();
      this.lastResolved = await this.resolveLatestUpdate();
      this.lastError = '';
      await this.storage.setLastSuccessfulCheckTimestamp(Date.now());
    } catch (error) {
      this.lastResolved = {
        action: 'error',
        currentAppVersion: getCurrentAppVersion(),
        currentExtensionVersion: getCurrentVersion(),
        reason: error instanceof Error ? error.message : String(error)
      };
      this.lastError = this.lastResolved.reason || 'Unknown update error';
      await this.storage.setLastFailedCheckTimestamp(Date.now());
    } finally {
      this.isChecking = false;
    }

    const snapshot = await this.getStatusSnapshot();

    if (notify) {
      await this.notifyIfNeeded(snapshot, manual);
    } else if (manual) {
      await this.showManualCheckResult(snapshot);
    }

    return snapshot;
  }

  async installResolvedUpdate(): Promise<boolean> {
    await this.prepareState();

    if (!this.lastResolved || (this.lastResolved.action !== 'full' && this.lastResolved.action !== 'extension')) {
      await this.checkForUpdates({ manual: true, notify: false });
    }

    if (!this.lastResolved || !this.lastResolved.manifest || !this.lastResolved.targetVersion) {
      return false;
    }

    if (this.lastResolved.action === 'full') {
      const downloadUrl = this.lastResolved.downloadUrl
        || this.lastResolved.manifest.installerUrl
        || this.lastResolved.manifest.dmgUrl;
      if (!downloadUrl) {
        return false;
      }
      await vscode.env.openExternal(vscode.Uri.parse(downloadUrl));
      return true;
    }

    const installResult = await installExtensionUpdateWithProgress(this.lastResolved.manifest, this.installer);
    if (!installResult.success) {
      return false;
    }

    await this.storage.clearSkippedVersion();
    await this.storage.clearSnooze();
    await this.storage.setPendingRestartVersion(this.lastResolved.targetVersion);
    await promptReloadWindow(this.lastResolved.targetVersion);
    return true;
  }

  async skipResolvedUpdate(): Promise<void> {
    if (this.lastResolved?.targetVersion) {
      await this.storage.setSkippedVersion(this.lastResolved.targetVersion);
    }
  }

  async pauseNotifications(days: number = 7): Promise<void> {
    await this.storage.setSnoozeUntil(Date.now() + (days * 24 * 60 * 60 * 1000));
  }

  async resumeNotifications(): Promise<void> {
    await this.storage.clearSnooze();
    await this.storage.clearSkippedVersion();
  }

  async getStatusSnapshot(forcedState?: UpdateStatusState): Promise<UpdateStatusSnapshot> {
    await this.prepareState();
    return this.buildSnapshot(forcedState);
  }

  /**
   * Get the installer instance for external use
   */
  getInstaller(): UserExtensionInstaller {
    return this.installer;
  }

  /**
   * Manually trigger an extension update (for testing)
   */
  async applyExtensionUpdate(manifest: UpdateManifest): Promise<boolean> {
    if (manifest.type !== 'extension') {
      console.error('Cannot apply non-extension manifest');
      return false;
    }

    const result = await installExtensionUpdateWithProgress(manifest, this.installer);
    if (result.success) {
      await this.storage.setPendingRestartVersion(manifest.version);
      await promptReloadWindow(manifest.version);
      return true;
    }

    return false;
  }

  private async prepareState(): Promise<void> {
    if (this.initialized) {
      await this.reconcilePendingRestartVersion();
      return;
    }

    await this.storage.migrateLegacyPreferences();
    await this.reconcilePendingRestartVersion();
    this.initialized = true;
  }

  private async reconcilePendingRestartVersion(): Promise<void> {
    const pendingRestartVersion = this.storage.getPendingRestartVersion();
    if (!pendingRestartVersion) {
      return;
    }

    const currentVersion = getCurrentVersion();
    if (compareVersions(currentVersion, pendingRestartVersion) >= 0) {
      await this.storage.clearPendingRestartVersion();
    }
  }

  private async resolveLatestUpdate(): Promise<ResolvedUpdateResult> {
    const currentAppVersion = getCurrentAppVersion();
    const currentExtensionVersion = getCurrentVersion();
    const feed = await fetchUpdateFeed();

    if (feed) {
      this.lastKnownFeedSource = 'feed';
      return resolveUpdate({
        feed,
        currentAppVersion,
        currentExtensionVersion,
        platform: process.platform,
        arch: process.arch
      });
    }

    this.lastKnownFeedSource = 'legacy';
    return this.resolveLegacyLatestUpdate(currentAppVersion, currentExtensionVersion);
  }

  private async resolveLegacyLatestUpdate(
    currentAppVersion: string,
    currentExtensionVersion: string
  ): Promise<ResolvedUpdateResult> {
    const release = await fetchLatestRelease();

    if (!release) {
      this.lastKnownFeedSource = 'none';
      return {
        action: 'none',
        currentAppVersion,
        currentExtensionVersion
      };
    }

    let manifest = await fetchUpdateManifest(release.tag_name);
    if (!manifest) {
      manifest = buildFallbackManifest(release);
    }

    if (!manifest) {
      this.lastKnownFeedSource = 'none';
      return {
        action: 'error',
        currentAppVersion,
        currentExtensionVersion,
        reason: 'No update metadata or compatible installer was found in the latest release.'
      };
    }

    const downloadUrl = manifest.installerUrl || manifest.dmgUrl || getDownloadUrl(release) || undefined;
    const targetVersion = parseVersionFromTag(release.tag_name);
    const action = manifest.type === 'extension' ? 'extension' : 'full';
    const downloadSize = getTotalDownloadSize(manifest);
    const targetCurrentVersion = action === 'full' ? currentAppVersion : currentExtensionVersion;

    if (compareVersions(targetVersion, targetCurrentVersion) <= 0) {
      return {
        action: 'none',
        currentAppVersion,
        currentExtensionVersion
      };
    }

    if (action === 'extension' && manifest.minimumAppVersion && compareVersions(currentAppVersion, manifest.minimumAppVersion) < 0) {
      return {
        action: 'blocked',
        currentAppVersion,
        currentExtensionVersion,
        targetVersion,
        summary: manifest.releaseNotes,
        reason: `Extension update ${targetVersion} requires app ${manifest.minimumAppVersion} or newer.`
      };
    }

    return {
      action,
      currentAppVersion,
      currentExtensionVersion,
      targetVersion,
      summary: manifest.releaseNotes,
      manifest,
      downloadUrl,
      releaseDate: manifest.releaseDate,
      downloadSize: downloadSize > 0 ? downloadSize : undefined
    };
  }

  private async notifyIfNeeded(snapshot: UpdateStatusSnapshot, manual: boolean): Promise<void> {
    if (!snapshot.availableUpdate || !this.lastResolved?.manifest || !this.lastResolved.targetVersion) {
      return;
    }

    if (!manual) {
      if (snapshot.skippedVersion === this.lastResolved.targetVersion) {
        return;
      }

      if (snapshot.snoozeUntil > Date.now()) {
        return;
      }
    }

    const choice = this.lastResolved.action === 'full'
      ? await showFullUpdateNotification(this.lastResolved.manifest)
      : await showExtensionUpdateNotification(this.lastResolved.manifest);

    switch (choice) {
      case 'install':
        await this.installResolvedUpdate();
        break;
      case 'skip':
        await this.skipResolvedUpdate();
        break;
      case 'pause':
        await this.pauseNotifications(PAUSE_FOR_7_DAYS_MS / (24 * 60 * 60 * 1000));
        break;
      case 'later':
      default:
        break;
    }
  }

  private async showManualCheckResult(snapshot: UpdateStatusSnapshot): Promise<void> {
    if (snapshot.state === 'up-to-date') {
      await vscode.window.showInformationMessage(
        `Ritemark is up to date (${snapshot.currentAppVersion}).`
      );
      return;
    }

    if (snapshot.state === 'error' && snapshot.error) {
      await vscode.window.showWarningMessage(`Ritemark could not check for updates: ${snapshot.error}`);
      return;
    }

    if (snapshot.state === 'blocked' && snapshot.blockedReason) {
      await vscode.window.showWarningMessage(snapshot.blockedReason);
    }
  }

  private buildSnapshot(forcedState?: UpdateStatusState): UpdateStatusSnapshot {
    const currentAppVersion = getCurrentAppVersion();
    const currentExtensionVersion = getCurrentVersion();
    const updatesEnabled = vscode.workspace.getConfiguration('ritemark.updates').get<boolean>('enabled', true);
    const pendingRestartVersion = this.storage.getPendingRestartVersion();
    const snoozeUntil = this.storage.getSnoozeUntil();
    const rawSkippedVersion = this.storage.getSkippedVersion();
    const skippedVersion = rawSkippedVersion && compareVersions(rawSkippedVersion, currentExtensionVersion) > 0
      ? rawSkippedVersion
      : '';
    const lastSuccessfulCheckAt = this.storage.getLastSuccessfulCheckTimestamp();
    const lastFailedCheckAt = this.storage.getLastFailedCheckTimestamp();
    const lastCheckedAt = this.storage.getLastCheckTimestamp();

    let state: UpdateStatusState = forcedState ?? 'idle';
    let availableUpdate: UpdateStatusSnapshot['availableUpdate'];
    let blockedReason: string | undefined;

    if (!forcedState) {
      if (pendingRestartVersion) {
        state = 'restart-required';
      } else if (this.isChecking) {
        state = 'checking';
      } else if (!updatesEnabled || snoozeUntil > Date.now()) {
        state = 'paused';
      } else if (this.lastResolved?.action === 'error') {
        state = 'error';
      } else if (this.lastResolved?.action === 'blocked') {
        state = 'blocked';
      } else if (this.lastResolved?.action === 'full' || this.lastResolved?.action === 'extension') {
        state = 'update-available';
      } else {
        state = 'up-to-date';
      }
    }

    if (this.lastResolved && (this.lastResolved.action === 'full' || this.lastResolved.action === 'extension') && this.lastResolved.targetVersion) {
      availableUpdate = {
        action: this.lastResolved.action,
        version: this.lastResolved.targetVersion,
        summary: this.lastResolved.summary || '',
        releaseDate: this.lastResolved.releaseDate,
        downloadSize: this.lastResolved.downloadSize
      };
    }

    if (this.lastResolved?.action === 'blocked') {
      blockedReason = this.lastResolved.reason;
    }

    return {
      state,
      currentAppVersion,
      currentExtensionVersion,
      updatesEnabled,
      lastCheckedAt,
      lastSuccessfulCheckAt,
      lastFailedCheckAt,
      skippedVersion,
      snoozeUntil,
      pendingRestartVersion,
      availableUpdate,
      feedSource: this.lastKnownFeedSource,
      error: this.lastError || this.lastResolved?.reason,
      blockedReason
    };
  }
}
