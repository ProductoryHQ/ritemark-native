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

/** One comment of a part: its note, and for an anchored comment the words it is on. */
export interface PartComment {
  note: string;
  words?: string;
}

/** The standalone note's id carrier (`commentMarkedExtension`'s rule): metadata, never part of the note. */
const ID_TOKEN = /^\{id:([0-9a-fA-F-]{36}|c-[a-z0-9]+-[a-z0-9]+)\}[ \t]*/;

function decodeEntities(value: string): string {
  return value.replace(/&(quot|amp|lt|gt|#39|#x27);/g, (_all, name: string) => ({ quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'", '#x27': "'" })[name] as string);
}

/** The words of an anchored comment, without the Markdown marks a reader wouldn't see. */
function plainWords(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
}

/** The comments in raw HTML or text, in order. */
function commentsIn(raw: string, out: PartComment[]): void {
  const scan = /<!--([\s\S]*?)-->|<mark\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/mark>/gi;
  let match: RegExpExecArray | null;
  while ((match = scan.exec(raw))) {
    if (match[1] !== undefined) {
      const note = match[1].trim().replace(ID_TOKEN, '').trim();
      if (note) out.push({ note });
      continue;
    }
    const attribute = /\bdata-comment\s*=\s*("([^"]*)"|'([^']*)')/i.exec(match[2]);
    if (!attribute) continue;
    const note = decodeEntities(attribute[2] ?? attribute[3] ?? '').trim();
    if (note) out.push({ note, words: plainWords(match[3]) });
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
