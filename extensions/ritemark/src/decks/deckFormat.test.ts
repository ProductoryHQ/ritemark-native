/**
 * Sprint 157: the deck file's reader and writer. Run with `npx tsx src/decks/deckFormat.test.ts`.
 */
import { strict as assert } from 'node:assert';
import * as yaml from 'js-yaml';
import {
  fenceFor,
  isReadableDeckVersion,
  newId,
  parseDeck,
  parseFrom,
  parseSlideBody,
  readScalar,
  slideKindOfInfo,
  writeFrom,
  writeScalar,
  writeSlideBlock,
  writeSlideBody,
  type SlideData,
} from './deckFormat';

let passed = 0;
function test(name: string, run: () => void) {
  try {
    run();
    passed++;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const BOXES = [
  'id: b7k2',
  'title: Assistant or agent?',
  'look: steps',
  'picture: right',
  'image: images/agent.png',
  'from: Slide library/AI assistants.deck.md#a7c2 @k3f9z1',
  'items:',
  '- heading: Ask',
  '  text: One question, one answer',
  '  icon: chat',
  '- heading: Delegate',
  '  text: "A goal: it picks the steps"',
].join('\n');

const DECK = [
  '---',
  'deck: 1',
  'theme: Slide library/Themes/Evening.theme.md',
  '---',
  '',
  'A preamble line.',
  '',
  '```slide title',
  'id: t001',
  'title: AI assistants and agents',
  'subtitle: Harbour Logistics · 3 hours',
  '```',
  '',
  '## Welcome',
  '',
  'Everything you need today is on this page.',
  '',
  '```slide boxes',
  BOXES,
  '```',
  '',
  '```notes',
  'Ask who has used an agent.',
  '```',
  '',
  'Handout text.',
  '',
  '```text',
  '```slide fake',
  '```',
  '',
  '````slide table',
  'id: tb01',
  'title: Which tool',
  'rows:',
  '- [Data, In the chat, In Excel]',
  '- [Internal, "Company account only", "Yes, on a copy"]',
  '````',
  '',
].join('\n');

test('a deck is read: front matter, slides, notes and handouts', () => {
  const deck = parseDeck(DECK);
  assert.equal(deck.version, '1');
  assert.equal(deck.theme, 'Slide library/Themes/Evening.theme.md');
  assert.deepEqual(deck.slides.map(slide => slide.kind), ['title', 'boxes', 'table']);
  assert.equal(deck.slides[1].body, BOXES);
  assert.equal(deck.slides[1].notes, 'Ask who has used an agent.');
  assert.equal(deck.slides[0].notes, null);
  assert.equal(DECK.slice(deck.slides[0].handoutStart, deck.slides[0].handoutEnd), '\n\n## Welcome\n\nEverything you need today is on this page.\n\n');
  // A slide fence inside another fenced block is that block's text, not a slide.
  assert.ok(DECK.slice(deck.slides[1].handoutStart, deck.slides[1].handoutEnd).includes('```slide fake'));
  assert.equal(DECK.slice(deck.slides[2].start, deck.slides[2].end).split('\n')[0], '````slide table');
  assert.equal(DECK.slice(0, deck.slides[0].start), '---\ndeck: 1\ntheme: Slide library/Themes/Evening.theme.md\n---\n\nA preamble line.\n\n');
});

test('a notes block with words between it and the slide stays a code block of the handout', () => {
  const deck = parseDeck('```slide points\nid: p1\n```\n\nText.\n\n```notes\nNot the slide\'s.\n```\n');
  assert.equal(deck.slides[0].notes, null);
});

test('a slide body is read', () => {
  const data = parseSlideBody(BOXES);
  assert.deepEqual(data, {
    id: 'b7k2',
    title: 'Assistant or agent?',
    look: 'steps',
    picture: 'right',
    image: 'images/agent.png',
    from: 'Slide library/AI assistants.deck.md#a7c2 @k3f9z1',
    items: [
      { heading: 'Ask', text: 'One question, one answer', icon: 'chat' },
      { heading: 'Delegate', text: 'A goal: it picks the steps' },
    ],
  });
  assert.deepEqual(parseSlideBody('rows:\n- [Data, In the chat]\n- ["Yes, on a copy", \'it\'\'s\', ""]').rows, [
    ['Data', 'In the chat'],
    ['Yes, on a copy', "it's", ''],
  ]);
  assert.equal(parseSlideBody('skip: true').skip, true);
  assert.equal(parseSlideBody('title: Plain # a comment').title, 'Plain');
});

test('an untouched body is written byte for byte, unknown keys and lines included', () => {
  const body = BOXES + '\ncolour: teal\n# a comment\n\nlater: kept';
  assert.equal(writeSlideBody(body, parseSlideBody(body)), body);
  const odd = 'title:   "Spaced"   \nitems:\n  - heading: Indented list\n    text: kept as written\n  - heading: Two\nrows: []';
  assert.equal(writeSlideBody(odd, parseSlideBody(odd)), odd);
});

test('a change rewrites only the lines whose value changed', () => {
  const data: SlideData = { ...parseSlideBody(BOXES), title: 'Assistant, or agent?' };
  const written = writeSlideBody(BOXES, data);
  const before = BOXES.split('\n');
  const after = written.split('\n');
  assert.equal(after.length, before.length);
  assert.deepEqual(after.filter((line, index) => line !== before[index]), ['title: Assistant, or agent?']);
});

test('an item change rewrites the list, keeping each item\'s unknown keys', () => {
  const body = 'title: T\nitems:\n- heading: A\n  colour: red\n- heading: B';
  const data = parseSlideBody(body);
  data.items![1] = { heading: 'B', text: 'New' };
  assert.equal(writeSlideBody(body, data), 'title: T\nitems:\n- heading: A\n  colour: red\n- heading: B\n  text: New');
});

test('a new key goes in its canonical place; a removed key goes', () => {
  const body = 'id: ab12\ntitle: T\nitems:\n- heading: A';
  assert.equal(writeSlideBody(body, { ...parseSlideBody(body), subtitle: 'S', skip: true }), 'id: ab12\ntitle: T\nsubtitle: S\nskip: true\nitems:\n- heading: A');
  assert.equal(writeSlideBody(body, { id: 'ab12', items: [{ heading: 'A' }] }), 'id: ab12\nitems:\n- heading: A');
  assert.equal(writeSlideBody('', { id: 'z9z9', title: 'New', items: [] }), 'id: z9z9\ntitle: New\nitems: []');
  assert.equal(writeSlideBody('title: T\nskip: true', { title: 'T', skip: false }), 'title: T');
});

test('every body the writer emits reads the same in js-yaml', () => {
  const awkward = [
    '', ' padded ', 'true', 'No', '1', '1e10', '0x1F', '2026-11-15', '- dash', 'key: value', 'a #hash', '#hash',
    '"quoted"', "it's", 'line\nbreak', 'tab\there', '[x]', '{y}', '@at', '`tick`', '* star', '& amp', '!bang', '%pct',
    'Ünïcödé · dash — "quotes"', 'ends with colon:', '?', ':', 'null', '~', '.5', '+1', 'x, y', '\u2028',
    // A backslash before an escape letter is a backslash (review round 1 of PR 1).
    'a: \\e', '- \\0', '#C:\\new\\x41', '"\\\\"', 'tab\\t', 'end\\',
  ];
  const data: SlideData = {
    id: '1234',
    title: awkward.join(' / '),
    subtitle: 'line\nbreak',
    number: '1',
    items: awkward.map(text => ({ heading: text, text, icon: 'chat' })),
    rows: [awkward.slice(0, 12), awkward.slice(12, 24), awkward.slice(24)],
  };
  const written = writeSlideBody('', data);
  const read = yaml.safeLoad(written) as Record<string, unknown>;
  assert.equal(read.id, '1234');
  assert.equal(read.title, data.title);
  assert.equal(read.subtitle, data.subtitle);
  assert.equal(read.number, '1');
  assert.deepEqual(read.items, data.items);
  assert.deepEqual(read.rows, data.rows);
  assert.deepEqual(parseSlideBody(written), data);
  for (const value of awkward) assert.equal(readScalar(writeScalar(value)), value, `scalar ${JSON.stringify(value)}`);
});

test('YAML double-quoted escapes are read', () => {
  assert.equal(readScalar('"a\\x41\\tb\\u00e9\\/"'), 'aA\tbé/');
});

test('the fence is sized past any backticks in the body', () => {
  assert.equal(fenceFor('plain'), '```');
  assert.equal(fenceFor('```\ncode\n```'), '````');
  assert.equal(writeSlideBlock('statement', 'title: x\ntext: "```js"'), '```slide statement\ntitle: x\ntext: "```js"\n```');
  assert.equal(writeSlideBlock('points', 'a\n````b'), '`````slide points\na\n````b\n`````');
  assert.equal(writeSlideBlock('title', 'id: x', 'Say hi.'), '```slide title\nid: x\n```\n\n```notes\nSay hi.\n```');
  assert.equal(writeSlideBlock('title', '', ''), '```slide title\n```\n\n```notes\n```');
  // A kind that isn't one word can't break the fence line (review round 1 of PR 1).
  assert.equal(writeSlideBlock('x\n```\n# injected', 'id: a'), '```slide points\nid: a\n```');
  assert.equal(writeSlideBlock('', 'id: a'), '```slide\nid: a\n```');
  assert.equal(writeSlideBlock('gamma.v2', 'id: a'), '```slide gamma.v2\nid: a\n```', 'an unknown kind is kept as written');
  assert.equal(writeSlideBlock('a`b', 'id: a'), '```slide points\nid: a\n```', 'a backtick would end the info string');
  const deck = parseDeck(writeSlideBlock('points', 'a\n````b', 'n'));
  assert.equal(deck.slides[0].body, 'a\n````b');
  assert.equal(deck.slides[0].notes, 'n');
});

test('info strings, versions, ids and the from line', () => {
  assert.equal(slideKindOfInfo('slide boxes'), 'boxes');
  assert.equal(slideKindOfInfo('slide  boxes '), 'boxes');
  assert.equal(slideKindOfInfo('slide'), '');
  assert.equal(slideKindOfInfo('slides'), null);
  assert.equal(slideKindOfInfo('js'), null);
  assert.ok(isReadableDeckVersion(null));
  assert.ok(isReadableDeckVersion('1'));
  assert.ok(!isReadableDeckVersion('2'));
  assert.ok(!isReadableDeckVersion('next'));
  let n = 0;
  const sequence = [0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5];
  assert.equal(newId(['0000'], () => sequence[n++ % sequence.length]), 'a000');
  assert.match(newId([], () => 0.05), /^[a-z]/, 'a letter first');
  assert.match(newId([]), /^[0-9a-z]{4}$/);
  const from = parseFrom('Slide library/AI assistants.deck.md#a7c2 @k3f9z1');
  assert.deepEqual(from, { path: 'Slide library/AI assistants.deck.md', id: 'a7c2', stamp: 'k3f9z1' });
  assert.equal(writeFrom(from!), 'Slide library/AI assistants.deck.md#a7c2 @k3f9z1');
  assert.deepEqual(parseFrom('Other/Deck.deck.md#ab12'), { path: 'Other/Deck.deck.md', id: 'ab12', stamp: null });
  assert.equal(parseFrom('no hash'), null);
});

console.log(`deckFormat: ${passed} passed`);
