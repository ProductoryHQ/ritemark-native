/**
 * Version Comparison Utilities
 *
 * Handles semantic versioning with extension build suffix.
 * Format: {major}.{minor}.{patch} or {major}.{minor}.{patch}-ext.{build}
 *
 * Examples:
 * - "1.0.1" - Base app version
 * - "1.0.1-ext.5" - Extension build 5 for app 1.0.1
 */

/**
 * Parsed version with base and extension build number
 */
interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  extBuild: number; // 0 if no -ext suffix
}

/**
 * Parse a version string into components
 * Handles formats: "1.2.3", "v1.2.3", "1.2.3-ext.5", "v1.2.3-ext.5"
 */
function parseVersion(version: string): ParsedVersion {
  // Remove 'v' prefix if present
  let cleanVersion = version.startsWith('v') ? version.slice(1) : version;

  // Check for -ext.N suffix
  let extBuild = 0;
  const extMatch = cleanVersion.match(/-ext\.(\d+)$/);
  if (extMatch) {
    extBuild = parseInt(extMatch[1], 10);
    cleanVersion = cleanVersion.replace(/-ext\.\d+$/, '');
  }

  // Parse base version
  const parts = cleanVersion.split('.');

  return {
    major: parseInt(parts[0] || '0', 10),
    minor: parseInt(parts[1] || '0', 10),
    patch: parseInt(parts[2] || '0', 10),
    extBuild
  };
}

/**
 * Extract the base app version (without -ext suffix)
 */
export function getBaseVersion(version: string): string {
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version;
  return cleanVersion.replace(/-ext\.\d+$/, '');
}

/**
 * Check if version has an extension build suffix
 */
export function hasExtensionBuild(version: string): boolean {
  return /-ext\.\d+$/.test(version);
}

/**
 * Get the extension build number, or 0 if not present
 */
export function getExtensionBuild(version: string): number {
  const match = version.match(/-ext\.(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check if a version string represents a stable release
 * Stable releases are either base versions or extension builds
 * Excludes pre-release suffixes like -beta, -rc.1, -alpha
 */
export function isStableVersion(version: string): boolean {
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

  // Extension builds are stable
  if (/-ext\.\d+$/.test(cleanVersion)) {
    return true;
  }

  // No hyphen = stable base version
  // Has hyphen but not -ext = pre-release
  return !cleanVersion.includes('-');
}

/**
 * Compare two versions
 * @returns negative if v1 < v2, positive if v1 > v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const a = parseVersion(v1);
  const b = parseVersion(v2);

  // Compare major
  if (a.major !== b.major) {
    return a.major - b.major;
  }

  // Compare minor
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }

  // Compare patch
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }

  // Compare extension build
  return a.extBuild - b.extBuild;
}

/**
 * Check if v1 is newer than v2
 */
export function isNewerVersion(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) > 0;
}

/**
 * Check if upgrade from current to target is valid (no downgrades)
 */
export function isValidUpgrade(current: string, target: string): boolean {
  const comparison = compareVersions(target, current);
  if (comparison <= 0) {
    console.warn(`Rejected update: ${target} is not newer than ${current}`);
    return false;
  }
  return true;
}

/**
 * Determine the type of update needed
 */
export type UpdateType = 'full' | 'extension' | 'none';

/**
 * Determine what type of update is needed from current to target version
 *
 * - 'none': No update needed or target is older (downgrade)
 * - 'extension': Same base version, only extension build changed
 * - 'full': Base version changed, requires full app update
 */
export function determineUpdateType(current: string, target: string): UpdateType {
  // Check if target is newer
  if (compareVersions(target, current) <= 0) {
    return 'none';
  }

  // Compare base versions
  const currentBase = getBaseVersion(current);
  const targetBase = getBaseVersion(target);

  if (currentBase === targetBase) {
    // Same base version, extension-only update
    return 'extension';
  }

  // Different base version, full update needed
  return 'full';
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
