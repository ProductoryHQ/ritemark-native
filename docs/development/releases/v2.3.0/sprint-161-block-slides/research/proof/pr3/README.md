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

**Found in the run, fixed:**
- The pill, as an editable host nested in ProseMirror, lost its focus at the editor's next redraw (a field over the pill now).
- After a picture, the fit stayed at step 0 until the next key.
- An empty table column had no width.

**Noted, not changed:**
- A `Activating extension 'GitHub.copilot-chat' failed` toast appeared after a reload. It comes from the cloned dev tree's built-in extension and is unrelated to this PR.
- In the CDP-driven, possibly occluded window, `requestAnimationFrame` ran late, so the stage sometimes switched to a new slide seconds later. The strip's own insert has the same pattern; driven by hand, the window is visible.
- At the floor, a full slide's title was clipped at the top (the slide is full by definition there).

**Not verified:**
- The review-fix head was not run in the app.
- A real person's file picker: CDP answered it.
- Windows.
- Web page in the app: unit tests only.
- `***` + Space/Enter typed on the slide.
