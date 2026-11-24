import { strict as assert } from 'node:assert';
import { mock } from 'node:test';
import { DeckLive } from './deckLive';
import type { LiveResult } from '../publish/liveUpdate';

async function main() {
  const states: string[] = [];
  const preference = { on: true as const, id: 'test' };
  const live = new DeckLive(page => states.push(live.state(page, preference).state));
  const sent: string[] = [];
  let completeFirst!: () => void;
  let startFirst!: () => void;
  const firstStarted = new Promise<void>(resolve => { startFirst = resolve; });
  const firstFinishes = new Promise<void>(resolve => { completeFirst = resolve; });
  assert.equal(live.state('page', preference).state, 'live');
  assert.deepEqual(sent, [], 'projecting an open page never runs a save');

  let saved = 'A';
  const update = async (_resume: boolean, sending: () => void): Promise<LiveResult> => {
    sending();
    const body = saved;
    sent.push(body);
    if (body === 'A') {
      startFirst();
      await firstFinishes;
    }
    return { kind: 'updated', pictures: [] };
  };
  const first = live.request('page', update);
  await firstStarted;
  saved = 'B';
  const second = live.request('page', update);
  saved = 'C';
  const latest = live.request('page', update);
  assert.deepEqual(sent, ['A'], 'nothing else starts while A is in flight');
  completeFirst();
  await Promise.all([first, second, latest]);
  assert.deepEqual(sent, ['A', 'C'], 'only the latest saved state follows A');
  assert.deepEqual(states.slice(states.indexOf('updating'), -1).every(state => state === 'updating'), true);
  assert.equal(states.at(-1), 'live');
  states.length = 0;
  await live.request('page', async () => ({ kind: 'unchanged' }));
  assert.equal(states.every(state => state === 'live'), true, 'a private edit never shows Updating');
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let connected = false;
    const retry = async (): Promise<LiveResult> => {
      if (!connected) return { kind: 'offline', detail: 'No connection.' };
      sent.push(saved);
      return { kind: 'updated', pictures: [] };
    };
    await live.request('offline-page', retry);
    assert.equal(live.state('offline-page', preference).state, 'offline');
    saved = 'D';
    await live.request('offline-page', retry);
    saved = 'E';
    connected = true;
    await live.request('offline-page', retry);
    mock.timers.tick(29_999);
    assert.deepEqual(sent, ['A', 'C'], 'saves do not retry an offline deployment before 30 seconds');
    mock.timers.tick(1);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(sent, ['A', 'C', 'E'], 'the first retry takes the latest save');

    let attempts = 0;
    const pause = { kind: 'page' as const, detail: 'The page file belongs to someone else.', at: 1 };
    const blocked = async (resume: boolean): Promise<LiveResult> => {
      attempts++;
      return resume ? { kind: 'updated', pictures: [] } : { kind: 'paused', pause };
    };
    await live.request('refused-page', blocked);
    mock.timers.tick(30_000);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(attempts, 1, 'a refused page is never retried by a timer');
    await live.request('refused-page', blocked, true);
    assert.equal(attempts, 2, 'Go on reruns the update');

    let busy = true;
    let busyAttempts = 0;
    await live.request('busy-page', async () => {
      busyAttempts++;
      return busy ? { kind: 'busy' } : { kind: 'unchanged' };
    });
    assert.equal(live.state('busy-page', preference).state, 'live');
    busy = false;
    mock.timers.tick(1_999);
    assert.equal(busyAttempts, 1);
    mock.timers.tick(1);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(busyAttempts, 2, 'a hold without a completion signal retries after two seconds');

    connected = false;
    await live.request('closed-page', retry);
    live.stop('closed-page');
    connected = true;
    mock.timers.tick(30_000);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(sent, ['A', 'C', 'E'], 'closing the window stops offline retries');
  } finally {
    mock.timers.reset();
  }
  live.dispose();
  console.log('deckLive: all passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
