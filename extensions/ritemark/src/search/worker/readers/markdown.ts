/**
 * Sprint 148 (R2): the text a reader sees in a Markdown document, through
 * `marked`'s lexer. A passage is a heading, a paragraph, a list item, a table
 * row, a quote's paragraph, a code block or a comment.
 *
 * Left out: front matter, link targets, image paths, HTML tags. Kept: a
 * comment's words, both a standalone `<!-- note -->` (without its `{id:…}`) and an
 * anchored `<mark data-comment="note">…</mark>`'s note, as a passage after its block.
 *
 * #936: in a deck, a slide's block is read as the slide's words, never as its file's markup: a v1 slide's title,
 * subtitle, boxes and rows (read with `slideDataOf`, the decks' own reader), a block slide's Markdown without its header
 * (`id:`, `picture:`), its `:::` lines and its `{…}` attributes. Each is a passage at the slide's block. A ```slide
 * block in any other document stays a code block.
 */
import { isLineBreakTag } from '../../../decks/blocks/lineBreakTag';
import { CLOSE_FENCE, CODE_FENCE, CODE_FENCE_CLOSE, OPEN_FENCE, parseFenceAttributes } from '../../../decks/blocks/fencedDiv';
import { isBlockSlide, slideDataOf, slideKindOfInfo, type SlideData } from '../../../decks/deckFormat';
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

/** A Pandoc attribute block, `{.label}`, `{align=center width=50%}`, a link's or a span's brackets before it. */
const ATTRIBUTES = /(\[((?:\\.|[^\]\\])*)\](?!\())?(\{[^}\n]*\})/g;

/**
 * A block slide's Markdown as words: its `:::` lines blank, and each `{…}` attribute block the fenced-div reader reads
 * taken out, a bracketed span's words kept (`[Exercise]{.label}` → `Exercise`). Code blocks inside stay as written.
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
    return line.replace(ATTRIBUTES, (whole, span: string | undefined, words: string | undefined, attrs: string) => {
      if (!parseFenceAttributes(attrs)) return whole;
      return span !== undefined ? (words ?? '') : '';
    });
  }).join('\n');
}

/** A v1 slide's words, in the order the slide draws them: its title, subtitle, pill, each box's heading and text, each row. */
function v1SlideWords(data: SlideData): string[] {
  return [
    data.title, data.subtitle, data.tag,
    ...(data.items ?? []).map((item) => [item.heading, item.text].filter(Boolean).join(' ')),
    ...(data.rows ?? []).map((row) => row.map((cell) => cell.trim()).join(' · ')),
  ].filter((words): words is string => !!words);
}

function lex(text: string): Token[] {
  return marked.lexer(text, { gfm: true }) as unknown as Token[];
}

/** `deck`: the document is a deck (`.deck.md`), whose ```slide blocks are its slides. */
export function readMarkdown(source: string, budget: number, options: { deck?: boolean } = {}): ReadOutcome {
  const text = source.replace(FRONT_MATTER, '');
  let tokens: Token[];
  try {
    tokens = lex(text);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  const sink = new PassageSink(budget);
  const walk = (list: Token[], block: () => number) => {
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
          const kind = options.deck ? slideKindOfInfo(token.lang ?? '') : null;
          if (kind === null) {
            sink.add(token.text ?? '', at);
            break;
          }
          const data = slideDataOf(kind, token.text ?? '');
          if (!isBlockSlide(kind)) {
            for (const words of v1SlideWords(data)) sink.add(words, at);
            break;
          }
          let inner: Token[];
          try {
            inner = lex(slideMarkdownWords(data.markdown ?? ''));
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
  walk(tokens, () => next++);
  return { ok: true, passages: sink.passages, truncated: sink.truncated };
}
