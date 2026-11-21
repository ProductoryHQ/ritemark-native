/**
 * Sprint 148 (R2): the text a reader sees in a Markdown document, through
 * `marked`'s lexer. A passage is a heading, a paragraph, a list item, a table
 * row, a quote's paragraph, a code block or a comment.
 *
 * Left out: front matter, link targets, image paths, HTML tags. Kept: a
 * comment's words, both a standalone `<!-- note -->` (without its `{id:…}`) and an
 * anchored `<mark data-comment="note">…</mark>`'s note, as a passage after its block.
 *
 * #936: in a deck, a slide's block (a top-level, closed ```slide block, as `parseDeck` reads one) is read as the
 * slide's words, never as its file's markup. One reading for both kinds: a v1 slide becomes the Markdown its block
 * slide would be (`legacyDataToBlocks`, how the deck converts it: its title, pill, number, boxes and rows), and a block
 * slide's Markdown is read without its header (`id:`, `picture:`, `image:`), its `:::` lines and its `{…}`
 * attributes. Each is a passage at the slide's block. A ```slide block in any other document stays a code block.
 */
import { isLineBreakTag } from '../../../decks/blocks/lineBreakTag';
import { CLOSE_FENCE, CODE_FENCE, CODE_FENCE_CLOSE, OPEN_FENCE, parseFenceAttributes } from '../../../decks/blocks/fencedDiv';
import { isBlockSlide, isSlideKind, slideDataOf, slideKindOfInfo, type SlideData } from '../../../decks/deckFormat';
import { legacyDataToBlocks } from '../../../decks/blocks/legacyToBlocks';
import { marked } from 'marked';
import { PassageSink, decodeEntities, type ReadOutcome } from './types';

interface Token {
  type: string;
  raw?: string;
  text?: string;
  lang?: string;
  tokens?: Token[];
  items?: Token[];
  header?: Array<{ text: string; tokens?: Token[] }>;
  rows?: Array<Array<{ text: string; tokens?: Token[] }>>;
}

const FRONT_MATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const STANDALONE_COMMENT = /^\s*<!--([\s\S]*?)-->\s*$/;
const COMMENT_ID = /^\s*\{id:[^}]*\}\s*/;
const NOTE_ATTRIBUTE = /data-comment="([^"]*)"/g;
const TAG = /<[^>]*>/g;

function stripTags(html: string, notes: string[]): string {
  for (const match of html.matchAll(NOTE_ATTRIBUTE)) if (match[1].trim()) notes.push(decodeEntities(match[1]));
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(TAG, '');
}

function inlineText(tokens: Token[] | undefined, fallback: string | undefined, notes: string[]): string {
  if (!tokens) return decodeEntities(fallback ?? '');
  let text = '';
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
      case 'escape':
        text += token.tokens ? inlineText(token.tokens, token.text, notes) : decodeEntities(token.text ?? '');
        break;
      case 'codespan':
        text += decodeEntities(token.text ?? '');
        break;
      case 'br':
        text += ' ';
        break;
      case 'image':
        break; // the path is not the person's words, and the picture isn't text
      case 'html':
      case 'tag':
        // A heading's line break is written `<br>` (#923): a space, as a `br` token's.
        if (isLineBreakTag(token.raw ?? token.text ?? '')) { text += ' '; break; }
        text += decodeEntities(stripTags(token.raw ?? token.text ?? '', notes));
        break;
      default:
        // strong, em, del, link (its text, not its target) and what a later marked adds
        text += token.tokens ? inlineText(token.tokens, token.text, notes) : decodeEntities(token.text ?? '');
    }
  }
  return text;
}

/**
 * A Pandoc attribute block where Pandoc reads one: right after a bracketed span, a link or a picture (`[Exercise]{.label}`,
 * `[Open](https://…){.button}`, `![Team](team.jpg){align=center}`), or ending a line (a heading's `{#id}`). A span's
 * words are kept. An inline code span is skipped whole, so `{.x}` written as code stays.
 */
const HEADING_LINE = /^ {0,3}#{1,6}[ \t]/;
const ATTRIBUTES = /(`+)[^`][\s\S]*?\1|(\[((?:\\.|[^\]\\])*)\](?!\())?(\{[^}\n]*\})/g;

/**
 * A block slide's Markdown as words: its `:::` lines blank, and each `{…}` attribute block the fenced-div reader reads
 * taken out (`ATTRIBUTES`). Code blocks inside stay as written.
 */
export function slideMarkdownWords(markdown: string): string {
  let fence: { char: string; size: number } | null = null;
  return markdown.split('\n').map((line) => {
    if (fence) {
      const close = CODE_FENCE_CLOSE.exec(line.replace(/\r$/, ''));
      if (close && close[1][0] === fence.char && close[1].length >= fence.size) fence = null;
      return line;
    }
    const open = CODE_FENCE.exec(line);
    if (open) { fence = { char: open[1][0], size: open[1].length }; return line; }
    const bare = line.replace(/\r$/, '');
    if (OPEN_FENCE.test(bare) || CLOSE_FENCE.test(bare)) return '';
    return line.replace(ATTRIBUTES, (whole: string, ticks: string | undefined, span: string | undefined, words: string | undefined, attrs: string | undefined, at: number) => {
      if (ticks !== undefined || attrs === undefined || !parseFenceAttributes(attrs)) return whole;
      if (span !== undefined) return words ?? '';
      // After a link or a picture, or ending a heading's line; anywhere else braces are words.
      const before = line[at - 1];
      const headingEnd = HEADING_LINE.test(line) && !line.slice(at + whole.length).trim();
      return before === ')' || before === ']' || headingEnd ? '' : whole;
    });
  }).join('\n');
}

/** A slide block's Markdown: a block slide's own, a v1 slide's as the deck converts it; null for a kind this build doesn't know. */
function slideMarkdown(kind: string, body: string): string | null {
  const data: SlideData = slideDataOf(kind, body);
  if (isBlockSlide(kind)) return data.markdown ?? '';
  if (isSlideKind(kind)) return legacyDataToBlocks(kind, data).markdown;
  return null;
}

/** A closed fence: its raw text ends with a fence line (an unclosed one runs to the end and is no slide, as `parseDeck` says). */
const CLOSED_FENCE = /\n {0,3}(`{3,}|~{3,})[ \t]*\n*$/;

function lex(text: string): Token[] {
  return marked.lexer(text, { gfm: true }) as unknown as Token[];
}

/** `deck`: the document is a deck (`.rtms`, or an older `.deck.md`), whose ```slide blocks are its slides. */
export function readMarkdown(source: string, budget: number, options: { deck?: boolean } = {}): ReadOutcome {
  const text = source.replace(FRONT_MATTER, '');
  let tokens: Token[];
  try {
    tokens = lex(text);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  const sink = new PassageSink(budget);
  const walk = (list: Token[], block: () => number, top = false) => {
    for (const token of list) {
      if (sink.full) return;
      const at = { block: block() };
      const notes: string[] = [];
      switch (token.type) {
        case 'heading':
        case 'paragraph':
        case 'text':
          sink.add(inlineText(token.tokens, token.text, notes), at);
          break;
        case 'code': {
          // Only a top-level, closed ```slide block in a deck is a slide (`parseDeck`'s rule).
          const kind = options.deck && top && CLOSED_FENCE.test(token.raw ?? '') ? slideKindOfInfo(token.lang ?? '') : null;
          const markdown = kind === null ? null : slideMarkdown(kind, token.text ?? '');
          if (markdown === null) {
            sink.add(token.text ?? '', at);
            break;
          }
          let inner: Token[];
          try {
            inner = lex(slideMarkdownWords(markdown));
          } catch {
            break;
          }
          walk(inner, () => at.block);
          break;
        }
        case 'blockquote':
          walk(token.tokens ?? [], () => at.block);
          break;
        case 'list':
          for (const item of token.items ?? []) {
            const own = (item.tokens ?? []).filter((child) => child.type !== 'list');
            sink.add(own.map((child) => inlineText(child.tokens, child.text, notes)).join(' '), at);
            walk((item.tokens ?? []).filter((child) => child.type === 'list'), () => at.block);
          }
          break;
        case 'table': {
          const row = (cells: Array<{ text: string; tokens?: Token[] }>) => cells.map((cell) => inlineText(cell.tokens, cell.text, notes).trim()).join(' · ');
          if (token.header) sink.add(row(token.header), at);
          for (const cells of token.rows ?? []) sink.add(row(cells), at);
          break;
        }
        case 'html': {
          const raw = token.raw ?? token.text ?? '';
          const comment = STANDALONE_COMMENT.exec(raw);
          if (comment) sink.add(decodeEntities(comment[1].replace(COMMENT_ID, '')), { ...at, comment: true });
          else sink.add(decodeEntities(stripTags(raw, notes)), at);
          break;
        }
        default:
          break; // space, hr, def
      }
      for (const note of notes) sink.add(note, { ...at, comment: true });
    }
  };
  let next = 0;
  walk(tokens, () => next++, true);
  return { ok: true, passages: sink.passages, truncated: sink.truncated };
}
