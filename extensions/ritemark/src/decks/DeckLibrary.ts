/**
 * The Slide library and the project's decks (Sprint 157, README frames 3 and 4). No `vscode`: the files come in
 * through `DeckFiles`, so the tests drive the same code with a map, and the editor writes through an open document
 * (the user's unsaved changes kept) where there is one.
 *
 * The library is the folder `Slide library` at the project's top, one `.deck.md` per topic. A slide taken from it, or
 * from any other deck, is a copy carrying `from: <path>#<id> @<stamp>`. The UI and the AI's tools call the same
 * operations here (README decision 9, dual use).
 */
import { newId, parseFrom, parseSlideBody, writeFrom, writeSlideBody, type SlideData } from './deckFormat';
import {
  appendPart, folderOf, newTopicText, partText, rebaseSlide, replaceSlidePart, slideStamp, slidesOfText,
  type DeckSlideText,
} from './deckLibraryFormat';
import { BUILT_IN_THEME_PATH, BUILT_IN_THEME_TEXT } from './deckTheme';

export const LIBRARY_FOLDER = 'Slide library';

/** The project's deck files, by project-relative path (`/` separated). */
export interface DeckFiles {
  /** Every `.deck.md` in the project. */
  list(): Promise<Array<{ path: string; modified: number }>>;
  /** A file's text (an open document's, unsaved changes included), or null. */
  read(path: string): Promise<string | null>;
  /** Write a file's text; `create` only when it doesn't exist yet. */
  write(path: string, text: string, options?: { create?: boolean }): Promise<void>;
}

/** A topic is a deck directly in the Slide library folder. */
export function isTopicPath(path: string): boolean {
  return path.startsWith(`${LIBRARY_FOLDER}/`) && !path.slice(LIBRARY_FOLDER.length + 1).includes('/') && /\.deck\.md$/i.test(path);
}

/** A deck's name: its file name without `.deck.md`. */
export function deckName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.deck\.md$/i, '');
}

export interface SlideSummary {
  index: number;
  id?: string;
  kind: string;
  data: SlideData;
  /** The first words of its handout, for search and the AI. */
  handout: string;
  hasNotes: boolean;
}

export interface DeckSummary {
  path: string;
  name: string;
  topic: boolean;
  theme: string | null;
  modified: number;
  slides: SlideSummary[];
}

/** What a copy shows under it: where it came from, and whether it or the source changed since. */
export interface SourceState {
  id: string;
  /** The source is a topic of the library (else another deck). */
  library: boolean;
  sourceName: string;
  sourcePath: string;
  /** The copy differs from what it was copied as. */
  changed: boolean;
  /** The source differs from what the copy was copied from. */
  newer: boolean;
  /** The source deck or its slide is gone. */
  missing: boolean;
}

/** A part to put into a deck: its block's kind and body (with its `from:` line and new id), and its handout. */
export interface CopiedPart {
  kind: string;
  body: string;
  handout: string;
}

/** A library write and what the file held before it, so the person's Undo can put it back. */
export interface LibraryWrite {
  /** The copy's new `from:` line. */
  from: string;
  path: string;
  previous: string | null;
  written: string;
}

const words = (slide: DeckSlideText) => [
  slide.data.title, slide.data.subtitle, ...(slide.data.items ?? []).flatMap(item => [item.heading, item.text]),
  ...(slide.data.rows ?? []).flat(), slide.handout,
].filter(Boolean).join(' ').toLowerCase();

export class DeckLibrary {
  constructor(private readonly files: DeckFiles) {}

  /** The project's decks: the library's topics first, then the other decks, newest first; filtered by `query`. */
  async listDecks(options: { where?: 'library' | 'other' | 'all'; query?: string } = {}): Promise<DeckSummary[]> {
    const where = options.where ?? 'all';
    const query = (options.query ?? '').trim().toLowerCase();
    const found: DeckSummary[] = [];
    for (const file of await this.files.list()) {
      const topic = isTopicPath(file.path);
      if (where === 'library' && !topic) continue;
      if (where === 'other' && topic) continue;
      const text = await this.files.read(file.path);
      if (text === null) continue;
      const slides = slidesOfText(text);
      const hits = query ? slides.filter(slide => words(slide).includes(query) || deckName(file.path).toLowerCase().includes(query)) : slides;
      if (query && hits.length === 0) continue;
      const theme = /^---[\s\S]*?\ntheme:\s*(.+)\n[\s\S]*?---/.exec(text)?.[1]?.trim() ?? null;
      found.push({
        path: file.path,
        name: deckName(file.path),
        topic,
        theme,
        modified: file.modified,
        slides: hits.map(slide => ({
          index: slide.index,
          id: slide.data.id,
          kind: slide.kind,
          data: slide.data,
          handout: slide.handout.slice(0, 400),
          hasNotes: slide.notes !== null,
        })),
      });
    }
    return found.sort((a, b) => (a.topic === b.topic ? (a.topic ? a.name.localeCompare(b.name) : b.modified - a.modified) : a.topic ? -1 : 1));
  }

  /** A deck's slides as written. */
  async readDeck(path: string): Promise<DeckSlideText[] | null> {
    const text = await this.files.read(path);
    return text === null ? null : slidesOfText(text);
  }

  /**
   * Copies of slides `ids` of `sourcePath`, for the deck at `targetPath` (whose ids are `taken`): each with a new id
   * and the `from:` line, its handout, picture and links rebased into the target's folder, and never its notes.
   */
  async copies(sourcePath: string, ids: string[], targetPath: string, taken: string[]): Promise<CopiedPart[]> {
    const slides = await this.readDeck(sourcePath);
    if (!slides) throw new Error(`No deck at ${sourcePath}.`);
    const used = new Set(taken);
    const sourceFolder = folderOf(sourcePath);
    const targetFolder = folderOf(targetPath);
    return ids.map(id => {
      const slide = slides.find(entry => entry.data.id === id);
      if (!slide) throw new Error(`${deckName(sourcePath)} has no slide ${id}.`);
      const stamp = slideStamp(slide.kind, slide.data, slide.handout, sourceFolder);
      const copyId = newId(used);
      used.add(copyId);
      const data: SlideData = { ...slide.data, id: copyId, from: writeFrom({ path: sourcePath, id, stamp }), kept: undefined };
      const rebased = rebaseSlide(writeSlideBody(slide.body, data), slide.handout, sourceFolder, targetFolder);
      return { kind: slide.kind, body: rebased.body, handout: rebased.handout };
    });
  }

  /** What each copy of the deck at `deckPath` shows under it. */
  async sourceStates(deckPath: string, copies: Array<{ id: string; from: string; kind: string; body: string; handout: string }>): Promise<SourceState[]> {
    const folder = folderOf(deckPath);
    const cache = new Map<string, DeckSlideText[] | null>();
    const states: SourceState[] = [];
    for (const copy of copies) {
      const source = parseFrom(copy.from);
      if (!source) continue;
      if (!cache.has(source.path)) cache.set(source.path, await this.readDeck(source.path));
      const slide = cache.get(source.path)?.find(entry => entry.data.id === source.id);
      const copyStamp = slideStamp(copy.kind, parseSlideBody(copy.body), copy.handout, folder);
      const sourceStamp = slide ? slideStamp(slide.kind, slide.data, slide.handout, folderOf(source.path)) : null;
      states.push({
        id: copy.id,
        library: isTopicPath(source.path),
        sourceName: deckName(source.path),
        sourcePath: source.path,
        changed: source.stamp !== null && copyStamp !== source.stamp,
        newer: sourceStamp !== null && source.stamp !== null && sourceStamp !== source.stamp,
        missing: !slide,
      });
    }
    return states;
  }

  /**
   * Update the library: the copy's slide and handout written over its source slide, by id, every other byte of the
   * topic as it was (README decision 3: only this button changes the library). Returns the copy's new `from:`.
   */
  async updateLibrarySlide(deckPath: string, copy: CopiedPart): Promise<LibraryWrite> {
    const data = parseSlideBody(copy.body);
    const source = parseFrom(data.from);
    if (!source) throw new Error('This slide is no copy.');
    const previous = await this.files.read(source.path);
    if (previous === null) throw new Error(`${deckName(source.path)} is no longer there.`);
    const { body, handout } = this.asSourcePart(copy, source.id, deckPath, source.path);
    const written = replaceSlidePart(previous, source.id, partText(copy.kind, body, handout));
    if (written === null) throw new Error(`${deckName(source.path)} no longer has that slide.`);
    await this.files.write(source.path, written);
    const stamp = slideStamp(copy.kind, parseSlideBody(body), handout, folderOf(source.path));
    return { from: writeFrom({ path: source.path, id: source.id, stamp }), path: source.path, previous, written };
  }

  /** Use it: the source's slide and handout as a part for the copy (its id kept), with a fresh `from:` stamp. */
  async useSource(deckPath: string, copyBody: string): Promise<CopiedPart> {
    const data = parseSlideBody(copyBody);
    const source = parseFrom(data.from);
    if (!source || !data.id) throw new Error('This slide is no copy.');
    const slides = await this.readDeck(source.path);
    const slide = slides?.find(entry => entry.data.id === source.id);
    if (!slide) throw new Error(`${deckName(source.path)} no longer has that slide.`);
    const stamp = slideStamp(slide.kind, slide.data, slide.handout, folderOf(source.path));
    const next: SlideData = { ...slide.data, id: data.id, from: writeFrom({ path: source.path, id: source.id, stamp }), kept: undefined, skip: data.skip };
    const rebased = rebaseSlide(writeSlideBody(slide.body, next), slide.handout, folderOf(source.path), folderOf(deckPath));
    return { kind: slide.kind, body: rebased.body, handout: rebased.handout };
  }

  /**
   * Add to library: the slide appended to a topic (made when `topic` names a new one), with a new id there; the
   * built-in theme's file is written first when the project has none. Returns the copy's new `from:`.
   */
  async addToLibrary(deckPath: string, topic: string, copy: CopiedPart): Promise<LibraryWrite> {
    const path = isTopicPath(topic) ? topic : `${LIBRARY_FOLDER}/${topic.replace(/[\\/:*?"<>|]+/g, ' ').trim()}.deck.md`;
    if (!isTopicPath(path)) throw new Error('A topic needs a name.');
    const previous = await this.files.read(path);
    const taken = previous ? slidesOfText(previous).map(slide => slide.data.id).filter((id): id is string => !!id) : [];
    const id = newId(taken);
    const { body, handout } = this.asSourcePart(copy, id, deckPath, path);
    const part = partText(copy.kind, body, handout);
    if ((await this.files.read(BUILT_IN_THEME_PATH)) === null) {
      try {
        await this.files.write(BUILT_IN_THEME_PATH, BUILT_IN_THEME_TEXT, { create: true });
      } catch {
        // Made meanwhile: it is there, which is all that is needed.
      }
    }
    const written = previous === null ? newTopicText(BUILT_IN_THEME_PATH, part) : appendPart(previous, part);
    await this.files.write(path, written, { create: previous === null });
    const stamp = slideStamp(copy.kind, parseSlideBody(body), handout, folderOf(path));
    return { from: writeFrom({ path, id, stamp }), path, previous, written };
  }

  /** Undo a library write: the file's text before it, when nothing changed it since. */
  async undoWrite(write: LibraryWrite): Promise<boolean> {
    const now = await this.files.read(write.path);
    if (now !== write.written || write.previous === null) return false;
    await this.files.write(write.path, write.previous);
    return true;
  }

  /** A copy's slide as the library keeps it: the given id, no `from:`, `kept` or `skip`, paths in its folder. */
  private asSourcePart(copy: CopiedPart, id: string, deckPath: string, sourcePath: string): { body: string; handout: string } {
    const data = parseSlideBody(copy.body);
    const body = writeSlideBody(copy.body, { ...data, id, from: undefined, kept: undefined, skip: undefined });
    return rebaseSlide(body, copy.handout, folderOf(deckPath), folderOf(sourcePath));
  }
}
