/**
 * Tests for RuntimeRegistry.
 *
 * Run: npx tsx src/runtime/RuntimeRegistry.test.ts
 */

import * as assert from 'assert';
import type { AgentId } from '../agent/types';
import type { AgentRuntime, RuntimeSessionConfig, RuntimeStatus, RuntimeTurnConfig } from './AgentRuntime';
import { RuntimeRegistry } from './RuntimeRegistry';

function makeRuntime(id: AgentId, onDispose?: () => void): AgentRuntime {
  return {
    id,
    start: async (_config: RuntimeSessionConfig) => {},
    prompt: async (_turn: RuntimeTurnConfig) => {},
    cancel: async () => {},
    respondToApproval: (_requestId: string, _approved: boolean, _alwaysAllow: boolean) => {},
    getStatus: async (): Promise<RuntimeStatus> => ({
      ready: true,
      authState: 'authenticated',
      diagnostics: [],
    }),
    dispose: () => {
      onDispose?.();
    },
  };
}

// Test 1: get() returns the correct runtime
{
  const claude = makeRuntime('claude-code');
  const codex = makeRuntime('codex');
  const registry = new RuntimeRegistry(new Map([
    ['claude-code', claude],
    ['codex', codex],
  ]));

  assert.strictEqual(registry.get('claude-code'), claude, 'get("claude-code") must return claude runtime');
  assert.strictEqual(registry.get('codex'), codex, 'get("codex") must return codex runtime');
  console.log('✓ Test 1: get() returns correct runtime');
}

// Test 2: get() throws on unknown id
{
  const registry = new RuntimeRegistry(new Map([
    ['claude-code', makeRuntime('claude-code')],
  ]));

  assert.throws(
    () => registry.get('opencode' as AgentId),
    /Unknown agent runtime: opencode/,
    'get() must throw for unregistered id',
  );
  console.log('✓ Test 2: get() throws on unknown id');
}

// Test 3: dispose() calls dispose() on all runtimes
{
  const disposed: AgentId[] = [];
  const registry = new RuntimeRegistry(new Map([
    ['claude-code', makeRuntime('claude-code', () => disposed.push('claude-code'))],
    ['codex', makeRuntime('codex', () => disposed.push('codex'))],
    ['opencode', makeRuntime('opencode', () => disposed.push('opencode'))],
  ]));

  registry.dispose();

  assert.strictEqual(disposed.length, 3, 'dispose() must call dispose on all 3 runtimes');
  assert.ok(disposed.includes('claude-code'));
  assert.ok(disposed.includes('codex'));
  assert.ok(disposed.includes('opencode'));
  console.log('✓ Test 3: dispose() calls dispose() on all runtimes');
}

// Test 4: getAll() returns all runtimes
{
  const claude = makeRuntime('claude-code');
  const codex = makeRuntime('codex');
  const opencode = makeRuntime('opencode');
  const registry = new RuntimeRegistry(new Map([
    ['claude-code', claude],
    ['codex', codex],
    ['opencode', opencode],
  ]));

  const all = registry.getAll();
  assert.strictEqual(all.length, 3, 'getAll() must return 3 runtimes');
  assert.ok(all.includes(claude));
  assert.ok(all.includes(codex));
  assert.ok(all.includes(opencode));
  console.log('✓ Test 4: getAll() returns all runtimes');
}

console.log('\nAll 4 tests passed!');
