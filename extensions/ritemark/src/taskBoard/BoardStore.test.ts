import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BoardStore, BoardStoreError, nodeBoardStoreFileSystem, type BoardEntry, type BoardStoreFileSystem, type CardDocuments } from './BoardStore';
import { parseCardFile, serializeCard, splitCardText, type Card } from './cardFile';

const trashed: string[] = [];

function tempFolder(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rm-board-'));
}

function fileSystem(overrides: Partial<BoardStoreFileSystem> = {}): BoardStoreFileSystem {
  return {
    ...nodeBoardStoreFileSystem,
    async trash(file) {
      trashed.push(file);
      fs.rmSync(file);
    },
    ...overrides,
  };
}

function newStore(folder: string, overrides: Partial<BoardStoreFileSystem> = {}): BoardStore {
  let tick = 0;
  return new BoardStore(folder, {
    fileSystem: fileSystem(overrides),
    now: () => new Date(Date.parse('2026-10-12T09:00:00.000Z') + 1000 * tick++),
  });
}

function tasksDir(folder: string): string {
  return path.join(folder, '.ritemark', 'tasks');
}

function filesIn(folder: string): string[] {
  return fs.existsSync(tasksDir(folder)) ? fs.readdirSync(tasksDir(folder)).sort() : [];
}

function cardsOf(entries: BoardEntry[]): Card[] {
  return entries.flatMap((entry) => (entry.kind === 'card' ? [entry.card] : []));
}

function writeCard(folder: string, fileName: string, card: Partial<Card> & { id: string; title: string }): void {
  fs.mkdirSync(tasksDir(folder), { recursive: true });
  const full: Card = { stage: 'todo', rank: 'i', files: [], history: [], description: '', ...card };
  fs.writeFileSync(path.join(tasksDir(folder), fileName), serializeCard(full));
}

async function main(): Promise<void> {
  // ── A folder without a board writes nothing until the first card ───────────
  {
    const folder = tempFolder();
    const store = newStore(folder);
    assert.deepEqual(await store.list(), []);
    assert.equal(fs.existsSync(path.join(folder, '.ritemark')), false, 'looking at the board creates no folder');

    const first = await store.create({ title: 'Draft the workshop agenda', stage: 'todo', by: 'you' });
    assert.match(first.id, /^[a-z0-9]{6}$/);
    const name = 'draft-the-workshop-agenda.md';
    assert.deepEqual(filesIn(folder), [name], 'one file, named after the title');
    assert.equal(store.cardIdOfFile(name), first.id);
    assert.equal(store.cardIdOfFile('nothing.md'), null);
    const onDisk = parseCardFile(fs.readFileSync(path.join(tasksDir(folder), name), 'utf8'));
    assert.equal(onDisk.kind, 'card');
    if (onDisk.kind === 'card') {
      assert.equal(onDisk.card.stage, 'todo');
      assert.deepEqual(onDisk.card.history.map((entry) => `${entry.by}: ${entry.what}`), ['you: Created']);
    }

    const second = await store.create({ title: 'Call Maria', stage: 'todo', by: 'you' });
    const todo = cardsOf(await store.list()).filter((card) => card.stage === 'todo');
    assert.deepEqual(todo.map((card) => card.id), [second.id, first.id], 'a new card lands on top of its stage');

    // The same title again gets -2, then -3; a hand-made file with the name counts too.
    const again = await store.create({ title: 'Call Maria', stage: 'todo', by: 'you' });
    fs.writeFileSync(path.join(tasksDir(folder), 'call-maria-3.md'), '# my own notes\n');
    const third = await store.create({ title: 'Call Maria', stage: 'todo', by: 'you' });
    assert.equal(store.cardIdOfFile('call-maria-2.md'), again.id);
    assert.equal(store.cardIdOfFile('call-maria-4.md'), third.id);
    assert.equal(fs.readFileSync(path.join(tasksDir(folder), 'call-maria-3.md'), 'utf8'), '# my own notes\n', 'a file that is not a card is never touched');

    await assert.rejects(
      () => store.create({ title: '   ', stage: 'todo', by: 'you' }),
      (error: BoardStoreError) => error.code === 'invalid',
    );
  }

  // ── Only the moved card's file changes ─────────────────────────────────────
  {
    const folder = tempFolder();
    const store = newStore(folder);
    const a = await store.create({ title: 'A', stage: 'todo', by: 'you' });
    const b = await store.create({ title: 'B', stage: 'todo', by: 'you' });
    const before = Object.fromEntries(filesIn(folder).map((name) => [name, fs.readFileSync(path.join(tasksDir(folder), name), 'utf8')]));
    const moved = await store.mutate(a.id, { by: 'you', what: 'Moved to Doing' }, (card) => ({ ...card, stage: 'doing' }));
    assert.equal(moved.stage, 'doing');
    assert.equal(moved.history.at(-1)?.what, 'Moved to Doing');
    for (const name of filesIn(folder)) {
      const now = fs.readFileSync(path.join(tasksDir(folder), name), 'utf8');
      if (name === 'b.md') assert.equal(now, before[name], 'the other card is untouched');
      else assert.notEqual(now, before[name]);
    }
    await assert.rejects(
      () => store.mutate(a.id, null, (card) => ({ ...card, id: 'zzzzzz' })),
      (error: BoardStoreError) => error.code === 'invalid',
      'a change cannot rename a card',
    );
    await assert.rejects(
      () => store.mutate('nope00', null, (card) => card),
      (error: BoardStoreError) => error.code === 'not-found',
    );
  }

  // ── Concurrent changes are serialized, none lost ───────────────────────────
  {
    const folder = tempFolder();
    const store = newStore(folder);
    const card = await store.create({ title: 'Busy card', stage: 'doing', by: 'you' });
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        store.mutate(card.id, { by: 'claude', what: `Step ${index}` }, (current) => current),
      ),
    );
    const after = await store.get(card.id);
    assert.equal(after?.history.length, 21, 'twenty parallel changes all land');
    assert.deepEqual(filesIn(folder).filter((name) => name.includes('.tmp-')), [], 'no temp file is left');
  }

  // ── Reading a folder someone else filled ───────────────────────────────────
  {
    const folder = tempFolder();
    writeCard(folder, 'k3f9x2-rewrite.md', { id: 'k3f9x2', title: 'Rewrite the intro', stage: 'doing', rank: 'm' });
    writeCard(folder, 'a1b2c3-idea.md', { id: 'a1b2c3', title: 'An idea', stage: 'idea' });
    fs.writeFileSync(path.join(tasksDir(folder), 'README.md'), '# Notes about this folder\n');
    fs.writeFileSync(path.join(tasksDir(folder), 'k3f9x2-rewrite.md.tmp-dead'), 'half a file');
    const brokenText = '---\nritemark: task/1\nid: b0rk3n\ntitle: [unclosed\n---\nBody\n';
    fs.writeFileSync(path.join(tasksDir(folder), 'b0rk3n-broken.md'), brokenText);

    const store = newStore(folder);
    const entries = await store.list();
    assert.deepEqual(
      entries.map((entry) => (entry.kind === 'card' ? `${entry.card.stage}:${entry.card.id}` : `unreadable:${entry.fileName}`)),
      ['idea:a1b2c3', 'doing:k3f9x2', 'unreadable:b0rk3n-broken.md'],
      'cards in stage order; README and the leftover temp file are not cards; the broken file is listed',
    );
    const broken = entries.find((entry) => entry.kind === 'unreadable');
    assert.match(broken && broken.kind === 'unreadable' ? broken.message : '', /not valid YAML/);
  }

  // ── A broken card file is never written to ─────────────────────────────────
  {
    const folder = tempFolder();
    const store = newStore(folder);
    const card = await store.create({ title: 'Will break', stage: 'todo', by: 'you' });
    const other = await store.create({ title: 'Stays fine', stage: 'todo', by: 'you' });
    const file = path.join(tasksDir(folder), 'will-break.md');
    const broken = fs.readFileSync(file, 'utf8').replace('stage: todo', 'stage: [todo');
    fs.writeFileSync(file, broken);
    await assert.rejects(
      () => store.mutate(card.id, { by: 'you', what: 'Moved to Doing' }, (current) => ({ ...current, stage: 'doing' })),
      (error: BoardStoreError) => error.code === 'unreadable',
    );
    assert.equal(fs.readFileSync(file, 'utf8'), broken, 'the broken file is byte for byte unchanged');
    const moved = await store.mutate(other.id, { by: 'you', what: 'Moved to Doing' }, (current) => ({ ...current, stage: 'doing' }));
    assert.equal(moved.stage, 'doing', 'other cards still work');
    assert.ok((await store.list()).some((entry) => entry.kind === 'unreadable'), 'the broken card shows as unreadable');
  }

  // ── Outside edits, the store's own echo, and files that come and go ───────
  {
    const folder = tempFolder();
    const store = newStore(folder);
    let changes = 0;
    store.onDidChange(() => changes++);
    const card = await store.create({ title: 'Original title', stage: 'todo', by: 'you' });
    const name = 'original-title.md';
    changes = 0;
    assert.equal(await store.invalidate(name), false, 'the echo of our own write is ignored');
    assert.equal(changes, 0);

    const file = path.join(tasksDir(folder), name);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('title: Original title', 'title: Edited elsewhere'));
    assert.equal(await store.invalidate(name), true);
    assert.equal((await store.get(card.id))?.title, 'Edited elsewhere', 'an outside edit shows');
    assert.equal(changes, 1);

    writeCard(folder, 'q1w2e3-from-git.md', { id: 'q1w2e3', title: 'Came with a git checkout' });
    assert.equal(await store.invalidate('q1w2e3-from-git.md'), true);
    assert.ok(await store.get('q1w2e3'), 'a new file from outside appears');
    fs.rmSync(path.join(tasksDir(folder), 'q1w2e3-from-git.md'));
    assert.equal(await store.invalidate('q1w2e3-from-git.md'), true);
    assert.equal(await store.get('q1w2e3'), null, 'a deleted file disappears');
    assert.equal(await store.invalidate('notes.txt'), false, 'other files are ignored');
    await assert.rejects(
      () => store.mutate('q1w2e3', null, (current) => current),
      (error: BoardStoreError) => error.code === 'not-found',
    );
  }

  // ── A copied card file gets its own id on the next write ──────────────────
  {
    const folder = tempFolder();
    writeCard(folder, 'k3f9x2-rewrite.md', { id: 'k3f9x2', title: 'Rewrite the intro' });
    fs.copyFileSync(path.join(tasksDir(folder), 'k3f9x2-rewrite.md'), path.join(tasksDir(folder), 'k3f9x2-rewrite copy.md'));
    const store = newStore(folder);
    const entries = await store.list();
    const copy = entries.find((entry) => entry.kind === 'card' && entry.fileName === 'k3f9x2-rewrite copy.md');
    assert.ok(copy && copy.kind === 'card');
    if (!copy || copy.kind !== 'card') throw new Error('unreachable');
    assert.notEqual(copy.card.id, 'k3f9x2', 'both cards show, the copy under a fresh id');
    assert.equal(copy.copiedFrom, 'k3f9x2');
    assert.ok(await store.get('k3f9x2'), 'the original keeps its id');
    assert.equal(cardsOf(await store.list()).find((card) => card.title === 'Rewrite the intro' && card.id !== 'k3f9x2')?.id, copy.card.id, 'the fresh id is stable');

    const before = fs.readFileSync(path.join(tasksDir(folder), 'k3f9x2-rewrite copy.md'), 'utf8');
    assert.ok(before.includes('id: k3f9x2'), 'reading wrote nothing');
    const changed = await store.mutate(copy.card.id, { by: 'you', what: 'Renamed' }, (card) => ({ ...card, title: 'The copy' }));
    const written = parseCardFile(fs.readFileSync(path.join(tasksDir(folder), 'k3f9x2-rewrite copy.md'), 'utf8'));
    assert.equal(written.kind === 'card' && written.card.id, copy.card.id, 'the next write puts the fresh id in the file');
    assert.deepEqual(changed.history.map((entry) => entry.what), ['Copied from k3f9x2', 'Renamed']);
    const after = await store.list();
    assert.equal(after.find((entry) => entry.kind === 'card' && entry.card.id === copy.card.id && 'copiedFrom' in entry), undefined);
  }

  // ── Delete goes to the trash ───────────────────────────────────────────────
  {
    const folder = tempFolder();
    const store = newStore(folder);
    const card = await store.create({ title: 'Delete me', stage: 'idea', by: 'you' });
    trashed.length = 0;
    await store.remove(card.id);
    assert.deepEqual(trashed.map((file) => path.basename(file)), ['delete-me.md']);
    assert.equal(await store.get(card.id), null);
    await assert.rejects(() => store.remove(card.id), (error: BoardStoreError) => error.code === 'not-found');
  }

  // ── Unknown keys and the body survive a change ─────────────────────────────
  {
    const folder = tempFolder();
    fs.mkdirSync(tasksDir(folder), { recursive: true });
    const text = '---\nritemark: task/1\nid: k3f9x2\nowner: maria\ntitle: Keep my keys\nstage: todo\nrank: i\n---\nBody line one.\n\n- [ ] A checkbox';
    const file = path.join(tasksDir(folder), 'k3f9x2-keep.md');
    fs.writeFileSync(file, text);
    const store = newStore(folder);
    await store.mutate('k3f9x2', { by: 'you', what: 'Moved to Doing' }, (card) => ({ ...card, stage: 'doing' }));
    const after = fs.readFileSync(file, 'utf8');
    assert.ok(after.includes('owner: maria'), 'a key the board does not know stays');
    assert.ok(after.endsWith('---\nBody line one.\n\n- [ ] A checkbox'), 'the body is byte for byte the same');
  }

  // ── A failed write leaves the old file and no temp file ────────────────────
  {
    const folder = tempFolder();
    const store = newStore(folder, {
      async rename() {
        throw new Error('disk full');
      },
    });
    writeCard(folder, 'k3f9x2-keep.md', { id: 'k3f9x2', title: 'Old' });
    const original = fs.readFileSync(path.join(tasksDir(folder), 'k3f9x2-keep.md'), 'utf8');
    await assert.rejects(
      () => store.mutate('k3f9x2', null, (card) => ({ ...card, title: 'New' })),
      (error: BoardStoreError) => error.code === 'write-failed',
    );
    assert.equal(fs.readFileSync(path.join(tasksDir(folder), 'k3f9x2-keep.md'), 'utf8'), original);
    assert.deepEqual(filesIn(folder), ['k3f9x2-keep.md']);
  }

  // ── Hand-edited ranks without room: the stage is spread ────────────────────
  {
    const folder = tempFolder();
    writeCard(folder, 'aaaaa1-a.md', { id: 'aaaaa1', title: 'A', rank: '0' });
    writeCard(folder, 'aaaaa2-b.md', { id: 'aaaaa2', title: 'B', rank: '00' });
    const store = newStore(folder);
    const fresh = await store.create({ title: 'C', stage: 'todo', by: 'you' });
    const order = cardsOf(await store.list()).map((card) => card.title);
    assert.deepEqual(order, ['C', 'A', 'B'], 'the new card is on top and the old order is kept');
    assert.ok(cardsOf(await store.list()).every((card) => !card.rank.endsWith('0')));
    assert.equal((await store.get(fresh.id))?.history.length, 1);
    assert.equal((await store.get('aaaaa1'))?.history.length, 0, 'spreading ranks adds no history line');
  }

  // ── A card open as a page: read and written through its document ──────────
  {
    const folder = tempFolder();
    writeCard(folder, 'open-card.md', { id: 'opn001', title: 'Open card', description: 'Saved body\n' });
    const file = path.join(tasksDir(folder), 'open-card.md');
    // A fake editor: the document's text, its unsaved state, and what it was asked to change.
    const doc = { open: true, text: fs.readFileSync(file, 'utf8'), dirty: false, saves: 0, writes: [] as Array<{ head: string; body?: string }> };
    const documents: CardDocuments = {
      openText: (target) => (doc.open && target === file ? doc.text : undefined),
      isDirty: (target) => doc.open && target === file && doc.dirty,
      async write(target, change) {
        if (!doc.open || target !== file) return false;
        doc.writes.push(change);
        const now = splitCardText(doc.text)!;
        doc.text = change.head + (change.body ?? now.body);
        if (!doc.dirty) {
          fs.writeFileSync(file, doc.text);
          doc.saves += 1;
        }
        return true;
      },
    };
    let tick = 0;
    const store = new BoardStore(folder, {
      fileSystem: fileSystem(),
      documents,
      now: () => new Date(Date.parse('2026-10-12T09:00:00.000Z') + 1000 * tick++),
    });
    await store.list();

    // The user types on the page; the change is not saved yet.
    doc.text = splitCardText(doc.text)!.head + 'Saved body\nTyping in progress\n';
    doc.dirty = true;
    const diskBefore = fs.readFileSync(file, 'utf8');
    assert.equal(await store.invalidate('open-card.md'), true, 'unsaved typing shows on the board');
    assert.equal((await store.get('opn001'))?.description, 'Saved body\nTyping in progress\n');

    // An agent finishes: the board changes the stage. Only the front matter goes
    // into the document, the typing stays, and the disk is not written under it.
    await store.mutate('opn001', { by: 'claude', what: 'Moved to Doing' }, (card) => ({ ...card, stage: 'doing' }));
    assert.equal(doc.writes.length, 1);
    assert.equal(doc.writes[0].body, undefined, 'a front-matter change leaves the body alone');
    assert.ok(doc.text.endsWith('Saved body\nTyping in progress\n'), 'the typing is kept');
    assert.equal(parseCardFile(doc.text).kind === 'card' && (parseCardFile(doc.text) as { card: Card }).card.stage, 'doing');
    assert.equal(fs.readFileSync(file, 'utf8'), diskBefore, 'nothing is written to disk under unsaved typing');
    assert.equal(doc.saves, 0, 'a document with unsaved typing is left for autosave');

    // A change to the description (an agent's update_card) replaces the body too.
    await store.mutate('opn001', null, (card) => ({ ...card, description: 'From the agent\n' }));
    assert.equal(doc.writes[1].body, 'From the agent\n');
    assert.ok(doc.text.endsWith('From the agent\n'));

    // Saved and clean: the board's change is put in the document and saved.
    fs.writeFileSync(file, doc.text);
    doc.dirty = false;
    await store.mutate('opn001', null, (card) => ({ ...card, title: 'Open card, renamed' }));
    assert.equal(doc.saves, 1);
    const saved = parseCardFile(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.kind === 'card' && saved.card.title, 'Open card, renamed');

    // Closed: back to the atomic disk write.
    doc.open = false;
    await store.mutate('opn001', null, (card) => ({ ...card, stage: 'done' }));
    assert.equal(doc.writes.length, 3, 'a closed document is not written to');
    const closed = parseCardFile(fs.readFileSync(file, 'utf8'));
    assert.equal(closed.kind === 'card' && closed.card.stage, 'done');
  }

  console.log('taskBoard/BoardStore: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
