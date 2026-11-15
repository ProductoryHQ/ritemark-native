/**
 * Which files open as decks (Sprint 157). Pure, so the test reads the same rule the editor uses.
 */
import { deckVersionOf, isReadableDeckVersion } from './deckFormat';

/** A deck's file name ends `.deck.md`, in any case. */
export function isDeckPath(fsPath: string): boolean {
  return /\.deck\.md$/i.test(fsPath);
}

/**
 * Does this file open as a deck? The flag `decks` is on, the file is on disk, its name ends `.deck.md`, and its front
 * matter's `deck:` is absent or at most 1 (a later format opens as a document rather than be rewritten).
 */
export function deckModeOf(input: { flagOn: boolean; scheme: string; fsPath: string; text: string }): boolean {
  if (!input.flagOn || input.scheme !== 'file' || !isDeckPath(input.fsPath)) return false;
  // The front matter only: this runs for every payload the editor sends the view.
  return isReadableDeckVersion(deckVersionOf(input.text));
}
