/**
 * Sprint 161 (experience 46, "Comments on the slide, for Claude"; Jarmo, 16 November): what a comment on a block slide
 * is on, read from the slide's Markdown. The notation is the handout's own (experience 11), inside the slide block:
 *
 *  - **on the words:** an anchored comment, `<mark data-comment="…" data-comment-id="…">words</mark>`;
 *  - **on a block:** a standalone note, `<!-- {id:…} … -->`, written right before the block it is on, at the slide's
 *    top level (the title, a line, a list, a table, a picture, or a Columns, Boxes or Steps block whole);
 *  - **on the whole slide:** a standalone note with no block after it (the slide's last lines).
 *
 * Nothing new is written: these are the two comment carriers every Ritemark document has, so the handout's tokenizer,
 * the host's task ledger (`{id:…}` / `data-comment-id`) and every privacy filter (`publicMarkdown`, the renderer's
 * `html: () => ''`) already know them. Only their place says what they are on.
 *
 * The words a person reads about it ("On the four boxes, slide 6") are here too, in one place, for the card's head and
 * the AI's prompt. Pure: no DOM, no `vscode`; the webview and the host import it.
 */
import type { Token, Tokens } from 'marked';
import { isBlockSlide, parseDeck, slideDataOf } from '../deckFormat';
import { quotedForAI, slideTitleLine, type CurrentSlideEntry, type SlideAtSend } from '../currentSlide';
import { isDeckPath, splitFileName } from '../deckFileName';
import { isCurrentSlideId } from '../deckProtocol';
import { slideBlockClassOf, type FenceAttributes } from './fencedDiv';
import { isCommentBlock, isRevealListToken, lexBlockSlide } from './slideRenderer';
import { commentsWrittenIn } from '../writtenComments';

/** What a block on a slide is, as a person names it. */
export type SlideBlockKind =
  | 'title' | 'heading' | 'text' | 'list' | 'table' | 'picture' | 'quote' | 'code' | 'rule'
  | 'columns' | 'column' | 'boxes' | 'box' | 'steps' | 'block';

export interface SlideBlockShape {
  kind: SlideBlockKind;
  /** How many columns or boxes a Columns or Boxes block holds. */
  count?: number;
}

/** What a comment on a slide is on. */
export type SlideAnchor =
  | { kind: 'words'; words: string }
  | { kind: 'block'; block: SlideBlockShape }
  | { kind: 'slide' };

export interface SlideComment {
  id: string | null;
  note: string;
  anchor: SlideAnchor;
}

interface SlideDivToken {
  type: 'slideDiv';
  raw: string;
  attrs: FenceAttributes;
  tokens: Token[];
}

/** An HTML block that holds only comments (and space): a standalone note, or several. */
const isNoteBlock = isCommentBlock;

/** A lone picture in its paragraph, which the renderer and the editor draw as a block of its own. */
function isPictureParagraph(token: Token): boolean {
  const children = (token as Tokens.Paragraph).tokens ?? [];
  const words = children.filter(child => !(child.type === 'text' && !child.raw.trim()));
  return words.length === 1 && words[0].type === 'image';
}

/** A block token as a person names it. `firstTitle` says whether an H1 is the slide's title. */
export function blockShapeOf(token: Token, firstTitle = true): SlideBlockShape {
  switch (token.type) {
    case 'heading':
      return { kind: (token as Tokens.Heading).depth === 1 && firstTitle ? 'title' : 'heading' };
    case 'paragraph':
      return { kind: isPictureParagraph(token) ? 'picture' : 'text' };
    case 'list':
      return { kind: 'list' };
    case 'table':
      return { kind: 'table' };
    case 'blockquote':
      return { kind: 'quote' };
    case 'code':
      return { kind: 'code' };
    case 'hr':
      return { kind: 'rule' };
    case 'slideDiv': {
      const div = token as unknown as SlideDivToken;
      // README item 18: a list in its `::: incremental` wrapper is the list, to a person.
      if (isRevealListToken(div)) return { kind: 'list' };
      const kind = slideBlockClassOf(div.attrs);
      if (kind === 'columns' || kind === 'boxes') {
        const count = div.tokens.filter(child => child.type === 'slideDiv').length;
        return { kind, count };
      }
      return { kind: kind ?? 'block' };
    }
    default:
      return { kind: 'text' };
  }
}

/** The raw text of an inline run, code spans left out: an anchored comment spans tokens (`<mark …>`, words, `</mark>`). */
function inlineRaw(tokens: Token[] | undefined, fallback: string): string {
  if (!tokens || !tokens.length) return fallback;
  return tokens.map(child => (child.type === 'codespan' ? '' : child.raw)).join('');
}

/** The comments written inside one block's words (anchored ones, and a note written inside a paragraph). */
function wordsComments(token: Token, block: SlideBlockShape, out: SlideComment[]): void {
  const take = (raw: string) => {
    for (const written of commentsWrittenIn(raw)) {
      const anchor: SlideAnchor = written.words !== undefined ? { kind: 'words', words: written.words } : { kind: 'block', block };
      out.push({ id: written.id, note: written.note, anchor });
    }
  };
  switch (token.type) {
    case 'code':
    case 'hr':
      return;
    case 'paragraph':
    case 'heading':
    case 'text':
      take(inlineRaw((token as { tokens?: Token[] }).tokens, token.raw));
      return;
    case 'html':
      take(token.raw);
      return;
    case 'blockquote':
      for (const child of (token as Tokens.Blockquote).tokens) wordsComments(child, block, out);
      return;
    case 'list':
      for (const item of (token as Tokens.List).items) for (const child of item.tokens) wordsComments(child, block, out);
      return;
    case 'table': {
      const table = token as Tokens.Table;
      for (const cell of [...table.header, ...table.rows.flat()]) take(inlineRaw(cell.tokens, cell.text));
      return;
    }
    default:
      return;
  }
}

/**
 * The comments in one container's tokens (the slide's top level, or a block's inside), in order. A note is on the
 * block after it in the same container (notes after it skipped); with none after it, on the container: the whole slide
 * at the top level, the block itself inside one.
 */
function visit(tokens: Token[], container: SlideAnchor, out: SlideComment[], titleSeen: { value: boolean }): void {
  const blocks = tokens.filter(token => token.type !== 'space');
  for (let index = 0; index < blocks.length; index++) {
    const token = blocks[index];
    if (isNoteBlock(token)) {
      const next = blocks.slice(index + 1).find(candidate => !isNoteBlock(candidate));
      const anchor: SlideAnchor = next ? { kind: 'block', block: blockShapeOf(next, !titleSeen.value) } : container;
      for (const written of commentsWrittenIn(token.raw)) out.push({ id: written.id, note: written.note, anchor });
      continue;
    }
    const shape = blockShapeOf(token, !titleSeen.value);
    if (token.type === 'heading' && (token as Tokens.Heading).depth === 1) titleSeen.value = true;
    if (token.type === 'slideDiv') {
      visit((token as unknown as SlideDivToken).tokens, { kind: 'block', block: shape }, out, titleSeen);
      continue;
    }
    wordsComments(token, shape, out);
  }
}

/**
 * Every comment on a block slide, in the order it is written, each with what it is on. Empty notes are kept (a new
 * comment whose box is open); an anchored comment over several blocks (one id) is one comment, its words joined.
 * Read once per Markdown (the strip and the bar ask on every change): the list is shared, so it is never changed.
 */
export function slideCommentsOf(markdown: string): readonly SlideComment[] {
  if (!markdown.includes('<!--') && !/<mark\b/i.test(markdown)) return [];
  const cached = commentsCache.get(markdown);
  if (cached) return cached;
  if (commentsCache.size > 500) commentsCache.clear();
  const comments = readSlideComments(markdown);
  commentsCache.set(markdown, comments);
  return comments;
}

const commentsCache = new Map<string, readonly SlideComment[]>();

function readSlideComments(markdown: string): readonly SlideComment[] {
  const out: SlideComment[] = [];
  visit(lexBlockSlide(markdown), { kind: 'slide' }, out, { value: false });
  const merged: SlideComment[] = [];
  const byId = new Map<string, SlideComment>();
  for (const comment of out) {
    const same = comment.id ? byId.get(comment.id) : undefined;
    if (same && same.anchor.kind === 'words' && comment.anchor.kind === 'words') {
      same.anchor = { kind: 'words', words: `${same.anchor.words} ${comment.anchor.words}`.trim() };
      continue;
    }
    if (comment.id) byId.set(comment.id, comment);
    merged.push(comment);
  }
  return merged;
}

/** How many comments a slide carries, as the strip's dot and the deck's bar count them: the ones with words. */
export function slideCommentCount(markdown: string): number {
  return slideCommentsOf(markdown).filter(comment => comment.note.trim()).length;
}

const COUNT_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** "the four boxes", "the title", "the picture". */
export function blockWords(block: SlideBlockShape): string {
  const many = (one: string, several: string) => {
    const count = block.count ?? 0;
    if (count <= 1) return `the ${one}`;
    return `the ${COUNT_WORDS[count] ?? String(count)} ${several}`;
  };
  switch (block.kind) {
    case 'title': return 'the title';
    case 'heading': return 'the heading';
    case 'text': return 'the text';
    case 'list': return 'the list';
    case 'table': return 'the table';
    case 'picture': return 'the picture';
    case 'quote': return 'the quote';
    case 'code': return 'the code';
    case 'rule': return 'the line';
    case 'columns': return many('column', 'columns');
    case 'column': return 'the column';
    case 'boxes': return many('box', 'boxes');
    case 'box': return 'the box';
    case 'steps': return 'the steps';
    default: return 'the block';
  }
}

/** At most this many characters of the words a comment is on, in its card's head. */
const WORDS_MAX = 40;

/** The words a comment is on, short enough for one line: "“Make each box…”". */
export function quotedWords(words: string): string {
  const line = words.replace(/\s+/g, ' ').trim();
  const short = line.length > WORDS_MAX ? `${line.slice(0, WORDS_MAX - 1).trimEnd()}…` : line;
  return `“${short}”`;
}

/** The card's head line: "On the four boxes, slide 6", "On “Ask it three…”, slide 6", "On slide 6". */
export function anchorLine(anchor: SlideAnchor, slideNumber: number): string {
  switch (anchor.kind) {
    case 'slide': return `On slide ${slideNumber}`;
    case 'block': return `On ${blockWords(anchor.block)}, slide ${slideNumber}`;
    case 'words': return anchor.words.trim() ? `On ${quotedWords(anchor.words)}, slide ${slideNumber}` : `On slide ${slideNumber}`;
  }
}

/** A comment found on a deck's slide: the slide's number (from 1), the deck's slide count, its id and title. */
export interface CommentOnSlide {
  number: number;
  count: number;
  id?: string;
  title?: string;
  comment: SlideComment;
}

/**
 * Every comment on a deck's block slides, by its id, with the slide it is on: the deck read once (a task with many
 * comments reads it once too). A handout comment, or one without an id, isn't in it.
 */
export function commentsOnSlides(deckText: string): Map<string, CommentOnSlide> {
  const found = new Map<string, CommentOnSlide>();
  if (!deckText.includes('<!--') && !/<mark\b/i.test(deckText)) return found;
  const slides = parseDeck(deckText).slides;
  slides.forEach((slide, index) => {
    if (!isBlockSlide(slide.kind)) return;
    const data = slideDataOf(slide.kind, slide.body);
    for (const comment of slideCommentsOf(data.markdown ?? '')) {
      if (!comment.id || found.has(comment.id)) continue;
      found.set(comment.id, {
        number: index + 1,
        count: slides.length,
        ...(data.id ? { id: data.id } : {}),
        ...(data.title ? { title: data.title } : {}),
        comment,
      });
    }
  });
  return found;
}

/**
 * The slide a comment (by its id) is on in a deck's text, or null when it isn't on a slide (a handout comment, or
 * none).
 */
export function commentOnSlide(deckText: string, commentId: string): CommentOnSlide | null {
  if (!commentId || !deckText.includes(commentId)) return null;
  return commentsOnSlides(deckText).get(commentId) ?? null;
}

/**
 * The prompt's line for a comment on a slide: `On slide 6 of 15 ("An assistant's four parts", id k3f9), on the four
 * boxes.` The title is one line and quoted as the current slide's line quotes it (`quotedForAI`), so it can't end the
 * line.
 */
export function commentPlaceLine(found: CommentOnSlide): string {
  const title = found.title ? slideTitleLine(found.title) : '';
  const facts = [title ? quotedForAI(title) : '', found.id ? `id ${found.id}` : ''].filter(Boolean).join(', ');
  const anchor = found.comment.anchor;
  const what = anchor.kind === 'slide' ? 'on the whole slide' : anchor.kind === 'block' ? `on ${blockWords(anchor.block)}` : 'on the words below';
  return `On slide ${found.number} of ${found.count}${facts ? ` (${facts})` : ''}, ${what}.`;
}

/** The prompt's place lines for a deck's comments, by comment id: only those on a slide. */
export function slideCommentPlaces(displayPath: string, deckText: string, commentIds: readonly string[]): Map<string, string> {
  const places = new Map<string, string>();
  if (!isDeckPath(displayPath)) return places;
  const all = commentsOnSlides(deckText);
  for (const id of commentIds) {
    const found = all.get(id);
    if (found) places.set(id, commentPlaceLine(found));
  }
  return places;
}

/** A deck's name from its path, as the library names it: the file's name without `.deck.md`, on any platform. */
function deckNameOf(path: string): string {
  return splitFileName(path.split(/[\\/]/).pop() ?? path).name;
}

/**
 * The slide (or slides) a comment task is about, as the composer's chip names a slide (`SlideAtSend`): its message
 * carries it, so its chip says "Slide 6 · <title>" and the AI reads "this slide" as that one. Null when none of the
 * comments is on a slide.
 */
export function slideAtSendForComments(displayPath: string, deckText: string, commentIds: readonly string[]): SlideAtSend | null {
  if (!isDeckPath(displayPath)) return null;
  const all = commentsOnSlides(deckText);
  const entries: CurrentSlideEntry[] = [];
  let count = 0;
  for (const id of commentIds) {
    const found = all.get(id);
    if (!found || entries.some(entry => entry.number === found.number)) continue;
    count = found.count;
    entries.push({ number: found.number, ...(isCurrentSlideId(found.id) ? { id: found.id } : {}), ...(found.title ? { title: slideTitleLine(found.title) } : {}) });
  }
  if (!entries.length) return null;
  entries.sort((a, b) => a.number - b.number);
  return { path: displayPath, slide: { deck: slideTitleLine(deckNameOf(displayPath)), count, slides: entries } };
}
