/**
 * Sprint 124 (#284) R4 — find text in a rendered document.
 *
 * A document is text spread over many DOM text nodes; a match may span nodes
 * (a word split by formatting) but never crosses from one block — paragraph,
 * table cell — into the next. Pure: callers pass the nodes' text and block
 * boundaries, and get back node/offset pairs to build DOM Ranges from.
 */
import { findAll, normalizeQuery } from '../../utils/textSearch';

export interface TextChunk {
  text: string;
  /** This chunk starts a new block (paragraph, cell…) — no match may cross into it. */
  newBlock: boolean;
}

export interface ChunkPosition {
  chunk: number;
  offset: number;
}

export interface DocumentMatch {
  start: ChunkPosition;
  end: ChunkPosition;
}

// A character no query contains once trimmed, so no match can span it.
const BLOCK_SEPARATOR = '\u0000';

export function findDocumentMatches(chunks: readonly TextChunk[], query: string): DocumentMatch[] {
  const needle = normalizeQuery(query);
  if (!needle || chunks.length === 0) return [];

  // Join, remembering where each chunk starts in the joined text.
  const starts: number[] = [];
  let joined = '';
  chunks.forEach((chunk, i) => {
    if (i > 0 && chunk.newBlock) joined += BLOCK_SEPARATOR;
    starts.push(joined.length);
    joined += chunk.text;
  });

  const locate = (pos: number, isEnd: boolean): ChunkPosition => {
    // The chunk containing `pos`; an end offset may sit at the very end of a chunk.
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] < pos || (!isEnd && starts[mid] === pos)) lo = mid;
      else hi = mid - 1;
    }
    return { chunk: lo, offset: pos - starts[lo] };
  };

  return findAll(joined, needle).map((start) => ({
    start: locate(start, false),
    end: locate(start + needle.length, true),
  }));
}
