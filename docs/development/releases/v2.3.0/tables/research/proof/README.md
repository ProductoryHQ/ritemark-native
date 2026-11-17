# Tables you can change: proof

Experience 48 (ritemark-dev `product/design/experience/experiences/tables/README.md`, with column widths from 333a285). Shots from one isolated dev instance of this branch, 1440 × 900 at 2× (17 November 2026), on a demo folder with a Text document and a deck. No AI was signed in.

| Shot | What it shows |
| --- | --- |
| `01-text-column-menu.png` | A Text document: the column grip clicked, the column tinted, its menu under the grip (Insert left and right, Move left and right, the alignment segment, Sort A to Z with ⌥ for Z to A, Delete column in red). |
| `02-slide-row-drag.png` | A slide: a row's grip dragged, the row tinted, the slide's amber line where it lands, no tooltip over it. |
| `03-plus-bars.png` | The quiet + bars on the right and bottom edges, the row and column grips of the cell pointed at, and the block drag handle left of them. |
| `04-slide-smallest-menu.png` | The slide at the smallest stage (the line between the slide and the handout at its top), a column's menu from its grip. |
| `05-slide-settings-no-add-row.png` | Slide settings for a slide with a table: no Add a row or Add a column. |
| `07-text-cell-menu.png` | A right-click in a cell: the row's and the column's items together. |
| `20-text-column-resize.png` | The line between two columns being dragged: the resize cursor and the accent line. |
| `21-text-widths-applied.png` | The widths after the drag (10, 40, 20 and 30 %). |
| `22-text-after-double-click.png` | A double-click on the line: automatic widths again. |
| `23-slide-column-resize.png` | The same drag on a slide, its pointer divided by the slide's scale. |
| `25-slide-widths-applied.png` | The slide's table with its widths. |
| `27-saved-separator-row.png` | The saved file: the widths as the dashes of the line under the header row. |

What the app run read from the files (each change then one ⌘Z, with the file compared byte for byte with what it was):

- Text document, Move right from the column menu: the column moved in every row; ⌘Z gave the original bytes back.
- Text document, a column dragged to the end and a row dragged to the end: moved; ⌘Z, the original bytes.
- Text document, Tab in the last cell: a new empty row; ⌘Z, the original bytes.
- Slide, a row dragged to the end: moved; ⌘Z, the original bytes of the deck.
- Slide, Insert right from the column menu (with widths): a new column, the widths shared; ⌘Z, the original bytes.
- Text document, a column line dragged: `| -------- | -------------------------------- | ---------------- | ------------------------ |`; a double-click: `| --- | --- | --- | --- |`.

The fault the handles replace: the old overlay (`TableOverlayControls.tsx`, removed) drew its + and trash buttons with `position: fixed` from `getBoundingClientRect` of every `.tiptap-table-node` in the page, the slide editor's tables included, and acted through the Text editor's view (`editor.view.posAtDOM` on a cell of another editor), so on a slide its buttons were drawn over the scaled table but acted on nothing. The handles are now drawn inside each table's own element, by the editor that owns it.
