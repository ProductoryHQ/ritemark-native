/**
 * Sprint 157: the deck view's requests are decoded with exact fields. Run with `npx tsx src/decks/deckProtocol.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { decodeDeckRequest, decodeLibraryRequest, DeckProtocolError, MAX_ASSET_PATHS } from './deckProtocol';
import { deckModeOf, isDeckPath, ModeFixedPerView } from './deckMode';
import { isThemePath } from './deckTheme';

assert.deepEqual(decodeDeckRequest({ type: 'deck/assets', paths: ['images/a.png'] }), { type: 'deck/assets', paths: ['images/a.png'] });
assert.throws(() => decodeDeckRequest({ type: 'deck/assets', paths: ['a.png'], extra: 1 }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/assets', paths: [1] }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/assets', paths: [''] }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/assets', paths: Array(MAX_ASSET_PATHS + 1).fill('a.png') }), DeckProtocolError);
assert.deepEqual(decodeDeckRequest({ type: 'deck/theme', path: 'Slide library/Themes/Evening.theme.md' }), { type: 'deck/theme', path: 'Slide library/Themes/Evening.theme.md' });
assert.throws(() => decodeDeckRequest({ type: 'deck/theme', path: '' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/theme', path: 'a.theme.md', more: 1 }), DeckProtocolError);
assert.deepEqual(decodeDeckRequest({ type: 'deck/save-image', slideId: 'ab12', dataUrl: 'data:image/png;base64,AAA=', filename: 'shot.png' }), { type: 'deck/save-image', slideId: 'ab12', dataUrl: 'data:image/png;base64,AAA=', filename: 'shot.png' });
assert.throws(() => decodeDeckRequest({ type: 'deck/save-image', slideId: '../x', dataUrl: 'data:image/png;base64,AAA=', filename: 'a.png' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/save-image', slideId: 'ab12', dataUrl: 'data:text/html,<b>', filename: 'a.png' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/save-image', slideId: 'ab12', dataUrl: 'data:image/png;base64,AAA=', filename: '' }), DeckProtocolError);
assert.deepEqual(decodeDeckRequest({ type: 'deck/update-library', id: 'a1b2', text: '' }), { type: 'deck/update-library', id: 'a1b2', text: '' });
assert.throws(() => decodeDeckRequest({ type: 'deck/update-library', id: 'a1b2' }), DeckProtocolError, 'the deck text is required');
assert.deepEqual(decodeDeckRequest({ type: 'deck/source-states' }), { type: 'deck/source-states' });
assert.throws(() => decodeDeckRequest({ type: 'deck/source-states', copies: [] }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/update-library', id: 'a1b2', text: '', extra: 1 }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/use-library', id: '../x', text: '' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/add-to-library', id: '', text: '' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/add-to-library', id: 'a1', text: 5 }), DeckProtocolError);
assert.deepEqual(decodeDeckRequest({ type: 'deck/show-in-library', from: 'Slide library/A.deck.md#x1 @abc123' }).type, 'deck/show-in-library');
assert.deepEqual(decodeDeckRequest({ type: 'deck/undo-library', token: 'w1' }), { type: 'deck/undo-library', token: 'w1' });
assert.deepEqual(decodeDeckRequest({ type: 'deck/applied', requestId: 'r1', ok: true }), { type: 'deck/applied', requestId: 'r1', ok: true });
assert.deepEqual(decodeDeckRequest({ type: 'deck/open-library', section: 'other', after: -1 }), { type: 'deck/open-library', section: 'other', after: -1 });
assert.deepEqual(decodeDeckRequest({ type: 'deck/add-to-library', id: 'a1', text: '', topic: 'Openings' }), { type: 'deck/add-to-library', id: 'a1', text: '', topic: 'Openings' });
assert.throws(() => decodeDeckRequest({ type: 'deck/add-to-library', id: 'a1', text: '', topic: '' }), DeckProtocolError);
// A topic's path may be as long as any path (Codex on #727): a long one is accepted.
const longTopic = 'Slide library/' + 'x'.repeat(260) + '.deck.md'
assert.equal((decodeDeckRequest({ type: 'deck/add-to-library', id: 'a1', text: '', topic: longTopic }) as { topic?: string }).topic, longTopic);
assert.deepEqual(decodeDeckRequest({ type: 'deck/library-topics' }), { type: 'deck/library-topics' });
assert.throws(() => decodeDeckRequest({ type: 'deck/open-library', section: 'all', after: 0 }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/open-library', section: 'topics', after: -2 }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/applied', requestId: 'r1', ok: 'yes' }), DeckProtocolError);
assert.deepEqual(decodeDeckRequest({ type: 'deck/current', index: 2, count: 9 }), { type: 'deck/current', index: 2, count: 9 });
assert.throws(() => decodeDeckRequest({ type: 'deck/current', index: -1, count: 9 }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/unknown' }), DeckProtocolError);

// The Slide library place's requests.
assert.deepEqual(decodeLibraryRequest({ type: 'library/ready' }), { type: 'library/ready' });
assert.deepEqual(decodeLibraryRequest({ type: 'library/search', query: 'agents' }), { type: 'library/search', query: 'agents' });
assert.deepEqual(decodeLibraryRequest({ type: 'library/insert', path: 'Slide library/Agents.deck.md', id: 'g1' }), { type: 'library/insert', path: 'Slide library/Agents.deck.md', id: 'g1' });
assert.equal(decodeLibraryRequest({ type: 'library/insert', path: 'Slide library/Agents.deck.md', id: 'g1', extra: 1 }), null);
assert.equal(decodeLibraryRequest({ type: 'library/insert', path: 'Slide library/Agents.deck.md', id: '../g1' }), null);
assert.equal(decodeLibraryRequest({ type: 'library/open', path: '../../etc/passwd' }), null, 'only a deck is opened');
assert.equal(decodeLibraryRequest({ type: 'library/search', query: 'x'.repeat(201) }), null);
assert.equal(decodeLibraryRequest({ type: 'library/ready', more: true }), null);
assert.equal(decodeLibraryRequest('library/ready'), null);
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

// Sprint 159 (PR 2): a view keeps the mode it opened in; the flag turned on or off meanwhile reaches only views opened
// afterwards (a document view never turns into a deck view no deck page serves, nor a deck view into a document).
{
  const modes = new ModeFixedPerView<object>();
  let flagOn = false;
  const decide = () => deckModeOf({ ...deck, flagOn });
  const openedOff = {};
  const openedOn = {};
  const first = modes.of(openedOff, decide);
  flagOn = true;
  const afterOn = [modes.of(openedOff, decide), modes.of(openedOn, decide)];
  flagOn = false;
  const afterOff = [modes.of(openedOff, decide), modes.of(openedOn, decide), modes.of({}, decide)];
  assert.deepEqual({ first, afterOn, afterOff }, { first: false, afterOn: [false, true], afterOff: [false, true, false] });
}

// Which theme paths a deck may name: project-relative .theme.md files, never outside the project.
assert.ok(isThemePath('Slide library/Themes/Evening.theme.md'));
assert.ok(!isThemePath('../Themes/Evening.theme.md'));
assert.ok(!isThemePath('Slide library/../../x.theme.md'));
assert.ok(!isThemePath('/etc/x.theme.md'));
assert.ok(!isThemePath('C:/x.theme.md'));
assert.ok(!isThemePath('Slide library/Themes/Evening.md'));
assert.ok(!isThemePath(''));

console.log('deckProtocol: passed');
