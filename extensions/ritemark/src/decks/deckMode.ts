/**
 * Which files open as decks (Sprint 157). Pure, so the test reads the same rule the editor uses.
 */
import { deckVersionOf, isReadableDeckVersion } from './deckFormat';
import { isDeckPath } from './deckFileName';

// The rule itself lives in deckFileName.ts (no imports), shared with the lists' names and icons (Sprint 159, deck icons)
export { isDeckPath };

/**
 * Does this file open as a deck? The flag `decks` is on, the file is on disk, its name ends `.deck.md`, and its front
 * matter's `deck:` is absent or at most 1 (a later format opens as a document rather than be rewritten).
 */
export function deckModeOf(input: { flagOn: boolean; scheme: string; fsPath: string; text: string }): boolean {
  if (!input.flagOn || input.scheme !== 'file' || !isDeckPath(input.fsPath)) return false;
  // The front matter only: this runs for every payload the editor sends the view.
  return isReadableDeckVersion(deckVersionOf(input.text));
}

/**
 * Sprint 159 (PR 2): a value per open view, decided the first time it is asked (as the view opens) and kept while the
 * view lives. Keyed weakly by view. The editor keeps each panel's `decks` flag, as it opened, in one.
 */
export class ModeFixedPerView<View extends object> {
  private readonly modes = new WeakMap<View, boolean>();

  of(view: View, decide: () => boolean): boolean {
    let mode = this.modes.get(view);
    if (mode === undefined) {
      mode = decide();
      this.modes.set(view, mode);
    }
    return mode;
  }
}
