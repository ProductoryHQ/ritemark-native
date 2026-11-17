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
import { EXERCISE_TAG, exerciseTagOf, handoutWithoutHeading, isBlockSlide, sidePictureOf, isDefaultExerciseTag, isSlideKind, parseDeck, slideDataOf, splitBlockSlide, writeSlideBlock, writeSlideData, type SlideData } from './deckFormat';
import { legacyDataToBlocks } from './blocks/legacyToBlocks';
import { OPEN_FENCE, parseFenceAttributes } from './blocks/fencedDiv';

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
  return encodeLike(path, relativeFrom(toFolder, absolute)) + rest;
}

/** The path from `folder` to `file` (both from the same root), with `..` where it climbs out. */
function relativeFrom(folder: string, file: string): string {
  const from = folder ? folder.split('/') : [];
  const to = file.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  return [...from.slice(common).map(() => '..'), ...to.slice(common)].join('/');
}

// ---------------------------------------------------------------------------
// A deck moved or renamed (17 November)
// ---------------------------------------------------------------------------

/**
 * A picture's target as written in a deck that was in `oldFolder` and is now in `newFolder` (paths from one root, posix,
 * such as `Users/me/Project/Koolitus`). `moved` gives a file's place after the move: a picture that moved along (its
 * folder was moved, or it was moved in the same step) keeps pointing at itself, and one that stayed is pointed at where
 * it is. A target that still points right is left exactly as written; one that can't be written from the new folder
 * (another drive) too.
 */
export function movedTarget(target: string, oldFolder: string, newFolder: string, moved: (path: string) => string = path => path): string {
  if (!isRelativeTarget(target)) return target;
  const [path, rest] = splitSuffix(target);
  const before = normalizePath(`${oldFolder}/${decodeSafe(path)}`);
  if (before === null) return target;
  const after = moved(before);
  // Still right from the new folder: nothing to change, not even its spelling.
  if (normalizePath(`${newFolder}/${decodeSafe(path)}`) === after) return target;
  // A relative path never crosses from one drive to another (C: and D:).
  const rootOf = (value: string) => value.split('/')[0] ?? '';
  if (newFolder && rootOf(newFolder) !== rootOf(after) && /:$/.test(rootOf(newFolder) + rootOf(after))) return target;
  return encodeLike(path, relativeFrom(newFolder, after)) + rest;
}

/** A file's place after some moves (each `from` to `to`: a file, or a folder and everything in it); else where it was. */
export function placeAfterMoves(moves: Array<{ from: string; to: string }>): (path: string) => string {
  return path => {
    for (const move of moves) {
      if (path === move.from) return move.to;
      if (path.startsWith(`${move.from}/`)) return move.to + path.slice(move.from.length);
    }
    return path;
  };
}

/**
 * The pictures of some Markdown (`![…](target)`), each target rewritten by `rewrite`; links stay, and nothing inside a
 * code block or a code span is touched (a prompt's words are the person's own).
 */
export function rewritePictureTargets(markdown: string, rewrite: (target: string) => string): string {
  const lines = markdown.split('\n');
  let fence: string | null = null;
  return lines.map(line => {
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && /^ {0,3}[`~]+\s*$/.test(line)) fence = null;
      return line;
    }
    if (open) {
      fence = open[1];
      return line;
    }
    // Code spans stay as written: only the text between them is read.
    return line.split(/(`+[^`]*`+)/).map((part, index) => (index % 2 === 1 ? part : part.replace(/(!\[[^\]]*\]\()(<[^>]*>|[^)\s]+)((?:\s+"[^"]*")?\))/g, (_match, open: string, target: string, close: string) => {
      const angled = target.startsWith('<') && target.endsWith('>');
      const inner = angled ? target.slice(1, -1) : target;
      const next = rewrite(inner);
      if (next === inner) return `${open}${target}${close}`;
      return `${open}${/\s/.test(next) ? `<${next}>` : next}${close}`;
    }))).join('');
  }).join('\n');
}

/**
 * A deck's text with every picture's target rewritten by `rewrite`: each slide's `image:` line and the pictures in a
 * block slide's Markdown, and the pictures in the handout. Everything else, byte for byte. Used when a deck is moved or
 * renamed in Ritemark, so its pictures still show (17 November); the picture files themselves are never touched.
 */
export function rewriteDeckPictures(text: string, rewrite: (target: string) => string): string {
  const deck = parseDeck(text);
  let out = text;
  // From the last slide back, so the places read from the text still hold.
  for (let index = deck.slides.length - 1; index >= 0; index--) {
    const slide = deck.slides[index];
    out = out.slice(0, slide.handoutStart) + rewritePictureTargets(out.slice(slide.handoutStart, slide.handoutEnd), rewrite) + out.slice(slide.handoutEnd);
    const bodyStart = out.indexOf('\n', slide.start) + 1;
    if (bodyStart <= 0 || out.slice(bodyStart, bodyStart + slide.body.length) !== slide.body) continue;
    const data = slideDataOf(slide.kind, slide.body);
    const image = data.image ? rewrite(data.image) : data.image;
    // Through the slide writer only when the picture's path changes, so an unchanged header stays byte for byte.
    let body = image !== data.image ? writeSlideData(slide.kind, slide.body, { ...data, image }) : slide.body;
    if (isBlockSlide(slide.kind)) {
      const parts = splitBlockSlide(body);
      body = parts.head + rewritePictureTargets(parts.markdown, rewrite);
    }
    if (body !== slide.body) out = out.slice(0, bodyStart) + body + out.slice(bodyStart + slide.body.length);
  }
  // The words before the first slide, after the front matter.
  const introEnd = deck.slides.length ? deck.slides[0].start : out.length;
  return out.slice(0, deck.bodyStart) + rewritePictureTargets(out.slice(deck.bodyStart, introEnd), rewrite) + out.slice(introEnd);
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

/**
 * A slide's body and handout as written in `fromFolder`, with every relative path rewritten for `toFolder`. `kind` is
 * the slide's: a block slide's header `image:` and the pictures and links in its Markdown are rebased too, the rest of
 * its body byte for byte.
 */
export function rebaseSlide(body: string, handout: string, fromFolder: string, toFolder: string, kind: string): { body: string; handout: string } {
  if (fromFolder === toFolder) return { body, handout };
  const slideKind = kind;
  const data = slideDataOf(slideKind, body);
  // Sprint 159 (PR 2, Codex): through the slide writer, so a path that needs quoting (`images/foo #1.png`) stays one
  let next = data.image ? writeSlideData(slideKind, body, { ...data, image: rebasePath(data.image, fromFolder, toFolder) }) : body;
  if (isBlockSlide(slideKind)) {
    const parts = splitBlockSlide(next);
    next = parts.head + rewriteMarkdownTargets(parts.markdown, target => rebasePath(target, fromFolder, toFolder));
  }
  return {
    body: next,
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

/** Text without its comments (`<!-- … -->`) and anchored comments' `<mark>` tags: what is private is no change. */
function withoutComments(text: string): string {
  // Only an unescaped `<` opens one: a v1 slide's words through the converter write a typed `<!--` as `\<!--`.
  return text.replace(/(?<!\\)<!--[\s\S]*?(?:-->|$)/g, ' ').replace(/(?<!\\)<\/?mark\b(?:"[^"]*"|'[^']*'|[^'">])*>?/gi, '');
}

/**
 * Sprint 161: the stamp of a slide as blocks. A block slide's Markdown, or a v1 slide's as `legacyToBlocks` draws it,
 * its picture beside or behind, and its handout, each with paths resolved and Markdown forms folded; comments left out
 * (the hidden words and old notes the conversion writes are a comment). So a v1 copy and its source converted later
 * still read as the same slide.
 */
/**
 * A Steps block's opening line as its pill draws it (#752's rule): no label and `tag="Exercise"` (in any case) are the
 * same pill, and so are an empty label and one of spaces, so writing out what the slide already shows is no change.
 */
function canonicalStepsLines(markdown: string): string {
  return markdown.split('\n').map(line => {
    const open = OPEN_FENCE.exec(line);
    const attrs = open ? parseFenceAttributes(open[2]) : null;
    if (!attrs || !attrs.classes.includes('steps')) return line;
    const tag = (attrs.values.tag ?? EXERCISE_TAG).replace(/\s+/g, ' ').trim();
    if (tag.toLowerCase() === EXERCISE_TAG.toLowerCase()) return '::: steps';
    return `::: {.steps tag="${tag}"}`;
  }).join('\n');
}

function blockStampOf(kind: string, data: SlideData, handout: string, folder: string): string {
  const converted = isBlockSlide(kind) ? { markdown: data.markdown ?? '', header: data } : legacyDataToBlocks(kind, data);
  const blocks = { ...converted, markdown: canonicalStepsLines(converted.markdown) };
  const side = sidePictureOf(blocks.header) ?? '';
  const image = side && blocks.header.image ? projectPath(blocks.header.image, folder) ?? blocks.header.image : '';
  const resolve = (markdown: string) => foldMarkdown(withoutComments(rewriteMarkdownTargets(markdown, target => projectPath(target, folder) ?? target)));
  return fnv1a(['blocks', resolve(blocks.markdown), side, image, '#handout', resolve(handout)].join('\u0001'));
}

/**
 * The stamp of a slide as a person sees it, written in a new `from:` line. Sprint 161: the block stamp
 * (`blockStampOf`), for a block slide and for a v1 slide of one of the nine kinds through the converter; a kind this
 * build doesn't know keeps the v1 stamp. Not its id, its `from:`, whether it is kept or skipped, or its notes. Paths
 * are resolved from `folder` (the deck's project-relative folder).
 *
 * Not the part's own heading either (16 November): a heading is the handout's, and typing one never marks a library
 * slide changed. So an older copy whose heading the editor writes in at the first edit, or a copy made with its heading
 * from a topic written before headings, keeps its source's stamp.
 */
export function slideStamp(kind: string, data: SlideData, handout: string, folder: string): string {
  if (isBlockSlide(kind) || isSlideKind(kind)) return blockStampOf(kind, data, handoutWithoutHeading(handout), folder);
  return stampOf(kind, data, handoutWithoutHeading(handout), folder);
}

/**
 * The stamps a `from:` line may hold for this slide: today's (`slideStamp`), then the v1 stamps every `from:` written
 * before Sprint 161 holds: its words without the part's heading, and for a handout that opens with a heading, the stamp
 * a copy made before 16 November got (its heading counted then). A copy or a source matching any is as it was.
 */
export function slideStamps(kind: string, data: SlideData, handout: string, folder: string): string[] {
  const stamps = [slideStamp(kind, data, handout, folder)];
  if (!isBlockSlide(kind)) stamps.push(stampOf(kind, data, handoutWithoutHeading(handout), folder), stampOf(kind, data, handout, folder));
  return [...new Set(stamps)];
}

function stampOf(kind: string, data: SlideData, handout: string, folder: string): string {
  const image = data.image ? projectPath(data.image, folder) ?? data.image : '';
  const resolvedHandout = rewriteMarkdownTargets(handout, target => projectPath(target, folder) ?? target);
  const parts = [
    kind,
    fold(data.title), fold(data.subtitle), fold(data.number), data.look ?? '', data.picture ?? '', image,
    ...(data.items ?? []).map(item => `${fold(item.heading)}|${fold(item.text)}|${item.icon ?? ''}`),
    '#rows', ...(data.rows ?? []).map(row => row.map(fold).join('|')),
    // An exercise's pill (16 November) counts only when it draws other words than the default, so every stamp made
    // before it stands, and `tag: Exercise` written out is no change. A tag kept on another kind draws nothing.
    ...(kind === 'exercise' && !isDefaultExerciseTag(data) ? ['#tag', fold(exerciseTagOf(data))] : []),
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
    data: slideDataOf(slide.kind, slide.body),
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
  const index = deck.slides.findIndex(slide => slideDataOf(slide.kind, slide.body).id === id);
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

/** A new topic deck's text, holding its first part: `deck: 2` when that part is a block slide (Sprint 161). */
export function newTopicText(theme: string, part: string, blocks = false): string {
  return `---\ndeck: ${blocks ? 2 : 1}\ntheme: ${theme}\n---\n\n${part}\n`;
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
