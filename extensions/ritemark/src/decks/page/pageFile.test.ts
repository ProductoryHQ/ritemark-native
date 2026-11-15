/**
 * Sprint 159 (technical plan §6): the page file beside the deck, and 2.2's gather over it, end to end.
 *
 *  - the file's name; a file Ritemark didn't write for the deck is never overwritten (nor a link, nor a folder); a
 *    page from a first Publish that was cancelled is taken back, unless it changed since;
 *  - the digest changes with a public edit, and not with notes or a skipped slide;
 *  - in a real project on disk, 2.2's gather sends the page and the pictures the shown slides use: no `.md`, no picture
 *    only a skipped slide uses, nothing key-shaped with the fonts inlined, and no script-built names; and no private
 *    test word is in any byte that goes.
 *
 * Run: npx tsx src/decks/page/pageFile.test.ts
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gatherPage } from '../../publish/gather';
import { BUILT_IN_THEME } from '../deckTheme';
import { PAGE_FONTS, buildDeckPage, currentPageDigest, deckNameOf, foreignPageLine, nodePageFs, pagePathFor, picturePaths, readPageMeta, removeDeckPage, writeDeckPage, type PageFs } from './pageFile';
import type { PageAssets } from './pageHtml';
import { PRIVATE_DECK, PRIVATE_WORDS } from './testing/privateDeck';

const extension = path.resolve(__dirname, '..', '..', '..');
const assets: PageAssets = {
  slideCss: fs.readFileSync(path.join(extension, 'webview', 'src', 'components', 'decks', 'slide', 'slide.css'), 'utf8'),
  fonts: PAGE_FONTS.map(font => ({ base64: fs.readFileSync(path.join(extension, 'media', 'fonts', font.file)).toString('base64'), unicodeRange: font.unicodeRange })),
};

async function main(): Promise<void> {
  // The name: `<deck name>.html` beside the deck.
  assert.equal(deckNameOf('/p/Harbour Logistics/AI assistants and agents.deck.md'), 'AI assistants and agents');
  assert.equal(deckNameOf('/p/Talk.DECK.MD'), 'Talk');
  assert.equal(pagePathFor('/p/Harbour Logistics/AI assistants and agents.deck.md'), path.join('/p/Harbour Logistics', 'AI assistants and agents.html'));

  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'deck-page-')));
  const project = path.join(root, 'Training');
  const folder = path.join(project, 'Harbour Logistics');
  fs.mkdirSync(path.join(folder, 'images'), { recursive: true });
  const deckPath = path.join(folder, 'AI assistants and agents.deck.md');
  const pagePath = pagePathFor(deckPath);
  fs.writeFileSync(deckPath, PRIVATE_DECK);
  // The picture a shown part uses, and the one only the skipped slide uses (and a key-looking name in neither).
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5d70000000049454e44ae426082', 'hex');
  fs.writeFileSync(path.join(folder, 'images', 'which-stays.png'), png);
  fs.writeFileSync(path.join(folder, 'images', `${PRIVATE_WORDS.skippedPicture}.png`), png);

  const built = await buildDeckPage({ deckPath, text: PRIVATE_DECK, theme: BUILT_IN_THEME }, assets);
  assert.deepEqual(picturePaths(built.deck), [{ path: 'images/which-stays.png', from: 'handout' }], 'only the shown parts\' pictures are named');
  assert.equal(readPageMeta(built.html).digest, built.digest);
  assert.ok(readPageMeta(built.html).ritemark);
  assert.equal(await currentPageDigest(deckPath, PRIVATE_DECK, BUILT_IN_THEME), built.digest, 'the chip\'s digest is the page\'s');

  // A first write creates it; the same page again changes nothing; a new page replaces Ritemark's own.
  const first = await writeDeckPage(nodePageFs, deckPath, built.html);
  assert.deepEqual(first, { kind: 'written', pagePath, created: true, unchanged: false });
  assert.equal(fs.readFileSync(pagePath, 'utf8'), built.html);
  assert.deepEqual(await writeDeckPage(nodePageFs, deckPath, built.html), { kind: 'written', pagePath, created: false, unchanged: true });
  const edited = await buildDeckPage({ deckPath, text: PRIVATE_DECK.replace('Harbour title', 'Harbour title, again'), theme: BUILT_IN_THEME }, assets);
  assert.notEqual(edited.digest, built.digest);
  assert.deepEqual(await writeDeckPage(nodePageFs, deckPath, edited.html), { kind: 'written', pagePath, created: false, unchanged: false });
  assert.equal(readPageMeta(fs.readFileSync(pagePath, 'utf8')).digest, edited.digest);
  assert.deepEqual(fs.readdirSync(folder).filter(name => name.endsWith('.tmp')), [], 'no half-written page is left behind');

  // 2.2's gather, end to end, over the page on disk.
  await writeDeckPage(nodePageFs, deckPath, built.html);
  const plan = await gatherPage(pagePath, project);
  assert.deepEqual(plan.files.map(file => [file.relPath, file.kind]), [['AI assistants and agents.html', 'page'], ['images/which-stays.png', 'picture']]);
  assert.ok(!plan.files.some(file => /\.md$/i.test(file.relPath)), 'no Markdown file goes');
  assert.deepEqual(plan.leftOut, [], 'nothing is named as left out: the page names only what goes');
  assert.deepEqual(plan.keyHits, [], 'nothing key-shaped, with the fonts inlined');
  assert.equal(plan.scriptBuilt, false, 'the page\'s script builds no file names');
  for (const file of plan.files) {
    const bytes = fs.readFileSync(file.realPath).toString('latin1').toLowerCase();
    for (const [place, word] of Object.entries(PRIVATE_WORDS)) assert.ok(!bytes.includes(word.toLowerCase()), `${place}: "${word}" in ${file.relPath}`);
  }

  // A file Ritemark didn't write for this deck is never overwritten: a page of the person's own, a link, a folder.
  {
    const other = path.join(folder, 'Own page.deck.md');
    const own = pagePathFor(other);
    fs.writeFileSync(own, '<!doctype html><title>Mine</title><p>My own page</p>');
    const refused = await writeDeckPage(nodePageFs, other, built.html);
    assert.deepEqual(refused, { kind: 'refused', pagePath: own, line: foreignPageLine(own) });
    assert.equal(fs.readFileSync(own, 'utf8'), '<!doctype html><title>Mine</title><p>My own page</p>');
    assert.ok(!foreignPageLine(own).includes('\n') && foreignPageLine(own).startsWith('"Own page.html" is already beside this deck'));
    // A page of the generator's but without the deck's digest is not one Ritemark wrote for a deck.
    fs.writeFileSync(own, '<!doctype html><meta name="generator" content="Ritemark"><title>Exported</title>');
    assert.equal((await writeDeckPage(nodePageFs, other, built.html)).kind, 'refused');

    const linked = path.join(folder, 'Linked.deck.md');
    const target = path.join(root, 'elsewhere.html');
    fs.writeFileSync(target, built.html);
    fs.symlinkSync(target, pagePathFor(linked));
    assert.equal((await writeDeckPage(nodePageFs, linked, edited.html)).kind, 'refused', 'a link is never written through');
    assert.equal(fs.readFileSync(target, 'utf8'), built.html);

    const foldered = path.join(folder, 'Folder.deck.md');
    fs.mkdirSync(pagePathFor(foldered));
    assert.equal((await writeDeckPage(nodePageFs, foldered, built.html)).kind, 'refused', 'nor a folder');
  }

  // A file that arrives between the check and the move still isn't overwritten.
  {
    const racing = path.join(folder, 'Racing.deck.md');
    const racingPage = pagePathFor(racing);
    const sneaky: PageFs = {
      ...nodePageFs,
      writeFile: async (target, data) => {
        await nodePageFs.writeFile(target, data);
        fs.writeFileSync(racingPage, 'not a page of Ritemark\'s');
      },
    };
    assert.equal((await writeDeckPage(sneaky, racing, built.html)).kind, 'refused');
    assert.equal(fs.readFileSync(racingPage, 'utf8'), 'not a page of Ritemark\'s');
    assert.deepEqual(fs.readdirSync(folder).filter(name => name.endsWith('.tmp')), []);
  }

  // Replacing Ritemark's own page (Codex on #729): a file swapped in just before the page is moved aside goes back,
  // untouched; one that arrives while the page is aside stays. Nothing is left under a hidden name.
  {
    const swapped = path.join(folder, 'Swapped.deck.md');
    const swappedPage = pagePathFor(swapped);
    await writeDeckPage(nodePageFs, swapped, built.html);
    const swapIn: PageFs = {
      ...nodePageFs,
      rename: async (from, to) => {
        if (from === swappedPage) fs.writeFileSync(swappedPage, 'someone else\'s page');
        await nodePageFs.rename(from, to);
      },
    };
    assert.equal((await writeDeckPage(swapIn, swapped, edited.html)).kind, 'refused');
    assert.equal(fs.readFileSync(swappedPage, 'utf8'), 'someone else\'s page', 'put back, untouched');

    const arriving = path.join(folder, 'Arriving.deck.md');
    const arrivingPage = pagePathFor(arriving);
    await writeDeckPage(nodePageFs, arriving, built.html);
    let moved = false;
    const arriveWhileAside: PageFs = {
      ...nodePageFs,
      rename: async (from, to) => {
        await nodePageFs.rename(from, to);
        if (from === arrivingPage && !moved) { moved = true; fs.writeFileSync(arrivingPage, 'arrived meanwhile'); }
      },
    };
    assert.equal((await writeDeckPage(arriveWhileAside, arriving, edited.html)).kind, 'refused');
    assert.equal(fs.readFileSync(arrivingPage, 'utf8'), 'arrived meanwhile', 'never overwritten');
    // Where the file system has no second names, a move after a last check stands in.
    const noLinks: PageFs = { ...nodePageFs, link: async () => { throw Object.assign(new Error('no links'), { code: 'EPERM' }); } };
    const plain = path.join(folder, 'Plain.deck.md');
    assert.deepEqual(await writeDeckPage(noLinks, plain, built.html), { kind: 'written', pagePath: pagePathFor(plain), created: true, unchanged: false });
    assert.deepEqual(await writeDeckPage(noLinks, plain, edited.html), { kind: 'written', pagePath: pagePathFor(plain), created: false, unchanged: false });
    assert.equal(fs.readFileSync(pagePathFor(plain), 'utf8'), edited.html);
    assert.deepEqual(fs.readdirSync(folder).filter(name => name.startsWith('.')), [], 'nothing left under a hidden name');
  }

  // A first Publish cancelled: the page written for it is taken back. Not when it changed since, and never another file.
  {
    const cancelled = path.join(folder, 'Cancelled.deck.md');
    const page = (await buildDeckPage({ deckPath: cancelled, text: PRIVATE_DECK, theme: BUILT_IN_THEME }, assets));
    const written = await writeDeckPage(nodePageFs, cancelled, page.html);
    assert.equal(written.kind === 'written' && written.created, true);
    assert.equal(await removeDeckPage(nodePageFs, pagePathFor(cancelled), edited.html), false, 'another page: kept');
    assert.ok(fs.existsSync(pagePathFor(cancelled)));
    // An edit that kept Ritemark's marks (Codex on #729) is still an edit: kept.
    const touched = page.html.replace('</body>', '<p>my own line</p></body>');
    fs.writeFileSync(pagePathFor(cancelled), touched);
    assert.equal(await removeDeckPage(nodePageFs, pagePathFor(cancelled), page.html), false, 'edited since: kept');
    assert.equal(fs.readFileSync(pagePathFor(cancelled), 'utf8'), touched);
    fs.writeFileSync(pagePathFor(cancelled), page.html);
    assert.equal(await removeDeckPage(nodePageFs, pagePathFor(cancelled), page.html), true);
    assert.ok(!fs.existsSync(pagePathFor(cancelled)), 'the cancelled first Publish leaves no page');
    assert.equal(await removeDeckPage(nodePageFs, pagePathFor(cancelled), page.html), false, 'nothing there: nothing to do');
    assert.equal(await removeDeckPage(nodePageFs, pagePathFor(path.join(folder, 'Own page.deck.md')), page.html), false, 'a page of the person\'s own: kept');
  }

  // The digest changes with a public edit, and not with an edit to notes or to a skipped slide.
  {
    const digest = (text: string) => currentPageDigest(deckPath, text, BUILT_IN_THEME);
    const base = await digest(PRIVATE_DECK);
    assert.equal(await digest(PRIVATE_DECK.replace(PRIVATE_WORDS.foldedNotes, 'other notes')), base, 'notes');
    assert.equal(await digest(PRIVATE_DECK.replace(PRIVATE_WORDS.strayNotes, 'other')), base, 'a stray notes block');
    assert.equal(await digest(PRIVATE_DECK.replace(PRIVATE_WORDS.skippedHandout, 'other')), base, "a skipped slide's handout");
    assert.equal(await digest(PRIVATE_DECK.replace(PRIVATE_WORDS.skippedWords, 'other')), base, "a skipped slide's words");
    assert.equal(await digest(PRIVATE_DECK.replace(PRIVATE_WORDS.standaloneComment, 'other')), base, 'a comment');
    assert.notEqual(await digest(PRIVATE_DECK.replace('Choose a task you do every week', 'Choose a task')), base, 'a handout');
    assert.notEqual(await digest(PRIVATE_DECK.replace('title: Read the room', 'title: Read it')), base, 'a slide');
    // A picture the page names, added since: the page would change (its place stops being empty), so the digest does.
    const withPicture = PRIVATE_DECK.replace('![A picture that stays](images/which-stays.png)', '![A picture that stays](images/which-stays.png) ![Later](images/later%20one.png)');
    const before = await digest(withPicture);
    fs.writeFileSync(path.join(folder, 'images', 'later one.png'), png);
    assert.notEqual(await digest(withPicture), before, 'a picture that arrived');
    const page = await buildDeckPage({ deckPath, text: withPicture, theme: BUILT_IN_THEME }, assets);
    assert.ok(page.html.includes('src="images/later%20one.png"'), 'the handout\'s picture, its address encoded once');
    assert.equal(page.digest, await digest(withPicture));
  }

  fs.rmSync(root, { recursive: true, force: true });
  console.log('pageFile: passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
