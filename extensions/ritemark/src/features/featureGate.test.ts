/**
 * Basic unit tests for feature gate logic.
 * Tests the pure evaluation algorithm without vscode dependency.
 * Run: npx tsx src/features/featureGate.test.ts
 */

import * as assert from 'assert';

interface FeatureFlag {
  id: string;
  label: string;
  description: string;
  status: 'stable' | 'experimental' | 'disabled' | 'premium';
  platforms: ('darwin' | 'win32' | 'linux')[];
}

type Platform = 'darwin' | 'win32' | 'linux';

function isEnabledPure(
  flagId: string,
  flags: Record<string, FeatureFlag>,
  currentPlatform: Platform,
  userSettings: Record<string, boolean>
): boolean {
  const flag = flags[flagId];
  if (!flag) return false;
  if (flag.status === 'disabled') return false;
  if (flag.status === 'premium') return false;
  if (!flag.platforms.includes(currentPlatform)) return false;
  if (flag.status === 'stable') return true;
  if (flag.status === 'experimental') {
    return userSettings[flagId] ?? false;
  }
  return false;
}

// Test flags
const TEST_FLAGS: Record<string, FeatureFlag> = {
  'voice-dictation': {
    id: 'voice-dictation',
    label: 'Voice Dictation',
    description: 'Test',
    status: 'experimental',
    platforms: ['darwin'],
  },
  'markdown-export': {
    id: 'markdown-export',
    label: 'Export',
    description: 'Test',
    status: 'stable',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'killed-feature': {
    id: 'killed-feature',
    label: 'Killed',
    description: 'Test',
    status: 'disabled',
    platforms: ['darwin', 'win32', 'linux'],
  },
  'paid-feature': {
    id: 'paid-feature',
    label: 'Paid',
    description: 'Test',
    status: 'premium',
    platforms: ['darwin', 'win32', 'linux'],
  },
};

// --- Tests ---

// Unknown flag → false
assert.strictEqual(isEnabledPure('nonexistent', TEST_FLAGS, 'darwin', {}), false);

// Disabled flag → false (regardless of platform/settings)
assert.strictEqual(isEnabledPure('killed-feature', TEST_FLAGS, 'darwin', {}), false);
assert.strictEqual(isEnabledPure('killed-feature', TEST_FLAGS, 'darwin', { 'killed-feature': true }), false);

// Premium flag → false
assert.strictEqual(isEnabledPure('paid-feature', TEST_FLAGS, 'darwin', {}), false);
assert.strictEqual(isEnabledPure('paid-feature', TEST_FLAGS, 'darwin', { 'paid-feature': true }), false);

// Stable flag → true on supported platform
assert.strictEqual(isEnabledPure('markdown-export', TEST_FLAGS, 'darwin', {}), true);
assert.strictEqual(isEnabledPure('markdown-export', TEST_FLAGS, 'win32', {}), true);
assert.strictEqual(isEnabledPure('markdown-export', TEST_FLAGS, 'linux', {}), true);

// Experimental flag → false by default
assert.strictEqual(isEnabledPure('voice-dictation', TEST_FLAGS, 'darwin', {}), false);

// Experimental flag → true when user enables
assert.strictEqual(isEnabledPure('voice-dictation', TEST_FLAGS, 'darwin', { 'voice-dictation': true }), true);

// Platform filtering → darwin-only feature on wrong platform
assert.strictEqual(isEnabledPure('voice-dictation', TEST_FLAGS, 'win32', { 'voice-dictation': true }), false);
assert.strictEqual(isEnabledPure('voice-dictation', TEST_FLAGS, 'linux', { 'voice-dictation': true }), false);

// Platform filtering takes priority over user setting
assert.strictEqual(isEnabledPure('voice-dictation', TEST_FLAGS, 'win32', { 'voice-dictation': true }), false);

console.log('All feature gate tests passed.');
