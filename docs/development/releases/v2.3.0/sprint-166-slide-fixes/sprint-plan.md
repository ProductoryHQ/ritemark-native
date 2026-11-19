# Sprint 166: Slide fixes from Jarmo's 19 November test and the spacing review

Release tier: extension

Track: Lightweight (small bug fixes, one PR each, no new dependency). Decks stays behind `ritemark.features.decks`, so no new flag.

Branch: `sprint-166-slide-fixes` (this plan); the fixes on `sprint-166-slide-fixes-pr1` to `-pr4`.

Status: **Done** 20 November 2026 (close-out below). **Approved** by Jarmo on 19 November 2026: "kinnitan sprindid 165, 166 ja 167" (I approve Sprints 165, 166 and 167).

## Goal

On a block slide, the formatting bubble's buttons change the selected text; in Slide only, the wheel, the trackpad and the keys move between slides, as designed on 16 November; a table looks the same in the editor as on the wall and its frame hugs it on the page; and the column split's guide sits in the middle of the gap.

## Fix 1: the formatting bubble (PR 1, issue #822)

Issue [#822](https://github.com/ProductoryHQ/ritemark-native/issues/822), milestone v2.3.0. Jarmo, 19 November: "bugi? Ükski nendest ei muuda mitte midagi slaidi teksti peal" (bug? none of these change anything in the slide's text). He selected a heading's word inside a Columns block; the bubble appeared and showed the right state (H3 lit), and none of its buttons changed the text.

Likely cause, not yet proven: the bubble reads the slide editor's selection but its commands run on another editor instance, or the click blurs the slide and the selection is lost first. The first step is a test that reproduces it. Where to look: `extensions/ritemark/webview/src/components/decks/blocks/SlideEditor.tsx` (`<FormattingBubbleMenu editor={editor} appendToBody />`) and `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`, which the Text editor uses too.

- [x] A test that fails before the fix; the cause found and fixed at its source.
- [x] Each bubble button changes the text on a plain slide body and in a Columns block (Jarmo's case).
- [x] ⌘B and ⌘I from the keyboard still work; ⌘Z after a bubble change undoes it.
- [x] The Text editor's bubble is unchanged.
- [x] Two shots or a short recording, before and after, on a synthetic deck.

## Fix 2: moving between slides in Slide only (PR 2, issue #824)

Issue [#824](https://github.com/ProductoryHQ/ritemark-native/issues/824), milestone v2.3.0. Jarmo, 19 November: "Editori vaates raske navigeerida slaidide vahel. Hetkel ainus viis minna thumbnail list kaudu." (It's hard to move between slides in the editor view; the only way now is the thumbnail list.)

As designed (his own 16 November ask, built for the full-slide view): in Slide only, a wheel or trackpad gesture anywhere over the stage moves one slide, over the slide and over the empty bands around it; ↑ ↓, Page Up, Page Down, Home and End do the same when the cursor isn't in the words. The Experience lead recommends keeping one slide per gesture rather than a continuous scroll.

Seen on main: the full-slide wheel effect in `extensions/ritemark/webview/src/components/decks/DeckView.tsx` (about lines 961–985) is attached only to the stage and only while the full-slide view is on, and returns early when the stage can scroll and the pointer isn't over the slide, so the empty bands may do nothing. Other suspects: the effect running before the stage exists after the view switch, the slide editor taking the wheel, the trackpad threshold. The empty bands should step whenever the stage itself has nothing to scroll.

- [x] A test that fails before the fix.
- [x] Proof: the slide index after each gesture, with mouse-wheel and trackpad-style events, over the slide and over the bands, at 1440×900, and after each key.
- [x] Typing, selecting and scrolling inside the words still behave as before.

**Order:** PR 1, PR 3 and PR 4 can start at once; PR 4 changes `SlideBlockBar.tsx`, so it waits if Sprint 164 PR 3 (the Label block) is changing the same lines. PR 2 starts after Sprint 164 PR 1 (#819) merges, because both change `DeckView.tsx`.

## Fix 3: tables look the same everywhere (PR 3, issues #827 and #828)

Both found in the Experience lead's review of Sprint 164 PR 2 (#821) on 19 November.

- [#827](https://github.com/ProductoryHQ/ritemark-native/issues/827): for the same content the editor draws a table's rows about 56–58 slide px tall and the wall about 42 (the wall is right), so an editor column holds more and scrolls. The design says the slide being edited looks as its thumbnail does. Likely the cells' paragraphs or the editor's td borders.
- [#828](https://github.com/ProductoryHQ/ritemark-native/issues/828): on the published page at 720 px the table's bordered frame takes the full width while the table stops at about a quarter of it. The frame hugs the table: its own width up to the column's, and only then does it scroll inside, with the fade. Check whether it predates #821 (the wrapper likely comes from #780).
- [x] Tests that fail before: the editor's row height equals the wall's for the same table; the page's frame width equals the table's up to the column.
- [x] Shots of the same table in the editor, on the wall and on the 720 px page.
- Causes (PR 3): #827, a stage cell holds its words in a paragraph and the slide's 12 px under every paragraph reached it (58–59 slide px a row against the wall's 46–47); #828, the page's one-column rule made a slide's table a full-width block (`display: block` with no width, from #807 on 19 November, before #821, not #780's `.tw`).

## Fix 4: the split's drag guide (PR 4, issue #829)

[#829](https://github.com/ProductoryHQ/ritemark-native/issues/829): with the 32 px gap, the drag guide at the ⅓ and ⅔ snap points sits about 5 px off the middle of the gap. It goes to the middle, as the handle already is.
- [x] A test of the guide's position at ⅓ and ⅔; one shot while dragging.
- Built (PR 4): the guide was drawn at a third of the two columns' span, gap included, but the grid shares only their room without the gap, so it stood a sixth of the gap off the split at ⅓ and ⅔ (½ was right). It now stands where the handle will be once the line lands: the room shared as the drop writes it (whole percents) plus half the gap measured on the screen, so the fit and the stage's scale are in it (`splitGuideX`, `splitShares` in `blockBar.ts`). In the app at 1440×900: within 0.01 px of the gap's middle at ⅓, ½ and ⅔, at the full fit and at 60 % (main's formula, on the same columns: 2.0 px off at ⅓ and ⅔ at the full fit); dragged from an even split to ⅓, the guide stood exactly where the handle landed. Found in the same run and fixed: pointed at, the split drew the ghost Button's light hover fill as a 12 px bar around its line; now only the line shows. Test: `blockBar.test.ts`. Shot: `proof/pr4-split-guide/`. No release-notes line: Decks is new in 2.3, so nobody has seen the old guide.


## Added on 19 November (scope change, Jarmo: "jah, lisa need kolm sprinti 166")

### Fix 5: a Quote's leaked look (PR 5, issue #841)
[#841](https://github.com/ProductoryHQ/ritemark-native/issues/841): in the editor, the strip, the wall and the presenter view a Quote on a dark slide is drawn as a near-white box, because VS Code's webview stylesheet gives blockquotes a fill of their own. `.deck-sl.is-blocks blockquote` sets `background: none`, `border: 0` and its own padding and colour, so nothing of VS Code's or `.ProseMirror`'s quote style reaches a slide. The quote's own look is designed separately with Jarmo.
- [x] A test that the slide's blockquote has no fill or border from outside; shots on a dark slide and on Paper, in the editor and on the wall, with the page for comparison.

### Fix 6: the Present bar at the screen's foot (PR 6, issue #842)
[#842](https://github.com/ProductoryHQ/ritemark-native/issues/842): the wall's floating bar sits at the screen's foot, centred, its bottom 12 px from the edge, never over the slide's words: in the ground below the 16:9 content on a wider screen (1440×900 leaves a 45 px band), in the slide's own bottom margin on a 16:9 screen. It still shows on pointer movement and fades after 2 s.
- [x] The bar sits 12 px from the screen's foot, its box outside the content box at 16:10 and 16:9 sizes (`wallBar.test.ts`, PR 6).
- [x] Shots at 1440×900 and 1920×1080 with the bar showing over a slide whose code block reaches the bottom right (`proof/pr6-present-bar/`).
- [x] The Experience lead's rule: while the bar shows, the quiet line fades out with the bar's timing and comes back when the bar fades (`wallBar.test.ts`); one shot at 1440×900 with the bar showing and the line hidden (`proof/pr6-present-bar/present-bar-line-hidden-1440x900.png`).

### Fix 7: the bubble over the Link dialog (PR 7, issue #846)
[#846](https://github.com/ProductoryHQ/ritemark-native/issues/846): on a slide, while the bubble's Link dialog is open the bubble goes away, and it comes back after the dialog closes.
- [x] A test, and one shot with the Link dialog open.

## Added on 19 November, second time (Jarmo: "jah, lisa mõlemad sprinti 166")

### Fix 8: a Button's own words (PR 8, issue #848)
[#848](https://github.com/ProductoryHQ/ritemark-native/issues/848): the button's words can't be typed into, or nothing shows they can. The design (decks README, Button, Editing) says a click chooses the block and then its words and the words beside it are typed in place. Likely cause, not proven: with no words the pill's editable span has no width (the placeholder is a CSS `::before` with `pointer-events: none` beside a `contenteditable=false` icon), so the caret can't get in; or the open Address sheet keeps the focus. A live check first; if it works and is only undiscoverable, it goes back to the Experience lead as UX.
- [x] A test that fails before; shots of an empty and a filled button being typed into (`proof/pr8-button-words/`). The live check found the bug: a click on the button's icon put the caret at the start of the slide's title (or a document's first line), and the words typed went there; and with a new button's address sheet open, a click on the button took the new button away. Now a click anywhere on the button puts the caret in its words, the sheet stays open while you type them, and while a new button's sheet asks for its address, Enter in them goes on to it. A new button left without an address after words were typed on it goes as an undo step, so ⌘Z brings it back.

### Fix 9: an unknown icon name (PR 9, issue #850)
[#850](https://github.com/ProductoryHQ/ritemark-native/issues/850): when an agent writes an icon name Ritemark doesn't know, the icon's place stays empty. On the slide, wall, strip and page a neutral fallback icon (its look is the Experience lead's call); in the editor a quiet hint on the icon ("Unknown icon: <name>, choose another"); the DECKS rules for agents list the allowed icon names.
- [x] Tests for the fallback and the hint; shots of the fallback on a slide and the hint in the editor.
- Done (PR 9): the Experience lead's look (issue #850, decks README c6f8477): the badge keeps its place, size and soft accent ground with Phosphor's `circle-dashed` in the placeholder colour, drawn by one helper for the renderer and the stage (`boxIconBadge`). The hint is a tooltip, No icon named “xyz”, with Choose an icon, which opens the icon menu as it is (the search with the name in it waits for Sprint 169). The DECKS rules list the 24 names and the aliases; the name stays in the file as written. Tests: `blocks.test.ts`, `pageHtml.test.ts`, `slideRenderer.parity.test.ts`, `capabilityContext.test.ts`, `layoutSlide.test.ts`, `slideMarkup.test.ts`, `slideBlocks.roundtrip.test.ts`. Shots: `proof/pr9-unknown-icon/`.

## Added on 19 November, third time (Jarmo: "jah kõigile kolmele")

### Fix 10: a gesture over the slide in Slide and handout (PR 10, issue #855)
[#855](https://github.com/ProductoryHQ/ritemark-native/issues/855): over the slide, a gesture means the same in every view. In Slide and handout a wheel or flick over the slide moves one slide, as in Slide only, and the handout scrolls to that slide's part (the strip click's path); over the handout's text the wheel scrolls the text as now and the slide follows the part being read; a long column or pane still scrolls first (#849).
- [x] A test that fails before; the slide index after each gesture in Slide and handout, at 1440×900.
- Built (PR 10): the stage's wheel listened in Slide only. It now listens whenever the slide is shown, through the same rule (`slideNav.ts`, `stageWheelOf`). By side of the room (the Experience lead): anywhere on the slide's side, the slide and the space around it in its pane, a gesture means slides; on the handout's side it means text. A long column first, then the slide's pane while it can scroll, then the slide. Proof: `proof/pr10-gesture-both-views/`.

### Fix 11: a thumbnail takes no click or wheel inside it (PR 11, issue #856)
[#856](https://github.com/ProductoryHQ/ritemark-native/issues/856): a click anywhere on a thumbnail chooses that slide, and a thumbnail's columns and panes never show or catch a scrollbar.
- [x] A test; one shot of a thumbnail with a long column chosen by a centre click.
- Built (PR 11): nothing in a thumbnail's slide takes the pointer (`decks.css`), so every click and wheel there is the thumbnail's own, and no block in it draws a scrollbar (each keeps its room and fade). One rule for every thumbnail: the strip and a drag's lifted copy, the wall's grid, and the presenter view's row and Next (widened in review). Proof: `proof/pr11-thumbnail-clicks/`.

## For every PR

- REVIEW.md tier: Standard. The PR fills Risk and How to revert; the review record names the reviewed commit; the Experience lead looks at the shots before the merge.
- One plain line each in the Decks section of `docs/releases/v2.3.0/release-notes.md`.
- `Closes #822`, `#824`, `#827` with `#828`, `#829`, `#841`, `#842`, `#846`, `#848`, `#850`, `#855` and `#856`, one per PR.
- The full test chain once on each final head; `qa-validator` at the sprint's end.
- Synthetic decks only in tests and shots; never real client material.

## Not in this sprint

Which of the bubble's items belong on a slide (a checklist, H1 or H2) is a later question for the Experience lead. This sprint makes the buttons that are shown work, and removes none of them. Continuous scrolling between slides (asked about by Jarmo) is not built; the one-slide-per-gesture design stays unless he decides otherwise.

## Removals (HARD RULE #1)

None.

## Close-out (20 November 2026)

**The 11 PRs, all merged on 19 November:** PR 1 [#845](https://github.com/ProductoryHQ/ritemark-native/pull/845) (3fe5e92c, #822), PR 2 [#849](https://github.com/ProductoryHQ/ritemark-native/pull/849) (92e7d35a, #824), PR 3 [#851](https://github.com/ProductoryHQ/ritemark-native/pull/851) (0bfdb2e2, #827 and #828), PR 4 [#893](https://github.com/ProductoryHQ/ritemark-native/pull/893) (c25a6687, #829), PR 5 [#852](https://github.com/ProductoryHQ/ritemark-native/pull/852) (ae8e7194, #841), PR 6 [#857](https://github.com/ProductoryHQ/ritemark-native/pull/857) (a4a8aa69, #842), PR 7 [#862](https://github.com/ProductoryHQ/ritemark-native/pull/862) (5b60d217, #846), PR 8 [#873](https://github.com/ProductoryHQ/ritemark-native/pull/873) (a480997f, #848), PR 9 [#874](https://github.com/ProductoryHQ/ritemark-native/pull/874) (ef180955, #850), PR 10 [#871](https://github.com/ProductoryHQ/ritemark-native/pull/871) (a0eb710a, #855), PR 11 [#875](https://github.com/ProductoryHQ/ritemark-native/pull/875) (330ca30b, #856).

**`qa-validator`, 19 November:** every check passed apart from two: the release-notes lines for #846 and #856 were missing, and the live checks the PRs could not run were still open. This close-out adds both lines and runs those checks.

**The live checks** (one isolated launch on main `c25a6687`, a synthetic deck of 12 block slides, two of them with a 20-point column; the run and its numbers in [`proof/closeout-live/README.md`](proof/closeout-live/README.md)):

- **The slide's pane keeps its place by direction (#871): as designed.** In Slide and handout, with the slide wider than its room (a 1440×560 window, the split dragged right, so the pane scrolls 122 px), a notch or flick going on shows the next slide's pane from its top, going back from its end, over the slide and over the band under it. Shots: [`1-forward-pane-at-top-1440x560.png`](proof/closeout-live/1-forward-pane-at-top-1440x560.png), [`2-back-pane-at-end-1440x560.png`](proof/closeout-live/2-back-pane-at-end-1440x560.png).
- **A chosen slide from its top: not met by the strip.** In the same window, with the pane scrolled to its end, a click on a thumbnail, and Home, End and ↓ on the strip, choose the slide but leave the pane at its end, so the new slide shows from its foot (its title out of view). The wheel's step sets the pane; the strip's choice doesn't. In Slide only the slide always fits its pane, so Home and End there show the whole slide. Shot: [`3-strip-click-pane-left-at-end-1440x560.png`](proof/closeout-live/3-strip-click-pane-left-at-end-1440x560.png). Contents: the deck's editor has none to drive. The go-to box on the wall and in the presenter view was not driven; the wall shows the whole slide.
- **Thumbnail clicks (#875): as designed in all three places.** On the wall's **All slides** grid and on the presenter view's row and Next, two wheel notches over a thumbnail's 20-point column left it unscrolled (0 of 500 px), and a click on a thumbnail's centre or in its column's words chose that slide. Shots: [`4-wall-grid-after-wheel-1440x900.png`](proof/closeout-live/4-wall-grid-after-wheel-1440x900.png), [`5-presenter-centre-click-1440x900.png`](proof/closeout-live/5-presenter-centre-click-1440x900.png).
- **The gesture in both views (#871, #849): as designed** with protocol wheel events (mouse notches and a 40-event flick). In Slide only: one slide per notch or flick over the slide and the band; a flick over the long column scrolls it and keeps the slide. Slide and handout: as in the first point. Shot: [`6-slide-only-after-flicks-1440x900.png`](proof/closeout-live/6-slide-only-after-flicks-1440x900.png).
- **#860, a renderer crash and Reopen:** the text is not doubled. Shot: [`7-860-crash-reopen-not-doubled-1440x900.png`](proof/closeout-live/7-860-crash-reopen-not-doubled-1440x900.png).

**Not run:** a real trackpad and a real mouse (the gestures were protocol events of the same shape; real hardware stays with Jarmo), the presenter view on a real second display (it ran in the dev build's windowed mode on one display), the go-to box, and Windows.

## Approval

- [x] Jarmo approved this sprint plan (19 November 2026)
