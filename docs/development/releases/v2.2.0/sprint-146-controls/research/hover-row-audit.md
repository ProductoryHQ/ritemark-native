# A8: the hovered row and the scroll thumb (R9, #594)

1–2 November 2026, on the Mac at 2× (Retina), for PR 4, on the dev instances of [pr4-shell-checks.md](pr4-shell-checks.md). The window was laid out 1440 × 520 (`Emulation.setDeviceMetricsOverride`) so the sample's Documents tree, with its three folders open, runs past the column's foot. A real mouse move onto a row shows its hover fill and the overlay slider; the pixels are read from a device-pixel capture of the row's end.

## Which lists

| List in the left column | Kind | Where its rows and slider are drawn |
| --- | --- | --- |
| Documents, Search, File changes, Extensions | the workbench's lists (`.part.sidebar .monaco-list`) | patch 018: rows 8 in from each side (`left: 8px; width: calc(100% - 16px)`), the slider the scrollbar's width less 2 at the column's right edge |
| Home, Tasks, Browser, Agents, Transcribe | webviews (the place's view is an `iframe.webview`) | the webview's own CSS (`webview/src/index.css`, thin overlay sliders); extension-tier, PR 3's if it has the fault |

So the workbench's half is patch 018's, and it is PR 4's. The webview lists weren't measured here (PR 3's half of A8).

## Measured (Documents, the hovered row's end)

The row ends at 248 and the slider runs 246–254 in a 256 column: they overlap by 2 CSS px (4 device px). The theme's slider colours are see-through (`scrollbarSlider.background` `#94a3b840` Light, `#64748b66` Dark), so what's under the slider shows through.

| Theme | Point | `main` | PR 4 |
| --- | --- | --- | --- |
| Light | the slider over the row's fill | rgb(205, 210, 219) | rgb(218, 224, 233) |
| Light | the slider past the row's end (over the ground) | rgb(217, 225, 234) | rgb(218, 224, 233) |
| Light | | **two tones** | **one tone** |
| Dark | the slider over the row's fill | rgb(66, 71, 93) | rgb(53, 58, 84) |
| Dark | the slider past the row's end | rgb(53, 57, 84) | rgb(53, 57, 83) |
| Dark | | **two tones** | **one tone** |

The row's fill beside the slider is rgb(223, 226, 229) Light and rgb(43, 42, 61) Dark in both; the ground between the slider and the desk is rgb(241, 245, 249) and rgb(22, 19, 47) in both, so the slider still stops 2 short of the desk's hairline. Over the ground the slider reads as before (within one level of rounding). The issue doesn't say which list Gate 1 saw, and its "as in the Documents tree" isn't borne out: Documents has the fault too.

Search's results are the same kind of list with the same rule; the sample's results didn't run past the column's foot, so its slider wasn't drawn in this run.

## The fix

The Experience lead's answer (section 7): the slider draws over the fill in one tone; the fill doesn't stop at the slider, because the overlay scrollbar comes and goes and a row's end would jump with it. In patch 018 (`ritemarkSurfaces.css`, beside the slider's 2-short rule), the left column's slider lays the theme's slider colour over the ground's: `background: linear-gradient(<slider colour>, <slider colour>), var(--rm-ground)`, in its rest, hover (`scrollbarSlider.hoverBackground`) and drag (`.active`, `scrollbarSlider.activeBackground`) tones, so it is opaque and reads the same over the ground, a hovered row or the chosen row. Only a list's own slider takes it (`.part.sidebar .monaco-list > .monaco-scrollable-element > .scrollbar > .slider`): a box in the column, such as File changes' commit message or a multi-line Search field, lies on the box's colour, so its slider keeps the theme's (review round 1, finding 3). Checked live: the hovered slider takes the hover tone and the held one the drag tone (Dark: `#64748b99`, `#64748b`).

Screenshots (`qa/`): `pr4-r9-row-light-main-then-branch.png` and `pr4-r9-row-dark-main-then-branch.png`, the row's end at 4×, `main` on the left.

**Windows** at 100%, 125% and 150% is Gate 2's, on 2.2's candidate: at 125% and 150% a CSS pixel isn't a whole number of device pixels, so the overlap's width rounds differently there.
