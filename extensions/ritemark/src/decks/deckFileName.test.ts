/**
 * A deck's file name (Sprint 159, deck icons): the one rule Home, Search, the link list and the chat's chips share.
 *
 * Run: npx tsx src/decks/deckFileName.test.ts
 */
import assert from 'node:assert/strict';
import { DECK_EXTENSION, DECK_GLOB, deckFileName, deckNameOf, isDeckPath, LEGACY_DECK_EXTENSION, splitFileName } from './deckFileName';

// Sprint 172: a new deck ends `.rtms`; one made before may end `.deck.md`, and both are decks
assert.equal(DECK_EXTENSION, '.rtms');
assert.equal(LEGACY_DECK_EXTENSION, '.deck.md');
assert.equal(DECK_GLOB, '**/*.{rtms,deck.md}');
assert.equal(deckFileName('Untitled'), 'Untitled.rtms');
assert.equal(deckFileName('Training (copy)'), 'Training (copy).rtms');
assert.deepEqual(
  ['/p/Talk.rtms', 'Slide library/TEAMS.RTMS', 'C:\\Work\\Talk.rtms', '.rtms', 'rtms', 'Talk.rtms.md', 'Talk.rtm', 'Talk.xrtms'].map(isDeckPath),
  [true, true, true, true, false, false, false, false],
);
assert.deepEqual(
  ['Talk.rtms', 'Clients/Harbour/AI assistants and agents.rtms', 'C:\\Work\\Top.RTMS', 'Old.deck.md', 'Slide library/Top.DECK.md', 'notes.md', 'report.final.rtms'].map(deckNameOf),
  ['Talk', 'AI assistants and agents', 'Top', 'Old', 'Top', 'notes.md', 'report.final'],
);
assert.deepEqual(
  ['Talk.rtms', 'Day one.RTMS', '.rtms', 'Talk.rtms.'].map(splitFileName),
  [{ name: 'Talk', extension: '.rtms' }, { name: 'Day one', extension: '.RTMS' }, { name: '.rtms', extension: '' }, { name: 'Talk.rtms.', extension: '' }],
);
assert.deepEqual(
  ['/p/Talk.deck.md', 'Slide library/TEAMS.DECK.MD', 'C:\\Work\\Talk.deck.md', 'deck.md', '.deck.md', '/p/.deck.md', 'C:\\p\\.deck.md', 'Talk.deck.markdown', 'Talk.md'].map(isDeckPath),
  // A bare `.deck.md` stays a deck, as deck mode, the library and the file icon theme have it; only its name reads as a dotfile's
  [true, true, true, false, true, true, true, false, false],
);
assert.deepEqual(
  ['Talk.deck.md', 'AI assistants and agents.DECK.MD', 'deck.md', '.deck.md', 'Talk.deck.markdown', 'report.final.md', 'README', '.gitignore', 'Deck.pptx', 'file.', 'Talk.deck.md.'].map(splitFileName),
  [
    { name: 'Talk', extension: '.deck.md' },
    { name: 'AI assistants and agents', extension: '.DECK.MD' },
    { name: 'deck', extension: '.md' },
    { name: '.deck', extension: '.md' },
    { name: 'Talk.deck', extension: '.markdown' },
    { name: 'report.final', extension: '.md' },
    { name: 'README', extension: '' },
    { name: '.gitignore', extension: '' },
    { name: 'Deck', extension: '.pptx' },
    // A trailing dot: no extension, as patch 018's ritemarkSplitExtension gives
    { name: 'file.', extension: '' },
    { name: 'Talk.deck.md.', extension: '' },
  ],
);
console.log('deckFileName: all assertions passed');
