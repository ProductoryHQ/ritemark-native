/**
 * The Slide library and the project's decks (Sprint 157, README frames 3 and 4). No `vscode`: the files come in
 * through `DeckFiles`, so the tests drive the same code with a map, and the editor writes through an open document
 * (the user's unsaved changes kept) where there is one.
 *
 * The library is the folder `Slide library` at the project's top, one `.deck.md` per topic. A slide taken from it, or
 * from any other deck, is a copy carrying `from: <path>#<id> @<stamp>`. The UI and the AI's tools call the same
 * operations here (README decision 9, dual use).
 */
import { deckVersionOf, exerciseTagOf, frontMatterField, isBlockSlide, isReadableDeckVersion, newId, parseFrom, slideDataOf, withPartHeading, withWrittenHandout, writeFrom, writeSlideData, type SlideData } from './deckFormat';
import {
  appendPart, folderOf, insertPartsText, newTopicText, normalizePath, partText, rebaseSlide, replaceSlidePart, slideStamp, slideStamps,
  slidesOfText, type DeckSlideText,
} from './deckLibraryFormat';
import { BUILT_IN_THEME_PATH, BUILT_IN_THEME_TEXT } from './deckTheme';
import { convertedPart, saysBlockDeck, withDeckVersion } from './blocks/convertDeck';
import { agendaOf, blockStepsTagOf } from './blocks/slideRenderer';
import type { AgendaEntry } from './blocks/agenda';

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
  /** The deck's look: its slides drawn as cards, or borderless. */
  borderless: boolean;
  modified: number;
  slides: SlideSummary[];
  /** Small details 14: the deck's sections, from all its slides (a search lists only some), for an Agenda's tile; only
   *  when `listDecks` is asked for it (the Slide library view). */
  agenda?: AgendaEntry[];
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

/**
 * Where a copy came from, when its `from:` names a deck inside the project. A deck from someone else can carry any
 * `from:`, so a source that isn't a `.deck.md` is no source: nothing reads or writes it.
 */
function sourceOf(from: string | undefined): { path: string; id: string; stamp: string | null } | null {
  const source = parseFrom(from);
  if (!source || !/\.deck\.md$/i.test(source.path) || normalizePath(source.path) !== source.path) return null;
  return source;
}

const words = (slide: DeckSlideText) => [
  slide.data.title, slide.data.subtitle, slide.kind === 'exercise' ? exerciseTagOf(slide.data) : undefined, ...(slide.data.items ?? []).flatMap(item => [item.heading, item.text]),
  // A block slide's Steps pill, as it draws it ("Exercise" for one with no label).
  ...(slide.data.markdown !== undefined ? [blockStepsTagOf(slide.data.markdown) ?? undefined] : []),
  ...(slide.data.rows ?? []).flat(), slide.data.markdown, slide.handout,
].filter(Boolean).join(' ').toLowerCase();

/**
 * Sprint 159 (PR 2): a deck file this build may change. A deck whose front matter names a later `deck:` version (a
 * newer Ritemark wrote it) opens as a document and is never rewritten in this build's format: the library, the AI's
 * tools and the buttons refuse to write it, as the editor does.
 */
function writableDeckText(path: string, text: string): string {
  if (!isReadableDeckVersion(deckVersionOf(text))) {
    throw new Error(`${deckName(path)} is written in a newer deck format than this Ritemark reads, so it isn't changed.`);
  }
  return text;
}

/**
 * Sprint 161: a deck the host writes a block slide into says `deck: 2` (an older Ritemark then opens it as a document
 * and never rewrites it). Since PR 2 the host's writes convert the parts they write (`convertedPart`), so a deck written
 * before gets the line with its first block slide; its other slides stay as they are, which is legal (a mixed deck).
 */
function asBlockDeck(text: string, kinds: string[]): string {
  if (!kinds.some(isBlockSlide) || saysBlockDeck(deckVersionOf(text))) return text;
  return withDeckVersion(text, 2);
}

export class DeckLibrary {
  constructor(private readonly files: DeckFiles) {}

  /** The project's decks: the library's topics first, then the other decks, newest first; filtered by `query`. */
  async listDecks(options: { where?: 'library' | 'other' | 'all'; query?: string; agenda?: boolean } = {}): Promise<DeckSummary[]> {
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
      const frontMatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
      // Read as the deck view and the Theme menu read it (Sprint 162): its quotes taken off, so the path is the file's.
      const theme = frontMatterField(text.replace(/^\uFEFF/, ''), 'theme')?.trim() || null;
      const borderless = /^look:\s*borderless\s*$/m.test(frontMatter);
      found.push({
        path: file.path,
        name: deckName(file.path),
        topic,
        theme,
        borderless,
        modified: file.modified,
        slides: hits.map(slide => ({
          index: slide.index,
          id: slide.data.id,
          kind: slide.kind,
          data: slide.data,
          handout: slide.handout.slice(0, 400),
          hasNotes: slide.notes !== null,
        })),
        ...(options.agenda ? { agenda: agendaOf(slides.map(slide => ({ kind: slide.kind, data: slide.data, number: slide.index + 1 }))) } : {}),
      });
    }
    return found.sort((a, b) => (a.topic === b.topic ? (a.topic ? a.name.localeCompare(b.name) : b.modified - a.modified) : a.topic ? -1 : 1));
  }

  /**
   * Sprint 162: each of the project's decks' `theme:` value (null for a deck without one), read from its front matter
   * only, for the Theme menu's "N decks". An open deck's unsaved text counts, as everywhere in the library.
   */
  async deckThemes(): Promise<Array<string | null>> {
    return (await this.deckThemeList()).map(deck => deck.theme);
  }

  /**
   * Sprint 162 PR 2: each of the project's decks, by path, with its `theme:` value (null for none): which decks a theme's
   * tab says use it, and which deck it previews. Each deck's text with it (an open deck's unsaved text).
   */
  async deckThemeList(): Promise<Array<{ path: string; theme: string | null; text: string; modified: number }>> {
    // Read side by side: the menu waits on them each time it opens.
    const files = await this.files.list();
    const texts = await Promise.all(files.map(file => this.files.read(file.path)));
    return files.flatMap((file, index) => {
      const text = texts[index];
      return text === null ? [] : [{ path: file.path, theme: frontMatterField(text.replace(/^\uFEFF/, ''), 'theme'), text, modified: file.modified }];
    });
  }

  /** Sprint 162 PR 2: a deck's text (an open deck's unsaved text), or null. */
  readDeckText(path: string): Promise<string | null> {
    return this.files.read(path);
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
      const rebased = rebaseSlide(writeSlideData(slide.kind, slide.body, data), slide.handout, sourceFolder, targetFolder, slide.kind);
      // Sprint 161 (PR 2): a copy goes in as a block slide; the words its old layout hid are a comment in its handout.
      return convertedPart({ kind: slide.kind, body: rebased.body, handout: rebased.handout }, targetFolder);
    });
  }

  /**
   * Insert copies of slides `ids` of `sourcePath` into the deck at `targetPath`, after its slide `after` (a number from
   * 1; 0 is before the first; left out, at the end). When the deck is open, `intoView` puts them in through its view, as
   * one undo step there; otherwise the file is written. Returns the new slides' numbers.
   */
  async insertCopies(
    sourcePath: string,
    ids: string[],
    targetPath: string,
    after: number | undefined,
    intoView?: (parts: CopiedPart[], afterIndex: number) => Promise<boolean>,
  ): Promise<{ first: number; count: number }> {
    if (!/\.deck\.md$/i.test(targetPath) || normalizePath(targetPath) !== targetPath) throw new Error(`${targetPath} is no deck in this project.`);
    const read = await this.files.read(targetPath);
    if (read === null) throw new Error(`No deck at ${targetPath}.`);
    const text = writableDeckText(targetPath, read);
    const slides = slidesOfText(text);
    const taken = slides.map(slide => slide.data.id).filter((id): id is string => !!id);
    const parts = await this.copies(sourcePath, ids, targetPath, taken);
    const at = Math.max(0, Math.min(slides.length, after ?? slides.length));
    if (intoView) {
      // An open deck takes them only through its view: its file is never written under the person's typing.
      if (!(await intoView(parts, at - 1))) throw new Error(`${deckName(targetPath)} is open but didn't take the slides. Nothing was inserted; try again.`);
    } else {
      // Making a part writes its heading (16 November), as the deck view does: the copy's handout opens with its heading.
      // A deck written before that gets its other parts' headings and its `handout: text` mark with it, as the view's
      // first edit writes them, so none of its parts goes without the heading it showed.
      const written = parts.map(part => partText(part.kind, part.body, withPartHeading(part.kind, slideDataOf(part.kind, part.body), part.handout)));
      await this.files.write(targetPath, insertPartsText(asBlockDeck(withWrittenHandout(text), parts.map(part => part.kind)), at, written));
    }
    return { first: at + 1, count: parts.length };
  }

  /** What each copy of the deck at `deckPath` shows under it. */
  async sourceStates(deckPath: string, copies: Array<{ id: string; from: string; kind: string; body: string; handout: string }>): Promise<SourceState[]> {
    const folder = folderOf(deckPath);
    const cache = new Map<string, DeckSlideText[] | null>();
    const states: SourceState[] = [];
    for (const copy of copies) {
      const source = sourceOf(copy.from);
      if (!source) continue;
      if (!cache.has(source.path)) cache.set(source.path, await this.readDeck(source.path));
      const slide = cache.get(source.path)?.find(entry => entry.data.id === source.id);
      // A from: line written before 16 November counted the part's heading: either stamp is the slide as it was.
      const copyStamps = slideStamps(copy.kind, slideDataOf(copy.kind, copy.body), copy.handout, folder);
      const sourceStamps = slide ? slideStamps(slide.kind, slide.data, slide.handout, folderOf(source.path)) : null;
      states.push({
        id: copy.id,
        library: isTopicPath(source.path),
        sourceName: deckName(source.path),
        sourcePath: source.path,
        // A copy that reads as its source, heading aside, is neither changed nor behind (Codex on #750: a heading-only
        // edit under a from: stamp that counted the old heading matched neither stamp).
        changed: source.stamp !== null && !copyStamps.includes(source.stamp) && copyStamps[0] !== sourceStamps?.[0],
        newer: sourceStamps !== null && source.stamp !== null && !sourceStamps.includes(source.stamp) && sourceStamps[0] !== copyStamps[0],
        missing: !slide,
      });
    }
    return states;
  }

  /**
   * Update the library: the copy's slide and handout written over its source slide, by id, every other byte of the
   * topic as it was (README decision 3: only this button changes the library). Returns the copy's new `from:`.
   */
  async updateLibrarySlide(deckPath: string, written: CopiedPart): Promise<LibraryWrite> {
    // Sprint 161 (PR 2): the library gets the copy as a block slide, as every write does from now on.
    const copy = convertedPart(written, folderOf(deckPath));
    const data = slideDataOf(copy.kind, copy.body);
    const source = sourceOf(data.from);
    if (!source) throw new Error('This slide is no copy of a deck in this project.');
    const previous = await this.files.read(source.path);
    if (previous === null) throw new Error(`${deckName(source.path)} is no longer there.`);
    writableDeckText(source.path, previous);
    const { body, handout } = this.asSourcePart(copy, source.id, deckPath, source.path);
    const text = replaceSlidePart(asBlockDeck(previous, [copy.kind]), source.id, partText(copy.kind, body, handout));
    if (text === null) throw new Error(`${deckName(source.path)} no longer has that slide.`);
    await this.files.write(source.path, text);
    const stamp = slideStamp(copy.kind, slideDataOf(copy.kind, body), handout, folderOf(source.path));
    return { from: writeFrom({ path: source.path, id: source.id, stamp }), path: source.path, previous, written: text };
  }

  /** Use it: the source's slide and handout as a part for the copy (its id kept), with a fresh `from:` stamp. */
  async useSource(deckPath: string, copyBody: string, copyKind: string): Promise<CopiedPart> {
    const data = slideDataOf(copyKind, copyBody);
    const source = sourceOf(data.from);
    if (!source || !data.id) throw new Error('This slide is no copy of a deck in this project.');
    const slides = await this.readDeck(source.path);
    const slide = slides?.find(entry => entry.data.id === source.id);
    if (!slide) throw new Error(`${deckName(source.path)} no longer has that slide.`);
    const stamp = slideStamp(slide.kind, slide.data, slide.handout, folderOf(source.path));
    const next: SlideData = { ...slide.data, id: data.id, from: writeFrom({ path: source.path, id: source.id, stamp }), kept: undefined, skip: data.skip };
    const rebased = rebaseSlide(writeSlideData(slide.kind, slide.body, next), slide.handout, folderOf(source.path), folderOf(deckPath), slide.kind);
    // As a block slide (Sprint 161, PR 2): the deck view takes it in one step, which converts the deck too.
    return convertedPart({ kind: slide.kind, body: rebased.body, handout: rebased.handout }, folderOf(deckPath));
  }

  /**
   * Add to library: the slide appended to a topic (made when `topic` names a new one), with a new id there; the
   * built-in theme's file is written first when the project has none. Returns the copy's new `from:`.
   */
  async addToLibrary(deckPath: string, topic: string, given: CopiedPart): Promise<LibraryWrite> {
    // Sprint 161 (PR 2): the library gets the slide as a block slide.
    const copy = convertedPart(given, folderOf(deckPath));
    const path = isTopicPath(topic) ? topic : `${LIBRARY_FOLDER}/${topic.replace(/[\\/:*?"<>|]+/g, ' ').trim()}.deck.md`;
    if (!isTopicPath(path)) throw new Error('A topic needs a name.');
    const previous = await this.files.read(path);
    if (previous !== null) writableDeckText(path, previous);
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
    const written = previous === null ? newTopicText(BUILT_IN_THEME_PATH, part, isBlockSlide(copy.kind)) : appendPart(asBlockDeck(previous, [copy.kind]), part);
    await this.files.write(path, written, { create: previous === null });
    const stamp = slideStamp(copy.kind, slideDataOf(copy.kind, body), handout, folderOf(path));
    return { from: writeFrom({ path, id, stamp }), path, previous, written };
  }

  /** The deck's slide `id` as written, for the AI's library tools (they name a slide, the buttons send its text). */
  async slideOf(deckPath: string, id: string): Promise<CopiedPart & { from?: string }> {
    const slide = (await this.readDeck(deckPath))?.find(entry => entry.data.id === id);
    if (!slide) throw new Error(`${deckName(deckPath)} has no slide ${id}. Use read_deck to see its slides' ids.`);
    return { kind: slide.kind, body: slide.body, handout: slide.handout, from: slide.data.from };
  }

  /**
   * The copy's `from:` line in its deck, after a library write (the deck view does this itself for the buttons). An
   * open deck gets it through its view (`viaView`), never as a whole-file write.
   */
  async setFrom(deckPath: string, id: string, from: string, viaView?: (id: string, from: string) => Promise<boolean>): Promise<void> {
    if (viaView) {
      if (!(await viaView(id, from))) throw new Error(`The library is written, but ${deckName(deckPath)} is open and didn't take the slide's new from: line.`);
      return;
    }
    const text = await this.files.read(deckPath);
    const slide = text === null ? undefined : slidesOfText(writableDeckText(deckPath, text)).find(entry => entry.data.id === id);
    if (text === null || !slide) throw new Error(`${deckName(deckPath)} has no slide ${id}.`);
    const body = writeSlideData(slide.kind, slide.body, { ...slide.data, from, kept: undefined });
    // Sprint 161 (PR 2): the part is written as a block slide, its notes and hidden words a comment in its handout.
    const part = convertedPart({ kind: slide.kind, body, handout: slide.handout }, folderOf(deckPath), slide.notes);
    const notes = part.kind === slide.kind ? slide.notes : null;
    const written = replaceSlidePart(asBlockDeck(text, [part.kind]), id, partText(part.kind, part.body, part.handout, notes));
    if (written !== null && written !== text) await this.files.write(deckPath, written);
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
    const data = slideDataOf(copy.kind, copy.body);
    const body = writeSlideData(copy.kind, copy.body, { ...data, id, from: undefined, kept: undefined, skip: undefined });
    return rebaseSlide(body, copy.handout, folderOf(deckPath), folderOf(sourcePath), copy.kind);
  }
}
