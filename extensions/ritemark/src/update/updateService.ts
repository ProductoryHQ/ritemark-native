/**
 * Update Service
 *
 * Main entry point for update checks. Determines update type and
 * delegates to appropriate notification/installation flow.
 */

import { UpdateStorage } from './updateStorage';
import { getCurrentVersion } from './versionService';
import { shouldNotifyUpdate, determineUpdateType, isValidUpgrade } from './versionComparison';
import {
  fetchLatestRelease,
  fetchUpdateManifest,
  getDownloadUrl,
  parseVersionFromTag,
  buildFallbackManifest
} from './githubClient';
import { showUpdateNotification, showExtensionUpdateNotification } from './updateNotification';
import { UserExtensionInstaller } from './userExtensionInstaller';
import { UpdateManifest } from './updateManifest';

export class UpdateService {
  private installer: UserExtensionInstaller;

  constructor(private storage: UpdateStorage) {
    this.installer = new UserExtensionInstaller();
  }

  /**
   * Check for updates and show notification if newer version available
   * This is the main entry point called by the scheduler
   */
  async checkAndNotify(): Promise<void> {
    try {
      // Cleanup any leftover staging files from previous runs
      await this.installer.cleanupStaging();

      const currentVersion = getCurrentVersion();
      const release = await fetchLatestRelease();

      if (!release) {
        console.log('No release data available');
        return;
      }

      const latestVersion = parseVersionFromTag(release.tag_name);

      // Check if we should notify about this update
      if (!shouldNotifyUpdate(currentVersion, latestVersion)) {
        console.log(`No update needed. Current: ${currentVersion}, Latest: ${latestVersion}`);
        // Cleanup old user extension versions if update already applied
        await this.cleanupOldVersionsIfNeeded(currentVersion);
        return;
      }

      // Check if user already dismissed this version
      const dismissedVersion = this.storage.getDismissedVersion();
      if (dismissedVersion === latestVersion) {
        console.log(`User already dismissed version ${latestVersion}`);
        return;
      }

      // Try to fetch update manifest
      let manifest = await fetchUpdateManifest(release.tag_name);

      // Fall back to DMG-only manifest for older releases
      if (!manifest) {
        manifest = buildFallbackManifest(release);
        if (!manifest) {
          console.log('No darwin-arm64 DMG found in release assets');
          return;
        }
      }

      // Update last check timestamp
      await this.storage.setLastCheckTimestamp(Date.now());

      // Determine update type and show appropriate notification
      const updateType = determineUpdateType(currentVersion, manifest.version);

      console.log(`Update available: ${latestVersion} (current: ${currentVersion}, type: ${updateType})`);

      if (updateType === 'extension' && manifest.type === 'extension') {
        // Extension-only update - can install in-place
        await showExtensionUpdateNotification(manifest, this.storage, this.installer);
      } else if (updateType === 'full' || manifest.type === 'full') {
        // Full app update - open DMG download
        const downloadUrl = manifest.dmgUrl || getDownloadUrl(release);
        if (downloadUrl) {
          await showUpdateNotification(latestVersion, downloadUrl, this.storage);
        }
      }

    } catch (error) {
      console.error('Update check failed:', error);
      // Fail silently - don't interrupt user experience
    }
  }

  /**
   * Get the installer instance for external use
   */
  getInstaller(): UserExtensionInstaller {
    return this.installer;
  }

  /**
   * Cleanup old user extension versions after successful update
   */
  private async cleanupOldVersionsIfNeeded(currentVersion: string): Promise<void> {
    try {
      const installedVersions = await this.installer.listInstalledVersions();
      if (installedVersions.length > 1) {
        console.log('Cleaning up old extension versions...');
        await this.installer.cleanupOldVersions(currentVersion);
      }
    } catch (error) {
      console.error('Failed to cleanup old versions:', error);
    }
  }

  /**
   * Manually trigger an extension update (for testing)
   */
  async applyExtensionUpdate(manifest: UpdateManifest): Promise<boolean> {
    if (manifest.type !== 'extension') {
      console.error('Cannot apply non-extension manifest');
      return false;
    }

    const result = await this.installer.applyUpdate(manifest);
    if (result.success && result.version) {
      await this.installer.promptReload(result.version);
      return true;
    }

    return false;
  }
}
