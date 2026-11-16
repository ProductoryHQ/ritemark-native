/**
 * New → Deck (Sprint 159, PR 7; since 16 November without a quick pick, the Experience lead's frame 20): what a new
 * deck holds and is called, the steps that make it, and the start card's copy of an earlier deck. Pure: no `vscode`,
 * so the test runs the same rules and steps the command uses (decksHost.ts).
 *
 *  - New → Deck makes "Untitled.deck.md" ("Untitled 2.deck.md" and on), a title slide reading "The deck's title" in
 *    the built-in theme, in the folder New was opened from, and opens it at once, as New → Text and Table do.
 *  - The deck's start card offers a copy of an earlier deck: this deck becomes that deck as written, notes included (it
 *    is the person's own deck), named "<deck name> (copy)" ("(copy 2)" and on when that is taken). Only its relative
 *    paths change when it is in another folder, so its pictures and links still point where they did.
 *  - The card lists the project's decks, newest first, each with its folder and date. The Slide library's topics are the
 *    library, not earlier decks, so they are left out (as the library's Other decks leaves them out).
 */

import { EMPTY_DECK_TITLE, newId, parseDeck, writeScalar } from './deckFormat';
import { folderOf, newTopicText, partText, rebaseSlide } from './deckLibraryFormat';
import { isTopicPath } from './DeckLibrary';
import { BUILT_IN_THEME_PATH } from './deckTheme';

/** The words an empty deck's title slide starts with, selected so they are typed over (its part shows no heading of them). */
export { EMPTY_DECK_TITLE };

/** A new deck: one title slide, its title the words to type over, in the built-in theme. */
export function emptyDeckText(random: () => number = Math.random): string {
  const id = newId([], random);
  return newTopicText(BUILT_IN_THEME_PATH, partText('title', `id: ${id}\ntitle: ${writeScalar(EMPTY_DECK_TITLE)}`, ''));
}

/** A deck's name: its file name without `.deck.md`. */
export function deckFileName(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.replace(/\.deck\.md$/i, '');
}

/** The copy's file name: "<name> (copy).deck.md", then "<name> (copy 2).deck.md" and on, the first that is free. */
export function copyFileName(name: string, taken: (fileName: string) => boolean): string {
  for (let index = 1; ; index++) {
    const fileName = `${name} (${index === 1 ? 'copy' : `copy ${index}`}).deck.md`;
    if (!taken(fileName)) return fileName;
  }
}

/** An empty deck's file name: "Untitled.deck.md", then "Untitled 2.deck.md" and on, the first that is free. */
export function emptyFileName(taken: (fileName: string) => boolean): string {
  for (let index = 1; ; index++) {
    const fileName = index === 1 ? 'Untitled.deck.md' : `Untitled ${index}.deck.md`;
    if (!taken(fileName)) return fileName;
  }
}

/**
 * The copy's text: the deck as written, every byte, but for its relative paths when it lands in another folder (each
 * slide's picture, through the slide writer, and the links and pictures in the handout). The front matter's theme and
 * the `from:` lines are project paths and stay as they are.
 */
export function copiedDeckText(text: string, fromFolder: string, toFolder: string): string {
  if (fromFolder === toFolder) return text;
  // The library's own rebase of a slide (its picture through the slide writer) and of Markdown (links and pictures)
  const rebaseText = (markdown: string) => rebaseSlide('', markdown, fromFolder, toFolder).handout;
  const deck = parseDeck(text);
  let out = text.slice(0, deck.bodyStart);
  let at = deck.bodyStart;
  for (const slide of deck.slides) {
    out += rebaseText(text.slice(at, slide.start));
    const block = text.slice(slide.start, slide.end);
    const { body, handout } = rebaseSlide(slide.body, text.slice(slide.handoutStart, slide.handoutEnd), fromFolder, toFolder, slide.kind);
    const bodyAt = body === slide.body ? -1 : block.indexOf(slide.body);
    out += bodyAt < 0 ? block : block.slice(0, bodyAt) + body + block.slice(bodyAt + slide.body.length);
    out += text.slice(slide.end, slide.handoutStart) + handout;
    at = slide.handoutEnd;
  }
  return out + rebaseText(text.slice(at));
}

/** An earlier deck the start card offers to copy: its project path, name, folder and the day it was last changed. */
export interface EarlierDeck {
  path: string;
  name: string;
  /** The deck's folder in the project, or the project's name for a deck at its top. */
  folder: string;
  date: string;
}

/**
 * The start card's "Or copy an earlier deck": the project's decks newest first, each with its folder
 * (the project's name for one at its top) and the day it was last changed. The library's topics are left out, and so
 * is the deck the card is in (`self`, its project path).
 */
export function earlierDecks(decks: ReadonlyArray<{ path: string; modified: number }>, projectName: string, day: (modified: number) => string, self?: string): EarlierDeck[] {
  return decks
    .filter(deck => !isTopicPath(deck.path) && deck.path !== self)
    .slice()
    .sort((a, b) => b.modified - a.modified || a.path.localeCompare(b.path))
    .map(deck => ({ path: deck.path, name: deckFileName(deck.path), folder: folderOf(deck.path) || projectName, date: day(deck.modified) }));
}

/** What New → Deck needs from VS Code, passed in so the test runs the command's own steps (`decksHost.ts`). */
export interface NewDeckSteps {
  /** The folder the deck is made in, relative to the project ('' for its top). */
  toFolder: string;
  /** Is this file name taken in that folder: a file on disk, or a deck open in Ritemark whose file is gone. */
  taken: (fileName: string) => boolean;
  /** Write a new file by exclusive create, at its project path; throws when it exists or can't be written. */
  create: (relative: string, text: string) => Promise<void>;
  /** The deck is made: remember it as New's (its start card, its title selected), then open its tab. */
  made: (fileName: string) => Promise<void>;
  failed: (message: string) => void;
}

/**
 * Sprint 159 (Jarmo, 16 November: New → Deck "should open the Deck tab straight away, the same pattern as Text and
 * Table"): an empty deck, "Untitled.deck.md" or the next free "Untitled N.deck.md", made in the folder New was opened
 * from and opened at once. Nothing is asked first; a copy of an earlier deck is the start card's, in the deck. A file is
 * never written over: the create fails if the name was taken meanwhile, and the next free one is tried.
 */
export async function makeEmptyDeck(steps: NewDeckSteps, text = emptyDeckText()): Promise<string | null> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const fileName = emptyFileName(steps.taken);
    const relative = steps.toFolder ? `${steps.toFolder}/${fileName}` : fileName;
    try {
      await steps.create(relative, text);
    } catch (error) {
      if (steps.taken(fileName)) continue;
      steps.failed(`The deck could not be made: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
    await steps.made(fileName);
    return fileName;
  }
  steps.failed('The deck could not be made: every name tried was taken meanwhile.');
  return null;
}

/** What the start card's copy needs from VS Code (`decksHost.ts`), for the deck the card is in. */
export interface CopyDeckSteps {
  /** The deck's project path. */
  deck: string;
  /** An earlier deck's text, as Ritemark has it (an open deck's unsaved words included), or null when it is gone. */
  read: (relative: string) => Promise<string | null>;
  /** Is this file name taken in the deck's folder. */
  taken: (fileName: string) => boolean;
  /** Put this text in the deck in place of what it holds, and save it; false when that was refused. */
  replace: (text: string) => Promise<boolean>;
  /**
   * Rename the deck's file in its folder; its tab follows, and its bar says `line` once the renamed deck is shown. False
   * when that was refused.
   */
  rename: (fileName: string, line: string) => Promise<boolean>;
  /** A line for the deck's bar, in the tab it is in now. */
  notice: (text: string) => void;
}

/** The bar's line once the deck is a copy. */
export function copiedNotice(sourceName: string): string {
  return `This deck is now a copy of ${sourceName}.`;
}

/**
 * The start card's "Or copy an earlier deck": the deck becomes a copy of `source`, the same slides,
 * theme and look (its front matter is the source's), its relative paths rebased to this deck's folder, and its file is
 * renamed "<name> (copy)" as New → Deck's copies were (PR 7). Returns the new file name, or null when nothing changed.
 */
export async function copyEarlierDeck(source: string, steps: CopyDeckSteps): Promise<string | null> {
  const sourceName = deckFileName(source);
  const written = await steps.read(source);
  if (written === null) {
    steps.notice(`${sourceName} is no longer there.`);
    return null;
  }
  if (!(await steps.replace(copiedDeckText(written, folderOf(source), folderOf(steps.deck))))) {
    steps.notice(`This deck could not become a copy of ${sourceName}.`);
    return null;
  }
  const fileName = copyFileName(sourceName, steps.taken);
  if (await steps.rename(fileName, copiedNotice(sourceName))) return fileName;
  // Not renamed: the deck is the copy under its own name, and this tab's bar says so
  steps.notice(copiedNotice(sourceName));
  return steps.deck.slice(steps.deck.lastIndexOf('/') + 1);
}
