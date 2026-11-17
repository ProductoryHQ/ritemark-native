/**
 * Sprint 162 PR 3: the six bundled deck fonts.
 *
 *  - A theme's font name maps to one of the six whatever its case and spacing, and any other name (or none) to Sofia
 *    Sans; the slide's `--s-fh` and `--s-fb` carry the font, Sofia Sans and the font's kind.
 *  - The files are there, as pinned (a changed file needs a new version in `DECK_FONT_LIST`), small, and named in
 *    `media/fonts/OFL.txt` with their copyright lines and the licence.
 *  - The webview's rules name the five files beside `webview.js`, never Sofia Sans (it's in the bundle).
 *  - The page lists and names only its theme's fonts, as files beside it, and loads no font from the network; 2.2's
 *    gather sends them with the page; a name taken by another file stops the page; a cancelled first Publish takes
 *    back what it wrote.
 *
 * Run: npx tsx src/decks/page/pageFonts.test.ts
 */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gatherPage } from '../../publish/gather';
import { cssReferences, pageReferences } from '../../publish/references';
import { BUILT_IN_THEME, DECK_FONTS, DECK_FONT_LIST, DECK_FONT_SUBSETS, deckFont, deckFontFile, deckFontStack, parseTheme, themeFonts } from '../deckTheme';
import { themeVars } from '../../../webview/src/components/decks/theme/themeVars';
import { deckFontFaces } from '../../../webview/src/components/decks/theme/deckFonts';
import {
  PAGE_FONTS, buildDeckPage, currentPageDigest, foreignFontLine, nodeFontFs, nodePageFs, pagePathFor, removeDeckPage, removePageFonts, themeFontFiles, writeDeckPage, writePageFonts,
} from './pageFile';
import { PAGE_CSP, type PageAssets } from './pageHtml';
import { deckCounts, deckSheetRows } from './sheetRows';
import { PRIVATE_DECK } from './testing/privateDeck';

const extension = path.resolve(__dirname, '..', '..', '..');
const fontsDir = path.join(extension, 'media', 'fonts');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(fontsDir, font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
};

const themeWith = (heading: string, text: string) => parseTheme(`---\nname: Test\nbackground: "#FAF7F0"\nheadings: "#1D2433"\ntext: "#2E3445"\naccent: "#C2410C"\nsoft-light: false\nheading-font: ${heading}\ntext-font: ${text}\ncorners: soft\nboxes: filled\n---\n`);

async function main(): Promise<void> {
  // --- The names
  assert.deepEqual(DECK_FONT_LIST.map(font => font.name), ['Sofia Sans', 'Inter', 'IBM Plex Sans', 'Space Grotesk', 'Source Serif 4', 'Fraunces']);
  assert.equal(deckFont('Inter').name, 'Inter');
  assert.equal(deckFont('inter').name, 'Inter', 'names compare case-insensitively');
  assert.equal(deckFont('  ibm   PLEX sans ').name, 'IBM Plex Sans', 'and whatever the spacing');
  assert.equal(deckFont('SOURCE SERIF 4').name, 'Source Serif 4');
  for (const unknown of ['Futura', 'Inter Tight', 'Source Serif', '', '   ', undefined, null, 42]) {
    assert.equal(deckFont(unknown).name, 'Sofia Sans', `an unknown or missing name draws in Sofia Sans: ${String(unknown)}`);
  }
  assert.equal(deckFontStack('Sofia Sans'), "'Sofia Sans', sans-serif");
  assert.equal(deckFontStack('space grotesk'), "'Space Grotesk', 'Sofia Sans', sans-serif");
  assert.equal(deckFontStack('fraunces'), "'Fraunces', 'Sofia Sans', serif");
  assert.equal(deckFontStack('Futura'), "'Sofia Sans', sans-serif");
  assert.equal(DECK_FONTS['Source Serif 4'], "'Source Serif 4', 'Sofia Sans', serif");
  {
    const theme = themeWith('space grotesk', 'INTER');
    assert.equal(theme.fh, 'space grotesk', 'the theme keeps the name as written');
    for (const borderless of [false, true]) {
      const vars = themeVars(theme, borderless);
      assert.equal(vars.fh, "'Space Grotesk', 'Sofia Sans', sans-serif");
      assert.equal(vars.fb, "'Inter', 'Sofia Sans', sans-serif");
    }
    assert.equal(themeVars(themeWith('Comic Sans MS', 'Futura'), false).fb, "'Sofia Sans', sans-serif");
    assert.equal(themeVars(BUILT_IN_THEME, false).fh, "'Sofia Sans', sans-serif", 'Evening still draws in Sofia Sans');
    assert.deepEqual(themeFonts(themeWith('Inter', 'inter')).map(font => font.name), ['Inter'], 'one font once');
    assert.deepEqual(themeFonts(themeWith('Fraunces', 'Source Serif 4')).map(font => font.name), ['Fraunces', 'Source Serif 4']);
  }

  // --- The files: there, as pinned, small, and in the notices
  const PINNED: Record<string, string> = {
    'SofiaSans-latin.woff2': 'e0ea7bf0ba351883',
    'SofiaSans-latin-ext.woff2': 'f9146728b0c31c0e',
    'Inter-latin.woff2': '3100e775e8616cd2',
    'Inter-latin-ext.woff2': '34b9c504cab7a73e',
    'IBMPlexSans-latin.woff2': 'e2291e842cf5af16',
    'IBMPlexSans-latin-ext.woff2': 'd160e20920ae4d65',
    'SpaceGrotesk-latin.woff2': '0640890476fc1198',
    'SpaceGrotesk-latin-ext.woff2': '952dddb45d2f96f7',
    'SourceSerif4-latin.woff2': '382475f38242c52d',
    'SourceSerif4-latin-ext.woff2': 'd10ccbbd0dc4ebae',
    'Fraunces-latin.woff2': '7f9d191d999336d3',
    'Fraunces-latin-ext.woff2': 'a21ecfbf41fbc393',
  };
  const notices = fs.readFileSync(path.join(fontsDir, 'OFL.txt'), 'utf8');
  assert.ok(notices.includes('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007'), 'the licence text');
  let added = 0;
  for (const font of DECK_FONT_LIST) {
    assert.ok(notices.includes(`${font.name} ${font.version}\n`), `${font.name} ${font.version} in OFL.txt`);
    for (const part of DECK_FONT_SUBSETS) {
      const file = deckFontFile(font, part.subset);
      const bytes = fs.readFileSync(path.join(fontsDir, file));
      assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', `${file} is woff2`);
      assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0, 16), PINNED[file], `${file} is the pinned file (a new one needs a new version)`);
      assert.ok(notices.includes(file), `${file} in OFL.txt`);
      if (font.name !== 'Sofia Sans') added += bytes.length;
    }
  }
  assert.deepEqual(fs.readdirSync(fontsDir).filter(name => name.endsWith('.woff2')).sort(), Object.keys(PINNED).sort(), 'no other font file');
  assert.ok(added < 600 * 1024, `the five fonts stay small: ${added} bytes`);
  for (const line of ['The Inter Project Authors', 'IBM Corp.', 'The Space Grotesk Project Authors', 'Adobe Systems Incorporated', 'The Fraunces Project Authors', 'The Sofia Sans Project Authors']) {
    assert.ok(notices.includes(line), `copyright line: ${line}`);
  }

  // --- The webview's rules: the five, from beside webview.js
  {
    const css = deckFontFaces(file => `https://file+.vscode-resource.vscode-cdn.net/app/media/${file}`);
    const families = [...css.matchAll(/font-family:'([^']+)'/g)].map(match => match[1]);
    assert.deepEqual([...new Set(families)], ['Inter', 'IBM Plex Sans', 'Space Grotesk', 'Source Serif 4', 'Fraunces']);
    assert.equal(families.length, 10, 'both parts of each');
    assert.ok(css.includes('url("https://file+.vscode-resource.vscode-cdn.net/app/media/fonts/SpaceGrotesk-latin-ext.woff2")'));
    assert.ok(!css.includes('SofiaSans'), 'Sofia Sans is in the bundle already');
    assert.equal(deckFontFaces(() => null), '', 'no address, no rule');
  }

  // --- The page: only the theme's fonts, as files beside it, nothing from the network
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'deck-fonts-')));
  const project = path.join(root, 'Training');
  const folder = path.join(project, 'Harbour Logistics');
  fs.mkdirSync(path.join(folder, 'images'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'images', 'which-stays.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  const deckPath = path.join(folder, 'Fonts.deck.md');
  fs.writeFileSync(deckPath, PRIVATE_DECK);
  try {
    const theme = themeWith('Space Grotesk', 'inter');
    const files = await themeFontFiles(extension, theme);
    assert.deepEqual(files.map(file => [file.family, file.address]), [
      ['Space Grotesk', 'fonts/SpaceGrotesk-2.000-latin.woff2'],
      ['Space Grotesk', 'fonts/SpaceGrotesk-2.000-latin-ext.woff2'],
      ['Inter', 'fonts/Inter-4.001-latin.woff2'],
      ['Inter', 'fonts/Inter-4.001-latin-ext.woff2'],
    ]);
    assert.ok(files[2].bytes.equals(fs.readFileSync(path.join(fontsDir, 'Inter-latin.woff2'))));
    assert.deepEqual(await themeFontFiles(extension, BUILT_IN_THEME), [], 'Sofia Sans goes inline, not as a file');
    assert.deepEqual(await themeFontFiles(extension, theme, async () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); }), [], 'an app without the files leaves them out: Sofia Sans draws');

    const built = await buildDeckPage({ deckPath, text: PRIVATE_DECK, theme }, { ...assets, themeFonts: files });
    const refs = pageReferences(built.html).inlineCss.flatMap(css => cssReferences(css)).map(ref => ref.value);
    assert.deepEqual(refs.filter(value => !value.startsWith('data:')), files.map(file => file.address), 'the page names exactly its theme\'s font files');
    assert.ok(refs.filter(value => value.startsWith('data:')).every(value => value.startsWith('data:font/woff2;base64,')), 'and Sofia Sans inline');
    const faces = [...built.html.matchAll(/@font-face\{font-family:'([^']+)'/g)].map(match => match[1]);
    assert.deepEqual([...new Set(faces)], ['Sofia Sans', 'Space Grotesk', 'Inter'], 'only the theme\'s fonts (and Sofia Sans, the page\'s own)');
    assert.ok(!/fonts\.(googleapis|gstatic)|@import|https?:\/\/[^"'\s)]*\.woff2?/i.test(built.html), 'no font from the network');
    assert.ok(!/https?:/.test(PAGE_CSP) && PAGE_CSP.includes("font-src 'self' data: file:"), 'the page may load fonts only from beside it');
    assert.ok(built.html.includes("--s-fh:'Space Grotesk', 'Sofia Sans', sans-serif"), 'the slides draw the theme\'s headings font');
    const evening = await buildDeckPage({ deckPath, text: PRIVATE_DECK, theme: BUILT_IN_THEME }, assets);
    assert.ok(!evening.html.includes('fonts/'), 'a Sofia Sans theme names no font file');

    // Written beside the deck, then 2.2's gather sends them with the page.
    const pagePath = pagePathFor(deckPath);
    const first = await writePageFonts(nodeFontFs, deckPath, files);
    assert.equal(first.kind, 'written');
    assert.equal(first.kind === 'written' && first.created.length, 4);
    assert.deepEqual(fs.readdirSync(path.join(folder, 'fonts')).sort(), ['Inter-4.001-latin-ext.woff2', 'Inter-4.001-latin.woff2', 'SpaceGrotesk-2.000-latin-ext.woff2', 'SpaceGrotesk-2.000-latin.woff2'], 'only the theme\'s fonts, nothing under a hidden name');
    assert.equal(first.kind === 'written' && first.madeFolder, true);
    assert.deepEqual(await writePageFonts(nodeFontFs, deckPath, files), { kind: 'written', created: [], madeFolder: false }, 'the same files stay');
    await writeDeckPage(nodePageFs, deckPath, built.html);
    const plan = await gatherPage(pagePath, project);
    assert.deepEqual(plan.files.filter(file => file.kind === 'font').map(file => file.relPath).sort(), files.map(file => file.address).sort(), 'the fonts are among the page\'s files');
    assert.deepEqual(plan.leftOut, []);
    assert.deepEqual(plan.keyHits, []);

    // A deck beside it in Fraunces adds its own two; a cancelled first Publish takes back only what it wrote.
    const other = path.join(folder, 'Serif.deck.md');
    fs.writeFileSync(other, PRIVATE_DECK);
    const serif = await themeFontFiles(extension, themeWith('Fraunces', 'Inter'));
    const second = await writePageFonts(nodeFontFs, other, serif);
    assert.deepEqual(second.kind === 'written' && second.created.map(file => path.basename(file)).sort(), ['Fraunces-1.000-latin-ext.woff2', 'Fraunces-1.000-latin.woff2'], 'Inter was there already');
    const serifPage = await buildDeckPage({ deckPath: other, text: PRIVATE_DECK, theme: themeWith('Fraunces', 'Inter') }, { ...assets, themeFonts: serif });
    await writeDeckPage(nodePageFs, other, serifPage.html);
    assert.ok(await removeDeckPage(nodePageFs, pagePathFor(other), serifPage.html));
    assert.ok(second.kind === 'written');
    await removePageFonts(nodeFontFs, other, second, serif);
    assert.deepEqual(fs.readdirSync(path.join(folder, 'fonts')).sort(), ['Inter-4.001-latin-ext.woff2', 'Inter-4.001-latin.woff2', 'SpaceGrotesk-2.000-latin-ext.woff2', 'SpaceGrotesk-2.000-latin.woff2']);
    // Inter is still named by the first page: taking back the first page's own Inter would keep it while the page stays.
    assert.ok(first.kind === 'written');
    await removePageFonts(nodeFontFs, deckPath, first, files);
    assert.equal(fs.readdirSync(path.join(folder, 'fonts')).length, 4, 'a font another page of Ritemark\'s names stays');
    assert.ok(await removeDeckPage(nodePageFs, pagePath, built.html));
    // A font another Publish in this window holds stays too.
    await removePageFonts(nodeFontFs, deckPath, first, files, target => target.endsWith('Inter-4.001-latin.woff2'));
    assert.deepEqual(fs.readdirSync(path.join(folder, 'fonts')), ['Inter-4.001-latin.woff2'], 'a held font stays');
    fs.rmSync(path.join(folder, 'fonts', 'Inter-4.001-latin.woff2'));
    fs.rmdirSync(path.join(folder, 'fonts'));
    const again = await writePageFonts(nodeFontFs, deckPath, files);
    assert.ok(again.kind === 'written');
    await removePageFonts(nodeFontFs, deckPath, again, files);
    assert.ok(!fs.existsSync(path.join(folder, 'fonts')), 'the fonts and their folder go with the page they were written for');

    // A name taken by another file stops the page, in one line; nothing is written and the file stays.
    fs.mkdirSync(path.join(folder, 'fonts'));
    fs.writeFileSync(path.join(folder, 'fonts', 'Inter-4.001-latin.woff2'), 'my own font');
    assert.deepEqual(await writePageFonts(nodeFontFs, deckPath, files), { kind: 'refused', line: foreignFontLine('fonts/Inter-4.001-latin.woff2') });
    assert.equal(fs.readFileSync(path.join(folder, 'fonts', 'Inter-4.001-latin.woff2'), 'utf8'), 'my own font');
    assert.deepEqual(fs.readdirSync(path.join(folder, 'fonts')), ['Inter-4.001-latin.woff2'], 'what was written before the refusal is taken back');
    fs.rmSync(path.join(folder, 'fonts'), { recursive: true });
    // A `fonts` that is a file, or a link, is never written through.
    fs.writeFileSync(path.join(folder, 'fonts'), 'a file');
    assert.equal((await writePageFonts(nodeFontFs, deckPath, files)).kind, 'refused');
    fs.rmSync(path.join(folder, 'fonts'));
    fs.mkdirSync(path.join(root, 'elsewhere'));
    fs.symlinkSync(path.join(root, 'elsewhere'), path.join(folder, 'fonts'));
    assert.equal((await writePageFonts(nodeFontFs, deckPath, files)).kind, 'refused');
    assert.deepEqual(fs.readdirSync(path.join(root, 'elsewhere')), [], 'nothing written through the link');
    assert.deepEqual(await writePageFonts(nodeFontFs, deckPath, []), { kind: 'written', created: [], madeFolder: false }, 'a Sofia Sans theme writes nothing');
    fs.rmSync(path.join(folder, 'fonts'));

    // A `fonts` folder of the person's own, empty, stays after a take-back; only the fonts written go.
    fs.mkdirSync(path.join(folder, 'fonts'));
    const intoOwn = await writePageFonts(nodeFontFs, deckPath, files);
    assert.ok(intoOwn.kind === 'written' && !intoOwn.madeFolder && intoOwn.created.length === 4);
    await removePageFonts(nodeFontFs, deckPath, intoOwn, files);
    assert.deepEqual(fs.readdirSync(path.join(folder, 'fonts')), [], 'their folder stays, empty');

    // A name taken (EEXIST) and freed again before the last check is still written, not skipped.
    {
      let raced = false;
      const racing = { ...nodeFontFs, link: async (from: string, to: string) => {
        if (!raced) { raced = true; throw Object.assign(new Error('taken'), { code: 'EEXIST' }); }
        return nodeFontFs.link(from, to);
      } };
      const result = await writePageFonts(racing, deckPath, files);
      assert.ok(result.kind === 'written' && result.created.length === 4, 'all four are there');
      for (const file of files) assert.ok(fs.readFileSync(path.join(folder, ...file.address.split('/'))).equals(file.bytes));
      assert.deepEqual(fs.readdirSync(path.join(folder, 'fonts')).filter(name => name.startsWith('.')), [], 'nothing left under a hidden name');
      fs.rmSync(path.join(folder, 'fonts'), { recursive: true });
    }

    // The digest counts the font files the page names: a page written without them reads as changed once they can go.
    const withoutFonts = await buildDeckPage({ deckPath, text: PRIVATE_DECK, theme }, assets);
    assert.notEqual(withoutFonts.digest, built.digest, 'the same deck with and without its font files');
    assert.equal(await currentPageDigest(deckPath, PRIVATE_DECK, theme, nodePageFs, files.map(file => file.address)), built.digest, 'the chip\'s digest names them too');
    assert.equal(await currentPageDigest(deckPath, PRIVATE_DECK, theme), withoutFonts.digest);

    // The sheet's What goes names the theme's fonts only when files go.
    assert.equal(deckCounts(PRIVATE_DECK, theme, files).fonts, 2);
    assert.equal(deckCounts(PRIVATE_DECK, theme, []).fonts, undefined, 'none go: none named');
    assert.equal(deckCounts(PRIVATE_DECK, theme).fonts, 2, 'by name when the files aren\'t known');
    assert.equal(deckSheetRows({ slides: 14, prompts: 6, comments: 0, skipped: 0, fonts: 2 }).goes, '14 slides and their handout, 6 prompts with Copy, the pictures they use, and the theme\'s fonts.');
    assert.equal(deckSheetRows({ slides: 1, prompts: 0, comments: 0, skipped: 0, fonts: 1 }).goes, '1 slide and its handout, the pictures it uses, and the theme\'s font.');
    assert.equal(deckSheetRows({ slides: 0, prompts: 0, comments: 0, skipped: 0, fonts: 2 }).goes, 'The handout\'s text, the pictures it uses, and the theme\'s fonts.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('pageFonts: all passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
