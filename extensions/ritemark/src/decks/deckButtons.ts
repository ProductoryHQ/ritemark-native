/**
 * Sprint 163 PR 3 (the decks README, "The Button block"): the addresses a deck's buttons open, read from the deck's text
 * the way the wall draws its slides. Present opens a button's address for the wall only when it is one of these, so a
 * message from the wall can never open anything the deck doesn't hold.
 *
 * Pure: no `vscode`, so the test reads the same set the host does.
 */
import { parseDeck, slideDataOf } from './deckFormat';
import { blockDataOf, drawsAsBlocks } from './blocks/convertDeck';
import { blockButtonAddresses, blockWordLinkAddresses } from './blocks/slideRenderer';

/** The full https addresses (`isButtonAddress`) the buttons on the deck's block slides open. */
export function deckButtonAddresses(text: string): Set<string> {
  const found = new Set<string>();
  for (const slide of parseDeck(text).slides) {
    if (!drawsAsBlocks(slide.kind)) continue;
    for (const address of blockButtonAddresses(drawnMarkdown(slide.kind, slide.body))) found.add(address);
  }
  return found;
}

/**
 * #930: the addresses the links in the deck's block slides' words open (`isWordLinkAddress`), read the way the wall
 * draws them. Present opens a word link for the wall only when it is one of these.
 */
export function deckWordLinkAddresses(text: string): Set<string> {
  const found = new Set<string>();
  for (const slide of parseDeck(text).slides) {
    if (!drawsAsBlocks(slide.kind)) continue;
    for (const address of blockWordLinkAddresses(drawnMarkdown(slide.kind, slide.body))) found.add(address);
  }
  return found;
}

/** A slide's Markdown as the wall draws it: a block slide's own, a v1 slide of the nine kinds' as converted (`blockDataOf`). */
function drawnMarkdown(kind: string, body: string): string {
  return blockDataOf(kind, slideDataOf(kind, body)).markdown ?? '';
}
