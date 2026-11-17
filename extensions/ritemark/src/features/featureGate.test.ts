/**
 * Basic unit tests for feature gate logic.
 * Tests the pure evaluation algorithm without vscode dependency.
 * Run: npx tsx src/features/featureGate.test.ts
 */

import * as assert from 'assert';
import { FLAGS } from './flags';
import { canEditWorkbook } from '../excel/cellEdit';
import * as fs from 'fs';
import * as path from 'path';

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

// Sprint 109 rollout: experimental (real runtime flag), but default-on in the
// extension manifest. After cutover, ConversationCutoverState owns monotonicity.
assert.strictEqual(FLAGS.durableAgentConversations.status, 'experimental');
const extensionManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
  contributes: { configuration: Array<{ properties?: Record<string, { default?: boolean }> }> };
};
const featureProperties = extensionManifest.contributes.configuration[2].properties as Record<string, { default?: boolean }>;
assert.strictEqual(featureProperties['ritemark.features.durableAgentConversations']?.default, true);
assert.strictEqual(FLAGS['composer-thinking-effort'].status, 'experimental');
assert.strictEqual(featureProperties['ritemark.features.composer-thinking-effort']?.default, true);
// Sprint 148 (#591): the search index's kill switch, on by default (HARD RULE #2).
assert.strictEqual(FLAGS['project-search'].status, 'experimental');
assert.strictEqual(featureProperties['ritemark.features.project-search']?.default, true);
// Sprint 157 (README decision 10): Decks, off by default on Jarmo's word, as an experimental flag.
assert.strictEqual(FLAGS.decks.status, 'experimental');
assert.strictEqual(featureProperties['ritemark.features.decks']?.default, false);
// Sprint 158 (#711): Excel editing's kill switch, on everywhere by default (HARD RULE #2). Off, an .xlsx is read-only
// and the host refuses its edits; an .xls is read-only either way.
for (const platform of ['darwin', 'win32', 'linux'] as Platform[]) {
  assert.strictEqual(isEnabledPure('excel-editing', FLAGS as Record<string, FeatureFlag>, platform, {}), true, `excel-editing on ${platform}`);
}
assert.strictEqual(canEditWorkbook('/w/Budget.XLSX', true), true, 'flag on: an .xlsx is editable');
assert.strictEqual(canEditWorkbook('/w/Budget.xlsx', false), false, 'flag off: an .xlsx is read-only');
assert.strictEqual(canEditWorkbook('/w/Old.xls', true), false, 'an .xls is read-only with the flag on');
assert.strictEqual(canEditWorkbook('/w/Old.xls', false), false);
assert.strictEqual(isEnabledPure('excel-editing', { ...FLAGS, 'excel-editing': { ...FLAGS['excel-editing'], status: 'disabled' } } as Record<string, FeatureFlag>, 'darwin', {}), false, 'the switch turns it off');
// Experience 48: the table handles are ON everywhere, and the kill switch turns them off.
for (const platform of ['darwin', 'win32', 'linux'] as const) {
  assert.strictEqual(isEnabledPure('table-handles', FLAGS as Record<string, FeatureFlag>, platform, {}), true, `table-handles on ${platform}`);
}
assert.strictEqual(isEnabledPure('table-handles', { ...FLAGS, 'table-handles': { ...FLAGS['table-handles'], status: 'disabled' } } as Record<string, FeatureFlag>, 'darwin', {}), false, 'the table switch turns them off');

console.log('All feature gate tests passed.');
