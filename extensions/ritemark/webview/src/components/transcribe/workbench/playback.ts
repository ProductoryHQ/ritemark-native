/**
 * Sprint 108 R7/R8/R9 — the workbench's pure logic, kept out of the components
 * so it can be tested without a DOM or an audio element.
 */

export interface WorkbenchWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
  confidence?: number;
}

export interface WorkbenchSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: WorkbenchWord[];
}

export interface WorkbenchSpeaker {
  id: string;
  label: string;
  colorIndex: number;
}

interface PlaybackEventTarget {
  tagName?: string;
  isContentEditable?: boolean;
  parentElement?: PlaybackEventTarget | null;
  getAttribute?: (name: string) => string | null;
}

/** Sprint 113 R5: editor controls own Space/arrows before the player does. */
export function isInteractivePlaybackTarget(target: unknown): boolean {
  const interactiveTags = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A']);
  const interactiveRoles = new Set(['button', 'link', 'textbox', 'combobox', 'slider', 'spinbutton']);
  let current = target as PlaybackEventTarget | null;

  for (let depth = 0; current && depth < 20; depth++) {
    if (current.tagName && interactiveTags.has(current.tagName.toUpperCase())) return true;
    if (current.isContentEditable) return true;
    const contentEditable = current.getAttribute?.('contenteditable');
    if (contentEditable !== null && contentEditable !== undefined && contentEditable !== 'false') return true;
    const role = current.getAttribute?.('role');
    if (role && interactiveRoles.has(role)) return true;
    current = current.parentElement ?? null;
  }
  return false;
}

/**
 * Which segment is playing at `time`.
 *
 * Binary search rather than a scan: this runs on every `timeupdate` (~4/s) over
 * a list that is 600+ segments for an hour-long meeting.
 *
 * Returns the segment CONTAINING the time, or the last one that started before
 * it — during a gap between segments the previous line stays highlighted, which
 * is what a reader following along expects. -1 before the first segment starts.
 */
export function activeSegmentIndex(segments: WorkbenchSegment[], time: number): number {
  if (segments.length === 0) return -1;
  if (time < segments[0].start) return -1;

  let low = 0;
  let high = segments.length - 1;
  let answer = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (segments[mid].start <= time) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return answer;
}

/** Speaker palette. Indigo first — the brand accent leads (ritemark-design). */
export const SPEAKER_COLORS = [
  { dot: '#4338CA', text: '#3730A3' },
  { dot: '#0EA5E9', text: '#0369A1' },
  { dot: '#059669', text: '#047857' },
  { dot: '#D97706', text: '#B45309' },
  { dot: '#DB2777', text: '#BE185D' },
  { dot: '#7C3AED', text: '#6D28D9' },
] as const;

export function speakerColor(colorIndex: number): (typeof SPEAKER_COLORS)[number] {
  return SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
}

/** How many segments a rename will touch — shown before confirming (R8). */
export function segmentsForSpeaker(segments: WorkbenchSegment[], speakerId: string): number {
  return segments.filter((segment) => segment.speaker === speakerId).length;
}

/**
 * Confidence below which a word is a candidate for the uncertainty mark.
 *
 * 0.55 was measured against real on-device output (372 words from a 2-minute
 * recording): nothing at all falls below 0.5, and 0.55 catches the mis-heard
 * proper noun without dragging in the whole function-word tail.
 *
 * The same number is used for ElevenLabs, whose scale is `exp(logprob)` rather
 * than a token probability. That is an assumption, not a measurement — it needs
 * a real diarized recording to tune, which is a QA item rather than a guess to
 * bake in as two different-looking constants.
 */
export function confidenceThreshold(_engine: string): number {
  return 0.55;
}

/**
 * Short words are excluded from marking regardless of confidence.
 *
 * Measured against real on-device output: the low-probability tail is dominated
 * by short function words at segment boundaries — "and" (0.52), "The" (0.54),
 * "One" (0.54) — where whisper is unsure about the boundary, not the word. The
 * genuinely useful mark in the same sample was "Merike" (0.52), a name. Marking
 * every uncertain "and" teaches the reader to ignore the highlight, which
 * costs more than the misses.
 *
 * Length rather than a stopword list: Ritemark is used in Estonian as much as
 * English, and a per-language word list would rot.
 */
const MIN_MARKED_WORD_LENGTH = 4;

export function isLowConfidence(word: WorkbenchWord, engine: string): boolean {
  if (word.confidence === undefined) return false;
  if (word.confidence >= confidenceThreshold(engine)) return false;

  const letters = word.text.replace(/[^\p{L}\p{N}]/gu, '');
  return letters.length >= MIN_MARKED_WORD_LENGTH;
}

/** The label to show for a segment, or null when nobody is attributed. */
export function speakerLabelFor(
  speakers: WorkbenchSpeaker[],
  speakerId: string | undefined,
): string | null {
  if (!speakerId) return null;
  return speakers.find((speaker) => speaker.id === speakerId)?.label ?? speakerId;
}

/** `1:02:14` past an hour, `02:14` below it. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

/**
 * Reduce stored peaks to the number of bars that fit the canvas.
 *
 * Takes the MAX of each bucket, not the mean: averaging flattens transients and
 * the waveform stops looking like speech.
 */
export function resamplePeaks(peaks: number[], targetBars: number): number[] {
  if (targetBars <= 0 || peaks.length === 0) return [];
  if (peaks.length <= targetBars) return peaks.slice();

  const out: number[] = [];
  const bucket = peaks.length / targetBars;
  for (let i = 0; i < targetBars; i++) {
    const from = Math.floor(i * bucket);
    const to = Math.min(peaks.length, Math.floor((i + 1) * bucket));
    let max = 0;
    for (let j = from; j < to; j++) {
      if (peaks[j] > max) max = peaks[j];
    }
    out.push(max);
  }
  return out;
}
