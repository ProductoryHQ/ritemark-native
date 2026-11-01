/**
 * Sprint 148 (R2): what a reader returns. Each reader is pure over bytes.
 */
import type { PassageLocation } from '../../protocol';

export interface Passage {
  text: string;
  at: PassageLocation;
}

export type ReadOutcome =
  | {
      ok: true;
      passages: Passage[];
      /** Stopped at the text kept per document. */
      truncated: boolean;
      /** A CSV's first row. */
      columns?: string[];
    }
  | { ok: false; reason: 'protected' | 'scanned' | 'unreadable' | 'too-large' };

/** Bump when a reader's output changes: decision 3's copies of older text are dropped. */
export const READER_VERSION = 1;

/** Collects passages up to a budget of characters. */
export class PassageSink {
  readonly passages: Passage[] = [];
  private chars = 0;
  truncated = false;

  constructor(private readonly budget: number) {}

  get full(): boolean {
    return this.truncated;
  }

  add(text: string, at: PassageLocation): void {
    if (this.truncated) return;
    // Control characters out, and one space for each run of white space: a passage is shown on about two lines.
    const clean = text.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
    if (!clean) return;
    const room = this.budget - this.chars;
    if (clean.length > room) {
      if (room > 0) this.passages.push({ text: clean.slice(0, room), at });
      this.chars = this.budget;
      this.truncated = true;
      return;
    }
    this.passages.push({ text: clean, at });
    this.chars += clean.length;
  }
}

/** Text from bytes: UTF-8, or UTF-16 with its byte-order mark; a UTF-8 byte-order mark dropped. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  const text = new TextDecoder('utf-8').decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** XML and HTML character references. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ref.toLowerCase()] ?? whole;
  });
}
