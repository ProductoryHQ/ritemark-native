/**
 * Sprint 165 PR 3 (#833): when two slides are the same slide, the Experience lead's rule G from PR 0's research
 * (`docs/development/releases/v2.3.0/sprint-165-slide-library/research/library-rules.md`, chosen on 19 November):
 *
 * - two slides are one when they share a lineage (the same id, as decks copied from each other keep it, or a `from:`
 *   line, as the library's insert writes it) **and** still share at least 30% of their words, so a slide rewritten
 *   into another under its old id doesn't ride it;
 * - or when their words match exactly once normalized, so a slide typed again by hand is found too.
 *
 * Groups are joined through chains of these links. Pure and without `vscode`: the library's search (PR 3) and its offer
 * (PR 4) share it, and its tests drive it with made-up decks.
 */
import { isBlockSlide, parseFrom, type SlideData } from './deckFormat';
import { legacyDataToBlocks } from './blocks/legacyToBlocks';

/** A lineage link counts only when the two slides still share at least this share of their words (Jaccard). */
export const WORDS_GUARD = 0.3;

/**
 * A text's words as the rule compares them: lower case, punctuation dropped (an address's `@` and `.` kept inside a
 * word), white space folded.
 */
export function normalizedWords(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.]+/gu, ' ')
    .split(' ')
    .map(word => word.replace(/^[.@]+|[.@]+$/g, ''))
    .filter(Boolean);
}

/**
 * Markdown without what is no word on the slide: comments, `:::` lines, list markers ("1." is the list's, not the
 * person's), attributes and link or picture targets.
 */
function wordsOfMarkdown(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^[ \t]*:{3,}.*$/gm, ' ')
    .replace(/^[ \t]*(?:\d+[.)]|[-*+])[ \t]+/gm, ' ')
    .replace(/!?\[([^\]]*)\]\((?:<[^>]*>|[^)]*)\)/g, '$1')
    .replace(/\{[^{}\n]*\}/g, ' ');
}

/**
 * A slide's words, normalized: its title and everything on it, as Markdown. An older slide (`slide <kind>`) is read as
 * the block slide it converts to, so it and a copy the library wrote as blocks compare alike. The handout is not the
 * slide's words.
 */
export function slideWords(kind: string, data: SlideData): string[] {
  const markdown = isBlockSlide(kind) ? data.markdown ?? data.title ?? '' : legacyDataToBlocks(kind, data).markdown;
  return normalizedWords(wordsOfMarkdown(markdown));
}

/** How alike two sets of words are: the words they share over the words either has (1 for two empty sets). */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  const union = a.size + b.size - shared;
  return union ? shared / union : 1;
}

/** A slide the rule looks at. */
export interface LineageSlide {
  /** Unique among the slides given; the library uses `<deck path>#<index>`. */
  key: string;
  /** Its deck, project-relative (what a `from:` line names). */
  path: string;
  id?: string;
  from?: string;
  /** Its words, normalized (`slideWords`). */
  words: readonly string[];
}

/** The slides by group: each group is one slide, in every deck it is in. */
export interface SameSlides {
  /** A slide's group: the smallest key in it, so one grouping always names a group alike. Undefined for an unknown key. */
  groupOf(key: string): string | undefined;
  /** A group's slides' keys, in the order given. */
  membersOf(group: string): readonly string[];
}

/** Rule G over the slides given: every slide in exactly one group. */
export function sameSlides(slides: readonly LineageSlide[]): SameSlides {
  const parent = slides.map((_, index) => index);
  const find = (index: number): number => {
    let at = index;
    while (parent[at] !== at) {
      parent[at] = parent[parent[at]];
      at = parent[at];
    }
    return at;
  };
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const sets = slides.map(slide => new Set(slide.words));
  // A lineage link with the words guard; a pair already joined through others needs no check.
  const link = (a: number, b: number) => {
    if (a !== b && find(a) !== find(b) && jaccard(sets[a], sets[b]) >= WORDS_GUARD) join(a, b);
  };
  const linkAll = (group: readonly number[]) => {
    for (let x = 0; x < group.length; x++) for (let y = x + 1; y < group.length; y++) link(group[x], group[y]);
  };

  // The same id: decks copied from each other keep their slides' ids.
  const byId = new Map<string, number[]>();
  // A `from:` line names its source as `<path>#<id>`.
  const byPlace = new Map<string, number>();
  slides.forEach((slide, index) => {
    if (!slide.id) return;
    const same = byId.get(slide.id);
    if (same) same.push(index);
    else byId.set(slide.id, [index]);
    const place = `${slide.path}#${slide.id}`;
    if (!byPlace.has(place)) byPlace.set(place, index);
  });
  for (const group of byId.values()) if (group.length > 1) linkAll(group);

  // A `from:` line: to its source slide while that is there; copies of a slide that is gone link among themselves.
  const orphans = new Map<string, number[]>();
  slides.forEach((slide, index) => {
    const source = parseFrom(slide.from);
    if (!source) return;
    const place = `${source.path}#${source.id}`;
    const target = byPlace.get(place);
    if (target !== undefined) link(index, target);
    else {
      const copies = orphans.get(place);
      if (copies) copies.push(index);
      else orphans.set(place, [index]);
    }
  });
  for (const group of orphans.values()) if (group.length > 1) linkAll(group);

  // The same words exactly: a slide typed again by hand. A slide with no words matches none.
  const byText = new Map<string, number>();
  slides.forEach((slide, index) => {
    const text = slide.words.join(' ');
    if (!text) return;
    const first = byText.get(text);
    if (first === undefined) byText.set(text, index);
    else join(index, first);
  });

  // Each group named by its smallest key.
  const names = new Map<number, string>();
  slides.forEach((slide, index) => {
    const root = find(index);
    const name = names.get(root);
    if (name === undefined || slide.key < name) names.set(root, slide.key);
  });
  const groupOfKey = new Map<string, string>();
  const members = new Map<string, string[]>();
  slides.forEach((slide, index) => {
    const name = names.get(find(index))!;
    groupOfKey.set(slide.key, name);
    const list = members.get(name);
    if (list) list.push(slide.key);
    else members.set(name, [slide.key]);
  });
  return {
    groupOf: key => groupOfKey.get(key),
    membersOf: group => members.get(group) ?? [],
  };
}
