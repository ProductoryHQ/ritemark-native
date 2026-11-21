/**
 * Sprint 165 PR 3 (#833): rule G, "the same slide", on made-up lineages written with the app's own copy paths (New →
 * Deck's whole-deck copy, the library's insert). Synthetic decks only. Run with `npx tsx src/decks/sameSlide.test.ts`.
 */
import { strict as assert } from 'node:assert';
import { writeScalar } from './deckFormat';
import { slidesOfText } from './deckLibraryFormat';
import { DeckLibrary, type DeckFiles } from './DeckLibrary';
import { copiedDeckText } from './newDeck';
import { jaccard, normalizedWords, sameSlides, slideWords, WORDS_GUARD, type LineageSlide } from './sameSlide';

function project(files: Record<string, string>): DeckFiles {
  return {
    async list() { return Object.keys(files).filter(path => /\.(rtms|deck\.md)$/i.test(path)).map((path, index) => ({ path, modified: index })); },
    async read(path) { return files[path] ?? null; },
    async write(path, text) { files[path] = text; },
  };
}

/** A block slide: its id, an optional `from:`, its Markdown and its handout. */
const slide = (id: string, markdown: string, options: { from?: string; handout?: string } = {}) =>
  ['```slide', '---', `id: ${id}`, ...(options.from ? [`from: ${writeScalar(options.from)}`] : []), '---', markdown, '```', '', options.handout ?? '', ''].join('\n');
const deck = (...slides: string[]) => ['---', 'deck: 2', '---', '', ...slides].join('\n');

/** The rule's input from a project: every slide, keyed `<path>#<index>`. */
function lineageOf(files: Record<string, string>): LineageSlide[] {
  return Object.entries(files).filter(([path]) => path.endsWith('.deck.md')).flatMap(([path, text]) =>
    slidesOfText(text).map(entry => ({ key: `${path}#${entry.index}`, path, id: entry.data.id, from: entry.data.from, words: slideWords(entry.kind, entry.data) })));
}

/** The key of the slide with this id in this deck. */
function keyOf(files: Record<string, string>, path: string, id: string): string {
  const found = slidesOfText(files[path]).find(entry => entry.data.id === id);
  assert.ok(found, `${path} has a slide ${id}`);
  return `${path}#${found.index}`;
}

async function run() {
  // ---- The words the rule compares: lower case, punctuation dropped, an address kept, white space folded.
  assert.deepEqual(normalizedWords('  Questions?  Ask   ANYTHING. '), ['questions', 'ask', 'anything']);
  assert.deepEqual(normalizedWords('Write to name@example.com.'), ['write', 'to', 'name@example.com']);
  assert.deepEqual(normalizedWords('Küsimused, ÕPPIMINE: 15–20 min'), ['küsimused', 'õppimine', '15', '20', 'min']);
  // On a block slide: no layout lines, attributes, link targets or comments, only words.
  assert.deepEqual(
    slideWords('', { markdown: '[Exercise · 1 / 2]{.label}\n\n# Pair work\n\n:::: boxes\n::: box\n### Plan\n:::\n::::\n\n![A chart](<../images/chart one.png>)\n\n<!-- hidden -->' }),
    ['exercise', '1', '2', 'pair', 'work', 'plan', 'a', 'chart'],
  );
  // An older slide reads as the block slide it converts to.
  assert.deepEqual(slideWords('points', { title: 'Coffee break', items: [{ text: 'Back in 15 minutes' }] }), ['coffee', 'break', 'back', 'in', '15', 'minutes']);
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3);
  assert.equal(jaccard(new Set(), new Set()), 1);

  // ---- The words guard sits at 30%: a lineage link with 3 shared words of 10 holds, with 3 of 11 it doesn't.
  {
    const words = (...list: string[]) => list;
    const base = words('s1', 's2', 's3', 'a1', 'a2', 'a3', 'a4');
    const at = sameSlides([
      { key: 'a', path: 'A.deck.md', id: 'x1', words: base },
      { key: 'b', path: 'B.deck.md', id: 'x1', words: words('s1', 's2', 's3', 'b1', 'b2', 'b3') },
    ]);
    assert.equal(WORDS_GUARD, 0.3);
    assert.equal(at.groupOf('a'), at.groupOf('b'), '3 of 10 words shared: the same slide');
    const under = sameSlides([
      { key: 'a', path: 'A.deck.md', id: 'x1', words: base },
      { key: 'b', path: 'B.deck.md', id: 'x1', words: words('s1', 's2', 's3', 'b1', 'b2', 'b3', 'b4') },
    ]);
    assert.notEqual(under.groupOf('a'), under.groupOf('b'), '3 of 11: two slides');
    assert.equal(under.groupOf('nobody'), undefined);
  }

  // ---- A made-up project, written with the app's own copy paths.
  const files: Record<string, string> = {
    'Slide library/Every training.deck.md': deck(
      slide('l1aa', '# Coffee break\n\nBack in 15 minutes'),
      slide('l2aa', '# Questions?\n\nAsk anything about today'),
    ),
    'Clients/Northwind/Leadership 1.deck.md': deck(
      slide('n1aa', '# Leadership training\n\nFor Acme'),
      slide('n2aa', '# Context engineering\n\n- Shape what the model sees\n- Keep the background file short'),
      slide('n3aa', '# Agenda\n\n- Morning: prompts\n- Afternoon: agents'),
      slide('n5aa', '# Our numbers\n\n![The chart](images/chart.png)'),
    ),
  };
  const files_ = project(files);
  const library = new DeckLibrary(files_);
  const L1 = 'Clients/Northwind/Leadership 1.deck.md';
  const L2 = 'Clients/Northwind/Leadership 2.deck.md';
  const L3 = 'Clients/Contoso/Leadership 3.deck.md';
  const TOPIC = 'Slide library/Every training.deck.md';

  // The library's insert: a copy with a new id and `from: <topic>#l1aa @<stamp>`.
  await library.insertCopies(TOPIC, ['l1aa'], L1, undefined);
  const insertedId = slidesOfText(files[L1])[4].data.id!;
  assert.notEqual(insertedId, 'l1aa');
  assert.match(slidesOfText(files[L1])[4].data.from ?? '', /^Slide library\/Every training\.deck\.md#l1aa @/);

  // New → Deck, "copy an earlier deck", in the same folder: every byte, ids and from: lines kept. Then edited: a word
  // added to one slide, and the Agenda rewritten into another slide under its old id.
  files[L2] = copiedDeckText(files[L1], 'Clients/Northwind', 'Clients/Northwind')
    .replace('Keep the background file short', 'Keep the background file short and current')
    .replace('# Agenda\n\n- Morning: prompts\n- Afternoon: agents', '# Budget review\n\n- Costs per team\n- Who signs off');
  // The same copy into another folder, as a new client starts (the Experience lead): pictures and links rebased.
  files[L3] = copiedDeckText(files[L2], 'Clients/Northwind', 'Clients/Contoso');
  assert.match(files[L3], /\.\.\/Northwind\/images\/chart\.png/, 'the picture is rebased into the new folder');
  // A slide taken from a deck (a from: chain): Leadership 2's context slide into a talk.
  files['Talks/Chain.deck.md'] = deck(slide('c1aa', '# Hello'));
  await library.insertCopies(L2, ['n2aa'], 'Talks/Chain.deck.md', undefined);
  // Typed again by hand: new ids, no from:, the same words in another case and with other punctuation; and one with a
  // word changed; and a slide that shares an id with Leadership 1's by chance.
  files['Talks/Solo.deck.md'] = deck(
    slide('s1aa', '# questions\n\nAsk anything about today!'),
    slide('s2aa', '# Coffee break\n\nBack in 20 minutes'),
    slide('n2aa', '# Travel plans\n\n- Trains to Tartu\n- Hotel near the station'),
    slide('s3aa', ''),
  );
  // Copies of a library slide that is gone: they still share a lineage, with the words guard between them.
  files['Talks/Gone A.deck.md'] = deck(slide('g1aa', '# Shared prompt board\n\nCopy the prompts from the board', { from: 'Slide library/Gone.deck.md#zz11 @abc' }));
  files['Talks/Gone B.deck.md'] = deck(
    slide('g2aa', '# Shared prompt board\n\nCopy the prompts from the board, then try them', { from: 'Slide library/Gone.deck.md#zz11 @abc' }),
    slide('g3aa', '# Lunch\n\nThe canteen on floor two', { from: 'Slide library/Gone.deck.md#zz11 @abc' }),
    slide('g4aa', ''),
  );
  // An older topic (`slide points`), and its slide inserted into a deck: the copy goes in as a block slide.
  files['Slide library/Old.deck.md'] = '---\ndeck: 1\n---\n\n```slide points\nid: o1aa\ntitle: Ground rules\nitems:\n- text: Phones on silent\n- text: Questions any time\n```\n\nSay them once.\n';
  files['Talks/Rules.deck.md'] = deck(slide('r1aa', '# Hi'));
  await library.insertCopies('Slide library/Old.deck.md', ['o1aa'], 'Talks/Rules.deck.md', undefined);
  assert.equal(slidesOfText(files['Talks/Rules.deck.md'])[1].kind, '', 'the copy is a block slide');

  const same = sameSlides(lineageOf(files));
  const together = (a: string, b: string) => same.groupOf(a) !== undefined && same.groupOf(a) === same.groupOf(b);
  const k = (path: string, id: string) => keyOf(files, path, id);

  // Copies of a whole deck: the same id, words edited a little.
  assert.ok(together(k(L1, 'n2aa'), k(L2, 'n2aa')), 'a word added: still the same slide');
  assert.ok(together(k(L1, 'n1aa'), k(L2, 'n1aa')));
  // The deck copied into another folder: the same slides, its picture rebased.
  assert.ok(together(k(L2, 'n2aa'), k(L3, 'n2aa')));
  assert.ok(together(k(L1, 'n5aa'), k(L3, 'n5aa')), 'a picture slide copied into another folder');
  // A rewrite under an old id: two slides, though they share an id; the rewrite's own copy is its own.
  assert.ok(!together(k(L1, 'n3aa'), k(L2, 'n3aa')), 'the Agenda rewritten into Budget review is another slide');
  assert.ok(together(k(L2, 'n3aa'), k(L3, 'n3aa')), 'the rewritten slide and its copy');
  // The library's insert: a new id, linked by its from: line.
  assert.ok(together(k(TOPIC, 'l1aa'), k(L1, insertedId)), 'a library insert');
  assert.ok(together(k(TOPIC, 'l1aa'), k(L3, insertedId)), 'and the insert copied on with its deck');
  // A from: chain: library insert from a deck that is itself a copy.
  const chained = slidesOfText(files['Talks/Chain.deck.md'])[1].data.id!;
  assert.ok(together(k(L1, 'n2aa'), k('Talks/Chain.deck.md', chained)), 'a from: chain to a copied deck');
  // Typed again: the same words exactly, case and punctuation aside, is the same slide.
  assert.ok(together(k(TOPIC, 'l2aa'), k('Talks/Solo.deck.md', 's1aa')), 'a slide typed again by hand');
  // Its limit, as the research says: typed again with a word changed is another slide.
  assert.ok(!together(k(TOPIC, 'l1aa'), k('Talks/Solo.deck.md', 's2aa')), 'typed again with a word changed: not found');
  // An id shared by chance, with other words: two slides.
  assert.ok(!together(k(L1, 'n2aa'), k('Talks/Solo.deck.md', 'n2aa')), 'an id shared by chance');
  // A slide with no words matches no other empty slide by its words.
  assert.ok(!together(k('Talks/Solo.deck.md', 's3aa'), k('Talks/Gone B.deck.md', 'g4aa')), 'two empty slides are not one');
  // Copies of a gone slide: one lineage, the guard still between them.
  assert.ok(together(k('Talks/Gone A.deck.md', 'g1aa'), k('Talks/Gone B.deck.md', 'g2aa')), 'copies of a gone library slide');
  assert.ok(!together(k('Talks/Gone A.deck.md', 'g1aa'), k('Talks/Gone B.deck.md', 'g3aa')), 'a copy rewritten into another slide');
  // An older slide and its block copy.
  const rulesCopy = slidesOfText(files['Talks/Rules.deck.md'])[1].data.id!;
  assert.ok(together(k('Slide library/Old.deck.md', 'o1aa'), k('Talks/Rules.deck.md', rulesCopy)), 'an older slide and its block copy');

  // The group is named by its smallest key, and lists every member once.
  const group = same.groupOf(k(L1, 'n2aa'))!;
  const members = same.membersOf(group);
  assert.equal(group, [...members].sort()[0]);
  assert.deepEqual(new Set(members), new Set([k(L1, 'n2aa'), k(L2, 'n2aa'), k(L3, 'n2aa'), k('Talks/Chain.deck.md', chained)]));
  assert.deepEqual(same.membersOf('nobody'), []);

  console.log('sameSlide: passed');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
