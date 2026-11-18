/**
 * The decks README, small details 13 and 14. The Agenda: its list from the deck's section slides (renamed, skipped, none),
 * drawn by the one renderer, with Present's passed and next marks from the slide's own place, and on the page as a
 * static list. The page's print rules: the controls left out, the slide above its part and kept with it, a part kept off
 * two pages where it fits, A4 and Letter alike, the slide alone printing its colours exactly, the address in the footer.
 *
 * Run: npx tsx src/decks/blocks/agenda.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'node-html-parser';
import { AGENDA_HINT, agendaHtml, agendaMarks, type AgendaEntry } from './agenda';
import { agendaOf, blockCanvasMarkup, blockHasAgenda, blockPicturePaths, blockSlideHtml, blockStepsTagOf, isSectionSlide } from './slideRenderer';
import { parseDeck, slideDataOf } from '../deckFormat';
import { BUILT_IN_THEME } from '../deckTheme';
import { presentSlidesOf } from '../present/presentSession';
import { wallSlideOf } from '../present/presentProtocol';
import { deckDigest, publicDeck } from '../page/publicDeck';
import { PAGE_CSS, PRINT_CSS, pageHtml, printOrderCss, type PageAssets } from '../page/pageHtml';
import { PAGE_SCRIPT } from '../page/pageScript';

const slide = (body: string, kind = '') => ['```slide' + (kind ? ` ${kind}` : ''), body, '```', ''].join('\n');
const DECK = [
  '---', 'deck: 2', '---', '',
  slide('# Welcome'),
  slide('# Today\n\n::: agenda\n:::'),
  slide('---\nsection: true\n---\n1\n\n# Getting started'),
  slide('# Inside the first section'),
  slide('id: v1\nnumber: "2"\ntitle: Writing with an assistant', 'section'),
  slide('---\nsection: true\nskip: true\n---\n3\n\n# Skipped today'),
  slide('2.1\n\n# Numbered, no header'),
  slide('# Back to the agenda\n\n::: {.agenda}\n:::'),
  slide('---\nsection: true\n---\n# Wrap-up'),
].join('\n');

const deckSlides = (text: string) => parseDeck(text).slides.map((block, index) => ({ kind: block.kind, data: slideDataOf(block.kind, block.body), number: index + 1 }));

// ---- The list: the section slides in order, by title, each with its place; a skipped section is left out.
{
  const entries = agendaOf(deckSlides(DECK));
  assert.deepEqual(entries, [
    { title: 'Getting started', number: 3 },
    { title: 'Writing with an assistant', number: 5 },
    { title: 'Numbered, no header', number: 7 },
    { title: 'Wrap-up', number: 9 },
  ]);
  assert.equal(isSectionSlide('points', { title: 'x' }), false);
  assert.equal(isSectionSlide('', { markdown: '# Just a title' }), false, 'a title slide is no section');
  // A section renamed: the agenda follows, with no edit to the agenda's slide.
  const renamed = DECK.replace('# Getting started', '# First steps');
  assert.equal(agendaOf(deckSlides(renamed))[0].title, 'First steps');
  // A section with no title is named by its number.
  assert.deepEqual(agendaOf([{ kind: 'section', data: { number: '4' } }, { kind: '', data: { section: true, markdown: '' } }]), [{ title: 'Section 4', number: 1 }, { title: 'Section', number: 2 }]);
  // A deck with no section slides: an empty list.
  assert.deepEqual(agendaOf(deckSlides(['---', 'deck: 2', '---', '', slide('# Today\n\n::: agenda\n:::'), slide('# More')].join('\n'))), []);
}

// ---- Drawn: numbered, escaped; the editor's quiet line for none; nothing in Present or on the page for none.
{
  const entries = agendaOf(deckSlides(DECK));
  const html = blockSlideHtml('# Today\n\n::: agenda\n:::', { agenda: { entries, hint: false } });
  const list = parse(html).querySelector('.blk-agenda ol')!;
  assert.deepEqual(list.querySelectorAll('li').map(li => li.text), ['1Getting started', '2Writing with an assistant', '3Numbered, no header', '4Wrap-up']);
  assert.ok(agendaHtml({ entries: [{ title: 'Tags <img src=x onerror=1> & "quotes"', number: 2 }], hint: false }).includes('Tags &lt;img src=x onerror=1&gt; &amp; &quot;quotes&quot;'), 'a title is escaped');
  assert.ok(!/is-(passed|next)/.test(html), 'no progress outside Present');
  assert.equal(blockSlideHtml('::: agenda\n:::', { agenda: { entries: [], hint: false } }), '', 'Present and the page: nothing for no sections');
  assert.ok(blockSlideHtml('::: agenda\n:::', { agenda: { entries: [], hint: true } }).includes(AGENDA_HINT), 'the editor: the quiet line');
  assert.equal(AGENDA_HINT, 'Add a section slide to fill the agenda');
  // Words written inside the block (by hand, by an AI) are kept in the file and never drawn.
  assert.ok(!blockSlideHtml('::: agenda\nSECRET\n:::', { agenda: { entries, hint: false } }).includes('SECRET'));
  // Nor is anything in it read: a picture is never asked for or published, a Steps block makes no exercise (review).
  assert.deepEqual(blockPicturePaths('# Today\n\n::: agenda\n![Logo](images/logo.png)\n:::'), []);
  assert.equal(blockStepsTagOf('# Today\n\n::: agenda\n::: steps\n1. One\n:::\n:::'), null);
  assert.equal(blockHasAgenda('# Today\n\n::: agenda\n:::'), true);
  assert.equal(blockHasAgenda('# Today\n\n```\n::: agenda\n:::\n```'), false, 'in code it is words');
  assert.equal(blockHasAgenda('::: steps\n1. a\n:::'), false);
}

// ---- Present: the sections before the agenda's own slide are passed, the first one from it on is next.
{
  const entries: AgendaEntry[] = [{ title: 'A', number: 3 }, { title: 'B', number: 5 }, { title: 'C', number: 9 }];
  assert.deepEqual(agendaMarks(entries, 2), ['next', null, null], 'the opening agenda: the first section is next');
  assert.deepEqual(agendaMarks(entries, 8), ['passed', 'passed', 'next'], 'between sections: two passed, the third next');
  assert.deepEqual(agendaMarks(entries, 10), ['passed', 'passed', 'passed'], 'after the last: all passed, none next');
  assert.deepEqual(agendaMarks(entries, null), [null, null, null]);
  // On the wall, from the slides it is sent (skipped ones left out), at the agenda slide's own number.
  const shown = presentSlidesOf(DECK).filter(entry => !entry.skip).map(wallSlideOf);
  const wallEntries = agendaOf(shown);
  assert.deepEqual(wallEntries.map(entry => entry.title), ['Getting started', 'Writing with an assistant', 'Numbered, no header', 'Wrap-up']);
  const back = shown.find(entry => entry.title === 'Back to the agenda')!;
  const drawn = parse(blockCanvasMarkup(back.data, { agenda: { entries: wallEntries, hint: false }, at: back.number }));
  assert.deepEqual(drawn.querySelectorAll('.blk-agenda li').map(li => li.getAttribute('class') ?? ''), ['is-passed', 'is-passed', 'is-passed', 'is-next']);
  const today = shown.find(entry => entry.title === 'Today')!;
  const opening = parse(blockCanvasMarkup(today.data, { agenda: { entries: wallEntries, hint: false }, at: today.number }));
  assert.deepEqual(opening.querySelectorAll('.blk-agenda li').map(li => li.getAttribute('class') ?? ''), ['is-next', '', '', '']);
}

// ---- The page: the list as it is (no progress, no hint), and its print rules.
const extension = path.resolve(__dirname, '..', '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: [],
};
{
  const deck = publicDeck(DECK, { folderName: 'Demo client', deckName: 'Demo day', theme: BUILT_IN_THEME });
  const html = pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl: () => null });
  const root = parse(html);
  const agendas = root.querySelectorAll('.layer .blk-agenda');
  assert.equal(agendas.length, 2, 'both agenda slides draw the list');
  assert.deepEqual(agendas[0].querySelectorAll('.blk-agenda-t').map(title => title.text), ['Getting started', 'Writing with an assistant', 'Numbered, no header', 'Wrap-up']);
  assert.ok(!/class="is-(passed|next)"/.test(html), 'static on the page');
  assert.ok(!html.includes('Skipped today'), 'a skipped section is not on the page');
  const none = publicDeck(['---', 'deck: 2', '---', '', slide('# Today\n\n::: agenda\n:::')].join('\n'), { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME });
  const noneHtml = pageHtml(none, assets, { digest: deckDigest(none), pictureUrl: () => null });
  assert.ok(!noneHtml.includes(AGENDA_HINT) && !parse(noneHtml).querySelector('.blk-agenda'), 'no sections: nothing on the page');

  // The print rules come after the page's and the slide's own, so they win.
  const style = root.querySelector('style')!.text;
  assert.ok(style.indexOf(PRINT_CSS.trim()) > style.indexOf('.deck-sl.is-blocks .blk-flow'), 'print after the slide CSS');
  // The page's sections (slides 3, 5, 7 and 9 of the deck's ten; the skipped one is not on the page) print as bands.
  const sectionPlaces = new Set([2, 4, 5, 7]);
  assert.ok(style.includes(printOrderCss(deck.slides.length, sectionPlaces)), 'the page prints its sections as bands');
  assert.equal(root.querySelector('#s3')!.getAttribute('class'), 'part sect', 'the band the section prints as is the page\'s own');
  assert.equal(root.querySelector('#s3 .eyebrow')!.text, 'Section 1');
  // The address in the handout's footer: an element the script fills as text, never shown on screen.
  const foot = root.querySelector('.foot')!;
  assert.ok(foot.querySelector('#paddr'), 'the address sits in the footer');
  assert.equal(root.querySelector('#paddr')!.text, '', 'written by the script, not by the page');
  assert.match(PAGE_SCRIPT, /addr\.textContent = window\.location\.origin \+ window\.location\.pathname/);
  assert.match(PAGE_SCRIPT, /\/\^https\?:\$\/\.test\(window\.location\.protocol\)/, 'only a page on the web gives its address');
}
{
  const print = PRINT_CSS.slice(PRINT_CSS.indexOf('@media print'));
  const rule = (selector: string) => {
    const at = print.indexOf(`\n  ${selector} {`);
    assert.ok(at >= 0, `a print rule for ${selector}`);
    return print.slice(at, print.indexOf('}', at));
  };
  assert.match(PRINT_CSS, /^\s*\.paddr, \.foot\.addr-only \{ display: none; \}/, 'the address never on screen');
  assert.ok(print.includes('.foot.addr-only:has(> .paddr:empty) { display: none; }'), 'no empty footer in print (a page opened from disk, with no client or title)');
  // No bar, no Contents, no arrows, no Copy, no Open in links.
  for (const control of ['.top', '.toc', '.under', '.copy', '.prompt .open']) assert.ok(rule('.top, .toc, .under, .toast, .zoom, .restart, .copy, .prompt .open').includes('display: none !important') && print.includes(control), control);
  // Each slide stays with its part; a part is kept off two pages where it fits.
  assert.match(rule('.layer'), /break-inside: avoid; break-after: avoid;/);
  assert.match(rule('.part'), /break-inside: avoid/);
  assert.match(rule('.prompt, .prompt.ai'), /break-inside: avoid/);
  assert.match(rule('.prompt pre, .prompt.ai pre'), /border: 1px solid/, 'a prompt keeps its box as a line');
  // The slide alone prints its colours exactly.
  assert.equal(PRINT_CSS.match(/print-color-adjust: exact/g)?.length, 2, 'once, with its -webkit- twin');
  assert.match(rule('.layer'), /-webkit-print-color-adjust: exact; print-color-adjust: exact;/);
  assert.ok(!/print-color-adjust/.test(PAGE_CSS));
  // A4 and Letter: no paper size forced, and the slide fits the narrower printed width (A4) at these margins.
  assert.ok(!/@page[^}]*size:/.test(PRINT_CSS), 'the reader\'s own paper');
  const margins = /@page \{ margin: (\d+)mm (\d+)mm; \}/.exec(PRINT_CSS)!;
  const side = Number(margins[2]);
  const slideWidth = Number(/width: (\d+)px; height: (\d+)px;/.exec(rule('.layer'))![1]);
  const mm = slideWidth / 96 * 25.4;
  for (const [paper, width] of [['A4', 210], ['Letter', 215.9]] as const) assert.ok(mm <= width - 2 * side, `${paper}: the ${mm.toFixed(0)} mm slide fits`);
  assert.match(rule('.layer .deck-sl'), /zoom: 0\.6/);
  assert.equal(slideWidth, 960 * 0.6, 'the zoom draws the 960 px slide at the layer\'s width');
  // The order: slide n, then part n.
  assert.equal(printOrderCss(2), '@media print{.slidebox>.layer:nth-child(1){order:1}#s1{order:2}.slidebox>.layer:nth-child(2){order:3}#s2{order:4}}');
  assert.equal(printOrderCss(0), '');
  // A section (18 November): its slide is left out and its part starts a page, as its band; the next part follows it.
  assert.equal(printOrderCss(3, new Set([1])), '@media print{.slidebox>.layer:nth-child(1){order:1}#s1{order:2}.slidebox>.layer:nth-child(2){display:none}#s2{order:4;break-before:page;page-break-before:always}.slidebox>.layer:nth-child(3){order:5}#s3{order:6}}');
  assert.match(rule('.sect'), /break-after: avoid;/, 'no page holds a section alone');
  assert.match(rule('.sect'), /background: none;/, 'its band in the page\'s section style, printable');
}

console.log('agenda and print: passed');
