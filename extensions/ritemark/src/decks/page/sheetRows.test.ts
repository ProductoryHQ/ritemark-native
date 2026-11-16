/**
 * Sprint 159 PR 4: the Publish sheet's What goes and What stays rows for a deck's page, in the brief's exact words.
 *
 * Run: npx tsx src/decks/page/sheetRows.test.ts
 */
import { strict as assert } from 'node:assert';
import { BUILT_IN_THEME } from '../deckTheme';
import { NOTHING_ELSE } from '../../../webview/src/components/publish/publishSheetCopy';
import { deckCounts, deckSheetRows } from './sheetRows';
import { PRIVATE_DECK } from './testing/privateDeck';

// The brief's own example, word for word (the sheet draws "Nothing else from the project." as its quiet line).
{
  const rows = deckSheetRows({ slides: 14, prompts: 6, comments: 9, skipped: 2 });
  assert.equal(`${rows.goes} ${NOTHING_ELSE}`, '14 slides and their handout, 6 prompts with Copy, and the pictures they use. Nothing else from the project.');
  assert.equal(rows.stays, 'On your computer: comments on 9 slides, and 2 skipped slides.');
}

// A count of one is singular.
assert.deepEqual(deckSheetRows({ slides: 1, prompts: 1, comments: 1, skipped: 1 }), {
  goes: '1 slide and its handout, 1 prompt with Copy, and the pictures it uses.',
  stays: 'On your computer: comments on 1 slide, and 1 skipped slide.',
});

// A part that is 0 is left out.
assert.equal(deckSheetRows({ slides: 14, prompts: 0, comments: 9, skipped: 2 }).goes, '14 slides and their handout, and the pictures they use.');
assert.equal(deckSheetRows({ slides: 14, prompts: 6, comments: 9, skipped: 0 }).stays, 'On your computer: comments on 9 slides.');
assert.equal(deckSheetRows({ slides: 14, prompts: 6, comments: 0, skipped: 2 }).stays, 'On your computer: 2 skipped slides.');
// Both 0.
assert.equal(deckSheetRows({ slides: 14, prompts: 6, comments: 0, skipped: 0 }).stays, 'Nothing: this deck has no comments or skipped slides.');
// A deck with no slide shown (every one skipped): what is left is the text before them.
assert.equal(deckSheetRows({ slides: 0, prompts: 0, comments: 0, skipped: 3 }).goes, 'The handout\'s text, and the pictures it uses.');

// Counted from a deck: shown slides, prompts as the page draws them (a notes fence is none), the slides with comments
// (Sprint 161, decision 8: a comment in the part or on the slide, an older slide's notes and the words its layout hid,
// which its conversion makes a comment; a skipped slide's too) and skipped slides.
assert.deepEqual(deckCounts(PRIVATE_DECK, BUILT_IN_THEME), { slides: 5, prompts: 2, comments: 5, skipped: 1 });

// A prompt inside a list item or a quote is a prompt too; a stray notes block and an empty notes block are no comments.
{
  const deck = [
    '```slide points', 'title: A', '```', '',
    '1. Step', '', '   ```', '   inside a list', '   ```', '',
    '> ```', '> in a quote', '> ```', '',
    '```notes', 'stray', '```', '',
    '```slide points', 'title: B', '```', '',
    '```notes', '   ', '```', '',
  ].join('\n');
  assert.deepEqual(deckCounts(deck, BUILT_IN_THEME), { slides: 2, prompts: 2, comments: 0, skipped: 0 });
}

console.log('sheetRows: passed');
