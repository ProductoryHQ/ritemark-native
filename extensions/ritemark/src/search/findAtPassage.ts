/**
 * Sprint 148, PR 4 (R9): a document opens at its passage.
 *
 * Opening a search result opens the document as before; this module then asks the document's page to open its
 * find bar on the result's match. It carries the match the index found (the word as it stands in the text and
 * which occurrence of it), never the person's query, and it touches no document state: the page only opens its
 * find bar. A page that isn't listening yet gets the request when it says it is; a page that never does leaves the
 * document at its top, as opening it from the tree does.
 *
 * Pure: no `vscode` import, so the editors' providers and the tests share it.
 */
import type { DocumentFormat, SearchResult } from './protocol';

/** Host → page. The Markdown editor, the Word preview and the PDF preview handle it. */
export interface FindOpenMessage {
  type: 'find:open';
  /** The literal text to find: the matched word at its full length. Plain text, never HTML or a pattern. */
  text: string;
  /** Which case-insensitive occurrence of `text` in the document to land on (0-based). */
  occurrence: number;
  /** PDF only: the passage's page, for when the occurrence can't be found again. */
  page?: number;
}

/** The formats whose pages have a find bar. A CSV opens at its top (R9: the table has no find bar). */
export const FIND_FORMATS: readonly DocumentFormat[] = ['markdown', 'docx', 'pdf'];

export const MAX_FIND_TEXT = 200;
export const MAX_OCCURRENCE = 1_000_000;
/** How long a request waits for its page to say it is listening. */
export const FIND_WAIT_MS = 15_000;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/** The message for a result, or null when there is nothing to land on (a name, a CSV, a comment, a chat). */
export function findOpenMessage(result: SearchResult): FindOpenMessage | null {
  if (result.kind !== 'document' || !result.format || !FIND_FORMATS.includes(result.format)) return null;
  const match = result.match;
  if (!match || typeof match.text !== 'string') return null;
  const text = match.text;
  if (!text.trim() || text.length > MAX_FIND_TEXT || CONTROL.test(text)) return null;
  const occurrence = Number.isInteger(match.occurrence) && match.occurrence >= 0 && match.occurrence <= MAX_OCCURRENCE ? match.occurrence : 0;
  const message: FindOpenMessage = { type: 'find:open', text, occurrence };
  const page = result.passage?.at.page;
  if (result.format === 'pdf' && Number.isInteger(page) && (page as number) >= 1) message.page = page;
  return message;
}

type Post = (message: FindOpenMessage) => Thenable<unknown> | unknown;
interface Thenable<T> { then(onfulfilled?: (value: T) => unknown, onrejected?: (reason: unknown) => unknown): unknown }

/**
 * Requests by document key (`Uri.toString()`), and the pages listening for each. Never throws to its callers:
 * a page that fails to take the message just stays at its top.
 */
export class FindRequests {
  private readonly pending = new Map<string, { message: FindOpenMessage; at: number }>();
  private readonly pages = new Map<string, Map<object, Post>>();

  constructor(private readonly now: () => number = Date.now, private readonly waitMs = FIND_WAIT_MS) {}

  /** Opened from a result: post to the document's listening pages, or keep it until one says it is listening. */
  request(key: string, message: FindOpenMessage): 'posted' | 'waiting' {
    // A request no page took in time goes, so a document opened elsewhere (a Markdown file in the text editor)
    // and later in Ritemark doesn't open a find bar nobody asked for.
    const now = this.now();
    for (const [waitingKey, waiting] of this.pending) if (now - waiting.at > this.waitMs) this.pending.delete(waitingKey);
    const listening = this.pages.get(key);
    if (listening && listening.size > 0) {
      this.pending.delete(key);
      for (const post of listening.values()) send(post, message);
      return 'posted';
    }
    this.pending.set(key, { message, at: now });
    return 'waiting';
  }

  /** A page of `key` is listening (it said ready, or asked for its status once drawn). */
  ready(key: string, page: object, post: Post): void {
    let listening = this.pages.get(key);
    if (!listening) this.pages.set(key, (listening = new Map()));
    listening.set(page, post);
    const waiting = this.pending.get(key);
    if (!waiting) return;
    this.pending.delete(key);
    if (this.now() - waiting.at <= this.waitMs) send(post, waiting.message);
  }

  /** The page closed. */
  gone(key: string, page: object): void {
    const listening = this.pages.get(key);
    if (!listening) return;
    listening.delete(page);
    if (listening.size === 0) this.pages.delete(key);
  }

  /** For tests. */
  waiting(key: string): FindOpenMessage | null {
    return this.pending.get(key)?.message ?? null;
  }

  /** For tests: how many requests wait. */
  waitingCount(): number {
    return this.pending.size;
  }
}

function send(post: Post, message: FindOpenMessage): void {
  try {
    const sent = post(message) as Thenable<unknown> | undefined;
    if (sent && typeof sent.then === 'function') sent.then(undefined, () => {});
  } catch {
    // The page went away between the check and the post: it stays at its top.
  }
}

/** One per extension host: the search host asks, the three providers answer. */
export const findRequests = new FindRequests();
