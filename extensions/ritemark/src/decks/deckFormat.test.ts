/**
 * Sprint 157: the deck file's reader and writer. Run with `npx tsx src/decks/deckFormat.test.ts`.
 */
import { strict as assert } from 'node:assert';
import * as yaml from 'js-yaml';
import {
  isTextHandout,
  withTextHandoutMark,
  withWrittenHandout,
  derivedHeading,
  EMPTY_DECK_TITLE,
  handoutWithoutHeading,
  partHeadingLevel,
  partHeadingOf,
  withPartHeading,
  fenceFor,
  frontMatterField,
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
  publishText,
  type SlideData,
} from './deckFormat';
import { BUILT_IN_THEME } from './deckTheme';
import { deckDigest, publicDeck } from './page/publicDeck';

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
  // Sprint 161: block slides are format 2.
  assert.ok(isReadableDeckVersion('2'));
  assert.ok(!isReadableDeckVersion('3'));
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

test('a front matter value by name (Sprint 159: the look)', () => {
  const text = '---\ndeck: 1\ntheme: Slide library/Themes/Evening.theme.md\nlook: borderless\n---\n\n```slide title\ntitle: T\n```\n';
  assert.equal(frontMatterField(text, 'look'), 'borderless');
  assert.equal(frontMatterField(text, 'theme'), 'Slide library/Themes/Evening.theme.md');
  assert.equal(frontMatterField(text, 'owner'), null);
  assert.equal(frontMatterField('look: borderless\n', 'look'), null, 'only in the front matter');
  assert.equal(frontMatterField('---\nlook: "borderless"\n---\n', 'look'), 'borderless');
});

test('the text Publish builds from: the document\'s front matter with the view\'s body (Sprint 159 PR 4)', () => {
  const body = '```slide title\ntitle: Newest words\n```\n';
  const front = '---\ndeck: 1\ntheme: Slide library/Themes/Evening.theme.md\nlook: borderless\n---\n';
  const after = '\n```slide title\ntitle: Older words\n```\n';
  // The editor gave the view exactly what follows the front matter: the view's words go
  const joined = publishText(front + after, body, after);
  assert.deepEqual(joined, { text: front + body, fromView: true });
  assert.equal(frontMatterField(joined.text, 'look'), 'borderless');
  assert.equal(parseDeck(joined.text).theme, 'Slide library/Themes/Evening.theme.md');
  assert.deepEqual(parseDeck(joined.text).slides.map((slide) => parseSlideBody(slide.body).title), ['Newest words']);
  assert.deepEqual(publishText('\uFEFF' + front + 'old', body, 'old'), { text: front + body, fromView: true }, 'a byte-order mark goes');
  assert.deepEqual(publishText('---\ndeck: 1\n---', body, ''), { text: `---\ndeck: 1\n---\n${body}`, fromView: true }, 'a front matter at the end of the file');
  assert.deepEqual(publishText('```slide title\ntitle: Old\n```\n', body, '```slide title\ntitle: Old\n```\n'), { text: body, fromView: true }, 'no front matter: the body alone');
  assert.deepEqual(publishText(front, '', ''), { text: front, fromView: true }, 'an empty deck');
  // A body that itself starts with a --- block, under a front matter that reads: still the view's words
  const ruled = '---\nlooks: like\n---\n\nWords.\n';
  assert.deepEqual(publishText(front + ruled, ruled + 'More.\n', ruled), { text: front + ruled + 'More.\n', fromView: true });
  // The editor read the front matter differently, so the view's words may hold some of it: the document as saved
  const broken = '---\ndeck: 1\nsubtitle: Training: Day 1\n---\n\n```slide title\ntitle: Saved words\n```\n';
  assert.deepEqual(publishText(broken, '---\n\n## deck: 1 subtitle: Training: Day 1\n\n' + body, broken), { text: broken, fromView: false }, 'its YAML does not read');
  assert.deepEqual(publishText('\uFEFF' + broken, body, '\uFEFF' + broken), { text: '\uFEFF' + broken, fromView: false });
  const earlier = '---\ndeck: 1\n---note: A\nclient: B\n---\n\nbody\n';
  assert.deepEqual(publishText(earlier, '## note: A client: B\n\nbody\n', 'note: A\nclient: B\n---\n\nbody\n'), { text: earlier, fromView: false }, 'the editor ends it at an earlier line');
});

test("the text Publish builds from takes the view's look, still on its way to the document (Codex on #737)", () => {
  const body = '\n```slide title\ntitle: Words\n```\n';
  const card = '---\ndeck: 1\ntheme: Slide library/Themes/Evening.theme.md\n---\n';
  const borderless = '---\ndeck: 1\ntheme: Slide library/Themes/Evening.theme.md\nlook: borderless\n---\n';
  const options = { folderName: 'Client', deckName: 'Talk', theme: BUILT_IN_THEME };
  // The page Publish builds is the page the document makes once the look has reached it: the chip then reads Published
  const samePage = (text: string, caughtUp: string, message: string) => {
    assert.deepEqual(publicDeck(text, options), publicDeck(caughtUp, options), message);
    assert.equal(deckDigest(publicDeck(text, options)), deckDigest(publicDeck(caughtUp, options)), message);
  };
  // Borderless chosen a moment before the press: the document still says Card
  const toBorderless = publishText(card + body, body, body, 'borderless');
  assert.equal(toBorderless.fromView, true);
  assert.equal(publicDeck(toBorderless.text, options).look, 'borderless');
  samePage(toBorderless.text, borderless + body, 'Borderless');
  assert.equal(parseDeck(toBorderless.text).theme, 'Slide library/Themes/Evening.theme.md', 'the theme stays');
  // Card chosen: the document still says Borderless
  const toCard = publishText(borderless + body, body, body, 'card');
  assert.equal(publicDeck(toCard.text, options).look, 'card');
  samePage(toCard.text, card + body, 'Card');
  assert.equal(parseDeck(toCard.text).theme, 'Slide library/Themes/Evening.theme.md', 'the theme stays');
  // The document says the view's look already (by the view's rule): its front matter as written
  assert.deepEqual(publishText(borderless + body, body, body, 'borderless'), { text: borderless + body, fromView: true });
  assert.deepEqual(publishText(card + body, body, body, 'card'), { text: card + body, fromView: true });
  const capital = '---\ndeck: 1\nlook: Borderless\n---\n';
  assert.deepEqual(publishText(capital + body, body, body, 'card'), { text: capital + body, fromView: true }, 'the view reads it as Card too');
  // No front matter: one with the look, for Borderless only
  assert.equal(publishText(body, body, body, 'borderless').text, `---\nlook: borderless\n---\n${body}`);
  assert.deepEqual(publishText(body, body, body, 'card'), { text: body, fromView: true });
  // The look was all it held: an empty front matter that still reads as one
  const emptied = publishText(`---\nlook: borderless\n---\n${body}`, body, body, 'card');
  samePage(emptied.text, body, 'nothing left in the front matter');
  assert.equal(frontMatterField(emptied.text, 'look'), null);
  // Windows line ends, and a front matter at the end of the file
  assert.equal(publishText(`---\r\ndeck: 1\r\n---\r\n${body}`, body, body, 'borderless').text, `---\r\ndeck: 1\r\nlook: borderless\r\n---\r\n${body}`);
  assert.equal(publishText('---\ndeck: 1\n---', '', '', 'borderless').text, '---\ndeck: 1\nlook: borderless\n---\n');
  // The document as saved (the editor read its front matter differently) keeps its own look, as it keeps its words
  const broken = '---\ndeck: 1\nsubtitle: Training: Day 1\n---\n\n```slide title\ntitle: Saved words\n```\n';
  assert.deepEqual(publishText(broken, body, broken, 'borderless'), { text: broken, fromView: false });
});

// 16 November: the handout is a Text document; a part opens with its own heading.
test("a part's own heading: an H1 or H2 as the handout's first block, ATX or setext", () => {
  assert.deepEqual(partHeadingOf('## Four parts\n\nText.'), { level: 2, text: 'Four parts', end: 14 });
  assert.deepEqual(partHeadingOf('\n\n# Why agents? #\nText.'), { level: 1, text: 'Why agents?', end: 18 });
  assert.equal(partHeadingOf('Welcome\n=======\n')?.level, 1);
  assert.equal(partHeadingOf('Welcome\n---\n')?.text, 'Welcome');
  assert.equal(partHeadingOf('### Smaller\n'), null, 'an H3 is a heading in the text, not the part\'s');
  assert.equal(partHeadingOf('Text first.\n\n## Later\n'), null);
  assert.equal(partHeadingOf('- item\n---\n'), null, 'a list item over a line is no heading');
  // A setext heading as CommonMark (and marked, the editor's and the page's reader) reads one: several lines, marks inside.
  assert.deepEqual(partHeadingOf('Line one\nLine two\n---\nText'), { level: 2, text: 'Line one Line two', end: 22 });
  assert.equal(partHeadingOf('*Note* first\n===\n')?.level, 1, 'emphasis at its start is no list item');
  assert.equal(partHeadingOf('Title\n    more\n---\n')?.text, 'Title more', 'a lazy continuation line, whatever its indent');
  assert.equal(partHeadingOf('    code\n---\n'), null, 'indented code is no heading');
  assert.equal(partHeadingOf('Text\n\n---\n'), null, 'a line after a blank line is a line');
  assert.equal(partHeadingOf('***\n---\n'), null, 'a line over a line is no heading');
  assert.equal(partHeadingOf(''), null);
  assert.equal(handoutWithoutHeading('## Four parts\n\nText.'), '\nText.');
  assert.equal(handoutWithoutHeading('Text.'), 'Text.');
});

test('making a part writes its heading: H1 for a section, H2 otherwise, escaped; never a second one', () => {
  assert.equal(partHeadingLevel('section'), 1);
  assert.equal(partHeadingLevel('boxes'), 2);
  assert.equal(withPartHeading('boxes', { title: 'Four parts' }, 'Text.'), '## Four parts\n\nText.');
  assert.equal(withPartHeading('section', { title: 'Why agents?' }, ''), '# Why agents?');
  assert.equal(withPartHeading('points', { title: 'Agents *really* act' }, 'x'), '## Agents \\*really\\* act\n\nx');
  assert.equal(withPartHeading('points', { title: 'Four parts' }, '## Its own\n\nText.'), '## Its own\n\nText.', 'a part with its heading keeps it');
  assert.equal(withPartHeading('points', {}, 'Text.'), 'Text.', 'no title: no heading');
  assert.equal(withPartHeading('title', { title: EMPTY_DECK_TITLE }, ''), '', "New → Deck's words to type over are no heading");
  assert.equal(derivedHeading({ title: '  Spaced  ' }), 'Spaced');
  // A heading written for a title reads back as that title.
  for (const title of ['Step #1', '#hashtag', 'Under_score [link]', 'a <b> c', 'Ends with ###', 'Back\\slash']) {
    const heading = partHeadingOf(withPartHeading('points', { title }, ''))!;
    assert.equal(heading.text.replace(/\\(.)/g, '$1'), title, title);
  }
});


// 16 November: a deck whose handout is written with its own headings says so in its front matter, `handout: text`.
test('the handout: text mark: read, written into a front matter or a new one, never twice', () => {
  assert.equal(isTextHandout('---\ndeck: 1\nhandout: text\n---\n'), true);
  assert.equal(isTextHandout('---\ndeck: 1\n---\n'), false);
  assert.equal(isTextHandout('```slide title\nid: a\n```\n'), false);
  assert.equal(withTextHandoutMark('---\ndeck: 1\ntheme: T.theme.md\n---\n\nx\n'), '---\ndeck: 1\ntheme: T.theme.md\nhandout: text\n---\n\nx\n');
  assert.equal(withTextHandoutMark('```slide title\nid: a\n```\n'), '---\nhandout: text\n---\n\n```slide title\nid: a\n```\n');
  const marked = '---\ndeck: 1\nhandout: text\n---\n';
  assert.equal(withTextHandoutMark(marked), marked, 'never twice');
  assert.equal(withTextHandoutMark('---\nhandout: other\n---\n'), '---\nhandout: text\n---\n', 'another value is replaced');
  // An empty front matter takes the mark between its lines, never in the text after it.
  assert.equal(withTextHandoutMark('---\n---\n\nWords.\n\n---\n\nMore.\n'), '---\nhandout: text\n---\n\nWords.\n\n---\n\nMore.\n');
});

test('a deck written before the mark gets its headings and the mark together; its slide blocks stay byte for byte', () => {
  const older = [
    '---', 'deck: 1', '---', '',
    '```slide title', 'id: t1', 'title: AI assistants', '```', '', '## Welcome', '', 'Words.', '',
    '```slide section', 'id: s1', 'title: Why agents?', '```', '',
    '```slide points', 'id: p1', 'title: Agents act', '```', '', '```notes', 'Say hi.', '```', '', 'An agent acts.', '',
  ].join('\n');
  const written = withWrittenHandout(older);
  assert.equal(isTextHandout(written), true);
  assert.ok(written.includes('```slide section\nid: s1\ntitle: Why agents?\n```\n\n# Why agents?\n\n```slide points'), 'a section: its H1');
  assert.ok(written.includes('```notes\nSay hi.\n```\n\n## Agents act\n\nAn agent acts.'), 'after the notes: its H2');
  assert.ok(written.includes('## Welcome\n\nWords.') && !written.includes('## AI assistants'), 'a part with its own heading keeps it');
  const blocks = (text: string) => text.match(/```slide[\s\S]*?\n```/g);
  assert.deepEqual(blocks(written), blocks(older));
  assert.equal(withWrittenHandout(written), written, 'a marked deck is as it is');
});

// 16 November: an exercise's pill, `tag:`. Its words read back as the same string here and in any YAML reader, and
// `tag: ""` is kept as an empty string (no pill), never dropped as a missing line (the default).
test("an exercise's pill is written through writeScalar and read back by any YAML reader", () => {
  const body = 'id: ex01\ntitle: Try it\nitems:\n- heading: Open';
  for (const words of ['Harjutus', 'Step: one', 'Note:', '#1 of 3', 'Try it # now', 'yes', '2', '', ' padded ', 'Ülesanne']) {
    const written = writeSlideBody(body, { ...parseSlideBody(body), tag: words });
    assert.match(written, /^id: ex01\ntitle: Try it\ntag: .*\nitems:/, `${JSON.stringify(words)} goes after the title`);
    assert.equal(parseSlideBody(written).tag, words);
    assert.equal((yaml.load(written) as { tag: unknown }).tag, words, `${JSON.stringify(words)} in js-yaml`);
  }
  assert.equal(parseSlideBody(body).tag, undefined);
  assert.equal(writeSlideBody(body, parseSlideBody(body)), body);
  assert.equal(writeSlideBody(`${body.replace('Try it', 'Try it\ntag: ""')}`, { ...parseSlideBody(body), tag: undefined }), body, 'a line taken out leaves nothing behind');
});

console.log(`deckFormat: ${passed} passed`);
