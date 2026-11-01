/**
 * Sprint 148 (R2): the text a reader sees in a Markdown document, through
 * `marked`'s lexer. A passage is a heading, a paragraph, a list item, a table
 * row, a quote's paragraph, a code block or a comment.
 *
 * Left out: front matter, link targets, image paths, HTML tags. Kept: a
 * comment's words, both a standalone `<!-- note -->` (without its `{id:…}`) and an
 * anchored `<mark data-comment="note">…</mark>`'s note, as a passage after its block.
 */
import { marked } from 'marked';
import { PassageSink, decodeEntities, type ReadOutcome } from './types';

interface Token {
  type: string;
  raw?: string;
  text?: string;
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
        text += decodeEntities(stripTags(token.raw ?? token.text ?? '', notes));
        break;
      default:
        // strong, em, del, link (its text, not its target) and what a later marked adds
        text += token.tokens ? inlineText(token.tokens, token.text, notes) : decodeEntities(token.text ?? '');
    }
  }
  return text;
}

export function readMarkdown(source: string, budget: number): ReadOutcome {
  const text = source.replace(FRONT_MATTER, '');
  let tokens: Token[];
  try {
    tokens = marked.lexer(text, { gfm: true }) as unknown as Token[];
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
        case 'code':
          sink.add(token.text ?? '', at);
          break;
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
          if (comment) sink.add(decodeEntities(comment[1].replace(COMMENT_ID, '')), at);
          else sink.add(decodeEntities(stripTags(raw, notes)), at);
          break;
        }
        default:
          break; // space, hr, def
      }
      for (const note of notes) sink.add(note, at);
    }
  };
  let next = 0;
  walk(tokens, () => next++);
  return { ok: true, passages: sink.passages, truncated: sink.truncated };
}
