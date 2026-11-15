/**
 * Sprint 159 (PR 5): the presenting session's rules. Run with `npx tsx src/decks/present/presentSession.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { deckLookOf, frontMatterValue, PresentSession, PresentStartError, presentSlidesOf, presentTitleOf, type PresentSlide } from './presentSession';

const slide = (kind: string, lines: string[], notes?: string) =>
  ['```slide ' + kind, ...lines, '```', ...(notes ? ['', '```notes', notes, '```'] : []), '', `The handout of ${lines.find(line => line.startsWith('title:')) ?? kind}.`, ''].join('\n');

const FRONT = '---\ndeck: 1\nlook: borderless\nritemark-length: 45\n---\n\nThe preamble.\n\n';
const A = slide('title', ['id: a1', 'title: Leading through change'], 'Welcome everyone.');
const B = slide('points', ['id: b2', 'title: Why this module', 'items:', '- heading: One']);
const C = slide('points', ['id: c3', 'title: The skipped one', 'skip: true']);
const D = slide('statement', ['id: d4', 'title: The warehouse merger case']);
const E = slide('section', ['title: No id here', 'number: "2"']);
const deck = (...parts: string[]) => FRONT + parts.join('\n');
const TEXT = deck(A, B, C, D, E);

const numbers = (session: PresentSession) => {
  const view = session.view();
  return { at: view.current.index + 1, position: view.position, count: view.count };
};
const titleOf = (session: PresentSession) => session.view().current.data.title;

// ---- the deck as presenting reads it
{
  const slides = presentSlidesOf(TEXT);
  assert.equal(slides.length, 5);
  assert.deepEqual(slides.map(entry => entry.skip), [false, false, true, false, false]);
  assert.deepEqual(slides.map(entry => entry.key.slice(0, 5)), ['id:a1', 'id:b2', 'id:c3', 'id:d4', 'body:']);
  assert.equal(slides[0].notes, 'Welcome everyone.');
  assert.equal(slides[1].notes, null);
  // Twins without ids each get their own key.
  const twins = presentSlidesOf(deck(E, E));
  assert.notEqual(twins[0].key, twins[1].key);
  assert.equal(presentTitleOf(twins[0]), 'No id here');
  assert.equal(presentTitleOf({ index: 6, data: {} } as PresentSlide), 'slide 7');
  assert.equal(deckLookOf(TEXT), 'borderless');
  assert.equal(deckLookOf(deck(A)).toString(), 'borderless', 'the front matter is the same');
  assert.equal(deckLookOf(A), 'card', 'no front matter: Card');
  assert.equal(deckLookOf('---\nlook: Borderless\n---\n'), 'card', "the deck view's exact rule: Borderless only as written");
  assert.equal(frontMatterValue(TEXT, 'ritemark-length'), '45');
  assert.equal(frontMatterValue(TEXT, 'missing'), null);
}

// ---- From the start and From this slide; n of N counts only the slides shown
{
  const session = new PresentSession(TEXT, { from: 'start' });
  assert.deepEqual(numbers(session), { at: 1, position: 1, count: 4 });
  const here = new PresentSession(TEXT, { from: 'here', index: 3 });
  assert.deepEqual(numbers(here), { at: 4, position: 3, count: 4 });
  // From this slide on a skipped slide shows it: the presenter chose it. It has no place among the slides shown.
  const skipped = new PresentSession(TEXT, { from: 'here', index: 2 });
  assert.deepEqual(numbers(skipped), { at: 3, position: null, count: 4 });
  // An index past the end starts at the first slide shown.
  assert.deepEqual(numbers(new PresentSession(TEXT, { from: 'here', index: 40 })), { at: 1, position: 1, count: 4 });
  assert.throws(() => new PresentSession(FRONT, { from: 'start' }), PresentStartError);
  assert.throws(() => new PresentSession(deck(C), { from: 'start' }), PresentStartError);
  assert.deepEqual(numbers(new PresentSession(deck(C), { from: 'here', index: 0 })), { at: 1, position: null, count: 0 });
}

// ---- Next and Back pass skipped slides; Home and End; the ends stay put
{
  const session = new PresentSession(TEXT, { from: 'start' });
  assert.equal(session.move(TEXT, { type: 'back' }), false, 'nothing before the first slide');
  assert.equal(session.move(TEXT, { type: 'next' }), true);
  assert.deepEqual(numbers(session), { at: 2, position: 2, count: 4 });
  session.move(TEXT, { type: 'next' });
  assert.deepEqual(numbers(session), { at: 4, position: 3, count: 4 }, 'slide 3 is skipped');
  session.move(TEXT, { type: 'back' });
  assert.deepEqual(numbers(session), { at: 2, position: 2, count: 4 });
  session.move(TEXT, { type: 'last' });
  assert.deepEqual(numbers(session), { at: 5, position: 4, count: 4 });
  assert.equal(session.move(TEXT, { type: 'next' }), false, 'nothing after the last slide');
  session.move(TEXT, { type: 'first' });
  assert.deepEqual(numbers(session), { at: 1, position: 1, count: 4 });
  assert.equal(session.view().next?.data.id, 'b2');
}

// ---- A number goes to its slide, a skipped one too; a number with no slide goes nowhere
{
  const session = new PresentSession(TEXT, { from: 'start' });
  assert.equal(session.move(TEXT, { type: 'go', number: 4 }), true);
  assert.equal(titleOf(session), 'The warehouse merger case');
  assert.equal(session.move(TEXT, { type: 'go', number: 3 }), true);
  assert.deepEqual(numbers(session), { at: 3, position: null, count: 4 });
  session.move(TEXT, { type: 'next' });
  assert.equal(titleOf(session), 'The warehouse merger case', 'Next from a skipped slide goes on to the next one shown');
  session.move(TEXT, { type: 'go', number: 3 });
  session.move(TEXT, { type: 'back' });
  assert.equal(titleOf(session), 'Why this module');
  assert.equal(session.move(TEXT, { type: 'go', number: 9 }), false);
  assert.equal(session.move(TEXT, { type: 'go', number: 0 }), false);
  assert.equal(session.move(TEXT, { type: 'go', number: 2 }), false, 'already there');
  assert.equal(session.slideNumbered(3)?.data.title, 'The skipped one');
  assert.equal(session.slideNumbered(6), undefined);
}

// ---- Edits arrive at the next move: an insert, a skip, a deletion; the current slide is held by its id
{
  const session = new PresentSession(TEXT, { from: 'start' });
  session.move(TEXT, { type: 'next' });
  assert.equal(titleOf(session), 'Why this module');
  // A slide added after the current one in the editor: the next move shows it.
  const added = slide('points', ['id: x9', 'title: Added in the middle']);
  const withAdded = deck(A, B, added, C, D, E);
  assert.equal(session.view().count, 4, 'nothing changes before a move');
  session.move(withAdded, { type: 'next' });
  assert.equal(titleOf(session), 'Added in the middle');
  assert.deepEqual(numbers(session), { at: 3, position: 3, count: 5 });
  // A slide skipped in the editor is passed at the next move.
  const skippedD = deck(A, B, added, C, slide('statement', ['id: d4', 'title: The warehouse merger case', 'skip: true']), E);
  session.move(skippedD, { type: 'next' });
  assert.equal(titleOf(session), 'No id here');
  assert.deepEqual(numbers(session), { at: 6, position: 4, count: 4 });
  // Slides added before the current one move its number, not the slide.
  const before = deck(slide('title', ['id: z0', 'title: A new first slide']), A, B, added, C, D, E);
  session.read(before);
  assert.equal(titleOf(session), 'No id here');
  assert.deepEqual(numbers(session), { at: 7, position: 6, count: 6 });
}

// ---- The current slide deleted: the wall keeps it until the move, then the slide that came after it
{
  const session = new PresentSession(TEXT, { from: 'here', index: 1 });
  const withoutB = deck(A, C, D, E);
  session.read(withoutB);
  assert.equal(titleOf(session), 'Why this module', 'kept until the move');
  assert.equal(session.view().position, null);
  assert.equal(session.view().next?.data.id, 'd4');
  session.move(withoutB, { type: 'next' });
  assert.equal(titleOf(session), 'The warehouse merger case', 'the slide after it (the skipped one is passed)');
  const back = new PresentSession(TEXT, { from: 'here', index: 1 });
  back.move(withoutB, { type: 'back' });
  assert.equal(titleOf(back), 'Leading through change');
  // Deleted at the end: Next goes to the last slide shown.
  const last = new PresentSession(TEXT, { from: 'here', index: 4 });
  last.move(deck(A, B, C, D), { type: 'next' });
  assert.equal(titleOf(last), 'The warehouse merger case');
}

// ---- Moved in the editor: held by id
{
  const session = new PresentSession(TEXT, { from: 'here', index: 1 });
  session.read(deck(A, C, D, E, B));
  assert.deepEqual(numbers(session), { at: 5, position: 4, count: 4 });
  assert.equal(session.move(deck(A, C, D, E, B), { type: 'next' }), false, 'it is the last now');
}

// ---- A slide without an id, changed while it is on the wall, is the same slide
{
  const session = new PresentSession(TEXT, { from: 'here', index: 4 });
  const changed = deck(A, B, C, D, slide('section', ['title: No id here, changed', 'number: "2"']));
  session.read(changed);
  assert.equal(titleOf(session), 'No id here, changed');
  assert.deepEqual(numbers(session), { at: 5, position: 4, count: 4 });
}

// ---- Stopping returns the deck view to the slide the presenter ended on
{
  const session = new PresentSession(TEXT, { from: 'start' });
  session.move(TEXT, { type: 'go', number: 4 });
  assert.equal(session.endedIndex(TEXT), 3);
  assert.equal(session.endedIndex(deck(slide('title', ['id: z0', 'title: New']), A, B, C, D, E)), 4, 'by id, not by number');
  assert.equal(session.endedIndex(deck(A, B, C, E)), 3, 'deleted: the slide that came after it');
  assert.equal(new PresentSession(TEXT, { from: 'here', index: 4 }).endedIndex(deck(A, B, C, D)), 3, 'deleted at the end: the one before it');
}

console.log('presentSession: all tests passed');
