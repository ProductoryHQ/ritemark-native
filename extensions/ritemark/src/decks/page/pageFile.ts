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
 *    folder or anything else that isn't a plain file. A page is written under a hidden name next to its place, then
 *    put in where nothing is (refused in one step if something arrived) or moved over Ritemark's own page, so a
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
import { blockPicturePaths } from '../blocks/slideRenderer';
import { isRelativeTarget } from '../deckLibraryFormat';
import { DECK_FONT_SUBSETS, DEFAULT_DECK_FONT, deckFont, deckFontFile, themeFonts, type DeckFont, type DeckTheme } from '../deckTheme';
import { DIGEST_META, GENERATOR_META, lexHandout, pageHtml, pictureAddress, pictureFile, pictureKey, type PageAssets, type PageThemeFont, type PictureFrom } from './pageHtml';
import { deckDigest, publicDeck, type PublicDeck } from './publicDeck';

export interface PageFs {
  /** Throws (ENOENT) when there is nothing at the path. */
  lstat(target: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  /** Follows links: is there a file here? */
  stat(target: string): Promise<{ isFile(): boolean }>;
  readFile(target: string): Promise<string>;
  writeFile(target: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  /** A second name for a file, failing (EEXIST) when `to` is taken: the one way a page is put in its place. */
  link(from: string, to: string): Promise<void>;
  unlink(target: string): Promise<void>;
}

export const nodePageFs: PageFs = {
  lstat: target => fs.promises.lstat(target),
  stat: target => fs.promises.stat(target),
  readFile: target => fs.promises.readFile(target, 'utf8'),
  writeFile: (target, data) => fs.promises.writeFile(target, data, { encoding: 'utf8', flag: 'wx' }),
  rename: (from, to) => fs.promises.rename(from, to),
  link: (from, to) => fs.promises.link(from, to),
  unlink: target => fs.promises.unlink(target),
};

/** Sofia Sans as the app ships it (`media/fonts/`), with the webview's own unicode ranges (`webview/src/index.css`). */
export const PAGE_FONTS = [
  {
    file: deckFontFile(deckFont(DEFAULT_DECK_FONT), 'latin'),
    unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    file: deckFontFile(deckFont(DEFAULT_DECK_FONT), 'latin-ext'),
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

/** A hidden name beside the page: never a page of the project, and never sent by Publish's gather. */
function besidePage(pagePath: string, ending: string): string {
  return path.join(path.dirname(pagePath), `.${path.basename(pagePath)}.${randomBytes(4).toString('hex')}.${ending}`);
}

/**
 * Put `from` at `to` only if nothing is there, in one step: a second name, which the system refuses (EEXIST) when
 * `to` is taken, then the first name dropped. False when `to` was taken. Where the file system can't give a second
 * name (FAT and exFAT, some network and synced folders, whatever the error), a move after a last check stands in.
 */
async function placeNoReplace(pageFs: PageFs, from: string, to: string): Promise<boolean> {
  try {
    await pageFs.link(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') return false;
    if ((await pageAt(pageFs, to)).kind !== 'none') return false;
    await pageFs.rename(from, to);
    return true;
  }
  await pageFs.unlink(from).catch(() => undefined);
  return true;
}

/**
 * Write the page beside the deck. A file Ritemark didn't write for a deck (or a link, or a folder) is never touched:
 * the result says why in one line. The page is written under a hidden name first, so a half-written page is never what
 * Publish reads. Where nothing is, it goes in only if nothing arrived meanwhile, in one step (`placeNoReplace`: Codex
 * on #729); a page Ritemark wrote is replaced by a move over it, after a last check, so the place is never empty.
 */
export async function writeDeckPage(pageFs: PageFs, deckPath: string, html: string): Promise<WriteResult> {
  const pagePath = pagePathFor(deckPath);
  const refused = (): WriteResult => ({ kind: 'refused', pagePath, line: foreignPageLine(pagePath) });
  let there = await pageAt(pageFs, pagePath);
  if (there.kind === 'foreign') return refused();
  if (there.kind === 'ours' && there.html === html) return { kind: 'written', pagePath, created: false, unchanged: true };
  const temporary = besidePage(pagePath, 'tmp');
  await pageFs.writeFile(temporary, html);
  try {
    if (there.kind === 'none') {
      if (await placeNoReplace(pageFs, temporary, pagePath)) return { kind: 'written', pagePath, created: true, unchanged: false };
      // Something arrived meanwhile: another window's page for this deck is replaced, anything else stays.
      there = await pageAt(pageFs, pagePath);
      if (there.kind !== 'ours') return refused();
    }
    // Checked again just before the move: a file that arrived meanwhile is still never overwritten.
    if ((await pageAt(pageFs, pagePath)).kind === 'foreign') return refused();
    await pageFs.rename(temporary, pagePath);
    return { kind: 'written', pagePath, created: false, unchanged: false };
  } finally {
    await pageFs.unlink(temporary).catch(() => undefined);
  }
}

/**
 * Take back a page written for a first Publish that was then cancelled: only while the file is still exactly the page
 * that was written (Codex on #729: an edit that kept the marks is still an edit). Anything else stays. True when it
 * was removed.
 */
export async function removeDeckPage(pageFs: PageFs, pagePath: string, html: string): Promise<boolean> {
  const there = await pageAt(pageFs, pagePath).catch(() => ({ kind: 'foreign' as const }));
  if (there.kind !== 'ours' || there.html !== html) return false;
  await pageFs.unlink(pagePath);
  return true;
}

/** Every picture the public deck names, and where: the slides' `image:` lines and the handouts' pictures (relative ones). */
export function picturePaths(deck: PublicDeck): Array<{ path: string; from: PictureFrom }> {
  const found = new Map<string, { path: string; from: PictureFrom }>();
  const add = (picture: string, from: PictureFrom) => {
    if (isRelativeTarget(picture)) found.set(pictureKey(picture, from), { path: picture.trim(), from });
  };
  for (const slide of deck.slides) {
    if (slide.data.image) add(slide.data.image, 'slide');
    // A block slide's own pictures (Sprint 161), by the paths its renderer asks for them.
    if (slide.data.markdown) for (const picture of blockPicturePaths(slide.data.markdown)) add(picture, 'slide');
  }
  for (const markdown of [deck.preamble, ...deck.slides.map(slide => slide.handout)]) {
    if (!markdown) continue;
    marked.walkTokens(lexHandout(markdown), token => {
      if (token.type === 'image') add(token.href, 'handout');
    });
  }
  return [...found.values()];
}

/** The pictures the page names that are files beside the deck, by where they are named: their addresses on the page. */
async function foundPictures(deck: PublicDeck, deckPath: string, pageFs: Pick<PageFs, 'stat'>): Promise<Map<string, string>> {
  const folder = path.dirname(deckPath);
  const checked = await Promise.all(picturePaths(deck).map(async picture => {
    const file = pictureFile(picture.path, picture.from);
    try {
      return (await pageFs.stat(path.resolve(folder, ...file.split('/')))).isFile() ? [pictureKey(picture.path, picture.from), pictureAddress(file)] as const : null;
    } catch {
      // Not there: the slide draws its empty picture place, the handout the picture's words.
      return null;
    }
  }));
  return new Map(checked.filter((entry): entry is readonly [string, string] => entry !== null));
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
  // The theme's font files the page names count too (Sprint 162 PR 3): a page made before its fonts were there, or
  // by an app without them, reads as changed once they can go.
  // The logo's file too (Sprint 162 PR 4): its name holds its bytes' hash, so another logo reads as changed.
  const digest = pageDigest(deck, [...urls.values(), ...(assets.themeFonts ?? []).map(font => font.address), ...(deck.theme.logo && assets.logo ? [assets.logo.address] : [])]);
  const html = pageHtml(deck, assets, { digest, pictureUrl: (picture, from) => urls.get(pictureKey(picture, from)) ?? null });
  return { deck, digest, html };
}

/**
 * The deck's page digest now, without building the page: what the chip compares with the page's own (PR 4), with the
 * addresses of the theme's font files the page would name (`themeFontFiles`).
 */
export async function currentPageDigest(deckPath: string, text: string, theme: DeckTheme, pageFs: Pick<PageFs, 'stat'> = nodePageFs, fontAddresses: readonly string[] = []): Promise<string> {
  const deck = publicDeckOf(deckPath, text, theme);
  return pageDigest(deck, [...(await foundPictures(deck, deckPath, pageFs)).values(), ...fontAddresses]);
}

// ------------------------------------------------------------------ The theme's fonts, as files beside the page

/**
 * Sprint 162 PR 3 (step-3-themes.md: "The fonts go with the page as files (OFL allows it)"): the theme's fonts other
 * than Sofia Sans (which the page carries inline, for its own words too) are files in a `fonts` folder beside the
 * page, `fonts/<Font>-<version>-<part>.woff2`, which the page's `@font-face` rules name. 2.2's gather finds them in the
 * page's style and sends them with it, under its own rules, as it sends the pictures. Only the theme's fonts are
 * written, and each only once for all the decks in a folder. The page loads no font from anywhere else.
 *
 *  - A file Ritemark didn't write is never touched: a name taken by other bytes, a link or a folder stops the page in
 *    one line, as the page's own place does. The version in the name means a newer font never meets an older file.
 *  - A font whose files the app doesn't have (an app older than the fonts) is left out: the page draws it in Sofia
 *    Sans, the next name in the slide's font list.
 */
export const PAGE_FONT_FOLDER = 'fonts';

/** A theme font's file for the page, with its bytes. */
export interface PageFontFile extends PageThemeFont {
  bytes: Buffer;
}

/** The page's name for a font's part: `Inter-4.001-latin.woff2`. */
export function pageFontName(font: DeckFont, subset: (typeof DECK_FONT_SUBSETS)[number]['subset']): string {
  return `${font.file}-${font.version}-${subset}.woff2`;
}

/**
 * The theme's fonts beyond Sofia Sans, read from the app's `media/fonts/`: both parts of each, or none of a font
 * whose files aren't there.
 */
export async function themeFontFiles(
  extensionPath: string,
  theme: Pick<DeckTheme, 'fh' | 'fb'>,
  read: (file: string) => Promise<Buffer> = file => fs.promises.readFile(file),
): Promise<PageFontFile[]> {
  const files: PageFontFile[] = [];
  for (const font of themeFonts(theme)) {
    if (font.name === DEFAULT_DECK_FONT) continue;
    const parts = await Promise.all(DECK_FONT_SUBSETS.map(async part => {
      try {
        return {
          family: font.name,
          unicodeRange: part.unicodeRange,
          address: `${PAGE_FONT_FOLDER}/${pageFontName(font, part.subset)}`,
          bytes: await read(path.join(extensionPath, 'media', 'fonts', deckFontFile(font, part.subset))),
        };
      } catch {
        return null;
      }
    }));
    if (parts.every(part => part !== null)) files.push(...(parts as PageFontFile[]));
  }
  return files;
}

export interface FontFs {
  /** Throws (ENOENT) when there is nothing at the path. */
  lstat(target: string): Promise<{ isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }>;
  readFile(target: string): Promise<Buffer>;
  /** Fails (EEXIST) when the path is taken. */
  writeFile(target: string, data: Buffer): Promise<void>;
  /** Fails (EEXIST) when the path is taken. */
  mkdir(target: string): Promise<void>;
  readdir(target: string): Promise<string[]>;
  link(from: string, to: string): Promise<void>;
  unlink(target: string): Promise<void>;
  rmdir(target: string): Promise<void>;
}

export const nodeFontFs: FontFs = {
  lstat: target => fs.promises.lstat(target),
  readFile: target => fs.promises.readFile(target),
  // Create-only; a file it created and couldn't finish (a full disk, a dropped network folder) is taken back, since it
  // is Ritemark's own, and a half font must never stop the next Publish (the review of #777).
  writeFile: async (target, data) => {
    const handle = await fs.promises.open(target, 'wx');
    try {
      await handle.writeFile(data);
      await handle.close();
    } catch (error) {
      await handle.close().catch(() => undefined);
      await fs.promises.unlink(target).catch(() => undefined);
      throw error;
    }
  },
  mkdir: async target => { await fs.promises.mkdir(target); },
  readdir: target => fs.promises.readdir(target),
  link: (from, to) => fs.promises.link(from, to),
  unlink: target => fs.promises.unlink(target),
  rmdir: target => fs.promises.rmdir(target),
};

/** The one line when the fonts' place beside the deck holds something Ritemark didn't put there. */
export function foreignFontLine(shown: string): string {
  return `"${shown}" is already beside this deck, and isn't the font Ritemark puts there, so it stays as it is. Rename it to publish the deck.`;
}

/** Sprint 162 PR 4: the same line for the logo's place. */
export function foreignLogoLine(shown: string): string {
  return `"${shown}" is already beside this deck, and isn't the logo Ritemark puts there, so it stays as it is. Rename it to publish the deck.`;
}

/**
 * Where a page's own files go beside it, and the line when their place holds something else: the theme's fonts in
 * `fonts/` (PR 3), its logo in `logos/` (PR 4). Both are written and taken back by the same rules.
 */
export interface PageFilePlace {
  folder: string;
  line: (shown: string) => string;
}
export const FONT_PLACE: PageFilePlace = { folder: PAGE_FONT_FOLDER, line: foreignFontLine };

// ------------------------------------------------------------------ The theme's logo, as a file beside the page

/**
 * Sprint 162 PR 4 (step-3-themes.md: "A published page carries the theme's colours, fonts and logo"): the logo goes
 * beside the page as a file, as the fonts do, in a `logos` folder, `logos/logo-<hash>.svg`, the hash being its bytes'
 * (SHA-256, 16 characters): the same logo is one file for all the decks in a folder, and another logo never meets an
 * older file of the same name. Written create-only just before the page, never over another file, and taken back
 * with a cancelled first Publish by the fonts' rules. The page draws it as an `<img>`, never as markup.
 */
export const PAGE_LOGO_FOLDER = 'logos';
export const LOGO_PLACE: PageFilePlace = { folder: PAGE_LOGO_FOLDER, line: foreignLogoLine };

/** A page's own file beside it: its address on the page and its bytes. */
export interface PageFile {
  address: string;
  bytes: Buffer;
}

/** The logo's file for the page: `logos/logo-3f9a2c1d7e0b4a65.svg`. */
export function pageLogoFile(bytes: Buffer, kind: 'svg' | 'png'): PageFile {
  return { address: `${PAGE_LOGO_FOLDER}/logo-${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.${kind}`, bytes };
}

export type FontWriteResult =
  /** `created`: the files this call put in; `madeFolder`: whether it made the `fonts` folder too. */
  | { kind: 'written'; created: string[]; madeFolder: boolean }
  | { kind: 'refused'; line: string };

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

/** What is at a font's place: nothing, the same bytes, or something else. */
async function fontAt(fontFs: FontFs, target: string, bytes: Buffer): Promise<'none' | 'same' | 'other'> {
  let info: { isFile(): boolean; isSymbolicLink(): boolean };
  try {
    info = await fontFs.lstat(target);
  } catch (error) {
    if (isMissing(error)) return 'none';
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile()) return 'other';
  return (await fontFs.readFile(target)).equals(bytes) ? 'same' : 'other';
}

/** The errors of a system that gives no second names (hard links). */
const NO_LINK_CODES = new Set(['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EXDEV', 'ENOSYS', 'EINVAL']);

/**
 * What is at a font's place once another Publish writing the same font there has finished: where files are written
 * create-only, a file can be seen before all its bytes are in (the review of #777), so other bytes are asked again a
 * few times before they count as someone else's.
 */
async function settledFontAt(fontFs: FontFs, target: string, bytes: Buffer, tries = 4, waitMs = 250): Promise<'none' | 'same' | 'other'> {
  let now = await fontAt(fontFs, target, bytes);
  for (let attempt = 1; now === 'other' && attempt < tries; attempt++) {
    await new Promise(resolve => setTimeout(resolve, waitMs));
    now = await fontAt(fontFs, target, bytes);
  }
  return now;
}

/** Is the fonts' folder a plain folder (not a link, not a file)? */
async function plainFolder(fontFs: FontFs, folder: string): Promise<boolean> {
  const info = await fontFs.lstat(folder);
  return !info.isSymbolicLink() && info.isDirectory();
}

/**
 * Write the theme's font files beside the deck (`fonts/`), each where nothing is, in one step (a second name, which
 * the system refuses when the name is taken; a create-only write where it can't give one), as the page is written. A file already there with the same bytes stays. Anything else at a font's place, or a `fonts` that isn't a
 * plain folder, stops it: what this call wrote is taken back, and the result says why in one line.
 */
export async function writePageFonts(fontFs: FontFs, deckPath: string, files: readonly PageFile[], place: PageFilePlace = FONT_PLACE): Promise<FontWriteResult> {
  if (files.length === 0) return { kind: 'written', created: [], madeFolder: false };
  const folder = path.join(path.dirname(deckPath), place.folder);
  const created: string[] = [];
  let madeFolder = false;
  let noLinks = false;
  const takeBack = async () => {
    for (const file of created) await fontFs.unlink(file).catch(() => undefined);
    if (madeFolder) await fontFs.rmdir(folder).catch(() => undefined);
  };
  const refused = async (shown: string): Promise<FontWriteResult> => {
    await takeBack();
    return { kind: 'refused', line: place.line(shown) };
  };
  try {
    try {
      if (!(await plainFolder(fontFs, folder))) return await refused(place.folder);
    } catch (error) {
      if (!isMissing(error)) throw error;
      try {
        await fontFs.mkdir(folder);
        madeFolder = true;
      } catch (made) {
        if ((made as NodeJS.ErrnoException)?.code !== 'EEXIST') throw made;
        if (!(await plainFolder(fontFs, folder))) return await refused(place.folder);
      }
    }
    for (const file of files) {
      const name = file.address.slice(place.folder.length + 1);
      const target = path.join(folder, name);
      const shown = `${place.folder}/${name}`;
      const there = await fontAt(fontFs, target, file.bytes);
      if (there === 'same') continue;
      if (there === 'other') return await refused(shown);
      // Where the system gives no second names (FAT, exFAT, some network folders), the font is written at its name
      // with the system's own create-only (`wx`), never a move that could replace a file arriving in between (Codex on
      // #777); once a link has failed so, the rest go that way at once, without a copy under a hidden name.
      if (!noLinks) {
        const temporary = path.join(folder, `.${name}.${randomBytes(4).toString('hex')}.tmp`);
        try {
          await fontFs.writeFile(temporary, file.bytes);
          await fontFs.link(temporary, target);
          created.push(target);
          continue;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException)?.code;
          if (code !== 'EEXIST' && !NO_LINK_CODES.has(code ?? '')) throw error;
          if (code !== 'EEXIST') noLinks = true;
        } finally {
          await fontFs.unlink(temporary).catch(() => undefined);
        }
      }
      let now = await fontAt(fontFs, target, file.bytes);
      if (now === 'none') {
        try {
          // `nodeFontFs.writeFile` takes back a file it created and couldn't finish.
          await fontFs.writeFile(target, file.bytes);
          created.push(target);
          continue;
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
          now = await settledFontAt(fontFs, target, file.bytes);
        }
      } else if (now === 'other') {
        now = await settledFontAt(fontFs, target, file.bytes);
      }
      // Taken meanwhile: the same font from another window is fine, anything else stops the page.
      if (now !== 'same') return await refused(shown);
    }
  } catch (error) {
    await takeBack();
    throw error;
  }
  return { kind: 'written', created, madeFolder };
}

/**
 * Take back the font files a Publish wrote, when its page was taken back or never written: each only while it still
 * holds the bytes written, no other page Ritemark wrote in the deck's folder names it, and `keep` doesn't hold it (a
 * Publish of another deck in this window that is using it); then the `fonts` folder, if this Publish made it and it
 * is empty.
 */
export async function removePageFonts(
  fontFs: FontFs,
  deckPath: string,
  written: { created: readonly string[]; madeFolder: boolean },
  files: readonly PageFile[],
  keep: (target: string) => boolean = () => false,
  place: PageFilePlace = FONT_PLACE,
): Promise<void> {
  const { created } = written;
  if (created.length === 0) return;
  const folder = path.dirname(deckPath);
  const named = new Set<string>();
  for (const entry of await fontFs.readdir(folder).catch(() => [] as string[])) {
    if (!/\.html?$/i.test(entry)) continue;
    const html = await fontFs.readFile(path.join(folder, entry)).then(bytes => bytes.toString('utf8')).catch(() => '');
    if (!readPageMeta(html).ritemark) continue;
    for (const file of files) if (html.includes(file.address)) named.add(file.address);
  }
  for (const target of created) {
    const file = files.find(candidate => path.join(folder, ...candidate.address.split('/')) === target);
    if (!file || named.has(file.address) || keep(target)) continue;
    if ((await fontAt(fontFs, target, file.bytes).catch(() => 'other' as const)) === 'same') await fontFs.unlink(target).catch(() => undefined);
  }
  if (written.madeFolder) await fontFs.rmdir(path.join(folder, place.folder)).catch(() => undefined);
}
