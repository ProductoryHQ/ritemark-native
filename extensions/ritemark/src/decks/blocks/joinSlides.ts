/**
 * Removing a slide from the handout (experience 46, "Removing a slide from the handout"; Jarmo, 16 November; joined
 * for block slides on 17 November): the join of slide N into slide N−1, as text. Nothing is dropped:
 *
 *  - slide N's blocks follow slide N−1's, in their order;
 *  - its title (its first top-level H1) becomes a heading there, an H3;
 *  - its slide-wide picture (a picture placed beside or behind its words) becomes a Picture block at the end of what
 *    moved;
 *  - its comments stay with the blocks they are on: a note before a block moves with that block, an anchored comment
 *    with its words; a comment on the whole of slide N becomes a comment on the H3 that was its title (or, without a
 *    title, on its first block). Slide N−1's own comments on its whole slide stay on the whole slide: they are written
 *    after everything that moved.
 *
 * Slide N−1 keeps its own header (its picture's place, Skip slide, its section mark, its library line), which the
 * caller keeps by writing only its Markdown. The handout's half of the join (part N's text following on in part N−1)
 * is the deck view's: it is the handout's own text, never this Markdown.
 *
 * Pure: no DOM, no `vscode`.
 */
import type { Token, Tokens } from 'marked';
import { sidePictureOf, type SlideData } from '../deckFormat';
import { pictureTarget } from './legacyToBlocks';
import { isCommentBlock, lexBlockSlide } from './slideRenderer';

/** A slide's top-level blocks, as written: each block's own text, and the comment notes on the whole slide. */
interface SlideBlocks {
  /** The top-level blocks before the whole-slide notes, each one's text as written (no blank lines around it). */
  blocks: Array<{ raw: string; token: Token }>;
  /** The notes after the slide's last block: comments on the whole slide. */
  slideNotes: string[];
}

/** Blank lines around a block's text go; the text itself (its indent too) stays as written. */
function trimmed(raw: string): string {
  return raw.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '');
}

/**
 * A slide's Markdown as its top-level blocks. Null when the lexer's blocks don't give the Markdown back as written
 * (then the join keeps the Markdown whole rather than move a part of it).
 */
function blocksOf(markdown: string): SlideBlocks | null {
  const tokens = lexBlockSlide(markdown);
  if (tokens.map(token => token.raw).join('') !== markdown) return null;
  const all = tokens.filter(token => token.type !== 'space');
  let end = all.length;
  while (end > 0 && isCommentBlock(all[end - 1])) end--;
  return {
    blocks: all.slice(0, end).map(token => ({ raw: trimmed(token.raw), token })),
    slideNotes: all.slice(end).map(token => trimmed(token.raw)),
  };
}

/** A title's block written as an H3, its words (and any comment in them) as they were. */
function asHeading3(raw: string, token: Tokens.Heading): string {
  const atx = /^( {0,3})#(?=[ \t]|$)/.exec(raw);
  if (atx) return `${atx[1]}###${raw.slice(atx[0].length)}`;
  // A setext title (`Title` over `===`): its lines without the underline.
  const lines = raw.split('\n');
  const words = lines.slice(0, -1).map(line => line.trim()).join(' ').trim() || token.text.trim();
  return `### ${words}`;
}

/** The place of slide N's title among its blocks: its first top-level H1, or -1. */
function titleIndexOf(blocks: SlideBlocks['blocks']): number {
  return blocks.findIndex(block => block.token.type === 'heading' && (block.token as Tokens.Heading).depth === 1);
}

/**
 * The Markdown of slide N−1 once slide N is joined into it. `upper` and `lower` are the two slides' Markdown (a block
 * slide's, after its header); `lowerData` is slide N's data, for its slide-wide picture.
 */
export function joinedSlideMarkdown(upper: string, lower: string, lowerData: Pick<SlideData, 'picture' | 'image'> = {}): string {
  const top = upper.replace(/\r\n?/g, '\n');
  const bottom = lower.replace(/\r\n?/g, '\n');
  const picturePath = sidePictureOf(lowerData as SlideData) && lowerData.image?.trim() ? lowerData.image : null;
  const picture = picturePath ? `![](${pictureTarget(picturePath)})` : null;
  const upperBlocks = blocksOf(top);
  const lowerBlocks = blocksOf(bottom);
  if (!upperBlocks || !lowerBlocks) {
    // Kept whole (a Markdown the lexer doesn't give back as written): nothing is moved inside either slide.
    return [trimmed(top), titledWhole(bottom), picture].filter((piece): piece is string => !!piece).join('\n\n');
  }
  // A moved block indented by 1 to 3 spaces means the same at column 0, but after a list it would become part of the
  // list's last item: the whole block is shifted left by its first line's indent (every line, so a list's items stay
  // siblings). An indented code block would become a paragraph inside that item: it moves as a fenced one, its words
  // as they were.
  const moved = lowerBlocks.blocks.map(block => movedBlock(block.raw, block.token));
  const title = titleIndexOf(lowerBlocks.blocks);
  if (title >= 0) moved[title] = asHeading3(moved[title], lowerBlocks.blocks[title].token as Tokens.Heading);
  if (picture) moved.push(picture);
  // Slide N's notes on its whole slide go onto its title (or its first block that moved), so they stay on what was
  // slide N. With nothing of slide N moving, they're on the joined slide's whole slide.
  const notesAt = title >= 0 ? title : 0;
  const lowerNotes = lowerBlocks.slideNotes;
  const upperRaw = upperBlocks.blocks.map(block => block.raw);
  const lowerRaw = moved.length ? [...moved.slice(0, notesAt), ...lowerNotes, ...moved.slice(notesAt)] : [];
  // An upper slide ending in a list, and a lower one whose first block (no title, no note before it) is a list of the
  // same kind: a blank line between them would make one loose list of both, spacing the upper slide's own items out.
  // Written as one tight list instead, the items in their order (the editor makes one list of two touching lists).
  const lastUpper = upperBlocks.blocks[upperBlocks.blocks.length - 1]?.token;
  const firstLower = lowerBlocks.blocks[0]?.token;
  // Only two tight lists: a loose one would make the joined list loose as a whole anyway.
  const touching = !!lastUpper && !!firstLower && lowerRaw[0] === moved[0] && title !== 0
    && lastUpper.type === 'list' && firstLower.type === 'list'
    && (lastUpper as Tokens.List).ordered === (firstLower as Tokens.List).ordered
    && !(lastUpper as Tokens.List).loose && !(firstLower as Tokens.List).loose;
  const joint = touching && upperRaw.length && lowerRaw.length ? [`${upperRaw.pop()}\n${lowerRaw.shift()}`] : [];
  const pieces = [
    ...upperRaw,
    ...joint,
    ...lowerRaw,
    ...upperBlocks.slideNotes,
    ...(moved.length ? [] : lowerNotes),
  ].filter(piece => piece !== '');
  return pieces.join('\n\n');
}

/** A moved block as written at column 0 (see `joinedSlideMarkdown`). */
function movedBlock(raw: string, token: Token): string {
  if (token.type === 'code' && !/^ {0,3}(`{3,}|~{3,})/.test(raw)) {
    const text = (token as Tokens.Code).text;
    const fence = '`'.repeat(Math.max(3, ...[...text.matchAll(/`{3,}/g)].map(match => match[0].length + 1)));
    return `${fence}\n${text}\n${fence}`;
  }
  const indent = /^( {1,3})\S/.exec(raw)?.[1].length ?? 0;
  if (!indent) return raw;
  const strip = new RegExp(`^ {1,${indent}}`);
  return raw.split('\n').map(line => line.replace(strip, '')).join('\n');
}

const PROBE = 'RitemarkJoinProbe';

/** Does a slide's Markdown end where a block may start: no code fence, comment or other block left open at its end? */
function endsClosed(markdown: string): boolean {
  const tokens = lexBlockSlide(`${markdown.replace(/\r\n?/g, '\n').replace(/\s+$/, '')}\n\n${PROBE}`).filter(token => token.type !== 'space');
  const last = tokens[tokens.length - 1];
  return !!last && last.type === 'paragraph' && last.raw.trim() === PROBE;
}

/**
 * Can these two slides be joined without one's words falling inside the other's open block? A slide that ends in a
 * code fence never closed would take everything after it, comments too, as code: shown as words on the stage, the wall
 * and the page (security review of this PR). Such a join isn't made.
 */
export function joinsCleanly(upper: string, lower: string): boolean {
  return endsClosed(upper) && endsClosed(lower);
}

/** Slide N's Markdown kept whole, its first line's H1 (outside a fence) written as an H3. */
function titledWhole(markdown: string): string {
  const lines = trimmed(markdown).split('\n');
  let fence = false;
  for (let index = 0; index < lines.length; index++) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(lines[index])) fence = !fence;
    if (!fence && /^ {0,3}#(?=[ \t]|$)/.test(lines[index])) {
      lines[index] = lines[index].replace(/^( {0,3})#/, '$1###');
      break;
    }
  }
  return lines.join('\n');
}

/**
 * Has a slide nothing of its own: no words, no picture and no setting? Only such a slide goes with Backspace in its empty
 * part. `markdown`: the Markdown it is drawn with (a block slide's own, or a v1 slide's as the conversion writes it);
 * `data`: its data; `notes`: a v1 slide's notes block.
 */
export function slideHasNothing(markdown: string, data: SlideData, notes: string | null): boolean {
  if (markdown.trim() !== '' || (notes ?? '').trim() !== '') return false;
  // Any key but its id with a value of its own is the slide's (a picture or its place, Skip slide, a library line, a
  // section mark, a v1 slide's words), so the slide isn't empty. A value that says nothing is no setting: an empty
  // word, `false`, a picture placed nowhere, an empty list of items or rows (Codex on #770).
  return Object.entries(data).every(([key, value]) => key === 'id' || key === 'markdown' || (key === 'picture' && value === 'none') || isBlank(value));
}

/** A value that holds nothing: none, an empty word, `false`, or a list or record of such values only. */
function isBlank(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isBlank);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isBlank);
  return false;
}
