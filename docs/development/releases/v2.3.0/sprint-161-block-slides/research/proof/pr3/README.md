# Sprint 161, PR 3: proof shots

One dev run on 17 November, 10:25–11:00 EET. Jarmo allowed daytime launches for that day in the Development manager session: "sa võid täna kohe screenshottidega alustada. mul koolituste vaba päev". The run used `RITEMARK_LAUNCH_DAYTIME_OK=1` on those words.

**How it ran**
- One launch of `scripts/qa/dev-launch-isolated.sh`: a fresh profile, throwaway AI homes and the mock keychain, on a copy of the demo project, with `ritemark.features.decks` on. It was stopped with `LEFT=0`.
- Nothing was signed in to, and nothing was sent anywhere.
- The workbench was held at 1440 × 900 CSS px (files 2880 × 1800). "AI open" means the AI column is shown, "AI folded" that it is hidden.
- In the copy, `number: "2"` was taken out of the v1 deck's second Section slide, to have a section with no number.
- Fixes found in the run were rebuilt and reloaded in the same instance:
  - the pill field, which replaces an editable host nested in ProseMirror;
  - the fit measured again when a picture loads;
  - empty table cells given a width.
- The page shots are the page Publish writes (`pageFile.buildDeckPage`) for the converted v1 deck, in headless Chromium.

| Shot | What it shows |
| --- | --- |
| `slash-menu-on-slide-ai-open-1440x900.png`, `…-ai-folded-…` | The slide's / menu under the cursor: Text, Blocks, Media and Slides, with the shortcuts. While it was open the file was byte for byte the demo's. |
| `insert-columns-ai-open-…`, `…-ai-folded-…` | Columns from the menu, typed in. One Undo took the typing back and the next took the block back: the file was then byte for byte the demo's (`cmp`). |
| `new-slide-below-ai-folded-…` | New slide below: an empty slide with its Title placeholder and the caret. |
| `insert-boxes-ai-folded-…` | Boxes: three empty boxes with a place for an icon. The empty boxes are kept in the file. |
| `icon-picker-ai-folded-…`, `icon-chosen-ai-folded-…` | The grid of 24 from a box's icon place. Choosing Folder changed only that box's line (`diff`: one line). |
| `strip-new-slide-menu-ai-folded-…` | The strip's "New slide" menu: New slide, From the library…, From another deck…. The strip was scrolled sideways by the driver. |
| `insert-steps-ai-folded-…` | Steps under the default "Exercise" pill. No `tag` is written. |
| `pill-being-edited-ai-open-…` | The pill typed in place ("Harjutus 1"), written on each key. |
| `pill-emptied-placeholder-ai-folded-…`, `pill-emptied-hidden-ai-folded-…` | Emptied: `tag=""`. While the field is open, "Exercise" shows faint; once it closes, the pill is hidden. |
| `pill-back-from-settings-label-row-ai-folded-…`, `pill-back-on-slide-ai-folded-…` | Settings' Label row brings the pill back. |
| `insert-table-tab-enter-ai-open-…` | A table typed with Tab (across) and Enter (down, a new row). The file holds a valid GFM table. |
| `table-add-row-add-column-in-settings-ai-open-…`, `table-after-add-row-and-column-ai-open-…` | Settings' Add a row · Add a column on a block table. The file gained one row and one column. The empty column was invisible on the stage, so cells now have a minimum width; that fix was not shot again. |
| `slide-full-line-in-bar-ai-open-…`, `…-ai-folded-…` | "This slide is full: its words are at their smallest size." with Split at the cursor, in the deck's bar. It showed only at step 5 with an overflow, not at step 5 while the words still fit. |
| `split-at-cursor-new-slide-ai-folded-…` | Split at the cursor after the ninth point. The file's only change is the slide boundary inserted there (`diff`). One Undo gave the file back (`cmp`), and Redo split it again. |
| `insert-picture-where-the-slash-was-ai-folded-…` | Picture from the menu (the file chooser answered over CDP with a synthetic chart): saved as `images/pilot-chart.png` and placed where the / was, under the title. |
| `section-no-number-before-first-edit-ai-folded-…` | The v1 deck as opened: the numberless Section slide drawn big and low, with no numeral, and an H1 in the handout. The file was unchanged. |
| `section-no-number-converted-slide-and-handout-h1-ai-folded-…`, `…-ai-open-…` | After the first edit: the slide is `section: true` and title-only, with `# Scheduled prompts` in the handout. One Undo gave the v1 deck back byte for byte. |
| `page-section-no-number-band-1440x900.png`, `…-390x844.png` | The page: the band reads "SECTION" with no number, and the slide is drawn big and low. The page has 0 `<!--` (the converted notes stay private). |

## The final run (17 November, 12:15–12:45 EET)

One more launch, on dd42bee9 (the lead's four fixes) plus two fixes the run found, which were rebuilt and reloaded into the same instance and are committed in the head after it. It was stopped with `LEFT=0`, and its run folder (profile included) was deleted, as was the first run's. The copy's slide 11 was set to the Arrows look to check its arrow.

| Shot | What it shows |
| --- | --- |
| `retake-full-slide-title-whole-ai-folded-1440x900.png` | The full slide 18 with the caret at its bottom, typed at: the flow's `scrollTop` stays 0, so the title is whole and the words overflow at the bottom, behind the bar's line. |
| `retake-part-15-not-collapsed-ai-folded-1440x900.png` | Part 15 (a new slide's empty part, saved before its words) has its line and "Write here." after a reopen; it had no height before. Parts 16–18 have their height too. |
| `retake-new-columns-placeholders-ai-folded-1440x900.png` | A new Columns block: two empty columns, "Heading" over "Text" faint, the file's lines `::: column` / `:::` only. Shown after a Reload Window, so this is the column as it reopens. |
| `split-at-cursor-no-caret-notice-ai-folded-1440x900.png` | Split at the cursor on the full slide with no caret put there: "Click on the slide where it should split, then Split at the cursor." The file was unchanged. |
| `new-steps-carries-the-label-ai-folded-1440x900.png` | A new Steps block on slide 16 gets `tag="Harjutus 1"`, slide 15's label. One Undo took it out. |
| `split-slide-here-from-the-menu-open-ai-folded-1440x900.png`, `split-slide-here-from-the-menu-ai-folded-1440x900.png` | Split slide here chosen from the / menu on an empty list item. The file's only change is the empty `-` replaced by the slide boundary, and one Undo gave the slide back whole (`cmp`). |

**Checked in the final run:**
- A / block is one Undo: Columns, then one Undo, and the file was as before the / (`cmp`).
- Leaving the slide writes what the open menu held: `/2025` typed and not written while the menu was open (0 lines). After going to another slide it was written (1 line); one Undo took it out.
- The Arrows look's arrow no longer opens the icon picker (`.deck-icon-grid` absent after the click).

**Found in the final run, fixed (with tests where they hold headless):**
- An empty block's `::before` placeholder took a grid column of its own, pushing the new columns right. Placeholders are now drawn only on text lines.
- Split slide here from the menu on an empty list item left that empty `-` at the first half's end. The empty line the / stood on is now in neither half (`withoutEmptyLineAt`).

**After the final run (headless tests only):** Codex's two fixes: a row Enter adds is its own undo step, and a split or a new slide doesn't join the typing before it (`closeHistory`).

**Found in the run, fixed:**
- The pill, as an editable host nested in ProseMirror, lost its focus at the editor's next redraw (a field over the pill now).
- After a picture, the fit stayed at step 0 until the next key.
- An empty table column had no width.

**Noted, not changed:**
- A `Activating extension 'GitHub.copilot-chat' failed` toast appeared after a reload. It comes from the cloned dev tree's built-in extension and is unrelated to this PR.
- In the CDP-driven, possibly occluded window, `requestAnimationFrame` ran late, so the stage sometimes switched to a new slide seconds later. The strip's own insert has the same pattern; driven by hand, the window is visible.
- At the floor, a full slide's title was clipped at the top: fixed in the final run (above).

**Not verified:**
- Codex's two undo-step fixes, made after the final run: headless tests only.
- A real person's file picker: CDP answered it.
- Windows.
- Web page in the app: unit tests only.
- `***` + Space/Enter typed on the slide.
