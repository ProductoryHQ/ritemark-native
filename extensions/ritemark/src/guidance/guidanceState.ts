/**
 * Sprint 140 (R2, R14; experience 35, *For the build*): which one guidance card
 * Home draws under Waiting for you. Pure: dates are local calendar days as `YYYY-MM-DD`, given by the
 * caller.
 */

const GUIDANCE_ORDER = ['what-moved', 'ready-request', 'quick-look', 'open-source'] as const;
export type GuidanceCard = typeof GUIDANCE_ORDER[number];

/** Saved days needed to qualify for the open-source card. */
export const SAVED_DAYS_FOR_OPEN_SOURCE = 3;

export interface GuidanceInput {
  /** What moved is due: a profile updated from Ritemark 1, before Got it (2.0's rule). */
  whatMoved: boolean;
  /** The ready request is due in this project (R6). */
  readyRequest: boolean;
  /** The open-source card is locally eligible. */
  openSource: boolean;
  quickLook: boolean;
}

/** Choose one card for a newly opened slot. */
export function guidanceCard(input: GuidanceInput): GuidanceCard | null {
  const eligible = {
    'ready-request': input.readyRequest,
    'quick-look': input.quickLook,
    'what-moved': input.whatMoved,
    'open-source': input.openSource,
  };
  return GUIDANCE_ORDER.find(card => eligible[card]) ?? null;
}

/** The local calendar day of a moment, as `YYYY-MM-DD`. */
export function localDay(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The saved days with `day` added, distinct and sorted; kept short, as only the count up to three matters. */
export function withSavedDay(days: readonly string[], day: string): string[] {
  if (days.includes(day)) return [...days];
  return [...days, day].sort().slice(-SAVED_DAYS_FOR_OPEN_SOURCE);
}
