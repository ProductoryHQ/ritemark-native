/**
 * Sprint 165 PR 3 (#833, README "The library place, from first principles", item 4): the Slide library place's index of
 * the project's decks, and its search, which shows each slide once.
 *
 * - **The index** reads every deck once, then again only a deck that changed: one the host names (a file event, an
 *   edit in an open deck) or whose file time moved. "The same slide" (`sameSlide.ts`, rule G) is worked out again only
 *   after something changed. Big projects stay fast this way: typing in the search reads no file.
 * - **Search** looks through the library and every deck by title and words (each word typed, in any order). A slide in
 *   several decks shows once, at its newest copy, with how many other decks it is in. Library slides come first, at
 *   the library's copy. The open deck is no source: its slides give the tick instead (`inOpenDeck`).
 *
 * Pure and without `vscode`: the files come in through `DeckFiles`, as `DeckLibrary`'s do.
 */
import { compareDecks, deckSummaryOf, searchTerms, slideSearchText, type DeckFiles, type DeckSummary } from './DeckLibrary';

export { searchTerms };
import { slidesOfText } from './deckLibraryFormat';
import { sameSlides, slideWords, type SameSlides } from './sameSlide';

/** Search shows at most this many slides; the count says how many more there are. */
export const MAX_HITS = 60;
/** Decks read side by side at most, so a big project never opens hundreds of files at once. */
const READ_BATCH = 24;

/** A deck as the index keeps it. */
export interface IndexedDeck {
  /** Every slide, with the deck's Agenda: what the place draws. */
  summary: DeckSummary;
  /** Per slide: what search looks through, lower case (`slideSearchText`). */
  search: string[];
  /** Per slide: its title, lower case. */
  titles: string[];
  /** Per slide: its words for "the same slide" (`slideWords`). */
  words: string[][];
}

/** A slide's key in the index and in the place's ticks: `<deck path>#<its index in the deck>`. */
export function slideKey(path: string, index: number): string {
  return `${path}#${index}`;
}

function keyParts(key: string): { path: string; index: number } {
  const cut = key.lastIndexOf('#');
  return { path: key.slice(0, cut), index: Number(key.slice(cut + 1)) };
}

/** A deck's entry from its text. */
export function indexDeck(file: { path: string; modified: number }, text: string): IndexedDeck {
  const slides = slidesOfText(text);
  return {
    summary: deckSummaryOf(file, text, slides, { agenda: true }),
    search: slides.map(slideSearchText),
    titles: slides.map(slide => (typeof slide.data.title === 'string' ? slide.data.title.toLowerCase() : '')),
    words: slides.map(slide => slideWords(slide.kind, slide.data)),
  };
}

export class DeckIndex {
  private readonly entries = new Map<string, IndexedDeck>();
  /** Decks to read again at the next update, by path; `everything` reads them all (nothing read yet). */
  private stale = new Set<string>();
  private everything = true;
  /** Counts the changes, so "the same slide" is worked out again only after one. */
  private version = 0;
  private grouped: { version: number; same: SameSlides } | null = null;
  private running: Promise<IndexedDeck[]> | null = null;
  /** The last listing of the project's deck files, reused by a search while no change was named since. */
  private listed: Array<{ path: string; modified: number }> | null = null;

  constructor(private readonly files: Pick<DeckFiles, 'list' | 'read'>) {}

  /** A deck changed (its file, or an open deck's text): it is read again at the next update. No path: every deck. */
  invalidate(path?: string): void {
    if (path === undefined) this.everything = true;
    else this.stale.add(path);
    this.listed = null;
  }

  /**
   * The project's decks in the listing's order, brought up to date. One update runs at a time. `listAgain: false` (a
   * search typed) lists the files again only when a change was named since the last listing: the watcher names every
   * change, so typing touches no file at all.
   */
  async decks(options: { listAgain?: boolean } = {}): Promise<IndexedDeck[]> {
    while (this.running) await this.running.catch(() => undefined);
    const running = this.update(options.listAgain ?? true);
    this.running = running;
    try {
      return await running;
    } finally {
      if (this.running === running) this.running = null;
    }
  }

  /** Sprint 165 PR 4: does the index hold a deck inside this project-relative folder (a folder deleted at once)? */
  holdsUnder(folder: string): boolean {
    const prefix = `${folder.replace(/\/+$/, '')}/`;
    for (const path of this.entries.keys()) if (path.startsWith(prefix)) return true;
    return false;
  }

  /** "The same slide" over every slide of every deck, as of the last update. */
  same(): SameSlides {
    if (!this.grouped || this.grouped.version !== this.version) {
      const slides = [...this.entries.values()].flatMap(deck =>
        deck.summary.slides.map((slide, at) => ({ key: slideKey(deck.summary.path, slide.index), path: deck.summary.path, id: slide.id, from: slide.data.from, words: deck.words[at] })),
      );
      this.grouped = { version: this.version, same: sameSlides(slides) };
    }
    return this.grouped.same;
  }

  private async update(listAgain: boolean): Promise<IndexedDeck[]> {
    // Taken at the start: a change named while this update reads is read at the next one.
    const stale = this.stale;
    const everything = this.everything;
    this.stale = new Set();
    this.everything = false;
    try {
      const listed = !listAgain && this.listed && !everything && !stale.size ? this.listed : await this.files.list();
      this.listed = listed;
      let changed = false;
      const present = new Set(listed.map(file => file.path));
      for (const path of [...this.entries.keys()]) {
        if (!present.has(path)) {
          this.entries.delete(path);
          changed = true;
        }
      }
      const wanted = listed.filter(file => everything || stale.has(file.path) || this.entries.get(file.path)?.summary.modified !== file.modified);
      for (let at = 0; at < wanted.length; at += READ_BATCH) {
        const batch = wanted.slice(at, at + READ_BATCH);
        const texts = await Promise.all(batch.map(file => this.files.read(file.path)));
        batch.forEach((file, index) => {
          const text = texts[index];
          if (text === null) {
            if (this.entries.delete(file.path)) changed = true;
            return;
          }
          this.entries.set(file.path, indexDeck(file, text));
          changed = true;
        });
      }
      if (changed) this.version++;
      return [...this.entries.values()].sort((a, b) => compareDecks(a.summary, b.summary));
    } catch (error) {
      // Nothing is lost: what was to be read is read next time.
      for (const path of stale) this.stale.add(path);
      if (everything) this.everything = true;
      throw error;
    }
  }
}

/** One slide search shows: the copy shown, and how many other decks have the same slide. */
export interface LibraryHit {
  /** The copy shown: its deck and its place in it. */
  path: string;
  index: number;
  /**
   * The other decks the same slide is in, the open deck left out (it has the tick). For a slide from other decks every
   * one is older; a library slide's copies can be newer than its topic.
   */
  also: number;
  /** The copy shown is the library's (a topic's). */
  library: boolean;
}

/**
 * Search: every slide whose words and handout hold each word typed, once per same slide. The open deck (`active`) is no
 * source. Order: library slides first, then slides whose title has the words, then the newest. `total` counts them
 * all; `hits` keeps the first `limit`.
 */
export function searchLibrary(
  decks: readonly IndexedDeck[],
  same: SameSlides,
  query: string,
  options: { active?: string | null; limit?: number } = {},
): { hits: LibraryHit[]; total: number } {
  const terms = searchTerms(query);
  if (!terms.length) return { hits: [], total: 0 };
  const active = options.active ?? null;
  const byPath = new Map(decks.map(deck => [deck.summary.path, deck]));
  // The groups found, each with whether a found slide's title has the words.
  const found = new Map<string, boolean>();
  for (const deck of decks) {
    const path = deck.summary.path;
    if (path === active) continue;
    deck.search.forEach((text, at) => {
      if (!terms.every(term => text.includes(term))) return;
      const key = slideKey(path, deck.summary.slides[at].index);
      const group = same.groupOf(key) ?? key;
      const inTitle = terms.every(term => deck.titles[at].includes(term));
      found.set(group, (found.get(group) ?? false) || inTitle);
    });
  }
  const ranked = [...found].flatMap(([group, inTitle]) => {
    const members = (same.membersOf(group).length ? same.membersOf(group) : [group]).map(keyParts);
    const sources = members.filter(member => member.path !== active && byPath.has(member.path));
    // A grouping out of step with the decks given (a deck gone since): only what is still there.
    if (!sources.length) return [];
    const library = sources.filter(member => byPath.get(member.path)!.summary.topic);
    const newest = (list: typeof sources) => list.reduce((best, next) => {
      const a = byPath.get(best.path)!.summary.modified;
      const b = byPath.get(next.path)!.summary.modified;
      return b > a || (b === a && (next.path < best.path || (next.path === best.path && next.index < best.index))) ? next : best;
    });
    const shown = newest(library.length ? library : sources);
    const others = new Set(members.map(member => member.path));
    others.delete(shown.path);
    if (active) others.delete(active);
    return [{
      hit: { path: shown.path, index: shown.index, also: others.size, library: library.length > 0 },
      inTitle,
      modified: byPath.get(shown.path)!.summary.modified,
    }];
  });
  ranked.sort((a, b) =>
    Number(b.hit.library) - Number(a.hit.library)
    || Number(b.inTitle) - Number(a.inTitle)
    || b.modified - a.modified
    || (a.hit.path < b.hit.path ? -1 : a.hit.path > b.hit.path ? 1 : 0)
    || a.hit.index - b.hit.index);
  return { hits: ranked.slice(0, options.limit ?? MAX_HITS).map(entry => entry.hit), total: ranked.length };
}

/** Search's Decks group shows at most this many decks; the count says how many more there are. */
export const MAX_NAMED_DECKS = 8;

/**
 * The words of a deck's place, lower case: its folders' and its own name's, for the Decks group. A topic's are its name
 * alone: "Slide library" is the library, so "slide" or "library" doesn't list every topic.
 */
function placeWords(deck: DeckSummary): string[] {
  const place = deck.topic ? deck.name : deck.path.replace(/\.deck\.md$/i, '');
  return place.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Search's Decks group (the Experience lead on #877): the decks whose folder or name has each word typed at the start
 * of one of its words ("Harbour" or "harb" finds the decks in Harbour Logistics; "3" finds "Context 3", not "2023"),
 * whole, in the listing's order, the open deck left out. A deck's name matching never lists its slides as hits: its
 * row shows instead, closed.
 */
export function namedDecks(decks: readonly IndexedDeck[], query: string, options: { active?: string | null; limit?: number } = {}): { decks: DeckSummary[]; total: number } {
  const terms = searchTerms(query).map(term => term.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
  if (!terms.length) return { decks: [], total: 0 };
  const found = decks.filter(deck => {
    if (deck.summary.path === options.active) return false;
    const words = placeWords(deck.summary);
    return terms.every(term => words.some(word => word.startsWith(term)));
  });
  return { decks: found.slice(0, options.limit ?? MAX_NAMED_DECKS).map(deck => deck.summary), total: found.length };
}

/** The decks search shows, each with only the slides it shows (in their deck's order) and its Agenda. */
export function hitDecks(decks: readonly IndexedDeck[], hits: readonly LibraryHit[]): DeckSummary[] {
  const wanted = new Map<string, Set<number>>();
  for (const hit of hits) {
    const set = wanted.get(hit.path) ?? new Set<number>();
    set.add(hit.index);
    wanted.set(hit.path, set);
  }
  return decks.flatMap(deck => {
    const set = wanted.get(deck.summary.path);
    return set ? [{ ...deck.summary, slides: deck.summary.slides.filter(slide => set.has(slide.index)) }] : [];
  });
}

/**
 * The tick: the slides of other decks (`slideKey`s) whose copy is already in the open deck, by "the same slide". The
 * open deck's own slides are left out.
 */
export function inOpenDeck(decks: readonly IndexedDeck[], same: SameSlides, active: string | null | undefined): string[] {
  const deck = active ? decks.find(entry => entry.summary.path === active) : undefined;
  if (!deck) return [];
  const groups = new Set(deck.summary.slides.map(slide => same.groupOf(slideKey(deck.summary.path, slide.index))).filter((group): group is string => !!group));
  const keys: string[] = [];
  for (const group of groups) {
    for (const key of same.membersOf(group)) if (keyParts(key).path !== active) keys.push(key);
  }
  return keys;
}
