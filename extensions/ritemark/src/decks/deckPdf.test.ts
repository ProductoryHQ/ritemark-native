/**
 * Sprint 170 PR 1 (#881), PR 2 (#885) and PR 3 (#886): Save as PDF from Publish's menu. The item's words for each view (R2), the file names (R7),
 * the dialog in the deck's folder, cancel writes nothing, Replace writes over in one step, the printed page holds
 * nothing private (R6) and reads only its own folder, and Show in folder.
 *
 * Run: npx tsx src/decks/deckPdf.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import { BUILT_IN_THEME } from './deckTheme';
import type { DeckHostMessage, DeckPdfKind } from './deckProtocol';
import { DeckPdfSaver, PDF_NOT_SAVED, PDF_NO_HANDOUT, PDF_NO_SLIDES, SAVED_KINDS, pdfFileName, pdfItemLabel, pdfKindFor, writeOver, type PdfDeps, type PrintInput } from './deckPdf';
import { PAGE_FONTS, buildPrintPage } from './page/pageFile';
import { HANDOUT_PRINT_CSS, PRINT_CSS, SLIDES_PRINT_CSS, type PageAssets } from './page/pageHtml';
import { PRIVATE_DECK, PRIVATE_WORDS } from './page/testing/privateDeck';
import { makeTempDir } from '../testing/tempDir';

const extension = path.resolve(__dirname, '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(extension, 'media', 'fonts', font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
};

const docOf = (deckPath: string) => ({ uri: { fsPath: deckPath } }) as unknown as vscode.TextDocument;

/** A saver whose dialog answers `target`, whose print writes a stand-in PDF holding the page it was given. */
function saverFor(deckPath: string, target: string | undefined, options: { print?: PdfDeps['print']; hasPrint?: boolean; text?: string } = {}) {
  const seen = { asked: [] as string[], printed: [] as string[], pages: [] as string[], revealed: [] as string[], folders: [] as string[] };
  const input: PrintInput = { deckPath, text: options.text ?? PRIVATE_DECK, theme: BUILT_IN_THEME, steps: [], fonts: [], logo: null };
  const deps: PdfDeps = {
    hasPrint: async () => options.hasPrint ?? true,
    assets: async () => assets,
    askTarget: async defaultPath => { seen.asked.push(defaultPath); return target; },
    print: options.print ?? (async htmlPath => {
      seen.printed.push(htmlPath);
      seen.folders.push(path.dirname(htmlPath));
      seen.pages.push(fs.readFileSync(htmlPath, 'utf8'));
      const pdf = htmlPath.replace(/\.html$/, '.pdf');
      fs.writeFileSync(pdf, `%PDF-1.7 printed from ${path.basename(htmlPath)}`, { flag: 'wx' });
      return pdf;
    }),
    reveal: async file => { seen.revealed.push(file); },
    tempRoot: makeTempDir('rm-pdf-tmp-'),
  };
  const saver = new DeckPdfSaver({ pageInput: async () => input }, deps, () => true);
  return { saver, seen, deps };
}

async function main(): Promise<void> {
  // R2: the item names the view's kind, and saves it: PR 3 (#886) makes Handout, so every view's item is its own.
  assert.deepEqual(SAVED_KINDS, ['slides-and-handout', 'slides', 'handout']);
  assert.deepEqual(['slide', 'both', 'handout'].map(view => pdfItemLabel(pdfKindFor(view as 'slide', SAVED_KINDS)!)), ['Save slides as PDF…', 'Save slides and handout as PDF…', 'Save handout as PDF…']);
  assert.deepEqual(['slide', 'both', 'handout'].map(view => pdfKindFor(view as 'slide', SAVED_KINDS)), ['slides', 'slides-and-handout', 'handout']);
  // No print, no item; and never an item that saves another kind than the view's.
  assert.equal(pdfKindFor('both', []), null);
  assert.equal(pdfKindFor('handout', ['slides', 'slides-and-handout']), null);

  // R7: the file names.
  assert.deepEqual([pdfFileName('Day one', 'slides'), pdfFileName('Day one', 'slides-and-handout'), pdfFileName('Day one', 'handout')], ['Day one.pdf', 'Day one – slides and handout.pdf', 'Day one – handout.pdf']);

  const project = makeTempDir('rm-pdf-project-');
  fs.mkdirSync(path.join(project, 'decks'));
  fs.mkdirSync(path.join(project, 'pictures'));
  const deckPath = path.join(project, 'decks', 'Day one.deck.md');
  fs.writeFileSync(deckPath, PRIVATE_DECK);

  // No print in this shell (or Decks off): no kind is offered, and a request to save does nothing.
  {
    const { saver, seen } = saverFor(deckPath, path.join(project, 'decks', 'x.pdf'), { hasPrint: false });
    assert.deepEqual(await saver.kinds(), []);
    await saver.save(docOf(deckPath), 'slides-and-handout', '', 'card', [], () => assert.fail('nothing is said'));
    assert.deepEqual(seen.asked, []);
    const off = new DeckPdfSaver({ pageInput: async () => assert.fail('not read') }, saverFor(deckPath, undefined).deps, () => false);
    assert.deepEqual(await off.kinds(), []);
  }

  // R8: the dialog starts in the deck's folder with the kind's name; cancelled, nothing is written and nothing said.
  {
    const { saver, seen } = saverFor(deckPath, undefined);
    const said: DeckHostMessage[] = [];
    await saver.save(docOf(deckPath), 'slides-and-handout', '', 'card', [], message => said.push(message));
    assert.deepEqual(seen.asked, [path.join(project, 'decks', 'Day one – slides and handout.pdf')]);
    assert.deepEqual({ said, printed: seen.printed, files: fs.readdirSync(path.join(project, 'decks')) }, { said: [], printed: [], files: ['Day one.deck.md'] });
    // A kind this app doesn't make is never saved.
    await saver.save(docOf(deckPath), 'notes' as DeckPdfKind, '', 'card', [], message => said.push(message));
    assert.deepEqual({ said, asked: seen.asked.length }, { said: [], asked: 1 });
  }

  // Saved: the PDF where the dialog said, the bar's note, the print's folder gone, and the page holding nothing private.
  const target = path.join(project, 'decks', 'Day one – slides and handout.pdf');
  {
    const { saver, seen } = saverFor(deckPath, target);
    const said: DeckHostMessage[] = [];
    await saver.save(docOf(deckPath), 'slides-and-handout', '', 'card', [], message => said.push(message));
    assert.deepEqual(said, [
      { type: 'deck/page-notice', text: 'Saving Day one – slides and handout.pdf…' },
      { type: 'deck/pdf-saved', name: 'Day one – slides and handout.pdf' },
    ]);
    assert.equal(fs.readFileSync(target, 'utf8'), '%PDF-1.7 printed from page.html');
    assert.deepEqual(fs.readdirSync(path.join(project, 'decks')).sort(), ['Day one – slides and handout.pdf', 'Day one.deck.md']);
    assert.equal(fs.existsSync(seen.folders[0]), false, 'the print folder goes again');
    // R6: the page printed is the published page: no skipped slide, comment or note in it.
    for (const [place, word] of Object.entries(PRIVATE_WORDS)) assert.ok(!seen.pages[0].includes(word), `${place} is not in the printed page`);
    assert.ok(seen.pages[0].includes('@page { margin: 14mm 15mm; }'), 'with the page\'s print rules');
    // R9: Show in folder reveals the PDF saved.
    await saver.show(docOf(deckPath));
    assert.deepEqual(seen.revealed, [target]);
  }

  // PR 2 (#885), R3, R6, R7: Slides is "Day one.pdf", the page with the slides' print: one 16:9 page a slide on the
  // theme's ground, every reveal shown, no A4 rules, nothing private; written where the dialog said.
  {
    const slidesTarget = path.join(project, 'decks', 'Day one.pdf');
    const { saver, seen } = saverFor(deckPath, slidesTarget);
    const said: DeckHostMessage[] = [];
    await saver.save(docOf(deckPath), 'slides', '', 'card', [], message => said.push(message));
    assert.deepEqual(seen.asked, [slidesTarget]);
    assert.deepEqual(said, [
      { type: 'deck/page-notice', text: 'Saving Day one.pdf…' },
      { type: 'deck/pdf-saved', name: 'Day one.pdf' },
    ]);
    assert.equal(fs.readFileSync(slidesTarget, 'utf8'), '%PDF-1.7 printed from page.html');
    const page = seen.pages[0];
    assert.ok(page.includes(SLIDES_PRINT_CSS), 'with the slides\' print rules');
    assert.ok(!page.includes(PRINT_CSS) && !page.includes('@page { margin: 14mm 15mm; }'), 'and not the A4 page\'s');
    for (const [place, word] of Object.entries(PRIVATE_WORDS)) assert.ok(!page.includes(word), `${place} is not in the printed slides`);
    // One page a slide: each shown slide is one layer, and every layer but the last breaks the page after it.
    const shown = (await buildPrintPage({ deckPath, text: PRIVATE_DECK, theme: BUILT_IN_THEME }, assets)).deck.slides.length;
    assert.ok(shown > 1);
    assert.equal((page.match(/<section class="layer[ "]/g) ?? []).length, shown);
    assert.match(SLIDES_PRINT_CSS, /@page \{ size: 960px 540px; margin: 0; \}/);
    assert.match(SLIDES_PRINT_CSS, /\.layer[^{]*\{[^}]*width: 960px; height: 540px;/);
    assert.match(SLIDES_PRINT_CSS, /\.layer \+ \.layer \{ break-before: page;/);
    assert.ok(!SLIDES_PRINT_CSS.includes('break-after'), 'no break after the last slide, so no blank page');
    // On screen too, so the page's script fits every slide's Tabs band (it measures only a band that has a width).
    assert.ok(!SLIDES_PRINT_CSS.includes('@media'), 'not only in print');
    assert.match(SLIDES_PRINT_CSS, /\[data-reveal-hidden\] \{ visibility: visible; \}/);
    assert.match(SLIDES_PRINT_CSS, /background: var\(--ground\)/);
    fs.unlinkSync(slidesTarget);
  }

  // PR 3 (#886), R5, R6, R7: Handout is "Day one – handout.pdf", the page's A4 print with the text alone: no slide drawn,
  // each part under its number, nothing private; written where the dialog said.
  {
    const handoutTarget = path.join(project, 'decks', 'Day one – handout.pdf');
    const { saver, seen } = saverFor(deckPath, handoutTarget);
    const said: DeckHostMessage[] = [];
    await saver.save(docOf(deckPath), 'handout', '', 'card', [], message => said.push(message));
    assert.deepEqual(seen.asked, [handoutTarget]);
    assert.deepEqual(said, [
      { type: 'deck/page-notice', text: 'Saving Day one – handout.pdf…' },
      { type: 'deck/pdf-saved', name: 'Day one – handout.pdf' },
    ]);
    assert.equal(fs.readFileSync(handoutTarget, 'utf8'), '%PDF-1.7 printed from page.html');
    const page = seen.pages[0];
    assert.ok(page.includes(PRINT_CSS) && page.includes(HANDOUT_PRINT_CSS), 'the A4 print, with the handout\'s rules after it');
    assert.ok(!page.includes(SLIDES_PRINT_CSS));
    assert.ok(page.indexOf(HANDOUT_PRINT_CSS) > page.indexOf('@media print{.pre{order:0}'), 'after the print order, so its rules win');
    assert.match(HANDOUT_PRINT_CSS, /\.layer, \.prefetch \{ display: none !important; \}/);
    assert.match(page, /#t1:not\(\.sect\)::before\{content:"1"\}#t2:not\(\.sect\)::before\{content:"2"\}/);
    for (const [place, word] of Object.entries(PRIVATE_WORDS)) assert.ok(!page.includes(word), `${place} is not in the printed handout`);
    // R8: saved again over it (the system asked Replace; yes): replaced in one step, no hidden copy left.
    fs.writeFileSync(handoutTarget, 'an older handout');
    await saverFor(deckPath, handoutTarget).saver.save(docOf(deckPath), 'handout', '', 'card', [], () => {});
    assert.equal(fs.readFileSync(handoutTarget, 'utf8'), '%PDF-1.7 printed from page.html');
    assert.deepEqual(fs.readdirSync(path.join(project, 'decks')).filter(name => name.endsWith('.part')), []);
    fs.unlinkSync(handoutTarget);
  }

  // R8: a file already there (the system's dialog asked Replace, and the person said yes) is replaced in one step.
  {
    fs.writeFileSync(target, 'an older PDF');
    const { saver } = saverFor(deckPath, target);
    await saver.save(docOf(deckPath), 'slides-and-handout', '', 'card', [], () => {});
    assert.equal(fs.readFileSync(target, 'utf8'), '%PDF-1.7 printed from page.html');
    assert.deepEqual(fs.readdirSync(path.join(project, 'decks')).filter(name => name.endsWith('.part')), []);
  }

  // A print that fails, or answers a file outside its own folder, leaves the file there as it was and says so.
  {
    fs.writeFileSync(target, 'kept');
    const elsewhere = path.join(project, 'elsewhere.pdf');
    fs.writeFileSync(elsewhere, '%PDF elsewhere');
    for (const print of [async () => { throw new Error('the print failed'); }, async () => elsewhere]) {
      const { saver } = saverFor(deckPath, target, { print });
      const said: DeckHostMessage[] = [];
      const warn = console.warn;
      console.warn = () => {};
      try {
        await saver.save(docOf(deckPath), 'slides-and-handout', '', 'card', [], message => said.push(message));
      } finally {
        console.warn = warn;
      }
      assert.deepEqual(said.at(-1), { type: 'deck/page-notice', text: PDF_NOT_SAVED });
      assert.equal(fs.readFileSync(target, 'utf8'), 'kept');
    }
  }

  // The print's folder holds the pictures as pictures/<n>: a picture beside the deck, or above it (../), never an
  // address leading out of the folder.
  {
    fs.writeFileSync(path.join(project, 'pictures', 'harbour.png'), 'png bytes');
    fs.mkdirSync(path.join(project, 'decks', 'images'));
    fs.writeFileSync(path.join(project, 'decks', 'images', 'crane.jpg'), 'jpg bytes');
    const text = '---\ndeck: 2\n---\n\n```slide\n---\nid: p1\npicture: right\nimage: ../pictures/harbour.png\n---\n# Harbour\n```\n\nThe crane: ![Crane](images/crane.jpg)\n';
    const built = await buildPrintPage({ deckPath, text, theme: BUILT_IN_THEME }, assets);
    assert.deepEqual(built.pictures, [
      { address: 'pictures/1.png', file: path.join(project, 'pictures', 'harbour.png') },
      { address: 'pictures/2.jpg', file: path.join(project, 'decks', 'images', 'crane.jpg') },
    ]);
    assert.ok(!built.html.includes('../pictures'), 'no address leads out of the print folder');
    const { saver, seen } = saverFor(deckPath, path.join(project, 'decks', 'Pictures.pdf'), {
      text,
      print: async htmlPath => {
        const folder = path.dirname(htmlPath);
        seen.printed.push(fs.readdirSync(path.join(folder, 'pictures')).sort().join(','));
        seen.pages.push(fs.readFileSync(path.join(folder, 'pictures', '1.png'), 'utf8'));
        fs.writeFileSync(htmlPath.replace(/\.html$/, '.pdf'), '%PDF');
        return htmlPath.replace(/\.html$/, '.pdf');
      },
    });
    await saver.save(docOf(deckPath), 'slides-and-handout', '', 'card', [], () => {});
    assert.deepEqual({ printed: seen.printed, copied: seen.pages }, { printed: ['1.png,2.jpg'], copied: ['png bytes'] });
  }

  // Save slides as PDF copies only the slides' pictures: the text's aren't printed, so they aren't copied or waited for.
  {
    const text = '---\ndeck: 2\n---\n\n```slide\n---\nid: p1\npicture: right\nimage: ../pictures/harbour.png\n---\n# Harbour\n```\n\nThe crane: ![Crane](images/crane.jpg)\n';
    const built = await buildPrintPage({ deckPath, text, theme: BUILT_IN_THEME, print: 'slides' }, assets);
    assert.deepEqual(built.pictures, [{ address: 'pictures/1.png', file: path.join(project, 'pictures', 'harbour.png') }]);
  }

  // Save handout as PDF copies only the text's pictures: no slide is drawn, so its pictures aren't copied or waited for.
  {
    const text = '---\ndeck: 2\n---\n\n```slide\n---\nid: p1\npicture: right\nimage: ../pictures/harbour.png\n---\n# Harbour\n```\n\nThe crane: ![Crane](images/crane.jpg)\n';
    const built = await buildPrintPage({ deckPath, text, theme: BUILT_IN_THEME, print: 'handout' }, assets);
    assert.deepEqual(built.pictures, [{ address: 'pictures/1.jpg', file: path.join(project, 'decks', 'images', 'crane.jpg') }]);
    assert.ok(!built.html.includes('harbour'), 'the slide\'s picture is not named');
  }

  // A section with no text of its own still prints as its band in the handout (its slide isn't drawn there), with its
  // slide's title, and starts a page; on the page itself it stays its slide, as before.
  {
    const text = '---\ndeck: 2\nhandout: text\n---\n\n```slide\n---\nid: a1\n---\n# Opening\n```\n\n## Opening\n\nWords.\n\n```slide\n---\nid: a2\n---\n2\n\n# Results\n```\n';
    const handout = (await buildPrintPage({ deckPath, text, theme: BUILT_IN_THEME, print: 'handout' }, assets)).html;
    assert.match(handout, /<section class="part sect" data-i="1" id="t2"><div class="eyebrow">Section 2<\/div><h2>Results<\/h2>/);
    assert.match(handout, /#s2\{display:none!important\}#t2\{order:4;break-before:page/);
    const page = (await buildPrintPage({ deckPath, text, theme: BUILT_IN_THEME }, assets)).html;
    assert.match(page, /<div class="part only" data-i="1" id="t2"/);
  }

  // A handout with no text (every part emptied): Save handout as PDF says so and writes nothing, rather than a blank page.
  {
    const text = '---\ndeck: 2\nhandout: text\n---\n\n```slide\n---\nid: q1\n---\n# Only a slide\n```\n';
    const empty = path.join(project, 'decks', 'Empty – handout.pdf');
    const { saver, seen } = saverFor(deckPath, empty, { text });
    const said: DeckHostMessage[] = [];
    await saver.save(docOf(deckPath), 'handout', '', 'card', [], message => said.push(message));
    assert.deepEqual(said.at(-1), { type: 'deck/page-notice', text: PDF_NO_HANDOUT });
    assert.deepEqual({ printed: seen.printed, there: fs.existsSync(empty) }, { printed: [], there: false });
  }

  // A deck whose slides are all skipped: Save slides as PDF says so and writes nothing, rather than a blank page.
  {
    const text = '---\ndeck: 2\n---\n\n```slide\n---\nid: q1\nskip: true\n---\n# Left out\n```\n\n## Left out\n';
    const empty = path.join(project, 'decks', 'Empty.pdf');
    const { saver, seen } = saverFor(deckPath, empty, { text });
    const said: DeckHostMessage[] = [];
    await saver.save(docOf(deckPath), 'slides', '', 'card', [], message => said.push(message));
    assert.deepEqual(said.at(-1), { type: 'deck/page-notice', text: PDF_NO_SLIDES });
    assert.deepEqual({ printed: seen.printed, there: fs.existsSync(empty) }, { printed: [], there: false });
  }

  // writeOver never leaves its hidden copy behind when the rename fails.
  {
    const folder = makeTempDir('rm-pdf-over-');
    const from = path.join(folder, 'from.pdf');
    fs.writeFileSync(from, '%PDF');
    const into = path.join(folder, 'a folder');
    fs.mkdirSync(into);
    fs.writeFileSync(path.join(into, 'inside'), 'x');
    await assert.rejects(writeOver(from, into));
    assert.deepEqual(fs.readdirSync(folder).sort(), ['a folder', 'from.pdf']);
  }

  console.log('deckPdf: all passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
