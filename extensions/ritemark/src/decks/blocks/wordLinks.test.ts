/**
 * #930: a link in a slide's words is a real link in Present, on the published page and in every PDF kind (they print
 * the page). Only a full http(s) or mailto address is ever live; `javascript:`, `data:`, `file:`, a relative path and
 * the rest stay plain underlined words on every surface (the page is public). The strip and the stage carry the address
 * but never open it; the wall and the presenter view ask the host, which opens only an address the deck's words hold.
 *
 * Run: npx tsx src/decks/blocks/wordLinks.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDocument } from '@mixmark-io/domino';
import { parse } from 'node-html-parser';
import { isWordLinkAddress } from './buttonBlock';
import { blockButtonAddresses, blockSlideHtml, blockSlideMarkup, blockWordLinkAddresses } from './slideRenderer';
import { deckButtonAddresses } from '../deckButtons';
import { deckWordLinkAddresses } from '../deckButtons';
import { decodeWallRequest } from '../present/presentProtocol';
import { BUILT_IN_THEME } from '../deckTheme';
import { publicDeck } from '../page/publicDeck';
import { pageHtml, type PageAssets } from '../page/pageHtml';
import { PAGE_FONTS } from '../page/pageFile';
import { codeToolsClick } from '../../../webview/src/components/decks/slide/codeToolsClick';

const LIVE = ['https://example.com/report', 'http://example.com/a?b=1&c=2', 'HTTPS://Example.com/', 'mailto:trainer@example.com', 'mailto:trainer@example.com?subject=Hi'];
const DEAD = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  ' javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  'vbscript:msgbox(1)',
  'https:example.com',
  'https:/example.com',
  'https://',
  'https://user:secret@example.com/',
  'https://exa mple.com',
  'https://example.com/\njavascript:alert(1)',
  '//example.com/a.pdf',
  'files/report.pdf',
  '../notes.md',
  '#slide-2',
  'mailto:',
  'tel:+3725550000',
  '',
];

// ---- The rule
for (const address of LIVE) assert.equal(isWordLinkAddress(address), true, `live: ${address}`);
for (const address of DEAD) assert.equal(isWordLinkAddress(address), false, `stays words: ${JSON.stringify(address)}`);
assert.equal(isWordLinkAddress(42), false);
assert.equal(isWordLinkAddress(`https://example.com/${'a'.repeat(2100)}`), false, 'no longer than a button keeps');

// ---- The slide as each surface draws it
const SLIDE = '# Read first\n\nThe [bank report](https://example.com/report?a=1&b=2) and [mail me](mailto:trainer@example.com).';
{
  const page = blockSlideHtml(SLIDE, { buttonLinks: true });
  assert.ok(page.includes('<a class="blk-link" href="https://example.com/report?a=1&amp;b=2" target="_blank" rel="noopener noreferrer" tabindex="-1">bank report</a>'), page);
  assert.ok(page.includes('<a class="blk-link" href="mailto:trainer@example.com" rel="noopener noreferrer" tabindex="-1">mail me</a>'), page);
  const wall = blockSlideHtml(SLIDE);
  assert.ok(!wall.includes('<a '), 'the wall, the strip and the stage draw no <a>');
  assert.ok(wall.includes('<span class="blk-link" role="link" data-href="https://example.com/report?a=1&amp;b=2" tabindex="-1">bank report</span>'), wall);
  // Words inside a link keep their marks.
  assert.ok(blockSlideHtml('[**Bold** words](https://example.com)', { buttonLinks: true }).includes('><strong>Bold</strong> words</a>'));
  // A link inside a heading, a list, a box and a Button's words is live too.
  const deep = blockSlideHtml('## See [this](https://example.com/h)\n\n- [item](https://example.com/l)\n\n:::: {.boxes}\n::: {.box}\n[box](https://example.com/b)\n:::\n::::\n\nRead [the words](https://example.com/w) first. [Open](https://example.com/x.pdf){.button}', { buttonLinks: true });
  for (const address of ['h', 'l', 'b', 'w']) assert.ok(deep.includes(`<a class="blk-link" href="https://example.com/${address}"`), `${address}: ${deep}`);
}

// ---- Safety: nothing else ever becomes a link, on the page or the wall
for (const address of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'notes/plan.md', '#two', 'vbscript:x', 'https://user:pw@example.com/']) {
  for (const buttonLinks of [true, false]) {
    const html = blockSlideHtml(`Go [there](${address}) now.`, { buttonLinks });
    assert.ok(html.includes('<span class="blk-link">there</span>'), `${address}: ${html}`);
    for (const banned of ['href', 'data-href', 'role="link"', 'javascript', 'data:', 'file:', 'vbscript', 'pw@']) assert.ok(!html.includes(banned), `${banned} for ${address} in ${html}`);
  }
}
// An attribute value never breaks out of its attribute.
{
  const html = blockSlideHtml('[x](<https://example.com/a"onmouseover="alert(1)>)', { buttonLinks: true });
  assert.ok(!/"\s*onmouseover=/.test(html), html);
}

// ---- Review round 1: autolinks and reference links are links too, read the same way everywhere
{
  const md = 'See https://example.com/report and <https://example.com/angle> and [ref][r].\n\n[r]: https://example.com/ref';
  const page = blockSlideHtml(md, { buttonLinks: true });
  for (const address of ['report', 'angle', 'ref']) assert.ok(page.includes(`<a class="blk-link" href="https://example.com/${address}"`), `${address}: ${page}`);
  assert.deepEqual(blockWordLinkAddresses(md).sort(), ['https://example.com/angle', 'https://example.com/ref', 'https://example.com/report']);
  // A serializer's escapes in a bare address are read, so the link opens the address written (not `a/_b`).
  const escaped = 'Go to https://example.com/a\\_b\\&c=1 now.';
  assert.ok(blockSlideHtml(escaped, { buttonLinks: true }).includes('href="https://example.com/a_b&amp;c=1"'), blockSlideHtml(escaped, { buttonLinks: true }));
  assert.deepEqual(blockWordLinkAddresses(escaped), ['https://example.com/a_b&c=1']);
  // A button's own link is a button's, never a word link: an http one draws an inert button and opens nothing.
  const buttons = 'Words [inside](https://example.com/w). [Open](http://example.com/x){.button}\n\n[Get](https://example.com/y){.button}';
  assert.deepEqual(blockWordLinkAddresses(buttons), ['https://example.com/w']);
  assert.deepEqual(blockButtonAddresses(buttons), ['https://example.com/y']);
}

// ---- Review round 1: a v1 slide the wall draws as blocks has its links on the deck's list too
{
  const deck = '```slide points\nid: p1\ntitle: Read\nitems:\n- text: See https://example.com/v1 first\n```\n';
  assert.ok(deckWordLinkAddresses(deck).has('https://example.com/v1'), [...deckWordLinkAddresses(deck)].join(','));
  assert.equal(deckButtonAddresses(deck).size, 0);
}

// ---- Review round 1: a thumbnail's link is the thumbnail's click (All slides, the strip, the presenter's rows)
{
  const css = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8');
  assert.match(css, /\.wall-grid \.blk-link[^{]*\{ pointer-events: none; \}/);
  assert.match(css, /\.deck-thumb \.blk-link,/);
}

// ---- The published page (and so every PDF kind, which prints it)
{
  const extension = path.resolve(__dirname, '..', '..', '..');
  const assets: PageAssets = {
    slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
    fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(extension, 'media', 'fonts', font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
  };
  const text = '---\ndeck: 2\n---\n\n````slide\n# Read first\nThe [bank report](https://example.com/report) and [no](javascript:alert(1)).\n````\n\nThe handout\'s [own link](https://example.com/handout).\n';
  const deck = publicDeck(text, { folderName: 'Demo', deckName: 'Links', theme: BUILT_IN_THEME });
  const html = pageHtml(deck, assets, { digest: 'd', pictureUrl: () => null });
  const root = parse(html);
  const slideLinks = root.querySelectorAll('.layer a.blk-link').map(a => a.getAttribute('href'));
  assert.deepEqual(slideLinks, ['https://example.com/report'], 'the slide\'s web link is a real link on the page');
  assert.ok(!html.includes('javascript:'), 'a javascript: link never reaches the page');
  assert.ok(root.querySelectorAll('a').some(a => a.getAttribute('href') === 'https://example.com/handout'), 'the handout\'s own link stays a link');
  // The slide's word links keep the slide's colour (a link's default blue never shows).
  assert.match(assets.slideCss, /\.deck-sl\.is-blocks \.blk-link \{ color: inherit;/);
}

// ---- Present: the wall asks, the host opens only the deck's own addresses
{
  assert.deepEqual(blockWordLinkAddresses(SLIDE), ['https://example.com/report?a=1&b=2', 'mailto:trainer@example.com']);
  assert.deepEqual(blockWordLinkAddresses('[x](javascript:alert(1)) [y](notes.md)'), []);
  const deck = '---\ndeck: 2\n---\n\n````slide\n# A\nSee [the report](https://example.com/a).\n````\n\nThe handout\'s [own](https://example.com/h).\n';
  const addresses = deckWordLinkAddresses(deck);
  assert.ok(addresses.has('https://example.com/a'));
  assert.ok(!addresses.has('https://example.com/h'), 'the wall never draws the handout\'s links');
  for (const address of LIVE) assert.deepEqual(decodeWallRequest({ type: 'present/open-link', url: address }), { type: 'present/open-link', url: address });
  for (const address of DEAD) assert.equal(decodeWallRequest({ type: 'present/open-link', url: address }), null, `the wall can't ask for ${JSON.stringify(address)}`);
}

// ---- The wall's click: a word link asks the host; plain words don't
{
  const doc = createDocument(`<body><div id="wall">${blockSlideHtml('See [the report](https://example.com/a) and [no](notes.md).')}</div></body>`);
  const root = doc.getElementById('wall') as unknown as Element;
  const linked: string[] = [];
  const actions = { copy: () => undefined, open: () => undefined, link: (url: string) => linked.push(url) };
  const live = root.querySelector('.blk-link[data-href]') as Element;
  assert.equal(codeToolsClick(live, root, actions), 'used');
  assert.deepEqual(linked, ['https://example.com/a']);
  const dead = Array.from(root.querySelectorAll('.blk-link')).find(link => !link.hasAttribute('data-href')) as Element;
  assert.equal(codeToolsClick(dead, root, actions), 'none', 'plain words are the wall\'s click');
  assert.deepEqual(linked, ['https://example.com/a']);
}

// ---- The strip, the stage and the wall draw the same markup as before, but for the address on the link
{
  const markup = blockSlideMarkup({ markdown: SLIDE }, { theme: BUILT_IN_THEME, borderless: false });
  assert.ok(markup.includes('class="blk-link" role="link"'));
  assert.ok(!markup.includes('<a '));
}

console.log('wordLinks: all passed');
