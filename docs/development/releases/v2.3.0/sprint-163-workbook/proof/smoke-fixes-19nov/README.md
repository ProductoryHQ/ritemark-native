# Smoke-run fixes of 19 November (proof)

One isolated dev window of this branch (`scripts/qa/dev-launch-isolated.sh`, a fresh profile, throwaway AI homes, `--use-mock-keychain`, `ritemark.features.decks` on in that profile only), on 19 November 2026 between about 04:15 and 04:35 EET, on a small demo deck (`Workbook.deck.md`: a cover, a Boxes slide, a Tabs slide, a prompt slide; `transition: push`). Launched once and stopped at the end (`LEFT=0`). Nothing was signed in to, Copy was never pressed, and no button's Open was pressed. The window was 1440 × 900; the wall was held at 1440 × 900 by a device-metrics override. The page was built locally from the same deck (`pageHtml`, no publish) and opened headless.

- `a0-open-tab-caret-gap-1440x900.png`: the open tab's ⌄ clear of its name. Measured on the stage: 7.5 slide units between the last letter and the glyph, and the three tabs' widths unchanged (74.6, 93.5, 94.2) from before the fix: no tab moves.
- `a1-tab-menu-1440x900.png`: right-click on "2 · Collect": its menu.
- `a2-after-delete-tab-1440x900.png`: after Delete tab, the focus is the editor's (`document.activeElement` is the slide's ProseMirror, `ProseMirror-focused`), the caret in "3 · Picture", which opened.
- `a3-cmd-z-restores-tab-1440x900.png`: ⌘Z at once: "2 · Collect" is back, and in the file too.
- `b1-address-sheet-right-box-1440x900.png`: a new Button from `/` in the right-hand box: the sheet lines up with the card's right edge (both at 1067 px in the webview) and stays inside the editor; Done is in view. Esc then took the button away: the file had no `{.button}` left (its slide's bytes as before). The faint "Words beside it (optional)" wraps inside a narrowed card (checked at 110 slide units: the words two lines, inside the card).
- `c-hover-copy-no-ring-1440x900.png`: the pointer on Copy: Copy's own hover, its tooltip, and no edit ring on the code block's top line (`box-shadow: none` on the tools).
- `d1-wall-push-mid-1440x900.png`: the wall, Push from the Boxes slide to the Tabs slide, paused mid-way (`getAnimations().pause()`): the Tabs block coming in runs to the window's edge, with no cut. The flow is `overflow: visible; clip-path: inset(0 -100000px)` during the row and `overflow: hidden` with no inline style once it ends (no scrollbar, no overflow).
- `d2-page-push-mid-1440x900.png`, `d3-page-push-mid-720x860.png`: the page, the same move paused mid-way. At 720 × 860 the page reads as one column and its flow is unclipped already: left as it is.

Not shot: E (print). Its tests run the page's script: Cmd+P waits for every picture (5 s at most), and the page carries each slide's ground as a hidden picture.
