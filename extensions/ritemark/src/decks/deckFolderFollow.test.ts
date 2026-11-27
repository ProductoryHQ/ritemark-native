import assert from 'node:assert/strict';
import { test } from 'node:test';
import { promises as disk } from 'node:fs';
import * as path from 'node:path';
import { listFileNames } from '../guidance/folderCounts';
import { recentItems } from '../projects/homeState';
import { walkProject } from '../search/worker/walk';
import { makeTempDir } from '../testing/tempDir';
import { copyCreatedDeckPictures, followDeckMoves, trashDeckFolders, type CreatedDeckFiles, type DeckFolderFiles, type DeckMove } from './deckFolderFollow';
import { folderOf, movedTarget, placeAfterMoves, rewriteDeckPictures } from './deckLibraryFormat';
import { deckFolderCheck, insideDeckFolder, listedDeckFolders } from './deckFolderListing';
import { ensureDeckPictureFolder } from './deckPictureFolder';
import { emptyDeckText } from './newDeck';
import { DIGEST_META, GENERATOR_META } from './page/pageHtml';

const original = 'work/Kickoff.rtms';
const assets = 'work/Kickoff.rtms.files';
const text = '---\ndeck: 1\n---\n\n```slide title\nid: a1\ntitle: Kickoff\nimage: Kickoff.rtms.files/x.png\n```\n\n![](<Kickoff.rtms.files/y.png>)\n\n![](other.png)\n';
const trashed = '“Kickoff.rtms.files” went to the Trash with the deck.';
const kept = "“Kickoff.rtms.files” stayed where it was, because it holds more than the deck's pictures and published page.";
const shared = '“Kickoff.rtms.files” stayed where it was, because “Q3 review.md” uses it.';
const incomplete = "“Kickoff.rtms.files” stayed where it was, because Ritemark couldn't check whether other files use it.";
const stillFindsPictures = ' The deck still finds its pictures there.';
const review = 'notes/Q3 review.md';
const reviewText = '![](<../work/Kickoff.rtms.files/x.png>)';
const pageMark = `<meta name="generator" content="${GENERATOR_META}"><meta name="${DIGEST_META}" content="${'a'.repeat(64)}">`;
const handout = [
  '[^1]: Smith 2020, p. 4',
  '- [Tip]: Use the keyboard',
  '> [brief]: <Kickoff.rtms.files/a b.docx> "Brief"',
  '- [x]: ../a.md',
  "[single]: ../a.md 'A title'",
  '[paren]: ../a.md (A title)',
].join('\r\n') + '\r\n';

function fixture() {
  const content = new Map([[original, text], [assets + '/x.png', 'x'], [assets + '/y.png', 'y']]);
  const openText = new Map<string, string>();
  const folders = new Set([assets]);
  const changes: string[] = [];
  const notices: Array<[string, 'information' | 'warning']> = [];
  const logs: string[] = [];
  const searches: Array<{ glob: string; limit: number }> = [];
  const fs: CreatedDeckFiles = {
    listMarkdown: async (_deck, limit) => [...new Set([...content.keys(), ...openText.keys()])]
      .filter(file => /\.(md|rtms)$/i.test(file)).slice(0, limit),
    kind: async file => folders.has(file) ? 'folder' : content.has(file) ? 'file' : undefined,
    readDeck: async file => {
      const value = openText.get(file) ?? content.get(file);
      if (value === undefined) throw new Error('Deck unavailable');
      return value;
    },
    async *listFolder(folder) {
      for (const file of folders) {
        if (folderOf(file) === folder) yield { name: file.slice(folder.length + 1), kind: 'folder' };
      }
      for (const file of content.keys()) {
        if (folderOf(file) === folder) yield { name: file.slice(folder.length + 1), kind: 'file' };
      }
    },
    readPage: async file => content.get(file)!,
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
      for (const folder of [...folders]) {
        if (!folder.startsWith(from + '/')) continue;
        folders.delete(folder);
        folders.add(to + folder.slice(from.length));
      }
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
      for (const folder of [...folders]) {
        if (folder.startsWith(from + '/')) folders.add(to + folder.slice(from.length));
      }
      for (const [file, bytes] of [...content]) {
        if (file.startsWith(from + '/')) content.set(to + file.slice(from.length), bytes);
      }
      return true;
    },
    notice: (message, level) => { notices.push([message, level]); },
  };
  return { fs, content, openText, folders, changes, notices, searches, logs };
}

async function rebase(fs: DeckFolderFiles, moves: DeckMove[], deck: DeckMove, direct = true, saved = text) {
  const readDeck = fs.readDeck;
  fs.readDeck = async file => file === deck.to ? saved : readDeck(file);
  const after = placeAfterMoves(await followDeckMoves(moves, direct ? [deck] : [], fs));
  return rewriteDeckPictures(saved, target => movedTarget(target, folderOf(deck.from), folderOf(deck.to), after), true);
}

test('delete keeps a folder used by Markdown elsewhere in the project', async () => {
  const { fs, content, folders, changes, notices } = fixture();
  content.delete(original);
  content.set(review, reviewText);
  await trashDeckFolders([{ file: original, text }], [original], fs);
  assert.ok(folders.has(assets));
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [[shared, 'information']]);
});

for (const [to, prefix] of [['work/archive/Review.rtms', '../'], ['work/Review.rtms', '']]) {
  test(`a shared folder stays when the deck goes to ${to}`, async () => {
    const { fs, content, folders, changes, notices } = fixture();
    const move = { from: original, to };
    content.delete(original);
    content.set(review, reviewText);
    const expected = prefix ? text.replaceAll('Kickoff.rtms.files/', prefix + 'Kickoff.rtms.files/')
      .replace('other.png', prefix + 'other.png') : text;
    assert.equal(await rebase(fs, [move], move), expected);
    assert.equal(content.get(review), reviewText);
    assert.ok(folders.has(assets));
    assert.deepEqual(changes, []);
    assert.deepEqual(notices, [[shared + stillFindsPictures, 'information']]);
    const root = makeTempDir('rm-deck-folder-');
    await disk.mkdir(path.join(root, folderOf(to)), { recursive: true });
    assert.equal(await ensureDeckPictureFolder(path.join(root, to)), path.join(root, to + '.files'));
  });
}

for (const extra of [1, 2]) {
  test(`shared folder notice names the first user in tree order and counts ${extra} more`, async () => {
    const { fs, content, notices } = fixture();
    content.delete(original);
    content.set('A note.md', '![](work/Kickoff.rtms.files/x.png)');
    if (extra === 2) content.set('notes/Z deck.rtms', text.replaceAll('Kickoff.rtms.files/', '../work/Kickoff.rtms.files/'));
    content.set(review, reviewText + '\n' + reviewText);
    await trashDeckFolders([{ file: original, text }], [original], fs);
    assert.deepEqual(notices, [[`“Kickoff.rtms.files” stayed where it was, because “Q3 review.md” and ${extra} more ${extra === 1 ? 'file' : 'files'} use it.`, 'information']]);
  });
}

test('unsaved open Markdown text counts', async () => {
  const { fs, content, openText, changes, notices } = fixture();
  content.delete(original);
  content.set(review, 'No pictures on disk');
  openText.set(review, reviewText);
  await trashDeckFolders([{ file: original, text }], [original], fs);
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [[shared, 'information']]);
});

for (const failure of ['too many files', 'unreadable file', 'failed listing']) {
  test(`an incomplete check keeps the folder on delete and move with ${failure}`, async () => {
    const { fs, content, changes, notices } = fixture();
    content.delete(original);
    if (failure === 'too many files') {
      for (let i = 0; i < 501; i++) content.set(`notes/${i}.md`, 'No links');
    } else if (failure === 'unreadable file') {
      fs.listMarkdown = async () => [review];
    } else {
      fs.listMarkdown = async () => { throw new Error('EACCES'); };
    }
    await trashDeckFolders([{ file: original, text }], [original], fs);
    const move = { from: original, to: 'work/archive/Kickoff.rtms' };
    assert.equal(await rebase(fs, [move], move), text.replaceAll('Kickoff.rtms.files/', '../Kickoff.rtms.files/')
      .replace('other.png', '../other.png'));
    assert.deepEqual(changes, []);
    assert.deepEqual(notices, [[incomplete, 'information'], [incomplete + stillFindsPictures, 'information']]);
  });
}

test('extra folder contents take precedence over a shared-folder notice', async () => {
  const { fs, content, changes, notices } = fixture();
  content.delete(original);
  content.set(review, reviewText);
  await trashDeckFolders([{ file: original, text }], [original], fs);
  content.set(assets + '/notes.md', 'Other contents');
  await trashDeckFolders([{ file: original, text }], [original], fs);
  const move = { from: original, to: 'work/archive/Kickoff.rtms' };
  await rebase(fs, [move], move);
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [[shared, 'information'], [kept, 'information'], [kept, 'information']]);
});

test('rename in place follows the deck and rebases both picture forms', async () => {
  const { fs, changes } = fixture();
  const move = { from: original, to: 'work/New.rtms' };
  assert.equal(await rebase(fs, [move], move), text.replaceAll('Kickoff.rtms.files/', 'New.rtms.files/'));
  assert.deepEqual(changes, ['rename work/Kickoff.rtms.files to work/New.rtms.files']);
});

test('move carries the folder and keeps its links, rebasing pictures left behind', async () => {
  const { fs, changes } = fixture();
  const move = { from: original, to: 'work/archive/Kickoff.rtms' };
  assert.equal(await rebase(fs, [move], move), text.replace('other.png', '../other.png'));
  assert.deepEqual(changes, ['rename work/Kickoff.rtms.files to work/archive/Kickoff.rtms.files']);
});

test('a move rebases reference definitions and preserves footnotes and list prose', async () => {
  const { fs, content, changes, notices } = fixture();
  const move = { from: original, to: 'work/archive/Kickoff.rtms' };
  content.set(assets + '/a b.docx', 'brief');
  assert.equal(await rebase(fs, [move], move, true, text + handout),
    text.replaceAll('Kickoff.rtms.files/', '../Kickoff.rtms.files/').replace('other.png', '../other.png') +
    handout.replace('<Kickoff.rtms.files/', '<../Kickoff.rtms.files/').replaceAll('../a.md', '../../a.md'));
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [[kept, 'information']]);
});

test('explicit folder and parent moves are already accounted for', async () => {
  const { fs, changes } = fixture();
  const move = { from: original, to: 'archive/Kickoff.rtms' };
  assert.equal(await rebase(fs, [move, { from: assets, to: 'archive/Kickoff.rtms.files' }], move), text.replace('other.png', '../work/other.png'));
  assert.equal(await rebase(fs, [{ from: 'work', to: 'archive' }], move, false), text);
  assert.deepEqual(changes, []);
});

test('taken folder name leaves the pictures in place and gives one notice', async () => {
  const { fs, content, changes, notices } = fixture();
  content.set('work/archive/Kickoff.rtms.files', 'taken by a file');
  const move = { from: original, to: 'work/archive/Kickoff.rtms' };
  assert.equal(await rebase(fs, [move], move), text.replaceAll('Kickoff.rtms.files/', '../Kickoff.rtms.files/').replace('other.png', '../other.png'));
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [["“Kickoff.rtms.files” stayed where it was, because “Kickoff.rtms.files” is already there. The deck's pictures still show.", 'information']]);
});

test('a rename onto a taken folder name names the taken name', async () => {
  const { fs, content, changes, notices } = fixture();
  content.set('work/Review.rtms.files', 'taken by a file');
  const move = { from: original, to: 'work/Review.rtms' };
  await rebase(fs, [move], move);
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [["“Kickoff.rtms.files” stayed where it was, because “Review.rtms.files” is already there. The deck's pictures still show.", 'information']]);
});

test('the folder stays when the deck moves into it', async () => {
  const { fs, changes, notices } = fixture();
  const move = { from: original, to: assets + '/Kickoff.rtms' };
  assert.equal(await rebase(fs, [move], move), text.replaceAll('Kickoff.rtms.files/', '').replace('other.png', '../other.png'));
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [['“Kickoff.rtms.files” stayed where it was, because the deck was moved into it.', 'information']]);
});

test('renaming an empty deck leaves a folder of notes silently', async () => {
  const { fs, content, changes, notices } = fixture();
  const move = { from: original, to: 'work/New.rtms' };
  content.set(move.to, emptyDeckText());
  content.set(assets + '/notes.md', 'notes');
  assert.deepEqual(await followDeckMoves([move], [move], fs), [move]);
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, []);
});

test('moving a deck leaves a mixed folder in place and reports once', async () => {
  const { fs, content, changes, notices } = fixture();
  const move = { from: original, to: 'work/archive/Kickoff.rtms' };
  content.set(assets + '/notes.md', 'notes');
  assert.equal(await rebase(fs, [move], move), text.replaceAll('Kickoff.rtms.files/', '../Kickoff.rtms.files/').replace('other.png', '../other.png'));
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [[kept, 'information']]);
});

for (const scenario of ['empty deck', 'picture and clutter', 'extra notes', 'marked page', 'unmarked page', 'nested page', 'symlink', 'unreadable deck', 'unreadable folder', 'too many entries', 'too many entries without a link', 'unreadable folder without a link', 'Markdown link', 'linked document'] as const) {
  test(`delete checks folder ownership with ${scenario}`, async () => {
    const { fs, content, folders, changes, notices } = fixture();
    content.delete(original);
    content.delete(assets + '/y.png');
    content.set(assets + '/.DS_Store', 'clutter');
    let saved: string | undefined = '![](<Kickoff.rtms.files/x.png>)';
    if (scenario === 'empty deck' || scenario.endsWith('without a link')) saved = emptyDeckText();
    if (scenario === 'unreadable deck') saved = undefined;
    if (scenario === 'empty deck' || scenario === 'extra notes') content.set(assets + '/notes.md', 'notes');
    if (scenario === 'Markdown link') saved = '[Picture](<Kickoff.rtms.files/x.png>)';
    if (scenario === 'linked document') {
      content.delete(assets + '/x.png');
      content.set(assets + '/Client brief.docx', 'brief');
      saved = '[Brief](<Kickoff.rtms.files/Client brief.docx>)';
    }
    if (scenario === 'nested page') {
      folders.add(assets + '/nested');
      content.set(assets + '/nested/Kickoff.html', pageMark);
      saved += '\n[Published page](<Kickoff.rtms.files/nested/Kickoff.html>)';
    }
    if (scenario === 'marked page' || scenario === 'unmarked page') {
      content.set(assets + '/Kickoff.html', (scenario === 'marked page' ? pageMark : '') +
        '<style>@font-face{src:url(fonts/X.woff2)}</style><img src="logos/l.svg"><img src="page%20picture%23.png">');
      folders.add(assets + '/fonts');
      folders.add(assets + '/logos');
      content.set(assets + '/fonts/X.woff2', 'font');
      content.set(assets + '/logos/l.svg', 'logo');
      content.set(assets + '/page picture#.png', 'picture');
      saved += '\n[Published page](<Kickoff.rtms.files/Kickoff.html>)';
    }
    if (scenario === 'symlink') {
      const list = fs.listFolder;
      fs.listFolder = async function* (folder) {
        yield* list(folder);
        yield { name: 'outside.png', kind: 'other' };
      };
      saved += '\n![](<Kickoff.rtms.files/outside.png>)';
    }
    if (scenario.startsWith('unreadable folder')) fs.listFolder = async function* () { throw new Error('EACCES'); };
    if (scenario.startsWith('too many entries')) {
      for (let index = 0; index < 499; index++) folders.add(assets + '/extra-' + index);
    }
    await trashDeckFolders([{ file: original, text: saved }], [original], fs);
    const owned = scenario === 'picture and clutter' || scenario === 'marked page' || scenario === 'Markdown link';
    const silent = scenario === 'empty deck' || scenario === 'unreadable deck' || scenario.endsWith('without a link');
    assert.deepEqual(changes, owned ? ['trash work/Kickoff.rtms.files'] : []);
    assert.deepEqual(notices, owned ? [[trashed, 'information']] : silent ? [] : [[kept, 'information']]);
    assert.equal(folders.has(assets), !owned);
  });
}

test('a linked document alone triggers the informational notice on move', async () => {
  const { fs, content, changes, notices } = fixture();
  const move = { from: original, to: 'archive/Kickoff.rtms' };
  content.delete(assets + '/x.png');
  content.delete(assets + '/y.png');
  content.set(assets + '/Client brief.docx', 'brief');
  content.set(move.to, '[Brief](<Kickoff.rtms.files/Client brief.docx>)');
  assert.deepEqual(await followDeckMoves([move], [move], fs), [move]);
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, [[kept, 'information']]);
});

for (const [name, saved] of [['Review', text], ['kickoff', text], ['Text only', emptyDeckText()]] as const) {
  test(`a published deck renamed to "${name}" takes its page and fonts to the Trash`, async () => {
    const { fs, content, folders, changes, notices } = fixture();
    if (name === 'Text only') {
      content.delete(assets + '/x.png');
      content.delete(assets + '/y.png');
    }
    content.delete(original);
    content.set(assets + '/Kickoff.html', pageMark + '<style>@font-face{src:url(fonts/X.woff2)}</style>');
    folders.add(assets + '/fonts');
    content.set(assets + '/fonts/X.woff2', 'font');
    const move = { from: original, to: `work/${name}.rtms` };
    const renamed = `work/${name}.rtms.files`;
    const rebased = await rebase(fs, [move], move, true, saved);
    assert.equal(content.has(renamed + '/Kickoff.html'), true);
    await trashDeckFolders([{ file: move.to, text: rebased }], [move.to], fs);
    assert.deepEqual(changes, [`rename ${assets} to ${renamed}`, `trash ${renamed}`]);
    assert.deepEqual(notices, [[`“${name}.rtms.files” went to the Trash with the deck.`, 'information']]);
  });
}

test('delete uses the Trash, except when a sibling links in or the folder is already in the event', async () => {
  const { fs, content, changes } = fixture();
  content.delete(original);
  content.set('work/Shared.deck.md', text);
  await trashDeckFolders([{ file: original, text }], [original], fs);
  content.set('work/Shared.deck.md', '[Handout](<Kickoff.rtms.files/Kickoff.html>)');
  await trashDeckFolders([{ file: original, text }], [original], fs);
  content.delete('work/Shared.deck.md');
  await trashDeckFolders([{ file: original, text }], [original, assets], fs);
  assert.deepEqual(changes, []);
  await trashDeckFolders([{ file: original, text }], [original], fs);
  assert.deepEqual(changes, ['trash work/Kickoff.rtms.files']);
});

test('unavailable Trash leaves the folder and reports once', async () => {
  const { fs, content, notices, folders } = fixture();
  content.delete(original);
  fs.trash = async () => { throw new Error('unavailable'); };
  await trashDeckFolders([{ file: original, text }, { file: original, text }], [original, original], fs);
  assert.ok(folders.has(assets));
  assert.deepEqual(notices, [["“Kickoff.rtms.files” stayed where it was, because it couldn't be moved to the Trash.", 'warning']]);
});

test('Copy/Paste copies pictures and rewrites only the new deck, unless its folder is taken', async () => {
  const { fs, content } = fixture();
  const copy = 'work/Kickoff copy 2.deck.md';
  const written = text + handout;
  content.set(original, written);
  content.set(copy, written);
  content.set(assets + '/a b.docx', 'brief');
  content.set('a.md', 'notes');
  content.set('work/other.png', 'other');
  const copied = await copyCreatedDeckPictures(copy, written, fs, await fs.readBytes(copy));
  assert.equal(copied, written.replaceAll('Kickoff.rtms.files/', 'Kickoff copy 2.deck.md.files/'));
  assert.equal(content.get('work/Kickoff copy 2.deck.md.files/x.png'), 'x');
  assert.equal(content.get('work/Kickoff copy 2.deck.md.files/y.png'), 'y');
  assert.equal(content.get(original), written);
  assert.equal(await copyCreatedDeckPictures(copy, written, fs, await fs.readBytes(copy)), written);
});

test('Copy/Paste into another folder copies pictures and rebases other relative links', async () => {
  const { fs, content, searches } = fixture();
  const copy = 'work/Archive/Kickoff.rtms';
  const written = text.replace('other.png', 'images/other.png') + '[![Photo](<Kickoff.rtms.files/y.png>)](../notes.md#next)\n' + handout;
  content.set(original, written);
  content.set(copy, written);
  content.set('work/images/other.png', 'other');
  content.set('notes.md', 'notes');
  assert.equal(await copyCreatedDeckPictures(copy, written, fs, await fs.readBytes(copy)),
    written.replace('images/other.png', '../images/other.png').replace('../notes.md', '../../notes.md').replaceAll('../a.md', '../../a.md'));
  assert.equal(content.get('work/Archive/Kickoff.rtms.files/x.png'), 'x');
  assert.equal(content.get('work/Archive/Kickoff.rtms.files/y.png'), 'y');
  assert.equal(content.get(original), written);
  assert.deepEqual(searches, [{ glob: '**/{Kickoff.rtms,Kickoff.deck.md}', limit: 32 }]);
});

test('a copy owns its marked page under the original filename', async () => {
  const { fs, content, changes, notices } = fixture();
  const copy = 'work/Kickoff copy.rtms';
  const copyFolder = copy + '.files';
  content.set(assets + '/Kickoff.html', pageMark);
  content.set('work/other.png', 'other');
  content.set(copy, text);
  const copied = await copyCreatedDeckPictures(copy, text, fs, await fs.readBytes(copy));
  assert.equal(content.has(copyFolder + '/Kickoff.html'), true);
  content.delete(copy);
  await trashDeckFolders([{ file: copy, text: copied }], [copy], fs);
  assert.deepEqual(changes, [`trash ${copyFolder}`]);
  assert.deepEqual(notices, [['“Kickoff copy.rtms.files” went to the Trash with the deck.', 'information']]);
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
  assert.ok(insideDeckFolder('Talks/Kickoff.deck.md.files/fonts/css.md', owned));
  assert.ok(!insideDeckFolder('Talks/Notes.rtms.files/x.md', owned));
  assert.ok(!insideDeckFolder('Talks/Kickoff.deck.md.files', owned));
  const check = deckFolderCheck('/project', async dir => dir === '/project/Talks' ? ['Kickoff.deck.md'] : []);
  assert.ok(await check('Talks/Kickoff.deck.md.files/Kickoff.html'));
  assert.ok(!await check('Talks/Notes.rtms.files/x.md'));
});


test('Kickoff files beside Kickoff.rtms is an ordinary folder', async () => {
  const { fs, content, folders, changes, notices } = fixture();
  const folder = 'work/Kickoff files';
  const note = folder + '/notes.md';
  const saved = '[Notes](<Kickoff files/notes.md>)';
  folders.delete(assets);
  content.delete(assets + '/x.png');
  content.delete(assets + '/y.png');
  folders.add(folder);
  content.set(note, 'Meeting notes');
  content.set(original, saved);

  const root = makeTempDir('rm-deck-folder-');
  await disk.mkdir(path.join(root, folder), { recursive: true });
  await disk.writeFile(path.join(root, note), content.get(note)!);
  await disk.writeFile(path.join(root, original), saved);

  assert.deepEqual((await listFileNames(root)).names.sort(), ['Kickoff.rtms', 'notes.md']);
  assert.deepEqual(recentItems(path.join(root, 'work'), [
    { path: path.join(root, original), changedAt: 1 },
    { path: path.join(root, note), changedAt: 2 },
  ], new Set()).map(file => file.path), [path.join(root, note), path.join(root, original)]);

  const { documents } = await walkProject(
    [{ path: root, name: 'fixture' }],
    { platform: process.platform, oneDriveRoots: [], filesExclude: {} },
    { readdir: dir => disk.readdir(dir, { withFileTypes: true }), stat: file => disk.stat(file),
      readHead: async (file, maxBytes) => (await disk.readFile(file)).subarray(0, maxBytes) },
    100,
    async () => {},
  );
  assert.ok(documents.some(document => document.relativePath === note));

  await trashDeckFolders([{ file: original, text: saved }], [original], fs);
  const move = { from: original, to: 'work/New.rtms' };
  content.delete(original);
  content.set(move.to, saved);
  await followDeckMoves([move], [move], fs);
  assert.deepEqual(changes, []);
  assert.deepEqual(notices, []);
  assert.ok(folders.has(folder));
  assert.equal(content.get(note), 'Meeting notes');
});
