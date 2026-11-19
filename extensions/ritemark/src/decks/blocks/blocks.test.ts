/**
 * Sprint 161, PR 1: block slides read and drawn, nothing written.
 *  - format v2: a bare `slide` fence, its optional header, `deck: 2`, the header-only writer;
 *  - `legacyToBlocks`: every v1 kind as blocks, "1. 1." numbers, `tag:` as a Label (Sprint 164), hidden words and old notes as one
 *    comment with `-->` made harmless;
 *  - the one renderer: its escaping, raw HTML and comments never drawn, no link or web picture, a picture alone a block;
 *  - privacy: a test word in every private place of a block deck and a mixed deck reaches neither the page, its digest,
 *    Publish's file list, nor the wall; and a v1 layout's hidden words no longer reach the wall's state;
 *  - "Your comments": the part's comments in order, and an older slide's notes and hidden words last;
 *  - library stamps: the block stamp, with every older `from:` stamp still matching.
 *
 * Run with `npx tsx src/decks/blocks/blocks.test.ts`.
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BUILT_IN_THEME } from '../deckTheme';
import { isBlockSlide, parseDeck, slideDataOf, splitBlockSlide, writeSlideData, isReadableDeckVersion, blockTitleOf, withWrittenHandout } from '../deckFormat';
import { DeckLibrary } from '../DeckLibrary';
import { conversionComment, legacyToBlocks, withoutItemNumber } from './legacyToBlocks';
import { blockPicturePaths, blockSlideHtml, blockSlideMarkup, isCoverSlide } from './slideRenderer';
import { parseFenceAttributes, scanFencedDiv } from './fencedDiv';
import { deckDigest, publicDeck } from '../page/publicDeck';
import { pageHtml, pictureAddress, pictureFile, type PageAssets, type PictureFrom } from '../page/pageHtml';
import { picturePaths, PAGE_FONTS } from '../page/pageFile';
import { PRIVATE_BLOCK_DECK, PRIVATE_BLOCK_IDS, PRIVATE_BLOCK_WORDS, PRIVATE_DECK, PRIVATE_WORDS, PUBLIC_BLOCK_WORDS } from '../page/testing/privateDeck';
import { PresentSession } from '../present/presentSession';
import { presenterStateOf, wallPicturePaths, wallStateOf } from '../present/presentProtocol';
import { partComments } from '../present/partComments';
import { rebaseSlide, slideStamp, slideStamps, slidesOfText } from '../deckLibraryFormat';
import { UNKNOWN_ICON } from '../../../webview/src/components/decks/slide/iconSet';
import { PAGE_ICON_PATHS, iconSvg, type PageIconName } from '../../../webview/src/components/decks/slide/pageIcons';

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

// ---------------------------------------------------------------------------
// Format v2
// ---------------------------------------------------------------------------

test('a bare slide fence is a block slide; deck: 2 is readable', () => {
  const deck = parseDeck('---\ndeck: 2\n---\n\n```slide\n# Hi\n```\n\n```slide points\ntitle: Old\n```\n');
  assert.deepEqual(deck.slides.map(slide => slide.kind), ['', 'points']);
  assert.ok(isBlockSlide(deck.slides[0].kind));
  assert.ok(!isBlockSlide('points'));
  assert.ok(isReadableDeckVersion('2'));
  assert.ok(!isReadableDeckVersion('3'));
});

test('the header: only between --- lines of keys; a first paragraph is never read as keys', () => {
  const body = '---\nid: ab12\nskip: true\npicture: right\nimage: images/a.png\n---\n# Title\n\nGoal: one';
  const parts = splitBlockSlide(body);
  assert.equal(parts.header, 'id: ab12\nskip: true\npicture: right\nimage: images/a.png');
  assert.equal(parts.markdown, '# Title\n\nGoal: one');
  assert.equal(parts.head + parts.markdown, body);
  const data = slideDataOf('', body);
  assert.deepEqual({ ...data }, { id: 'ab12', skip: true, picture: 'right', image: 'images/a.png', markdown: '# Title\n\nGoal: one', title: 'Title' });
  // No header: a rule, a setext heading, a sentence with a colon.
  for (const markdown of ['---\nText\n---', 'Goal: one\nPlan: two', '---\n\nA paragraph.', '# T\n---\nid: x\n---']) {
    assert.equal(splitBlockSlide(markdown).header, null, markdown);
    const read = slideDataOf('', markdown);
    assert.equal(read.id, undefined, markdown);
    assert.equal(read.markdown, markdown);
  }
  // Keys that are no header key (a title, items) are never read from a header.
  assert.equal(slideDataOf('', '---\ntitle: Sneaky\nid: q1\n---\nWords').title, undefined);
});

test('a block slide title: its first H1, else its first heading', () => {
  assert.equal(blockTitleOf('Intro\n\n### Copilot\n\n# The **real** title'), 'The real title');
  assert.equal(blockTitleOf(':::: columns\n::: column\n### Copilot\n:::\n::::'), 'Copilot');
  assert.equal(blockTitleOf('```\n# not a heading\n```\nText'), '');
  assert.equal(blockTitleOf('Setext title\n==='), 'Setext title');
});

test('the header writer changes only header lines; the Markdown stays byte for byte', () => {
  const body = '---\nid: ab12\n# a YAML comment\n---\n# Title\n\nid: not a key, a sentence';
  const data = slideDataOf('', body);
  assert.equal(writeSlideData('', body, data), body, 'nothing changed: the same bytes');
  assert.equal(writeSlideData('', body, { ...data, title: 'Changed', items: [{ heading: 'x' }] }), body, 'words are never written by the header writer');
  assert.equal(writeSlideData('', body, { ...data, skip: true }), '---\nid: ab12\nskip: true\n# a YAML comment\n---\n# Title\n\nid: not a key, a sentence', 'a new key in its place, as the v1 writer puts it');
  assert.equal(writeSlideData('', '# Title', { skip: true }), '---\nskip: true\n---\n# Title', 'a header is made when there is none');
  assert.equal(writeSlideData('', '---\nskip: true\n---\n# Title', { skip: undefined }), '# Title', 'an empty header goes');
  // A v1 slide is written as before.
  assert.equal(writeSlideData('points', 'title: A\nid: x', { title: 'B', id: 'x' }), 'title: B\nid: x');
});

// ---------------------------------------------------------------------------
// The `:::` scanner
// ---------------------------------------------------------------------------

test('fenced divs: nesting, code inside, attributes, and text that is no div', () => {
  const scan = scanFencedDiv(':::: columns\n::: column\nA\n:::\n::: column\n```\n:::\n```\n:::\n::::\nAfter')!;
  assert.equal(scan.raw, ':::: columns\n::: column\nA\n:::\n::: column\n```\n:::\n```\n:::\n::::\n');
  assert.deepEqual(scan.attrs.classes, ['columns']);
  assert.deepEqual(parseFenceAttributes('{.box icon="lightbulb" size=big}'), { classes: ['box'], id: null, values: { icon: 'lightbulb', size: 'big' } });
  assert.equal(parseFenceAttributes('{.box onclick=}'), null, 'an attribute it cannot read: no div');
  assert.equal(scanFencedDiv('::: column\nnever closed'), null);
  assert.equal(scanFencedDiv('Ratio 3:::4'), null);
});

// ---------------------------------------------------------------------------
// legacyToBlocks
// ---------------------------------------------------------------------------

test('every v1 kind as blocks', () => {
  assert.equal(legacyToBlocks('title', 'title: AI at work\nsubtitle: Harbour · 3 hours').markdown, '# AI at work\n\nHarbour · 3 hours');
  assert.equal(legacyToBlocks('statement', 'title: One idea').markdown, '# One idea');
  assert.equal(legacyToBlocks('section', 'number: "1"\ntitle: Why agents?').markdown, '1\n\n# Why agents?');
  assert.equal(legacyToBlocks('points', 'title: Today\nitems:\n- heading: Why\n  text: A reason\n- heading: How').markdown, '# Today\n\n1. Why\n   A reason\n2. How');
  assert.equal(
    legacyToBlocks('boxes', 'title: Four parts\nitems:\n- heading: Instructions\n  text: What it does\n  icon: list-checks\n- heading: Tools').markdown,
    '# Four parts\n\n:::: boxes\n::: {.box icon="list-checks"}\n### Instructions\nWhat it does\n:::\n::: box\n### Tools\n:::\n::::',
  );
  assert.equal(
    legacyToBlocks('boxes', 'title: Steps\nlook: steps\nitems:\n- heading: One\n  icon: target').markdown,
    '# Steps\n\n:::: {.boxes look="steps"}\n::: box\n### One\n:::\n::::',
    'a look that draws its own mark: no icon',
  );
  assert.equal(
    legacyToBlocks('columns', 'title: Copilot or Cursor?\nitems:\n- heading: Copilot\n  text: "Mail\\nDocuments"\n- heading: Cursor\n  text: Code').markdown,
    '# Copilot or Cursor?\n\n:::: columns\n::: column\n### Copilot\nMail\nDocuments\n:::\n::: column\n### Cursor\nCode\n:::\n::::',
  );
  assert.equal(legacyToBlocks('picture', 'title: The pilot\nimage: images/pilot one.png\nsubtitle: Week 3').markdown, '# The pilot\n\n![](<images/pilot one.png>)\n\nWeek 3');
  assert.equal(legacyToBlocks('table', 'title: Saved\nrows:\n- [Team, "Minutes | week"]\n- [Inbox, "40"]').markdown, '# Saved\n\n| Team | Minutes \\| week |\n| --- | --- |\n| Inbox | 40 |');
  const beside = legacyToBlocks('points', 'id: p1\ntitle: T\npicture: right\nimage: images/a.png\nskip: true\nfrom: x.deck.md#a @abc\nkept: true');
  assert.deepEqual(beside.header, { id: 'p1', from: 'x.deck.md#a @abc', skip: true, kept: true, picture: 'right', image: 'images/a.png' });
  // Unknown kinds: their title, as the stage draws them.
  assert.equal(legacyToBlocks('gamma.v2', 'title: Kept').markdown, '# Kept');
});

test('"1. 1.": the number that repeats the item\'s place goes; any other is escaped', () => {
  assert.equal(withoutItemNumber('1. Sisend', 1), 'Sisend');
  assert.equal(withoutItemNumber('3. Sisend', 1), '3. Sisend');
  assert.equal(legacyToBlocks('points', 'title: T\nitems:\n- heading: "1. Sisend"\n- heading: "2. Väljund"\n- heading: "7. Seven"').markdown, '# T\n\n1. Sisend\n2. Väljund\n3. 7\\. Seven');
  assert.equal(legacyToBlocks('exercise', 'title: T\nitems:\n- heading: "1. Open"').markdown, '[Exercise]{.label}\n\n# T\n\n::: steps\n1. Open\n:::');
});

test('Sprint 164 PR 3: tag: is a Label over the title; tag: "" is none; no tag: the default word', () => {
  assert.equal(legacyToBlocks('exercise', 'title: T\ntag: Harjutus\nitems:\n- heading: Open').markdown, '[Harjutus]{.label}\n\n# T\n\n::: steps\n1. Open\n:::');
  assert.equal(legacyToBlocks('exercise', 'title: T\ntag: ""\nitems:\n- heading: Open').markdown, '# T\n\n::: steps\n1. Open\n:::');
  assert.equal(legacyToBlocks('exercise', 'title: T\ntag: "  "\nitems:\n- heading: Open').markdown, '# T\n\n::: steps\n1. Open\n:::');
  // A block slide's old pill is drawn as the Label it becomes; an emptied one, and a Steps block without a tag, as none.
  assert.ok(blockSlideHtml('::: {.steps tag="Harjutus"}\n1. Open\n:::').startsWith('<div class="blk-label">Harjutus</div>\n<div class="blk-steps">'));
  assert.ok(!blockSlideHtml('::: {.steps tag=""}\n1. Open\n:::').includes('blk-label'));
  assert.ok(!blockSlideHtml('::: steps\n1. Open\n:::').includes('blk-label'));
  assert.ok(!blockSlideHtml('::: steps\n1. Open\n:::').includes('blk-pill'));
  assert.ok(parseFenceAttributes('{.steps tag="x"}'), 'the reader still reads the old line');
});

test('words a layout hides and old notes: one comment, -> made harmless, never on the slide', () => {
  const columns = legacyToBlocks('columns', 'title: T\nsubtitle: Sub\nitems:\n- heading: A\n- heading: B\n- heading: Gemini\n  text: third', 'Say this --> then that');
  assert.equal(columns.comment, '<!-- Say this --› then that\nHidden by the old layout: Sub\nHidden by the old layout: Gemini: third -->');
  assert.ok(!columns.markdown.includes('Gemini') && !columns.markdown.includes('Sub'));
  const exercise = legacyToBlocks('exercise', 'title: T\nitems:\n- heading: Open\n  text: secret line');
  assert.equal(exercise.comment, '<!-- Hidden by the old layout: step 1: secret line -->');
  const title = legacyToBlocks('title', 'title: T\nitems:\n- heading: kept for other layouts');
  assert.equal(title.comment, '<!-- Hidden by the old layout: kept for other layouts -->');
  assert.equal(legacyToBlocks('points', 'title: T\nitems:\n- heading: A').comment, null);
  assert.equal(conversionComment('a --!> b', []), '<!-- a --!› b -->');
  // The comment never closes early: only its own end is a `-->`.
  assert.equal((columns.comment!.match(/-->/g) ?? []).length, 1);
});

test('converted Markdown reads back the words as written', () => {
  const tricky = 'title: "*Not* bold # [link](x) <b>raw</b> & $5 `code`"\nsubtitle: "- not a list\\n## not a heading\\n::: not a div\\n> not a quote"';
  const html = blockSlideHtml(legacyToBlocks('title', tricky).markdown);
  assert.ok(html.includes('<h1>*Not* bold # [link](x) &lt;b&gt;raw&lt;/b&gt; &amp; $5 `code`</h1>'), html);
  assert.ok(html.includes('- not a list<br>## not a heading<br>::: not a div<br>&gt; not a quote'), html);
});

// ---------------------------------------------------------------------------
// The renderer
// ---------------------------------------------------------------------------

test('the renderer draws no raw HTML, no comment, no link and no web picture', () => {
  const html = blockSlideHtml('Hi <!-- secret --> <mark data-comment="note">words</mark> [l](javascript:alert(1)) ![x](https://e.com/a.png) <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n<div onclick="x">block</div>');
  for (const banned of ['secret', 'note', '<mark', 'href', 'javascript', 'https://e.com', '<img src=x', '<script', 'onclick', 'onerror']) assert.ok(!html.includes(banned), `${banned} in ${html}`);
  assert.ok(html.includes('words'), 'an anchored comment keeps its words');
  assert.ok(html.includes('<span class="blk-link">l</span>'));
  // An attribute value never breaks out of its attribute.
  const boxes = blockSlideHtml(':::: {.boxes look=\'x" onload="alert(1)\'}\n::: {.box icon="lightbulb"}\nA\n:::\n::::');
  assert.ok(boxes.includes('data-look="x&quot; onload=&quot;alert(1)"'), boxes);
  // A picture beside the deck through pictureUrl; alone in its paragraph it is a block of its own.
  const picture = blockSlideHtml('![A chart](images/a%20b.png)', { pictureUrl: path => `u/${path}` });
  assert.equal(picture, '<img class="blk-pic" src="u/images/a b.png" alt="A chart">\n');
  assert.deepEqual(blockPicturePaths('![](images/a%20b.png) ![](<images/c d.png>) ![](https://x/y.png) ![](/etc/z.png)'), ['images/a b.png', 'images/c d.png']);
});

test('#850: a box whose icon Ritemark doesn\'t know keeps its badge, with the dashed circle (red on main: an empty place)', () => {
  const dashed = PAGE_ICON_PATHS[UNKNOWN_ICON as keyof typeof PAGE_ICON_PATHS];
  assert.ok(dashed, 'the page carries the dashed circle');
  const boxes = (icon: string) => blockSlideHtml(`:::: boxes\n::: {.box icon="${icon}"}\n### Idea\n:::\n::::`);
  // A name Ritemark doesn't know: the badge, in its usual place before the words, with the dashed circle.
  for (const name of ['xyz', 'rocket-launch', 'Lightbulbs']) {
    const html = boxes(name);
    assert.ok(html.includes(`<div class="blk-box"><span class="blk-icon is-unknown">${iconSvg(UNKNOWN_ICON as PageIconName, 28)}</span><h3>Idea</h3>`), `${name}: ${html}`);
    assert.ok(!html.includes(name), `${name}: the unknown name itself is never drawn`);
  }
  // A known name, and another name for it, are drawn as before.
  assert.ok(boxes('lightbulb').includes(`<span class="blk-icon">${iconSvg('lightbulb', 28)}</span>`));
  assert.ok(boxes(' Chat ').includes(`<span class="blk-icon">${iconSvg('chat-text', 28)}</span>`));
  for (const name of ['lightbulb', 'chat']) assert.ok(!boxes(name).includes('is-unknown') && !boxes(name).includes(dashed), name);
  // No icon, or an empty one: no badge at all.
  assert.ok(!blockSlideHtml(':::: boxes\n::: box\n### Idea\n:::\n::::').includes('blk-icon'));
  assert.ok(!boxes('').includes('blk-icon') && !boxes('  ').includes('blk-icon'));
  // Looks that draw their own mark draw no icon, known or not; Arrows draws its arrow.
  for (const look of ['steps', 'line']) assert.ok(!blockSlideHtml(`:::: {.boxes look="${look}"}\n::: {.box icon="xyz"}\nA\n:::\n::::`).includes('blk-icon'), look);
  assert.ok(!blockSlideHtml(':::: {.boxes look="arrows"}\n::: {.box icon="xyz"}\nA\n:::\n::::').includes('is-unknown'));
  // The look: the badge's place, size and soft accent ground as every icon's; the dashed circle in the placeholder colour, on a card and borderless.
  const css = fs.readFileSync(path.join(__dirname, '../../../webview/src/components/decks/slide/slide.css'), 'utf8').replace(/\s+/g, ' ');
  assert.ok(css.includes('.deck-sl.is-blocks .blk-icon.is-unknown { color: var(--s-ph, rgba(255,255,255,.35)); }'), 'the placeholder colour');
  assert.ok(css.includes('.deck-slide.is-borderless .deck-sl.is-blocks .blk-icon.is-unknown { color: var(--s-ph, rgba(28,31,74,.3)); }'), 'borderless too');
  assert.ok(!/\.blk-icon\.is-unknown \{[^}]*(background|width|height|margin)/.test(css), 'its ground, size and place are the badge\'s own');
  // The wall and the presenter view get the slide as written (the name too) and draw it with the same renderer.
  const deck = '---\ndeck: 2\n---\n\n```slide\n---\nid: u1\n---\n# Parts\n\n:::: boxes\n::: {.box icon="xyz"}\n### Idea\n:::\n::::\n```\n';
  const view = new PresentSession(deck, { from: 'start' }).view();
  const [slide] = wallStateOf(view, { borderless: false, theme: BUILT_IN_THEME }, {}).slides;
  assert.ok(slide.data.markdown?.includes('::: {.box icon="xyz"}'), 'the name as written');
  for (const borderless of [false, true]) {
    assert.ok(blockSlideMarkup(slide.data, { theme: BUILT_IN_THEME, borderless }).includes('<span class="blk-icon is-unknown">'), `the wall, borderless ${borderless}`);
  }
});

test('the cover look and the fit', () => {
  assert.ok(isCoverSlide('# Title\n\nA line under it'));
  assert.ok(isCoverSlide('1\n\n# Why agents?'));
  assert.ok(!isCoverSlide('# Title\n\n1. A\n2. B'));
  const markup = blockSlideMarkup({ markdown: '# T', picture: 'left', image: 'images/p.png' }, { theme: BUILT_IN_THEME, borderless: true, step: 9, width: 480, pictureUrl: path => `u/${path}` });
  assert.ok(markup.startsWith('<div class="deck-slide is-borderless" style="width:480px;height:270px">'), markup);
  assert.ok(markup.includes('class="deck-sl is-blocks pic-left is-cover"'));
  assert.ok(markup.includes('--fit:0.6'), 'a step past the last is the last');
  assert.ok(markup.includes('background-image:url(&quot;u/images/p.png&quot;)'));
});

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

const extension = path.resolve(__dirname, '..', '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(extension, 'media', 'fonts', font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
};
const there = new Set(['images/pilot.png']);
const pictureUrl = (picture: string, from: PictureFrom) => {
  const file = pictureFile(picture, from);
  return there.has(file) ? pictureAddress(file) : null;
};

test('a block deck: no private word reaches the page, its digest, the file list or the wall', () => {
  const deck = publicDeck(PRIVATE_BLOCK_DECK, { folderName: 'Harbour Logistics', deckName: 'Blocks', theme: BUILT_IN_THEME });
  const html = pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl });
  const files = JSON.stringify(picturePaths(deck));
  const publicJson = JSON.stringify(deck);
  for (const [place, word] of Object.entries(PRIVATE_BLOCK_WORDS)) {
    assert.ok(!html.includes(word), `${place} (${word}) is in the page`);
    assert.ok(!files.includes(word), `${place} (${word}) is in Publish's file list`);
    // Raw HTML is no secret (it is the person's own text), but it never draws: it may stay in the data, never in the page.
    if (place !== 'rawHtml') assert.ok(!publicJson.includes(word), `${place} (${word}) is in publicDeck`);
  }
  for (const word of PUBLIC_BLOCK_WORDS) assert.ok(html.includes(word) || files.includes(word), `${word} is missing from the page`);
  assert.equal(deck.title, 'Block cover', 'a deck of block slides takes its cover slide\'s title');
  // PR 2 (decision 8): the v1 Columns slide goes out as the block slide its conversion writes.
  assert.deepEqual(deck.slides.map(slide => slide.kind), ['', '', '', ''], 'the skipped block slide is left out, and a v1 slide goes out as blocks');
  assert.ok(html.includes('class="deck-sl is-blocks'), 'block slides are drawn by the block renderer');
  assert.ok(html.includes('data-exercise=""'), 'a block slide with Steps is an exercise on the page');

  const session = new PresentSession(PRIVATE_BLOCK_DECK, { from: 'start' });
  const look = { borderless: false, theme: BUILT_IN_THEME };
  for (let step = 0; step < 5; step++) {
    const view = session.view();
    const wall = JSON.stringify(wallStateOf(view, look, {}));
    for (const [place, word] of Object.entries(PRIVATE_BLOCK_WORDS)) {
      if (place !== 'rawHtml') assert.ok(!wall.includes(word), `${place} (${word}) reached the wall at step ${step}`);
    }
    assert.ok(!wallPicturePaths(view).some(picture => picture.includes(PRIVATE_BLOCK_WORDS.skippedBlockPicture)));
    // The wall's drawing of each slide shows no private word either (raw HTML included).
    for (const slide of wallStateOf(view, look, {}).slides) {
      if (slide.kind !== '') continue;
      const drawn = blockSlideMarkup(slide.data, { theme: BUILT_IN_THEME, borderless: false });
      for (const word of Object.values(PRIVATE_BLOCK_WORDS)) assert.ok(!drawn.includes(word), `${word} drawn on the wall`);
    }
    session.move(PRIVATE_BLOCK_DECK, { type: 'next' });
  }
});

test('Sprint 161: a comment on the slide never goes out: the page, its digest, the wall, any thumbnail, the presenter view', () => {
  const slideComments = [PRIVATE_BLOCK_WORDS.slideBlockNote, PRIVATE_BLOCK_WORDS.slideWholeNote, PRIVATE_BLOCK_WORDS.slideTitleNote, PRIVATE_BLOCK_WORDS.slideRequest, PRIVATE_BLOCK_WORDS.slideMarkId, ...PRIVATE_BLOCK_IDS];
  const deck = publicDeck(PRIVATE_BLOCK_DECK, { folderName: 'Harbour Logistics', deckName: 'Blocks', theme: BUILT_IN_THEME });
  const bytes = JSON.stringify(deck) + pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl });
  for (const word of slideComments) assert.ok(!bytes.includes(word), `${word} reached the page`);
  assert.ok(bytes.includes('Pick a question'), 'the words a request is on stay');
  // A comment never changes how a slide is drawn: the cover with a note on the whole slide is still the cover.
  assert.equal(deck.title, 'Block cover');
  const cover = parseDeck(PRIVATE_BLOCK_DECK).slides[0];
  assert.equal(isCoverSlide(slideDataOf(cover.kind, cover.body).markdown ?? ''), true);
  // The digest: adding, changing or removing a slide comment never shows the page as changed.
  const digest = (text: string) => deckDigest(publicDeck(text, { folderName: 'H', deckName: 'B', theme: BUILT_IN_THEME }));
  const before = digest(PRIVATE_BLOCK_DECK);
  assert.equal(digest(PRIVATE_BLOCK_DECK.replace('# Steps\n', '# Steps\n\n<!-- {id:77777777-7777-4777-8777-777777777777} new -->\n')), before, 'a note added');
  assert.equal(digest(PRIVATE_BLOCK_DECK.replace(PRIVATE_BLOCK_WORDS.slideBlockNote, 'changed')), before, 'a note changed');
  assert.equal(digest(PRIVATE_BLOCK_DECK.replace(`<!-- {id:${PRIVATE_BLOCK_IDS[2]}} @chatgpt ${PRIVATE_BLOCK_WORDS.slideBlockNote} -->\n\n`, '')), before, 'a note removed');
  // Every thumbnail and drawing is the one renderer's, which draws no comment: the strip and the library panel draw
  // the slide as written (not the public copy), so that is what is checked here.
  for (const slide of parseDeck(PRIVATE_BLOCK_DECK).slides) {
    if (!isBlockSlide(slide.kind)) continue;
    const drawn = blockSlideMarkup(slideDataOf(slide.kind, slide.body), { theme: BUILT_IN_THEME, borderless: false });
    for (const word of slideComments) assert.ok(!drawn.includes(word), `${word} drawn on a thumbnail`);
  }
  // The presenter view shows the handout part's comments only, never the slide's.
  const session = new PresentSession(PRIVATE_BLOCK_DECK, { from: 'start' });
  const look = { borderless: false, theme: BUILT_IN_THEME };
  const shown: string[] = [];
  for (let step = 0; step < 4; step++) {
    const state = presenterStateOf(session.view(), look, {}, { wallDisplay: null, canSwap: false, length: null, startedAt: 0 });
    shown.push(...state.comments.map(comment => comment.note))
    const wall = JSON.stringify(wallStateOf(session.view(), look, {}));
    for (const word of slideComments) assert.ok(!wall.includes(word), `${word} reached the wall`);
    session.move(PRIVATE_BLOCK_DECK, { type: 'next' });
  }
  assert.ok(shown.includes(PRIVATE_BLOCK_WORDS.partComment), 'the presenter view shows the handout part\'s comment');
  for (const word of slideComments) assert.ok(!shown.some(note => note.includes(word)), `${word} shown in the presenter view`);
});

test('a v1 layout\'s hidden words no longer reach the wall\'s state (red on main: they were copied field by field)', () => {
  const session = new PresentSession(PRIVATE_DECK, { from: 'start' });
  const look = { borderless: false, theme: BUILT_IN_THEME };
  const hidden = [PRIVATE_WORDS.hiddenItem, PRIVATE_WORDS.exerciseLine, PRIVATE_WORDS.thirdColumn, PRIVATE_WORDS.iconOfLine];
  for (let step = 0; step < 6; step++) {
    const wall = JSON.stringify(wallStateOf(session.view(), look, {}));
    for (const word of hidden) assert.ok(!wall.includes(word), `${word} reached the wall at step ${step}`);
    session.move(PRIVATE_DECK, { type: 'next' });
  }
});

// ---------------------------------------------------------------------------
// Your comments
// ---------------------------------------------------------------------------

test('the presenter view gets the current part\'s comments, in order, and nothing from code', () => {
  const comments = partComments('Text\n\n<!-- {id:0f8e2b1c-3d4a-4e5f-8a9b-0c1d2e3f4a5b} Story first.\nTwo minutes. -->\n\nThe <mark data-comment="say &quot;40&quot;">40 *minutes*</mark> saved.\n\n- an item <!-- in a list -->\n\n```\n<!-- a prompt -->\n```\n\n`<!-- code span -->`\n');
  assert.deepEqual(comments, [
    { note: 'Story first.\nTwo minutes.' },
    { note: 'say "40"', words: '40 minutes' },
    { note: 'in a list' },
  ]);
  assert.deepEqual(partComments('No comments here.'), []);

  const text = '```slide columns\ntitle: T\nitems:\n- heading: A\n- heading: B\n- heading: Gemini\n```\n\n```notes\nWelcome them.\n```\n\nHandout <!-- check the room -->\n\n```slide\n# Block\n```\n\n<!-- one -->\n\n<!-- two -->\n';
  const session = new PresentSession(text, { from: 'start' });
  const look = { borderless: false, theme: BUILT_IN_THEME };
  const first = presenterStateOf(session.view(), look, {}, { wallDisplay: null, canSwap: false, length: null, startedAt: 0 });
  assert.deepEqual(first.comments, [{ note: 'check the room' }, { note: 'Welcome them.\nHidden by the old layout: Gemini' }], 'an older slide: its part\'s comments, then its notes and hidden words');
  assert.ok(!JSON.stringify(wallStateOf(session.view(), look, {})).includes('check the room'), 'never on the wall');
  session.move(text, { type: 'next' });
  const second = presenterStateOf(session.view(), look, {}, { wallDisplay: null, canSwap: false, length: null, startedAt: 0 });
  assert.deepEqual(second.comments, [{ note: 'one' }, { note: 'two' }]);
});

// ---------------------------------------------------------------------------
// Library stamps
// ---------------------------------------------------------------------------

test('stamps: the block stamp first; every from: stamp written before still matches', () => {
  const body = 'id: a1\ntitle: Four parts\nitems:\n- heading: Instructions\n  icon: list-checks';
  const data = slideDataOf('boxes', body);
  const stamps = slideStamps('boxes', data, '## Four parts\n\nText.', 'Slide library');
  assert.equal(stamps[0], slideStamp('boxes', data, '## Four parts\n\nText.', 'Slide library'));
  assert.equal(stamps.length, 3, 'today\'s, and the two v1 stamps');
  // The v1 slide and its conversion (the comment it writes in its part included) have the same stamp.
  const converted = legacyToBlocks('columns', 'title: T\nitems:\n- heading: A\n- heading: B\n- heading: C', 'Notes.');
  const v1 = slideStamp('columns', slideDataOf('columns', 'title: T\nitems:\n- heading: A\n- heading: B\n- heading: C'), 'Text.', '');
  const v2 = slideStamp('', slideDataOf('', converted.markdown), `Text.\n\n${converted.comment}`, '');
  assert.equal(v2, v1);
  // Words on the slide change it; a comment does not.
  assert.notEqual(slideStamp('', slideDataOf('', '# T\n\nNew words'), '', ''), slideStamp('', slideDataOf('', '# T\n\nOld words'), '', ''));
  assert.equal(slideStamp('', slideDataOf('', '# T\n\nWords <!-- a --> '), '', ''), slideStamp('', slideDataOf('', '# T\n\nWords <!-- b --> '), '', ''));
  // A block slide's own header is no part of it.
  assert.equal(slideStamp('', slideDataOf('', '---\nid: a\n---\n# T'), '', ''), slideStamp('', slideDataOf('', '# T'), '', ''));
});

test('the library reads a mixed deck: ids, from lines and pictures of block slides', () => {
  const slides = slidesOfText(PRIVATE_BLOCK_DECK);
  assert.deepEqual(slides.map(slide => slide.data.id ?? null), [null, PRIVATE_BLOCK_WORDS.headerId, null, null, null]);
  assert.equal(slides[3].data.skip, true);
  assert.ok(slides[1].data.from?.includes(PRIVATE_BLOCK_WORDS.headerFrom));
});

// ---------------------------------------------------------------------------
// Review round 1 (code-review high on #760): each finding, red before its fix
// ---------------------------------------------------------------------------

test('R1-1: a heading inside a comment is never the title on the page, the wall or the go-to box', () => {
  const text = '---\ndeck: 2\n---\n\n```slide\n<!--\n# Secret price 10k\n-->\nJust words\n```\n\n```slide\n# <mark data-comment="private note">Title</mark>\n```\n';
  const deck = publicDeck(text, { folderName: 'F', deckName: 'D', theme: BUILT_IN_THEME });
  const bytes = JSON.stringify(deck) + pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl });
  assert.ok(!bytes.includes('Secret price') && !bytes.includes('private note'), 'the page');
  assert.equal(deck.slides[1].data.title, 'Title');
  const session = new PresentSession(text, { from: 'start' });
  const wall = JSON.stringify(wallStateOf(session.view(), { borderless: false, theme: BUILT_IN_THEME }, {}));
  assert.ok(!wall.includes('Secret price') && !wall.includes('private note'), 'the wall');
  assert.equal(slideDataOf('', '<!--\n# Secret\n-->\nWords').title, undefined, 'the strip and the go-to box');
});

test('R1-2: a block slide\'s notes block reaches "Your comments"', () => {
  const session = new PresentSession('```slide\n# T\n```\n\n```notes\nSay hello\n```\n', { from: 'start' });
  const state = presenterStateOf(session.view(), { borderless: false, theme: BUILT_IN_THEME }, {}, { wallDisplay: null, canSwap: false, length: null, startedAt: 0 });
  assert.deepEqual(state.comments, [{ note: 'Say hello' }]);
});

test('R1-3: a header write keeps every line it doesn\'t change, a title: line someone wrote there too', () => {
  const body = '---\nid: a\nlayout: wide\n# keep me\nsubtitle: hi\ntitle: There\n---\n# T';
  assert.equal(writeSlideData('', body, { ...slideDataOf('', body), id: 'b' }), '---\nid: b\nlayout: wide\n# keep me\nsubtitle: hi\ntitle: There\n---\n# T');
});

test('R1-4: --- # Agenda --- is a rule, a heading and a rule, not a header', () => {
  assert.equal(splitBlockSlide('---\n# Agenda\n---\nText').header, null);
  assert.equal(slideDataOf('', '---\n# Agenda\n---\nText').title, 'Agenda');
  assert.equal(splitBlockSlide('---\n# a YAML comment\nskip: true\n---\nText').header, '# a YAML comment\nskip: true');
});

test('R1-5: an anchored comment in a handout table reaches "Your comments"', () => {
  assert.deepEqual(partComments('| a | b |\n| - | - |\n| <mark data-comment="n1">x</mark> | y |'), [{ note: 'n1', words: 'x' }]);
});

test('R1-6: a block slide copied to another folder gets its pictures rebased', () => {
  const rebased = rebaseSlide('# T\n\n![](pic.png)', '', 'a', 'b/c', '');
  assert.equal(rebased.body, '# T\n\n![](../../a/pic.png)');
});

test('R1-7: a v1 slide whose words hold "<!--" keeps every later word in its stamp', () => {
  const base = 'title: "Use <!-- for notes"\nitems:\n- heading: One';
  assert.notEqual(slideStamp('points', slideDataOf('points', base), '', ''), slideStamp('points', slideDataOf('points', base.replace('One', 'Two')), '', ''));
});

// ---------------------------------------------------------------------------
// The security review of #760: marked's raw mode never hands on a live tag
// ---------------------------------------------------------------------------

test('S-1: a tag after <kbd>, <code>, <pre> or <script> is text on the slide and on the page', () => {
  const payloads = [
    'x <kbd> <img/src=x onerror=alert(1)>',
    '# T <code> <svg/onload=alert(1)>',
    '| a |\n| - |\n| <pre> <img/src=x onerror=alert(1)> |',
    '[link <script> <img/src=x onerror=alert(1)>](x)',
    'Words <kbd> <meta/http-equiv="refresh"/content="0;url=//evil.example/"><a/href="//evil.example/login">Sign in</a>',
  ];
  for (const markdown of payloads) {
    const html = blockSlideHtml(markdown);
    assert.ok(!/<(img|svg|meta|a)[\s/]/i.test(html), `a live tag on the slide: ${html}`);
  }
  const text = `\`\`\`slide\n# T\n\n${payloads[4]}\n\`\`\`\n`;
  const deck = publicDeck(text, { folderName: 'F', deckName: 'D', theme: BUILT_IN_THEME });
  const page = pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl });
  assert.ok(!/<meta\/http-equiv|<a\/href/i.test(page), 'no live tag on the page');
});

// ---------------------------------------------------------------------------
// Review round 2 (code-review high on #760)
// ---------------------------------------------------------------------------

test('R2-1: a block slide\'s part gets its heading when an unmarked deck is written as a Text handout', () => {
  const out = withWrittenHandout('```slide\n# Copilot or Cursor?\n```\n\nText.\n');
  assert.ok(out.includes('```\n\n## Copilot or Cursor?\n\nText.'), out);
});

test('R2-4: a picture a v1 layout doesn\'t draw is never asked for by the wall', () => {
  const session = new PresentSession('```slide points\ntitle: T\nimage: private/secret.png\n```\n', { from: 'start' });
  assert.deepEqual(wallPicturePaths(session.view()), []);
});

test('R2-5: a line of dashes in converted words stays words', () => {
  const html = blockSlideHtml(legacyToBlocks('title', 'title: T\nsubtitle: "Pros\\n--\\nCons\\n---"').markdown);
  assert.ok(!/<h2|<hr/.test(html), html);
  assert.ok(html.includes('Pros<br>--<br>Cons<br>---'), html);
});

test('R2-6: a pill with a quote keeps its words (a Label since Sprint 164)', () => {
  const markdown = legacyToBlocks('exercise', 'title: T\ntag: \'Say "hi" [now]\'\nitems:\n- heading: One').markdown;
  assert.ok(markdown.startsWith('[Say "hi" \\[now\\]]{.label}\n\n# T'), markdown);
  assert.ok(blockSlideHtml(markdown).includes('<div class="blk-label">Say &quot;hi&quot; [now]</div>'), markdown);
});

// ---------------------------------------------------------------------------
// Sprint 164 PR 3 (the decks README, "Label, a block of its own")
// ---------------------------------------------------------------------------

test('Label: one `[words]{.label}` line is drawn as its pill, anywhere on the slide; nothing else is', () => {
  const html = blockSlideHtml('[Exercise · 1 / 2]{.label}\n\n# Try it\n\n:::: columns\n::: column\n[In a column]{.label}\n:::\n::::\n\n:::: boxes\n::: box\n[In a box]{.label}\n\nWords\n:::\n::::\n\n::: {.panel-tabset}\n## One\n\n[In a pane]{.label}\n:::');
  for (const words of ['Exercise · 1 / 2', 'In a column', 'In a box', 'In a pane']) assert.ok(html.includes(`<div class="blk-label">${words}</div>`), `${words}: ${html}`);
  assert.ok(html.startsWith('<div class="blk-label">Exercise · 1 / 2</div>\n<h1'), 'over the title');
  // Its words are text: escaped for the page, its own escapes read; other attributes beside the class stay unread.
  assert.ok(blockSlideHtml('[<img src=x onerror=alert(1)> & \\[x\\]]{.label #id data-x="y"}').includes('<div class="blk-label">&lt;img src=x onerror=alert(1)&gt; &amp; [x]</div>'));
  // Only a paragraph that is that one line: a span inside words, a link, another class, a space before the braces.
  for (const markdown of ['Words\n[x]{.label}', '[x](https://example.com){.label}', '[x]{.tag}', '[x] {.label}', '`[x]{.label}`', '```\n[x]{.label}\n```']) {
    assert.ok(!blockSlideHtml(markdown).includes('blk-label'), markdown);
  }
  // A title slide with a Label over its title is still a title slide (a Label is free).
  assert.equal(isCoverSlide('[Workshop]{.label}\n\n# Agents at work\n\nThree hours'), true);
});

test('Label: an empty one is never drawn, on the strip, the wall or the page', () => {
  for (const markdown of ['[]{.label}\n\n# T', '[   ]{.label}\n\n# T']) {
    assert.ok(!blockSlideHtml(markdown).includes('blk-label'), markdown);
    const deck = publicDeck(`---\ndeck: 2\n---\n\n\`\`\`slide\n${markdown}\n\`\`\`\n`, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME });
    assert.ok(!pageHtml(deck, { slideCss: '', fonts: [] }, { digest: deckDigest(deck), pictureUrl: () => null }).includes('blk-label'), `the page: ${markdown}`);
  }
});

test('Label: slides only. In the handout it is the words it is, on the page too', () => {
  const text = '---\ndeck: 2\n---\n\n```slide\n[On the slide]{.label}\n\n# T\n```\n\n## T\n\n[In the handout]{.label}\n';
  const deck = publicDeck(text, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME });
  const html = pageHtml(deck, { slideCss: '', fonts: [] }, { digest: deckDigest(deck), pictureUrl: () => null });
  assert.ok(html.includes('<div class="blk-label">On the slide</div>'), 'the page draws the slide\'s Label as the slide does');
  assert.ok(html.includes('[In the handout]{.label}'), 'the handout shows its words as written');
  assert.ok(!html.includes('<div class="blk-label">In the handout</div>'));
});

test('R2-7: a setext H2 names a slide that has no H1', () => {
  assert.equal(blockTitleOf(':::: columns\n::: column\nCopilot\n---\nText\n:::\n::::'), 'Copilot');
});

test('the title keeps half its size of room before what follows; a line under it (H2) stays close', () => {
  // The Experience lead on #760. One rule in the shared slide CSS, so every view that draws a block slide has it.
  const css = assets.slideCss;
  assert.match(css, /\.deck-sl\.is-blocks h1 \{ margin: 0 0 \.5em;/);
  assert.match(css, /\.deck-sl\.is-blocks h1 \+ \* \{ margin-top: 0; \}/);
  assert.match(css, /\.deck-sl\.is-blocks h1:has\(\+ h2\) \{ margin-bottom: \.12em; \}/);
  assert.ok(!/is-blocks[^{]*h1 \+ (?:p|h2|:not)[^{]*\{[^}]*margin-top: \.5em/.test(css), 'no other rule adds to the title\'s room');
});

console.log(`blocks: ${passed} passed`);

// PR 2: the library's writes convert the parts they write, and a deck holding a block slide says `deck: 2` (async, so
// after the synchronous tests). Its other slides stay as written: a mixed deck is legal.
void (async () => {
  const files: Record<string, string> = {
    'Blocks.deck.md': '---\ndeck: 2\n---\n\n```slide\n---\nid: b1\n---\n# Block\n```\n',
    'Old.deck.md': '---\ndeck: 1\n---\n\n```slide title\nid: t1\ntitle: Old\n```\n',
    'New.deck.md': '---\ndeck: 2\n---\n\n```slide title\nid: t2\ntitle: New\n```\n',
    'Source.deck.md': '---\ndeck: 1\n---\n\n```slide columns\nid: c1\ntitle: Two ways\nitems:\n  - heading: Copilot\n    text: Mail\n  - heading: Cursor\n  - heading: THIRDCOLUMN\n```\n\n```notes\nNOTESWORD\n```\n\n## Two ways\n\nRead this.\n',
  };
  const library = new DeckLibrary({
    async list() { return Object.keys(files).map((path, index) => ({ path, modified: index })); },
    async read(path) { return files[path] ?? null; },
    async write(path, text) { files[path] = text; },
  });
  await library.insertCopies('Blocks.deck.md', ['b1'], 'Old.deck.md', undefined);
  assert.ok(files['Old.deck.md'].startsWith('---\ndeck: 2\n'), 'the older deck says deck: 2 with its first block slide');
  assert.ok(files['Old.deck.md'].includes('```slide title\nid: t1\ntitle: Old\n```'), 'its own slide stays as written');
  assert.ok(files['Old.deck.md'].includes('# Block'));
  await library.insertCopies('Blocks.deck.md', ['b1'], 'New.deck.md', undefined);
  assert.ok(files['New.deck.md'].includes('# Block'));
  // A v1 copy goes in as a block slide: the third column (hidden by its layout) a comment in its handout, never its notes.
  await library.insertCopies('Source.deck.md', ['c1'], 'New.deck.md', undefined);
  const written = files['New.deck.md'];
  assert.ok(/```slide\n---\nid: \w+\nfrom: Source\.deck\.md#c1 @\w+\n---\n# Two ways\n\n:::: columns/.test(written), written);
  assert.ok(written.includes('<!-- Hidden by the old layout: THIRDCOLUMN -->'), 'the hidden column is a comment');
  assert.ok(!written.includes('NOTESWORD'), 'a copy never brings the notes');
  assert.ok(!/```slide columns/.test(written), 'no v1 copy is written');
  console.log('blocks (library): the library writes block slides, and the deck says deck: 2');
})().catch(error => { console.error(error); process.exit(1); });
