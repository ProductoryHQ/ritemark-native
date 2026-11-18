/**
 * Sprint 163 PR 3 (the decks README, "The Button block"): the addresses a deck's buttons open, read from the deck's text
 * the way the wall draws its slides. Present opens a button's address for the wall only when it is one of these, so a
 * message from the wall can never open anything the deck doesn't hold.
 *
 * Pure: no `vscode`, so the test reads the same set the host does.
 */
import { isBlockSlide, parseDeck, slideDataOf } from './deckFormat';
import { blockButtonAddresses } from './blocks/slideRenderer';

/** The full https addresses (`isButtonAddress`) the buttons on the deck's block slides open. */
export function deckButtonAddresses(text: string): Set<string> {
  const found = new Set<string>();
  for (const slide of parseDeck(text).slides) {
    if (!isBlockSlide(slide.kind)) continue;
    for (const address of blockButtonAddresses(slideDataOf(slide.kind, slide.body).markdown ?? '')) found.add(address);
  }
  return found;
}
