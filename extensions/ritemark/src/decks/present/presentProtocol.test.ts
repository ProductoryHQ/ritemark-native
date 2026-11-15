/**
 * Sprint 159 (PR 5): what the wall gets, field by field, and the wall's requests decoded with exact fields. The wall is
 * the room's screen: a test word in each private place, and none of them in its state.
 * Run with `npx tsx src/decks/present/presentProtocol.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { BUILT_IN_THEME } from '../deckTheme';
import { decodeDeckPresentRequest, decodeWallRequest, wallDataOf, wallPicturePaths, wallStateOf } from './presentProtocol';
import { PresentSession } from './presentSession';

const TEXT = [
  '---',
  'deck: 1',
  'theme: Slide library/Themes/Evening.theme.md',
  'frontmatterword: FRONTMATTERWORD',
  '---',
  '',
  '```slide title',
  'id: a1',
  'title: Leading through change',
  'from: Slide library/FROMWORD.deck.md#q7 @abc123',
  'kept: true',
  'unknownkey: UNKNOWNWORD',
  '```',
  '',
  '```notes',
  'NOTESWORD: say this only to yourself.',
  '```',
  '',
  'HANDOUTWORD is for the page, not the wall.',
  '',
  '```slide picture',
  'id: b2',
  'title: The skipped one SKIPPEDWORD',
  'image: images/SKIPPEDPICTURE.png',
  'skip: true',
  '```',
  '',
  '```notes',
  'SKIPPEDNOTESWORD',
  '```',
  '',
  '```slide boxes',
  'id: c3',
  'title: Three reactions',
  'image: images/shown.png',
  'picture: right',
  'items:',
  '- heading: Pushing back',
  '  text: the plan is wrong',
  '  icon: warning',
  '  extra: ITEMEXTRAWORD',
  '```',
  '',
  '```notes',
  'SECONDNOTESWORD',
  '```',
  '',
].join('\n');

const PRIVATE = ['NOTESWORD', 'SKIPPEDWORD', 'SKIPPEDPICTURE', 'SKIPPEDNOTESWORD', 'SECONDNOTESWORD', 'FROMWORD', 'FRONTMATTERWORD', 'UNKNOWNWORD', 'ITEMEXTRAWORD', 'HANDOUTWORD'];
const look = { borderless: false, theme: BUILT_IN_THEME };

// ---- The wall's state at every slide shown holds no private word
{
  const session = new PresentSession(TEXT, { from: 'start' });
  for (let step = 0; step < 3; step++) {
    const view = session.view();
    const state = wallStateOf(view, look, { 'images/shown.png': 'https://file+.vscode-resource.vscode-cdn.net/x/images/shown.png' });
    const bytes = JSON.stringify(state);
    for (const word of PRIVATE) assert.ok(!bytes.includes(word), `${word} reached the wall at step ${step}`);
    assert.ok(!/"(id|from|kept|skip|notes)"/.test(bytes), 'no id, from, kept, skip or notes field');
    assert.ok(!wallPicturePaths(view).some(path => path.includes('SKIPPED')), 'a picture only a skipped slide uses is never asked for');
    session.move(TEXT, { type: 'next' });
  }
}

// ---- Exact fields
{
  const session = new PresentSession(TEXT, { from: 'start' });
  session.move(TEXT, { type: 'next' });
  const state = wallStateOf(session.view(), look, {});
  assert.deepEqual(Object.keys(state).sort(), ['assets', 'borderless', 'count', 'position', 'slide', 'slides', 'theme', 'type']);
  assert.deepEqual(Object.keys(state.slide).sort(), ['data', 'kind', 'number', 'title']);
  assert.deepEqual(state.slide, {
    number: 3,
    kind: 'boxes',
    title: 'Three reactions',
    data: { title: 'Three reactions', picture: 'right', image: 'images/shown.png', items: [{ heading: 'Pushing back', text: 'the plan is wrong', icon: 'warning' }] },
  });
  assert.deepEqual(state.slides.map(entry => entry.number), [1, 3], 'the shown slides, by their thumbnail numbers');
  assert.equal(state.position, 2);
  assert.equal(state.count, 2);
  assert.deepEqual(wallDataOf({ rows: [['a', 'b']], skip: true, id: 'x', from: 'y', kept: true }), { rows: [['a', 'b']] });
}

// ---- A skipped slide reaches the wall only when the presenter goes to its number; its notes never do
{
  const session = new PresentSession(TEXT, { from: 'start' });
  session.move(TEXT, { type: 'go', number: 2 });
  const bytes = JSON.stringify(wallStateOf(session.view(), look, {}));
  assert.ok(bytes.includes('SKIPPEDWORD'), 'asked for by its number, it is shown');
  assert.equal(wallStateOf(session.view(), look, {}).position, null);
  for (const word of ['NOTESWORD', 'SKIPPEDNOTESWORD', 'SECONDNOTESWORD']) assert.ok(!bytes.includes(word), `${word} reached the wall`);
}

// ---- The wall's requests, with exact fields
{
  for (const type of ['present/ready', 'present/focus', 'present/next', 'present/back', 'present/first', 'present/last', 'present/stop'] as const) {
    assert.deepEqual(decodeWallRequest({ type }), { type });
    assert.equal(decodeWallRequest({ type, extra: 1 }), null);
  }
  assert.deepEqual(decodeWallRequest({ type: 'present/go', number: 4 }), { type: 'present/go', number: 4 });
  assert.deepEqual(decodeWallRequest({ type: 'present/peek', number: 12 }), { type: 'present/peek', number: 12 });
  assert.equal(decodeWallRequest({ type: 'present/go' }), null);
  assert.equal(decodeWallRequest({ type: 'present/go', number: 0 }), null);
  assert.equal(decodeWallRequest({ type: 'present/go', number: 1.5 }), null);
  assert.equal(decodeWallRequest({ type: 'present/go', number: '4' }), null);
  assert.equal(decodeWallRequest({ type: 'present/go', number: 100_000 }), null);
  assert.equal(decodeWallRequest({ type: 'present/peek', number: 4, title: 'x' }), null);
  assert.equal(decodeWallRequest({ type: 'ritemark/pageDrawn' }), null, "the shell's page signals are not the host's");
  assert.equal(decodeWallRequest(null), null);
  assert.equal(decodeWallRequest([{ type: 'present/next' }]), null);
}

// ---- The deck view's Present
{
  assert.deepEqual(decodeDeckPresentRequest({ type: 'deck/present', from: 'here', index: 3 }), { type: 'deck/present', from: 'here', index: 3 });
  assert.deepEqual(decodeDeckPresentRequest({ type: 'deck/present', from: 'start', index: 0 }), { type: 'deck/present', from: 'start', index: 0 });
  assert.equal(decodeDeckPresentRequest({ type: 'deck/present', from: 'middle', index: 0 }), null);
  assert.equal(decodeDeckPresentRequest({ type: 'deck/present', from: 'here', index: -1 }), null);
  assert.equal(decodeDeckPresentRequest({ type: 'deck/present', from: 'here' }), null);
  assert.equal(decodeDeckPresentRequest({ type: 'deck/present', from: 'here', index: 0, presenter: true }), null);
}

console.log('presentProtocol: all tests passed');
