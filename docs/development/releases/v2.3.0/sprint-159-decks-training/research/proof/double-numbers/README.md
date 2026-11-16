# Proof: one number per item (double numbers)

Jarmo, 16 November: a Points slide showed "1. 1. Sisend" and "2. 2. Täpsusta" while he prepared a real training.

**Cause.** Points draws its numbers itself (an `<ol>` with `list-style: decimal`), and so do Exercise (its round numbers) and the Steps look of Boxes; Line draws a dot. `layoutSlide` handed the item's `heading` to the slide as written, so an item written `heading: 1. Sisend` showed the drawn "1." and then its own "1. ". Nothing in the code wrote the markers in: the deck's words come from the file, and the AI writes the file (its guidance said only `items:` with `heading`, `text`, `icon`). A table turned into Points (`convertKind`) also carried a "1." from its first column into the new items.

**Fix.**
- `layoutSlide` leaves out of an item's drawn heading the marker its layout draws itself (`listMarkerOf`): a bullet (`-`, `*`, `+`, `•`, `–`, `—`) on Points, Exercise and Boxes with Steps or Line; a number (`1.`, `1)`) only where the layout numbers the items, and only the number it draws there. A space after the marker may be a non-breaking one. The stage, the strip's thumbnails, the presenter's wall and the published page all draw from it. The file is not touched: opening a deck writes nothing.
- A number that is part of the words stays: "2026 plan", "3 hours", "1.5 litres", "4.Sisend", "-5 degrees", and Estonian ordinals and dates ("15. november kohtumine", "2026. aasta plaan") whose number isn't the item's own (review round 1).
- The fit is measured on the words as drawn, so a marker alone never steps a list down a size.
- An edit on the stage keeps the hidden marker in the file (`editedItemWords`): it changes only what the person changed.
- New items come out clean: words pasted at the start of such an item leave the marker behind (`pastedItemWords`, inserted as one input); `convertKind` strips it from items it makes for such a layout; the AI's deck guidance says to write headings without numbers or bullets.

**Files here.**
- `before-main-1440.png`: main's bundle, the demo project's Northwind folder with a Points deck written `1. Sisend`, `2. Täpsusta`, `3. Kontrolli`, `2026 plan`. The slide shows "1. 1. Sisend".
- `after-fix-1440.png`: the same deck, this branch's bundle. One number each; "2026 plan" keeps its number. Taken before review round 1's changes; this deck draws the same under them (1, 2 and 3 are the items' own numbers), as the test's first assertions check.
- `fault-on-main.txt`: `itemMarkers.test.ts` run against main's `layoutSlide`, `slideMarkup` and `convertKind`: red at the first assertion.
- `fixed-on-branch.txt`: the same test on this branch: green.

The deck file's SHA-1 was the same before the launch and after both shots (`cf424e12…`): opening it, in either build, wrote nothing.
