/**
 * Sprint 161 (decision 8, Jarmo 17 November): the presenter view's "Your comments". Anything only the presenter should
 * see is a Ritemark comment in the slide's handout part: a standalone note (`<!-- … -->`, with an optional `{id:…}`) or
 * an anchored one (`<mark data-comment="…">words</mark>`). This reads a part's comments, in the order they are written,
 * the way the page reads the handout (`lexHandout`), so a comment inside a prompt (a code fence or a code span) is the
 * prompt's text, not a comment.
 *
 * Pure: the host reads the deck's text and sends the current part's comments to the presenter view alone.
 */
import type { Token } from 'marked';
import { lexHandout } from '../page/publicDeck';
import { commentsWrittenIn } from '../writtenComments';

/** One comment of a part: its note, and for an anchored comment the words it is on. */
export interface PartComment {
  note: string;
  words?: string;
}

/** The comments in raw HTML or text, in order (empty notes left out). */
function commentsIn(raw: string, out: PartComment[]): void {
  for (const comment of commentsWrittenIn(raw)) {
    if (!comment.note) continue;
    out.push(comment.words === undefined ? { note: comment.note } : { note: comment.note, words: comment.words });
  }
}

/** The text of a block or inline token that is not code: what a comment can be written in. */
function visit(tokens: Token[], out: PartComment[]): void {
  for (const token of tokens) {
    switch (token.type) {
      case 'code':
      case 'codespan':
        continue;
      case 'html':
        commentsIn(token.raw, out);
        continue;
      case 'paragraph':
      case 'heading':
      case 'text':
      case 'strong':
      case 'em':
      case 'del':
      case 'link': {
        const children = (token as { tokens?: Token[] }).tokens;
        if (children && children.length) {
          // An anchored comment spans tokens (`<mark …>`, words, `</mark>`): read the inline run as one, code left out.
          const raw = children.map(child => (child.type === 'codespan' ? '' : child.raw)).join('');
          commentsIn(raw, out);
        } else {
          commentsIn(token.raw, out);
        }
        continue;
      }
      case 'blockquote':
        visit((token as { tokens: Token[] }).tokens, out);
        continue;
      case 'list':
        for (const item of (token as { items: Array<{ tokens: Token[] }> }).items) visit(item.tokens, out);
        continue;
      case 'table': {
        // A cell is an inline run, as a paragraph's: an anchored comment's `<mark>`, words and `</mark>` read as one.
        const table = token as unknown as { header: Array<{ tokens: Token[] }>; rows: Array<Array<{ tokens: Token[] }>> };
        for (const cell of [...table.header, ...table.rows.flat()]) commentsIn(cell.tokens.map(child => (child.type === 'codespan' ? '' : child.raw)).join(''), out);
        continue;
      }
      default:
        continue;
    }
  }
}

/** A handout part's comments, in order. `extra` (an older slide's notes and hidden words, in memory) comes last. */
export function partComments(handout: string, extra?: string | null): PartComment[] {
  const out: PartComment[] = [];
  visit(lexHandout(handout), out);
  if (extra) commentsIn(extra, out);
  return out;
}
