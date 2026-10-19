/**
 * Who is starting Ritemark: someone new, or someone updating from Ritemark 1
 * (Sprint 133, R10, W6). Pure: no `vscode` import.
 *
 * Read at the very start of `activate()`, before the activation keys are
 * confirmed. `ritemark.activation.lastConfirmedVersion` is the signal: empty
 * on a new profile, Ritemark 1's version on an updated one. This build's own
 * version is still 1.x until step 4 of 2.0, so after its first start the key
 * cannot tell the two apart any more: the kind is decided once, on the
 * profile's first start of this build, and stored (research/confirmations.md).
 */

/** globalState keys. */
export const WELCOME_KIND_KEY = 'ritemark.welcome.kind';
export const WELCOME_FINISHED_KEY = 'ritemark.welcome.finished';
/** For Sprint 134's What moved card on Home. */
export const UPDATED_FROM_1X_KEY = 'ritemark.updatedFrom1x';

export type ProfileKind = 'fresh' | 'update';

/** Which sheet a window with no folder shows: the welcome, the update welcome, or "Where do you want to start?". */
export type WelcomeKind = 'fresh' | 'update' | 'start';

export interface ProfileEvidence {
  /** The kind stored on an earlier start of this build. */
  storedKind: unknown;
  /** `ritemark.activation.lastConfirmedVersion`, '' when absent. */
  lastConfirmedVersion: string;
  /** Older 1.x profiles (before Sprint 93's activation keys): only Ritemark 1 wrote these. */
  hasAnonymousId: boolean;
  hasSeenNotice: boolean;
}

export interface FinishedRecord {
  kind: ProfileKind;
  at: string;
}

function isProfileKind(value: unknown): value is ProfileKind {
  return value === 'fresh' || value === 'update';
}

/** True for a version whose major number is below 2 ("1.14.0-0", "1.12.0-ext.2"). */
export function isRitemark1Version(version: string): boolean {
  const major = Number(/^(\d+)\./.exec(version.trim())?.[1]);
  return Number.isFinite(major) && major < 2;
}

/**
 * The profile's kind, and whether it must be stored now (its first start of
 * this build). A stored kind always wins.
 */
export function classifyProfile(evidence: ProfileEvidence): { kind: ProfileKind; store: boolean } {
  if (isProfileKind(evidence.storedKind)) return { kind: evidence.storedKind, store: false };
  const usedRitemark1 = (evidence.lastConfirmedVersion !== '' && isRitemark1Version(evidence.lastConfirmedVersion))
    || evidence.hasAnonymousId
    || evidence.hasSeenNotice;
  return { kind: usedRitemark1 ? 'update' : 'fresh', store: true };
}

/** The sheet for this profile: once a project has been opened from the welcome, the short start sheet. */
export function welcomeKind(kind: ProfileKind, finished: unknown): WelcomeKind {
  return isFinished(finished) ? 'start' : kind;
}

export function isFinished(value: unknown): value is FinishedRecord {
  return typeof value === 'object' && value !== null && isProfileKind((value as FinishedRecord).kind);
}

/**
 * Whether the welcome opens in this window at start (R1, R10, R11).
 * - With no folder: always (the welcome, the update welcome or the start sheet),
 *   unless the window is opening a file (R11): the file opens as asked.
 * - With a folder: only the update welcome, once, before it is finished.
 */
export function opensAtStart(input: { kind: WelcomeKind; hasFolder: boolean; openingFiles: boolean }): boolean {
  if (input.hasFolder) return input.kind === 'update';
  return !input.openingFiles;
}
