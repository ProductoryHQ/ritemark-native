/**
 * Sprint 159 (PR 7): New → Deck's rules. Run with `npx tsx src/decks/newDeck.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { parseDeck, parseSlideBody } from './deckFormat';
import { slidesOfText } from './deckLibraryFormat';
import { copiedDeckText, copyFileName, deckFileName, EMPTY_DECK_TITLE, emptyDeckText, emptyFileName, newDeckChoices } from './newDeck';
import { BUILT_IN_THEME_PATH } from './deckTheme';

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
  const taken = new Set(['Training (copy).deck.md', 'Untitled.deck.md', 'Untitled 2.deck.md']);
  assert.deepEqual({
    copy: copyFileName('Workshop', name => taken.has(name)),
    copyTaken: copyFileName('Training', name => taken.has(name)),
    empty: emptyFileName(name => taken.has(name)),
    name: deckFileName('Clients/Harbour/AI assistants and agents.deck.md'),
    nameUpper: deckFileName('Top.DECK.md'),
  }, {
    copy: 'Workshop (copy).deck.md',
    copyTaken: 'Training (copy 2).deck.md',
    empty: 'Untitled 3.deck.md',
    name: 'AI assistants and agents',
    nameUpper: 'Top',
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

// The quick pick: Empty deck first, then the decks newest first with folder and date; the library's topics left out.
{
  const rows = newDeckChoices([
    { path: 'Clients/Harbour/AI assistants and agents.deck.md', modified: 200 },
    { path: 'Slide library/AI assistants.deck.md', modified: 500 },
    { path: 'Kickoff.deck.md', modified: 300 },
    { path: 'Clients/Northwind/Data in Excel.deck.md', modified: 100 },
  ], 'Trainings', modified => `day ${modified}`);
  assert.deepEqual(rows, [
    { label: 'Empty deck' },
    { label: 'Kickoff', description: 'Trainings · day 300', source: 'Kickoff.deck.md' },
    { label: 'AI assistants and agents', description: 'Clients/Harbour · day 200', source: 'Clients/Harbour/AI assistants and agents.deck.md' },
    { label: 'Data in Excel', description: 'Clients/Northwind · day 100', source: 'Clients/Northwind/Data in Excel.deck.md' },
  ]);
  assert.deepEqual(newDeckChoices([], 'Trainings', () => ''), [{ label: 'Empty deck' }]);
}

console.log('newDeck: passed');
