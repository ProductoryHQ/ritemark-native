/**
 * Sprint 108 R4 — fold a word stream into speaker-attributed segments.
 *
 * Adapted from the shipped Scribe integration in `productory-videomark`
 * (research/elevenlabs-prior-art.md). Two of its rules are kept verbatim in
 * spirit because they were learned the hard way:
 *
 *   1. A segment's speaker is the MAJORITY vote of its words, not the first
 *      word's — diarization flickers on short interjections, and a segment
 *      labelled by a one-word "mhm" gets attributed to the wrong person.
 *   2. A speaker change forces a break — Scribe glues fast exchanges into one
 *      segment otherwise, and a two-speaker segment cannot be attributed.
 *
 * What is NOT carried over are videomark's subtitle constraints (12 words /
 * 90 chars). A transcript wants paragraph-shaped turns, so the caps are gone
 * and only a runaway guard remains.
 */

import type { TranscriptSegment, TranscriptWord } from './types';

export interface FoldOptions {
  /** A pause at least this long ends a segment. */
  breathSeconds: number;
  /** Hard ceiling so a monologue still breaks into readable chunks. */
  maxSegmentSeconds: number;
}

export const DEFAULT_FOLD_OPTIONS: FoldOptions = {
  breathSeconds: 0.7,
  maxSegmentSeconds: 30,
};

/** Joins words, then repairs the space before punctuation the join introduces. */
export function joinWords(words: TranscriptWord[]): string {
  return words
    .map((word) => word.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.!?:;])/g, '$1')
    .trim();
}

/** The speaker most of the words belong to, or undefined if none are labelled. */
export function majoritySpeaker(words: TranscriptWord[]): string | undefined {
  const votes = new Map<string, number>();
  for (const word of words) {
    if (word.speaker) votes.set(word.speaker, (votes.get(word.speaker) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [speaker, count] of votes) {
    if (count > bestCount) {
      best = speaker;
      bestCount = count;
    }
  }
  return best;
}

export function foldWordsIntoSegments(
  words: TranscriptWord[],
  options: FoldOptions = DEFAULT_FOLD_OPTIONS,
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: TranscriptWord[] = [];

  const flush = (): void => {
    const first = current[0];
    const last = current[current.length - 1];
    if (!first || !last) {
      current = [];
      return;
    }
    const text = joinWords(current);
    if (text) {
      const speaker = majoritySpeaker(current);
      segments.push({
        id: `seg-${segments.length}`,
        start: first.start,
        end: last.end,
        text,
        ...(speaker ? { speaker } : {}),
        words: current,
      });
    }
    current = [];
  };

  for (const word of words) {
    const previous = current[current.length - 1];

    if (previous) {
      const gap = word.start - previous.end;
      const speakerChanged = Boolean(previous.speaker && word.speaker && previous.speaker !== word.speaker);
      const tooLong = current[0] !== undefined && word.end - current[0].start > options.maxSegmentSeconds;

      if (gap >= options.breathSeconds || speakerChanged || tooLong) {
        flush();
      }
    }

    current.push(word);

    // Sentence end is a natural break, but only once the turn has some body —
    // otherwise "Yes." and "No." each become their own segment.
    if (/[.!?]$/.test(word.text.trim()) && current.length >= 4) {
      flush();
    }
  }

  flush();
  return segments;
}
