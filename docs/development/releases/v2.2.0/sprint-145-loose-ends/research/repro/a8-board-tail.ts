/**
 * Sprint 145 A8 (R3, S18; R2's hang question): the Task board store's share of a move, and whether a read
 * that hangs holds a move of another card.
 *
 * Run from extensions/ritemark: npx tsx ../../docs/development/releases/v2.2.0/sprint-145-loose-ends/research/repro/a8-board-tail.ts
 *
 * Builds a board of 40 cards (10 with an attached file) in a temp folder through the real BoardStore, then
 * times, on the real disk and with every read delayed by 30 ms (a slow drive):
 * - list() on a fresh store (the first read of the folder),
 * - a move (`mutate` to another stage with a new rank, as the controller's move does), and list() after it.
 * Then the tail: one card's read hangs for 3 s inside invalidate() (Try again on a stuck file, or the watcher),
 * and a move of another card starts at the same moment.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BoardStore, nodeBoardStoreFileSystem, type BoardStoreFileSystem } from '../../../../../../../extensions/ritemark/src/taskBoard/BoardStore';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const ms = (start: bigint) => Number(process.hrtime.bigint() - start) / 1e6;

function fileSystem(overrides: Partial<BoardStoreFileSystem> = {}): BoardStoreFileSystem {
  return { ...nodeBoardStoreFileSystem, async trash(file) { fs.rmSync(file); }, ...overrides };
}

async function build(folder: string): Promise<void> {
  const store = new BoardStore(folder, { fileSystem: fileSystem() });
  const stages = ['todo', 'doing', 'done', 'idea'] as const;
  for (let i = 0; i < 40; i++) {
    await store.create({
      title: `Card ${String(i + 1).padStart(2, '0')}`,
      stage: stages[i % 4],
      by: 'you',
      description: `The description of card ${i + 1}.\n\nA second paragraph.`,
      ...(i % 4 === 0 ? { files: [`notes/file-${i}.md`] } : {}),
    });
  }
}

async function timeMove(label: string, folder: string, overrides: Partial<BoardStoreFileSystem>): Promise<Record<string, number | string>> {
  const store = new BoardStore(folder, { fileSystem: fileSystem(overrides) });
  let start = process.hrtime.bigint();
  const entries = await store.list();
  const firstList = ms(start);
  const card = entries.flatMap(entry => (entry.kind === 'card' && entry.card.stage === 'todo' ? [entry.card] : []))[0];
  start = process.hrtime.bigint();
  await store.mutate(card.id, { by: 'you', what: 'Moved to Doing' }, current => ({ ...current, stage: 'doing', rank: 'a0' }));
  const move = ms(start);
  start = process.hrtime.bigint();
  await store.list();
  const listAfter = ms(start);
  return { label, cards: entries.length, firstListMs: Math.round(firstList), moveMs: Math.round(move), listAfterMoveMs: Math.round(listAfter) };
}

async function main(): Promise<void> {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-a8-'));
  try {
    await build(folder);
    const results: Array<Record<string, number | string>> = [];
    results.push(await timeMove('real disk', folder, {}));
    results.push(await timeMove('every read +30 ms', folder, {
      async readFile(file) { await sleep(30); return nodeBoardStoreFileSystem.readFile(file); },
    }));

    // The tail: a read that hangs for 3 s inside invalidate(), and a move of another card at the same moment.
    let hang = false;
    const stuckName = fs.readdirSync(path.join(folder, '.ritemark', 'tasks')).sort()[0];
    const store = new BoardStore(folder, {
      fileSystem: fileSystem({
        async readFile(file) {
          if (hang && path.basename(file) === stuckName) await sleep(3000);
          return nodeBoardStoreFileSystem.readFile(file);
        },
      }),
    });
    const entries = await store.list();
    const other = entries.flatMap(entry => (entry.kind === 'card' && path.basename(entry.fileName) !== stuckName ? [entry.card] : []))[0];
    hang = true;
    const start = process.hrtime.bigint();
    const retry = store.invalidate(stuckName).then(() => ms(start));
    const move = store.mutate(other.id, { by: 'you', what: 'Moved' }, current => ({ ...current, stage: 'done', rank: 'a0' })).then(() => ms(start));
    const [retryMs, moveMs] = await Promise.all([retry, move]);
    results.push({ label: 'a stuck read (3 s) in invalidate(), then a move of another card', retryMs: Math.round(retryMs), moveOfAnotherCardMs: Math.round(moveMs) });
    console.log(JSON.stringify(results, null, 1));
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

void main();
