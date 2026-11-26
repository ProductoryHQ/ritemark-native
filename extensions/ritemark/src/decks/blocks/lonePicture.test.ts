/** Shared canvas and CSS rules for pictures in the slide flow. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'node-html-parser';
import { blockCanvasMarkup, contentPlaceOf, lonePictureClass, lonePictureOf } from './slideRenderer';
import { BUILT_IN_THEME } from '../deckTheme';
import { deckDigest, publicDeck } from '../page/publicDeck';
import { pageHtml, type PageAssets } from '../page/pageHtml';

const extension = path.join(__dirname, '../../..');
const slideCss = fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8');
const canvas = (markdown: string, data: Record<string, unknown> = {}) =>
  parse(blockCanvasMarkup({ markdown, ...data }, { width: 960, pictureUrl: () => 'pic.png' })).querySelector('.deck-sl')!;
const centring = (css: string) => css.split('\n').filter(line => /is-lone-pic/.test(line) && line.includes('{'));

// ---- 1. Nothing else on the slide: the picture sits in the middle both ways.
{
  assert.equal(lonePictureOf('![Team](images/team.jpg)'), 'alone');
  assert.equal(lonePictureOf('![Team](images/team.jpg)\n\n<!-- a note for the AI -->'), 'alone', 'a comment is not something on the slide');
  assert.equal(lonePictureOf('![Team](images/team.jpg){crop=16:9}'), 'alone', 'a cropped one too');
  assert.ok(canvas('![Team](images/team.jpg)').classList.contains('is-lone-pic'));
  // Anything else on the slide, two pictures, or a picture beside or behind: no centring.
  assert.equal(lonePictureOf('![Team](images/team.jpg)\n\nWhy it matters'), null);
  assert.equal(lonePictureOf('![A](images/a.jpg) ![B](images/b.jpg)'), null);
  assert.equal(lonePictureOf('Words with ![a](images/a.jpg) inside'), null);
  assert.equal(lonePictureClass('![Team](images/team.jpg)', 'left'), '');
  assert.ok(!canvas('![Team](images/team.jpg)', { image: 'images/side.jpg', picture: 'right' }).classList.contains('is-lone-pic'));
  // The CSS: both margins of the column's height shared (the middle down), and the middle across.
  const rules = centring(slideCss);
  assert.ok(rules.some(rule => /\.is-lone-pic \.blk-flow > :is\(\.blk-pic, img\) \{ margin-top: auto; margin-bottom: auto; \}/.test(rule)), 'the middle down');
  // The column the picture is in is the flex column the fit already gives a slide with a picture.
  assert.match(slideCss, /\.deck-sl\.is-blocks \.blk-flow:has\(> \.blk-pic, > img\) \{ display: flex; flex-direction: column; \}/);
}

// ---- 3. The person's own choice wins: a set Align or Size is the picture's inline style, which outranks the centring
// (it uses no !important and sets no width or side margins).
{
  const left = canvas('![Team](images/team.jpg){align=left}').querySelector('img')!;
  assert.match(left.getAttribute('style') ?? '', /align-self:flex-start/, 'Align left stays left');
  assert.match(left.getAttribute('style') ?? '', /object-position:left center/);
  const right = canvas('# Our team\n\n![Team](images/team.jpg){align=right width=50%}').querySelector('img')!;
  assert.match(right.getAttribute('style') ?? '', /width:50%/, 'its Size stays');
  assert.match(right.getAttribute('style') ?? '', /align-self:flex-end/, 'its Align stays');
  for (const rule of centring(slideCss)) {
    assert.ok(!/!important/.test(rule), rule);
    assert.ok(!/\b(width|margin-left|margin-right|max-width|height)\s*:/.test(rule), `the centring sizes nothing: ${rule}`);
  }
}

// ---- Everywhere: the page draws with the same canvas and CSS, and the stage's editor marks its canvas by the same rule.
{
  const text = ['---', 'deck: 2', '---', '', '```slide', '![Team](images/team.jpg)', '```', '', '```slide', '# Our team', '', '![Team](images/team.jpg)', '```', ''].join('\n');
  const deck = publicDeck(text, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME });
  const assets: PageAssets = { slideCss, fonts: [] };
  const page = parse(pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl: () => 'pic.png' }));
  assert.equal(page.querySelectorAll('.layer .deck-sl.is-lone-pic').length, 1, 'the page: alone');
  assert.ok(page.querySelector('.layer .deck-sl:not(.is-lone-pic) .blk-flow > h1 + img'), 'the page: in the flow under its title');
  const editor = fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'blocks', 'SlideEditor.tsx'), 'utf8');
  assert.match(editor, /'is-editing'[^\n]*lonePictureClass\(shownMarkdown, side\)/, 'the stage marks its canvas');
}

console.log('lone picture: passed');

const dropped = "# The deck's title\n![](<Kickoff files/photo.png>)";
const directPictureRule = slideCss.match(/\.blk-flow:has\(> \.blk-pic, > img\) > :is\(\.blk-pic, img\) \{([^}]+)\}/)?.[1] ?? '';

test('#1116: a small picture follows its title at Top and keeps its natural size', () => {
  const slide = canvas(dropped);
  assert.equal(contentPlaceOf(dropped, undefined, null), 'top');
  assert.ok(slide.querySelector('.blk-flow > h1 + img.blk-pic'));
  assert.ok(!slide.classList.contains('is-cover'));
  assert.ok(!slide.classList.contains('is-titled-pic'), 'no auto margins between the title and picture');
  assert.match(directPictureRule, /align-self: center/);
  assert.doesNotMatch(directPictureRule, /min-height: (?!0;)|(?:^|;)\s*(?:width|height):/);
  assert.match(slideCss, /h1:has\(\+ :is\(\.blk-pic, img\)\) \{ margin-bottom: calc\(12px \* var\(--fit, 1\)\)/);
});

test('#1116: a large picture shrinks into the remaining room under the title', () => {
  assert.match(directPictureRule, /flex: 0 1 auto; min-height: 0;/);
  assert.match(slideCss, /\.blk-flow > img \{ max-height: none; \}/);
  assert.match(slideCss, /\.blk-pic \{[^}]*max-width: 100%[^}]*object-fit: contain/);
});

test('#1116: a picture-only slide defaults to Middle', () => {
  const picture = '![](<Kickoff files/photo.png>)';
  assert.equal(contentPlaceOf(picture, undefined, null), 'middle');
  assert.ok(canvas(picture).classList.contains('is-lone-pic'));
});

test('#1116: Bottom moves the title and picture together', () => {
  const slide = canvas(dropped, { valign: 'bottom' });
  assert.ok(slide.classList.contains('va-bottom'));
  assert.ok(slide.querySelector('.blk-flow > h1 + img'));
  assert.match(slideCss, /\.va-bottom \.blk-flow \{[^}]*justify-content: safe flex-end/);
});

test('#1116: a picture under a title keeps its explicit width', () => {
  const image = canvas(dropped + '{width=50%}').querySelector('.blk-flow > img');
  assert.match(image?.getAttribute('style') ?? '', /width:50%/);
});
