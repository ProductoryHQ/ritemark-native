/**
 * Sprint 161 (technical plan §4, PR 2): converting today's slides to block slides, as text. The deck view converts a
 * whole deck in one transaction at its first real edit (`webview/.../decks/handout/deckConvert.ts`, which uses the
 * functions here); the host converts only the parts it writes (the library, `insert_slides`), so a deck may mix both
 * kinds, and says `deck: 2` once it holds a block slide.
 *
 *  - A v1 slide of one of the nine kinds becomes a bare ```` ```slide ```` block: its header (id, from, skip, kept, and
 *    a picture beside or behind) and the Markdown `legacyToBlocks` draws it with, so what the person saw before the
 *    first edit is what is written.
 *  - Its ```` ```notes ```` block and the words its layout kept hidden become one Ritemark comment, `<!-- … -->`, at the
 *    end of its handout part (Jarmo, 17 November: no private notes field). The page, the wall and Publish drop comments.
 *  - A copy whose `from:` stamp still matches the slide gets the block stamp; a changed copy keeps its old one.
 *  - A kind this build doesn't know stays as written, with its notes.
 *
 * Pure: no DOM, no `vscode`.
 */
import { isSlideKind, parseDeck, parseFrom, slideDataOf, writeFrom, writeSlideBlock, writeSlideData, type SlideData } from '../deckFormat';
import { slideStamp, slideStamps } from '../deckLibraryFormat';
import { legacyDataToBlocks } from './legacyToBlocks';
import { OPEN_FENCE, parseFenceAttributes, withFenceValue } from './fencedDiv';

/** Does a slide of this kind convert to a block slide: a v1 slide of one of the nine kinds. */
export function convertsToBlocks(kind: string): boolean {
  return isSlideKind(kind);
}

/** A block slide's body: its header's keys between `---` lines (only when it has one), then its Markdown. */
export function blockSlideBody(header: SlideData, markdown: string): string {
  return writeSlideData('', markdown, header);
}

/**
 * A copy's `from:` line after its conversion: the block stamp, when the stamp it holds is one this slide still matches
 * (an older v1 stamp); as it was otherwise (a changed copy keeps the stamp it was copied with). `folder` is the deck's
 * project-relative folder ('' when unknown: then only a slide whose stamp doesn't depend on its paths gets the new one).
 */
export function renewedFrom(kind: string, data: SlideData, handout: string, folder: string): string | undefined {
  const source = parseFrom(data.from);
  if (!source || !source.stamp || !convertsToBlocks(kind)) return data.from;
  const fresh = slideStamp(kind, data, handout, folder);
  if (source.stamp === fresh || !slideStamps(kind, data, handout, folder).includes(source.stamp)) return data.from;
  return writeFrom({ ...source, stamp: fresh });
}

/** One converted slide: its block body, and the comment for the end of its handout part (null without one). */
export interface ConvertedSlide {
  body: string;
  comment: string | null;
}

/**
 * A v1 slide (its kind, YAML body and ```` ```notes ````) as a block slide. `handout` (its part, trimmed) and `folder`
 * renew a copy's stamp. A slide that doesn't convert comes back as it was, with no comment.
 */
export function convertSlide(kind: string, body: string, notes: string | null, handout = '', folder = ''): ConvertedSlide {
  if (!convertsToBlocks(kind)) return { body, comment: null };
  const read = slideDataOf(kind, body);
  const from = renewedFrom(kind, read, handout, folder);
  const data = from === read.from ? read : { ...read, from };
  const blocks = legacyDataToBlocks(kind, data, notes);
  return { body: blockSlideBody(blocks.header, blocks.markdown), comment: blocks.comment };
}

/**
 * The closing line for a code fence the text leaves open at its end (an unfinished prompt), or null when every fence
 * is closed. CommonMark's rule for an unindented fence, as `parseDeck` reads one.
 */
function openFenceAtEnd(text: string): string | null {
  let open: { char: string; size: number } | null = null;
  for (const line of text.split('\n')) {
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.replace(/\r$/, ''));
    if (!fence) continue;
    if (open) {
      if (fence[1][0] === open.char && fence[1].length >= open.size && fence[2].trim() === '') open = null;
    } else if (!(fence[1][0] === '`' && fence[2].includes('`'))) {
      open = { char: fence[1][0], size: fence[1].length };
    }
  }
  return open ? open.char.repeat(open.size) : null;
}

/**
 * A part's handout with `comment` at its end, before the blank lines that end it; as it was without a comment. A fence
 * the part leaves open (an unfinished prompt runs to the end of the part) is closed first, so the comment is never the
 * prompt's text, which the page publishes (review of #765).
 */
export function withCommentAtEnd(handout: string, comment: string | null): string {
  if (!comment) return handout;
  const trailing = /\s*$/.exec(handout)?.[0] ?? '';
  const open = openFenceAtEnd(handout);
  const core = handout.slice(0, handout.length - trailing.length) + (open ? `\n${open}` : '');
  // A part with no text of its own (a copy's empty handout) is the comment alone.
  if (!core) return trailing ? `\n\n${comment}${trailing}` : comment;
  return `${core}\n\n${comment}${trailing}`;
}

/** A part the host writes (a library copy, a slide `insert_slides` puts in): its slide as blocks, its comment in its handout. */
export function convertedPart<T extends { kind: string; body: string; handout: string }>(part: T, folder = '', notes: string | null = null): T {
  if (!convertsToBlocks(part.kind)) return part;
  const converted = convertSlide(part.kind, part.body, notes, part.handout, folder);
  return { ...part, kind: '', body: converted.body, handout: withCommentAtEnd(part.handout, converted.comment) };
}

/**
 * The deck's text with `deck: <version>` in its front matter: the value replaced where the line is there, the line
 * added first where it isn't, a front matter made where there is none. Every other byte stays.
 */
export function withDeckVersion(text: string, version: number): string {
  const bom = text.startsWith('﻿') ? '﻿' : '';
  const body = text.slice(bom.length);
  // An empty front matter (`---` twice) first, so a later `---` in the deck is never taken for its closing line.
  const empty = /^(---[ \t]*(\r?\n))(---[ \t]*(?:\r?\n|$))/.exec(body);
  if (empty) return bom + empty[1] + `deck: ${version}` + empty[2] + empty[3] + body.slice(empty[0].length);
  const match = /^(---[ \t]*(\r?\n))([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(body);
  if (!match) return `${bom}---\ndeck: ${version}\n---\n\n${body}`;
  const lines = match[3].split(/\r?\n/);
  const at = lines.findIndex(line => /^deck:(?:\s|$)/.test(line));
  if (at >= 0) {
    if (lines[at].replace(/\s+$/, '') === `deck: ${version}`) return text;
    lines[at] = `deck: ${version}`;
  } else {
    lines.unshift(`deck: ${version}`);
  }
  return bom + match[1] + lines.join(match[2]) + match[4] + body.slice(match[0].length);
}

/** Does the deck's front matter say a block deck, `deck: 2` or later? */
export function saysBlockDeck(version: string | null): boolean {
  const number = Number(version ?? '1');
  return Number.isFinite(number) && number >= 2;
}

/**
 * The whole deck converted, as the deck view's first real edit writes it (with `withWrittenHandout`): every v1 slide of
 * the nine kinds as a block slide, its notes and hidden words as a comment at the end of its part, and `deck: 2`. Every
 * other byte stays. A deck with nothing to convert is returned as it is.
 */
export function convertDeckText(text: string, folder = ''): string {
  const deck = parseDeck(text);
  if (!deck.slides.some(slide => convertsToBlocks(slide.kind))) return text;
  let out = text;
  for (const slide of [...deck.slides].reverse()) {
    if (!convertsToBlocks(slide.kind)) continue;
    const handout = text.slice(slide.handoutStart, slide.handoutEnd);
    const trimmed = handout.replace(/^\n+/, '').replace(/\s+$/, '');
    const converted = convertSlide(slide.kind, slide.body, slide.notes, trimmed, folder);
    out = out.slice(0, slide.start) + writeSlideBlock('', converted.body) + withCommentAtEnd(handout, converted.comment) + out.slice(slide.handoutEnd);
  }
  return withDeckVersion(out, 2);
}

/**
 * A block slide's Markdown with its first Steps block's pill set to `tag` (Settings' Label row, #752's rule kept for
 * block slides): `tag=""` for no pill. Only that opening line changes, its colons kept; the Markdown as it was when it
 * has no Steps block outside code, or when the line says that pill already.
 */
export function withStepsTag(markdown: string, tag: string): string {
  const lines = markdown.split('\n');
  let fence: { char: string; size: number } | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const code = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (code && code[1][0] === fence.char && code[1].length >= fence.size && /^ {0,3}(`{3,}|~{3,})[ \t]*$/.test(line)) fence = null;
      continue;
    }
    if (code) { fence = { char: code[1][0], size: code[1].length }; continue; }
    const open = OPEN_FENCE.exec(line);
    const attrs = open ? parseFenceAttributes(open[2]) : null;
    if (!open || !attrs || !attrs.classes.includes('steps')) continue;
    // The one writer of an opening line's value, as the stage's pill field uses it (review of #769).
    const next = withFenceValue(line, 'tag', tag);
    if (next === null || next === line) return markdown;
    lines[index] = next;
    return lines.join('\n');
  }
  return markdown;
}

// ---------------------------------------------------------------------------
// Drawing today's slides as blocks (decision 8 of the approved plan)
// ---------------------------------------------------------------------------

/** Is a slide of this kind drawn and edited as blocks: a block slide, or a v1 slide of the nine kinds (converted in memory). */
export function drawsAsBlocks(kind: string): boolean {
  return kind === '' || convertsToBlocks(kind);
}

// By data object, then by kind: the deck view reads two v1 slides with the same body into one data object (its cache
// is per body), and a Points and an Exercise slide with the same words are drawn differently (review of #765).
const drawn = new WeakMap<SlideData, Map<string, SlideData>>();

/**
 * A slide's data as a block slide draws it: a block slide's as it is; a v1 slide's as `legacyToBlocks` converts it,
 * its header and Markdown, without the words its layout hid (they are the conversion's comment, never drawn), and its
 * title. Read once per data object.
 */
export function blockDataOf(kind: string, data: SlideData): SlideData {
  if (!convertsToBlocks(kind)) return data;
  let byKind = drawn.get(data);
  const cached = byKind?.get(kind);
  if (cached) return cached;
  const blocks = legacyDataToBlocks(kind, data);
  const out: SlideData = { ...blocks.header, markdown: blocks.markdown };
  if (data.title !== undefined && data.title.trim()) out.title = data.title;
  if (!byKind) { byKind = new Map(); drawn.set(data, byKind); }
  byKind.set(kind, out);
  return out;
}
