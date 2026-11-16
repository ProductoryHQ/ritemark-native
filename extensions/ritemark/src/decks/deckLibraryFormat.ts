/**
 * Sprint 157 (README "The library", the Experience lead's answers 2 and 7): the pure parts of copying slides between
 * decks and the Slide library. No imports beyond the deck format: the host's library and its tests use the same code.
 *
 *  - A copy brings the slide and its handout, never speaker notes (the library holds none).
 *  - The `from:` line's stamp is a short hash of what a person sees of the slide: its kind, words, look, picture and
 *    handout, with picture and link paths resolved to project-relative and whitespace folded, so a copy whose paths
 *    were rebased does not show as changed, and an edit that only moves line breaks in the handout doesn't either.
 *  - Update the library writes one slide by id (`replaceSlideBlock`), and every other byte of the topic stays.
 */
import { handoutWithoutHeading, parseDeck, parseSlideBody, writeSlideBlock, writeSlideBody, type SlideData } from './deckFormat';

// ---------------------------------------------------------------------------
// Paths (posix, project-relative)
// ---------------------------------------------------------------------------

/** A posix path with `.` and `..` worked out; null when it climbs out of the root. */
export function normalizePath(path: string): string | null {
  const out: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join('/');
}

/** The folder a project-relative file is in ('' for the project's top). */
export function folderOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

/** Is this a relative path a slide or handout may carry (not a URL, an anchor, a drive or an absolute path)? */
export function isRelativeTarget(target: string): boolean {
  const value = target.trim();
  if (!value || value.startsWith('#') || value.startsWith('/') || value.startsWith('\\')) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

/** A relative path as seen from `fromFolder`, written for `toFolder` (both project-relative). */
export function rebasePath(target: string, fromFolder: string, toFolder: string): string {
  if (!isRelativeTarget(target)) return target;
  const [path, rest] = splitSuffix(target);
  const absolute = normalizePath(`${fromFolder}/${decodeSafe(path)}`);
  if (absolute === null) return target;
  const from = toFolder ? toFolder.split('/') : [];
  const to = absolute.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  const relative = [...from.slice(common).map(() => '..'), ...to.slice(common)].join('/');
  return encodeLike(path, relative) + rest;
}

/** A path as the project knows it, from the folder it was written in; null when it is no relative path. */
export function projectPath(target: string, folder: string): string | null {
  if (!isRelativeTarget(target)) return null;
  return normalizePath(`${folder}/${decodeSafe(splitSuffix(target)[0])}`);
}

function splitSuffix(target: string): [string, string] {
  const match = /^([^?#]*)([?#].*)?$/.exec(target);
  return [match?.[1] ?? target, match?.[2] ?? ''];
}

function decodeSafe(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

/** Keep the original's encoding: a path written with %20 stays encoded. */
function encodeLike(original: string, path: string): string {
  return /%[0-9a-f]{2}/i.test(original) ? encodeURI(path) : path;
}

/** Markdown link and image targets (`](target)` and `](<target>)`), each rewritten by `rewrite`. */
export function rewriteMarkdownTargets(markdown: string, rewrite: (target: string) => string): string {
  return markdown.replace(/(\]\()(<[^>]*>|[^)\s]+)((?:\s+"[^"]*")?\))/g, (_match, open: string, target: string, close: string) => {
    const angled = target.startsWith('<') && target.endsWith('>');
    const inner = angled ? target.slice(1, -1) : target;
    const next = rewrite(inner);
    // A target the rewrite leaves alone keeps its own form; a rewritten one is in angle brackets only when it needs
    // them (a space would end it).
    if (next === inner) return `${open}${target}${close}`;
    return `${open}${/\s/.test(next) ? `<${next}>` : next}${close}`;
  });
}

/** A slide's body and handout as written in `fromFolder`, with every relative path rewritten for `toFolder`. */
export function rebaseSlide(body: string, handout: string, fromFolder: string, toFolder: string): { body: string; handout: string } {
  if (fromFolder === toFolder) return { body, handout };
  const data = parseSlideBody(body);
  return {
    // Sprint 159 (PR 2, Codex): through the slide writer, so a path that needs quoting (`images/foo #1.png`) stays one
    body: data.image ? writeSlideBody(body, { ...data, image: rebasePath(data.image, fromFolder, toFolder) }) : body,
    handout: rewriteMarkdownTargets(handout, target => rebasePath(target, fromFolder, toFolder)),
  };
}

// ---------------------------------------------------------------------------
// The stamp
// ---------------------------------------------------------------------------

/** FNV-1a, 32 bits, as six base36 characters. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(6, '0').slice(-6);
}

const fold = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * A handout's words with the Markdown forms the editor may write differently folded away: list markers, emphasis
 * marks, escapes, heading marks (atx or setext), and the numbers of an ordered list. A copy whose handout the editor
 * writes back as `- ` instead of `* ` is the same copy.
 */
export function foldMarkdown(text: string): string {
  return fold(text
    .replace(/\\([\\`*_{}\[\]()#+\-.!>~|])/g, '$1')
    .replace(/^[ \t]*(?:[*+-]|\d{1,9}[.)])[ \t]+/gm, '- ')
    .replace(/^[ \t]*#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/gm, '$1')
    .replace(/^[ \t]*(?:=+|-{2,})[ \t]*$/gm, '')
    // Emphasis marks stand at a word's edge; a `_` or `*` inside a word (file_name, 2*3) is a character of it.
    .replace(/(?<![\p{L}\p{N}])[*_]+|[*_]+(?![\p{L}\p{N}])/gu, ''));
}

/**
 * The stamp of a slide as a person sees it: kind, words, look, picture and handout. Not its id, its `from:`, whether
 * it is kept or skipped, or its notes. Paths are resolved from `folder` (the deck's project-relative folder).
 *
 * Not the part's own heading either (16 November): a heading is the handout's, and typing one never marks a library
 * slide changed. So an older copy whose heading the editor writes in at the first edit, or a copy made with its heading
 * from a topic written before headings, keeps its source's stamp.
 */
export function slideStamp(kind: string, data: SlideData, handout: string, folder: string): string {
  return stampOf(kind, data, handoutWithoutHeading(handout), folder);
}

/**
 * The stamps a `from:` line may hold for this slide: today's, and for a handout that opens with a heading, the stamp a
 * copy made before 16 November got (its heading counted then). A copy or a source matching either is as it was.
 */
export function slideStamps(kind: string, data: SlideData, handout: string, folder: string): string[] {
  const now = slideStamp(kind, data, handout, folder);
  const before = stampOf(kind, data, handout, folder);
  return before === now ? [now] : [now, before];
}

function stampOf(kind: string, data: SlideData, handout: string, folder: string): string {
  const image = data.image ? projectPath(data.image, folder) ?? data.image : '';
  const resolvedHandout = rewriteMarkdownTargets(handout, target => projectPath(target, folder) ?? target);
  const parts = [
    kind,
    fold(data.title), fold(data.subtitle), fold(data.number), data.look ?? '', data.picture ?? '', image,
    ...(data.items ?? []).map(item => `${fold(item.heading)}|${fold(item.text)}|${item.icon ?? ''}`),
    '#rows', ...(data.rows ?? []).map(row => row.map(fold).join('|')),
    '#handout', foldMarkdown(resolvedHandout),
  ];
  return fnv1a(parts.join('\u0001'));
}

// ---------------------------------------------------------------------------
// One slide in a deck's text
// ---------------------------------------------------------------------------

/** A slide of a deck's text by id: its kind, body, notes and handout, as written. */
export interface DeckSlideText {
  index: number;
  kind: string;
  body: string;
  data: SlideData;
  notes: string | null;
  /** The handout, trimmed of the blank lines around it. */
  handout: string;
}

export function slidesOfText(text: string): DeckSlideText[] {
  const deck = parseDeck(text);
  return deck.slides.map((slide, index) => ({
    index,
    kind: slide.kind,
    body: slide.body,
    data: parseSlideBody(slide.body),
    notes: slide.notes,
    handout: text.slice(slide.handoutStart, slide.handoutEnd).replace(/^\n+/, '').replace(/\s+$/, ''),
  }));
}

/** A part's text: its block, its notes when it has any, and its handout. */
export function partText(kind: string, body: string, handout: string, notes: string | null = null): string {
  const block = writeSlideBlock(kind, body, notes);
  return handout ? `${block}\n\n${handout}` : block;
}

/**
 * The deck's text with the slide `id`'s part (block, notes and handout) replaced by `part`, and every other byte as it
 * was. Null when the deck has no slide with that id.
 */
export function replaceSlidePart(text: string, id: string, part: string): string | null {
  const deck = parseDeck(text);
  const index = deck.slides.findIndex(slide => parseSlideBody(slide.body).id === id);
  if (index < 0) return null;
  const slide = deck.slides[index];
  const last = index === deck.slides.length - 1;
  // The part ends where the next slide starts; the blank lines before it stay.
  const end = last ? text.length : slide.handoutEnd;
  const tail = text.slice(slide.start, end).match(/\s*$/)?.[0] ?? '';
  return text.slice(0, slide.start) + part + (last ? (tail.includes('\n') ? tail : '\n') : tail) + text.slice(end);
}

/** The deck's text with `part` added at its end. */
export function appendPart(text: string, part: string): string {
  const trimmed = text.replace(/\s+$/, '');
  return `${trimmed}${trimmed ? '\n\n' : ''}${part}\n`;
}

/** A new topic deck's text, holding its first part. */
export function newTopicText(theme: string, part: string): string {
  return `---\ndeck: 1\ntheme: ${theme}\n---\n\n${part}\n`;
}

/**
 * The deck's text with `parts` put in after slide `after` (its number, from 1; 0 puts them before the first slide), and
 * every other byte as it was. A number past the last slide puts them at the end.
 */
export function insertPartsText(text: string, after: number, parts: string[]): string {
  const deck = parseDeck(text);
  const joined = parts.join('\n\n');
  if (deck.slides.length === 0 || after >= deck.slides.length) return appendPart(text, joined);
  const at = deck.slides[Math.max(0, after)].start;
  return `${text.slice(0, at)}${joined}\n\n${text.slice(at)}`;
}
