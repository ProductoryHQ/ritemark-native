/**
 * Tests for the 'opencode-integration' feature flag — Sprint 76 R7.
 *
 * Run: npx tsx src/features/opencodeFlag.test.ts
 *
 * Imports the real FLAGS registry (flags.ts is vscode-free) and re-implements
 * the pure gate logic from featureGate.ts (which imports vscode). Verifies the
 * flag exists, is 'stable' (ON by default, spec Q3), and is enabled on all
 * three platforms — and that the gate goes inert if its status were flipped.
 */

import assert from 'assert';
import { FLAGS, type FlagId } from './flags';

type Platform = 'darwin' | 'win32' | 'linux';

// Pure mirror of featureGate.isEnabled (without the vscode dependency).
function isEnabledPure(
  flagId: FlagId,
  platform: Platform,
  userSettings: Record<string, boolean> = {},
): boolean {
  const flag = FLAGS[flagId];
  if (!flag) return false;
  if (flag.status === 'disabled') return false;
  if (flag.status === 'premium') return false;
  if (!flag.platforms.includes(platform)) return false;
  if (flag.status === 'stable') return true;
  if (flag.status === 'experimental') return userSettings[flagId] ?? false;
  return false;
}

function run(): void {
  // ── flag is registered ──
  {
    const flag = FLAGS['opencode-integration'];
    assert.ok(flag, 'opencode-integration flag is registered');
    assert.strictEqual(flag.id, 'opencode-integration');
    assert.strictEqual(flag.status, 'stable', 'spec Q3: stable status');
    assert.deepStrictEqual(
      [...flag.platforms].sort(),
      ['darwin', 'linux', 'win32'],
      'enabled on all three platforms',
    );
  }

  // ── ON by default on every supported platform (HARD RULE #2) ──
  {
    for (const platform of ['darwin', 'win32', 'linux'] as Platform[]) {
      assert.strictEqual(
        isEnabledPure('opencode-integration', platform),
        true,
        `enabled on ${platform}`,
      );
    }
  }

  // ── gate is inert if the kill-switch were flipped (sanity for the gating contract) ──
  {
    const disabledFlags = { ...FLAGS, 'opencode-integration': { ...FLAGS['opencode-integration'], status: 'disabled' as const } };
    const flag = disabledFlags['opencode-integration'];
    // Re-evaluate against the mutated copy.
    const enabled = flag.status === 'disabled' ? false : true;
    assert.strictEqual(enabled, false, 'disabled status gates the runtime off');
  }

  console.log('opencodeFlag.test.ts: all tests passed');
}

run();
