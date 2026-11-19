# Sprint 168 technical plan

File pointers only, from a narrow read-only look. All paths are under `extensions/ritemark/webview/src/components/decks/`. Not a design; the authors audit before they edit.

## R1: the quote's look (PR 1)
- `slide/slide.css`: the `.deck-sl.is-blocks blockquote` rule (one line today: inset 3px bar in `--s-accl`, `--s-sub` words) and the borderless override that colours it. Replace with the README's values; the attribution is a rule on the quote's last paragraph.
- The attribution is "a last paragraph starting with '— ' or '– '", which CSS cannot match by text. Decide in the audit whether the renderers add a class (the editor's quote node view, the wall and page renderer in `slide/slideMarkup.ts`) or the editor decorates it. The file stays plain text either way.
- Surfaces: the live editor (`blocks/SlideEditor.tsx`), the wall and presenter view, the strip, and the published page share `slide.css`; `blocks/slideRenderer.parity.test.ts` is the parity check to extend.
- Builds on #841's leak fix; read it once it merges.

## R2: a prompt out of a quote (PR 2)
- `blocks/slideCommands.ts`: the / menu's Code block entry and its command; `blocks/SlideEditor.tsx`: the bubble's Code block (`toggleCodeBlock`).
- Add a slide-only step before the toggle: when the selection is inside a blockquote, lift the chosen paragraphs out of it, then toggle, in one transaction so Undo is one step. A quote left empty is deleted in the same transaction.
- Tests in `blocks/slideCommands.test.ts`: the scenarios in `scenarios.md`.
- Sprint 166 PR 8 and Sprint 167 PR 5 may touch nearby editor code; check before the first edit.

## R3: heading levels (PR 3)
- `slide/slide.css`: the `.deck-sl.is-blocks h2` and `h3` rules (lines near the h1 rule), the `h1:has(+ h2)` title-line rule, and `.blk-box h3` (stays as is). Sprint 164 PR 3 edits this area first.
- `blocks/slideCommands.ts`: the `Title` and `Heading` entries and their keywords; add Heading 3 (`nodeType: 'heading'`, `level: 3`, `###`). Check the icon set for an h3 icon.
- `blocks/slideFit.ts`: no change expected; the fit steps words down by measuring. The proof checks it with an h2 mid-slide.
- Any test or fixture that names "Title" or "Heading" in the menu changes with it.
