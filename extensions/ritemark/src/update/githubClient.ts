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
 * Parse version from tag name (removes 'v' prefix)
 * @param tagName - Git tag like "v1.0.1"
 * @returns Version string like "1.0.1"
 */
export function parseVersionFromTag(tagName: string): string {
  return tagName.startsWith('v') ? tagName.slice(1) : tagName;
}
