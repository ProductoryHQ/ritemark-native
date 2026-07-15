/**
 * Tests for semver-correct version ordering, focused on the #142 fix: the
 * built-in "floor" version X.Y.Z-0 must sort strictly BELOW an over-the-air
 * patch X.Y.Z-ext.N, which must sort below the plain release X.Y.Z — exactly
 * matching VS Code's own standard-semver extension scanner.
 *
 * Run: npx tsx src/update/versionComparison.test.ts
 */

import * as assert from 'assert';
import {
  compareVersions,
  isNewerVersion,
  getBaseVersion,
  determineUpdateType,
  isValidUpgrade,
  shouldNotifyUpdate
} from './versionComparison';

function run() {
  // ── Core #142 ordering: floor < ext.N < release ──────────────────────────
  {
    assert.ok(compareVersions('1.8.2-0', '1.8.2-ext.1') < 0, 'floor -0 must sort below -ext.1');
    assert.ok(compareVersions('1.8.2-ext.1', '1.8.2-0') > 0, 'symmetry: -ext.1 above floor');
    assert.ok(compareVersions('1.8.2-0', '1.8.2') < 0, 'floor -0 must sort below the plain release');
    assert.ok(compareVersions('1.8.2-ext.1', '1.8.2') < 0, '-ext.1 (pre-release) sorts below the plain release');
    assert.ok(compareVersions('1.8.2-ext.2', '1.8.2-ext.1') > 0, '-ext.2 above -ext.1');
    assert.ok(compareVersions('1.8.2-ext.10', '1.8.2-ext.9') > 0, '-ext.N compares numerically, not lexically');
    console.log('✓ Test 1: floor -0 < ext.N < release ordering (the #142 root-cause guarantee)');
  }

  // ── The exact live-test scenario from #142 ───────────────────────────────
  {
    // Bundled built-in is floored to 1.8.2-0; the OTA patch is 1.8.2-ext.1.
    // VS Code must prefer ext.1, i.e. ext.1 must be the greater version.
    assert.ok(isNewerVersion('1.8.2-ext.1', '1.8.2-0'), 'the ext patch must outrank the bundled floor so VS Code loads it');
    assert.strictEqual(determineUpdateType('1.8.2-0', '1.8.2-ext.1'), 'extension', 'floor→ext must be an extension-tier update');
    assert.ok(isValidUpgrade('1.8.2-0', '1.8.2-ext.1'), 'floor→ext must be a valid (non-downgrade) upgrade');
    console.log('✓ Test 2: bundled floor 1.8.2-0 correctly yields to OTA patch 1.8.2-ext.1');
  }

  // ── Base-version extraction across all forms ─────────────────────────────
  {
    assert.strictEqual(getBaseVersion('1.8.2'), '1.8.2', 'plain');
    assert.strictEqual(getBaseVersion('1.8.2-0'), '1.8.2', 'floor');
    assert.strictEqual(getBaseVersion('1.8.2-ext.5'), '1.8.2', 'ext');
    assert.strictEqual(getBaseVersion('v1.8.2-ext.5'), '1.8.2', 'v-prefixed');
    assert.strictEqual(getBaseVersion('1.8.2+build.7'), '1.8.2', 'build metadata stripped');
    console.log('✓ Test 3: getBaseVersion strips every suffix form to the clean base');
  }

  // ── Cross-base ordering: next full release outranks any prior ext patch ───
  {
    assert.ok(compareVersions('1.8.3-0', '1.8.2-ext.9') > 0, 'next release floor outranks any prior-base ext patch');
    assert.ok(compareVersions('1.9.0', '1.8.2-ext.1') > 0, 'higher minor outranks prior ext patch');
    assert.strictEqual(determineUpdateType('1.8.2-ext.1', '1.8.3-ext.1'), 'full', 'different base = full update');
    assert.strictEqual(determineUpdateType('1.8.2-ext.1', '1.8.2-ext.1'), 'none', 'same version = no update');
    console.log('✓ Test 4: cross-base ordering and update-type classification');
  }

  // ── Notification gating unaffected by the floor ──────────────────────────
  {
    // The floor is only ever a CURRENT version, never a feed target. A feed
    // offering ext.1 while current is the floor should notify.
    assert.ok(shouldNotifyUpdate('1.8.2-0', '1.8.2-ext.1'), 'notify when a patch is available over the floor');
    assert.ok(!shouldNotifyUpdate('1.8.2-ext.1', '1.8.2-0'), 'never notify about "downgrading" to the floor');
    assert.ok(!shouldNotifyUpdate('1.8.2', '1.8.2-beta.1'), 'never notify about a -beta pre-release');
    console.log('✓ Test 5: update notifications gate correctly around the floor');
  }

  console.log('\nAll 5 tests passed!');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
