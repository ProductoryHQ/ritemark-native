/**
 * A deck's file name (Sprint 159, deck icons): the one rule Home, Search, the link list and the chat's chips share.
 *
 * Run: npx tsx src/decks/deckName.test.ts
 */
import assert from 'node:assert/strict';
import { DECK_EXTENSION, isDeckPath, splitFileName } from './deckName';

assert.equal(DECK_EXTENSION, '.deck.md');
assert.deepEqual(
  ['/p/Talk.deck.md', 'Slide library/TEAMS.DECK.MD', 'C:\\Work\\Talk.deck.md', 'deck.md', '.deck.md', '/p/.deck.md', 'C:\\p\\.deck.md', 'Talk.deck.markdown', 'Talk.md'].map(isDeckPath),
  [true, true, true, false, false, false, false, false, false],
);
assert.deepEqual(
  ['Talk.deck.md', 'AI assistants and agents.DECK.MD', 'deck.md', '.deck.md', 'Talk.deck.markdown', 'report.final.md', 'README', '.gitignore', 'Deck.pptx'].map(splitFileName),
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
  ],
);
console.log('deckName: all assertions passed');
