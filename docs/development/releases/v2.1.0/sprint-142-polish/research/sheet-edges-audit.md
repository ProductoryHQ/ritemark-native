# A6: The sheets' edges, and the desk at 1440 (R7, R10; #503, #516)

Run on 26 October 2026 on a dev build of `main` at `84ea15db`, with the patches applied. The instance was hidden, on CDP 9242, with a throwaway profile, at its first window's 1440 × 900 in Ritemark Light.

## The frame as built

`frame-geometry.mjs`: 22 pass, 0 fail, 2 skipped (the tabs' labels, which are icons on Home and the board).

| Box | Left, top, right, bottom | Clips? |
|---|---|---|
| The desk (`.editor-container`) | 256, 44, 1040, 868 | `overflow: hidden`, radius 10 |
| `.part.editor`, its `.content` | 256, 0, 1040, 868 | hidden |
| The editor part's grid (`split-view-container`, `monaco-scrollable-element`, `monaco-grid-view`) | 256, 0, 1040, 868 | hidden |
| The workbench's column for the editor | 256, 0, 1040, 876 | hidden |
| The workbench's row above the status bar | 0, 0, 1440, 876 | hidden |
| `.part.auxiliarybar` | 1040, 0, 1440, 868 | hidden; its `.content` starts at 1048 |
| The AI's webview (and `.rm-ai-sheet` inside it) | 1048, 44, …, 868 | the iframe's own box |

**The desk's shadow.** Today it is `0 0 0 1px #E2E8F0, 0 1px 3px` and `0 6px 16px`, in slate 7%. Its right and bottom edges sit flush with five clipping boxes, and its left edge with the left column's. The 8 of ground around it belongs to the neighbouring parts: the AI part's left padding, the left column's right padding, and the strip above the status bar. So both the outset hairline and the shadow are cut on the right and the bottom. A close-up of the lower right corner shows a hard grey square: `a6-desk-corner-main.png`.

**Tried live.** `.part.editor` and `.content` were set to `overflow: visible` and the AI part's background to transparent. The corner didn't change, because the editor part's own grid and the workbench's column still clip at the same edges.

**The AI's sheet.** It is drawn inside its webview, flush with the webview's left and bottom edges, so its `0 1px 2px` can't be drawn outside the iframe either.

## Decision

- **Both sheets keep a whole hairline and no shadow,** the Experience lead's own fallback on #503 ("If the editor part can't be padded without moving the frame's measured edges, drop the desk's shadow and keep the hairline") and framework §4 ("Where the build can't give a shadow that room, the sheet keeps its hairline only").
  - To give a shadow its 8 of ground, the part boundaries in patch 018's layout would have to move: each part's box would take the gap as its own padding. That is a layout change across every frame invariant (two desks, a hidden column, the welcome alone, narrow windows), not a polish fix.
  - It is noted for 2.2 with these measures.
- **The desk** (patch 018): the hairline as an inset ring on a `::after` inside `.editor-container` with the same radius, which `overflow: hidden` can't clip; no outset shadow.
- **The AI's sheet** (`index.css`): the same inset ring; no shadow.
- **`ritemark.sheetShadow`:** ink at 7% in Light (`#1E1B4B12`), transparent in Dark. Floating sheets (menus, More, dialogs) keep their shadows in Light, in ink, and draw hairlines only in Dark, as the kit does.
- **Brought onto the kit:**
  - the Agents place's cards: `0 1px 2px` in the sheet shadow, already ink after the colour change;
  - Home's switch note: already the kit's `.toast` shadow (`0 4px 6px -1px` ink 18%, `0 2px 4px -2px` ink 12%), so unchanged;
  - Mermaid's expand toolbar: the kit's floating shadow (`.menu`, `.bubble`), in the sheet shadow instead of slate 24%.

## The desk at 1440 (R10)

At 1440 × 900 with both side columns, the desk is 256 to 1040: **784 px**, as the Tasks experience's frame 1 draws it. The board's `.tb-cols` asks for `min-width: 964px`, so it scrolls by 180 px.

Four columns at `minmax(160px, 1fr)` with 12 px gaps and 24 px padding need 724 px and give 4 × 175 at 784.
