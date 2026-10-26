/**
 * The landing (Sprint 133, R6, W5): where the welcome sent the person, written
 * before the window reloads into the folder and read once after. Pure: no
 * `vscode` import; `welcomeHost.ts` reads and writes globalState.
 */

import type { WelcomeProvider } from '../analytics/events';

export const LANDING_KEY = 'ritemark.welcome.landing.v1';

/** A landing older than this is dropped (R6). */
export const LANDING_MAX_AGE_MS = 10 * 60 * 1000;

export type ProjectSource = 'existing_folder' | 'new_project' | 'recent' | 'sample';

export interface LandingRecord {
  /** The folder's URI, as `Uri.toString()`. */
  folder: string;
  /** The AI the person signed in with, or null when they skipped. */
  provider: WelcomeProvider | null;
  source: ProjectSource;
  /** Sent as `project_opened` (R8): from the welcome or the update welcome, not the start sheet. */
  counted: boolean;
  /** Epoch milliseconds. */
  at: number;
}

export function isLandingRecord(value: unknown): value is LandingRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.folder === 'string'
    && (record.provider === null || record.provider === 'claude' || record.provider === 'chatgpt' || record.provider === 'opencode')
    && (record.source === 'existing_folder' || record.source === 'new_project' || record.source === 'recent' || record.source === 'sample')
    && typeof record.counted === 'boolean'
    && typeof record.at === 'number';
}

export type LandingDecision =
  /** No landing for this window; delete any record that was there. */
  | { action: 'none'; deleteRecord: boolean }
  /** Land on this window's folder. */
  | { action: 'land'; record: LandingRecord }
  /** The folder the welcome sent the person to is not there: say so and show step 2 again. */
  | { action: 'folder-gone'; record: LandingRecord };

/**
 * What to do after the reload. Lands once, only on the folder the welcome
 * sent the person to, only within ten minutes; opening any other folder later
 * does not repeat it (S22).
 */
export function decideLanding(input: {
  stored: unknown;
  /** This window's first folder, as `Uri.toString()`, if any. */
  windowFolder: string | undefined;
  folderExists: boolean;
  now: number;
}): LandingDecision {
  if (input.stored === undefined) return { action: 'none', deleteRecord: false };
  if (!isLandingRecord(input.stored)) return { action: 'none', deleteRecord: true };
  const record = input.stored;
  const age = input.now - record.at;
  if (age < 0 || age > LANDING_MAX_AGE_MS) return { action: 'none', deleteRecord: true };
  if (input.windowFolder !== undefined && input.windowFolder !== record.folder) return { action: 'none', deleteRecord: true };
  if (!input.folderExists) return { action: 'folder-gone', record };
  if (input.windowFolder === undefined) return { action: 'none', deleteRecord: false };
  return { action: 'land', record };
}

/**
 * Sprint 143 (#551, R2): why a window that may have come from the welcome has
 * no landing, for the extension host's log; null when there is nothing to
 * say. A missing record is said only when the welcome finished in the last
 * ten minutes (an ordinary window logs nothing). Never a count.
 */
export function whyNoLanding(input: {
  stored: unknown;
  windowFolder: string | undefined;
  now: number;
  /** When the welcome last finished, epoch ms, if it did. */
  welcomeFinishedAt: number | undefined;
}): string | null {
  if (input.stored === undefined) {
    const finished = input.welcomeFinishedAt;
    return finished !== undefined && input.now - finished >= 0 && input.now - finished <= LANDING_MAX_AGE_MS
      ? 'the welcome finished, but it left no landing record'
      : null;
  }
  if (!isLandingRecord(input.stored)) return 'the landing record could not be read';
  const age = input.now - input.stored.at;
  if (age < 0 || age > LANDING_MAX_AGE_MS) return 'the landing record is older than ten minutes';
  if (input.windowFolder !== undefined && input.windowFolder !== input.stored.folder) return 'the landing record is for another folder';
  return null;
}

/** "Ask Claude about this project" (R6): the AI the person signed in with, by its own name. */
export function landingPlaceholder(provider: WelcomeProvider | null): string | null {
  switch (provider) {
    case 'claude': return 'Ask Claude about this project';
    case 'chatgpt': return 'Ask ChatGPT about this project';
    case 'opencode': return 'Ask OpenCode about this project';
    default: return null;
  }
}
