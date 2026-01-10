/**
 * Update Module
 *
 * Provides auto-update functionality for RiteMark Native.
 * Checks GitHub Releases for new versions and notifies users.
 */

export { UpdateService } from './updateService';
export { UpdateStorage } from './updateStorage';
export { scheduleStartupCheck } from './updateScheduler';
export { getCurrentVersion } from './versionService';
export { isNewerVersion, isStableVersion, shouldNotifyUpdate } from './versionComparison';
export { fetchLatestRelease, getDownloadUrl, parseVersionFromTag } from './githubClient';
export { showUpdateNotification } from './updateNotification';
