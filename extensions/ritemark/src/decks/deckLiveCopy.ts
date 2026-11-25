import type { LivePause } from '../publish/publishRecords';

export const LIVE_HELP = 'Open pages catch up within about 15\u00a0seconds.';
export const LIVE_TIP = `The page follows this deck. ${LIVE_HELP}`;
export const PAUSE_TAIL = 'Open pages keep what they had.';

export function keyPauseDetail(slide?: number): string {
  return `${slide === undefined ? 'The handout' : `Slide ${slide}`} has what looks like a key.`;
}

export function outsidePauseDetail(slide: number | undefined, files: readonly string[]): string {
  const subject = slide === undefined ? 'The handout' : `Slide ${slide}`;
  const [first, ...others] = files;
  if (!first) return `${subject} shows a file outside the deck's folder.`;
  const count = others.length;
  return count
    ? `${subject} shows ${first} and ${count} other ${count === 1 ? 'file' : 'files'}, which are outside the deck's folder.`
    : `${subject} shows ${first}, which is outside the deck's folder.`;
}

export function pausedTip(pause: LivePause): string {
  const subject = pause.slide === undefined ? 'the handout' : `slide ${pause.slide}`;
  const key = `${subject} has what looks like a key.`;
  const outside = `${subject} shows a file outside the deck's folder.`;
  const detail = pause.kind === 'key' ? key : pause.kind === 'outside' ? outside : pause.detail;
  return `Paused: ${detail.charAt(0).toLowerCase()}${detail.slice(1)} ${PAUSE_TAIL}`;
}
