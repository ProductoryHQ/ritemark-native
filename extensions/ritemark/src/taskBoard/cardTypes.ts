/**
 * cardTypes — the task-board card model, without any parsing (Sprint 130, #119).
 *
 * Kept apart from `cardFile.ts` so the board webviews can import the types and
 * constants without bundling a YAML parser. No imports, no Node built-ins.
 */

export const CARD_FORMAT = 'task/1';
export const CARD_FOLDER = '.ritemark/tasks';

export const CARD_STAGES = ['idea', 'todo', 'doing', 'done'] as const;
export type CardStage = (typeof CARD_STAGES)[number];

/** Who did something. `you` is the user; the board is single-user (a shared
 *  folder shows everyone as "You", a stated limit). */
export const CARD_ACTORS = ['you', 'claude', 'codex', 'opencode'] as const;
export type CardActor = (typeof CARD_ACTORS)[number];

export const REVIEW_VERDICTS = ['ready', 'unclear', 'already-on-board', 'not-a-task'] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];
export const REVIEW_SIZES = ['small', 'medium', 'large'] as const;
export type ReviewSize = (typeof REVIEW_SIZES)[number];

/** Bounds on what the board and the agent tools write. Reading is lenient: a
 *  hand-edited title of 300 characters still reads; the board just never
 *  writes one. */
export const CARD_LIMITS = {
  title: 200,
  doneWhen: 200,
  files: 20,
  history: 50,
  summary: 280,
  resultFiles: 20,
  check: 3,
  checkItem: 160,
  question: 500,
  optionsMin: 2,
  optionsMax: 4,
  option: 80,
  /** Descriptions written through agent tools; the user's own file has no cap. */
  toolDescriptionBytes: 16 * 1024,
} as const;

export interface CardHistoryEntry {
  at: string;
  /** Normally a `CardActor`; a hand-edited file may say anything. */
  by: string;
  what: string;
}

export interface CardResult {
  by: string;
  at: string;
  seconds?: number;
  summary: string;
  files: string[];
  check: string[];
}

export interface CardAsk {
  by: string;
  at: string;
  question: string;
  options: string[];
}

export interface CardReview {
  by: string;
  at: string;
  verdict: ReviewVerdict;
  why: string;
  size: ReviewSize;
  title: string;
  description: string;
}

export interface Card {
  id: string;
  title: string;
  doneWhen?: string;
  stage: CardStage;
  /** Order within the stage, compared as plain text (see `rankBetween`). */
  rank: string;
  files: string[];
  created?: string;
  updated?: string;
  result?: CardResult;
  ask?: CardAsk;
  review?: CardReview;
  dropped?: boolean;
  /**
   * When the user archived the card (Sprint 130, D15): off the board, the side
   * bar and Your calls, listed under Archive, restorable. '' when a hand-edited
   * file says `archived: true` without a time.
   */
  archived?: string;
  history: CardHistoryEntry[];
  /** The Markdown body, exactly as it is in the file. */
  description: string;
}
