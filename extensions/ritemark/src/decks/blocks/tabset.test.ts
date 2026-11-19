/**
 * Sprint 163 (PR 2): the Tabs block as text. Quarto's `::: {.panel-tabset}` with a heading per tab, read and written
 * back byte for byte; a tab's heading never a slide's title, a part's heading, a section or an entry in the page's
 * Contents; drawn by the one renderer with its first tab (or Present's choice) and every pane carrying its name for
 * print; the page's handout showing every tab under its name.
 *
 * Run: npx tsx src/decks/blocks/tabset.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'node-html-parser';
import { scanFencedDiv } from './fencedDiv';
import { TABSET_CLOSE, TABSET_OPEN, newTabsetMarkdown, renamedTabLine, tabHeadingLine, tabsetMarkdown, tabsetOf, tabsetOfInner, tabsetStart, type TabsetLines } from './tabset';
import { agendaOf, blockCanvasMarkup, blockPicturePaths, blockRevealCount, blockSlideHtml, isCoverSlide } from './slideRenderer';
import { blockTitleOf, fenceFor, parseDeck, partHeadingOf, slideDataOf } from '../deckFormat';
import { PAGE_CSS, PRINT_CSS, handoutHtml } from '../page/pageHtml';
import { lexHandout, publicMarkdown } from '../page/publicDeck';
import { decodeWallRequest } from '../present/presentProtocol';
import { tabsOf, withTab } from '../present/wallTabs';
import { slideCommentsOf } from './slideComments';
import { partComments } from '../present/partComments';
import { plainTabName } from './tabset';
import { PAGE_SCRIPT } from '../page/pageScript';

let passed = 0;
function test(name: string, run: () => void): void {
  try {
    run();
    passed += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

/** A Tabs block's text read with the scanner and the reader, then written back with the writer. */
function roundTrip(text: string): string {
  const scan = scanFencedDiv(text);
  assert.ok(scan, 'the block scans');
  const tabset = tabsetOf(scan);
  assert.ok(tabset, 'the block reads as tabs');
  const lines: TabsetLines = { open: scan.openLine, close: scan.closeLine, gapOpen: scan.gapOpen, gapClose: scan.gapClose, tabs: tabset.tabs };
  return tabsetMarkdown(lines) + (text.endsWith('\n') ? '\n' : '');
}

const QUARTO = [
  '::: {.panel-tabset}',
  '## R',
  '',
  '```r',
  'fizz_buzz <- function(xs) {',
  '## a comment in R, not a tab',
  '}',
  '```',
  '',
  '## Python',
  '',
  '```python',
  'def fizz_buzz(xs):',
  '```',
  '',
  ':::',
].join('\n');

const WORKBOOK = [
  '::: {.panel-tabset}',
  '',
  '## 1 · Plan',
  '',
  'Change the parts in square brackets before you send it.',
  '',
  '```',
  'You are an analyst at Fernhollow Bank. I have added [the report].',
  '```',
  '',
  '## 2 · Collect',
  'Go through the chapters.',
  '## 3 · Analyse {#analyse}',
  '',
  ':::: columns',
  '::: column',
  '## Inside a column: content, not a tab',
  ':::',
  '::::',
  '',
  '### A smaller heading is the pane\'s',
  '',
  '## 4 · Write and *check*',
  '',
  ':::',
].join('\n');

test('Quarto\'s own tabset reads as two tabs, a `##` in code staying code', () => {
  const tabset = tabsetOf(scanFencedDiv(QUARTO)!);
  assert.equal(tabset?.level, 2);
  assert.deepEqual(tabset?.tabs.map(tab => tab.name), ['R', 'Python']);
  assert.ok(tabset?.tabs[0].markdown.includes('## a comment in R, not a tab'));
});

test('the workbook\'s tabs: their names without marks or attributes, and a heading inside a column or a smaller one stays in the pane', () => {
  const tabset = tabsetOf(scanFencedDiv(WORKBOOK)!);
  assert.deepEqual(tabset?.tabs.map(tab => tab.name), ['1 · Plan', '2 · Collect', '3 · Analyse', '4 · Write and check']);
  assert.ok(tabset?.tabs[2].markdown.includes('Inside a column'));
  assert.ok(tabset?.tabs[2].markdown.includes('### A smaller heading'));
  assert.equal(tabset?.tabs[1].tight, false);
  assert.equal(tabset?.tabs[2].tight, true, 'the third heading follows the second pane\'s line directly');
  assert.equal(tabset?.tabs[1].gap, false);
});

test('a Tabs block read and written back is byte for byte, whatever its blank lines', () => {
  for (const text of [QUARTO, `${QUARTO}\n`, WORKBOOK, newTabsetMarkdown(), newTabsetMarkdown(['Cursor', 'Claude', 'ChatGPT']), `${TABSET_OPEN}\n## A\n## B\n${TABSET_CLOSE}`, `${TABSET_OPEN}\n\n## A\n\n\n## B\n\nwords\n\n${TABSET_CLOSE}`.replace('\n\n\n', '\n\n')]) {
    assert.equal(roundTrip(text), text);
  }
});

test('a new block is Tab 1 and Tab 2, written as Quarto writes them', () => {
  assert.equal(newTabsetMarkdown(), '::: {.panel-tabset}\n## Tab 1\n\n## Tab 2\n\n:::');
});

test('a div that isn\'t one this reader reads as tabs stays as written', () => {
  assert.equal(tabsetOf(scanFencedDiv('::: {.panel-tabset}\nWords before any tab\n\n## A\n:::')!), null);
  assert.equal(tabsetOf(scanFencedDiv('::: {.panel-tabset}\n:::')!), null);
  assert.equal(tabsetOf(scanFencedDiv('::: columns\n## A\n:::')!), null);
  assert.equal(tabsetOfInner('\n\n'), null);
});

test('a renamed tab keeps its level and its attribute block; its words are escaped so they read back the same', () => {
  assert.equal(renamedTabLine('## 1 · Plan', 'Plan *first*'), '## Plan \\*first\\*');
  assert.equal(renamedTabLine('### Old {#keep}', 'New'), '### New {#keep}');
  assert.equal(renamedTabLine('## Same', 'Same'), '## Same');
  assert.equal(tabHeadingLine(2, 'C#'), '## C#');
  assert.equal(tabHeadingLine(2, '###'), '## \\#\\#\\#');
  const text = `${TABSET_OPEN}\n${renamedTabLine('## A', 'Plan *first* [1]')}\n:::`;
  assert.deepEqual(tabsetOf(scanFencedDiv(text)!)?.tabs.map(tab => tab.name), ['Plan *first* [1]']);
});

test('a tab\'s heading is never the slide\'s title: the first heading outside the block is', () => {
  assert.equal(blockTitleOf(WORKBOOK), '');
  assert.equal(blockTitleOf(`${WORKBOOK}\n\n## After the tabs`), 'After the tabs');
  assert.equal(blockTitleOf(`:::: columns\n::: column\n### Steps\n:::\n::: column\n${WORKBOOK}\n:::\n::::`), 'Steps');
  assert.equal(blockTitleOf(`# A long report, in steps\n\n${QUARTO}`), 'A long report, in steps');
});

const slide = (body: string) => [`${fenceFor(body)}slide`, body, fenceFor(body), ''].join('\n');

test('a `##` inside the fence never splits slides, sections or handout parts, in a slide or in the handout', () => {
  const deck = ['---', 'deck: 2', 'handout: text', '---', '',
    slide(`# Exercise\n\n${WORKBOOK}`),
    `## The exercise\n\n${QUARTO}\n`,
    slide('# Next'),
    '## Next\n',
  ].join('\n');
  const parsed = parseDeck(deck);
  assert.equal(parsed.slides.length, 2);
  const data = slideDataOf(parsed.slides[0].kind, parsed.slides[0].body);
  assert.equal(data.title, 'Exercise');
  assert.equal(partHeadingOf(deck.slice(parsed.slides[0].handoutStart, parsed.slides[0].handoutEnd))?.text, 'The exercise');
  assert.equal(partHeadingOf(`${QUARTO}\n`), null, 'a part that opens with tabs has no heading of its own');
  const sections = agendaOf([{ kind: '', data: slideDataOf('', `1\n\n${WORKBOOK}`) }]);
  assert.deepEqual(sections, []);
  assert.equal(isCoverSlide(`# Title\n\n${newTabsetMarkdown()}`), false);
});

test('the renderer draws the band and every pane in one place, the first tab chosen, each pane named for print', () => {
  const html = parse(blockSlideHtml(WORKBOOK));
  const block = html.querySelector('.blk-tabs')!;
  assert.equal(block.getAttribute('data-active'), '0');
  assert.deepEqual(block.querySelectorAll('.blk-tab').map(tab => tab.text), ['1 · Plan', '2 · Collect', '3 · Analyse', '4 · Write and check']);
  assert.equal(block.querySelectorAll('.blk-tab.is-active').length, 1);
  const panes = block.querySelectorAll('.blk-tabpane');
  assert.equal(panes.length, 4);
  assert.deepEqual(panes.map(pane => pane.getAttribute('data-tab-name')), ['1 · Plan', '2 · Collect', '3 · Analyse', '4 · Write and check']);
  assert.equal(panes[0].querySelector('.blk-tabname')?.text, '1 · Plan');
  assert.ok(panes[0].querySelector('pre'), 'a prompt in a pane is a code block');
  assert.ok(panes[2].querySelector('.blk-columns'), 'a Columns block in a pane is drawn');
  assert.equal(html.querySelectorAll('h2').length, 1, 'only the heading inside the column is drawn as one');
});

test('Present\'s choice shows its tab; a choice out of range shows the first', () => {
  const two = `${WORKBOOK}\n\n${QUARTO}`;
  const html = parse(blockSlideHtml(two, { tabs: [2, 1] }));
  assert.deepEqual(html.querySelectorAll('.blk-tabs').map(block => block.getAttribute('data-active')), ['2', '1']);
  const out = parse(blockSlideHtml(two, { tabs: [9, -1] }));
  assert.deepEqual(out.querySelectorAll('.blk-tabs').map(block => block.getAttribute('data-active')), ['0', '0']);
  const canvas = parse(blockCanvasMarkup({ markdown: two }, { tabs: [3] }));
  assert.equal(canvas.querySelector('.blk-tabs')?.getAttribute('data-active'), '3');
});

test('a tab\'s name is escaped, and the pane draws no raw HTML', () => {
  const html = blockSlideHtml(`${TABSET_OPEN}\n## <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n:::`);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script'));
});

test('a pane\'s pictures are found, and a list in a pane is never revealed one by one (the block is one item)', () => {
  assert.deepEqual(blockPicturePaths(`${TABSET_OPEN}\n## A\n\n![page](images/report.png)\n:::`), ['images/report.png']);
  assert.equal(blockRevealCount(`${TABSET_OPEN}\n## A\n\n::: incremental\n- one\n- two\n:::\n:::`), 0);
});

test('the page\'s handout shows every tab one after another, each under its name; its `##` is no part heading', () => {
  const handout = `${TABSET_OPEN}\n## 1 · Plan\n\nChange the parts in square brackets.\n\n\`\`\`\nYou are an analyst.\n\`\`\`\n\n## 2 · Collect\n\n- one\n- two\n\n### A smaller heading\n\n:::\n\nAfter the tabs.\n`;
  const html = parse(handoutHtml(handout, { partKey: 'p1', exercise: false, pictureUrl: () => null }));
  assert.deepEqual(html.querySelectorAll('.tabsec .tabname').map(name => name.text), ['1 · Plan', '2 · Collect']);
  assert.ok(html.querySelector('.tabsec .prompt'), 'a prompt in a tab has its Copy');
  assert.equal(html.querySelectorAll('h2, h3').length, 0, 'a tab is no heading');
  assert.equal(html.querySelectorAll('h4').length, 1, 'a smaller heading in a pane is the pane\'s');
  assert.ok(!html.toString().includes(':::'), 'no fence line shows as words');
  assert.equal(lexHandout(`${QUARTO}\n`)[0].type, 'handoutTabs');
});

test('a private note inside a tab is taken out with its block, as in a quote or a list', () => {
  const text = `${TABSET_OPEN}\n## A\n\nWords\n\n\`\`\`notes\nPrivate\n\`\`\`\n:::\n`;
  assert.ok(!publicMarkdown(text).includes('Private'));
});

test('print shows every tab of a slide, each under its name, and nothing scrolls or fades', () => {
  assert.ok(PRINT_CSS.includes('.layer .deck-sl.is-blocks .blk-tabpane { display: block; visibility: visible; overflow: visible; }'));
  assert.ok(PRINT_CSS.includes('.layer .deck-sl.is-blocks .blk-tabname { display: block;'));
  assert.ok(PRINT_CSS.includes('.layer .deck-sl.is-blocks .blk-tabbar { display: none; }'));
});

test('Present\'s tab choice: the presenter view\'s request read exactly, and the choice kept per block', () => {
  assert.deepEqual(decodeWallRequest({ type: 'present/tab', block: 1, tab: 3 }), { type: 'present/tab', block: 1, tab: 3 });
  assert.equal(decodeWallRequest({ type: 'present/tab', block: 1, tab: 3, extra: true }), null);
  assert.equal(decodeWallRequest({ type: 'present/tab', block: -1, tab: 0 }), null);
  assert.equal(decodeWallRequest({ type: 'present/tab', block: 0, tab: 1.5 }), null);
  assert.deepEqual(withTab([], 2, 1), [0, 0, 1]);
  assert.deepEqual(withTab([3], 0, 1), [1]);
  assert.deepEqual(tabsOf(['x', 2, -1]), [0, 2, 0]);
  assert.deepEqual(tabsOf(null), []);
});

test('a tab\'s name keeps a word\'s underscore and a lone tilde; only marks around words go (review)', () => {
  assert.equal(plainTabName('app_config.py'), 'app_config.py');
  assert.equal(plainTabName('~/setup'), '~/setup');
  assert.equal(plainTabName('*Plan* and **check** `code` _quiet_'), 'Plan and check code quiet');
  assert.equal(tabsetStart('Words\n::: panel-tabset\n## A\n:::'), 6, 'the bare-word form starts a block too');
});

test('a comment inside a tab\'s pane is found, on the slide and in the handout (review)', () => {
  const slideMarkdown = `${TABSET_OPEN}\n## A\n\n<!-- {id:c1} Check this prompt -->\nWords\n:::`;
  assert.equal(slideCommentsOf(slideMarkdown).length, 1, 'found in the pane');
  assert.equal(partComments(`${TABSET_OPEN}\n## A\n\n<!-- A note for me -->\n\nWords\n:::\n`).length, 1);
});

test('the page fits a band\'s tabs before it scrolls, as the editor and the wall do (the lead on PR 2)', () => {
  assert.ok(PAGE_SCRIPT.includes('function fitTabBands()'));
  assert.ok(PAGE_SCRIPT.includes("block.setAttribute('data-fit', String(step))"));
  assert.ok(!/\.innerHTML|\.src\s*=|\.href\s*=/.test(PAGE_SCRIPT.slice(PAGE_SCRIPT.indexOf('function fitTabBands'))), 'it writes no HTML and loads nothing');
});

test('a place to fill in looks the same in a pane as on the slide: no pane rule colours a code block\'s words', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8');
  assert.ok(!/\.blk-tabpane[^{]*\b(?:pre|code)\b[^{]*\{[^}]*\bcolor:/.test(css), 'no pane rule sets a code block\'s colour');
  assert.ok(/\.deck-sl\.is-blocks :is\(pre, code\) \.cb-fill[^{]*\{[^}]*color: var\(--s-acct/.test(css), 'the place mark keeps its own colour inside code');
  const html = blockSlideHtml(`${TABSET_OPEN}\n## A\n\n\`\`\`\nAdd [the report].\n\`\`\`\n:::`);
  assert.ok(html.includes('class="cb-fill"'), 'a place in a pane\'s prompt is marked as on the slide');
});

/** The declarations of every rule whose selector list holds `selector` exactly, the later ones winning (comments dropped). */
function declarations(css: string, selector: string): Map<string, string> {
  const found = new Map<string, string>();
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!rule[1].split(',').map(part => part.trim()).includes(selector)) continue;
    for (const declaration of rule[2].split(';')) {
      const colon = declaration.indexOf(':');
      if (colon > 0) found.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
    }
  }
  return found;
}

/** A length in px from a shorthand's `at`th value (`padding: 5px 5px 10px`, `inset: 0 0 -10px`). */
function pxAt(value: string | undefined, at: number): number {
  const part = (value ?? '').split(/\s+/)[at] ?? '';
  return part === '0' ? 0 : Number(/^(-?[\d.]+)px$/.exec(part)?.[1] ?? NaN);
}

/**
 * The chosen tab joins its pane with no line between them (Jarmo, 19 November: a hairline under "Tab 2"). On a scaled
 * slide the join falls inside a pixel, where two grounds that each cover part of it let the band show through. So the
 * chosen tab has no ground of its own that meets the pane's: one shape, the pane's colour, runs from its top on past its
 * foot into the pane, in room the band keeps for it, by at least a whole pixel at the smallest drawing (the strip).
 */
function checkJoin(css: string, look: { tab: string; band: string; panes: string; smallestScale: number }): void {
  const tab = declarations(css, look.tab);
  const active = declarations(css, `${look.tab}.is-active`);
  const ground = declarations(css, `${look.tab}::before`);
  const activeGround = declarations(css, `${look.tab}.is-active::before`);
  const band = declarations(css, look.band);
  const panes = declarations(css, look.panes);
  assert.ok(!active.has('background') && !active.has('background-color'), 'the chosen tab draws no ground of its own at the join');
  assert.equal(activeGround.get('background'), panes.get('background'), 'its one ground is the pane\'s colour');
  assert.equal(ground.get('content'), "''");
  assert.equal(ground.get('position'), 'absolute');
  assert.equal(ground.get('z-index'), '-1', 'under the tab\'s name');
  assert.equal(tab.get('z-index'), '0', 'inside the tab (each tab its own layer)');
  assert.equal(ground.get('pointer-events'), 'none');
  const run = -pxAt(ground.get('inset'), 2);
  const room = pxAt(band.get('padding'), 2);
  assert.ok(run > 0, `the ground runs on past the tab's foot (${ground.get('inset')})`);
  assert.ok(room >= run, `the band keeps room for it, so it is not cut at the join (${room} for ${run})`);
  assert.equal(pxAt(band.get('margin-bottom'), 0), -room, 'laid over the pane\'s top, so nothing moves');
  assert.ok(run * look.smallestScale >= 1, `a whole pixel past the join even at the smallest drawing (${run} × ${look.smallestScale})`);
}

test('the chosen tab joins its pane with no hairline: one ground across the join, on every scaled slide (19 November)', () => {
  const webview = path.join(__dirname, '..', '..', '..', 'webview', 'src');
  const css = fs.readFileSync(path.join(webview, 'components', 'decks', 'slide', 'slide.css'), 'utf8');
  const strip = fs.readFileSync(path.join(webview, 'components', 'decks', 'SlideStrip.tsx'), 'utf8');
  const thumb = Number(/const THUMB_WIDTH = (\d+)/.exec(strip)?.[1]);
  assert.ok(thumb > 0, 'the strip\'s thumbnail width is found');
  // The stage, the strip, the wall and the page all draw with slide.css; a 1× screen is the smallest pixel.
  checkJoin(css, { tab: '.deck-sl.is-blocks .blk-tab', band: '.deck-sl.is-blocks .blk-tabbar', panes: '.deck-sl.is-blocks .blk-tabpanes', smallestScale: thumb / 960 });
  // The open pane lies above the band's room, so a click there still lands in it (README "Tabs in the editor").
  assert.ok(/\.blk-tabpane:nth-child\(24\) \{ visibility: visible; z-index: 1; \}/.test(css), 'the open pane is above the band');
  // Nothing on the page, in a Borderless deck or for the keyboard gives the chosen tab a ground (or a line) of its own.
  for (const sheet of [PAGE_CSS, css]) {
    assert.ok(!/\.blk-tab\.is-active(?!::before)[^{,]*\{[^}]*\b(?:background|border-bottom|box-shadow)\b/.test(sheet), 'no other rule draws at the chosen tab\'s foot');
  }
  const pageRing = declarations(PAGE_CSS, '.layer .deck-sl.is-blocks .blk-tab:focus-visible');
  assert.ok(pageRing.has('outline') && !pageRing.has('box-shadow'), 'the page\'s keyboard ring is an outline, drawn over the ground');
});

test('in the editors the keyboard\'s ring stays visible over the chosen tab\'s ground, and a Text document joins the same way', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'webview', 'src', 'index.css'), 'utf8');
  const ring = declarations(css, ':where(:root:not([data-input-mode="pointer"])) .blk-tabbar .blk-tab:focus-visible');
  assert.ok(ring.has('outline') && !ring.has('box-shadow'), 'an outline: a shadow on the tab would go under its ground');
  // A Text document is drawn unscaled, but a zoomed window puts its join inside a pixel too.
  checkJoin(css, { tab: '.blk-tabs.is-text .blk-tab', band: '.blk-tabs.is-text .blk-tabbar', panes: '.blk-tabs.is-text .blk-tabpanes', smallestScale: 1 });
  assert.equal(declarations(css, '.blk-tabs.is-text .blk-tabpanes').get('z-index'), '1', 'the panes lie above the band\'s room, so a click there goes into the pane');
});

console.log(`tabset: ${passed} passed`);
