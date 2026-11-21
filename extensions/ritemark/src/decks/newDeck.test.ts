/**
 * Sprint 159 (PR 7; 16 November, New → Deck opens the deck): New → Deck's rules and steps, and the start card's copy of
 * an earlier deck. Run with `npx tsx src/decks/newDeck.test.ts`.
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseDeck, parseSlideBody } from './deckFormat';
import { slidesOfText } from './deckLibraryFormat';
import { copiedDeckText, copiedNotice, copyEarlierDeck, copyFileName, deckNameOf, earlierDecks, EMPTY_DECK_TITLE, emptyDeckText, emptyFileName, makeEmptyDeck } from './newDeck';
import { BUILT_IN_THEME_PATH } from './deckTheme';

async function main(): Promise<void> {

// An empty deck: one title slide reading "The deck's title", in the built-in theme, a deck this build reads.
{
  const text = emptyDeckText(() => 0.5);
  const deck = parseDeck(text);
  const [slide] = slidesOfText(text);
  assert.deepEqual({ version: deck.version, theme: deck.theme, slides: deck.slides.length, kind: slide.kind, title: slide.data.title, handout: slide.handout, hasId: /^[a-z][0-9a-z]{3}$/.test(slide.data.id ?? '') }, {
    version: '1', theme: BUILT_IN_THEME_PATH, slides: 1, kind: 'title', title: EMPTY_DECK_TITLE, handout: '', hasId: true,
  });
}

// Names: the copy's "(copy)", then "(copy 2)"; an empty deck's "Untitled"; a deck's name from its path.
{
  // Sprint 172: new names end `.rtms`; a copy of an old `.deck.md` is a new file, so `.rtms` too
  // A name an older `.deck.md` has is taken too (review of #949): never two decks of one name, one page
  const taken = new Set(['Training (copy).rtms', 'Untitled.rtms', 'Untitled 2.rtms', 'Old (copy).deck.md', 'Untitled 3.deck.md']);
  assert.deepEqual({
    copy: copyFileName('Workshop', name => taken.has(name)),
    copyTaken: copyFileName('Training', name => taken.has(name)),
    empty: emptyFileName(name => taken.has(name)),
    copyOld: copyFileName('Old', name => taken.has(name)),
    name: deckNameOf('Clients/Harbour/AI assistants and agents.deck.md'),
    nameUpper: deckNameOf('Top.DECK.md'),
    nameNew: deckNameOf('Clients/Harbour/Day one.rtms'),
  }, {
    copy: 'Workshop (copy).rtms',
    copyTaken: 'Training (copy 2).rtms',
    empty: 'Untitled 4.rtms',
    copyOld: 'Old (copy 2).rtms',
    name: 'AI assistants and agents',
    nameUpper: 'Top',
    nameNew: 'Day one',
  });
}

// A copy: byte for byte in the same folder; in another folder only its relative paths change, notes, from: lines,
// the theme, web links and anchors as they were.
{
  const deck = [
    '---',
    'deck: 1',
    'theme: Slide library/Themes/Evening.theme.md',
    '---',
    '',
    'Before the first slide: ![logo](images/logo.png).',
    '',
    '```slide boxes',
    'id: a1',
    'title: Four parts',
    'image: "images/four #1.png"',
    'from: Slide library/AI assistants.deck.md#a7c2 @k3f9z1',
    'items:',
    '- heading: Instructions',
    '```',
    '',
    '```notes',
    'Ask who has used an agent.',
    '```',
    '',
    'See [the brief](Brief.md), [the site](https://example.com/a.png) and [above](#top).',
    '',
    '```slide statement',
    'id: a2',
    'title: Assistant or agent?',
    '```',
    '',
    'No paths here.',
    '',
  ].join('\n');
  assert.equal(copiedDeckText(deck, 'Clients/Harbour', 'Clients/Harbour'), deck, 'the same folder: every byte');
  const moved = copiedDeckText(deck, 'Clients/Harbour', 'Courses');
  const expected = deck
    .replace('![logo](images/logo.png)', '![logo](../Clients/Harbour/images/logo.png)')
    .replace('image: "images/four #1.png"', 'image: "../Clients/Harbour/images/four #1.png"')
    .replace('[the brief](Brief.md)', '[the brief](../Clients/Harbour/Brief.md)');
  assert.equal(moved, expected);
  const slides = slidesOfText(moved);
  assert.deepEqual({
    image: parseSlideBody(parseDeck(moved).slides[0].body).image,
    notes: slides[0].notes,
    from: slides[0].data.from,
  }, {
    image: '../Clients/Harbour/images/four #1.png',
    notes: 'Ask who has used an agent.',
    from: 'Slide library/AI assistants.deck.md#a7c2 @k3f9z1',
  });
  // Into the project's top and back out of a deeper folder
  assert.match(copiedDeckText(deck, 'Clients/Harbour', ''), /image: "Clients\/Harbour\/images\/four #1\.png"/);
  assert.match(copiedDeckText(deck.replace('Clients/Harbour', ''), '', 'Courses/2026'), /!\[logo\]\(\.\.\/\.\.\/images\/logo\.png\)/);
}

// The start card's earlier decks: newest first with folder and date; the library's topics and the deck itself left out
// (isTopicPath: a deck in a folder under the library is no topic, as the library's Other decks lists it).
{
  const rows = earlierDecks([
    { path: 'Clients/Harbour/AI assistants and agents.deck.md', modified: 200 },
    { path: 'Slide library/AI assistants.deck.md', modified: 500 },
    { path: 'Kickoff.deck.md', modified: 300 },
    { path: 'Untitled.deck.md', modified: 900 },
    { path: 'Clients/Northwind/Data in Excel.deck.md', modified: 100 },
    { path: 'Slide library/Old/Retired.deck.md', modified: 50 },
  ], 'Trainings', modified => `day ${modified}`, 'Untitled.deck.md');
  assert.deepEqual(rows, [
    { path: 'Kickoff.deck.md', name: 'Kickoff', folder: 'Trainings', date: 'day 300' },
    { path: 'Clients/Harbour/AI assistants and agents.deck.md', name: 'AI assistants and agents', folder: 'Clients/Harbour', date: 'day 200' },
    { path: 'Clients/Northwind/Data in Excel.deck.md', name: 'Data in Excel', folder: 'Clients/Northwind', date: 'day 100' },
    { path: 'Slide library/Old/Retired.deck.md', name: 'Retired', folder: 'Slide library/Old', date: 'day 50' },
  ]);
  assert.deepEqual(earlierDecks([], 'Trainings', () => ''), []);
}

// New → Deck asks nothing first (16 November): the command has no quick pick, and opens the deck it made. A source
// check, since the command is VS Code's; red on main, where "Start empty, or from a copy of an earlier deck" was asked.
{
  const host = fs.readFileSync(path.join(__dirname, 'decksHost.ts'), 'utf8');
  assert.doesNotMatch(host, /showQuickPick/, 'New → Deck shows no quick pick');
  assert.match(host, /makeEmptyDeck\(/, 'New → Deck makes the empty deck through makeEmptyDeck');
  assert.match(host, /'vscode\.openWith', vscode\.Uri\.file\(target\), 'ritemark\.editor'/, 'and opens it as a deck');
}

// New → Deck's steps: "Untitled.rtms", then "Untitled 2.rtms" and on, in the folder New was opened from; made by
// exclusive create, then opened; a name taken meanwhile is skipped, any other failure said once.
{
  const disk = new Set(['Courses/Untitled.rtms']);
  const made: string[] = [];
  const log: string[] = [];
  const steps = (toFolder: string) => ({
    toFolder,
    taken: (fileName: string) => disk.has(toFolder ? `${toFolder}/${fileName}` : fileName),
    create: async (relative: string, text: string) => {
      if (disk.has(relative)) throw new Error('EEXIST');
      disk.add(relative);
      log.push(`create ${relative} ${parseDeck(text).slides.length} slide`);
    },
    made: async (fileName: string) => { made.push(fileName); log.push(`open ${fileName}`); },
    failed: (message: string) => { log.push(`failed ${message}`); },
  });
  assert.equal(await makeEmptyDeck(steps('')), 'Untitled.rtms');
  assert.equal(await makeEmptyDeck(steps('')), 'Untitled 2.rtms');
  assert.equal(await makeEmptyDeck(steps('Courses')), 'Untitled 2.rtms');
  assert.deepEqual(log, [
    'create Untitled.rtms 1 slide', 'open Untitled.rtms',
    'create Untitled 2.rtms 1 slide', 'open Untitled 2.rtms',
    'create Courses/Untitled 2.rtms 1 slide', 'open Untitled 2.rtms',
  ]);
  // Taken meanwhile (another program made it after the name was chosen): the next free one
  const racing = { ...steps(''), create: async (relative: string) => {
    if (relative === 'Untitled 3.rtms') { disk.add(relative); throw new Error('EEXIST'); }
    disk.add(relative);
  } };
  assert.equal(await makeEmptyDeck(racing), 'Untitled 4.rtms');
  // Another failure: said once, nothing opened
  log.length = 0;
  assert.equal(await makeEmptyDeck({ ...steps('Locked'), create: async () => { throw new Error('read-only'); } }), null);
  assert.deepEqual(log, ['failed The deck could not be made: read-only']);
}

// The start card's copy (Sprint 172: of an old `.deck.md` too, as a new `.rtms`): this deck becomes the earlier deck, the same slides, theme and look, its relative paths rebased
// to this deck's folder, renamed "<name> (copy)" (the tab follows the rename), and the bar says so in the renamed tab.
{
  const source = [
    '---',
    'deck: 1',
    'theme: Slide library/Themes/Evening.theme.md',
    'look: borderless',
    '---',
    '',
    '```slide title',
    'id: a1',
    'title: AI assistants',
    'image: images/cover.png',
    '```',
    '',
    'Welcome. See [the brief](Brief.md).',
    '',
    '```slide statement',
    'id: a2',
    'title: Questions?',
    '```',
    '',
  ].join('\n');
  const steps: string[] = [];
  let deckText = emptyDeckText(() => 0.5);
  const result = await copyEarlierDeck('Clients/Harbour/AI assistants.deck.md', {
    deck: 'Courses/Untitled.rtms',
    read: async relative => (relative === 'Clients/Harbour/AI assistants.deck.md' ? source : null),
    taken: fileName => fileName === 'AI assistants (copy).rtms',
    replace: async text => { deckText = text; steps.push('replace and save'); return true; },
    rename: async (fileName, line) => { steps.push(`rename ${fileName}, then: ${line}`); return true; },
    notice: text => { steps.push(`notice ${text}`); },
  });
  assert.equal(result, 'AI assistants (copy 2).rtms');
  assert.deepEqual(steps, ['replace and save', `rename AI assistants (copy 2).rtms, then: ${copiedNotice('AI assistants')}`]);
  assert.equal(copiedNotice('AI assistants'), 'This deck is now a copy of AI assistants.');
  const copied = parseDeck(deckText);
  assert.deepEqual({ theme: copied.theme, look: /^look: borderless$/m.test(deckText), slides: copied.slides.length }, { theme: 'Slide library/Themes/Evening.theme.md', look: true, slides: 2 });
  assert.equal(parseSlideBody(copied.slides[0].body).image, '../Clients/Harbour/images/cover.png');
  assert.match(deckText, /\[the brief\]\(\.\.\/Clients\/Harbour\/Brief\.md\)/);
  // Gone meanwhile: nothing changes, and the bar says why
  const gone: string[] = [];
  assert.equal(await copyEarlierDeck('Old.deck.md', {
    deck: 'Untitled.rtms',
    read: async () => null,
    taken: () => false,
    replace: async () => { gone.push('replace'); return true; },
    rename: async () => { gone.push('rename'); return true; },
    notice: text => { gone.push(`notice ${text}`); },
  }), null);
  assert.deepEqual(gone, ['notice Old is no longer there.']);
  // A rename refused: the deck is the copy under its own name, and the bar says so in this tab
  const kept: string[] = [];
  assert.equal(await copyEarlierDeck('Kickoff.deck.md', {
    deck: 'Untitled.rtms',
    read: async () => source,
    taken: () => false,
    replace: async () => true,
    rename: async () => false,
    notice: text => { kept.push(`notice ${text}`); },
  }), 'Untitled.rtms');
  assert.deepEqual(kept, ['notice This deck is now a copy of Kickoff.']);
}

console.log('newDeck: passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
