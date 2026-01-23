/**
 * Platform detection utilities for feature flags
 */

export type Platform = 'darwin' | 'win32' | 'linux';

/**
 * Get current platform with fallback
 * Returns normalized platform identifier for feature flag checks
 */
export function getCurrentPlatform(): Platform {
  const platform = process.platform;

  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') {
    return platform;
  }

  // Unknown platform - fallback to linux and warn
  console.warn(`[RiteMark] Unknown platform: ${platform}, falling back to 'linux'`);
  return 'linux';
}
