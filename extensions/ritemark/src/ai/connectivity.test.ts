/**
 * Tests for connectivity hysteresis/multi-endpoint logic (#193).
 *
 * Run: npx tsx src/ai/connectivity.test.ts
 */

// ── Minimal vscode stub ──────────────────────────────────────────────────────
// connectivity.ts imports vscode for EventEmitter/StatusBarItem/ThemeColor.
// Pre-populate the require cache before any other imports (same pattern as
// BrowserToolsInjector.test.ts).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module') as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean) => string;
  _cache: Record<string, unknown>;
};

class FakeEventEmitter<T> {
  event = () => ({ dispose: () => undefined });
  fire(_value: T): void {}
  dispose(): void {}
}

const vscodeMod = {
  EventEmitter: FakeEventEmitter,
  ThemeColor: class {
    constructor(public id: string) {}
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  window: {
    createStatusBarItem: () => ({
      show: () => undefined,
      dispose: () => undefined,
    }),
  },
};

const _originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request: string, ...rest: [unknown, boolean]) {
  if (request === 'vscode') { return '__vscode_stub__'; }
  return _originalResolve(request, ...rest);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).cache['__vscode_stub__'] = {
  id: '__vscode_stub__',
  filename: '__vscode_stub__',
  loaded: true,
  children: [],
  paths: [],
  exports: vscodeMod,
};

// ── Now safe to import vscode-dependent modules ──────────────────────────────
// Runtime require() (not a static import) so tsx's ESM-aware resolver doesn't
// hoist the import above the stub registration.
import * as assert from 'assert';
const { nextOnlineState, combineProbeResults } = require('./connectivity') as typeof import('./connectivity');

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('connectivity');

// ── Hysteresis: single failure does not flip online -> offline ─────────────
test('one failed probe while online stays online (below threshold)', () => {
  const result = nextOnlineState(true, false, 0);
  assert.strictEqual(result.isOnline, true);
  assert.strictEqual(result.consecutiveFailures, 1);
});

test('two consecutive failed probes while online flips to offline', () => {
  const first = nextOnlineState(true, false, 0);
  const second = nextOnlineState(true, false, first.consecutiveFailures);
  assert.strictEqual(second.isOnline, false);
  assert.strictEqual(second.consecutiveFailures, 2);
});

test('a successful probe immediately returns to online and resets the counter', () => {
  const offline = nextOnlineState(true, false, 1);
  const recovered = nextOnlineState(offline.isOnline, true, offline.consecutiveFailures);
  assert.strictEqual(recovered.isOnline, true);
  assert.strictEqual(recovered.consecutiveFailures, 0);
});

test('already-offline state requires only a fresh success to recover, not the full threshold', () => {
  const result = nextOnlineState(false, true, 5);
  assert.strictEqual(result.isOnline, true);
  assert.strictEqual(result.consecutiveFailures, 0);
});

test('custom threshold is honored', () => {
  const afterOne = nextOnlineState(true, false, 0, 3);
  assert.strictEqual(afterOne.isOnline, true);
  const afterTwo = nextOnlineState(true, false, afterOne.consecutiveFailures, 3);
  assert.strictEqual(afterTwo.isOnline, true, 'still under a threshold of 3');
  const afterThree = nextOnlineState(true, false, afterTwo.consecutiveFailures, 3);
  assert.strictEqual(afterThree.isOnline, false);
});

// ── Multi-endpoint aggregation: online if any endpoint responds ────────────
test('combineProbeResults is true if any endpoint responded', () => {
  assert.strictEqual(combineProbeResults([false, true]), true);
  assert.strictEqual(combineProbeResults([true, false]), true);
});

test('combineProbeResults is false only if every endpoint failed', () => {
  assert.strictEqual(combineProbeResults([false, false]), false);
});

test('combineProbeResults handles an empty probe list as offline', () => {
  assert.strictEqual(combineProbeResults([]), false);
});

console.log(`\n${passed} passed`);
