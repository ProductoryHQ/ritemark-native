/**
 * New → Deck (Sprint 159, PR 7; the Experience lead's quick pick): what a new deck holds, what a copy of an earlier
 * deck is called and holds, and the quick pick's rows. Pure: no `vscode`, so the test reads the same rules the command
 * uses (decksHost.ts).
 *
 *  - An empty deck is a title slide reading "The deck's title", in the built-in theme.
 *  - A copy is named "<deck name> (copy)" ("(copy 2)" and on when that is taken), in the folder New was opened from.
 *    It is the deck as written, notes included (it is the person's own deck); only its relative paths change when it
 *    lands in another folder, so its pictures and links still point where they did.
 *  - The quick pick lists "Empty deck" first, then the project's decks, newest first, each with its folder and date.
 *    The Slide library's topics are the library, not earlier decks, so they are left out.
 */

import { newId, parseDeck, parseSlideBody, writeScalar, writeSlideBody } from './deckFormat';
import { folderOf, newTopicText, partText, rebasePath, rewriteMarkdownTargets } from './deckLibraryFormat';
import { BUILT_IN_THEME_PATH } from './deckTheme';

/** The words an empty deck's title slide starts with, selected so they are typed over. */
export const EMPTY_DECK_TITLE = "The deck's title";

/** The library's folder (DeckLibrary's LIBRARY_FOLDER): its decks are topics, not earlier decks. */
const LIBRARY_FOLDER = 'Slide library';

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
  const rebase = (markdown: string) => rewriteMarkdownTargets(markdown, target => rebasePath(target, fromFolder, toFolder));
  const deck = parseDeck(text);
  let out = text.slice(0, deck.bodyStart);
  let at = deck.bodyStart;
  for (const slide of deck.slides) {
    out += rebase(text.slice(at, slide.start));
    const block = text.slice(slide.start, slide.end);
    const data = parseSlideBody(slide.body);
    const bodyAt = data.image ? block.indexOf(slide.body) : -1;
    out += bodyAt < 0 ? block
      : block.slice(0, bodyAt) + writeSlideBody(slide.body, { ...data, image: rebasePath(data.image ?? '', fromFolder, toFolder) }) + block.slice(bodyAt + slide.body.length);
    out += text.slice(slide.end, slide.handoutStart);
    out += rebase(text.slice(slide.handoutStart, slide.handoutEnd));
    at = slide.handoutEnd;
  }
  return out + rebase(text.slice(at));
}

/** A row of the quick pick: an empty deck, or a copy of a deck at its project path. */
export interface NewDeckChoice {
  label: string;
  description?: string;
  /** The deck to copy; none for an empty deck. */
  source?: string;
}

/**
 * The quick pick's rows: "Empty deck" first, then the project's decks newest first, each with its folder (the
 * project's name for one at its top) and the day it was last changed. The library's topics are left out.
 */
export function newDeckChoices(decks: ReadonlyArray<{ path: string; modified: number }>, projectName: string, day: (modified: number) => string): NewDeckChoice[] {
  const earlier = decks
    .filter(deck => deck.path !== LIBRARY_FOLDER && !deck.path.startsWith(`${LIBRARY_FOLDER}/`))
    .slice()
    .sort((a, b) => b.modified - a.modified || a.path.localeCompare(b.path));
  return [
    { label: 'Empty deck' },
    ...earlier.map(deck => ({ label: deckFileName(deck.path), description: `${folderOf(deck.path) || projectName} · ${day(deck.modified)}`, source: deck.path })),
  ];
}
