/**
 * The handout's start card (Sprint 159, 16 November; the Experience lead's frame 20): "Start this deck", under the
 * first part of a deck New → Deck just made. Pure: no `vscode` and no React, so the host, the deck view and the test
 * read the same rules.
 *
 * Which decks have it: a deck is "fresh" from New → Deck until its card goes. The host keeps that mark in the window's
 * workspace state, never in the person's file (the README leaves the way open; a mark in the file would be one more line
 * people and other AIs see and copy, and it would travel with the file to a copy or a colleague). The card goes once
 * the deck has a second slide or any handout text, or when × is pressed, or when one of its rows is used; the view then
 * tells the host, which drops the mark, so the card never comes back to that deck.
 */

import type { DeckNoticeReporter } from './deckProtocol';
import type { EarlierDeck } from './newDeck';

/** The earlier decks the card shows before "All decks…". */
export const START_CARD_SHOWN = 3;

/** What the host says about a deck view's start card (`deck/start-card`). */
export interface StartCardState {
  /** The deck was made by New → Deck and its card hasn't gone yet. */
  fresh: boolean;
  /** The AI that drafts it, when one is signed in: its id (as the AI's sheet names it) and its name ("Claude"). */
  ai: { id: string; name: string } | null;
  /** The project's earlier decks, newest first (`earlierDecks`). */
  earlier: EarlierDeck[];
}

/**
 * Has the deck been started: a second slide, or any words in the handout. Then the card goes, for good. A deck's own
 * title (typed on the slide or in the part's head) is not handout text, so typing it keeps the card.
 */
export function deckStarted(slideCount: number, handoutHasText: boolean): boolean {
  return slideCount > 1 || handoutHasText;
}

/** The card's rows as the deck view draws them, or null for no card. */
export function startCardRows(input: {
  fresh: boolean;
  dismissed: boolean;
  slideCount: number;
  handoutHasText: boolean;
  aiReady: boolean;
  earlierCount: number;
}): { ask: boolean; copy: boolean } | null {
  if (!input.fresh || input.dismissed || deckStarted(input.slideCount, input.handoutHasText)) return null;
  const ask = input.aiReady;
  const copy = input.earlierCount > 0;
  return ask || copy ? { ask, copy } : null;
}

/**
 * Where the one card is drawn (#917, the Experience lead, 20 November): at the handout's top whenever the handout shows
 * (Slide and handout, or the handout alone), and under the slide in Slide only, where the handout is folded away. Never
 * both, and never in a folded handout: a new deck opens in Slide only, so a card kept in the hidden handout left the
 * deck's first minute an empty title slide.
 */
export function startCardPlace(slideShown: boolean, handoutShown: boolean): 'handout' | 'slide' | null {
  if (handoutShown) return 'handout';
  return slideShown ? 'slide' : null;
}

/**
 * Draft's message to the AI, as the person's own: what they wrote, as a request to draft this deck (attached to the
 * message as the document in front). The AI writes the slides and the handout with its deck tools.
 */
export function draftRequest(words: string): string {
  return `Draft this deck: ${words.trim()}`;
}

/** What Draft needs from the host (`decksHost.ts`). */
export interface DraftSteps {
  /** The AI Draft goes to, or null when none is signed in. */
  ai: () => Promise<{ id: string; name: string } | null>;
  /** The card goes for good. */
  forget: () => Promise<void>;
  /** The deck is saved, so the AI reads it as the person sees it; false when the save was refused. */
  save: () => Promise<boolean>;
  /**
   * The AI's sheet's path for a visible chat with a request (Home's ready request): the AI column opens if it is folded,
   * and the words go as the person's first message, with the document in front (this deck) attached.
   */
  startChat: (request: { runtimeId: string; text: string; send: true }) => Promise<void>;
  notice: DeckNoticeReporter;
}

/**
 * Draft: one message to the AI, with this deck attached; then the card goes for good. False when nothing was sent (no
 * AI signed in, or the AI's sheet couldn't take it): the card stays, and the bar says why.
 */
export async function sendDraft(words: string, steps: DraftSteps): Promise<boolean> {
  const ai = await steps.ai();
  if (!ai) {
    steps.notice('No AI is signed in, so nothing was sent.', 'failure');
    return false;
  }
  // A deck that couldn't be saved is not sent: the AI would read the older file
  if (!(await steps.save().catch(() => false))) {
    steps.notice('The deck could not be saved, so nothing was sent.', 'failure');
    return false;
  }
  try {
    await steps.startChat({ runtimeId: ai.id, text: draftRequest(words), send: true });
  } catch {
    steps.notice(`The message could not be sent to ${ai.name}.`, 'failure');
    return false;
  }
  await steps.forget();
  steps.notice('', 'success');
  return true;
}

/** Draft's words, at most this long. */
export const MAX_DRAFT_WORDS = 4000;

/** The window's workspace state, as far as the marks need it (a `vscode.Memento`). */
export interface MarkStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

/**
 * The decks New made whose card hasn't gone, by their file path (as the host normalizes it), the newest `max` kept: a
 * deck New made and never opened again is forgotten in time.
 */
export function freshDeckMarks(store: MarkStore, key: string, max: number) {
  const list = (): string[] => {
    const value = store.get<unknown>(key);
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  };
  return {
    has: (deck: string) => list().includes(deck),
    add: async (deck: string) => { await store.update(key, [...list().filter(entry => entry !== deck), deck].slice(-max)); },
    remove: async (deck: string) => {
      const marks = list();
      if (marks.includes(deck)) await store.update(key, marks.filter(entry => entry !== deck));
    },
  };
}
