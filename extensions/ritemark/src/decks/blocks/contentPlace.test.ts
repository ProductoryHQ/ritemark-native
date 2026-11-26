/**
 * Sprint 167 PR 3 (decks README item A, #837): a slide's content Top, Middle or Bottom. In the file it is a slide
 * setting in the block slide's header, `valign:` (as the Columns block names its own), written only when it isn't the
 * slide's default: a title or section slide sits at the bottom (drawn big and low, its own foot room included), a picture
 * alone in the middle, every other slide at the top. An untouched deck saves byte for byte and is drawn as before. The
 * one renderer marks the canvas (`va-*`) for the strip, the wall, the presenter view and the page; slide.css moves the
 * whole flow inside the same room, so the fit is unchanged and a full slide is drawn from its top in all three.
 *
 * Run: npx tsx src/decks/blocks/contentPlace.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'node-html-parser';
import { contentPlaceValue, parseDeck, slideDataOf, splitBlockSlide, writeSlideData, writeSlideBlock } from '../deckFormat';
import { BUILT_IN_THEME } from '../deckTheme';
import { blockCanvasMarkup, contentPlaceClass, contentPlaceDefault, contentPlaceFitKey, contentPlaceOf, logoCanvasMarks } from './slideRenderer';
import { legacyDataToBlocks } from './legacyToBlocks';
import { slideStamp } from '../deckLibraryFormat';
import { deckDigest, publicDeck, publicSlide } from '../page/publicDeck';
import { pageHtml, type PageAssets } from '../page/pageHtml';
import { wallDataOf, wallSlideOf } from '../present/presentProtocol';

const extension = path.join(__dirname, '../../..');
const slideCss = fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8');
const flatCss = slideCss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const canvas = (markdown: string, data: Record<string, unknown> = {}) =>
  parse(blockCanvasMarkup({ markdown, ...data }, { width: 960, pictureUrl: () => 'pic.png' })).querySelector('.deck-sl')!;
const vaClasses = (element: ReturnType<typeof canvas>) => [...element.classList.values()].filter(name => name.startsWith('va-'));

const CONTENT = '# Three berths, one plan\n\nEach crew owns one berth for the season.\n\n- North: fishing boats\n- East: ferries\n- South: repairs';
const TITLE = '# Agents at work, day 2\n\nHarbour Logistics · 12 November';
const SECTION = '2\n\n# The afternoon';

// ---- 1. Each value round-trips in the header; nothing else in the slide changes.
{
  const body = `---\nid: ab12\n---\n${CONTENT}`;
  assert.equal(slideDataOf('', body).valign, undefined, 'no line, no setting');
  for (const place of ['middle', 'bottom'] as const) {
    const written = writeSlideData('', body, { ...slideDataOf('', body), valign: place });
    assert.equal(written, `---\nid: ab12\nvalign: ${place}\n---\n${CONTENT}`, `${place}: one line in the header, the words as written`);
    const read = slideDataOf('', written);
    assert.equal(read.valign, place, `${place} reads back`);
    assert.equal(read.markdown, CONTENT);
    assert.equal(writeSlideData('', written, read), written, `${place}: read and written again, byte for byte`);
    assert.equal(writeSlideData('', written, { ...read, valign: undefined }), body, `${place} taken out: the header as it was`);
  }
  // A title slide's Top is written, since its default is Bottom.
  const cover = `---\nid: t1\n---\n${TITLE}`;
  const top = writeSlideData('', cover, { ...slideDataOf('', cover), valign: 'top' });
  assert.equal(top, `---\nid: t1\nvalign: top\n---\n${TITLE}`);
  assert.equal(slideDataOf('', top).valign, 'top');
  // Next to the slide's other header keys, in the writer's own order.
  const side = '---\nid: p1\npicture: left\nimage: images/dock.jpg\nskip: true\n---\n# Dock';
  assert.equal(writeSlideData('', side, { ...slideDataOf('', side), valign: 'bottom' }), '---\nid: p1\npicture: left\nimage: images/dock.jpg\nvalign: bottom\nskip: true\n---\n# Dock');
  // A slide with no header gets one holding only the setting, and it reads back as a header, not as words.
  const bare = writeSlideData('', CONTENT, { markdown: CONTENT, valign: 'middle' });
  assert.equal(bare, `---\nvalign: middle\n---\n${CONTENT}`);
  assert.equal(splitBlockSlide(bare).header, 'valign: middle');
  assert.equal(slideDataOf('', bare).valign, 'middle');
  assert.equal(writeSlideData('', bare, { markdown: CONTENT }), CONTENT, 'and goes again with its setting');
  // A word that names no place makes no header: `---`, `valign: sideways`, `---` stays the slide's words.
  assert.equal(splitBlockSlide('---\nvalign: sideways\n---\n# T').header, null);
  assert.equal(contentPlaceValue(' Middle '), 'middle', 'read as written, in any case');
  // `center` and `centre` read as middle, as the Columns block's own `valign` reads them; a header of only that is one.
  assert.equal(contentPlaceValue('center'), 'middle');
  assert.equal(contentPlaceValue('centre'), 'middle');
  assert.equal(slideDataOf('', `---\nvalign: center\n---\n${CONTENT}`).valign, 'center');
  assert.equal(slideDataOf('', `---\nvalign: center\n---\n${CONTENT}`).markdown, CONTENT);
  assert.deepEqual(vaClasses(canvas(CONTENT, { valign: 'center' })), ['va-middle']);
  assert.equal(contentPlaceValue('sideways'), null);
  // A v1 slide (Settings may write it before the deck converts): its body takes the line, and its blocks carry it.
  assert.equal(writeSlideData('points', 'title: A\nid: x', { title: 'A', id: 'x', valign: 'middle' }), 'title: A\nid: x\nvalign: middle');
  assert.equal(legacyDataToBlocks('points', { title: 'A', valign: 'middle' }).header.valign, 'middle');
}

// ---- 2. The default writes nothing: an untouched deck is byte for byte, and its slides draw no place of their own.
{
  const deck = ['---', 'deck: 2', '---', '', writeSlideBlock('', `---\nid: a\n---\n${TITLE}`), '', writeSlideBlock('', `---\nid: b\n---\n${CONTENT}`), '', writeSlideBlock('', '![Dock](images/dock.jpg)'), ''].join('\n');
  for (const slide of parseDeck(deck).slides) {
    const data = slideDataOf(slide.kind, slide.body);
    assert.equal(data.valign, undefined);
    assert.equal(writeSlideData(slide.kind, slide.body, data), slide.body, 'an untouched slide saves as it was');
    assert.deepEqual(vaClasses(canvas(data.markdown ?? '')), [], 'and is drawn as before');
  }
  assert.equal(contentPlaceDefault(CONTENT, null), 'top', 'a slide with words: Top');
  assert.equal(contentPlaceDefault('![Dock](images/dock.jpg)', null), 'middle', 'a picture alone: Middle (it is centred)');
  assert.equal(contentPlaceDefault('![Dock](images/dock.jpg)', 'left'), 'top', 'a picture beside is something else on the slide');
  // A written value that is the slide's default draws nothing of its own either.
  assert.equal(contentPlaceClass(CONTENT, 'top', null), '');
  assert.equal(contentPlaceClass(TITLE, 'bottom', null), '');
}

// ---- 3. A title or section slide: Bottom is its default (today's drawing, its foot room included); Top or Middle moves it.
{
  for (const markdown of [TITLE, SECTION, '# Only a title']) {
    assert.equal(contentPlaceDefault(markdown, null), 'bottom', markdown);
    assert.equal(contentPlaceOf(markdown, undefined, null), 'bottom', 'read as Bottom with no line');
    const plain = canvas(markdown);
    assert.ok(plain.classList.contains('is-cover'));
    assert.deepEqual(vaClasses(plain), [], 'its Bottom is the cover drawing as before');
    assert.deepEqual(vaClasses(canvas(markdown, { valign: 'top' })), ['va-top']);
    assert.deepEqual(vaClasses(canvas(markdown, { valign: 'middle' })), ['va-middle']);
    assert.ok(canvas(markdown, { valign: 'top' }).classList.contains('is-cover'), 'still a title slide: its big type stays');
  }
  // On other slides Bottom is a place of its own: the content at the flow's foot.
  assert.deepEqual(vaClasses(canvas(CONTENT, { valign: 'bottom' })), ['va-bottom']);
  assert.deepEqual(vaClasses(canvas(CONTENT, { valign: 'middle' })), ['va-middle']);
  // The cover keeps its foot room in every place (the room the fit measures is the same), and only Bottom is low.
  assert.match(flatCss, /\.deck-sl\.is-blocks\.is-cover \.blk-flow \{ display: flex; flex-direction: column; justify-content: flex-end; justify-content: safe flex-end; padding-bottom: 40px; \}/);
  assert.match(flatCss, /\.deck-sl\.is-blocks\.va-top \.blk-flow \{ align-content: start; justify-content: flex-start; \}/);
  // A top-right logo's room: a title slide at its Bottom needs none (its words sit low); moved up, it keeps it.
  const logo = { url: 'logo.svg', place: 'top-right' as const, on: 'every-slide' as const, width: 120 };
  assert.equal(logoCanvasMarks(logo, true).cls, '');
  assert.equal(logoCanvasMarks(logo, true, 'bottom').cls, '');
  assert.equal(logoCanvasMarks(logo, true, 'top').cls, 'logo-tr');
  assert.equal(logoCanvasMarks(logo, true, 'middle').cls, 'logo-tr');
  assert.equal(logoCanvasMarks(logo, false, 'bottom').cls, 'logo-tr', 'every other slide keeps it, as before');
  assert.ok(canvas(TITLE, { valign: 'top' }).toString(), 'drawn');
  const drawnLogo = (valign?: string) => parse(blockCanvasMarkup({ markdown: TITLE, valign }, { width: 960, logo })).querySelector('.deck-sl')!;
  assert.ok(!drawnLogo().classList.contains('logo-tr'));
  assert.ok(drawnLogo('top').classList.contains('logo-tr'));
}

// ---- 4. A full slide is unchanged, and so is the fit: the places move the flow inside the same room, never its edges,
// padding or size, and `safe` draws a flow that fills or overflows its room from the top in all three.
{
  const rules = [...flatCss.matchAll(/([^{}]*\.va-(?:top|middle|bottom)[^{}]*)\{([^{}]*)\}/g)];
  assert.ok(rules.length >= 3, 'the three places have rules');
  for (const [, selector, body] of rules) {
    const props = body.split(';').map(part => part.split(':')[0].trim()).filter(Boolean);
    if (/> :is\(\.blk-pic, img\)/.test(selector)) {
      assert.deepEqual(props, ['margin-top', 'margin-bottom'], 'a lone picture gives up its auto margins, nothing else');
      assert.match(selector, /:is\(\.is-lone-pic, \.is-titled-pic\):is\(\.va-top, \.va-middle, \.va-bottom\)/, 'only a lone picture');
      continue;
    }
    if (/\.blk-flow > :nth-last-child/.test(selector)) {
      // The last block's trailing margin (its last list item's, a Steps list's) only, at Middle and Bottom: the words end
      // at the flow's foot. Nothing inside a block moves (only the last item of the last block's own list).
      assert.deepEqual(props, ['margin-bottom'], selector);
      // The last block drawn: on the stage a comment after it is never drawn.
      const end = '.deck-sl.is-blocks:is(.va-middle, .va-bottom) .blk-flow > :nth-last-child(1 of :not(ritemark-comment)) >';
      assert.equal(selector.trim(), `${end} :is(li, ol, ul):last-child, ${end} :is(ol, ul):last-child > li:last-child`);
      continue;
    }
    for (const prop of props) assert.ok(['align-content', 'justify-content'].includes(prop), `${selector}: only alignment (${prop})`);
  }
  assert.match(flatCss, /\.va-middle \.blk-flow \{ align-content: center; align-content: safe center; justify-content: center; justify-content: safe center; \}/);
  assert.match(flatCss, /\.va-bottom \.blk-flow \{ align-content: end; align-content: safe end; justify-content: flex-end; justify-content: safe flex-end; \}/);
  // Their rules follow the cover's, so a title slide's place wins over its own low drawing.
  assert.ok(flatCss.indexOf('.va-top .blk-flow') > flatCss.indexOf('.is-cover .blk-flow { display: flex'));
  // The fit's key: the place counts only on a title slide (a top-right logo's room); every other slide keeps its key
  // in all three places, and every slide at its default keeps the key it had.
  const fit = fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'blocks', 'slideFit.ts'), 'utf8');
  assert.match(fit, /\.\.\.\(place \? \[place\] : \[\]\)/);
  assert.equal(contentPlaceFitKey(CONTENT, 'middle', null), '');
  assert.equal(contentPlaceFitKey(CONTENT, 'bottom', 'left'), '');
  assert.equal(contentPlaceFitKey(TITLE, undefined, null), '');
  assert.equal(contentPlaceFitKey(TITLE, 'top', null), 'va-top');
}

// ---- 5. With a picture on the Left or Right the content aligns in its column; with Behind it moves over the picture;
// a Columns block keeps its own alignment inside the flow.
{
  for (const side of ['left', 'right', 'behind'] as const) {
    const drawn = canvas(CONTENT, { picture: side, image: 'images/dock.jpg', valign: 'middle' });
    assert.ok(drawn.classList.contains(`pic-${side}`), side);
    assert.deepEqual(vaClasses(drawn), ['va-middle'], `${side}: the place is the flow's`);
    assert.ok(drawn.querySelector('.photo'), `${side}: the picture is drawn, outside the flow`);
    assert.ok(drawn.querySelector('.blk-flow')?.parentNode === drawn, 'the flow is the canvas\'s own');
  }
  // The column is the flow's own box (left or right 432 px), and no place rule moves an edge, so the content moves in
  // it; Behind's flow is the whole slide's, over the picture.
  assert.match(flatCss, /\.deck-sl\.is-blocks\.pic-left \.blk-flow \{ left: 432px; \}/);
  assert.match(flatCss, /\.deck-sl\.is-blocks\.pic-right \.blk-flow \{ right: 432px; \}/);
  const columns = canvas(`# Two sides\n\n::: {.columns valign="bottom"}\n::: column\nLeft\n:::\n::: column\nRight\n:::\n:::`, { valign: 'middle' });
  assert.equal(columns.querySelector('.blk-columns')?.getAttribute('data-valign'), 'bottom', 'Columns keep their own alignment');
  assert.deepEqual(vaClasses(columns), ['va-middle']);
  // A picture alone moves with the place chosen.
  assert.deepEqual(vaClasses(canvas('![Dock](images/dock.jpg)', { valign: 'top' })), ['va-top']);
  assert.deepEqual(vaClasses(canvas('# Dock\n\n![Dock](images/dock.jpg)', { valign: 'bottom' })), ['va-bottom']);
}

// ---- 6. The wall, the presenter view and the page draw it alike: the place goes through `publicSlide` as one of its
// three words only, and the page draws the same canvas.
{
  assert.equal(publicSlide('', { markdown: CONTENT, valign: 'middle' }).data.valign, 'middle');
  assert.equal(publicSlide('', { markdown: CONTENT, valign: ' Bottom' }).data.valign, 'bottom');
  assert.equal(publicSlide('', { markdown: CONTENT, valign: 'a private word' }).data.valign, undefined, 'nothing else reaches the page');
  assert.equal(publicSlide('points', { title: 'A', valign: 'middle' }).data.valign, 'middle', 'a v1 slide too');
  const wall = wallSlideOf({ index: 0, kind: '', data: { markdown: CONTENT, valign: 'bottom', id: 'x1' }, notes: null, handout: '' } as never);
  assert.equal(wall.data.valign, 'bottom', 'the wall and the presenter view');
  assert.equal(wallDataOf({ markdown: CONTENT, picture: 'left', image: 'images/dock.jpg', focus: '20,30' }).focus, '20,30', "and a side picture's focus, which the page already drew");
  const text = ['---', 'deck: 2', '---', '', writeSlideBlock('', `---\nvalign: middle\n---\n${CONTENT}`), '', writeSlideBlock('', `---\nvalign: top\n---\n${TITLE}`), '', writeSlideBlock('', CONTENT), ''].join('\n');
  const deck = publicDeck(text, { folderName: 'Demo', deckName: 'Demo', theme: BUILT_IN_THEME });
  const assets: PageAssets = { slideCss, fonts: [] };
  const page = parse(pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl: () => 'pic.png' }));
  assert.equal(page.querySelectorAll('.layer .deck-sl.va-middle').length, 1, 'the page: Middle');
  assert.equal(page.querySelectorAll('.layer .deck-sl.is-cover.va-top').length, 1, 'the page: a title slide at Top');
  assert.equal(page.querySelectorAll('.layer .deck-sl[class*="va-"]').length, 2, 'the slide at its default draws none');
  // In one column (half a laptop, a phone) a title slide at Top starts at the top, without the low start; at Middle, half.
  const html = pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl: () => 'pic.png' });
  assert.match(html, /\.layer\.flow \.deck-sl\.is-blocks\.is-cover\.va-top \.blk-flow \{ padding-top: 0; \}/);
  assert.match(html, /\.layer\.flow \.deck-sl\.is-blocks\.is-cover\.va-middle \.blk-flow \{ padding-top: 9vh; \}/);
  // The stage's editor marks its canvas by the same rule.
  const editor = fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'blocks', 'SlideEditor.tsx'), 'utf8');
  assert.match(editor, /const placeClass = contentPlaceClass\(shownMarkdown, header\.valign, sidePictureOf\(header\)\)/, 'the stage works out its place');
  assert.match(editor, /'is-editing'[^\n]*lonePictureClass\(shownMarkdown, side\), placeClass,/, 'and marks its canvas with it');
}

// ---- 7. A library copy moved to another place is a change of the copy; every stamp made before it stands.
{
  const plain = slideStamp('', slideDataOf('', CONTENT), '', '');
  assert.equal(slideStamp('', slideDataOf('', `---\nid: z\n---\n${CONTENT}`), '', ''), plain);
  assert.notEqual(slideStamp('', slideDataOf('', `---\nvalign: middle\n---\n${CONTENT}`), '', ''), plain);
}

console.log('content place: passed');
