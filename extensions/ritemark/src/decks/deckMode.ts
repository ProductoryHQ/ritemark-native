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

/**
 * Sprint 159 (PR 2): a value per open view, decided the first time it is asked (as the view opens) and kept while the
 * view lives. Keyed weakly by view. The editor keeps each view's flag in one (`viewDeckMode`).
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

/**
 * Sprint 159 (PR 2): does this open view show its file as a deck now? The flag is the one the view opened with, kept
 * in `flags` while the view lives: a deck keeps its mode until it is opened again, whatever the flag does meanwhile
 * ("Applies to decks opened afterwards"), and a document view never turns into a deck view. The rest is read live, as
 * `deckModeOf` reads it: a deck rewritten to a later `deck:` version by another program falls back to a document
 * rather than be rewritten in this build's format.
 */
export function viewDeckMode<View extends object>(flags: ModeFixedPerView<View>, view: View, flagNow: () => boolean, file: { scheme: string; fsPath: string; text: string }): boolean {
  return deckModeOf({ ...file, flagOn: flags.of(view, flagNow) });
}

