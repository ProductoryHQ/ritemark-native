import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOCUMENT_DELIVERY_FAILURE_MS,
  DocumentDeliverySchedule,
  type DocumentDeliveryClock,
} from './delivery';

class FakeClock implements DocumentDeliveryClock {
  private now = 0;
  private nextId = 0;
  private readonly timers = new Map<number, { at: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = ++this.nextId;
    this.timers.set(id, { at: this.now + delayMs, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  advanceTo(next: number): void {
    while (true) {
      const ready = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= next)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
      if (!ready) break;
      this.timers.delete(ready[0]);
      this.now = ready[1].at;
      ready[1].callback();
    }
    this.now = next;
  }
}

const identity = { revision: 7, payloadHash: 'a'.repeat(64) };

test('delivery retries at 750 ms and 2.5 s, then exhausts at 5 s', () => {
  const clock = new FakeClock();
  const events: string[] = [];
  const schedule = new DocumentDeliverySchedule(
    identity,
    attempt => events.push(`retry:${attempt}`),
    () => events.push('exhausted'),
    clock,
  );
  schedule.start();

  clock.advanceTo(749);
  assert.deepEqual(events, []);
  clock.advanceTo(750);
  assert.deepEqual(events, ['retry:2']);
  clock.advanceTo(2500);
  assert.deepEqual(events, ['retry:2', 'retry:3']);
  clock.advanceTo(DOCUMENT_DELIVERY_FAILURE_MS);
  assert.deepEqual(events, ['retry:2', 'retry:3', 'exhausted']);
});

test('only an exact receipt cancels the delivery budget', () => {
  const clock = new FakeClock();
  const events: string[] = [];
  const schedule = new DocumentDeliverySchedule(
    identity,
    attempt => events.push(`retry:${attempt}`),
    () => events.push('exhausted'),
    clock,
  );
  schedule.start();

  assert.equal(schedule.acknowledge({ ...identity, revision: 6 }), false);
  assert.equal(schedule.acknowledge({ ...identity, payloadHash: 'b'.repeat(64) }), false);
  clock.advanceTo(750);
  assert.deepEqual(events, ['retry:2']);

  assert.equal(schedule.acknowledge(identity), true);
  clock.advanceTo(DOCUMENT_DELIVERY_FAILURE_MS);
  assert.deepEqual(events, ['retry:2']);
});

test('a superseded delivery is inert', () => {
  const clock = new FakeClock();
  const events: string[] = [];
  const schedule = new DocumentDeliverySchedule(
    identity,
    attempt => events.push(`retry:${attempt}`),
    () => events.push('exhausted'),
    clock,
  );
  schedule.start();
  schedule.cancel();
  clock.advanceTo(DOCUMENT_DELIVERY_FAILURE_MS);
  assert.deepEqual(events, []);
});
