/**
 * Experience 49 on the published page: a picture is drawn with its look (size, crop, caption), its attribute block never
 * shows as words, a click opens it full size (the page's own copy, nothing loaded, no new address), and a comment on a
 * picture stays private.
 *
 * Run: npx tsx src/decks/page/pagePictures.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'node-html-parser';
import { BUILT_IN_THEME } from '../deckTheme';
import { scriptBuildsReferences } from '../../publish/references';
import { PAGE_FONTS } from './pageFile';
import { pageHtml, pictureAddress, pictureFile, type PageAssets, type PictureFrom } from './pageHtml';
import { PAGE_SCRIPT } from './pageScript';
import { deckDigest, publicDeck } from './publicDeck';
import { pictureFileInside } from '../../utils/imagePaths';

const extension = path.resolve(__dirname, '..', '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(extension, 'media', 'fonts', font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
};
const pictureUrl = (picture: string, from: PictureFrom) => pictureAddress(pictureFile(picture, from));

const PRIVATE_NOTE = 'Ask Claude to crop the agents tighter';
const DECK = [
  '---',
  'deck: 2',
  '---',
  '',
  '```slide',
  '---',
  'id: p1',
  'picture: right',
  'image: images/room.jpg',
  'alt: The training room',
  'focus: 30,70',
  '---',
  '# Where agents work',
  '',
  `<!-- ${PRIVATE_NOTE} -->`,
  '![Three agents](images/agents.png){width=260px crop=16:9 focus=40,30}',
  '```',
  '',
  '## Where agents work',
  '',
  'Words in the handout.',
  '',
  '![The board, before](images/board.png){.caption width=50%}',
  '',
].join('\n');

const deck = publicDeck(DECK, { folderName: 'Harbour Logistics', deckName: 'Pictures', theme: BUILT_IN_THEME });
const html = pageHtml(deck, assets, { digest: deckDigest(deck), pictureUrl });
const root = parse(html);

// The block is the picture's: never words on the page.
assert.ok(!html.includes('{width'), 'an attribute block shows as words');
assert.ok(!html.includes('crop='), 'an attribute block shows as words');
// A comment on the picture stays private.
assert.ok(!html.includes(PRIVATE_NOTE), 'the picture\'s comment is on the page');
assert.ok(!JSON.stringify(deck).includes(PRIVATE_NOTE), 'the picture\'s comment is in publicDeck');

// The slide's picture: its width and its crop's frame; the side picture at its focus point.
const framed = root.querySelector('.layer .deck-sl .pic.blk-pic');
assert.ok(framed, 'the slide\'s cropped picture has its frame');
assert.match(framed!.getAttribute('style') ?? '', /width:260px/);
assert.match(root.querySelector('.layer .deck-sl .pic-box')!.getAttribute('style') ?? '', /aspect-ratio:1\.7778/);
assert.match(root.querySelector('.layer .deck-sl .photo')!.getAttribute('style') ?? '', /background-position:30% 70%/);

// The handout's picture: half the column, its description as its caption.
const handout = root.querySelector('.part .pic.has-caption');
assert.ok(handout, 'the handout\'s picture has its frame');
assert.match(handout!.getAttribute('style') ?? '', /width:50%/);
assert.equal(handout!.querySelector('.pic-cap')!.text, 'The board, before');

// A click opens a picture full size: the page holds the place, the script fills it with a copy of the picture.
const zoom = root.querySelector('#zoom');
assert.ok(zoom, 'the full-size view is on the page');
assert.equal(zoom!.getAttribute('hidden'), '', 'and hidden until a click');
// Its way out: an × at the top right (44 px, styled in the page), and an empty place the script fills.
assert.equal(zoom!.querySelector('button.zoom-x')?.getAttribute('aria-label'), 'Close');
assert.ok(html.includes('.zoom-x { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px;'));
assert.equal(zoom!.querySelector('.zoom-pic')?.childNodes.length, 0, 'the picture holder is empty until a click');
// A picture in a slide's words, not cropped, is drawn as the editor draws it: shrunk to fit, never cut (no frame).
const plain = pageHtml(publicDeck(DECK.replace('{width=260px crop=16:9 focus=40,30}', '{width=400px}'), { folderName: 'Harbour Logistics', deckName: 'Pictures', theme: BUILT_IN_THEME }), assets, { digest: 'x', pictureUrl });
assert.ok(/<img style="width:400px;max-width:100%" class="blk-pic" src="[^"]*agents\.png"/.test(plain), 'a sized picture is the slide\'s own .blk-pic');
assert.ok(!/class="pic blk-pic/.test(plain), 'no frame cuts it');
assert.ok(PAGE_SCRIPT.includes('function openZoom(picture)'));
assert.ok(PAGE_SCRIPT.includes(".part img, .pre img, .layer .deck-sl img, .layer .deck-sl .photo"));
assert.equal(scriptBuildsReferences(PAGE_SCRIPT), false, 'the full-size view loads nothing and names no file');
// Review of #774: a picture that is a link's words opens the link; a picture Behind is reachable through the words.
assert.ok(PAGE_SCRIPT.includes("if (picture.closest('a')) return;"));
assert.ok(html.includes('.layer .deck-sl.pic-behind .veil, .layer .deck-sl.pic-behind .blk-flow { pointer-events: none; }'));

// Show in Finder: only a picture beside the document and inside the project.
const posix = path.posix;
assert.equal(pictureFileInside('/p/docs', '/p', 'images/a.png', posix), '/p/docs/images/a.png');
assert.equal(pictureFileInside('/p/docs', '/p', './my%20pic.png', posix), '/p/docs/my pic.png');
assert.equal(pictureFileInside('/p/docs', '/p', '../shared/a.png', posix), '/p/shared/a.png');
for (const outside of ['../../etc/passwd', '/etc/hosts', 'https://x.test/a.png', 'file:///a.png', 'C:\\a.png', '', 42]) {
  assert.equal(pictureFileInside('/p/docs', '/p', outside, posix), null, String(outside));
}

console.log('pagePictures: passed');
