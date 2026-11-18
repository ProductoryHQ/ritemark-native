/**
 * Experience 49, 18 November: a picture alone on a slide is centred. With nothing else on the slide it sits in the
 * middle both ways; with only a title above it, in the middle of the space under the title; an Align or Size the person
 * set still wins. The one renderer marks the canvas (the strip's thumbnails, the wall, the presenter view and the page
 * draw with it) and the stage's slide editor marks its own canvas by the same rule; slide.css centres both.
 *
 * Run: npx tsx src/decks/blocks/lonePicture.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'node-html-parser';
import { blockCanvasMarkup, lonePictureClass, lonePictureOf } from './slideRenderer';
import { BUILT_IN_THEME } from '../deckTheme';
import { deckDigest, publicDeck } from '../page/publicDeck';
import { pageHtml, type PageAssets } from '../page/pageHtml';

const extension = path.join(__dirname, '../../..');
const slideCss = fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8');
const canvas = (markdown: string, data: Record<string, unknown> = {}) =>
  parse(blockCanvasMarkup({ markdown, ...data }, { width: 960, pictureUrl: () => 'pic.png' })).querySelector('.deck-sl')!;
const centring = (css: string) => css.split('\n').filter(line => /is-lone-pic|is-titled-pic/.test(line) && line.includes('{'));

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
  assert.ok(rules.some(rule => /:is\(\.is-lone-pic, \.is-titled-pic\) \.blk-flow > :is\(\.blk-pic, img\) \{ margin-top: auto; margin-bottom: auto; \}/.test(rule)), 'the middle down');
  assert.ok(rules.some(rule => /> :is\(\.blk-pic, img\):not\(\.empty\) \{ align-self: center; object-position: center; \}/.test(rule)), 'the middle across');
  // The column the picture is in is the flex column the fit already gives a slide with a picture.
  assert.match(slideCss, /\.deck-sl\.is-blocks \.blk-flow:has\(> \.blk-pic, > img\) \{ display: flex; flex-direction: column; \}/);
}

// ---- 2. Only a title above it: centred across the space under the title, and in the middle of it (the auto margins
// share only the height left under the title).
{
  assert.equal(lonePictureOf('# Our team\n\n![Team](images/team.jpg)'), 'titled');
  assert.ok(canvas('# Our team\n\n![Team](images/team.jpg)').classList.contains('is-titled-pic'));
  assert.ok(!canvas('# Our team\n\n![Team](images/team.jpg)').classList.contains('is-lone-pic'));
  // A subtitle, a line or a second heading is something else; so is a smaller heading as the title.
  assert.equal(lonePictureOf('# Our team\n\nWho we are\n\n![Team](images/team.jpg)'), null);
  assert.equal(lonePictureOf('## Our team\n\n![Team](images/team.jpg)'), null);
  assert.equal(lonePictureOf('![Team](images/team.jpg)\n\n# Under it'), null, 'a title under the picture is no title above it');
  // The title keeps its own place: no centring rule touches it.
  assert.ok(centring(slideCss).every(rule => !/\bh1\b/.test(rule)));
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
  assert.equal(page.querySelectorAll('.layer .deck-sl.is-titled-pic').length, 1, 'the page: under its title');
  const editor = fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'blocks', 'SlideEditor.tsx'), 'utf8');
  assert.match(editor, /'is-editing'[^\n]*lonePictureClass\(shownMarkdown, side\)/, 'the stage marks its canvas');
}

console.log('lone picture: passed');
