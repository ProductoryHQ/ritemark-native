/**
 * Sprint 145 R3 (#597, S18): the host's share of a dropped card, step by step, through the real BoardController
 * and BoardStore (no VS Code). The dev-instance run (CDP) gives the whole drop; this gives the host's parts.
 *
 * Run from extensions/ritemark:
 *   npx tsx ../../docs/development/releases/v2.2.0/sprint-145-loose-ends/research/repro/r3-drop-timing.ts
 *
 * A board of 40 cards (10 with an attached file that exists) in a temp folder. For each file system it times
 * `controller.move()` (the board's drop: To do → Doing, at the end) and the refresh that follows
 * (`controller.snapshot()`, what every surface is sent), and splits both into the store's calls and the file checks.
 * File systems: the Mac's disk; every card read +30 ms (a slow drive); every file check (`stat`) +30 ms.
 * Then the tail: a re-read of another card file that hangs for 3 s (the watcher, or Try again) and a move started
 * at the same moment.
 */
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BoardController, type HandoffLedger } from '../../../../../../../extensions/ritemark/src/taskBoard/BoardController';
import { BoardStore, nodeBoardStoreFileSystem, type BoardStoreFileSystem } from '../../../../../../../extensions/ritemark/src/taskBoard/BoardStore';
import type { CardHandoffView } from '../../../../../../../extensions/ritemark/src/taskBoard/protocol';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const since = (start: bigint) => Number(process.hrtime.bigint() - start) / 1e6;
const round = (value: number) => Math.round(value * 10) / 10;

const ledger: HandoffLedger = {
  list: () => new Map<string, CardHandoffView>(),
  start: async () => ({ ok: true }),
  wait: async () => undefined,
  unwait: async () => undefined,
  stop: async () => undefined,
  openConversation: async () => false,
  canAttach: async () => true,
  onDidChange: () => () => undefined,
};

function fileSystem(overrides: Partial<BoardStoreFileSystem> = {}): BoardStoreFileSystem {
  return { ...nodeBoardStoreFileSystem, async trash(file) { fs.rmSync(file); }, ...overrides };
}

async function build(folder: string): Promise<void> {
  const store = new BoardStore(folder, { fileSystem: fileSystem() });
  fs.mkdirSync(path.join(folder, 'notes'), { recursive: true });
  const stages = ['todo', 'doing', 'done', 'idea'] as const;
  for (let i = 0; i < 40; i++) {
    const file = `notes/file-${i}.md`;
    if (i % 4 === 0) fs.writeFileSync(path.join(folder, file), `# Note ${i}\n`);
    await store.create({
      title: `Card ${String(i + 1).padStart(2, '0')}`,
      stage: stages[i % 4],
      by: 'you',
      description: `The description of card ${i + 1}.\n\nA second paragraph.`,
      ...(i % 4 === 0 ? { files: [file] } : {}),
    });
  }
}

/** A controller whose store calls and file checks are timed. */
function timedController(folder: string, options: { readDelay?: number; statDelay?: number; hang?: { name: string; ms: number; on: () => boolean } }) {
  const timing = { lists: [] as number[], mutate: 0, fileChecks: 0, fileCheckCalls: 0 };
  const store = new BoardStore(folder, {
    fileSystem: fileSystem({
      async readFile(file) {
        if (options.hang && options.hang.on() && path.basename(file) === options.hang.name) await sleep(options.hang.ms);
        if (options.readDelay) await sleep(options.readDelay);
        return nodeBoardStoreFileSystem.readFile(file);
      },
    }),
  });
  const list = store.list.bind(store);
  store.list = async () => {
    const start = process.hrtime.bigint();
    try {
      return await list();
    } finally {
      timing.lists.push(since(start));
    }
  };
  const mutate = store.mutate.bind(store);
  store.mutate = async (...args: Parameters<BoardStore['mutate']>) => {
    const start = process.hrtime.bigint();
    try {
      return await mutate(...args);
    } finally {
      timing.mutate += since(start);
    }
  };
  const controller = new BoardController({
    store,
    ledger,
    folderName: 'board',
    settings: { get: () => undefined, update: async () => undefined },
    runtimes: () => ({
      'claude-code': { state: 'ready', usable: true, detail: null },
      codex: { state: 'ready', usable: true, detail: null },
      opencode: { state: 'ready', usable: true, detail: null },
    }),
    enabled: () => true,
    // As the host does (taskBoardHost.ts): a stat per named file.
    fileExists: async (relative) => {
      const start = process.hrtime.bigint();
      if (options.statDelay) await sleep(options.statDelay);
      const exists = await fsp.stat(path.join(folder, relative)).then(() => true, () => false);
      timing.fileChecks += since(start);
      timing.fileCheckCalls += 1;
      return exists;
    },
  });
  return { store, controller, timing };
}

async function timeDrop(label: string, folder: string, options: { readDelay?: number; statDelay?: number }) {
  const { store, controller, timing } = timedController(folder, options);
  await controller.snapshot(); // the board is open: the first read of the folder is done
  const card = (await store.list()).flatMap((entry) => (entry.kind === 'card' && entry.card.stage === 'todo' ? [entry.card] : []))[0];
  timing.lists.length = 0;
  let start = process.hrtime.bigint();
  const answer = await controller.move(card.id, 'doing', { atEnd: true });
  const move = since(start);
  if (!answer.ok) throw new Error(answer.message);
  const moveLists = [...timing.lists];
  const moveMutate = timing.mutate;
  timing.lists.length = 0;
  timing.fileChecks = 0;
  timing.fileCheckCalls = 0;
  start = process.hrtime.bigint();
  await controller.snapshot();
  const snapshot = since(start);
  controller.dispose();
  return {
    label,
    'move (ms)': round(move),
    'move: list() calls': moveLists.length,
    'move: list() total (ms)': round(moveLists.reduce((a, b) => a + b, 0)),
    'move: write (ms)': round(moveMutate),
    'snapshot (ms)': round(snapshot),
    'snapshot: list() (ms)': round(timing.lists.reduce((a, b) => a + b, 0)),
    'snapshot: file checks': timing.fileCheckCalls,
    'snapshot: file checks, summed (ms)': round(timing.fileChecks),
  };
}

async function main(): Promise<void> {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-r3-'));
  try {
    await build(folder);
    const rows: Array<Record<string, number | string>> = [];
    for (let run = 1; run <= 3; run++) {
      rows.push(await timeDrop(`real disk, run ${run}`, folder, {}));
      rows.push(await timeDrop(`card reads +30 ms, run ${run}`, folder, { readDelay: 30 }));
      rows.push(await timeDrop(`file checks +30 ms, run ${run}`, folder, { statDelay: 30 }));
    }
    console.table(rows);

    // The tail: a re-read of another card file hangs for 3 s; a move starts at the same moment.
    const tail: Array<Record<string, number | string>> = [];
    for (let run = 1; run <= 3; run++) {
      let hanging = false;
      const stuck = fs.readdirSync(path.join(folder, '.ritemark', 'tasks')).filter((name) => name.endsWith('.md')).sort()[0];
      const { store, controller } = timedController(folder, { hang: { name: stuck, ms: 3000, on: () => hanging } });
      const entries = await store.list();
      const other = entries.flatMap((entry) => (entry.kind === 'card' && path.basename(entry.fileName) !== stuck && entry.card.stage !== 'done' ? [entry.card] : []))[0];
      const from = other.stage;
      hanging = true;
      const start = process.hrtime.bigint();
      const reread = store.invalidate(stuck).then(() => since(start));
      const move = controller.move(other.id, 'done').then(() => since(start));
      const [rereadMs, moveMs] = await Promise.all([reread, move]);
      hanging = false;
      // Put it back for the next run.
      await controller.move(other.id, from);
      controller.dispose();
      tail.push({ run, 're-read of a stuck file ends (ms)': Math.round(rereadMs), 'move of another card ends (ms)': Math.round(moveMs) });
    }
    console.table(tail);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

void main();
