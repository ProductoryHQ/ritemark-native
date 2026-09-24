/**
 * Sprint 123 (#283) — finding text in a transcript, as pure functions.
 *
 * Search reads the text exactly as the transcript shows it: a segment with no
 * uncertain words is its plain text; a segment with uncertain words is shown
 * word by word (`SegmentText`), so it is searched as those words joined the
 * same way. A match may cross word boundaries. Nothing here touches the
 * session — it only reads what is loaded.
 */
import { foldCase, matchCountLabel, normalizeQuery, stepMatch } from '../../../utils/textSearch';
import { isLowConfidence, type WorkbenchSegment } from './playback';

// Shared with the document previews; re-exported so the workbench keeps one import site.
export { matchCountLabel, normalizeQuery, stepMatch };

/** One piece of a segment as `SegmentText` renders it: the whole text, or one word. */
export interface TextRun {
  text: string;
  lowConfidence: boolean;
}

export interface TranscriptMatch {
  segmentIndex: number;
  /** Offsets into the segment's shown text (the runs joined). */
  start: number;
  end: number;
}

export type PieceKind = 'text' | 'match' | 'current';

export interface RunPiece {
  text: string;
  kind: PieceKind;
}

/** The runs a segment renders as — kept in step with `SegmentText`. */
export function segmentRuns(segment: WorkbenchSegment, engine: string): TextRun[] {
  const words = segment.words;
  if (!words || !words.some((word) => isLowConfidence(word, engine))) {
    return [{ text: segment.text, lowConfidence: false }];
  }
  return words.map((word) => ({ text: `${word.text} `, lowConfidence: isLowConfidence(word, engine) }));
}

/** Every non-overlapping, case-insensitive match, in reading order. */
export function findTranscriptMatches(
  segments: readonly WorkbenchSegment[],
  engine: string,
  query: string,
): TranscriptMatch[] {
  const needle = normalizeQuery(query);
  if (!needle) return [];
  const matches: TranscriptMatch[] = [];
  segments.forEach((segment, segmentIndex) => {
    const haystack = foldCase(segmentRuns(segment, engine).map((run) => run.text).join(''));
    let from = 0;
    for (;;) {
      const start = haystack.indexOf(needle, from);
      if (start < 0) break;
      matches.push({ segmentIndex, start, end: start + needle.length });
      from = start + needle.length;
    }
  });
  return matches;
}

/**
 * Split each run at match boundaries. `ranges` are one segment's matches in
 * its shown text; `currentRange` is the index among them that is the current
 * match, or -1. Runs keep their own identity, so a word the engine was unsure
 * about is still one word, now in several pieces.
 */
export function splitRunsAtMatches(
  runs: readonly TextRun[],
  ranges: ReadonlyArray<{ start: number; end: number }>,
  currentRange: number,
): Array<{ run: TextRun; pieces: RunPiece[] }> {
  let offset = 0;
  return runs.map((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;

    const pieces: RunPiece[] = [];
    let cursor = runStart;
    ranges.forEach((range, index) => {
      const start = Math.max(range.start, runStart);
      const end = Math.min(range.end, runEnd);
      if (start >= end) return;
      if (start > cursor) pieces.push({ text: run.text.slice(cursor - runStart, start - runStart), kind: 'text' });
      pieces.push({ text: run.text.slice(start - runStart, end - runStart), kind: index === currentRange ? 'current' : 'match' });
      cursor = end;
    });
    if (cursor < runEnd) pieces.push({ text: run.text.slice(cursor - runStart), kind: 'text' });
    return { run, pieces };
  });
}
