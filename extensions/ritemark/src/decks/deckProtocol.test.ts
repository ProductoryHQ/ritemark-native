/**
 * Sprint 157: the deck view's requests are decoded with exact fields. Run with `npx tsx src/decks/deckProtocol.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { decodeDeckRequest, decodeLibraryRequest, DeckProtocolError, MAX_ASSET_PATHS, MAX_DECK_SLIDES, MAX_DECK_TEXT } from './deckProtocol';
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
// Sprint 162: the Theme menu asks for the project's themes, and nothing else.
assert.deepEqual(decodeDeckRequest({ type: 'deck/themes' }), { type: 'deck/themes' });
assert.throws(() => decodeDeckRequest({ type: 'deck/themes', path: 'Slide library/Themes' }), DeckProtocolError);
// Sprint 162 PR 2: Edit <Name> names a theme file; New theme… a name, a start and "Use it in this deck".
assert.deepEqual(decodeDeckRequest({ type: 'deck/edit-theme', path: 'Slide library/Themes/Evening.theme.md' }), { type: 'deck/edit-theme', path: 'Slide library/Themes/Evening.theme.md' });
for (const path of ['../outside.theme.md', '/etc/x.theme.md', 'Slide library/Themes/Evening.md', 'file:///x.theme.md', '']) {
  assert.throws(() => decodeDeckRequest({ type: 'deck/edit-theme', path }), DeckProtocolError, path);
}
assert.deepEqual(decodeDeckRequest({ type: 'deck/new-theme', name: 'Fernhollow Bank', start: 'paper', use: true }), { type: 'deck/new-theme', name: 'Fernhollow Bank', start: 'paper', use: true });
assert.throws(() => decodeDeckRequest({ type: 'deck/new-theme', name: 'X', start: 'gamma', use: true }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/new-theme', name: 'X', start: 'copy', use: 'yes' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/new-theme', name: '', start: 'copy', use: true }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/new-theme', name: 'X', start: 'copy', use: true, text: 'x' }), DeckProtocolError);
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
// 17 November: the slide the person is on, for the AI: its place, id and title, and nothing else; its own message,
// so it never moves the library's insert point (`deck/current` keeps exactly its two fields).
assert.throws(() => decodeDeckRequest({ type: 'deck/current', index: 4, count: 13, slides: [{ index: 4 }] }), DeckProtocolError);
assert.deepEqual(
  decodeDeckRequest({ type: 'deck/current-slide', count: 13, slides: [{ index: 4, id: 'k3f9', title: 'Agenda' }] }),
  { type: 'deck/current-slide', count: 13, slides: [{ index: 4, id: 'k3f9', title: 'Agenda' }] },
);
assert.deepEqual(decodeDeckRequest({ type: 'deck/current-slide', count: 0, slides: [] }), { type: 'deck/current-slide', count: 0, slides: [] }, 'no slide');
for (const id of ['q3-results', 'intro_slide', '42', 'a.b']) {
  assert.equal((decodeDeckRequest({ type: 'deck/current-slide', count: 1, slides: [{ index: 0, id }] }) as { slides: Array<{ id?: string }> }).slides[0].id, id, 'a hand-written id');
}
assert.throws(() => decodeDeckRequest({ type: 'deck/current-slide', count: 13, slides: [{ index: 4, body: 'words' }] }), DeckProtocolError, 'a slide\'s words never travel');
assert.throws(() => decodeDeckRequest({ type: 'deck/current-slide', count: 13, slides: [{ index: 13 }] }), DeckProtocolError, 'a slide past the end');
assert.throws(() => decodeDeckRequest({ type: 'deck/current-slide', count: 13, slides: [{ index: 4, id: '../x' }] }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/current-slide', count: 13, slides: [{ index: 4, id: 'x'.repeat(65) }] }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/current-slide', count: 13, slides: [{ index: 4, title: 'x'.repeat(301) }] }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/current-slide', count: 1, slides: [{ index: 0 }, { index: 0 }] }), DeckProtocolError, 'no more slides than the deck has');
assert.throws(() => decodeDeckRequest({ type: 'deck/current-slide', count: 3, slides: [], index: 1 }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/unknown' }), DeckProtocolError);

// The Slide library place's requests.
assert.deepEqual(decodeLibraryRequest({ type: 'library/ready' }), { type: 'library/ready' });
assert.deepEqual(decodeLibraryRequest({ type: 'library/search', query: 'agents' }), { type: 'library/search', query: 'agents' });
assert.deepEqual(decodeLibraryRequest({ type: 'library/insert', path: 'Slide library/Agents.deck.md', id: 'g1' }), { type: 'library/insert', path: 'Slide library/Agents.deck.md', id: 'g1' });
assert.equal(decodeLibraryRequest({ type: 'library/insert', path: 'Slide library/Agents.deck.md', id: 'g1', extra: 1 }), null);
assert.equal(decodeLibraryRequest({ type: 'library/insert', path: 'Slide library/Agents.deck.md', id: '../g1' }), null);
assert.equal(decodeLibraryRequest({ type: 'library/open', path: '../../etc/passwd' }), null, 'only a deck is opened');
// Sprint 165 PR 2: Take section sends the section's slide ids, in order; each one a slide id, none twice, at least one.
assert.deepEqual(decodeLibraryRequest({ type: 'library/insert-section', path: 'Clients/Day 2.deck.md', ids: ['s1', 'a2', 'b3'] }), { type: 'library/insert-section', path: 'Clients/Day 2.deck.md', ids: ['s1', 'a2', 'b3'] });
assert.equal(decodeLibraryRequest({ type: 'library/insert-section', path: 'Clients/Day 2.deck.md', ids: [] }), null);
assert.equal(decodeLibraryRequest({ type: 'library/insert-section', path: 'Clients/Day 2.deck.md', ids: ['s1', 's1'] }), null);
assert.equal(decodeLibraryRequest({ type: 'library/insert-section', path: 'Clients/Day 2.deck.md', ids: ['s1', '../x'] }), null);
assert.equal(decodeLibraryRequest({ type: 'library/insert-section', path: 'Clients/Day 2.deck.md', ids: 's1' }), null);
assert.equal(decodeLibraryRequest({ type: 'library/insert-section', path: 'notes.md', ids: ['s1'] }), null);
assert.equal(decodeLibraryRequest({ type: 'library/insert-section', path: 'Clients/Day 2.deck.md', ids: Array.from({ length: 201 }, (_, i) => `i${i}`) }), null);
assert.equal(decodeLibraryRequest({ type: 'library/insert-section', path: 'Clients/Day 2.deck.md', ids: ['s1'], after: 3 }), null);
assert.equal(decodeLibraryRequest({ type: 'library/search', query: 'x'.repeat(201) }), null);
assert.equal(decodeLibraryRequest({ type: 'library/ready', more: true }), null);
assert.equal(decodeLibraryRequest('library/ready'), null);
// Sprint 165 PR 4: the offer's Add all / Choose…, Not now and the notice's Undo, with exact fields.
const offered = [{ path: 'Clients/Day 2.deck.md', id: 'p1aa' }, { path: 'Trainings/Talk.deck.md', id: 'q2bb' }];
assert.deepEqual(decodeLibraryRequest({ type: 'library/offer-add', slides: offered }), { type: 'library/offer-add', slides: offered });
assert.deepEqual(decodeLibraryRequest({ type: 'library/offer-not-now', slides: offered }), { type: 'library/offer-not-now', slides: offered });
assert.equal(decodeLibraryRequest({ type: 'library/offer-add', slides: [] }), null, 'nothing to add');
assert.equal(decodeLibraryRequest({ type: 'library/offer-add', slides: [offered[0], offered[0]] }), null, 'a slide twice');
assert.equal(decodeLibraryRequest({ type: 'library/offer-add', slides: Array.from({ length: 7 }, (_, i) => ({ path: 'A.deck.md', id: `a${i}` })) }), null, 'at most six');
assert.equal(decodeLibraryRequest({ type: 'library/offer-add', slides: [{ path: 'notes.md', id: 'p1aa' }] }), null, 'only a deck');
assert.equal(decodeLibraryRequest({ type: 'library/offer-add', slides: [{ path: 'A.deck.md', id: '../x' }] }), null);
assert.equal(decodeLibraryRequest({ type: 'library/offer-add', slides: [{ path: 'A.deck.md', id: 'p1aa', topic: 'Other' }] }), null, 'no extra field in a slide');
assert.equal(decodeLibraryRequest({ type: 'library/offer-add', slides: offered, topic: 'Other' }), null, 'the topic is the host\'s');
assert.equal(decodeLibraryRequest({ type: 'library/offer-not-now', slides: 'p1aa' }), null);
assert.deepEqual(decodeLibraryRequest({ type: 'library/undo', token: 'w1a2b3' }), { type: 'library/undo', token: 'w1a2b3' });
assert.equal(decodeLibraryRequest({ type: 'library/undo', token: '' }), null);
assert.equal(decodeLibraryRequest({ type: 'library/undo', token: 'w1', extra: 1 }), null);
assert.equal(decodeLibraryRequest({ type: 'library/undo', token: 'x'.repeat(65) }), null);
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
assert.ok(!deckModeOf({ ...deck, text: '---\ndeck: 3\n---\n' }), 'a later format: a document');
assert.ok(deckModeOf({ ...deck, text: '---\ndeck: 2\n---\n' }), 'Sprint 161: format 2 (block slides) is a deck');

// Sprint 159 (PR 2): a view keeps the flag it opened with (recorded as it opens, as ritemarkEditor.ts does); the flag
// turned on or off meanwhile reaches only views opened afterwards: the flag never turns a document view into a deck
// view, nor a deck view into a document. The file is read live, as DeckPages.deckModeFor(document, flag) reads it: a deck
// rewritten to a later format shows as a document rather than be rewritten, and as a deck again once it reads.
{
  const flags = new ModeFixedPerView<object>();
  let flagOn = false;
  const mode = (view: object, text = deck.text, fsPath = deck.fsPath) => deckModeOf({ scheme: deck.scheme, fsPath, text, flagOn: flags.of(view, () => flagOn) });
  const openedOff = {};
  const openedOn = {};
  const first = mode(openedOff);
  flagOn = true;
  const afterOn = [mode(openedOff), mode(openedOn)];
  flagOn = false;
  const afterOff = [mode(openedOff), mode(openedOn), mode({})];
  const laterFormat = [mode(openedOn, '---\ndeck: 3\n---\n'), mode(openedOn, '---\ndeck: 1\n---\n')];
  const flagOffLaterFormatBack = [mode(openedOff, '---\ndeck: 3\n---\n'), mode(openedOff, '---\ndeck: 1\n---\n')];
  const notADeck = mode(openedOn, deck.text, '/p/Training.md');
  assert.deepEqual({ first, afterOn, afterOff, laterFormat, flagOffLaterFormatBack, notADeck }, {
    first: false,
    afterOn: [false, true],
    afterOff: [false, true, false],
    laterFormat: [false, true],
    flagOffLaterFormatBack: [false, false],
    notADeck: false,
  });
}

// Which theme paths a deck may name: project-relative .theme.md files, never outside the project.
assert.ok(isThemePath('Slide library/Themes/Evening.theme.md'));
assert.ok(!isThemePath('../Themes/Evening.theme.md'));
assert.ok(!isThemePath('Slide library/../../x.theme.md'));
assert.ok(!isThemePath('/etc/x.theme.md'));
assert.ok(!isThemePath('C:/x.theme.md'));
assert.ok(!isThemePath('Slide library/Themes/Evening.md'));
assert.ok(!isThemePath(''));

// Sprint 159 PR 4: Publish on the bar. The steps are numbers 0 to 5 (a block slide's six, Sprint 161), one per slide; the actions are three; exact fields.
assert.deepEqual(decodeDeckRequest({ type: 'deck/page-state' }), { type: 'deck/page-state' });
assert.throws(() => decodeDeckRequest({ type: 'deck/page-state', path: '/etc/passwd' }), DeckProtocolError);
// The view sends its text and its look (the document may not have its newest words or look yet), never a page or a path.
const body = '```slide title\ntitle: A\n```\n';
assert.deepEqual(decodeDeckRequest({ type: 'deck/publish', text: body, look: 'card', steps: [0, 1, 3] }), { type: 'deck/publish', text: body, look: 'card', steps: [0, 1, 3] });
assert.deepEqual(decodeDeckRequest({ type: 'deck/publish', text: '', look: 'borderless', steps: [] }), { type: 'deck/publish', text: '', look: 'borderless', steps: [] });
// A long deck is fine (more than 500 slides); a list past MAX_DECK_SLIDES is not.
assert.equal((decodeDeckRequest({ type: 'deck/publish', text: body, look: 'card', steps: Array.from({ length: 501 }, () => 0) }) as { steps: number[] }).steps.length, 501);
assert.deepEqual((decodeDeckRequest({ type: 'deck/publish', text: body, look: 'card', steps: [5] }) as { steps: number[] }).steps, [5]);
for (const steps of [[6], [-1], [1.5], ['1'], [null], 'all', Array.from({ length: MAX_DECK_SLIDES + 1 }, () => 0)]) {
  assert.throws(() => decodeDeckRequest({ type: 'deck/publish', text: body, look: 'card', steps }), DeckProtocolError, JSON.stringify(steps).slice(0, 40));
}
assert.throws(() => decodeDeckRequest({ type: 'deck/publish', look: 'card', steps: [0] }), DeckProtocolError, 'the text is needed');
assert.throws(() => decodeDeckRequest({ type: 'deck/publish', text: 7, look: 'card', steps: [0] }), DeckProtocolError, 'the text is words');
assert.throws(() => decodeDeckRequest({ type: 'deck/publish', text: 'x'.repeat(MAX_DECK_TEXT + 1), look: 'card', steps: [0] }), DeckProtocolError, 'a short text');
for (const look of [undefined, 'Borderless', 'steps', true, null]) {
  assert.throws(() => decodeDeckRequest({ type: 'deck/publish', text: body, ...(look === undefined ? {} : { look }), steps: [0] }), DeckProtocolError, `look ${String(look)}`);
}
assert.throws(() => decodeDeckRequest({ type: 'deck/publish', text: body, look: 'card', steps: [0], pagePath: '/x.html' }), DeckProtocolError, 'no page path from the view');
assert.throws(() => decodeDeckRequest({ type: 'deck/publish', text: body, look: 'card', steps: [0], html: '<p>' }), DeckProtocolError, 'no page from the view');
for (const action of ['copy-link', 'see-online', 'unpublish'] as const) {
  assert.deepEqual(decodeDeckRequest({ type: 'deck/page-action', action }), { type: 'deck/page-action', action });
}
assert.throws(() => decodeDeckRequest({ type: 'deck/page-action', action: 'open-url' }), DeckProtocolError);
assert.throws(() => decodeDeckRequest({ type: 'deck/page-action', action: 'see-online', url: 'https://evil.example' }), DeckProtocolError);

console.log('deckProtocol: passed');
