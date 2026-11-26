import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyCreatedDeckPictures, followDeckMoves, trashDeckFolders, type DeckFolderFiles, type DeckMove } from './deckFolderFollow';
import { folderOf, movedTarget, placeAfterMoves, rewriteDeckPictures } from './deckLibraryFormat';
import { deckFolderCheck, insideDeckFolder, listedDeckFolders } from './deckFolderListing';

const original = 'work/Kickoff.rtms';
const assets = 'work/Kickoff files';
const text = '---\ndeck: 1\n---\n\n```slide title\nid: a1\ntitle: Kickoff\nimage: Kickoff files/x.png\n```\n\n![](<Kickoff files/y.png>)\n\n![](other.png)\n';

function fixture() {
  const content = new Map([[original, text], [assets + '/x.png', 'x'], [assets + '/y.png', 'y']]);
  const folders = new Set([assets]);
  const changes: string[] = [];
  const notices: string[] = [];
  const fs: DeckFolderFiles = {
    kind: async file => folders.has(file) ? 'folder' : content.has(file) ? 'file' : undefined,
    siblingDecks: async dir => [...content.keys()].filter(file => folderOf(file) === dir && /\.(?:rtms|deck\.md)$/.test(file)),
    readDeck: async file => content.get(file)!,
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
  return { fs, content, folders, changes, notices };
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
  const copy = 'work/Kickoff copy.deck.md';
  content.set(copy, text);
  const copied = await copyCreatedDeckPictures(copy, text, fs);
  assert.equal(copied, text.replaceAll('Kickoff files/', 'Kickoff copy files/'));
  assert.equal(content.get('work/Kickoff copy files/x.png'), 'x');
  assert.equal(content.get('work/Kickoff copy files/y.png'), 'y');
  assert.equal(content.get(original), text);
  assert.equal(await copyCreatedDeckPictures(copy, text, fs), text);
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
