/**
 * Compatibility-aware update resolver.
 *
 * Selects the best next action for the current installation from the update
 * feed instead of assuming the newest tag is always correct.
 */

import { compareVersions, getBaseVersion } from './versionComparison';
import {
  UpdateFeed,
  UpdateFeedExtensionRelease,
  UpdateFeedFullRelease,
  UpdateFeedPlatformAsset,
  findPlatformAsset,
  toExtensionManifest,
  toFullManifest
} from './updateFeed';
import { UpdateManifest } from './updateManifest';

export type ResolvedUpdateAction = 'none' | 'full' | 'extension' | 'blocked' | 'error';

export interface ResolvedUpdateResult {
  action: ResolvedUpdateAction;
  currentAppVersion: string;
  currentExtensionVersion: string;
  targetVersion?: string;
  summary?: string;
  reason?: string;
  manifest?: UpdateManifest;
  downloadUrl?: string;
  releaseDate?: string;
  downloadSize?: number;
}

export interface ResolveUpdateInput {
  feed: UpdateFeed;
  currentAppVersion: string;
  currentExtensionVersion: string;
  platform: string;
  arch: string;
}

function sortByVersionDesc<T extends { version: string }>(releases: T[]): T[] {
  return [...releases].sort((a, b) => compareVersions(b.version, a.version));
}

function isExtensionCompatible(
  release: UpdateFeedExtensionRelease,
  currentAppVersion: string
): boolean {
  const currentBaseVersion = getBaseVersion(currentAppVersion);
  const requiredAppVersion = release.minimumAppVersion ?? release.appVersion;

  if (compareVersions(currentAppVersion, requiredAppVersion) < 0) {
    return false;
  }

  return currentBaseVersion === release.appVersion;
}

function selectBestFullRelease(
  releases: UpdateFeedFullRelease[],
  currentAppVersion: string,
  platform: string,
  arch: string
): { release: UpdateFeedFullRelease; asset: UpdateFeedPlatformAsset } | null {
  for (const release of sortByVersionDesc(releases)) {
    if (compareVersions(release.version, currentAppVersion) <= 0) {
      continue;
    }

    const asset = findPlatformAsset(release, platform, arch);
    if (asset) {
      return { release, asset };
    }
  }

  return null;
}

function selectBestExtensionRelease(
  releases: UpdateFeedExtensionRelease[],
  currentAppVersion: string,
  currentExtensionVersion: string
): UpdateFeedExtensionRelease | null {
  for (const release of sortByVersionDesc(releases)) {
    if (!isExtensionCompatible(release, currentAppVersion)) {
      continue;
    }

    if (compareVersions(release.version, currentExtensionVersion) <= 0) {
      continue;
    }

    return release;
  }

  return null;
}

export function resolveUpdate(input: ResolveUpdateInput): ResolvedUpdateResult {
  const { feed, currentAppVersion, currentExtensionVersion, platform, arch } = input;

  const bestFullRelease = selectBestFullRelease(feed.fullReleases, currentAppVersion, platform, arch);
  if (bestFullRelease) {
    const manifest = toFullManifest(bestFullRelease.release, bestFullRelease.asset);

    return {
      action: 'full',
      currentAppVersion,
      currentExtensionVersion,
      targetVersion: bestFullRelease.release.version,
      summary: bestFullRelease.release.notesSummary,
      manifest,
      downloadUrl: bestFullRelease.asset.downloadUrl,
      releaseDate: bestFullRelease.release.releaseDate,
      downloadSize: bestFullRelease.asset.size
    };
  }

  const bestExtensionRelease = selectBestExtensionRelease(
    feed.extensionReleases,
    currentAppVersion,
    currentExtensionVersion
  );
  if (bestExtensionRelease) {
    const manifest = toExtensionManifest(bestExtensionRelease);
    const totalSize = bestExtensionRelease.files.reduce((sum, file) => sum + file.size, 0);

    return {
      action: 'extension',
      currentAppVersion,
      currentExtensionVersion,
      targetVersion: bestExtensionRelease.version,
      summary: bestExtensionRelease.notesSummary,
      manifest,
      releaseDate: bestExtensionRelease.releaseDate,
      downloadSize: totalSize
    };
  }

  const newerButIncompatibleExtension = sortByVersionDesc(feed.extensionReleases).find(
    release =>
      compareVersions(release.version, currentExtensionVersion) > 0 &&
      !isExtensionCompatible(release, currentAppVersion)
  );

  if (newerButIncompatibleExtension) {
    return {
      action: 'blocked',
      currentAppVersion,
      currentExtensionVersion,
      targetVersion: newerButIncompatibleExtension.version,
      summary: newerButIncompatibleExtension.notesSummary,
      reason: 'A newer extension release exists, but it requires a newer base app for this installation.'
    };
  }

  return {
    action: 'none',
    currentAppVersion,
    currentExtensionVersion
  };
}
