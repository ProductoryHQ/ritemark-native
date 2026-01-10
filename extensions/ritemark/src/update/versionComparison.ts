/**
 * Check if a version string represents a stable release (no pre-release suffix)
 * Pre-release versions contain hyphen: 1.0.0-beta, 1.0.0-rc.1
 */
export function isStableVersion(version: string): boolean {
  return !version.includes('-');
}

/**
 * Parse a semantic version string into major, minor, patch components
 * @param version - Version string like "1.2.3" or "v1.2.3"
 * @returns Object with major, minor, patch numbers
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } {
  // Remove 'v' prefix if present
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

  // Split by hyphen to remove pre-release suffix (1.0.0-beta → 1.0.0)
  const baseVersion = cleanVersion.split('-')[0];

  const parts = baseVersion.split('.');

  return {
    major: parseInt(parts[0] || '0', 10),
    minor: parseInt(parts[1] || '0', 10),
    patch: parseInt(parts[2] || '0', 10)
  };
}

/**
 * Compare two semantic versions
 * @param v1 - First version
 * @param v2 - Second version
 * @returns true if v1 > v2
 */
export function isNewerVersion(v1: string, v2: string): boolean {
  const a = parseVersion(v1);
  const b = parseVersion(v2);

  if (a.major !== b.major) {
    return a.major > b.major;
  }

  if (a.minor !== b.minor) {
    return a.minor > b.minor;
  }

  return a.patch > b.patch;
}

/**
 * Determine if we should notify the user about an update
 * Only notify for stable releases that are newer than current version
 */
export function shouldNotifyUpdate(current: string, latest: string): boolean {
  // Only notify for stable releases
  if (!isStableVersion(latest)) {
    return false;
  }

  return isNewerVersion(latest, current);
}
