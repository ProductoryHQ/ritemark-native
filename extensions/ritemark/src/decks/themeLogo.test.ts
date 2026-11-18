/**
 * Sprint 162 PR 4 (step-3-themes.md, "Logo"): a theme's logo.
 *
 *  - The theme file's `logo:` line: written in one line, read back, its place and where it shows only with a logo,
 *    and Remove gives the file back byte for byte; the tab may only take a logo out (the host names the picture).
 *  - The place and title-only rules: the logo in its corner of the 960 × 540 canvas, on every slide or on title slides
 *    (a slide with its title alone) only, in the block renderer, an old slide's markup, and the deck view's canvas.
 *  - A missing file draws nothing: no address, no `<img>`.
 *  - An SVG stays an `<img>`, on the page too, and an SVG with scripts or links in it is no logo.
 *  - The page carries the file beside it, as it carries fonts: `logos/logo-<hash>.svg`, create-only, never over another
 *    file, gathered with the page; the page's digest and the sheet's words count it.
 *  - A second logo for the other ground (18 November): its `logo-for-light:` (or `logo-for-dark:`) line written, read
 *    back and removed; the logo chosen by the slides' ground (a Card deck its theme's, Borderless white); the page
 *    carrying only the file its slides draw; a theme with no second logo unchanged, byte for byte.
 *
 * Run: npx tsx src/decks/themeLogo.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gatherPage } from '../publish/gather';
import { BUILT_IN_THEME_TEXT, drawsSecondLogo, groundOf, isLogoPath, parseTheme, secondLogoGround, themeWithLogoAddresses } from './deckTheme';
import { isThemeChanges, themeTextWith } from './themeFile';
import { logoAspectOf, logoKindOfName, logoNames, logoProblem, MAX_LOGO_BYTES, svgProblem, themeStem } from './themeLogo';
import { decodeThemeRequest, ThemeProtocolError } from './themeProtocol';
import { BLOCK_CANVAS_HEIGHT, BLOCK_CANVAS_WIDTH, FLOW_BOTTOM, FLOW_TOP, LOGO_CLEARANCE, LOGO_GAP, LOGO_HEIGHT, LOGO_MAX_WIDTH, blockCanvasMarkup, logoDrop, blockSlideMarkup, drawsLogo, logoTitleMargin, slideLogoHtml, themeSlideLogo } from './blocks/slideRenderer';
import { slideMarkup } from '../../webview/src/components/decks/slide/slideMarkup';
import { LOGO_PLACE, PAGE_FONTS, buildDeckPage, foreignLogoLine, nodeFontFs, nodePageFs, pageLogoFile, pageLogoOf, removePageFonts, writeDeckPage, writePageFonts } from './page/pageFile';
import type { PageAssets } from './page/pageHtml';
import { deckCounts, deckSheetRows } from './page/sheetRows';

let passed = 0;
function test(name: string, run: () => void | Promise<void>): Promise<void> {
  return Promise.resolve().then(run).then(() => { passed++; }, error => { console.error(`FAIL ${name}`); throw error; });
}

const FERN = [
  '---',
  "name: 'Fernhollow Bank'",
  "background: '#F4F8F5'",
  'headings: "#10261E"',
  'text: "#2F4A40"',
  'accent: "#1F8A5B"',
  'soft-light: false',
  'heading-font: Source Serif 4',
  'text-font: Inter',
  'corners: square',
  'boxes: filled',
  'card:',
  '  g1: "#3D428F"',
  '---',
  '',
].join('\n');

/** FERN with these lines before its closing `---` (after its shade section, so they are top-level keys again). */
const withLines = (...lines: string[]) => FERN.replace(/\n---\n$/, `\n${lines.join('\n')}\n---\n`);

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 172 32"><defs><linearGradient id="g"><stop offset="0" stop-color="#1F8A5B"/></linearGradient></defs><path fill="url(#g)" d="M0 0h32v32H0z"/><text x="40" y="24" font-size="20">Fernhollow</text></svg>';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a1f3d2e20000000049454e44ae426082', 'hex');

const extension = path.resolve(__dirname, '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(extension, 'media', 'fonts', font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
};

/** A deck of a title slide and a slide with words under its title. */
const DECK = '---\ndeck: 2\ntheme: Slide library/Themes/Fernhollow Bank.theme.md\n---\n\n```slide\n# Harbour title\n\nA line under it\n```\n\n```slide\n# Four parts\n\n- Instructions\n- Knowledge\n```\n';

async function main(): Promise<void> {
  // ---- The theme file's logo line
  await test('a logo is one line, read back with its defaults; its place and where it shows go only with a logo', () => {
    const added = themeTextWith(FERN, { logo: 'Fernhollow Bank logo.svg' });
    const extra = added.split('\n').filter(line => !FERN.split('\n').includes(line));
    assert.deepEqual(extra, ['logo: Fernhollow Bank logo.svg'], 'one line, before the shade sections');
    assert.ok(added.indexOf('logo:') < added.indexOf('card:'));
    assert.deepEqual(parseTheme(added).logo, { file: 'Fernhollow Bank logo.svg', place: 'top-right', on: 'every-slide' });
    assert.equal(parseTheme(added).card?.g1, '#3D428F', 'the hand-picked shades stay: a logo is no colour change');
    // Its corner and where it shows: each one line, only while there is a logo.
    const placed = themeTextWith(added, { logoAt: 'bottom-right', logoOn: 'title-slides' });
    assert.deepEqual(parseTheme(placed).logo, { file: 'Fernhollow Bank logo.svg', place: 'bottom-right', on: 'title-slides' });
    assert.equal(placed.split('\n').length, added.split('\n').length + 2);
    assert.equal(themeTextWith(FERN, { logoAt: 'top-left' }), FERN, 'no logo: no place line');
    assert.equal(themeTextWith(added, { logoAt: 'top-right', logoOn: 'every-slide' }), added, 'the defaults need no lines');
    // Remove takes the three lines out, and the file is as it was, byte for byte.
    assert.equal(themeTextWith(placed, { logo: null }), FERN);
    assert.equal(themeTextWith(added, { logo: null }), FERN);
    assert.equal(themeTextWith(FERN, { logo: null }), FERN, 'nothing to remove: the same text');
    // Replace: the one line changes.
    const replaced = themeTextWith(placed, { logo: 'Fernhollow Bank logo 2.png' });
    assert.deepEqual(parseTheme(replaced).logo, { file: 'Fernhollow Bank logo 2.png', place: 'bottom-right', on: 'title-slides' });
    // CRLF and quotes as the file had them.
    const crlf = FERN.replace(/\n/g, '\r\n');
    const crlfAdded = themeTextWith(crlf, { logo: 'Logo.svg' });
    assert.ok(crlfAdded.includes('\r\nlogo: Logo.svg\r\n'));
    assert.equal(themeTextWith(crlfAdded, { logo: null }), crlf);
    const quoted = FERN.replace('boxes: filled', 'boxes: filled\nlogo: "Old logo.svg"');
    assert.ok(themeTextWith(quoted, { logo: 'New.svg' }).includes('logo: "New.svg"'));
    // The built-in theme's text gets one too, and gives it back.
    assert.equal(themeTextWith(themeTextWith(BUILT_IN_THEME_TEXT, { logo: 'Evening logo.png' }), { logo: null }), BUILT_IN_THEME_TEXT);
  });

  await test('a theme names a logo only as a picture beside it', () => {
    for (const good of ['Logo.svg', 'Fernhollow Bank logo 2.PNG', 'brand/logo.svg']) assert.ok(isLogoPath(good), good);
    for (const bad of ['', 'logo.jpg', '../logo.svg', 'brand/../../x.svg', '/etc/logo.svg', 'C:\\logo.svg', 'https://x.test/logo.svg', 'file:///x.svg', 'data:image/svg+xml,x.svg', 'a//b.svg', 'a\u0000.svg']) {
      assert.ok(!isLogoPath(bad), bad);
      assert.equal(parseTheme(withLines(`logo: ${JSON.stringify(bad)}`)).logo, undefined, `no logo for ${bad}`);
    }
    assert.equal(parseTheme(FERN).logo, undefined, 'a theme without the line has no logo field at all');
    assert.ok(!('logo' in parseTheme(FERN)), 'so a page made before the logo keeps its digest');
    assert.deepEqual(parseTheme(withLines('logo: "brand/L.svg"')).logo, { file: 'brand/L.svg', place: 'top-right', on: 'every-slide' }, 'the helper writes a line the reader takes');
    const odd = parseTheme(withLines('logo: L.svg', 'logo-place: middle', 'logo-on: sometimes')).logo;
    assert.deepEqual(odd, { file: 'L.svg', place: 'top-right', on: 'every-slide' }, 'a place or an On it doesn\'t know is the default');
  });

  await test('the tab only takes a logo out; the host names the picture', () => {
    assert.ok(isThemeChanges({ logo: null }));
    assert.ok(isThemeChanges({ logoAt: 'top-left' }));
    assert.ok(isThemeChanges({ logoOn: 'title-slides' }));
    for (const bad of [{ logo: 'x.svg' }, { logo: '../../.ssh/id_rsa' }, { logoAt: 'middle' }, { logoOn: true }]) assert.ok(!isThemeChanges(bad), JSON.stringify(bad));
    assert.deepEqual(decodeThemeRequest({ type: 'theme/choose-logo' }), { type: 'theme/choose-logo' });
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`;
    assert.deepEqual(decodeThemeRequest({ type: 'theme/logo-file', dataUrl, filename: 'Logo.svg' }), { type: 'theme/logo-file', dataUrl, filename: 'Logo.svg' });
    for (const bad of [
      { type: 'theme/logo-file', dataUrl, filename: '../Logo.svg' },
      { type: 'theme/logo-file', dataUrl, filename: 'Logo.jpg' },
      { type: 'theme/logo-file', dataUrl: 'data:text/html;base64,PGI+', filename: 'Logo.svg' },
      { type: 'theme/logo-file', dataUrl, filename: 'Logo.svg', path: '/x' },
      { type: 'theme/choose-logo', path: '/etc/passwd' },
    ]) assert.throws(() => decodeThemeRequest(bad), ThemeProtocolError, JSON.stringify(bad).slice(0, 80));
  });

  // ---- The picture: what may be a logo, and its name beside the theme
  await test('an SVG or a PNG, small, and an SVG with nothing in it that runs or loads', () => {
    assert.equal(logoProblem('Logo.svg', Buffer.from(SVG)), null);
    assert.equal(logoProblem('Logo.png', PNG), null);
    assert.match(logoProblem('Logo.png', Buffer.from(SVG)) ?? '', /isn't a PNG/);
    assert.match(logoProblem('Logo.svg', PNG) ?? '', /isn't an SVG/);
    assert.match(logoProblem('Logo.gif', PNG) ?? '', /SVG or a PNG/);
    assert.match(logoProblem('Logo.png', Buffer.alloc(0)) ?? '', /empty/);
    assert.match(logoProblem('Logo.png', Buffer.concat([PNG, Buffer.alloc(MAX_LOGO_BYTES)])) ?? '', /at most 5 MB/);
    for (const unsafe of [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"></svg>',
      '<svg><rect ONCLICK = "x()"/></svg>',
      '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
      '<svg><image href="https://tracker.test/p.png"/></svg>',
      '<svg><image xlink:href="other.png"/></svg>',
      '<svg><use href="sprite.svg#a"/></svg>',
      '<svg><foreignObject><div>x</div></foreignObject></svg>',
      '<svg><style>@import url(https://x.test/a.css);</style></svg>',
      '<svg><rect style="fill:url(https://x.test/a.svg#p)"/></svg>',
      '<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>',
      '<svg><iframe src="x"/></svg>',
      // The review of #785: a prefix, an animation, `image-set()` and a character reference don't hide them.
      '<svg xmlns:x="http://www.w3.org/1999/xlink"><image x:href="https://tracker.test/p.png"/></svg>',
      '<svg><svg:script>alert(1)</svg:script></svg>',
      '<svg xmlns:h="http://www.w3.org/1999/xhtml"><h:script>alert(1)</h:script></svg>',
      '<svg><image><set attributeName="href" to="https://tracker.test/p.png"/></image></svg>',
      '<svg><rect style="fill:image-set(\'https://x.test/a.png\' 1x)"/></svg>',
      '<svg><a href="javascript&#x3a;alert(1)"><text>x</text></a></svg>',
      '<svg><image href="&#104;ttps://tracker.test/p.png"/></svg>',
      // Codex on #785: a character reference or a CSS escape in a style sheet doesn't hide @import or url().
      '<svg xmlns="http://www.w3.org/2000/svg"><style>&#64;import "https://attacker.test/x.css";</style></svg>',
      '<svg><style>@\\69mport "https://attacker.test/x.css";</style></svg>',
      '<svg><rect style="fill:u\\72l(https://x.test/p.svg#a)"/></svg>',
    ]) assert.match(svgProblem(unsafe) ?? '', /scripts or links/, unsafe);
    assert.equal(svgProblem('<svg><style>.cls-1{fill:#1f8a5b}</style><rect class="cls-1" style="opacity:.9"/></svg>'), null, 'a design tool\'s plain styles are fine');
    assert.equal(svgProblem('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/><text>Fish &amp; Chips</text></svg>'), null, 'xlink, its own ids and an escaped & are fine');
    assert.equal(svgProblem('<svg><use href="#a"/><rect fill="url(#g)"/><image href="data:image/png;base64,AAAA"/></svg>'), null, 'its own parts and an embedded picture are fine');
    assert.match(svgProblem('<html>not a picture</html>') ?? '', /isn't an SVG/);
  });

  await test('the copy beside the theme is named after it, and never over another picture', () => {
    assert.equal(themeStem('Slide library/Themes/Fernhollow Bank.theme.md'), 'Fernhollow Bank');
    const names = [...logoNames('Fernhollow Bank.theme.md', 'svg')].slice(0, 3);
    assert.deepEqual(names, ['Fernhollow Bank logo.svg', 'Fernhollow Bank logo 2.svg', 'Fernhollow Bank logo 3.svg']);
    assert.ok(names.every(isLogoPath));
    assert.equal(logoKindOfName('A.PNG'), 'png');
    const long = [...logoNames(`${'ö'.repeat(150)}.theme.md`, 'png')][0];
    assert.ok(Buffer.byteLength(long) < 255, 'within a file name\'s 255 bytes');
  });

  await test('the review of #785: the fonts go back with a logo that can\'t be written; the wall reads the theme at its first look', () => {
    const publish = fs.readFileSync(path.join(extension, 'src/decks/deckPublish.ts'), 'utf8');
    assert.ok(publish.indexOf('fonts = fontsWritten;') < publish.indexOf('await writePageFonts(nodeFontFs, deckPath, logoFiles, LOGO_PLACE)'), 'the fonts are kept for taking back before the logo is written');
    const presenter = fs.readFileSync(path.join(extension, 'src/decks/present/DeckPresenter.ts'), 'utf8');
    assert.match(presenter, /theme: \{ path: UNREAD_THEME, value: BUILT_IN_THEME \}/, 'a deck naming no theme reads the project\'s own Evening on the wall too');
    assert.match(fs.readFileSync(path.join(extension, 'src/decks/themePages.ts'), 'utf8'), /createFileSystemWatcher\(`\*\*\/\$\{THEMES_FOLDER\}\/\*\*\/\*\.\{svg,png,SVG,PNG\}`\)/, 'a logo put back is drawn again');
  });

  await test('the Experience lead (18 November): a long title never runs under a top-right logo', () => {
    // The logo's own width: 26 px high at its width to height (an SVG's viewBox, a PNG's header), at most 190.
    assert.equal(logoAspectOf(Buffer.from(SVG), 'svg'), 172 / 32);
    assert.equal(logoAspectOf(PNG, 'png'), 1);
    assert.equal(logoAspectOf(Buffer.from('<svg width="80" height="40"></svg>'), 'svg'), 2);
    assert.equal(logoAspectOf(Buffer.from('<svg></svg>'), 'svg'), null);
    const theme = { ...parseTheme(themeTextWith(FERN, { logo: 'L.svg' })), logoUrl: 'L.svg', logoAspect: 172 / 32 };
    const logo = themeSlideLogo(theme, false)!;
    assert.equal(logo.width, 139.75);
    assert.equal(themeSlideLogo({ ...theme, logoAspect: 20 }, false)!.width, LOGO_MAX_WIDTH, 'a very wide logo counts at its widest');
    assert.equal(themeSlideLogo({ ...theme, logoAspect: undefined }, false)!.width, LOGO_MAX_WIDTH, 'an unknown shape counts at its widest');
    // A two-line title that runs to the right edge: the first block's right edge is the logo's left edge less 16 px.
    const title = { markdown: '# Mõõdame, kuidas meeskonna päevaplaan, kõnede jagamine ja õhtune ülevaade tegelikult toimivad\n\n- One\n- Two' };
    const canvas = blockCanvasMarkup(title, { logo });
    const room = Number(/--logo-room:(\d+)px/.exec(canvas)?.[1]);
    assert.match(canvas, /class="deck-sl is-blocks logo-tr"/);
    const flowRight = BLOCK_CANVAS_WIDTH - 64;
    const logoLeft = BLOCK_CANVAS_WIDTH - 30 - logo.width;
    assert.ok(flowRight - room <= logoLeft - LOGO_CLEARANCE, `the title ends at ${flowRight - room}, the logo starts at ${logoLeft}`);
    assert.equal(room, logoTitleMargin(logo));
    // Only a top-right logo on the slide keeps the room: not elsewhere, not where it isn't drawn, not on a title slide.
    for (const other of [{ ...logo, place: 'top-left' as const }, { ...logo, place: 'bottom-right' as const }, { ...logo, on: 'title-slides' as const }]) {
      assert.doesNotMatch(blockCanvasMarkup(title, { logo: other }), /logo-tr|--logo-room/);
    }
    assert.doesNotMatch(blockCanvasMarkup(title, {}), /logo-tr|logo-tl|logo-br/, 'no logo, no room');
    assert.doesNotMatch(blockCanvasMarkup({ markdown: '# Harbour title\n\nA line under it' }, { logo }), /logo-tr/, 'a title slide\'s words sit low');
    const css = fs.readFileSync(path.join(extension, 'webview/src/components/decks/slide/slide.css'), 'utf8');
    assert.match(css, /\.deck-sl\.is-blocks\.logo-tr \.blk-flow > :first-child \{ margin-right: var\(--logo-room, 0px\); \}/);
    assert.match(fs.readFileSync(path.join(extension, 'webview/src/components/decks/blocks/SlideEditor.tsx'), 'utf8'), /logoMarks\.cls\]/, 'the stage keeps the room too');
  });

  await test('"never touch": a top-left logo moves the words down, a bottom-right one ends them higher, only where it shows', () => {
    const base = { url: 'L.svg', on: 'every-slide' as const, width: 139.75 };
    const css = fs.readFileSync(path.join(extension, 'webview/src/components/decks/slide/slide.css'), 'utf8');
    const twoLines = { markdown: '# Mõõdame, kuidas meeskonna päevaplaan, kõnede jagamine ja õhtune ülevaade tegelikult toimivad\n\n- One\n- Two' };
    assert.equal(logoDrop(), LOGO_HEIGHT + LOGO_GAP);
    assert.equal(logoDrop(), 38);
    // Top left: the words start 38 px lower, so the first line's top is the logo's bottom and 12 px; no line moves in.
    const left = blockCanvasMarkup(twoLines, { logo: { ...base, place: 'top-left' } });
    assert.match(left, /class="deck-sl is-blocks logo-tl" style="--logo-drop:38px"/);
    assert.match(css, /\.deck-sl\.is-blocks\.logo-tl \.blk-flow \{ top: calc\(46px \+ var\(--logo-drop, 0px\)\); \}/);
    const logoBottom = 22 + LOGO_HEIGHT;
    assert.ok(FLOW_TOP + logoDrop() >= logoBottom + LOGO_GAP, 'the first line starts below the logo and 12 px');
    assert.doesNotMatch(css, /logo-tl[^{]*\{[^}]*(left|margin-left|padding-left)/, 'never in');
    // Bottom right: the words end 38 px higher, above the logo's top and 12 px.
    const bottom = blockCanvasMarkup(twoLines, { logo: { ...base, place: 'bottom-right' } });
    assert.match(bottom, /class="deck-sl is-blocks logo-br" style="--logo-drop:38px"/);
    assert.match(css, /\.deck-sl\.is-blocks\.logo-br \.blk-flow \{ bottom: calc\(34px \+ var\(--logo-drop, 0px\)\); \}/);
    const logoTop = BLOCK_CANVAS_HEIGHT - 18 - LOGO_HEIGHT;
    assert.ok(BLOCK_CANVAS_HEIGHT - (FLOW_BOTTOM + logoDrop()) <= logoTop - LOGO_GAP, 'the last line ends above the logo');
    // Title slides too when the logo is on them; with "Title slides", a body slide keeps all its room.
    const cover = { markdown: '# Harbour title\n\nA line under it' };
    assert.match(blockCanvasMarkup(cover, { logo: { ...base, place: 'bottom-right' } }), /is-cover logo-br/);
    assert.match(blockCanvasMarkup(cover, { logo: { ...base, place: 'top-left', on: 'title-slides' } }), /is-cover logo-tl/);
    for (const place of ['top-left', 'bottom-right'] as const) {
      assert.doesNotMatch(blockCanvasMarkup(twoLines, { logo: { ...base, place, on: 'title-slides' } }), /logo-tl|logo-br|--logo-drop/);
    }
  });

  // ---- The place and title-only rules, and a missing file
  await test('the logo in its corner, on every slide or on title slides only; no address draws nothing', () => {
    const theme = parseTheme(themeTextWith(FERN, { logo: 'L.svg' }));
    assert.equal(themeSlideLogo(theme, false), null, 'a missing file (no address): no logo');
    assert.equal(slideLogoHtml(themeSlideLogo(theme, false), true), '');
    const drawn = { ...theme, logoUrl: 'https://file.test/L.svg?v=1' };
    const every = themeSlideLogo(drawn, false)!;
    assert.deepEqual(every, { url: 'https://file.test/L.svg?v=1', place: 'top-right', on: 'every-slide', width: 190 });
    assert.ok(drawsLogo(every, false) && drawsLogo(every, true));
    const titles = { ...every, on: 'title-slides' as const };
    assert.ok(drawsLogo(titles, true) && !drawsLogo(titles, false));
    for (const place of ['top-left', 'top-right', 'bottom-right'] as const) {
      assert.equal(slideLogoHtml({ ...every, place }, false), `<img class="slide-logo is-${place}" src="https://file.test/L.svg?v=1" alt="" draggable="false">`);
    }
    assert.equal(slideLogoHtml({ ...every, url: 'x.svg?a=1&b="2"' }, false), '<img class="slide-logo is-top-right" src="x.svg?a=1&amp;b=&quot;2&quot;" alt="" draggable="false">', 'its address escaped');
    // A title slide (its title alone, or with a line under it) and a slide with more on it, in the block renderer.
    const cover = { markdown: '# Harbour title\n\nA line under it' };
    const body = { markdown: '# Four parts\n\n- Instructions\n- Knowledge' };
    const has = (html: string) => html.includes('class="slide-logo');
    assert.ok(has(blockCanvasMarkup(cover, { logo: every })) && has(blockCanvasMarkup(body, { logo: every })));
    assert.ok(has(blockCanvasMarkup(cover, { logo: titles })) && !has(blockCanvasMarkup(body, { logo: titles })));
    assert.ok(!has(blockCanvasMarkup(cover, {})), 'no logo given: none');
    // Inside the 960 × 540 canvas (the 16:9 area the wall keeps, #779), after the words: over them, never in their flow.
    const canvas = blockCanvasMarkup(body, { logo: every });
    assert.ok(canvas.indexOf('class="slide-logo') > canvas.indexOf('class="blk-flow"') && canvas.endsWith('draggable="false"></div>'));
    // `blockSlideMarkup` takes it from the theme, as the page draws it; a theme with no address draws none.
    assert.ok(has(blockSlideMarkup(cover, { theme: drawn, borderless: false })));
    assert.ok(!has(blockSlideMarkup(cover, { theme, borderless: false })));
    assert.ok(has(blockSlideMarkup(cover, { theme: drawn, borderless: true })), 'Borderless too');
    // An old slide's markup: a Title or Section slide is a title slide.
    const titled = { ...drawn, logo: { ...drawn.logo!, on: 'title-slides' as const } };
    assert.ok(has(slideMarkup('title', { title: 'T' }, { theme: titled, borderless: false })));
    assert.ok(!has(slideMarkup('other', { title: 'T' }, { theme: titled, borderless: false })));
    assert.ok(has(slideMarkup('other', { title: 'T' }, { theme: drawn, borderless: false })));
  });

  await test('the views draw it as an <img>, never as markup, and skip it when they fit the words', () => {
    const read = (file: string) => fs.readFileSync(path.join(extension, file), 'utf8');
    const canvas = read('webview/src/components/decks/slide/SlideCanvas.tsx');
    assert.match(canvas, /<img className=\{`slide-logo is-\$\{logo\.place\}`\} src=\{logo\.url\} alt="" draggable=\{false\} \/>/);
    assert.match(canvas, /element\.classList\.contains\('slide-logo'\)\) continue/, 'the old slides\' fit never counts the logo');
    assert.match(read('webview/src/components/decks/blocks/SlideEditor.tsx'), /<SlideLogoImage logo=\{themeSlideLogo\(theme, borderless\)\} cover=\{isCoverSlide\(shownMarkdown\)\} \/>/, 'the stage');
    const row = read('webview/src/components/decks/theme/LogoRow.tsx');
    assert.match(row, /<img className="theme-logo-picture" src=\{url\}/);
    for (const source of [canvas, row]) assert.doesNotMatch(source.replace(/\/\*\*[\s\S]*?\*\//g, ''), /dangerouslySetInnerHTML=\{\{ __html: (logo|theme\.logo)/);
    const css = read('webview/src/components/decks/slide/slide.css');
    assert.match(css, /\.deck-sl \.slide-logo \{ position: absolute; display: block; height: 26px; width: auto; max-width: 190px;[^}]*pointer-events: none;/);
    assert.match(css, /\.slide-logo\.is-top-left \{ top: 22px; left: 30px;/);
    assert.match(css, /\.slide-logo\.is-top-right \{ top: 22px; right: 30px;/);
    assert.match(css, /\.slide-logo\.is-bottom-right \{ bottom: 18px; right: 30px;/);
  });

  // ---- The page carries the file beside it
  await test('the page names the logo beside it, writes it create-only, and gathers it', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'deck-logo-')));
    try {
      const folder = path.join(root, 'Talks');
      fs.mkdirSync(folder);
      const deckPath = path.join(folder, 'Harbour.deck.md');
      fs.writeFileSync(deckPath, DECK);
      const theme = parseTheme(themeTextWith(FERN, { logo: 'Fernhollow Bank logo.svg', logoOn: 'title-slides' }));
      const file = pageLogoFile(Buffer.from(SVG), 'svg');
      assert.match(file.address, /^logos\/logo-[0-9a-f]{16}\.svg$/);
      assert.equal(pageLogoFile(Buffer.from(SVG), 'svg').address, file.address, 'the same bytes, the same name');
      assert.notEqual(pageLogoFile(Buffer.from(`${SVG} `), 'svg').address, file.address, 'other bytes, another name');

      const built = await buildDeckPage({ deckPath, text: DECK, theme }, { ...assets, logo: { address: file.address } });
      const logos = [...built.html.matchAll(/<img class="slide-logo is-top-right" src="([^"]+)"/g)].map(match => match[1]);
      assert.deepEqual(logos, [file.address], 'on the title slide only, by its address beside the page');
      assert.ok(!built.html.includes('Fernhollow</text>') && !built.html.includes('linearGradient'), 'the SVG is never in the page as markup');
      // A missing file: the page names none, and reads as another page (its digest).
      const missing = await buildDeckPage({ deckPath, text: DECK, theme }, { ...assets, logo: null });
      assert.ok(!missing.html.includes('<img class="slide-logo'), 'a missing logo draws nothing on the page');
      assert.notEqual(missing.digest, built.digest);
      const other = await buildDeckPage({ deckPath, text: DECK, theme }, { ...assets, logo: { address: pageLogoFile(PNG, 'png').address } });
      assert.notEqual(other.digest, built.digest, 'another logo, another digest');

      // Written beside the page, create-only, like the fonts.
      const first = await writePageFonts(nodeFontFs, deckPath, [file], LOGO_PLACE);
      assert.equal(first.kind, 'written');
      assert.deepEqual(fs.readdirSync(path.join(folder, 'logos')), [file.address.slice('logos/'.length)]);
      assert.deepEqual(fs.readFileSync(path.join(folder, ...file.address.split('/'))), Buffer.from(SVG));
      assert.deepEqual(await writePageFonts(nodeFontFs, deckPath, [file], LOGO_PLACE), { kind: 'written', created: [], madeFolder: false }, 'the same file stays');
      await writeDeckPage(nodePageFs, deckPath, built.html);
      const plan = await gatherPage(path.join(folder, 'Harbour.html'), root);
      assert.ok(plan.files.some(entry => entry.relPath === file.address), 'the logo is among the page\'s files');
      assert.deepEqual(plan.leftOut, []);
      // Another file at its name is never written over: Publish stops in one line.
      const taken = pageLogoFile(PNG, 'png');
      fs.writeFileSync(path.join(folder, ...taken.address.split('/')), 'not the logo');
      assert.deepEqual(await writePageFonts(nodeFontFs, deckPath, [taken], LOGO_PLACE), { kind: 'refused', line: foreignLogoLine(taken.address) });
      assert.equal(fs.readFileSync(path.join(folder, ...taken.address.split('/')), 'utf8'), 'not the logo');
      // A cancelled first Publish takes back what it wrote, unless a page of Ritemark's names it.
      const fresh = pageLogoFile(Buffer.from(`${SVG}\n`), 'svg');
      const wrote = await writePageFonts(nodeFontFs, deckPath, [fresh], LOGO_PLACE);
      assert.ok(wrote.kind === 'written' && wrote.created.length === 1);
      if (wrote.kind === 'written') await removePageFonts(nodeFontFs, deckPath, wrote, [fresh], () => false, LOGO_PLACE);
      assert.ok(!fs.existsSync(path.join(folder, ...fresh.address.split('/'))));
      await removePageFonts(nodeFontFs, deckPath, { created: [path.join(folder, ...file.address.split('/'))], madeFolder: false }, [file], () => false, LOGO_PLACE);
      assert.ok(fs.existsSync(path.join(folder, ...file.address.split('/'))), 'the published page names it: it stays');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await test('the sheet says the logo goes', () => {
    const theme = parseTheme(FERN);
    const fonts = [{ family: 'Source Serif 4' }, { family: 'Inter' }];
    assert.match(deckSheetRows(deckCounts(DECK, theme, fonts, true)).goes, /, the pictures they use, and the theme's fonts and logo\.$/);
    assert.match(deckSheetRows(deckCounts(DECK, theme, [], true)).goes, /^2 slides and their handout, the pictures they use, and the theme's logo\.$/);
    assert.match(deckSheetRows(deckCounts(DECK, theme, fonts)).goes, /and the theme's fonts\.$/, 'no logo: as before');
    assert.equal(deckCounts(DECK, theme, fonts).logo, undefined);
  });

  // ---- A second logo for the other ground (step-3-themes.md, "Logo", 18 November)
  const DARK_LOGO = themeTextWith(BUILT_IN_THEME_TEXT, { logo: 'Evening logo.svg', logoAt: 'top-left' });
  const LIGHT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path fill="#1C1F4A" d="M0 0h100v50H0z"/></svg>';

  await test('the second logo is one line, read back with the ground it is for, and Remove gives the file back', () => {
    assert.equal(groundOf(parseTheme(BUILT_IN_THEME_TEXT).bg), 'dark');
    assert.equal(groundOf(parseTheme(FERN).bg), 'light');
    // A dark theme adds a version for light slides; a light one, for dark slides.
    assert.equal(secondLogoGround(parseTheme(DARK_LOGO)), 'light');
    assert.equal(secondLogoGround(parseTheme(themeTextWith(FERN, { logo: 'L.svg' }))), 'dark');
    const added = themeTextWith(DARK_LOGO, { logoForLight: 'Evening logo for light slides.svg' });
    const extra = added.split('\n').filter(line => !DARK_LOGO.split('\n').includes(line));
    assert.deepEqual(extra, ['logo-for-light: Evening logo for light slides.svg'], 'one line');
    assert.ok(added.indexOf('logo-for-light:') < added.indexOf('card:'), 'before the shade sections');
    assert.deepEqual(parseTheme(added).logo, { file: 'Evening logo.svg', place: 'top-left', on: 'every-slide', second: { file: 'Evening logo for light slides.svg', ground: 'light' } });
    assert.equal(parseTheme(added).card?.g1, parseTheme(DARK_LOGO).card?.g1, 'a logo is no colour change: the shades stay');
    // Replace: the one line changes. Remove: that line goes, and the file is as it was, byte for byte.
    const replaced = themeTextWith(added, { logoForLight: 'Evening logo for light slides 2.png' });
    assert.equal(parseTheme(replaced).logo?.second?.file, 'Evening logo for light slides 2.png');
    assert.equal(replaced.split('\n').length, added.split('\n').length);
    assert.equal(themeTextWith(added, { logoForLight: null }), DARK_LOGO);
    assert.equal(themeTextWith(replaced, { logoForLight: null }), DARK_LOGO);
    assert.equal(themeTextWith(DARK_LOGO, { logoForLight: null }), DARK_LOGO, 'nothing to remove: the same text');
    // The logo's Remove takes its second version with it.
    assert.equal(themeTextWith(added, { logo: null }), BUILT_IN_THEME_TEXT);
    // No logo: no second version is written.
    assert.equal(themeTextWith(BUILT_IN_THEME_TEXT, { logoForLight: 'X.svg' }), BUILT_IN_THEME_TEXT);
    // A light theme's version for dark slides, the same way.
    const fern = themeTextWith(FERN, { logo: 'Fernhollow Bank logo.svg' });
    const fernDark = themeTextWith(fern, { logoForDark: 'Fernhollow Bank logo for dark slides.svg' });
    assert.deepEqual(parseTheme(fernDark).logo?.second, { file: 'Fernhollow Bank logo for dark slides.svg', ground: 'dark' });
    assert.equal(themeTextWith(fernDark, { logoForDark: null }), fern);
    assert.equal(themeTextWith(themeTextWith(fernDark, { logo: null }), {}), FERN);
    // The reader takes only a picture beside the theme; the other ground's line first, else the theme's own (a theme
    // whose background has changed ground since).
    assert.equal(parseTheme(withLines('logo: L.svg', 'logo-for-dark: ../x.svg')).logo?.second, undefined);
    assert.deepEqual(parseTheme(withLines('logo: L.svg', 'logo-for-light: Light.svg')).logo?.second, { file: 'Light.svg', ground: 'light' });
    assert.deepEqual(parseTheme(withLines('logo: L.svg', 'logo-for-light: Light.svg', 'logo-for-dark: Dark.svg')).logo?.second, { file: 'Dark.svg', ground: 'dark' });
    assert.equal(parseTheme(withLines('logo-for-dark: Dark.svg')).logo, undefined, 'a second version alone is no logo');
    // The tab may only take a second version out; the host names the picture.
    assert.ok(isThemeChanges({ logoForLight: null }) && isThemeChanges({ logoForDark: null }));
    assert.ok(!isThemeChanges({ logoForLight: 'Evil.svg' }) && !isThemeChanges({ logoForDark: '../x.svg' }));
    // Its file beside the theme: named for the slides it is for, never over another picture.
    const names = logoNames('Evening.theme.md', 'svg', 'light');
    assert.deepEqual([names.next().value, names.next().value], ['Evening logo for light slides.svg', 'Evening logo for light slides 2.svg']);
    assert.equal(logoNames('Fernhollow Bank.theme.md', 'png', 'dark').next().value, 'Fernhollow Bank logo for dark slides.png');
    // The tab's messages say which logo a file is for.
    assert.deepEqual(decodeThemeRequest({ type: 'theme/choose-logo', second: true }), { type: 'theme/choose-logo', second: true });
    assert.deepEqual(decodeThemeRequest({ type: 'theme/choose-logo' }), { type: 'theme/choose-logo' });
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(LIGHT_SVG).toString('base64')}`;
    assert.deepEqual(decodeThemeRequest({ type: 'theme/logo-file', dataUrl, filename: 'Dark.svg', second: true }), { type: 'theme/logo-file', dataUrl, filename: 'Dark.svg', second: true });
    assert.deepEqual(decodeThemeRequest({ type: 'theme/logo-file', dataUrl, filename: 'Dark.svg' }), { type: 'theme/logo-file', dataUrl, filename: 'Dark.svg' });
    for (const bad of [false, 'yes', 1]) {
      assert.throws(() => decodeThemeRequest({ type: 'theme/choose-logo', second: bad }), ThemeProtocolError);
      assert.throws(() => decodeThemeRequest({ type: 'theme/logo-file', dataUrl, filename: 'Dark.svg', second: bad }), ThemeProtocolError);
    }
  });

  await test('the logo by ground: a dark Card deck, a light Card deck, Borderless, and one file only', () => {
    const dark = themeWithLogoAddresses(parseTheme(themeTextWith(DARK_LOGO, { logoForLight: 'Light.svg' })), 'u://Evening logo.svg', 172 / 32, 'u://Light.svg', 2);
    // A dark Card deck: the logo for its own ground (the `logo:` file). Borderless, always on white: the light-slide one.
    assert.equal(themeSlideLogo(dark, false)!.url, 'u://Evening logo.svg');
    assert.equal(themeSlideLogo(dark, false)!.width, 139.75);
    assert.deepEqual(themeSlideLogo(dark, true), { url: 'u://Light.svg', place: 'top-left', on: 'every-slide', width: 52 }, 'at its own size');
    assert.ok(drawsSecondLogo(dark, true) && !drawsSecondLogo(dark, false));
    // The room the words keep is the drawn logo's: a top-right logo's margin follows the light-slide one on Borderless.
    const topRight = { ...dark, logo: { ...dark.logo!, place: 'top-right' as const } };
    const title = { markdown: '# A long title that runs right across the slide\n\n- One\n- Two' };
    const card = blockSlideMarkup(title, { theme: topRight, borderless: false });
    const white = blockSlideMarkup(title, { theme: topRight, borderless: true });
    assert.match(card, /src="u:\/\/Evening logo\.svg"/);
    assert.match(white, /src="u:\/\/Light\.svg"/);
    assert.doesNotMatch(white, /Evening logo\.svg/, 'one file on a slide');
    assert.equal(Number(/--logo-room:(\d+)px/.exec(white)?.[1]), logoTitleMargin({ width: 52 }));
    assert.equal(Number(/--logo-room:(\d+)px/.exec(card)?.[1]), logoTitleMargin({ width: 139.75 }));
    // An old slide's markup draws the same one.
    assert.match(slideMarkup('title', { title: 'T' }, { theme: dark, borderless: true }), /src="u:\/\/Light\.svg"/);
    assert.match(slideMarkup('title', { title: 'T' }, { theme: dark, borderless: false }), /src="u:\/\/Evening logo\.svg"/);
    // Its file missing (no address): the first is drawn, as with one file only.
    const gone = themeWithLogoAddresses(parseTheme(themeTextWith(DARK_LOGO, { logoForLight: 'Light.svg' })), 'u://Evening logo.svg', 172 / 32, null);
    assert.equal(themeSlideLogo(gone, true)!.url, 'u://Evening logo.svg');
    // A light theme's version for dark slides: a light Card deck and Borderless both draw the `logo:` file.
    const light = themeWithLogoAddresses(parseTheme(themeTextWith(themeTextWith(FERN, { logo: 'L.svg' }), { logoForDark: 'D.svg' })), 'u://L.svg', 2, 'u://D.svg', 3);
    assert.equal(themeSlideLogo(light, false)!.url, 'u://L.svg');
    assert.equal(themeSlideLogo(light, true)!.url, 'u://L.svg');
    // The same theme turned dark: its Card deck draws the version for dark slides.
    const turned = { ...light, bg: '#10261E' };
    assert.equal(themeSlideLogo(turned, false)!.url, 'u://D.svg');
    assert.equal(themeSlideLogo(turned, true)!.url, 'u://L.svg');
    // One file only: used everywhere, as before.
    const one = themeWithLogoAddresses(parseTheme(DARK_LOGO), 'u://Evening logo.svg', 172 / 32, 'u://ignored.svg');
    assert.equal(one.secondLogoUrl, undefined, 'a theme naming no second version gets no second address');
    assert.equal(themeSlideLogo(one, false)!.url, 'u://Evening logo.svg');
    assert.equal(themeSlideLogo(one, true)!.url, 'u://Evening logo.svg');
    // The views pass the deck's look.
    const read = (file: string) => fs.readFileSync(path.join(extension, file), 'utf8');
    assert.match(read('webview/src/components/decks/slide/SlideCanvas.tsx'), /themeSlideLogo\(theme, borderless\), \[[^\]]*secondUrl[^\]]*borderless\]/);
    assert.match(read('webview/src/components/decks/slide/slideMarkup.ts'), /themeSlideLogo\(options\.theme, options\.borderless\)/);
    assert.match(read('src/decks/present/DeckPresenter.ts'), /themeWithLogoAddresses\(theme, read\.logo, read\.logoAspect, read\.secondLogo, read\.secondLogoAspect\)/, 'the wall');
  });

  await test('the page carries only the logo its slides draw', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'deck-logo2-')));
    try {
      const deckPath = path.join(root, 'Harbour.deck.md');
      fs.writeFileSync(deckPath, DECK);
      const theme = parseTheme(themeTextWith(DARK_LOGO, { logoForLight: 'Light.svg' }));
      const first = { state: 'found' as const, bytes: Buffer.from(SVG), kind: 'svg' as const };
      const second = { state: 'found' as const, bytes: Buffer.from(LIGHT_SVG), kind: 'svg' as const };
      const firstFile = pageLogoFile(first.bytes, 'svg');
      const secondFile = pageLogoFile(second.bytes, 'svg');
      assert.equal(pageLogoOf(theme, false, first, second)!.address, firstFile.address, 'a dark Card deck: the first');
      assert.equal(pageLogoOf(theme, true, first, second)!.address, secondFile.address, 'Borderless: the light-slide one');
      assert.equal(pageLogoOf(theme, true, first, second)!.aspect, 2);
      assert.equal(pageLogoOf(theme, true, first, { state: 'missing' })!.address, firstFile.address, 'its file missing: the first');
      assert.equal(pageLogoOf(theme, false, { state: 'missing' }, second), null, 'a Card deck whose logo is missing: none');
      assert.equal(pageLogoOf(parseTheme(DARK_LOGO), true, first, second)!.address, firstFile.address, 'one file only: that one');
      assert.equal(pageLogoOf(parseTheme(BUILT_IN_THEME_TEXT), true, first, second), null, 'no logo: none');
      // The page names that one file, never the other.
      for (const borderless of [false, true]) {
        const logo = pageLogoOf(theme, borderless, first, second)!;
        const text = borderless ? DECK.replace('deck: 2\n', 'deck: 2\nlook: borderless\n') : DECK;
        const built = await buildDeckPage({ deckPath, text, theme }, { ...assets, logo: { address: logo.address, aspect: logo.aspect } });
        const named = new Set([...built.html.matchAll(/logos\/logo-[0-9a-f]{16}\.svg/g)].map(match => match[0]));
        assert.deepEqual([...named], [logo.address], borderless ? 'Borderless' : 'Card');
      }
      // The publisher picks it by the deck's look, and writes only it (`logoFiles = look.logo ? [look.logo] : []`).
      const publish = fs.readFileSync(path.join(extension, 'src/decks/deckPublish.ts'), 'utf8');
      assert.match(publish, /pageLogoOf\(theme, frontMatterLook\(text\) === 'borderless', read\.logo, read\.secondLogo\)/);
      assert.match(publish, /logoFiles = look\.logo \? \[look\.logo\] : \[\];/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await test('a theme with no second logo is unchanged, byte for byte', async () => {
    // Opened and changed elsewhere, its text keeps every other byte, and reads with no second version at all.
    assert.equal(themeTextWith(DARK_LOGO, {}), DARK_LOGO);
    assert.equal(themeTextWith(DARK_LOGO, { logoAt: 'top-left', logoOn: 'every-slide' }), DARK_LOGO);
    assert.equal(themeTextWith(FERN, { logoForDark: null, logoForLight: null }), FERN);
    assert.ok(!('second' in parseTheme(DARK_LOGO).logo!), 'no `second` field, so a page made before keeps its digest');
    const drawn = themeWithLogoAddresses(parseTheme(DARK_LOGO), 'u://a.svg', 2);
    assert.deepEqual(Object.keys(drawn).filter(key => key.startsWith('second')), []);
    // Its page: the same file and the same digest in either look's choice as with one file before (`pageLogoOf` is the
    // `logo:` file, the address the page had).
    const deckPath = path.join(os.tmpdir(), 'Harbour.deck.md');
    const file = pageLogoFile(Buffer.from(SVG), 'svg');
    const found = { state: 'found' as const, bytes: Buffer.from(SVG), kind: 'svg' as const };
    const theme = parseTheme(DARK_LOGO);
    const before = await buildDeckPage({ deckPath, text: DECK, theme }, { ...assets, logo: { address: file.address, aspect: file.aspect } });
    const chosen = pageLogoOf(theme, false, found, { state: 'none' })!;
    const now = await buildDeckPage({ deckPath, text: DECK, theme }, { ...assets, logo: { address: chosen.address, aspect: chosen.aspect } });
    assert.equal(now.digest, before.digest);
    assert.equal(now.html, before.html);
    // A theme gaining a second version doesn't change a Card deck's page either: it draws the same file.
    const withSecond = parseTheme(themeTextWith(DARK_LOGO, { logoForLight: 'Light.svg' }));
    assert.equal(pageLogoOf(withSecond, false, found, { state: 'found', bytes: Buffer.from(LIGHT_SVG), kind: 'svg' })!.address, file.address);
  });

  console.log(`themeLogo.test.ts — ${passed} groups passed`);
}

void main().catch(error => {
  console.error(error);
  process.exit(1);
});
