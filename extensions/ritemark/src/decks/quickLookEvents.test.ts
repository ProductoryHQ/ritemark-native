import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { makeTempDir } from '../testing/tempDir';
import { connectQuickLookEvents, type QuickLookJob } from './quickLookEvents';

function signal<Args extends unknown[], Result>() {
  let listener: ((...args: Args) => Result) | undefined;
  return {
    subscribe(next: (...args: Args) => Result) {
      listener = next;
      return { dispose: () => { listener = undefined; } };
    },
    fire: (...args: Args) => listener?.(...args),
  };
}

function fixture(options?: {
  fresh?: boolean;
  draw?: (job: QuickLookJob, active: () => boolean, allowed: () => Promise<boolean>) => Promise<void>;
}) {
  const root = fs.realpathSync.native(makeTempDir('quick-look-events-'));
  const nested = path.join(root, 'nested');
  const file = path.join(nested, 'Deck.rtms');
  fs.mkdirSync(nested);
  fs.writeFileSync(file, 'deck');
  const projects = new Map([['project-key', root], ['nested-key', nested]]);
  const projectEvent = signal<[], Promise<void>>();
  const workspaceEvent = signal<[], void>();
  const watcher = signal<[string, 'create' | 'change' | 'delete'], void>();
  const save = signal<[string], void>();
  const rename = signal<[string | undefined, string | undefined], void>();
  const remove = signal<[string], void>();
  const drawn: QuickLookJob[] = [];
  const removed: string[] = [];
  const checked: string[] = [];
  const purges: string[][] = [];
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const events = connectQuickLookEvents({
    ready: Promise.resolve(),
    projects: async () => new Map(projects),
    onProjectsChanged: projectEvent.subscribe,
    workspace: () => root,
    onWorkspaceChanged: workspaceEvent.subscribe,
    watch: (_root, changed) => watcher.subscribe(changed),
    onSave: save.subscribe,
    onRename: rename.subscribe,
    onDelete: remove.subscribe,
    findDecks: async folder => fs.readdirSync(folder, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.rtms'))
      .map(entry => path.join(entry.parentPath, entry.name)),
    enabled: () => true,
    fresh: async job => { checked.push(job.file); return options?.fresh ? [] : undefined; },
    draw: async (job, active, allowed) => {
      drawn.push(job);
      await options?.draw?.(job, active, allowed);
    },
    remove: async file => { removed.push(file); },
    removeUnder: async folder => { removed.push(folder); },
    purgeOwners: async listed => { purges.push([...(await listed())]); started(); },
    prune: async () => {},
    debounceMs: 0,
  });
  return { events, ready, projects, projectEvent, watcher, save, rename, remove, drawn, removed, checked, purges, root, nested, file };
}

async function until(condition: () => boolean) {
  const deadline = Date.now() + 1500;
  while (!condition()) {
    assert.ok(Date.now() < deadline, 'event did not arrive');
    await sleep(5);
  }
}

test('startup skips fresh decks and the open project owns nested decks', async () => {
  const f = fixture({ fresh: true });
  try {
    await f.ready;
    await until(() => f.checked.length === 1);
    assert.deepEqual(f.drawn, []);
    f.save.fire(f.file);
    await until(() => f.drawn.length === 1);
    assert.equal(f.drawn[0].owner, 'project-key');
    assert.deepEqual(f.purges, [['project-key', 'nested-key']]);
  } finally {
    f.events.dispose();
  }
});

test('folder-only rename, delete and create events cover descendant decks', async () => {
  const f = fixture({ fresh: true });
  try {
    await f.ready;
    await until(() => f.checked.length === 1);
    const moved = path.join(f.root, 'moved');
    fs.renameSync(f.nested, moved);
    f.rename.fire(f.nested, moved);
    await until(() => f.drawn.length === 1);
    assert.equal(f.drawn[0].file, path.join(moved, 'Deck.rtms'));
    assert.deepEqual(f.removed, [f.nested]);
    fs.rmSync(moved, { recursive: true });
    f.remove.fire(moved);
    assert.deepEqual(f.removed, [f.nested, moved]);
    fs.mkdirSync(moved);
    fs.writeFileSync(path.join(moved, 'New.rtms'), 'new');
    f.watcher.fire(moved, 'create');
    await until(() => f.drawn.length === 2);
    assert.equal(f.drawn[1].file, path.join(moved, 'New.rtms'));
  } finally {
    f.events.dispose();
  }
});

test('project removal cancels a running draw and dispose unregisters watchers and saves', async () => {
  let active!: () => boolean;
  let allowed!: () => Promise<boolean>;
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const f = fixture({ draw: async (_, jobActive, jobAllowed) => {
    active = jobActive;
    allowed = jobAllowed;
    await waiting;
  } });
  try {
    await until(() => !!active);
    assert.equal(active(), true);
    f.projects.delete('project-key');
    await f.projectEvent.fire();
    assert.equal(active(), false);
    assert.equal(await allowed(), false);
    assert.deepEqual(f.purges.at(-1), ['nested-key']);
    f.events.dispose();
    f.save.fire(f.file);
    f.watcher.fire(f.file, 'change');
    assert.equal(f.drawn.length, 1);
  } finally {
    release();
    f.events.dispose();
  }
});
