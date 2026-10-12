/**
 * boardPrompt — the message a card sends to its conversation (Sprint 130).
 *
 * Two texts, as every Sprint 109 turn keeps them apart: `displayText` is what
 * the conversation shows as the user's message, and reads like the user's own
 * request (title, Done when, description, file paths); `prompt` is what the
 * runtime receives, the same plus one line naming the card when the agent has
 * the board tools. How to report back is in the agent's standing Ritemark
 * context (capability context, W5), never in the message.
 */

import type { Card } from './cardTypes';

export type CardTurnKind = 'give' | 'follow-up' | 'answer' | 'retry';

export interface CardTurnText {
  displayText: string;
  prompt: string;
}

/** The card's own request: title, Done when, description, files. */
export function cardRequestText(card: Card): string {
  const parts = [card.title.trim()];
  if (card.doneWhen?.trim()) parts.push(`Done when: ${card.doneWhen.trim()}`);
  const description = card.description.trim();
  if (description) parts.push(description);
  if (card.files.length) parts.push(`Files: ${card.files.join(', ')}`);
  return parts.join('\n\n');
}

/**
 * The texts for one turn. `give` (and `retry` of a give) sends the card's
 * request; `follow-up` and `answer` send the user's own words (or "I choose: …").
 */
export function buildCardTurn(card: Card, turn: { kind: CardTurnKind; text?: string }, options: { boardTools: boolean }): CardTurnText {
  const displayText = turn.kind === 'give' || !turn.text?.trim() ? cardRequestText(card) : turn.text.trim();
  const prompt = options.boardTools ? `${displayText}\n\n(This is card ${card.id} on the project's task board.)` : displayText;
  return { displayText, prompt };
}
