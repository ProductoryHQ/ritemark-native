import { UpdateStorage } from './updateStorage';
import { getCurrentVersion } from './versionService';
import { shouldNotifyUpdate } from './versionComparison';
import { fetchLatestRelease, getDownloadUrl, parseVersionFromTag } from './githubClient';
import { showUpdateNotification } from './updateNotification';

export class UpdateService {
  constructor(private storage: UpdateStorage) {}

  /**
   * Check for updates and show notification if newer version available
   * This is the main entry point called by the scheduler
   */
  async checkAndNotify(): Promise<void> {
    try {
      const currentVersion = getCurrentVersion();
      const release = await fetchLatestRelease();

      if (!release) {
        console.log('No release data available');
        return;
      }

      const latestVersion = parseVersionFromTag(release.tag_name);
      const downloadUrl = getDownloadUrl(release);

      if (!downloadUrl) {
        console.log('No darwin-arm64 DMG found in release assets');
        return;
      }

      // Check if we should notify about this update
      if (!shouldNotifyUpdate(currentVersion, latestVersion)) {
        console.log(`No update needed. Current: ${currentVersion}, Latest: ${latestVersion}`);
        return;
      }

      // Check if user already dismissed this version
      const dismissedVersion = this.storage.getDismissedVersion();
      if (dismissedVersion === latestVersion) {
        console.log(`User already dismissed version ${latestVersion}`);
        return;
      }

      // Update last check timestamp
      await this.storage.setLastCheckTimestamp(Date.now());

      // Show notification
      console.log(`New version available: ${latestVersion} (current: ${currentVersion})`);
      await showUpdateNotification(latestVersion, downloadUrl, this.storage);

    } catch (error) {
      console.error('Update check failed:', error);
      // Fail silently - don't interrupt user experience
    }
  }
}
