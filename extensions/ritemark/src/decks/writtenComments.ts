/**
 * The two comment carriers every Ritemark document has, read from raw text: a standalone note (`<!-- … -->`, with an
 * optional leading `{id:…}`) and an anchored comment (`<mark data-comment="…" data-comment-id="…">words</mark>`). The
 * presenter view's "Your comments" (`present/partComments.ts`) and the slide's comments (`blocks/slideComments.ts`,
 * Sprint 161) read them with this. Pure, with no Node module, so the webview imports it too.
 */

/** The standalone note's id carrier (`commentMarkedExtension`'s rule): metadata, never part of the note. */
const ID_TOKEN = /^\{id:([0-9a-fA-F-]{36}|c-[a-z0-9]+-[a-z0-9]+)\}[ \t]*/;

function decodeEntities(value: string): string {
  return value.replace(/&(quot|amp|lt|gt|#39|#x27);/g, (_all, name: string) => ({ quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'", '#x27': "'" })[name] as string);
}

/** The words of an anchored comment, without the Markdown marks a reader wouldn't see. */
function plainWords(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
}

/** One comment written in raw HTML or text: its note, its id when it has one, and an anchored comment's words. */
export interface WrittenComment {
  /** The standalone note's `{id:…}` token, or the anchored comment's `data-comment-id`; null without one. */
  id: string | null;
  note: string;
  /** Present for an anchored comment (`<mark data-comment>`) only. */
  words?: string;
}

/** Every comment written in raw HTML or text, in order, empty notes included (a new comment whose box is still open). */
export function commentsWrittenIn(raw: string): WrittenComment[] {
  const out: WrittenComment[] = [];
  const scan = /<!--([\s\S]*?)-->|<mark\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/mark>/gi;
  let match: RegExpExecArray | null;
  while ((match = scan.exec(raw))) {
    if (match[1] !== undefined) {
      const body = match[1].trim();
      const id = ID_TOKEN.exec(body);
      out.push({ id: id ? id[1] : null, note: body.replace(ID_TOKEN, '').trim() });
      continue;
    }
    const attribute = /\bdata-comment\s*=\s*("([^"]*)"|'([^']*)')/i.exec(match[2]);
    if (!attribute) continue;
    const idAttribute = /\bdata-comment-id\s*=\s*("([^"]*)"|'([^']*)')/i.exec(match[2]);
    const id = idAttribute ? decodeEntities(idAttribute[2] ?? idAttribute[3] ?? '') || null : null;
    out.push({ id, note: decodeEntities(attribute[2] ?? attribute[3] ?? '').trim(), words: plainWords(match[3]) });
  }
  return out;
}
