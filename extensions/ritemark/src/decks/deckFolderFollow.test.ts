import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyCreatedDeckPictures, followDeckMoves, trashDeckFolders, type CreatedDeckFiles, type DeckFolderFiles, type DeckMove } from './deckFolderFollow';
import { folderOf, movedTarget, placeAfterMoves, rewriteDeckPictures } from './deckLibraryFormat';
import { deckFolderCheck, insideDeckFolder, listedDeckFolders } from './deckFolderListing';
import { emptyDeckText } from './newDeck';

const original = 'work/Kickoff.rtms';
const assets = 'work/Kickoff files';
const text = '---\ndeck: 1\n---\n\n```slide title\nid: a1\ntitle: Kickoff\nimage: Kickoff files/x.png\n```\n\n![](<Kickoff files/y.png>)\n\n![](other.png)\n';

function fixture() {
  const content = new Map([[original, text], [assets + '/x.png', 'x'], [assets + '/y.png', 'y']]);
  const folders = new Set([assets]);
  const changes: string[] = [];
  const notices: string[] = [];
  const logs: string[] = [];
  const searches: Array<{ glob: string; limit: number }> = [];
  const fs: CreatedDeckFiles = {
    kind: async file => folders.has(file) ? 'folder' : content.has(file) ? 'file' : undefined,
    siblingDecks: async dir => [...content.keys()].filter(file => folderOf(file) === dir && /\.(?:rtms|deck\.md)$/.test(file)),
    readDeck: async file => content.get(file)!,
    readBytes: async file => Buffer.from(content.get(file)!),
    resolves: async file => folders.has(file) || content.has(file),
    findFiles: async (glob, limit) => {
      searches.push({ glob, limit });
      const names = new Set(glob.slice(4, -1).split(','));
      return [...content.keys()].filter(file => names.has(file.split('/').pop()!)).slice(0, limit);
    },
    log: (message: string) => { logs.push(message); },
    rename: async (from, to) => {
      assert.ok(folders.delete(from));
      folders.add(to);
      changes.push(`rename ${from} to ${to}`);
      for (const [file, bytes] of [...content]) {
        if (!file.startsWith(from + '/')) continue;
        content.delete(file);
        content.set(to + file.slice(from.length), bytes);
      }
    },
    trash: async folder => { folders.delete(folder); changes.push(`trash ${folder}`); },
    copy: async (from, to) => {
      if (!folders.has(from) || folders.has(to) || content.has(to)) return false;
      folders.add(to);
      for (const [file, bytes] of [...content]) {
        if (file.startsWith(from + '/')) content.set(to + file.slice(from.length), bytes);
      }
      return true;
    },
    notice: message => { notices.push(message); },
  };
  return { fs, content, folders, changes, notices, searches, logs };
}

async function rebase(fs: DeckFolderFiles, moves: DeckMove[], deck: DeckMove, direct = true) {
  const after = placeAfterMoves(await followDeckMoves(moves, direct ? [deck] : [], fs));
  return rewriteDeckPictures(text, target => movedTarget(target, folderOf(deck.from), folderOf(deck.to), after));
}

test('rename in place follows the deck and rebases both picture forms', async () => {
  const { fs, changes } = fixture();
  const move = { from: original, to: 'work/New.rtms' };
  assert.equal(await rebase(fs, [move], move), text.replaceAll('Kickoff files/', 'New files/'));
  assert.deepEqual(changes, ['rename work/Kickoff files to work/New files']);
});

test('move carries the folder and keeps its links, rebasing pictures left behind', async () => {
  const { fs, changes } = fixture();
  const move = { from: original, to: 'work/archive/Kickoff.rtms' };
  assert.equal(await rebase(fs, [move], move), text.replace('other.png', '../other.png'));
  assert.deepEqual(changes, ['rename work/Kickoff files to work/archive/Kickoff files']);
});

test('explicit folder and parent moves are already accounted for', async () => {
  const { fs, changes } = fixture();
  const move = { from: original, to: 'archive/Kickoff.rtms' };
  assert.equal(await rebase(fs, [move, { from: assets, to: 'archive/Kickoff files' }], move), text.replace('other.png', '../work/other.png'));
  assert.equal(await rebase(fs, [{ from: 'work', to: 'archive' }], move, false), text);
  assert.deepEqual(changes, []);
});

test('taken folder name leaves the pictures in place and gives one notice', async () => {
  const { fs, content, changes, notices } = fixture();
  content.set('work/archive/Kickoff files', 'taken by a file');
  const move = { from: original, to: 'work/archive/Kickoff.rtms' };
  assert.equal(await rebase(fs, [move], move), text.replaceAll('Kickoff files/', '../Kickoff files/').replace('other.png', '../other.png'));
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, ["“Kickoff files” stayed where it was, because “Kickoff files” is already there. The deck's pictures still show."]);
});

test('a rename onto a taken folder name names the taken name', async () => {
  const { fs, content, changes, notices } = fixture();
  content.set('work/Review files', 'taken by a file');
  const move = { from: original, to: 'work/Review.rtms' };
  await rebase(fs, [move], move);
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, ["“Kickoff files” stayed where it was, because “Review files” is already there. The deck's pictures still show."]);
});

test('the folder stays when the deck moves into it', async () => {
  const { fs, changes, notices } = fixture();
  const move = { from: original, to: assets + '/Kickoff.rtms' };
  assert.equal(await rebase(fs, [move], move), text.replaceAll('Kickoff files/', '').replace('other.png', '../other.png'));
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, ['“Kickoff files” stayed where it was, because the deck was moved into it.']);
});

test('delete uses the Trash, except when a sibling links in or the folder is already in the event', async () => {
  const { fs, content, changes } = fixture();
  content.delete(original);
  content.set('work/Shared.deck.md', text);
  await trashDeckFolders([original], [original], fs);
  content.set('work/Shared.deck.md', '[Handout](<Kickoff files/Kickoff.html>)');
  await trashDeckFolders([original], [original], fs);
  content.delete('work/Shared.deck.md');
  await trashDeckFolders([original], [original, assets], fs);
  assert.deepEqual(changes, []);
  await trashDeckFolders([original], [original], fs);
  assert.deepEqual(changes, ['trash work/Kickoff files']);
});

test('unavailable Trash leaves the folder and reports once', async () => {
  const { fs, content, notices, folders } = fixture();
  content.delete(original);
  fs.trash = async () => { throw new Error('unavailable'); };
  await trashDeckFolders([original, original], [original, original], fs);
  assert.ok(folders.has(assets));
  assert.deepEqual(notices, ["“Kickoff files” stayed where it was, because it couldn't be moved to the Trash."]);
});

test('Copy/Paste copies pictures and rewrites only the new deck, unless its folder is taken', async () => {
  const { fs, content } = fixture();
  const copy = 'work/Kickoff copy 2.deck.md';
  content.set(copy, text);
  content.set('work/other.png', 'other');
  const copied = await copyCreatedDeckPictures(copy, text, fs, await fs.readBytes(copy));
  assert.equal(copied, text.replaceAll('Kickoff files/', 'Kickoff copy 2 files/'));
  assert.equal(content.get('work/Kickoff copy 2 files/x.png'), 'x');
  assert.equal(content.get('work/Kickoff copy 2 files/y.png'), 'y');
  assert.equal(content.get(original), text);
  assert.equal(await copyCreatedDeckPictures(copy, text, fs, await fs.readBytes(copy)), text);
});

test('Copy/Paste into another folder copies pictures and rebases other relative links', async () => {
  const { fs, content, searches } = fixture();
  const copy = 'work/Archive/Kickoff.rtms';
  const written = text.replace('other.png', 'images/other.png') + '[![Photo](<Kickoff files/y.png>)](../notes.md#next)\n';
  content.set(original, written);
  content.set(copy, written);
  content.set('work/images/other.png', 'other');
  content.set('notes.md', 'notes');
  assert.equal(await copyCreatedDeckPictures(copy, written, fs, await fs.readBytes(copy)),
    written.replace('images/other.png', '../images/other.png').replace('../notes.md', '../../notes.md'));
  assert.equal(content.get('work/Archive/Kickoff files/x.png'), 'x');
  assert.equal(content.get('work/Archive/Kickoff files/y.png'), 'y');
  assert.equal(content.get(original), written);
  assert.deepEqual(searches, [{ glob: '**/{Kickoff.rtms,Kickoff.deck.md}', limit: 32 }]);
});

for (const matches of [0, 2]) {
  test(`a copy with ${matches} identical source candidates stays untouched and logs once`, async () => {
    const { fs, content, folders, logs, notices } = fixture();
    const copy = 'work/Archive/Kickoff.rtms';
    content.set(copy, text);
    if (matches === 0) content.set(original, '\uFEFF' + text);
    else content.set('other/Kickoff.rtms', text);
    assert.equal(await copyCreatedDeckPictures(copy, text, fs, await fs.readBytes(copy)), text);
    assert.deepEqual([...folders], [assets]);
    assert.equal(logs.length, 1);
    assert.deepEqual(notices, []);
  });
}

test('a copy with only a broken Markdown link still rebases it', async () => {
  const { fs, content, folders } = fixture();
  const copy = 'work/Archive/Kickoff.rtms';
  const written = emptyDeckText() + '\n[Notes](notes.md)\n';
  content.set(original, written);
  content.set(copy, written);
  content.set('work/notes.md', 'notes');
  folders.delete(assets);
  assert.equal(await copyCreatedDeckPictures(copy, written, fs, await fs.readBytes(copy)),
    written.replace('(notes.md)', '(../notes.md)'));
  assert.equal(folders.size, 0);
});

test('New → Deck has no linked files and does not look for copies', async () => {
  const { fs, content, folders, searches, logs } = fixture();
  const deck = 'work/Untitled.rtms';
  const empty = emptyDeckText();
  content.set(deck, empty);
  assert.equal(await copyCreatedDeckPictures(deck, empty, fs, await fs.readBytes(deck)), empty);
  assert.deepEqual([...folders], [assets]);
  assert.deepEqual(searches, []);
  assert.deepEqual(logs, []);
});

test('only ancestors with a sibling deck are treated as deck folders', async () => {
  const owned = listedDeckFolders(['Talks/Kickoff.deck.md', 'Different/Notes.rtms']);
  assert.ok(insideDeckFolder('Talks/Kickoff files/fonts/css.md', owned));
  assert.ok(!insideDeckFolder('Talks/Notes files/x.md', owned));
  assert.ok(!insideDeckFolder('Talks/Kickoff files', owned));
  const check = deckFolderCheck('/project', async dir => dir === '/project/Talks' ? ['Kickoff.deck.md'] : []);
  assert.ok(await check('Talks/Kickoff files/Kickoff.html'));
  assert.ok(!await check('Talks/Notes files/x.md'));
});
