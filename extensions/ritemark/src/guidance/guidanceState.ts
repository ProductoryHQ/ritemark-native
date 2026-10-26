/**
 * Sprint 140 (R2, R14; experience 35, *For the build*): which one guidance card
 * Home draws under Waiting for you, and the saved days that make the feedback
 * card due. Pure: dates are local calendar days as `YYYY-MM-DD`, given by the
 * caller.
 */

export type GuidanceCard = 'what-moved' | 'ready-request' | 'feedback';

/** The feedback card is due from the third day with a saved document in this release (R14). */
export const SAVED_DAYS_FOR_FEEDBACK = 3;

export interface GuidanceInput {
  /** What moved is due: a profile updated from Ritemark 1, before Got it (2.0's rule). */
  whatMoved: boolean;
  /** The ready request is due in this project (R6). */
  readyRequest: boolean;
  /** The feedback card is due: the third saved day reached, not yet answered in this release. */
  feedback: boolean;
  /** Today, local. */
  today: string;
  /** The last day the ready request showed on Home, in any project. */
  readyShownOn: string | undefined;
}

/**
 * One card at a time, in the drawn order: What moved, the ready request, the
 * feedback card. On a day the ready request showed, the feedback card waits;
 * the next day Home opens it takes the place once, even where the ready
 * request is still due, and the ready request returns as soon as Send or Not
 * now ends it (D1).
 */
export function guidanceCard(input: GuidanceInput): GuidanceCard | null {
  if (input.whatMoved) return 'what-moved';
  if (input.feedback && (!input.readyRequest || input.readyShownOn !== input.today)) return 'feedback';
  if (input.readyRequest) return 'ready-request';
  return null;
}

/** The local calendar day of a moment, as `YYYY-MM-DD`. */
export function localDay(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** A release is major.minor: an extension update within 2.1 is not a new release (R14). */
export function releaseOf(version: string): string {
  const match = /^(\d+)\.(\d+)/.exec(version);
  return match ? `${match[1]}.${match[2]}` : version;
}

/** The saved days with `day` added, distinct and sorted; kept short, as only the count up to three matters. */
export function withSavedDay(days: readonly string[], day: string): string[] {
  if (days.includes(day)) return [...days];
  return [...days, day].sort().slice(-SAVED_DAYS_FOR_FEEDBACK);
}

export function feedbackDue(input: { savedDays: readonly string[]; answered: boolean }): boolean {
  return !input.answered && input.savedDays.length >= SAVED_DAYS_FOR_FEEDBACK;
}
