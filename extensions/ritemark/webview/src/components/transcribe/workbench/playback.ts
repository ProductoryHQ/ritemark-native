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
 * Confidence threshold below which a word is marked as uncertain.
 *
 * Per-engine because the two scales are not the same shape: whisper's `p` is a
 * token probability that sits very high for ordinary words, while ElevenLabs'
 * value is `exp(logprob)` and spreads lower. Both were sampled against real
 * output — a 113s on-device run put 372 words between 0.115 and 1.0.
 *
 * Deliberately conservative: a false "uncertain" mark on every third word
 * teaches the user to ignore the highlight, which is worse than missing some.
 */
export function confidenceThreshold(engine: string): number {
  return engine === 'elevenlabs' ? 0.55 : 0.6;
}

export function isLowConfidence(word: WorkbenchWord, engine: string): boolean {
  return word.confidence !== undefined && word.confidence < confidenceThreshold(engine);
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
