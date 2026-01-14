/**
 * GitHub Client
 *
 * Fetches release information and update manifests from GitHub.
 */

import { UpdateManifest, parseManifest } from './updateManifest';

const REPO_OWNER = 'jarmo-productory';
const REPO_NAME = 'ritemark-public';
const API_ENDPOINT = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  prerelease: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export interface UpdateInfo {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
}

/**
 * Fetch the latest release from GitHub
 * @returns GitHubRelease object or null if fetch fails
 */
export async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(API_ENDPOINT, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RiteMark-Native'
      }
    });

    if (!response.ok) {
      console.error(`GitHub API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data as GitHubRelease;
  } catch (error) {
    console.error('Failed to fetch latest release:', error);
    return null;
  }
}

/**
 * Fetch update manifest from a GitHub release
 * @param tagName - Release tag (e.g., "v1.0.1-ext.5")
 * @returns UpdateManifest or null if not found
 */
export async function fetchUpdateManifest(tagName: string): Promise<UpdateManifest | null> {
  const manifestUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${tagName}/update-manifest.json`;

  try {
    const response = await fetch(manifestUrl, {
      headers: {
        'User-Agent': 'RiteMark-Native'
      }
    });

    if (!response.ok) {
      // Manifest not found - this is expected for older releases
      if (response.status === 404) {
        console.log(`No update manifest found for ${tagName}`);
        return null;
      }
      console.error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
      return null;
    }

    const text = await response.text();
    return parseManifest(text);
  } catch (error) {
    console.error('Failed to fetch update manifest:', error);
    return null;
  }
}

/**
 * Fetch a specific release by tag name
 * @param tagName - Release tag (e.g., "v1.0.1-ext.5")
 * @returns GitHubRelease or null if not found
 */
export async function fetchReleaseByTag(tagName: string): Promise<GitHubRelease | null> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${tagName}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RiteMark-Native'
      }
    });

    if (!response.ok) {
      console.error(`GitHub API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data as GitHubRelease;
  } catch (error) {
    console.error('Failed to fetch release by tag:', error);
    return null;
  }
}

/**
 * Extract darwin-arm64 DMG download URL from release assets
 * @param release - GitHub release object
 * @returns Download URL or null if not found
 */
export function getDownloadUrl(release: GitHubRelease): string | null {
  const asset = release.assets.find(a =>
    a.name.includes('darwin-arm64') && a.name.endsWith('.dmg')
  );

  return asset?.browser_download_url ?? null;
}

/**
 * Find update manifest asset in release
 * @param release - GitHub release object
 * @returns Manifest download URL or null if not found
 */
export function getManifestUrl(release: GitHubRelease): string | null {
  const asset = release.assets.find(a => a.name === 'update-manifest.json');
  return asset?.browser_download_url ?? null;
}

/**
 * Check if release has an update manifest
 * @param release - GitHub release object
 * @returns true if manifest asset exists
 */
export function hasUpdateManifest(release: GitHubRelease): boolean {
  return release.assets.some(a => a.name === 'update-manifest.json');
}

/**
 * Parse version from tag name (removes 'v' prefix)
 * @param tagName - Git tag like "v1.0.1"
 * @returns Version string like "1.0.1"
 */
export function parseVersionFromTag(tagName: string): string {
  return tagName.startsWith('v') ? tagName.slice(1) : tagName;
}

/**
 * Build a fallback manifest for releases without update-manifest.json
 * This allows backward compatibility with older releases
 */
export function buildFallbackManifest(release: GitHubRelease): UpdateManifest | null {
  const dmgUrl = getDownloadUrl(release);
  if (!dmgUrl) {
    return null;
  }

  const version = parseVersionFromTag(release.tag_name);

  return {
    version,
    appVersion: version,
    extensionVersion: version,
    type: 'full',
    releaseDate: new Date().toISOString(),
    dmgUrl,
    releaseNotes: release.body || ''
  };
}
