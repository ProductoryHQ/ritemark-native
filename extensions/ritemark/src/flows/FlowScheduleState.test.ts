/**
 * Unit tests for scheduled flow runtime state persistence.
 * Run: npx tsx src/flows/FlowScheduleState.test.ts
 */

import * as assert from 'assert';
import {
  FlowScheduleState,
  type FlowScheduleRuntimeState,
} from './FlowScheduleState';

class FakeMemento {
  private readonly store = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T {
    return (this.store.has(key) ? this.store.get(key) : defaultValue) as T;
  }

  async update(key: string, value: unknown): Promise<void> {
    if (typeof value === 'undefined') {
      this.store.delete(key);
      return;
    }

    this.store.set(key, value);
  }
}

async function main(): Promise<void> {
  console.log('Testing flow schedule state...');

  const state = new FlowScheduleState(new FakeMemento() as never);
  const flowPath = '/workspace/.ritemark/flows/daily-summary.flow.json';

  const initial = await state.get(flowPath);
  assert.deepStrictEqual(initial, {
    lastRunAt: null,
    lastScheduledFor: null,
    lastStatus: 'idle',
    lastError: null,
  } satisfies FlowScheduleRuntimeState);
  console.log('  ✓ Default runtime state is returned when nothing is stored');

  await state.update(flowPath, {
    lastRunAt: '2026-03-29T09:00:00.000Z',
    lastScheduledFor: '2026-03-29T09:00:00.000Z',
    lastStatus: 'success',
  });

  const updated = await state.get(flowPath);
  assert.strictEqual(updated.lastStatus, 'success');
  assert.strictEqual(updated.lastRunAt, '2026-03-29T09:00:00.000Z');
  console.log('  ✓ Runtime state updates are persisted');

  await state.clear(flowPath);
  const cleared = await state.get(flowPath);
  assert.deepStrictEqual(cleared, initial);
  console.log('  ✓ Runtime state is cleared back to defaults');

  console.log('\n✅ All flow schedule state tests passed!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
