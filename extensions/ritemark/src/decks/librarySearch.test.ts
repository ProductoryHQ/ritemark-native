/**
 * Sprint 165 PR 3 (#833): the Slide library's search shows each slide once, and its index reads a deck again only when
 * it changed. Synthetic decks only, copied with the app's own paths. Run with `npx tsx src/decks/librarySearch.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { slidesOfText } from './deckLibraryFormat';
import { DeckLibrary, type DeckFiles } from './DeckLibrary';
import { DeckIndex, hitDecks, inOpenDeck, MAX_HITS, MAX_NAMED_DECKS, namedDecks, searchLibrary, searchTerms, slideKey } from './librarySearch';
import { copiedDeckText } from './newDeck';

/** An in-memory project whose files' times the test sets, counting the reads. */
function project(files: Record<string, string>, times: Record<string, number>) {
  const reads: string[] = [];
  const lists = { count: 0 };
  const deckFiles: DeckFiles = {
    async list() { lists.count++; return Object.keys(files).filter(path => path.endsWith('.deck.md')).map(path => ({ path, modified: times[path] ?? 1 })); },
    async read(path) { reads.push(path); return files[path] ?? null; },
    async write(path, text) { files[path] = text; },
  };
  return { files: deckFiles, reads, lists };
}

const slide = (id: string, markdown: string, handout = '') => ['```slide', '---', `id: ${id}`, '---', markdown, '```', '', handout, ''].join('\n');
const deck = (...slides: string[]) => ['---', 'deck: 2', '---', '', ...slides].join('\n');
const day = (text: string) => new Date(text).getTime();

const TOPIC = 'Slide library/Every training.deck.md';
const C1 = 'Clients/Northwind/Context 1.deck.md';
const C2 = 'Clients/Northwind/Context 2.deck.md';
const C3 = 'Clients/Contoso/Context 3.deck.md';
const C4 = 'Trainings/Context 4.deck.md';
const OPEN = 'Trainings/New client.deck.md';

async function run() {
  const files: Record<string, string> = {
    [TOPIC]: deck(
      slide('l1aa', '# Coffee break\n\nBack in 15 minutes'),
      slide('l2aa', '# Shaping context in agents\n\n- A background file\n- The folder the agent reads'),
    ),
    [C1]: deck(
      slide('c1aa', '# Context engineering, day 1'),
      slide('c2aa', '# What is context?\n\n- Everything the model sees\n- Not only the prompt'),
      slide('c3aa', '# Agenda\n\n- Morning: prompts\n- Afternoon: agents', 'We start with context.'),
    ),
  };
  const times: Record<string, number> = {
    [TOPIC]: day('2026-10-01T10:00'),
    [C1]: day('2026-10-10T10:00'),
    [C2]: day('2026-10-21T10:00'),
    [C3]: day('2026-11-03T10:00'),
    [C4]: day('2026-11-12T10:00'),
    [OPEN]: day('2026-11-19T10:00'),
  };
  const { files: deckFiles, reads } = project(files, times);
  const library = new DeckLibrary(deckFiles);
  // Each deck starts as a copy of the last one (New → Deck), the third in another client's folder.
  files[C2] = copiedDeckText(files[C1], 'Clients/Northwind', 'Clients/Northwind').replace('day 1', 'day 2');
  files[C3] = copiedDeckText(files[C2], 'Clients/Northwind', 'Clients/Contoso')
    // A rewrite under an old id: the Agenda becomes another slide.
    .replace('# Agenda\n\n- Morning: prompts\n- Afternoon: agents', '# Budget review\n\n- Costs per team\n- Who signs off');
  files[C4] = copiedDeckText(files[C3], 'Clients/Contoso', 'Trainings').replace('Not only the prompt', 'Not only the prompt you type');
  // Two copies of one slide in one deck still count it as one deck.
  await library.insertCopies(C2, ['c2aa'], C2, undefined);
  // The library's coffee break, inserted into each deck; a later deck's copy is newer than the topic.
  for (const path of [C1, C2, C3, C4]) await library.insertCopies(TOPIC, ['l1aa'], path, undefined);
  // The open deck: a copy of the library's context slide, and a slide of its own.
  files[OPEN] = deck(slide('o1aa', '# New client kickoff\n\nWelcome, Fernhollow'));
  await library.insertCopies(TOPIC, ['l2aa'], OPEN, undefined);
  // Typed again by hand in two decks, no lineage: the same words exactly.
  files['Talks/Talk A.deck.md'] = deck(slide('t1aa', '# Questions?\n\nAsk anything about today'));
  files['Talks/Talk B.deck.md'] = deck(slide('t2aa', '# questions\n\nAsk anything about today!'));
  times['Talks/Talk A.deck.md'] = day('2026-09-01T10:00');
  times['Talks/Talk B.deck.md'] = day('2026-09-02T10:00');

  const index = new DeckIndex(deckFiles);
  const decks = await index.decks();
  const same = index.same();
  const search = (query: string, active: string | null = OPEN, limit?: number) => searchLibrary(decks, same, query, { active, limit });
  const at = (path: string, id: string) => slidesOfText(files[path]).find(entry => entry.data.id === id)!.index;

  // ---- A slide in four decks shows once, at its newest copy, with "also in 3 older decks".
  {
    const { hits, total } = search('what is context');
    assert.equal(total, 1);
    assert.deepEqual(hits, [{ path: C4, index: at(C4, 'c2aa'), also: 3, library: false }], 'Context 4 is the newest; C2 holds two copies but counts once');
  }

  // ---- Library slides come first, at the library's copy; then slides whose title has the words, newest first; then
  // a slide with the words in its handout only.
  {
    const { hits } = search('context');
    assert.deepEqual(hits.map(hit => [hit.path, hit.index, hit.also, hit.library]), [
      // Shaping context in agents: the library's, though the open deck's copy is newer. Its only copy is in the open
      // deck, which has the tick instead.
      [TOPIC, at(TOPIC, 'l2aa'), 0, true],
      // "Context engineering, day 1" edited to "day 2": still one slide, at its newest.
      [C4, at(C4, 'c1aa'), 3, false],
      [C4, at(C4, 'c2aa'), 3, false],
      // "context" only in a handout: Budget review, the Agenda Context 3 and 4 rewrote (its handout kept), newest; then
      // the Agenda itself, in Context 1 and 2.
      [C4, at(C4, 'c3aa'), 1, false],
      [C2, at(C2, 'c3aa'), 1, false],
    ]);
  }

  // ---- A library slide copied into decks shows once, at its topic, the decks counted (they can be newer).
  {
    const { hits } = search('coffee');
    assert.deepEqual(hits, [{ path: TOPIC, index: at(TOPIC, 'l1aa'), also: 4, library: true }]);
  }

  // ---- The rewrite under an old id is its own slide: searching its words finds its newest copy, not the Agenda's.
  {
    assert.deepEqual(search('budget').hits.map(hit => [hit.path, hit.also]), [[C4, 1]], 'Context 3 and 4 have it');
    assert.deepEqual(search('agenda').hits.map(hit => [hit.path, hit.also]), [[C2, 1]], 'only Context 1 and 2 keep the Agenda');
  }

  // ---- The same words typed in two decks, with no lineage: shown once (rule G's exact match).
  assert.deepEqual(search('questions').hits.map(hit => [hit.path, hit.also]), [['Talks/Talk B.deck.md', 1]]);

  // ---- Each word typed, in any order; none: nothing.
  assert.deepEqual(searchTerms('  Context   WHAT '), ['context', 'what']);
  assert.equal(search('context what').total, 1);
  assert.equal(search('   ').total, 0);
  assert.equal(search('nothing-like-this').total, 0);

  // ---- The open deck is no source: a slide only it has isn't found; with no deck open it is.
  assert.equal(search('fernhollow').total, 0);
  assert.deepEqual(search('fernhollow', null).hits.map(hit => hit.path), [OPEN]);
  // With no deck open, the library's context slide counts the deck that has it.
  assert.equal(search('shaping', null).hits[0].also, 1);

  // ---- The tick: the slides of other decks that are already in the open deck, by the same rule.
  {
    const here = new Set(inOpenDeck(decks, same, OPEN));
    assert.ok(here.has(slideKey(TOPIC, at(TOPIC, 'l2aa'))), 'the library slide the open deck copied');
    assert.ok(!here.has(slideKey(TOPIC, at(TOPIC, 'l1aa'))), 'the coffee break is not in it');
    assert.ok([...here].every(key => !key.startsWith(`${OPEN}#`)), 'never the open deck\'s own slides');
    assert.deepEqual(inOpenDeck(decks, same, null), []);
    assert.deepEqual(inOpenDeck(decks, same, 'No such.deck.md'), []);
    // Context 4's own slides: open it, and Context 1–3's copies of them carry the tick.
    const fromFour = new Set(inOpenDeck(decks, same, C4));
    assert.ok(fromFour.has(slideKey(C1, at(C1, 'c2aa'))));
    assert.ok(fromFour.has(slideKey(TOPIC, at(TOPIC, 'l1aa'))), 'its coffee break is the library\'s');
    assert.ok(!fromFour.has(slideKey(C1, at(C1, 'c3aa'))), 'the Agenda it rewrote is not in it');
  }

  // ---- What the place draws for a search: the decks of the hits, each with only its hits, Agenda kept.
  {
    const { hits } = search('context');
    const shown = hitDecks(decks, hits);
    assert.deepEqual(shown.map(entry => [entry.path, entry.slides.map(item => item.index)]), [
      [TOPIC, [at(TOPIC, 'l2aa')]], [C4, [at(C4, 'c1aa'), at(C4, 'c2aa'), at(C4, 'c3aa')]], [C2, [at(C2, 'c3aa')]],
    ]);
    assert.ok(Array.isArray(shown[1].agenda));
  }

  // ---- The AI's list_decks matches each word typed too, and still finds a deck by its name.
  {
    const listed = await library.listDecks({ query: 'context what' });
    assert.ok(listed.some(entry => entry.path === C4 && entry.slides.some(item => item.id === 'c2aa')), 'each word, in any order');
    const named = await library.listDecks({ query: 'context 3' });
    assert.ok(named.some(entry => entry.path === C3 && entry.slides.length === slidesOfText(files[C3]).length), 'a deck named so: all its slides');
  }

  // ---- A grouping out of step with the decks given never throws: what is gone is left out.
  {
    const without = decks.filter(entry => entry.summary.path !== C4);
    const { hits } = searchLibrary(without, same, 'budget', { active: OPEN });
    assert.deepEqual(hits.map(hit => hit.path), [C3]);
    assert.deepEqual(searchLibrary(decks.filter(entry => entry.summary.topic), same, 'what is context', { active: OPEN }).hits, []);
  }

  // ---- #877: the Decks group: decks whose folder or name has each word, whole, in the listing's order; never the
  // open deck; their slides are not hits for the name.
  {
    assert.deepEqual(namedDecks(decks, 'northwind', { active: OPEN }).decks.map(entry => entry.path), [C2, C1], 'the folder\'s decks, newest first');
    assert.equal(search('northwind').total, 0, 'a folder\'s name lists no slide');
    assert.deepEqual(namedDecks(decks, 'context 3').decks.map(entry => entry.path), [C3], 'each word, in the folder or the name');
    const whole = namedDecks(decks, 'contoso').decks[0];
    assert.equal(whole.slides.length, slidesOfText(files[C3]).length, 'a named deck comes whole');
    assert.ok(Array.isArray(whole.agenda), 'with its Agenda');
    assert.deepEqual(namedDecks(decks, 'every training').decks.map(entry => entry.path), [TOPIC], 'a topic by its name');
    assert.deepEqual(namedDecks(decks, 'new client', { active: OPEN }).decks, [], 'never the open deck');
    assert.deepEqual(namedDecks(decks, 'new client', { active: null }).decks.map(entry => entry.path), [OPEN]);
    assert.deepEqual(namedDecks(decks, '   '), { decks: [], total: 0 });
    const capped = namedDecks(decks, 'context', { limit: 2 });
    assert.deepEqual([capped.decks.length, capped.total], [2, 4], 'at most `limit`, the total counts them all');
    assert.equal(MAX_NAMED_DECKS, 8);
  }

  // ---- At most `limit` hits; the total counts them all.
  for (let n = 0; n < 5; n++) files[`Many/Deck ${n}.deck.md`] = deck(slide(`m${n}aa`, `# Many words ${n}\n\nDistinct ${n} thing ${n * 7}`));
  {
    const fresh = new DeckIndex(deckFiles);
    const all = await fresh.decks();
    const result = searchLibrary(all, fresh.same(), 'many', { limit: 3 });
    assert.equal(result.total, 5);
    assert.equal(result.hits.length, 3);
    assert.equal(MAX_HITS, 60);
  }

  // ---- The index reads each deck once, then again only what changed.
  {
    const watched = project(files, times);
    const own = new DeckIndex(watched.files);
    const count = Object.keys(files).filter(path => path.endsWith('.deck.md')).length;
    await own.decks();
    assert.equal(watched.reads.length, count, 'the first search reads every deck');
    const before = own.same();
    await own.decks();
    assert.equal(watched.reads.length, count, 'typing in the search reads no file');
    assert.equal(own.same(), before, '"the same slide" is not worked out again when nothing changed');
    own.invalidate(C2);
    await own.decks();
    assert.deepEqual(watched.reads.slice(count), [C2], 'an edit in an open deck: that deck only');
    assert.notEqual(own.same(), before);
    times[C3] = day('2026-11-04T10:00');
    await own.decks();
    assert.deepEqual(watched.reads.slice(count + 1), [C3], 'a file changed on disk: its time moved');
    delete files['Talks/Talk A.deck.md'];
    const after = await own.decks();
    assert.ok(!after.some(entry => entry.summary.path === 'Talks/Talk A.deck.md'), 'a deleted deck leaves the index');
    assert.equal(watched.reads.length, count + 2);
    assert.equal(searchLibrary(after, own.same(), 'questions', { active: OPEN }).hits[0].also, 0, 'and its copy no longer counts');
    // A search typed lists no file again while no change was named; any other refresh does.
    const listings = watched.lists.count;
    await own.decks({ listAgain: false });
    await own.decks({ listAgain: false });
    assert.equal(watched.lists.count, listings, 'typing in the search lists no file');
    await own.decks();
    assert.equal(watched.lists.count, listings + 1);
    own.invalidate(C1);
    await own.decks({ listAgain: false });
    assert.equal(watched.lists.count, listings + 2, 'after a change, a search lists the files again');
    own.invalidate();
    await own.decks();
    assert.equal(watched.reads.length, count + 3 + count - 1, 'invalidate() with no path reads every deck again');
    // Two updates at once read once.
    own.invalidate(C4);
    await Promise.all([own.decks(), own.decks()]);
    assert.equal(watched.reads.filter(path => path === C4).length, 3);
    assert.equal(watched.reads.filter(path => path === C1).length, 3, 'C1: the first read, its change and every deck again');
  }

  // ---- A big project stays quick: 400 decks of 25 slides, copied from each other; search reads nothing again.
  {
    const big: Record<string, string> = {};
    const bigTimes: Record<string, number> = {};
    const course = deck(...Array.from({ length: 25 }, (_, n) => slide(`b${String(n).padStart(3, '0')}`, `# Topic t${n}x of the course\n\n- A point about prompts\n- A point about agents`)));
    for (let n = 0; n < 400; n++) {
      const path = `Clients/Client ${n % 40}/Course ${n}.deck.md`;
      big[path] = n === 0 ? course : copiedDeckText(course, 'Clients/Client 0', `Clients/Client ${n % 40}`).replace('Topic t3x of', `Topic t3x (${n}) of`);
      bigTimes[path] = n;
    }
    const watched = project(big, bigTimes);
    const own = new DeckIndex(watched.files);
    const started = Date.now();
    const all = await own.decks();
    const result = searchLibrary(all, own.same(), 't7x', {});
    const first = Date.now() - started;
    assert.equal(result.total, 1, 'one slide, though 400 decks have it');
    assert.equal(result.hits[0].also, 399);
    const again = Date.now();
    searchLibrary(await own.decks(), own.same(), 't8x', {});
    const second = Date.now() - again;
    assert.equal(watched.reads.length, 400, 'the second search read no file');
    assert.ok(second <= first, `the second search (${second} ms) is quicker than the first (${first} ms)`);
    console.log(`librarySearch: 10,000 slides indexed and searched in ${first} ms, searched again in ${second} ms`);
  }

  console.log('librarySearch: passed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
