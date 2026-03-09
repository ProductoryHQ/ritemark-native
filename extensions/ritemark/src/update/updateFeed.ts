/**
 * Canonical update feed parsing and conversion utilities.
 *
 * The feed is fetched from a stable URL and can describe both full app
 * releases and extension-only releases at the same time.
 */

import { UpdateManifest, UpdateFile } from './updateManifest';

const REPO_OWNER = 'jarmo-productory';
const REPO_NAME = 'ritemark-public';
export const DEFAULT_UPDATE_FEED_URL =
  `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/update-feed.json`;

export interface UpdateFeedPlatformAsset {
  platform: string;
  arch: string;
  assetName: string;
  downloadUrl: string;
  size: number;
  sha256: string;
}

export interface UpdateFeedFullRelease {
  version: string;
  tagName?: string;
  releaseDate: string;
  notesSummary: string;
  platforms: UpdateFeedPlatformAsset[];
}

export interface UpdateFeedExtensionFile {
  path: string;
  downloadUrl: string;
  size: number;
  sha256: string;
}

export interface UpdateFeedExtensionRelease {
  version: string;
  appVersion: string;
  minimumAppVersion?: string;
  releaseDate: string;
  notesSummary: string;
  installType?: 'user-extension';
  extensionId?: string;
  extensionDirName: string;
  files: UpdateFeedExtensionFile[];
}

export interface UpdateFeed {
  schemaVersion: number;
  generatedAt: string;
  channel: 'stable';
  fullReleases: UpdateFeedFullRelease[];
  extensionReleases: UpdateFeedExtensionRelease[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePlatformAsset(value: unknown): UpdateFeedPlatformAsset | null {
  if (!isObject(value)) {
    return null;
  }

  const { platform, arch, assetName, downloadUrl, size, sha256 } = value;
  if (!isString(platform) || !isString(arch) || !isString(assetName) || !isString(downloadUrl)) {
    return null;
  }
  if (!isNumber(size) || !isString(sha256)) {
    return null;
  }

  return { platform, arch, assetName, downloadUrl, size, sha256 };
}

function parseExtensionFile(value: unknown): UpdateFeedExtensionFile | null {
  if (!isObject(value)) {
    return null;
  }

  const { path, downloadUrl, size, sha256 } = value;
  if (!isString(path) || !isString(downloadUrl) || !isString(sha256) || !isNumber(size)) {
    return null;
  }

  return { path, downloadUrl, size, sha256 };
}

function parseFullRelease(value: unknown): UpdateFeedFullRelease | null {
  if (!isObject(value)) {
    return null;
  }

  const platforms = Array.isArray(value.platforms)
    ? value.platforms.map(parsePlatformAsset).filter((asset): asset is UpdateFeedPlatformAsset => asset !== null)
    : [];

  if (!isString(value.version) || !isString(value.releaseDate) || typeof value.notesSummary !== 'string') {
    return null;
  }

  return {
    version: value.version,
    tagName: isString(value.tagName) ? value.tagName : undefined,
    releaseDate: value.releaseDate,
    notesSummary: value.notesSummary,
    platforms
  };
}

function parseExtensionRelease(value: unknown): UpdateFeedExtensionRelease | null {
  if (!isObject(value)) {
    return null;
  }

  const files = Array.isArray(value.files)
    ? value.files.map(parseExtensionFile).filter((file): file is UpdateFeedExtensionFile => file !== null)
    : [];

  if (
    !isString(value.version) ||
    !isString(value.appVersion) ||
    !isString(value.releaseDate) ||
    typeof value.notesSummary !== 'string' ||
    !isString(value.extensionDirName)
  ) {
    return null;
  }

  return {
    version: value.version,
    appVersion: value.appVersion,
    minimumAppVersion: isString(value.minimumAppVersion) ? value.minimumAppVersion : undefined,
    releaseDate: value.releaseDate,
    notesSummary: value.notesSummary,
    installType: value.installType === 'user-extension' ? 'user-extension' : undefined,
    extensionId: isString(value.extensionId) ? value.extensionId : undefined,
    extensionDirName: value.extensionDirName,
    files
  };
}

export function parseUpdateFeed(json: string): UpdateFeed | null {
  try {
    const parsed = JSON.parse(json);
    if (!isObject(parsed)) {
      return null;
    }

    const schemaVersion = parsed.schemaVersion;
    if (schemaVersion !== 1) {
      console.error(`Unsupported update feed schema version: ${String(schemaVersion)}`);
      return null;
    }

    const fullReleases = Array.isArray(parsed.fullReleases)
      ? parsed.fullReleases.map(parseFullRelease).filter((release): release is UpdateFeedFullRelease => release !== null)
      : [];
    const extensionReleases = Array.isArray(parsed.extensionReleases)
      ? parsed.extensionReleases
          .map(parseExtensionRelease)
          .filter((release): release is UpdateFeedExtensionRelease => release !== null)
      : [];

    if (!isString(parsed.generatedAt)) {
      return null;
    }

    return {
      schemaVersion: 1,
      generatedAt: parsed.generatedAt,
      channel: parsed.channel === 'stable' ? 'stable' : 'stable',
      fullReleases,
      extensionReleases
    };
  } catch (error) {
    console.error('Failed to parse update feed JSON:', error);
    return null;
  }
}

export async function fetchUpdateFeed(feedUrl: string = DEFAULT_UPDATE_FEED_URL): Promise<UpdateFeed | null> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Ritemark-Native'
      }
    });

    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`Failed to fetch update feed: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const text = await response.text();
    return parseUpdateFeed(text);
  } catch (error) {
    console.error('Failed to fetch update feed:', error);
    return null;
  }
}

export function findPlatformAsset(
  release: UpdateFeedFullRelease,
  platform: string,
  arch: string
): UpdateFeedPlatformAsset | null {
  return (
    release.platforms.find(asset => asset.platform === platform && asset.arch === arch) ??
    release.platforms.find(asset => asset.platform === platform && asset.arch === 'universal') ??
    null
  );
}

export function toExtensionManifest(release: UpdateFeedExtensionRelease): UpdateManifest {
  const files: UpdateFile[] = release.files.map(file => ({
    path: file.path,
    url: file.downloadUrl,
    size: file.size,
    sha256: file.sha256
  }));

  return {
    version: release.version,
    appVersion: release.appVersion,
    extensionVersion: release.version,
    type: 'extension',
    installType: release.installType ?? 'user-extension',
    extensionId: release.extensionId ?? 'ritemark',
    extensionDirName: release.extensionDirName,
    releaseDate: release.releaseDate,
    minimumAppVersion: release.minimumAppVersion,
    files,
    releaseNotes: release.notesSummary
  };
}

export function toFullManifest(
  release: UpdateFeedFullRelease,
  asset: UpdateFeedPlatformAsset
): UpdateManifest {
  return {
    version: release.version,
    appVersion: release.version,
    extensionVersion: release.version,
    type: 'full',
    releaseDate: release.releaseDate,
    ...(asset.assetName.endsWith('.exe')
      ? {
          installerUrl: asset.downloadUrl,
          installerSize: asset.size
        }
      : {
          dmgUrl: asset.downloadUrl,
          dmgSha256: asset.sha256,
          dmgSize: asset.size
        }),
    releaseNotes: release.notesSummary
  };
}
