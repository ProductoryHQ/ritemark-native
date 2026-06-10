/**
 * Unit tests for DaemonResultStore (record / cap / supersede / blocked-count /
 * persistence). Run: npx tsx src/daemon/DaemonResultStore.test.ts
 *
 * A FakeMemento stands in for vscode.ExtensionContext.workspaceState — the store
 * only uses get(key, default) and update(key, value), so an in-memory Map mirror
 * is enough to exercise every code path, including a simulated app restart (a new
 * store instance reading the same backing Memento).
 */
import * as assert from 'assert';
import { DaemonResultStore } from './DaemonResultStore';
import type { TaskResult, TaskOutcome } from './ScheduledTask';

class FakeMemento {
  private backing = new Map<string, unknown>();
  get(key: string, def?: unknown): unknown {
    return this.backing.has(key) ? this.backing.get(key) : def;
  }
  update(key: string, value: unknown): Promise<void> {
    this.backing.set(key, value);
    return Promise.resolve();
  }
  keys(): readonly string[] {
    return [...this.backing.keys()];
  }
}

function result(taskId: string, runId: string, outcome: TaskOutcome, extra: Partial<TaskResult> = {}): TaskResult {
  return {
    taskId,
    runId,
    outcome,
    startedAt: extra.startedAt ?? '2026-06-08T10:00:00.000Z',
    finishedAt: '2026-06-08T10:00:01.000Z',
    durationMs: 1000,
    ...extra,
  };
}

async function main() {
  // append + getAll: newest first
  {
    const mem = new FakeMemento();
    const store = new DaemonResultStore(mem as any);
    await store.append(result('a', 'r1', 'completed'));
    await store.append(result('a', 'r2', 'completed'));
    const history = await store.getAll('a');
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].runId, 'r2'); // most recent first
    assert.strictEqual(history[1].runId, 'r1');
    assert.deepStrictEqual(await store.getAll('missing'), []);
  }

  // cap at 10 per task — oldest entries fall off
  {
    const mem = new FakeMemento();
    const store = new DaemonResultStore(mem as any);
    for (let i = 0; i < 12; i++) {
      await store.append(result('a', `r${i}`, 'completed'));
    }
    const history = await store.getAll('a');
    assert.strictEqual(history.length, 10);
    assert.strictEqual(history[0].runId, 'r11');  // newest kept
    assert.strictEqual(history[9].runId, 'r2');   // r0, r1 dropped
  }

  // getAllRuns: cross-task, sorted by startedAt desc, limited
  {
    const mem = new FakeMemento();
    const store = new DaemonResultStore(mem as any);
    await store.append(result('a', 'r1', 'completed', { startedAt: '2026-06-08T08:00:00.000Z' }));
    await store.append(result('b', 'r2', 'completed', { startedAt: '2026-06-08T09:00:00.000Z' }));
    await store.append(result('a', 'r3', 'completed', { startedAt: '2026-06-08T07:00:00.000Z' }));
    const runs = store.getAllRuns();
    assert.strictEqual(runs.length, 3);
    assert.strictEqual(runs[0].runId, 'r2'); // 09:00 newest
    assert.strictEqual(runs[2].runId, 'r3'); // 07:00 oldest
    assert.strictEqual(store.getAllRuns(1).length, 1);
  }

  // getBlockedResult: matches blocked by runId, ignores non-blocked
  {
    const mem = new FakeMemento();
    const store = new DaemonResultStore(mem as any);
    await store.append(result('a', 'rb', 'blocked', { blockedAction: { kind: 'file-write', target: 'notes.md' } }));
    await store.append(result('a', 'rc', 'completed'));
    const blocked = await store.getBlockedResult('a', 'rb');
    assert.ok(blocked);
    assert.strictEqual(blocked!.runId, 'rb');
    assert.strictEqual(await store.getBlockedResult('a', 'rc'), undefined); // completed, not blocked
    assert.strictEqual(await store.getBlockedResult('a', 'nope'), undefined);
  }

  // supersede + countUnresolvedBlocked
  {
    const mem = new FakeMemento();
    const store = new DaemonResultStore(mem as any);
    await store.append(result('a', 'rb1', 'blocked'));
    await store.append(result('b', 'rb2', 'blocked'));
    await store.append(result('a', 'rc', 'completed'));
    assert.strictEqual(await store.countUnresolvedBlocked(), 2);

    await store.supersede('a', 'rb1', 'rNew');
    const history = await store.getAll('a');
    const superseded = history.find(r => r.runId === 'rb1');
    assert.strictEqual(superseded!.supersededBy, 'rNew');
    assert.strictEqual(await store.countUnresolvedBlocked(), 1); // rb2 still open
  }

  // clearAll empties everything
  {
    const mem = new FakeMemento();
    const store = new DaemonResultStore(mem as any);
    await store.append(result('a', 'r1', 'completed'));
    await store.clearAll();
    assert.deepStrictEqual(await store.getAll('a'), []);
    assert.strictEqual(store.getAllRuns().length, 0);
  }

  // persistence across a simulated restart — a fresh store over the same Memento
  {
    const mem = new FakeMemento();
    const store1 = new DaemonResultStore(mem as any);
    await store1.append(result('a', 'r1', 'completed'));
    const store2 = new DaemonResultStore(mem as any);
    const history = await store2.getAll('a');
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].runId, 'r1');
  }

  console.log('✅ All DaemonResultStore tests passed!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
