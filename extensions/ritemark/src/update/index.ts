/**
 * Update Module
 *
 * Provides auto-update functionality for Ritemark Native.
 * Supports both full app updates (DMG) and lightweight extension-only updates.
 */

// Core services
export { UpdateService } from './updateService';
export { UpdateStorage } from './updateStorage';
export { scheduleStartupCheck } from './updateScheduler';
export type { UpdateStatusSnapshot, UpdateStatusState } from './updateService';

// Version utilities
export { getCurrentVersion, getCurrentAppVersion, getVersionInfo, getExtensionFolderName, parseVersionFromFolderName } from './versionService';
export type { VersionInfo } from './versionService';
export {
  isNewerVersion,
  isStableVersion,
  shouldNotifyUpdate,
  compareVersions,
  determineUpdateType,
  isValidUpgrade,
  getBaseVersion,
  hasExtensionBuild,
  getExtensionBuild
} from './versionComparison';
export type { UpdateType } from './versionComparison';

// GitHub client
export {
  fetchLatestRelease,
  fetchUpdateManifest,
  fetchReleaseByTag,
  getDownloadUrl,
  getManifestUrl,
  hasUpdateManifest,
  parseVersionFromTag,
  buildFallbackManifest
} from './githubClient';
export type { GitHubRelease, UpdateInfo } from './githubClient';

// Feed and resolution
export {
  DEFAULT_UPDATE_FEED_URL,
  fetchUpdateFeed,
  parseUpdateFeed,
  findPlatformAsset,
  toExtensionManifest,
  toFullManifest
} from './updateFeed';
export type {
  UpdateFeed,
  UpdateFeedFullRelease,
  UpdateFeedExtensionRelease,
  UpdateFeedPlatformAsset,
  UpdateFeedExtensionFile
} from './updateFeed';
export { resolveUpdate } from './updateResolver';
export type { ResolveUpdateInput, ResolvedUpdateResult, ResolvedUpdateAction } from './updateResolver';

// Manifest types and utilities
export {
  validateManifest,
  parseManifest,
  isExtensionUpdate,
  isFullUpdate,
  getTotalDownloadSize,
  formatSize
} from './updateManifest';
export type {
  UpdateManifest,
  UpdateFile,
  ManifestValidation
} from './updateManifest';

// User extension installer
export {
  UserExtensionInstaller,
  calculateChecksum,
  calculateBufferChecksum,
  verifyChecksum
} from './userExtensionInstaller';
export type { ProgressCallback, InstallResult } from './userExtensionInstaller';

// Notifications
export {
  showFullUpdateNotification,
  showExtensionUpdateNotification,
  installExtensionUpdateWithProgress,
  promptReloadWindow
} from './updateNotification';
