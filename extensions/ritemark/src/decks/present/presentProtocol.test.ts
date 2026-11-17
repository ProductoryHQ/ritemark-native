/**
 * Sprint 159 (PR 5): what the wall gets, field by field, and the wall's requests decoded with exact fields. The wall is
 * the room's screen: a test word in each private place, and none of them in its state.
 * Run with `npx tsx src/decks/present/presentProtocol.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { BUILT_IN_THEME } from '../deckTheme';
import { chooseDisplays, decodeDeckPresentMenuRequest, decodeDeckPresentRequest, decodeWallRequest, frontMatterEdit, lengthMinutesOf, presenterPicturePaths, presenterStateOf, wallDataOf, wallPicturePaths, wallStateOf } from './presentProtocol';
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
  assert.deepEqual(Object.keys(state).sort(), ['assets', 'blank', 'borderless', 'count', 'position', 'presenter', 'skipped', 'slide', 'slides', 'theme', 'type']);
  assert.deepEqual(state.presenter, { available: false, on: false });
  assert.equal(state.blank, null, 'the slide, not a blank wall');
  assert.equal(wallStateOf(session.view(), look, {}, undefined, 'white').blank, 'white');
  assert.equal(wallStateOf(session.view(), look, {}, undefined, 'ground').blank, 'ground');
  assert.equal(wallStateOf(session.view(), look, {}, undefined, 'black' as never).blank, null, 'only the two blanks');
  assert.equal(state.skipped, false);
  assert.deepEqual(Object.keys(state.slide).sort(), ['data', 'kind', 'number', 'title']);
  // Sprint 161 (PR 2, decision 8): a v1 slide reaches the wall as the block slide its conversion writes.
  assert.deepEqual(state.slide, {
    number: 3,
    kind: '',
    title: 'Three reactions',
    data: { title: 'Three reactions', picture: 'right', image: 'images/shown.png', markdown: '# Three reactions\n\n:::: boxes\n::: {.box icon="warning"}\n### Pushing back\nthe plan is wrong\n:::\n::::' },
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
  assert.equal(wallStateOf(session.view(), look, {}).skipped, true);
  for (const word of ['NOTESWORD', 'SKIPPEDNOTESWORD', 'SECONDNOTESWORD']) assert.ok(!bytes.includes(word), `${word} reached the wall`);
}

// ---- The wall's requests, with exact fields
{
  for (const type of ['present/ready', 'present/presenter', 'present/swap', 'present/set-length', 'present/next', 'present/back', 'present/first', 'present/last', 'present/stop'] as const) {
    assert.deepEqual(decodeWallRequest({ type }), { type });
    assert.equal(decodeWallRequest({ type, extra: 1 }), null);
  }
  // The focus check of the path without the shell's commands is gone with that path (17 November).
  assert.equal(decodeWallRequest({ type: 'present/focus', fullScreen: false }), null);
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
  // B, "." or W blanks the wall; any key shows the slide again.
  for (const to of ['ground', 'white', null] as const) assert.deepEqual(decodeWallRequest({ type: 'present/blank', to }), { type: 'present/blank', to });
  assert.equal(decodeWallRequest({ type: 'present/blank' }), null);
  assert.equal(decodeWallRequest({ type: 'present/blank', to: 'black' }), null);
  assert.equal(decodeWallRequest({ type: 'present/blank', to: true }), null);
  assert.equal(decodeWallRequest({ type: 'present/blank', to: 'white', number: 1 }), null);
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

// ---- The presenter view: the one state with the comments ("Your comments"), and only the current slide's. Sprint 161
// (PR 2; Jarmo, 17 November): no notes field; an older slide's notes are the comment its conversion makes.
{
  const session = new PresentSession(TEXT, { from: 'start' });
  const clock = { wallDisplay: 'Projector', canSwap: true, length: 45, startedAt: 1000 };
  const first = presenterStateOf(session.view(), look, {}, clock);
  assert.deepEqual(Object.keys(first).sort(), ['assets', 'blank', 'borderless', 'canSwap', 'clock', 'comments', 'count', 'current', 'length', 'next', 'position', 'skipped', 'slides', 'startedAt', 'theme', 'type', 'wallDisplay']);
  assert.equal(first.blank, null);
  assert.deepEqual(first.clock, { locale: null, hourCycle: null }, "no system clock yet: the webview's own");
  const blanked = presenterStateOf(session.view(), look, {}, { ...clock, blank: 'ground', clock: { locale: 'et-EE', hourCycle: 'h23' } });
  assert.equal(blanked.blank, 'ground', 'the presenter view knows the wall is blank');
  assert.deepEqual(blanked.clock, { locale: 'et-EE', hourCycle: 'h23' });
  assert.deepEqual(first.comments, [{ note: 'NOTESWORD: say this only to yourself.' }]);
  assert.equal(first.next?.number, 3, 'the next slide shown (2 is skipped)');
  assert.equal(first.wallDisplay, 'Projector');
  const bytes = JSON.stringify(first);
  for (const word of ['SKIPPEDWORD', 'SKIPPEDNOTESWORD', 'SECONDNOTESWORD', 'FROMWORD', 'FRONTMATTERWORD']) assert.ok(!bytes.includes(word), `${word} reached the presenter view`);
  assert.ok(!presenterPicturePaths(session.view()).some(path => path.includes('SKIPPED')));
  session.move(TEXT, { type: 'next' });
  const second = presenterStateOf(session.view(), look, {}, clock);
  assert.deepEqual(second.comments.map(comment => comment.note), ['SECONDNOTESWORD'], 'the boxes draw its icon: nothing else is hidden');
  assert.equal(second.next, null, 'the last slide shown');
  // The wall's state for the same slide still holds no notes.
  assert.ok(!JSON.stringify(wallStateOf(session.view(), look, {}, { available: true, on: true })).includes('SECONDNOTESWORD'));
}

// ---- Which display gets what: the wall on the one that isn't built in, the presenter view on the laptop's
{
  const laptop = { name: 'Built-in Retina Display', primary: true, internal: true };
  const projector = { name: 'Projector', primary: false, internal: false };
  assert.deepEqual(chooseDisplays([laptop]), { wall: 0, presenter: 0 });
  assert.deepEqual(chooseDisplays([]), { wall: 0, presenter: 0 });
  assert.deepEqual(chooseDisplays([laptop, projector]), { wall: 1, presenter: 0 });
  assert.deepEqual(chooseDisplays([projector, laptop]), { wall: 0, presenter: 1 });
  // A closed laptop on a desk monitor (the primary) and a projector: the wall on the projector, notes on the desk.
  const desk = { name: 'Desk', primary: true, internal: false };
  assert.deepEqual(chooseDisplays([desk, projector]), { wall: 1, presenter: 0 });
  assert.deepEqual(chooseDisplays([laptop, { ...desk, primary: false }, projector]), { wall: 1, presenter: 0 }, 'the first that is neither');
  // A projector made the primary in the Mac's settings: the wall still goes to it, the notes stay on the laptop.
  assert.deepEqual(chooseDisplays([{ ...projector, primary: true }, { ...laptop, primary: false }]), { wall: 0, presenter: 1 });
}

// ---- The session's length, kept in the deck's front matter
{
  assert.equal(lengthMinutesOf('45'), 45);
  assert.equal(lengthMinutesOf(' 90 '), 90);
  for (const bad of ['0', '-5', '4.5', 'forty', '', '1441', null, undefined]) assert.equal(lengthMinutesOf(bad as string | null | undefined), null, String(bad));
  const apply = (text: string, edit: { start: number; end: number; text: string }) => text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  const deck = '---\ndeck: 1\ntheme: x.theme.md\n---\n\n```slide title\ntitle: A\n```\n';
  assert.equal(apply(deck, frontMatterEdit(deck, 'ritemark-length', '45')), '---\ndeck: 1\ntheme: x.theme.md\nritemark-length: 45\n---\n\n```slide title\ntitle: A\n```\n', 'added at the end');
  const withLength = '---\ndeck: 1\nritemark-length: 30\nlook: borderless\n---\nbody\n';
  assert.equal(apply(withLength, frontMatterEdit(withLength, 'ritemark-length', '60')), '---\ndeck: 1\nritemark-length: 60\nlook: borderless\n---\nbody\n', 'replaced in place');
  const crlf = '---\r\ndeck: 1\r\n---\r\nbody\r\n';
  assert.equal(apply(crlf, frontMatterEdit(crlf, 'ritemark-length', '45')), '---\r\ndeck: 1\r\nritemark-length: 45\r\n---\r\nbody\r\n', "the file's own line ends");
  const empty = '---\n---\n\n```slide title\ntitle: A\n```\n---\nmore\n';
  assert.equal(apply(empty, frontMatterEdit(empty, 'ritemark-length', '45')), '---\nritemark-length: 45\n---\n\n```slide title\ntitle: A\n```\n---\nmore\n', 'an empty front matter, not a later ---');
  const bare = '```slide title\ntitle: A\n```\n';
  assert.equal(apply(bare, frontMatterEdit(bare, 'ritemark-length', '45')), '---\nritemark-length: 45\n---\n\n```slide title\ntitle: A\n```\n', 'a front matter made for it');
}

// ---- The Present menu's requests
{
  assert.deepEqual(decodeDeckPresentMenuRequest({ type: 'deck/present-options' }), { type: 'deck/present-options' });
  assert.deepEqual(decodeDeckPresentMenuRequest({ type: 'deck/present-presenter', on: false }), { type: 'deck/present-presenter', on: false });
  assert.equal(decodeDeckPresentMenuRequest({ type: 'deck/present-options', extra: 1 }), null);
  assert.equal(decodeDeckPresentMenuRequest({ type: 'deck/present-presenter', on: 'yes' }), null);
  assert.equal(decodeDeckPresentMenuRequest({ type: 'deck/present-presenter' }), null);
}

console.log('presentProtocol: all tests passed');
