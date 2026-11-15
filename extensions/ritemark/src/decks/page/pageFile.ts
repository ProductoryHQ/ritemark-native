/**
 * Sprint 159 (technical plan §2.5, decision 1): the handout page is a real file beside the deck, `<deck name>.html`
 * next to `<deck name>.deck.md`, so 2.2's Publish publishes it as it publishes any page (its gather reads the page from
 * disk, its upload reads it again and checks every hash, and its records are keyed by the page's path).
 *
 *  - The page carries `<meta name="generator" content="Ritemark">` and `<meta name="ritemark-deck" content="<digest>">`,
 *    the digest being `pageDigest`: what `publicDeck` returns, and which of its pictures are there. Those two mark a
 *    file Ritemark wrote for the deck beside it, and the digest says whether the deck has changed since (the chip's
 *    "Published · changed").
 *  - It never overwrites a file Ritemark didn't write for this deck: it stops and says why in one line. Nor a link, a
 *    folder or anything else that isn't a plain file. A page is written next to its place and moved over it, so a
 *    half-written page is never what Publish reads.
 *  - A page written for a first Publish that is then cancelled is removed again (`removeDeckPage`), unless it changed
 *    since it was written.
 *
 * The file system is a parameter (`PageFs`), so every rule here tests under plain Node; `nodePageFs` is the real one.
 */
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { marked } from 'marked';
import { isRelativeTarget } from '../deckLibraryFormat';
import type { DeckTheme } from '../deckTheme';
import { DIGEST_META, GENERATOR_META, pageHtml, pictureAddress, pictureFile, type PageAssets, type PictureFrom } from './pageHtml';
import { deckDigest, publicDeck, type PublicDeck } from './publicDeck';

export interface PageFs {
  /** Throws (ENOENT) when there is nothing at the path. */
  lstat(target: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  /** Follows links: is there a file here? */
  stat(target: string): Promise<{ isFile(): boolean }>;
  readFile(target: string): Promise<string>;
  writeFile(target: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(target: string): Promise<void>;
}

export const nodePageFs: PageFs = {
  lstat: target => fs.promises.lstat(target),
  stat: target => fs.promises.stat(target),
  readFile: target => fs.promises.readFile(target, 'utf8'),
  writeFile: (target, data) => fs.promises.writeFile(target, data, { encoding: 'utf8', flag: 'wx' }),
  rename: (from, to) => fs.promises.rename(from, to),
  unlink: target => fs.promises.unlink(target),
};

/** Sofia Sans as the app ships it (`media/fonts/`), with the webview's own unicode ranges (`webview/src/index.css`). */
export const PAGE_FONTS = [
  {
    file: 'SofiaSans-latin.woff2',
    unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    file: 'SofiaSans-latin-ext.woff2',
    unicodeRange: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
] as const;

/** A deck's name: its file name without `.deck.md`. */
export function deckNameOf(deckPath: string): string {
  return path.basename(deckPath).replace(/\.deck\.md$/i, '');
}

/** Where a deck's page goes: `<deck name>.html` beside it. */
export function pagePathFor(deckPath: string): string {
  return path.join(path.dirname(deckPath), `${deckNameOf(deckPath)}.html`);
}

/** The two marks of a page Ritemark wrote from a deck, read from the page's head. */
export function readPageMeta(html: string): { ritemark: boolean; digest: string | null } {
  const head = html.slice(0, 4096);
  const generator = new RegExp(`<meta name="generator" content="${GENERATOR_META}">`).test(head);
  const digest = new RegExp(`<meta name="${DIGEST_META}" content="([0-9a-f]{64})">`).exec(head)?.[1] ?? null;
  return { ritemark: generator && digest !== null, digest };
}

/** The one line when the page's place holds a file Ritemark didn't write for this deck. */
export function foreignPageLine(pagePath: string): string {
  return `"${path.basename(pagePath)}" is already beside this deck, and Ritemark didn't make it from the deck, so it stays as it is. Rename that file to publish the deck.`;
}

export type WriteResult =
  | { kind: 'written'; pagePath: string; created: boolean; unchanged: boolean }
  | { kind: 'refused'; pagePath: string; line: string };

/** What is at the page's place: nothing, a page Ritemark wrote from a deck (with its text), or something else. */
async function pageAt(pageFs: PageFs, pagePath: string): Promise<{ kind: 'none' } | { kind: 'ours'; html: string } | { kind: 'foreign' }> {
  let info: { isFile(): boolean; isSymbolicLink(): boolean };
  try {
    info = await pageFs.lstat(pagePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { kind: 'none' };
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile()) return { kind: 'foreign' };
  const html = await pageFs.readFile(pagePath);
  return readPageMeta(html).ritemark ? { kind: 'ours', html } : { kind: 'foreign' };
}

/**
 * Write the page beside the deck. A file Ritemark didn't write for a deck (or a link, or a folder) is never touched:
 * the result says why in one line. The new page is written beside its place and moved over it in one step.
 */
export async function writeDeckPage(pageFs: PageFs, deckPath: string, html: string): Promise<WriteResult> {
  const pagePath = pagePathFor(deckPath);
  const there = await pageAt(pageFs, pagePath);
  if (there.kind === 'foreign') return { kind: 'refused', pagePath, line: foreignPageLine(pagePath) };
  if (there.kind === 'ours' && there.html === html) return { kind: 'written', pagePath, created: false, unchanged: true };
  // A hidden name beside the page: never a page of the project, and never sent by Publish's gather.
  const temporary = path.join(path.dirname(pagePath), `.${path.basename(pagePath)}.${randomBytes(4).toString('hex')}.tmp`);
  await pageFs.writeFile(temporary, html);
  try {
    // Checked again just before the move: a file that arrived meanwhile is still never overwritten.
    const now = await pageAt(pageFs, pagePath);
    if (now.kind === 'foreign') {
      await pageFs.unlink(temporary).catch(() => undefined);
      return { kind: 'refused', pagePath, line: foreignPageLine(pagePath) };
    }
    await pageFs.rename(temporary, pagePath);
    return { kind: 'written', pagePath, created: now.kind === 'none', unchanged: false };
  } catch (error) {
    await pageFs.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

/**
 * Take back a page written for a first Publish that was then cancelled: only a page Ritemark wrote, still holding the
 * digest it was written with. Anything else stays. True when it was removed.
 */
export async function removeDeckPage(pageFs: PageFs, pagePath: string, digest: string): Promise<boolean> {
  const there = await pageAt(pageFs, pagePath).catch(() => ({ kind: 'foreign' as const }));
  if (there.kind !== 'ours' || readPageMeta(there.html).digest !== digest) return false;
  await pageFs.unlink(pagePath);
  return true;
}

/** Every picture the public deck names, and where: the slides' `image:` lines and the handouts' pictures (relative ones). */
export function picturePaths(deck: PublicDeck): Array<{ path: string; from: PictureFrom }> {
  const found = new Map<string, { path: string; from: PictureFrom }>();
  const add = (picture: string, from: PictureFrom) => {
    if (isRelativeTarget(picture)) found.set(`${from}\u0000${picture.trim()}`, { path: picture.trim(), from });
  };
  for (const slide of deck.slides) if (slide.data.image) add(slide.data.image, 'slide');
  for (const markdown of [deck.preamble, ...deck.slides.map(slide => slide.handout)]) {
    if (!markdown) continue;
    marked.walkTokens(marked.lexer(markdown, { gfm: true }), token => {
      if (token.type === 'image') add(token.href, 'handout');
    });
  }
  return [...found.values()];
}

/** The pictures the page names that are files beside the deck, by where they are named: their addresses on the page. */
async function foundPictures(deck: PublicDeck, deckPath: string, pageFs: Pick<PageFs, 'stat'>): Promise<Map<string, string>> {
  const folder = path.dirname(deckPath);
  const found = new Map<string, string>();
  for (const picture of picturePaths(deck)) {
    const file = pictureFile(picture.path, picture.from);
    try {
      if ((await pageFs.stat(path.resolve(folder, ...file.split('/')))).isFile()) found.set(`${picture.from}\u0000${picture.path}`, pictureAddress(file));
    } catch {
      // Not there: the slide draws its empty picture place, the handout the picture's words.
    }
  }
  return found;
}

/**
 * The page's digest: the public deck's (`deckDigest`) and which of its pictures are there, since a picture added
 * later changes the page (its place stops being empty) while 2.2's own check, which reads the files the page names,
 * can't see a picture the page doesn't name yet.
 */
export function pageDigest(deck: PublicDeck, addresses: Iterable<string>): string {
  const pictures = [...new Set(addresses)].sort();
  return createHash('sha256').update(`${deckDigest(deck)}\n${pictures.join('\n')}`).digest('hex');
}

export interface BuiltPage {
  deck: PublicDeck;
  digest: string;
  html: string;
}

function publicDeckOf(deckPath: string, text: string, theme: DeckTheme, steps?: readonly number[]): PublicDeck {
  return publicDeck(text, { folderName: path.basename(path.dirname(deckPath)), deckName: deckNameOf(deckPath), theme, steps });
}

/**
 * The page for a deck's text: `publicDeck`, its digest, and `pageHtml`, with each picture the page names checked to
 * be a file beside the deck (a missing one draws its empty place, as in the deck view).
 */
export async function buildDeckPage(
  input: { deckPath: string; text: string; theme: DeckTheme; steps?: readonly number[] },
  assets: PageAssets,
  pageFs: Pick<PageFs, 'stat'> = nodePageFs,
): Promise<BuiltPage> {
  const deck = publicDeckOf(input.deckPath, input.text, input.theme, input.steps);
  const urls = await foundPictures(deck, input.deckPath, pageFs);
  const digest = pageDigest(deck, urls.values());
  const html = pageHtml(deck, assets, { digest, pictureUrl: (picture, from) => urls.get(`${from}\u0000${picture.trim()}`) ?? null });
  return { deck, digest, html };
}

/** The deck's page digest now, without building the page: what the chip compares with the page's own (PR 4). */
export async function currentPageDigest(deckPath: string, text: string, theme: DeckTheme, pageFs: Pick<PageFs, 'stat'> = nodePageFs): Promise<string> {
  const deck = publicDeckOf(deckPath, text, theme);
  return pageDigest(deck, (await foundPictures(deck, deckPath, pageFs)).values());
}
