/**
 * Sprint 165 PR 4 (#834): the Slide library's offer of the slides in most decks (rule F4 on rule G's grouping), its Not
 * now, and Add all / Choose… into the topic Every training with one Undo. Synthetic decks only, made with the app's own
 * copy paths (New → Deck's copy, the library's insert, a slide typed again by hand), in the research's two shapes.
 * Run with `npx tsx src/decks/libraryOffer.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { isTextHandout, parseFrom, slideDataOf } from './deckFormat';
import { slidesOfText } from './deckLibraryFormat';
import { BUILT_IN_THEME_PATH } from './deckTheme';
import { DeckLibrary, LIBRARY_FOLDER, type DeckFiles } from './DeckLibrary';
import { DeckIndex } from './librarySearch';
import {
  EVERY_TRAINING, MAX_OFFER, NO_NOT_NOW, NOT_NOW_PATH, hideFromOffer, notNowSlides, notNowText, offerOf, parseNotNow, projectOffer, readNotNow,
  type LibraryOffer,
} from './libraryOffer';
import { copiedDeckText } from './newDeck';
import { isDeckPath } from './deckFileName';

/**
 * An in-memory project whose files' times the test sets. `remove` as the Trash does; a folder is there while a file is
 * in it, or while `emptyFolders` names it (a folder the person made and left empty).
 */
function project(files: Record<string, string>, times: Record<string, number>, emptyFolders = new Set<string>()) {
  let clock = Date.parse('2026-11-19T12:00');
  const holds = (folder: string) => Object.keys(files).some(path => path.startsWith(`${folder}/`));
  const deckFiles: DeckFiles = {
    async folderExists(folder) { return emptyFolders.has(folder) || holds(folder); },
    async removeEmptyFolder(folder) {
      if (holds(folder)) throw new Error('not empty');
      emptyFolders.delete(folder);
    },
    async list() { return Object.keys(files).filter(path => isDeckPath(path)).map(path => ({ path, modified: times[path] ?? 1 })); },
    async read(path) { return files[path] ?? null; },
    async write(path, text, options) {
      if (options?.create && path in files) throw new Error('exists');
      files[path] = text;
      times[path] = clock++;
    },
    async remove(path) { delete files[path]; delete times[path]; },
  };
  return deckFiles;
}

/** A block slide; one holding a code block opens and closes with four backticks, as the deck writes it. */
const slide = (id: string, markdown: string, handout = '') => {
  const fence = markdown.includes('```') ? '````' : '```';
  return [`${fence}slide`, '---', `id: ${id}`, '---', markdown, fence, '', handout, ''].join('\n');
};
const deck = (...slides: string[]) => ['---', 'deck: 2', '---', '', ...slides].join('\n');
const day = (text: string) => Date.parse(`${text}T10:00`);
const folder = (path: string) => path.slice(0, path.lastIndexOf('/'));
/** A slide's id in a deck by its title's words. */
const idOf = (text: string, title: string) => slidesOfText(text).find(entry => (entry.data.markdown ?? '').startsWith(`# ${title}`))!.data.id!;

// The slides every training has. The prompt board holds a prompt to copy and a handout, which a copy keeps.
const PLAN = "# Today's plan\n\n- Morning: the basics\n- Afternoon: your own case";
const BOARD = '# Shared prompt board\n\n```\nSummarise [the document] in five lines\n```';
const BOARD_HANDOUT = 'Everyone adds one prompt to the board.';
const EXERCISE = '# Exercise: steps and prompts\n\n::: steps\n1. Open your folder\n2. Ask the agent for a plan\n:::';
const QUESTIONS = '# Questions and next steps\n\n- What will you try on Monday?';
const THANKS = '# Thank you\n\nSee you next time';

/** A course's own slides: ids and words of its own, so no two courses share one. */
function own(course: string, count: number, start = 0): string[] {
  const code = [...course].reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) % 46_000, 7);
  return Array.from({ length: count }, (_, n) => slide(`o${(code * 100 + n + start).toString(36)}`, `# ${course} module ${n + start}\n\n- ${course} idea ${n + start} first\n- ${course} idea ${n + start} second`));
}

/** One more slide of the course's own, put in a copy. */
function withOwn(text: string, course: string, n: number): string {
  return `${text.replace(/\s+$/, '')}\n\n${own(course, 1, n)[0]}`;
}

async function offerNow(files: DeckFiles, active?: string): Promise<{ offer: LibraryOffer; titles: string[] }> {
  const index = new DeckIndex(files);
  const decks = await index.decks();
  const offer = offerOf(decks, index.same(), (await readNotNow(files)) ?? NO_NOT_NOW, { active });
  return { offer, titles: offer.slides.map(entry => entry.title) };
}

/**
 * The balanced shape: five families. Northwind is one course copied three times, Contoso another copied twice,
 * Fernhollow one copied once, and two talks on their own. The slides every training has came in by every path the
 * app has: kept in a copied deck, inserted from another deck (a `from:` line), or typed again word for word.
 */
async function balanced() {
  const files: Record<string, string> = {};
  const times: Record<string, number> = {};
  const deckFiles = project(files, times);
  const library = new DeckLibrary(deckFiles);
  const put = (path: string, text: string, when: string) => { files[path] = text; times[path] = day(when); };
  const N = (n: number) => `Clients/Northwind/Agents at work ${n}.deck.md`;
  const C = (n: number) => `Clients/Contoso/Prompting ${n}.deck.md`;
  const F = (n: number) => `Clients/Fernhollow/Team leads ${n}.deck.md`;
  const KICKOFF = 'Talks/Kickoff.deck.md';
  const KEYNOTE = 'Talks/Keynote.deck.md';

  put(N(1), deck(slide('nt01', '# Agents at work\n\nFor Northwind'), ...own('Northwind', 6), slide('np01', PLAN), slide('nb01', BOARD, BOARD_HANDOUT), slide('ne01', EXERCISE), slide('nq01', QUESTIONS), slide('nk01', THANKS)), '2026-09-01');
  // New → Deck, "copy an earlier deck": every slide kept as written, then a word changed and a slide of its own added.
  put(N(2), withOwn(copiedDeckText(files[N(1)], folder(N(1)), folder(N(2))).replace('Northwind idea 1 first', 'Northwind idea 1 first, again'), 'Northwind', 10), '2026-09-02');
  put(N(3), withOwn(copiedDeckText(files[N(2)], folder(N(2)), folder(N(3))), 'Northwind', 11), '2026-09-03');
  put(N(4), withOwn(copiedDeckText(files[N(3)], folder(N(3)), folder(N(4))), 'Northwind', 12), '2026-09-04');

  // Contoso: a course of its own; the slides every training has inserted from a Northwind deck, the thanks typed again.
  put(C(1), deck(slide('ct01', '# Prompting basics\n\nFor Contoso'), ...own('Contoso', 6)), '2026-10-01');
  await library.insertCopies(N(1), ['np01', 'nb01', 'ne01', 'nq01'], C(1), undefined);
  files[C(1)] = `${files[C(1)].replace(/\s+$/, '')}\n\n${slide('ck01', THANKS)}`;
  times[C(1)] = day('2026-10-01');
  put(C(2), withOwn(copiedDeckText(files[C(1)], folder(C(1)), folder(C(2))), 'Contoso', 10), '2026-10-02');
  put(C(3), withOwn(copiedDeckText(files[C(2)], folder(C(2)), folder(C(3))), 'Contoso', 11), '2026-10-03');

  // Fernhollow: the plan from a Contoso deck (a from: chain), the board typed again word for word, the questions from
  // a Northwind copy.
  put(F(1), deck(slide('ft01', '# AI assistants for team leads\n\nFor Fernhollow'), ...own('Fernhollow', 6), slide('fb01', BOARD, BOARD_HANDOUT), slide('fk01', THANKS)), '2026-10-20');
  await library.insertCopies(C(1), [idOf(files[C(1)], "Today's plan")], F(1), 1);
  await library.insertCopies(N(2), ['nq01'], F(1), undefined);
  times[F(1)] = day('2026-10-20');
  put(F(2), withOwn(copiedDeckText(files[F(1)], folder(F(1)), folder(F(2))), 'Fernhollow', 10), '2026-10-21');

  // Two talks on their own.
  put(KICKOFF, deck(slide('kt01', '# Kickoff\n\nA talk'), ...own('Kickoff', 5)), '2026-11-05');
  await library.insertCopies(F(1), [idOf(files[F(1)], "Today's plan")], KICKOFF, undefined);
  await library.insertCopies(C(2), [idOf(files[C(2)], 'Exercise')], KICKOFF, undefined);
  times[KICKOFF] = day('2026-11-05');
  put(KEYNOTE, deck(slide('yt01', '# Keynote\n\nA talk'), ...own('Keynote', 5), slide('yq01', QUESTIONS), slide('yk01', THANKS)), '2026-11-12');

  return { files, times, deckFiles, library, N, C, F, KICKOFF, KEYNOTE };
}

async function run() {
  // ---- Balanced: the five slides every training has, in the most families first; no course's own slide.
  {
    const { deckFiles, KEYNOTE, KICKOFF } = await balanced();
    const { offer, titles } = await offerNow(deckFiles);
    assert.equal(offer.families, 5, 'Northwind, Contoso, Fernhollow and two talks');
    assert.deepEqual(titles, ['Questions and next steps', 'Thank you', "Today's plan", 'Shared prompt board', 'Exercise: steps and prompts']);
    assert.deepEqual(offer.slides.map(entry => [entry.families, entry.decks]), [[4, 10], [4, 10], [4, 10], [3, 9], [3, 8]]);
    // Each at its newest copy: the Keynote's questions and thanks, the Kickoff's plan, a Fernhollow board.
    assert.deepEqual(offer.slides.slice(0, 3).map(entry => entry.path), [KEYNOTE, KEYNOTE, KICKOFF]);
    assert.equal(offer.slides[3].path, 'Clients/Fernhollow/Team leads 2.deck.md');
    assert.ok(offer.slides.every(entry => /^[0-9a-z]+$/.test(entry.id)));
  }

  // ---- Dominant: one course copied twelve times fills most decks, yet only the slides in three families or more are
  // offered. Counting decks would offer the course's own slides (in 12 of 18 decks).
  {
    const files: Record<string, string> = {};
    const times: Record<string, number> = {};
    const deckFiles = project(files, times);
    const library = new DeckLibrary(deckFiles);
    const L = (n: number) => `Clients/Northwind/Leadership ${n}.deck.md`;
    files[L(1)] = deck(...own('Leadership', 9), slide('lp01', PLAN), slide('lb01', BOARD), slide('lq01', QUESTIONS));
    times[L(1)] = day('2026-06-01');
    for (let n = 2; n <= 12; n++) {
      files[L(n)] = withOwn(copiedDeckText(files[L(n - 1)], folder(L(n - 1)), folder(L(n))), 'Leadership', 20 + n);
      times[L(n)] = day(`2026-06-${String(n).padStart(2, '0')}`);
    }
    const S = (n: number) => `Clients/Contoso/Sales ${n}.deck.md`;
    files[S(1)] = deck(...own('Sales', 7), slide('sq01', QUESTIONS));
    await library.insertCopies(L(1), ['lp01'], S(1), 0);
    await library.insertCopies(L(3), ['lb01'], S(1), undefined);
    for (let n = 2; n <= 3; n++) files[S(n)] = withOwn(copiedDeckText(files[S(n - 1)], folder(S(n - 1)), folder(S(n))), 'Sales', 20 + n);
    for (let n = 1; n <= 3; n++) times[S(n)] = day(`2026-07-0${n}`);
    files['Talks/One.deck.md'] = deck(...own('One', 5));
    await library.insertCopies(S(1), [idOf(files[S(1)], "Today's plan")], 'Talks/One.deck.md', undefined);
    files['Talks/Two.deck.md'] = deck(...own('Two', 5), slide('tp01', PLAN));
    await library.insertCopies(S(2), [idOf(files[S(2)], 'Shared prompt board')], 'Talks/Two.deck.md', undefined);
    files['Talks/Three.deck.md'] = deck(...own('Three', 5));
    await library.insertCopies(L(5), ['lq01'], 'Talks/Three.deck.md', undefined);
    times['Talks/One.deck.md'] = day('2026-08-01');
    times['Talks/Two.deck.md'] = day('2026-08-02');
    times['Talks/Three.deck.md'] = day('2026-08-03');

    const { offer, titles } = await offerNow(deckFiles);
    assert.equal(offer.families, 5, 'the twelve copies are one family');
    assert.deepEqual(titles, ["Today's plan", 'Questions and next steps', 'Shared prompt board']);
    assert.deepEqual(offer.slides.map(entry => [entry.families, entry.decks]), [[4, 17], [3, 16], [3, 16]]);
    assert.ok(!titles.some(title => title.startsWith('Leadership')), 'the course\'s own slides, in 12 of 18 decks, are no offer');
  }

  // ---- A deck copied into another client's folder (the Experience lead's case): it is one family with its source, so
  // the offer is the same slides; the copy counts as one more deck.
  {
    const { files, times, deckFiles, C } = await balanced();
    const before = await offerNow(deckFiles);
    files['Clients/Globex/Prompting.deck.md'] = copiedDeckText(files[C(3)], folder(C(3)), 'Clients/Globex');
    times['Clients/Globex/Prompting.deck.md'] = day('2026-11-15');
    const after = await offerNow(deckFiles);
    assert.equal(after.offer.families, 5, 'no new family');
    assert.deepEqual([...after.titles].sort(), [...before.titles].sort());
    for (const entry of after.offer.slides) {
      const was = before.offer.slides.find(old => old.title === entry.title)!;
      assert.equal(entry.families, was.families, entry.title);
      assert.equal(entry.decks, was.decks + 1, `${entry.title}: the copy counts as a deck`);
      // The newest copy is now the Globex deck's.
      assert.equal(entry.path, 'Clients/Globex/Prompting.deck.md', entry.title);
    }
  }

  // ---- The order (most families, then most decks, then the newest) and the cap of six.
  {
    const files: Record<string, string> = {};
    const times: Record<string, number> = {};
    const deckFiles = project(files, times);
    // Nine decks on their own; slide R<k> typed again in the first `count` of them (the same words, a new id each).
    const counts = [5, 9, 6, 8, 3, 7, 4, 3, 2];
    for (let d = 0; d < 9; d++) {
      const shared = counts.flatMap((count, k) => (d < count ? [slide(`r${k}d${d}`, `# Recurring ${k}\n\nThe same words ${k}`)] : []));
      files[`Talks/Talk ${d}.deck.md`] = deck(...own(`Talk${d}`, 12), ...shared);
      times[`Talks/Talk ${d}.deck.md`] = day(`2026-09-1${d}`);
    }
    const { offer, titles } = await offerNow(deckFiles);
    assert.equal(offer.families, 9);
    assert.equal(offer.slides.length, MAX_OFFER);
    assert.deepEqual(titles, ['Recurring 1', 'Recurring 3', 'Recurring 5', 'Recurring 2', 'Recurring 0', 'Recurring 6']);
    // Two slides in three families each (the line is a third of nine, so three) are left out by the cap; the one in
    // two families never counts.
    assert.ok(!titles.includes('Recurring 8'));
  }

  // ---- Fewer than three families: no offer, however often a slide repeats.
  {
    const files: Record<string, string> = {};
    const times: Record<string, number> = {};
    const deckFiles = project(files, times);
    files['A/Course 1.deck.md'] = deck(...own('Alpha', 8), slide('ap01', PLAN), slide('aq01', QUESTIONS));
    for (let n = 2; n <= 5; n++) files[`A/Course ${n}.deck.md`] = withOwn(files['A/Course 1.deck.md'], 'Alpha', 20 + n);
    files['B/Course 1.deck.md'] = deck(...own('Beta', 8), slide('bp01', PLAN), slide('bq01', QUESTIONS));
    const { offer } = await offerNow(deckFiles);
    assert.deepEqual(offer, { slides: [], families: 2, withheld: 0 });
    // A third family brings it.
    files['C/Talk.deck.md'] = deck(...own('Gamma', 5), slide('gp01', PLAN));
    const third = await offerNow(deckFiles);
    assert.deepEqual(third.titles, ["Today's plan"]);
  }

  // ---- Add all: the topic Every training (a new topic is a `.rtms`, Sprint 172), made with copies the way the library's insert makes them, the decks never
  // written; one Undo takes the topic (and the theme file made for it) away again.
  {
    const { files, deckFiles, library } = await balanced();
    const decksBefore = Object.fromEntries(Object.entries(files));
    const { offer } = await offerNow(deckFiles);
    const write = await library.addCopiesToTopic(offer.slides.map(entry => ({ path: entry.path, id: entry.id })), EVERY_TRAINING);
    const topic = `${LIBRARY_FOLDER}/${EVERY_TRAINING}.rtms`;
    assert.equal(write.path, topic);
    assert.equal(write.previous, null, 'made');
    assert.equal(write.count, 5);
    assert.deepEqual(write.made.map(file => file.path), [BUILT_IN_THEME_PATH]);
    assert.deepEqual(write.madeFolders, ['Slide library/Themes', 'Slide library'], 'the folders it made, the deepest first');
    const text = files[topic];
    assert.ok(text.startsWith(`---\ndeck: 2\ntheme: ${BUILT_IN_THEME_PATH}\nhandout: text\n---\n\n`), text.slice(0, 120));
    assert.ok(isTextHandout(text));
    const parts = slidesOfText(text);
    assert.deepEqual(parts.map(part => part.data.markdown?.split('\n')[0]), offer.slides.map(entry => `# ${entry.title}`), 'in the offer\'s order');
    for (const [at, part] of parts.entries()) {
      const source = parseFrom(part.data.from);
      assert.equal(source?.path, offer.slides[at].path, 'a copy names where it came from');
      assert.equal(source?.id, offer.slides[at].id);
      assert.ok(source?.stamp, 'with the source\'s stamp');
      assert.equal(part.kind, '', 'a block slide');
    }
    assert.equal(new Set(parts.map(part => part.data.id)).size, parts.length, 'each with an id of its own');
    // The prompt and the handout came with the board; its part opens with its heading.
    const board = parts.find(part => part.data.markdown?.startsWith('# Shared prompt board'))!;
    assert.ok(board.data.markdown?.includes('Summarise [the document] in five lines'));
    assert.ok(board.handout.startsWith('## Shared prompt board'), board.handout);
    assert.ok(board.handout.includes(BOARD_HANDOUT));
    for (const [path, was] of Object.entries(decksBefore)) assert.equal(files[path], was, `${path} is not written`);

    // The library has them now: they aren't offered again.
    assert.deepEqual((await offerNow(deckFiles)).offer.slides, []);

    // One Undo: the topic and the theme file go, every deck as it was.
    assert.equal(await library.undoTopicWrite(write), true);
    assert.deepEqual(Object.keys(files).sort(), Object.keys(decksBefore).sort());
    for (const [path, was] of Object.entries(decksBefore)) assert.equal(files[path], was);
    assert.equal((await offerNow(deckFiles)).offer.slides.length, 5, 'offered again after the Undo');
  }

  // ---- Choose…: only the ticked slides, at the end of an Every training that is there already (one write, its own
  // slides byte for byte); its Undo puts the topic back exactly; a topic changed since is left alone.
  {
    const { files, deckFiles, library } = await balanced();
    const topic = `${LIBRARY_FOLDER}/${EVERY_TRAINING}.rtms`;
    const existing = deck(slide('ev01', '# Welcome\n\nCoffee is in the kitchen', '## Welcome\n\nSay hello.'));
    files[topic] = existing;
    const { offer } = await offerNow(deckFiles);
    const chosen = [offer.slides[1], offer.slides[3]];
    const write = await library.addCopiesToTopic(chosen.map(entry => ({ path: entry.path, id: entry.id })), EVERY_TRAINING);
    assert.equal(write.previous, existing);
    assert.deepEqual(write.made, [], 'the theme file is made only for a new topic with none');
    const parts = slidesOfText(files[topic]);
    assert.deepEqual(parts.map(part => part.data.markdown?.split('\n')[0]), ['# Welcome', ...chosen.map(entry => `# ${entry.title}`)]);
    assert.equal(parts[0].data.id, 'ev01');
    assert.ok(!parts.slice(1).some(part => part.data.id === 'ev01'), 'new ids, never one the topic has');
    const left = await offerNow(deckFiles);
    assert.deepEqual(left.titles, offer.slides.filter(entry => !chosen.includes(entry)).map(entry => entry.title), 'the rest still offered');
    assert.equal(await library.undoTopicWrite(write), true);
    assert.equal(files[topic], existing, 'one Undo, the topic exactly as it was');

    const again = await library.addCopiesToTopic([{ path: chosen[0].path, id: chosen[0].id }], EVERY_TRAINING);
    files[topic] += '\nEdited since.\n';
    const edited = files[topic];
    assert.equal(await library.undoTopicWrite(again), false);
    assert.equal(files[topic], edited, 'nothing undone over a later change');

    // Never from the library itself, nor a path that climbs out.
    await assert.rejects(library.addCopiesToTopic([{ path: topic, id: 'ev01' }], EVERY_TRAINING), /already in the library/);
    await assert.rejects(library.addCopiesToTopic([{ path: '../x.deck.md', id: 'ab12' }], EVERY_TRAINING), /no deck in this project/);
    await assert.rejects(library.addCopiesToTopic([], EVERY_TRAINING), /No slide/);
  }

  // ---- Not now: the slides go for good, kept beside the library (never in a deck); a later copy or a moved deck
  // doesn't bring them back; the rest stays offered.
  {
    const { files, times, deckFiles, F } = await balanced();
    const decksBefore = Object.fromEntries(Object.entries(files));
    const index = new DeckIndex(deckFiles);
    const decks = await index.decks();
    const { offer } = await offerNow(deckFiles);
    const hidden = offer.slides.slice(0, 2);
    await hideFromOffer(deckFiles, notNowSlides(decks, index.same(), hidden.map(entry => ({ path: entry.path, id: entry.id }))));
    assert.ok(NOT_NOW_PATH.startsWith(`${LIBRARY_FOLDER}/`) && !NOT_NOW_PATH.endsWith('.deck.md'), 'beside the topics, no deck');
    for (const [path, was] of Object.entries(decksBefore)) assert.equal(files[path], was, `${path} is not written`);
    const kept = JSON.parse(files[NOT_NOW_PATH]);
    assert.equal(kept.version, 1);
    assert.deepEqual(kept.slides.map((entry: { title: string }) => entry.title), hidden.map(entry => entry.title));
    assert.ok(!files[NOT_NOW_PATH].includes('See you next time'), 'no slide\'s words, only its title');
    const shown = offer.slides.slice(2).map(entry => entry.title);
    assert.deepEqual((await offerNow(deckFiles)).titles, shown);

    // A new deck copied from one that has them: still hidden.
    files[F(3)] = copiedDeckText(files[F(2)], folder(F(2)), folder(F(3)));
    times[F(3)] = day('2026-11-18');
    assert.deepEqual((await offerNow(deckFiles)).titles, shown);
    // Every deck moved to another folder (no place it was hidden at is left): its words still hide it.
    for (const path of Object.keys(files).filter(path => path.endsWith('.deck.md'))) {
      files[`Archive/${path}`] = files[path];
      times[`Archive/${path}`] = times[path];
      delete files[path];
    }
    assert.deepEqual((await offerNow(deckFiles)).titles, shown);

    // The file read back as written; a second Not now adds to it.
    assert.deepEqual(parseNotNow(notNowText(parseNotNow(files[NOT_NOW_PATH]))), parseNotNow(files[NOT_NOW_PATH]));
    const all = await projectOffer(new DeckLibrary(deckFiles));
    await hideFromOffer(deckFiles, notNowSlides(all.decks, all.same, all.offer.slides.map(entry => ({ path: entry.path, id: entry.id }))));
    assert.equal(parseNotNow(files[NOT_NOW_PATH]).slides.length, 5);
    assert.deepEqual((await offerNow(deckFiles)).offer.slides, [], 'nothing left to offer');
  }

  // ---- An unreadable Not now hides nothing; a broken entry is skipped.
  assert.deepEqual(parseNotNow(null), { slides: [] });
  assert.deepEqual(parseNotNow('{ not json'), { slides: [] });
  assert.deepEqual(parseNotNow('{"slides": [{"places": []}, {"places": ["A.deck.md#ab12"], "words": [3]}, 7]}'), { slides: [{ places: ['A.deck.md#ab12'], words: [] }] });

  // ---- Claude's tools read the same offer as the place (one function).
  {
    const { deckFiles } = await balanced();
    const fromTools = await projectOffer(new DeckLibrary(deckFiles));
    assert.deepEqual(fromTools.offer, (await offerNow(deckFiles)).offer);
  }

  // ---- The open deck is a deck like any other, but its copy shows only when no other deck has the slide.
  {
    const { deckFiles, KEYNOTE } = await balanced();
    const { offer } = await offerNow(deckFiles, KEYNOTE);
    assert.equal(offer.families, 5);
    assert.ok(offer.slides.every(entry => entry.path !== KEYNOTE), 'another deck\'s copy');
    // The Keynote's copies left out, the plan's newest is the Kickoff's (5 Nov), the others' a Fernhollow deck's.
    assert.deepEqual(offer.slides.map(entry => entry.title).slice(0, 3), ["Today's plan", 'Thank you', 'Questions and next steps']);
  }

  // ---- Review round 1 (#895). A slide whose id was written by hand ("intro-1") is never offered: it could be neither
  // added nor hidden. The slides left out because the library has them are counted. A slide named twice goes in once.
  {
    const files: Record<string, string> = {};
    const times: Record<string, number> = {};
    const deckFiles = project(files, times);
    const library = new DeckLibrary(deckFiles);
    for (const [at, name] of ['Alpha', 'Beta', 'Gamma'].entries()) {
      files[`Talks/${name}.deck.md`] = deck(...own(name, 5), slide('intro-1', '# Welcome\n\nCoffee is in the kitchen'), slide(`p${at}aa`, PLAN));
    }
    const { offer, titles } = await offerNow(deckFiles);
    assert.deepEqual(titles, ["Today's plan"], 'the hand-written ids\' slide is not offered');
    assert.equal(offer.withheld, 1, 'counted, so Claude says why');
    await library.addCopiesToTopic([offer.slides[0], offer.slides[0]].map(entry => ({ path: entry.path, id: entry.id })), EVERY_TRAINING);
    assert.equal(slidesOfText(files[`${LIBRARY_FOLDER}/${EVERY_TRAINING}.rtms`]).length, 1, 'named twice, added once');
    const after = (await offerNow(deckFiles)).offer;
    assert.deepEqual([after.slides.length, after.withheld], [0, 2], 'withheld: the library has it (and the hand-written ids)');
    // Round two: a second press that crossed the first adds nothing again.
    await assert.rejects(library.addCopiesToTopic([{ path: offer.slides[0].path, id: offer.slides[0].id }], EVERY_TRAINING), /already has this slide/);
    assert.equal(slidesOfText(files[`${LIBRARY_FOLDER}/${EVERY_TRAINING}.rtms`]).length, 1);

    // Not now over a file that isn't JSON (edited by hand): refused, the file as it was, nothing it hid comes back.
    const broken = '{ "slides": [ { "places": ["A.deck.md#ab12"] }, ] }';
    files[NOT_NOW_PATH] = broken;
    await assert.rejects(hideFromOffer(deckFiles, [{ places: ['Talks/Alpha.deck.md#p0aa'], words: [] }]), /can't be read, so nothing was hidden/);
    assert.equal(files[NOT_NOW_PATH], broken);
    // Round two: JSON of another shape is never written over either, and while the file can't be read nothing is
    // offered (it may have hidden any of them); the tools say why.
    for (const other of ['[{ "places": ["A.deck.md#ab12"] }]', '{ "slides": { "places": [] } }']) {
      files[NOT_NOW_PATH] = other;
      await assert.rejects(hideFromOffer(deckFiles, [{ places: ['Talks/Alpha.deck.md#p0aa'], words: [] }]), /can't be read/);
      assert.equal(files[NOT_NOW_PATH], other);
      assert.equal(await readNotNow(deckFiles), null);
    }
    delete files[`${LIBRARY_FOLDER}/${EVERY_TRAINING}.rtms`];
    const unreadable = await projectOffer(library);
    assert.deepEqual([unreadable.unreadable, unreadable.offer.slides.length], [true, 0]);
    delete files[NOT_NOW_PATH];
    const readable = await projectOffer(library);
    assert.deepEqual([readable.unreadable, readable.offer.slides.length], [false, 1], 'deleted: offered again');
  }
  {
    // A Slide library folder the person made and left empty stays after Undo; only Themes, which the add made, goes.
    const files: Record<string, string> = {};
    const times: Record<string, number> = {};
    const deckFiles = project(files, times, new Set(['Slide library']));
    const library = new DeckLibrary(deckFiles);
    files['A/One.deck.md'] = deck(slide('ap01', PLAN));
    const write = await library.addCopiesToTopic([{ path: 'A/One.deck.md', id: 'ap01' }], EVERY_TRAINING);
    assert.deepEqual(write.madeFolders, ['Slide library/Themes']);
    // A topic made meanwhile names the theme file: Undo leaves it.
    files['Slide library/Openings.deck.md'] = `---\ndeck: 2\ntheme: ${BUILT_IN_THEME_PATH}\n---\n\n${slide('op01', '# Welcome')}`;
    assert.equal(await library.undoTopicWrite(write), true);
    assert.equal(files[`${LIBRARY_FOLDER}/${EVERY_TRAINING}.rtms`], undefined);
    assert.ok(files[BUILT_IN_THEME_PATH], 'the theme file a topic names stays');
    assert.ok(await deckFiles.folderExists!('Slide library'), 'the person\'s own folder stays');

    // Round two: an open topic holds its text in its own line endings (CRLF on Windows): Undo still takes it back.
    const again = await library.addCopiesToTopic([{ path: 'A/One.deck.md', id: 'ap01' }], EVERY_TRAINING);
    const topic = `${LIBRARY_FOLDER}/${EVERY_TRAINING}.rtms`;
    files[topic] = files[topic].replace(/\n/g, '\r\n');
    assert.equal(await library.undoTopicWrite(again), true);
    assert.equal(files[topic], undefined);
  }
  {
    // A folder deleted at once (the watcher reports the folder alone): the index says whether it held decks.
    const { deckFiles } = await balanced();
    const index = new DeckIndex(deckFiles);
    await index.decks();
    assert.ok(index.holdsUnder('Clients'));
    assert.ok(index.holdsUnder('Clients/Northwind/'));
    assert.ok(!index.holdsUnder('Client'), 'a folder whose name only starts the same');
    assert.ok(!index.holdsUnder('Talks/Kickoff.deck.md'), 'a deck is no folder');
    assert.ok(!index.holdsUnder('build'));
  }

  console.log('libraryOffer: all tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
