/**
 * Version Comparison Utilities
 *
 * Handles semantic versioning with two Ritemark-specific pre-release forms
 * layered on top of a standard {major}.{minor}.{patch} base:
 *
 * - "1.0.1"        - plain release (the base app version)
 * - "1.0.1-0"      - the BUILT-IN FLOOR shipped inside a production app bundle
 *                    (see #142). Sorts strictly BELOW any "-ext.N" patch so a
 *                    user-installed extension update always wins VS Code's own
 *                    extension scanner.
 * - "1.0.1-ext.5"  - extension build 5, an over-the-air patch for app 1.0.1
 *
 * Ordering within one base is exactly standard semver precedence:
 *   1.0.1-0  <  1.0.1-ext.1  <  1.0.1-ext.2  <  1.0.1
 * (numeric pre-release identifiers rank below alphanumeric ones, and a plain
 * release outranks every pre-release of the same base). Matching semver here
 * is the whole point: VS Code's scanner uses standard semver, so Ritemark's
 * own resolver MUST agree or it offers updates that never load (#142).
 */

/**
 * Parsed version with base numbers and the raw pre-release identifiers.
 */
interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /**
   * Dot-separated pre-release identifiers (the tokens after '-'), or an empty
   * array for a plain release. Compared per semver: numeric identifiers rank
   * below alphanumeric ones, and an empty pre-release outranks any non-empty
   * one at the same base.
   */
  preRelease: string[];
  /** Back-compat convenience: N for "X.Y.Z-ext.N", else 0. */
  extBuild: number;
}

/**
 * Parse a version string into components.
 * Handles: "1.2.3", "v1.2.3", "1.2.3-0", "1.2.3-ext.5", "v1.2.3-ext.5".
 * Build metadata ("+...") is stripped and ignored for precedence, per semver.
 */
function parseVersion(version: string): ParsedVersion {
  // Remove 'v' prefix if present
  let cleanVersion = version.startsWith('v') ? version.slice(1) : version;

  // Strip build metadata — ignored for precedence.
  const plusIndex = cleanVersion.indexOf('+');
  if (plusIndex !== -1) {
    cleanVersion = cleanVersion.slice(0, plusIndex);
  }

  // Split base from pre-release at the first hyphen.
  let base = cleanVersion;
  let preRelease: string[] = [];
  const hyphenIndex = cleanVersion.indexOf('-');
  if (hyphenIndex !== -1) {
    base = cleanVersion.slice(0, hyphenIndex);
    const pre = cleanVersion.slice(hyphenIndex + 1);
    preRelease = pre.length > 0 ? pre.split('.') : [];
  }

  const parts = base.split('.');

  let extBuild = 0;
  if (preRelease[0] === 'ext' && /^\d+$/.test(preRelease[1] ?? '')) {
    extBuild = parseInt(preRelease[1], 10);
  }

  return {
    major: parseInt(parts[0] || '0', 10),
    minor: parseInt(parts[1] || '0', 10),
    patch: parseInt(parts[2] || '0', 10),
    preRelease,
    extBuild
  };
}

/**
 * Compare a single pair of semver pre-release identifiers.
 * Numeric identifiers always rank below alphanumeric ones (semver §11.4.3).
 */
function compareIdentifier(a: string, b: string): number {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) {
    return parseInt(a, 10) - parseInt(b, 10);
  }
  if (aNum) {
    return -1; // numeric < alphanumeric
  }
  if (bNum) {
    return 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Compare two pre-release identifier lists per semver §11.4.
 * An empty list (a plain release) outranks any non-empty list.
 */
function comparePreRelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) {
    return 0;
  }
  if (a.length === 0) {
    return 1; // release > pre-release
  }
  if (b.length === 0) {
    return -1;
  }
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i++) {
    const cmp = compareIdentifier(a[i], b[i]);
    if (cmp !== 0) {
      return cmp;
    }
  }
  // All shared identifiers equal — the longer list has higher precedence.
  return a.length - b.length;
}

/**
 * Extract the base app version (without any pre-release / build suffix).
 * "1.0.1", "1.0.1-0" and "1.0.1-ext.5" all yield "1.0.1".
 */
export function getBaseVersion(version: string): string {
  let clean = version.startsWith('v') ? version.slice(1) : version;
  const plusIndex = clean.indexOf('+');
  if (plusIndex !== -1) {
    clean = clean.slice(0, plusIndex);
  }
  const hyphenIndex = clean.indexOf('-');
  return hyphenIndex === -1 ? clean : clean.slice(0, hyphenIndex);
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

  // Compare pre-release identifiers per semver:
  //   X.Y.Z-0  <  X.Y.Z-ext.1  <  X.Y.Z-ext.2  <  X.Y.Z
  return comparePreRelease(a.preRelease, b.preRelease);
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
