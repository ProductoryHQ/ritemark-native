/**
 * A deck's file name (Sprint 159, deck icons): the one rule Home, Search, the link list and the chat's chips share.
 *
 * Run: npx tsx src/decks/deckFileName.test.ts
 */
import assert from 'node:assert/strict';
import { DECK_EXTENSION, isDeckPath, splitFileName } from './deckFileName';

assert.equal(DECK_EXTENSION, '.deck.md');
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
