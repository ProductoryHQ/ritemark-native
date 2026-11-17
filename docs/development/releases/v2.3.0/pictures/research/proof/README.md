# One picture editor (experience 49): proof shots

Taken in isolated dev instances on the PR's last two heads (06, 07, 09, 11, 12, 13 and 15 retaken after the Experience lead's fixes), with generated demo pictures in a demo project (no AI sign-in, the AI column folded). The Ritemark shots are 1440×900 at 2×. The page shots are the published deck page's own view at 1440×900 and 390×844.

| Shot | What it shows | What the file then said |
| --- | --- | --- |
| 01-doc-selected | A picture in a Text document, chosen: ring, corner handles, its bar (S · M · L · Full, align, Crop, Description, Comment, ⋯); no text bubble | `![…](images/harbour.png){width=75% align=center}` (as written) |
| 02-doc-handles-mid-drag | A corner handle mid-drag: the picture follows in proportion | after the drop: `{width=39% align=center}` |
| 03-doc-crop-16x9 | Crop mode: the whole picture, the 16:9 frame moved and narrowed, the thirds, the rest dimmed; Reset and Done | (nothing until Done) |
| 04-doc-cropped | After Done (Enter) | `{width=39% align=center crop=16:9 zoom=1.232 focus=50.8,47}` |
| 05-doc-more-menu | ⋯: Replace picture…, Copy, Show in Finder, Remove | |
| 06-slide-selected | A picture on a slide, chosen: the same bar with Place, kept on the slide's side of the window (right of the strip and the divider; it may reach past the slide over the desk; only when it does not fit there do words go, from the right: Description, then Crop, then Place) | |
| 07-slide-handles-mid-drag | A slide's corner handle mid-drag: it stays under the pointer at the slide's scale, and the bar hides until the drop | after the drop: `{width=400px}` (snapped to L) |
| 08-slide-place-left | Place → Left: the same picture fills the slide's left side | header `picture: left`, `image:`, `alt:` |
| 09-slide-left-focus-point | The side picture chosen, its focus point dragged; the bar inside the slide at its bottom, 12 px up | `focus: "27,50"` |
| 10-slide-place-behind-focus | Place → Behind, its focus point moved | `picture: behind`, `focus: "64,35"` |
| 11-slide-empty-after-remove | ⋯ → Remove: the place stays, with a picture icon and "Choose, paste or drop a picture" (a click opens the picker) above the veil in the slide's text colour; no Description on the bar | `picture: behind` only |
| 12-slide-place-in-text | Place → In text on a side picture: it is back in the words, and the place is gone | `![The harbour from the hill](images/harbour.png)` |
| 13-page-slide-before / -zoom | The published page, made from the same deck as 12: the slide's picture whole, as in the editor; a click opens it full size, with an × (44 px) at the top right | |
| 14-page-handout-before / -zoom | A handout picture at half width with its caption; a click opens it full size | |
| 15-page-phone-before / -zoom | The same at 390×844 | |
| 16-doc-double-click-picker | A double click on the chosen picture opens the file picker, as ⋯ → Replace picture… does (the in-window dialog of the test run; its address box, which showed a temporary folder, is covered in this shot) | |
| 17-doc-after-swap | evening.png chosen: the same size and centre, a fresh description; the picked file is copied into images/ beside the document, as paste and drop do | `![](./images/evening-2.png){width=75% align=center}` |

The picture files' modification times were the same after the run as when they were made: no picture file was written.
