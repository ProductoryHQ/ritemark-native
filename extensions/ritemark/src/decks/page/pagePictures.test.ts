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
import { PAGE_CSS, pageHtml, pictureAddress, pictureFile, type PageAssets, type PictureFrom } from './pageHtml';
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

// The smoke run of 19 November (E): a slide's ground (its picture on the side or Behind) is drawn as a background, which
// a hidden slide never fetches, so a first print could miss it. The page carries each ground once more as a hidden
// picture, which loads with the page; nothing new is named (the same address), and the second slide's too.
{
  const photo = root.querySelector('.layer .deck-sl .photo')!.getAttribute('style') ?? '';
  const ground = /background-image:url\("(.*?)"\)/.exec(photo)![1];
  const kept = Array.from(root.querySelectorAll('.prefetch[hidden] img')).map(img => img.getAttribute('src'));
  assert.deepEqual(kept, [ground], 'the ground, once, as a hidden picture');
  assert.equal(root.querySelector('.prefetch')!.getAttribute('aria-hidden'), 'true');
  assert.equal(root.querySelectorAll('.prefetch img[loading="lazy"]').length, 1, 'never before the page\'s first paint: the script fetches them once it has loaded');
  const none = pageHtml(publicDeck('---\ndeck: 2\n---\n\n```slide\n# No picture\n```\n', { folderName: 'F', deckName: 'D', theme: BUILT_IN_THEME }), assets, { digest: 'd', pictureUrl });
  assert.ok(!none.includes('class="prefetch"'), 'no ground, no hidden pictures');
}

// #905 (the Experience lead, 20 November): in one column (a phone, half a laptop) a slide's words reflow taller than
// 16:9, and a picture Behind runs the full height of the slide as drawn there (the box its veil covers), cover-cropped
// round its focus. It never ends partway down the words: no top pulled up with the slide's own height, no `bottom: auto`.
{
  const narrow = /@media screen and \(max-width: 860px\) \{([\s\S]*?)\n\}/.exec(PAGE_CSS)![1].replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = (selector: string) => {
    const found: Record<string, string> = {};
    for (const match of narrow.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!match[1].split(',').map(part => part.trim()).includes(selector)) continue;
      for (const declaration of match[2].split(';')) {
        const at = declaration.indexOf(':');
        if (at > 0) found[declaration.slice(0, at).trim()] = declaration.slice(at + 1).replace('!important', '').trim();
      }
    }
    return found;
  };
  // A box's top, right, bottom and left, from its inset shorthand (one to four values).
  const edges = (rule: Record<string, string>) => {
    const values = (rule.inset ?? '').match(/(?:[^\s()]+|\([^)]*\))+/g) ?? []; // a var(…) is one value
    const [top, right = top, bottom = top, left = right] = values;
    return { top, right, bottom, left };
  };
  const photo = declarations('.layer.flow .deck-sl.is-blocks.pic-behind .photo');
  const veil = declarations('.layer.flow .deck-sl.is-blocks.pic-behind .veil');
  assert.equal(photo.position, 'absolute');
  assert.deepEqual(edges(photo), edges(veil), 'the picture covers what its veil covers: the slide as drawn, to every edge');
  assert.notEqual(edges(photo).bottom, 'auto', 'its foot is the slide\'s foot, never a height counted from a raised top');
  // Its edges are the view's padding round the slide: 16 px on three sides, and at the foot 16 px, or 8 px with More open
  // (the review of #912: with the text open below, a 16 px foot ran 8 px under its first line).
  const view = declarations('.view');
  const moreView = declarations('.wrap.more-open .view');
  assert.equal(view.padding.split(/\s+/).slice(0, 2).join(' '), '16px 16px');
  assert.deepEqual([edges(photo).top, edges(photo).right, edges(photo).left], ['-16px', '-16px', '-16px']);
  assert.equal(edges(photo).bottom, 'var(--behind-foot, -16px)');
  assert.equal(moreView['--behind-foot'], `-${moreView['padding-bottom']}`, 'with More open, the foot is the view\'s own');
  assert.ok(photo.height === undefined || photo.height === 'auto', `no height of its own (was ${photo.height})`);
  assert.equal(photo['max-height'], 'none', 'the general one-column picture\'s 220 px cap is lifted');
  // Cover-cropped round its focus: no narrow rule changes how the picture fills its box, and the slide sets its focus.
  for (const rule of [photo, declarations('.layer.flow .deck-sl.is-blocks .photo')]) {
    assert.equal(rule['background-size'], undefined);
    assert.equal(rule['background-position'], undefined);
  }
  assert.ok(/\.deck-sl \.photo \{[^}]*background-size: cover;/.test(assets.slideCss), 'the slide fills its place, cropped (cover)');
}

console.log('pagePictures: passed');
