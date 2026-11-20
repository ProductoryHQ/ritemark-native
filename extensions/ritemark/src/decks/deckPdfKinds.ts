/**
 * Sprint 170 (#881): Save as PDF's kinds, words and file names, pure (no Node), so the deck's bar and the host read
 * the same ones (`deckPdf.ts` saves; `DeckPublish.tsx` names the item).
 */
import type { DeckPdfKind } from './deckProtocol';

/** The view's kind: Slide only saves the slides, Slide and handout both, Handout only the handout (R2). */
export function pdfKindOfView(view: 'slide' | 'both' | 'handout'): DeckPdfKind {
  return view === 'slide' ? 'slides' : view === 'handout' ? 'handout' : 'slides-and-handout';
}

/**
 * The kind Publish's menu offers for the view: the view's own (Jarmo: the PDF saves what the view shows), when this app
 * makes it; null when it doesn't (no item, never one that saves another kind).
 */
export function pdfKindFor(view: 'slide' | 'both' | 'handout', kinds: readonly DeckPdfKind[]): DeckPdfKind | null {
  const wanted = pdfKindOfView(view);
  return kinds.includes(wanted) ? wanted : null;
}

/** The menu item's words for a kind (R2). */
export function pdfItemLabel(kind: DeckPdfKind): string {
  return kind === 'slides' ? 'Save slides as PDF…' : kind === 'handout' ? 'Save handout as PDF…' : 'Save slides and handout as PDF…';
}

/** The file's name for a kind (R7): "Day one.pdf", "Day one – slides and handout.pdf", "Day one – handout.pdf". */
export function pdfFileName(deckName: string, kind: DeckPdfKind): string {
  const name = deckName.trim() || 'Deck';
  return kind === 'slides' ? `${name}.pdf` : kind === 'handout' ? `${name} – handout.pdf` : `${name} – slides and handout.pdf`;
}
