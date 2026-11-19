# Sprint 167 technical plan

File pointers only, from a narrow read-only look at main (dfc0ad3c). Paths are under `extensions/ritemark/webview/src/components/decks/` unless stated. Each PR's author confirms them before editing.

## PR 1: logo corner (E)
- `theme/LogoRow.tsx`: the Where control, becoming two segments.
- `src/decks/deckTheme.ts`: `LogoPlace`, `LOGO_PLACES`, `DEFAULT_LOGO_PLACE` and the `logo-place:` key; keep old values readable.
- `slide/SlideCanvas.tsx` (`logoPlace`, `themeSlideLogo`), `slide/slideMarkup.ts`, `src/decks/blocks/slideRenderer.ts` and `src/decks/page/pageHtml.ts`: where the logo is drawn and the room made for it.
- `slide/slide.css`: the logo room rules, apart from Sprint 164 PR 2's spacing lines.

## PR 2: Mark (C)
- `src/decks/blocks/fencedDiv.ts`: `OWN_MARK_LOOKS` (steps, line, arrows) and `boxesDrawnAttributes`.
- `blocks/slideDivView.ts` draws the marks; `blocks/blockBar.ts` and `blocks/SlideBlockBar.tsx` get the Mark menu. Follows Sprint 164 PR 3, which edits the bar.
- Parity: `blocks/slideRenderer.parity.test.ts`, `blocks/slideBlocks.roundtrip.test.ts`.

## PR 3: content position (A)
- `src/decks/deckFormat.ts`: `SlideData` and the slide setting (a new key, written only when not the default); round-trip in `deckFormat.test.ts`.
- `SlideSettings.tsx`: a Content row of tiles like Picture's; follows Sprint 164 PR 3's removal of the Label row.
- `slide/slide.css`, `slide/SlideCanvas.tsx`, `src/decks/blocks/slideRenderer.ts` and `src/decks/page/pageHtml.ts` for the draw on every surface; the presenter view uses the same canvas.
- `blocks/slideFit.ts`: the fit must stay unchanged.

## PR 4: picture behind (D)
- `src/decks/deckFormat.ts` (`sidePictureOf`, `picture: behind`), `slidePicture.tsx`, `slidePictureSvg.ts`, `blocks/slidePicturePlace.ts`, `blocks/slidePictureSwap.ts`, `blocks/slidePictures.ts`: the empty place, choosing, replace and remove.
- `slide/SlideCanvas.tsx`: the corner chip and the ring; the chip reads the logo corner from PR 1.
- `SlideSettings.tsx`: Replace… and Remove under Behind, and choosing Behind opens the chooser. The picture bar lives with the block bar files above.

## PR 5: item handle (B)
- `blocks/SlideEditor.tsx` and `blocks/slideDivView.ts`: the handle as a view decoration on the chosen block; Sprint 166's bubble is in the same editor, so this waits for it.
- `blocks/slideCommands.ts` (duplicate, move, delete) and `slide/slideEdits.ts`; the table column grip in the Text editor is the look to match.
- `slide/slide.css`: the handle's styling.
