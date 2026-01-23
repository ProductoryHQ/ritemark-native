/**
 * Feature Gate - Runtime Feature Flag Evaluation
 *
 * This module provides the core isEnabled() function that determines
 * whether a feature should be active at runtime.
 */

import * as vscode from 'vscode';
import { FLAGS, type FlagId } from './flags';
import { getCurrentPlatform } from '../utils/platform';

/**
 * Check if a feature flag is enabled
 *
 * Evaluation order:
 * 1. Flag exists? → No: false (+ warning)
 * 2. Status is 'disabled'? → Yes: false
 * 3. Status is 'premium'? → Yes: false (future: check license)
 * 4. Platform supported? → No: false
 * 5. Status is 'stable'? → Yes: true
 * 6. Status is 'experimental'? → Check user setting
 *
 * @param flagId - The feature flag ID to check
 * @returns true if the feature should be enabled, false otherwise
 */
export function isEnabled(flagId: FlagId): boolean {
  const flag = FLAGS[flagId];

  // 1. Unknown flag
  if (!flag) {
    console.warn(`[RiteMark] Unknown feature flag: ${flagId}`);
    return false;
  }

  // 2. Explicitly disabled
  if (flag.status === 'disabled') {
    return false;
  }

  // 3. Premium (future: check license, for now always false)
  if (flag.status === 'premium') {
    return false;
  }

  // 4. Platform check
  const currentPlatform = getCurrentPlatform();
  if (!flag.platforms.includes(currentPlatform)) {
    return false;
  }

  // 5. Stable features always enabled
  if (flag.status === 'stable') {
    return true;
  }

  // 6. Experimental features check user setting
  if (flag.status === 'experimental') {
    const config = vscode.workspace.getConfiguration('ritemark.features');
    return config.get<boolean>(flagId, false); // Default OFF for experimental
  }

  // Should never reach here, but default to false for safety
  return false;
}
