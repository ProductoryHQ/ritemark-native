/**
 * Sprint 157: the deck view's requests are decoded with exact fields. Run with `npx tsx src/decks/deckProtocol.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { decodeDeckRequest, DeckProtocolError, MAX_ASSET_PATHS } from './deckProtocol';
import { deckModeOf, isDeckPath } from './deckMode';
import { isThemePath } from './deckTheme';

assert.deepEqual(decodeDeckRequest({ type: 'deck/assets', paths: ['images/a.png'] }), { type: 'deck/assets', paths: ['images/a.png'] });
assert.throws(() => decodeDeckRequest({ type: 'deck/assets', paths: ['a.png'], extra: 1 }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/assets', paths: [1] }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/assets', paths: [''] }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/assets', paths: Array(MAX_ASSET_PATHS + 1).fill('a.png') }), DeckProtocolError);
assert.deepEqual(decodeDeckRequest({ type: 'deck/theme', path: 'Slide library/Themes/Evening.theme.md' }), { type: 'deck/theme', path: 'Slide library/Themes/Evening.theme.md' });
assert.throws(() => decodeDeckRequest({ type: 'deck/theme', path: '' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/theme', path: 'a.theme.md', more: 1 }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/unknown' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest(null), DeckProtocolError);
assert.throws(() => decodeDeckRequest([]), DeckProtocolError);

// Which files open as decks.
const deck = { flagOn: true, scheme: 'file', fsPath: '/p/Training.deck.md', text: '---\ndeck: 1\n---\n' };
assert.ok(isDeckPath('/p/a.DECK.md'));
assert.ok(!isDeckPath('/p/deck.md'));
assert.ok(deckModeOf(deck));
assert.ok(deckModeOf({ ...deck, text: '# no front matter' }));
assert.ok(!deckModeOf({ ...deck, flagOn: false }), 'flag off: a document');
assert.ok(!deckModeOf({ ...deck, scheme: 'untitled' }), 'not on disk: a document');
assert.ok(!deckModeOf({ ...deck, fsPath: '/p/Training.md' }), 'not .deck.md: a document');
assert.ok(!deckModeOf({ ...deck, text: '---\ndeck: 2\n---\n' }), 'a later format: a document');

// Which theme paths a deck may name: project-relative .theme.md files, never outside the project.
assert.ok(isThemePath('Slide library/Themes/Evening.theme.md'));
assert.ok(!isThemePath('../Themes/Evening.theme.md'));
assert.ok(!isThemePath('Slide library/../../x.theme.md'));
assert.ok(!isThemePath('/etc/x.theme.md'));
assert.ok(!isThemePath('C:/x.theme.md'));
assert.ok(!isThemePath('Slide library/Themes/Evening.md'));
assert.ok(!isThemePath(''));

console.log('deckProtocol: passed');
