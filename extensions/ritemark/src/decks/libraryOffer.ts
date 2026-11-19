/**
 * Sprint 165 PR 4 (#834, README "The library place, from first principles", item 6): the slides that are in most of
 * the person's decks, which the Slide library offers at its top ("These 4 slides are in most of your decks."). The
 * rule is F4, chosen by the Experience lead on 19 November from PR 0's research
 * (`docs/development/releases/v2.3.0/sprint-165-slide-library/research/library-rules.md`):
 *
 * - slides are grouped by rule G (`sameSlide.ts`), as search groups them;
 * - decks whose slides are at least half the same slides (Jaccard over their groups) are one family, joined through
 *   chains of them, so a course copied twelve times counts once;
 * - a slide is offered when it is in at least a third of the families and in at least three of them: at most six, the
 *   ones in the most families first, each at its newest copy.
 *
 * Never offered: a slide the library already has (a copy of it in a topic), one hidden with Not now, and one with no
 * id (a copy is taken by its id). A project with fewer than three families gets no offer, the quiet side to err on.
 * It's an offer: nothing here writes a deck, and the app works it out from the decks alone, with no AI call. The place
 * and Claude's tools share it.
 *
 * Not now is kept per project beside the library, in `Slide library/.not-now.json` (the Development manager's call),
 * never in the deck files: each hidden slide by its copies' places (`<deck path>#<id>`) and a hash of its words, so a
 * slide copied into another deck, or a deck moved, stays hidden.
 */
import { createHash } from 'crypto';
import type { DeckFiles, DeckLibrary, DeckSummary } from './DeckLibrary';
import { jaccard, type SameSlides } from './sameSlide';
import { DeckIndex } from './librarySearch';

/** Decks at least this much the same (Jaccard over their slides' groups) are one family. */
export const FAMILY_SHARE = 0.5;
/** A slide is offered when it is in at least this share of the families… */
export const OFFER_SHARE = 1 / 3;
/** …and in at least this many of them. */
export const OFFER_MIN_FAMILIES = 3;
/** The offer shows at most this many slides. */
export const MAX_OFFER = 6;
/** The topic the offer's slides go into, made when it isn't there. */
export const EVERY_TRAINING = 'Every training';
/** Where Not now is kept: beside the library's topics, never in a deck. */
export const NOT_NOW_PATH = 'Slide library/.not-now.json';
/** Not now keeps at most this many slides (the oldest go first), each with at most this many places. */
const MAX_NOT_NOW = 500;
const MAX_PLACES = 200;

/** A deck as the offer reads it: its summary, and each slide's words for "the same slide" (`IndexedDeck` has both). */
export interface OfferDeck {
  summary: Pick<DeckSummary, 'path' | 'topic' | 'modified'> & { slides: ReadonlyArray<{ index: number; id?: string; data: { title?: string } }> };
  words: ReadonlyArray<readonly string[]>;
}

/** One slide the offer shows. */
export interface OfferedSlide {
  /** Its newest copy: the deck, the slide's place in it and its id. */
  path: string;
  index: number;
  id: string;
  title: string;
  /** How many families and how many decks have it. */
  families: number;
  decks: number;
}

export interface LibraryOffer {
  slides: OfferedSlide[];
  /** How many families the project's decks make. */
  families: number;
}

/** One slide Not now hid: its title (for a person reading the file), its copies' places and its words' hashes. */
export interface NotNowSlide {
  title?: string;
  places: string[];
  words: string[];
}

export interface NotNow {
  slides: NotNowSlide[];
}

export const NO_NOT_NOW: NotNow = { slides: [] };

/** A slide's words as Not now keeps them: a short hash, so the file stays small and holds only a title of each. */
export function wordsHash(words: readonly string[]): string | null {
  const text = words.join(' ');
  return text ? createHash('sha256').update(text).digest('hex').slice(0, 16) : null;
}

/** Not now as read from its file; an unreadable or missing file hides nothing. */
export function parseNotNow(text: string | null): NotNow {
  if (!text) return NO_NOT_NOW;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return NO_NOT_NOW;
  }
  const list = typeof value === 'object' && value !== null && Array.isArray((value as { slides?: unknown }).slides) ? (value as { slides: unknown[] }).slides : [];
  const strings = (field: unknown) => (Array.isArray(field) ? field.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 1100) : []);
  const slides = list.flatMap((entry): NotNowSlide[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const places = strings(record.places).slice(0, MAX_PLACES);
    const words = strings(record.words).slice(0, MAX_PLACES);
    if (!places.length && !words.length) return [];
    return [{ ...(typeof record.title === 'string' ? { title: record.title.slice(0, 200) } : {}), places, words }];
  });
  return { slides: slides.slice(-MAX_NOT_NOW) };
}

/** Not now's file text: readable, with a line saying what it is and how to bring the offer back. */
export function notNowText(notNow: NotNow): string {
  return `${JSON.stringify({
    about: 'The slides the Slide library no longer offers (Not now). Delete this file to have them offered again.',
    version: 1,
    slides: notNow.slides.slice(-MAX_NOT_NOW),
  }, null, 2)}\n`;
}

/** A slide's key in the index: `<deck path>#<its index>`, as `librarySearch.slideKey` writes it. */
function keyOf(path: string, index: number): string {
  return `${path}#${index}`;
}

interface Member {
  deck: number;
  at: number;
}

/** Each group's slides, by deck and place, from the decks given. */
function groupsOf(decks: readonly OfferDeck[], same: SameSlides): Map<string, Member[]> {
  const groups = new Map<string, Member[]>();
  decks.forEach((deck, at) => {
    deck.summary.slides.forEach((slide, index) => {
      const key = keyOf(deck.summary.path, slide.index);
      const group = same.groupOf(key) ?? key;
      const list = groups.get(group);
      if (list) list.push({ deck: at, at: index });
      else groups.set(group, [{ deck: at, at: index }]);
    });
  });
  return groups;
}

/**
 * The decks' families: decks at least `FAMILY_SHARE` the same, joined through chains of them. Only decks of the
 * person's own (not the library's topics) with a slide; by deck index, each family named by its smallest.
 */
export function familiesOf(groupSets: ReadonlyArray<ReadonlySet<string> | null>): Map<number, number> {
  const decks = groupSets.flatMap((set, at) => (set && set.size ? [at] : []));
  const parent = new Map(decks.map(at => [at, at]));
  const find = (at: number): number => {
    let root = at;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let walk = at;
    while (parent.get(walk) !== root) {
      const next = parent.get(walk)!;
      parent.set(walk, root);
      walk = next;
    }
    return root;
  };
  // By size: two decks can be half the same only when the smaller has at least half the larger's slides.
  const bySize = [...decks].sort((a, b) => groupSets[a]!.size - groupSets[b]!.size || a - b);
  for (let x = 0; x < bySize.length; x++) {
    const a = groupSets[bySize[x]]!;
    for (let y = x + 1; y < bySize.length; y++) {
      const b = groupSets[bySize[y]]!;
      if (a.size < b.size * FAMILY_SHARE) break;
      const ra = find(bySize[x]);
      const rb = find(bySize[y]);
      if (ra !== rb && jaccard(a, b) >= FAMILY_SHARE) parent.set(Math.max(ra, rb), Math.min(ra, rb));
    }
  }
  return new Map(decks.map(at => [at, find(at)]));
}

/** The places and words Not now hides, for a quick look. */
function hiddenSets(notNow: NotNow): { places: Set<string>; words: Set<string> } {
  return {
    places: new Set(notNow.slides.flatMap(slide => slide.places)),
    words: new Set(notNow.slides.flatMap(slide => slide.words)),
  };
}

/**
 * The offer: rule F4 over the decks given and their grouping, the slides Not now hid left out. Each slide shows at its
 * newest copy outside the open deck (`active`), as search shows it, or the open deck's when it is the only one.
 */
export function offerOf(decks: readonly OfferDeck[], same: SameSlides, notNow: NotNow = NO_NOT_NOW, options: { active?: string | null } = {}): LibraryOffer {
  const groups = groupsOf(decks, same);
  // Each of the person's decks as the set of its slides' groups; a topic is the library, no deck of theirs.
  const sets = decks.map(deck => (deck.summary.topic ? null : new Set<string>()));
  for (const [group, members] of groups) for (const member of members) sets[member.deck]?.add(group);
  const family = familiesOf(sets);
  const familyCount = new Set(family.values()).size;
  const need = Math.max(OFFER_MIN_FAMILIES, Math.ceil(familyCount * OFFER_SHARE));
  if (familyCount < need) return { slides: [], families: familyCount };
  const hidden = hiddenSets(notNow);
  const offered: Array<OfferedSlide & { modified: number }> = [];
  for (const members of groups.values()) {
    // The library has it already.
    if (members.some(member => decks[member.deck].summary.topic)) continue;
    const families = new Set(members.flatMap(member => (family.has(member.deck) ? [family.get(member.deck)!] : [])));
    if (families.size < need) continue;
    const isHidden = members.some(member => {
      const deck = decks[member.deck];
      const id = deck.summary.slides[member.at].id;
      const hash = wordsHash(deck.words[member.at] ?? []);
      return (id !== undefined && hidden.places.has(`${deck.summary.path}#${id}`)) || (hash !== null && hidden.words.has(hash));
    });
    if (isHidden) continue;
    // Its newest copy: the slide in the deck changed last (ties by path, then place), one with an id; the open deck's
    // only when no other deck has one.
    let newest: Member | null = null;
    const isOpen = (member: Member) => decks[member.deck].summary.path === options.active;
    for (const member of members) {
      const slide = decks[member.deck].summary.slides[member.at];
      if (!slide.id) continue;
      if (!newest || (isOpen(newest) && !isOpen(member))) {
        newest = member;
        continue;
      }
      if (isOpen(member) && !isOpen(newest)) continue;
      const a = decks[newest.deck].summary;
      const b = decks[member.deck].summary;
      if (b.modified > a.modified || (b.modified === a.modified && (b.path < a.path || (b.path === a.path && member.at < newest.at)))) newest = member;
    }
    if (!newest) continue;
    const deck = decks[newest.deck].summary;
    const slide = deck.slides[newest.at];
    offered.push({
      path: deck.path,
      index: slide.index,
      id: slide.id!,
      title: typeof slide.data.title === 'string' ? slide.data.title : '',
      families: families.size,
      decks: new Set(members.map(member => member.deck)).size,
      modified: deck.modified,
    });
  }
  offered.sort((a, b) => b.families - a.families || b.decks - a.decks || b.modified - a.modified || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) || a.index - b.index);
  return {
    slides: offered.slice(0, MAX_OFFER).map(slide => ({ path: slide.path, index: slide.index, id: slide.id, title: slide.title, families: slide.families, decks: slide.decks })),
    families: familyCount,
  };
}

/**
 * What Not now keeps for the slides named (each a deck's slide by id, as the offer shows it): every copy of it, by
 * place and by words. A slide no longer there is kept by its own place.
 */
export function notNowSlides(decks: readonly OfferDeck[], same: SameSlides, slides: ReadonlyArray<{ path: string; id: string }>): NotNowSlide[] {
  const byPath = new Map(decks.map((deck, at) => [deck.summary.path, at]));
  const groups = groupsOf(decks, same);
  const groupOfSlide = (path: string, id: string): string | null => {
    const at = byPath.get(path);
    const slide = at === undefined ? undefined : decks[at].summary.slides.find(entry => entry.id === id);
    if (at === undefined || !slide) return null;
    const key = keyOf(path, slide.index);
    return same.groupOf(key) ?? key;
  };
  return slides.map(({ path, id }) => {
    const group = groupOfSlide(path, id);
    const members = group ? groups.get(group) ?? [] : [];
    const places = new Set<string>([`${path}#${id}`]);
    const words = new Set<string>();
    let title: string | undefined;
    for (const member of members) {
      const deck = decks[member.deck];
      const slide = deck.summary.slides[member.at];
      if (slide.id) places.add(`${deck.summary.path}#${slide.id}`);
      const hash = wordsHash(deck.words[member.at] ?? []);
      if (hash) words.add(hash);
      if (title === undefined && deck.summary.path === path && slide.id === id && typeof slide.data.title === 'string') title = slide.data.title;
    }
    return { ...(title ? { title } : {}), places: [...places].slice(0, MAX_PLACES), words: [...words].slice(0, MAX_PLACES) };
  });
}

/** Not now, as the project keeps it. */
export async function readNotNow(files: Pick<DeckFiles, 'read'>): Promise<NotNow> {
  return parseNotNow(await files.read(NOT_NOW_PATH));
}

/** Not now for these slides, added to what the project keeps: they aren't offered again. */
export async function hideFromOffer(files: Pick<DeckFiles, 'read' | 'write'>, slides: readonly NotNowSlide[]): Promise<void> {
  if (!slides.length) return;
  const kept = await readNotNow(files);
  await files.write(NOT_NOW_PATH, notNowText({ slides: [...kept.slides, ...slides] }));
}

/**
 * The project's offer read afresh (Claude's tools; the place keeps an index of its own): every deck once, grouped, and
 * Not now read from its file.
 */
export async function projectOffer(library: DeckLibrary): Promise<{ offer: LibraryOffer; decks: OfferDeck[]; same: SameSlides }> {
  const index = new DeckIndex(library.files);
  const decks = await index.decks();
  const same = index.same();
  return { offer: offerOf(decks, same, await readNotNow(library.files)), decks, same };
}
