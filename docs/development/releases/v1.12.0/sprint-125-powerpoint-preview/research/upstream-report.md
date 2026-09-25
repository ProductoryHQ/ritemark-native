# Draft reports for `@aiden0z/pptx-renderer`

Drafts only — not posted. Posting to the maintainer's repository
(`github.com/aiden0z/pptx-renderer`) waits for Jarmo. Each is reproducible with the
public synthetic corpus in [corpus/](./corpus/README.md); none carries anything
private. Numbers refer to [renderer-spike.md](./renderer-spike.md).

## 1. Multi-series charts are coloured by category (defect 1)

**Version:** 1.3.0. **Deck:** `corpus/ppt/05-charts.pptx`, slides 1 and 2.

PowerPoint writes `<c:varyColors val="1"/>` on every bar, line and area chart it
saves. The renderer applies it to multi-series charts, so each category gets its own
colour and the legend no longer matches. PowerPoint (and the ECMA-376 behaviour it
follows) varies colours by point only when the chart group has a single series.

Suggested fix: honour `varyColors` only when the group has one series. We rewrite the
XML before rendering in the meantime (`pptxXml.fixChartXml`).

## 2. An empty `<c:title>` draws no title (defect 2)

**Deck:** `corpus/ppt/05-charts.pptx`, slide 3; `corpus/ppt/08-long-40-slides.pptx`,
chart slides.

For a single-series chart whose title was not deleted, PowerPoint shows the series
name — whether `<c:title>` is missing or present without `<c:tx>` (PowerPoint writes
`<c:title><c:overlay val="0"/></c:title>`). The renderer handles the missing case
but draws nothing for the empty one.

Suggested fix: treat an empty `<c:title>` like a missing one. Side note: a size given
on the title's run (`a:rPr sz`) is drawn far smaller than one given on the
paragraph's `a:defRPr`.

## 3. Pie data labels ignore the number format (defect 3)

`0%` labels show as `0.46`; one reads `0...`. Labels can overlap the legend.

## 4. A bottom legend overlaps the category-axis labels (defect 4)

Column and line charts in `05-charts.pptx`.

## 5. Text in non-rectangular presets uses the bounding box (defect 6)

"Triangle" and "Chevron" in `04-shapes-groups.pptx` are clipped; PowerPoint lays the
text out in the preset's text rectangle.

## 6. A font installed nowhere falls back to the browser default (defect 8)

The generated font stack has no generic family at the end, so text in a missing
font is drawn in Times. Appending `sans-serif` (or the theme's generic) would fix it.
We register an alias for such fonts in the meantime.

## 7. Hyperlinks keep their run colour (defect 10)

PowerPoint draws a hyperlink run in the theme's hyperlink colour. `09-layouts-backgrounds.pptx`, slide 3.
