import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import type { Event } from 'vscode';
import type { LiveSaveReceipt } from '../decks/deckLive';
import type { LiveResult } from '../publish/liveUpdate';
import { trackLiveDeckTurn } from './liveDeckTurn';

const file = resolve('Harbour.rtms');
const pagePath = resolve('Harbour.html');

function signal<T>() {
  const listeners = new Set<(value: T) => void>();
  const event: Event<T> = listener => {
    listeners.add(listener);
    return { dispose: () => listeners.delete(listener) };
  };
  return { event, emit: (value: T) => listeners.forEach(listener => listener(value)), listeners };
}

function harness() {
  const saved = signal<LiveSaveReceipt>();
  const changed = signal<{ pagePath: string; receipt?: LiveSaveReceipt; result: LiveResult }>();
  return {
    start: (timeout = 1000) => trackLiveDeckTurn({
      onDidSaveLive: saved.event,
      onDidUpdateLive: changed.event,
    }, timeout),
    save: () => {
      let settle!: () => void;
      const settled = new Promise<void>(resolve => { settle = resolve; });
      const receipt = { file, settled, settle };
      saved.emit(receipt);
      return {
        finish(result: LiveResult) {
          if (result.kind === 'updated' || result.kind === 'paused') changed.emit({ pagePath, result, receipt });
          settle();
        },
      };
    },
    manualUpdate: () => changed.emit({ pagePath, result: { kind: 'updated', pictures: [] } }),
    listenerCount: () => saved.listeners.size + changed.listeners.size,
  };
}

test('waits for a live deck save made during the turn and writes a host step', async () => {
  const deck = harness();
  const turn = deck.start();
  const save = deck.save();
  const steps = turn.finish([file]);
  const later = deck.save();
  later.finish({ kind: 'updated', pictures: [] });
  save.finish({ kind: 'updated', pictures: [] });
  assert.deepEqual((await steps)?.map(({ type, message }) => ({ type, message })), [
    { type: 'live_deck_updated', message: 'Updated the page' },
  ]);
  assert.equal(deck.listenerCount(), 0);
});

test('writes the pause detail and does not credit a later save during an existing pause', async () => {
  const deck = harness();
  const turn = deck.start();
  deck.save().finish({
    kind: 'paused',
    pause: { at: 1, kind: 'key', slide: 6, detail: "Slide 6's text has what looks like a key." },
  });
  assert.equal((await turn.finish([file]))?.[0]?.message, 'The page waits: slide 6 has what looks like a key');
  const later = deck.start();
  deck.save().finish({ kind: 'stopped' });
  assert.deepEqual(await later.finish([file]), []);
});

test('minutes-only edits, unrelated saves and manual updates produce no step', async () => {
  const deck = harness();
  const earlierSave = deck.save();
  const minutesOnly = deck.start();
  earlierSave.finish({ kind: 'updated', pictures: [] });
  deck.manualUpdate();
  deck.save().finish({ kind: 'unchanged' });
  assert.deepEqual(await minutesOnly.finish([file]), []);
  const noDeck = deck.start();
  deck.save().finish({ kind: 'updated', pictures: [] });
  assert.equal(noDeck.finish([resolve('Agenda.md')]), undefined);
  assert.equal(deck.listenerCount(), 0);
});

test('times out without a step and ignores a late live result', async () => {
  const deck = harness();
  const turn = deck.start(5);
  const save = deck.save();
  assert.deepEqual(await turn.finish([file]), []);
  assert.equal(deck.listenerCount(), 0);
  save.finish({ kind: 'updated', pictures: [] });
});
