# Sprint 164 technical plan

File pointers only, from a narrow read-only look. Paths are under `extensions/ritemark/webview/src/components/decks/` unless stated. Each PR's author confirms them before editing.

## PR 1: view state
- `DeckView.tsx`: `const [fold, setFold] = useState<DeckFold>(storedFold)` and `chooseView`, which calls `keepFold`.
- `DeckFolds.tsx`: `storedFold`, `keepFold`, `keepDeckViewState`, `deckViewState`, `foldOfView`. The start value changes to Slide only; the in-session choice stays.

## PR 2: spacing
- `slide/slide.css`: the `.deck-sl.is-blocks` rules for blocks, columns (`.blk-columns`, `.blk-column`), boxes, tabs and code. Line 174 has a margin and padding-top that needs a look. The `.3em` and `.2em` top margins go.
- All new values use `calc(Npx * var(--fit, 1))`.

## PR 3: Label
- Steps pill drawing: `slide/slide.css` `.blk-pill` (about line 302) and the column rules at about lines 309 and 310 (removed); `blocks/slideDivView.ts` draws the pill.
- Steps tag and migration: `blocks/slideCommands.ts` `setStepsTag`, `lastPillLabel`; `blocks/SlideEditor.tsx` `pillLabelSoFar`, `PILL_PLACEHOLDER`; `blocks/blockBar.ts` and `blocks/SlideBlockBar.tsx` (`stepsLabel`). The slide's `tag` data comes through the same path.
- / menu Blocks group: `blocks/slideCommands.ts` (the `group: 'Blocks'` entries, about lines 50 to 53); hidden words shared in `extensions/blockItems.ts`.
- Settings row to remove: `SlideSettings.tsx` `LabelRow` and `stepsTag`.
- File form: `[text]{.label}` next to Button's `{.button}` reading in `extensions/buttonBlock/buttonMarkdown.ts`; the renderer parity test is `blocks/slideRenderer.parity.test.ts`.
