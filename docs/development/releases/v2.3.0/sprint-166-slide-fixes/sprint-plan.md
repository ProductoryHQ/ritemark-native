# Sprint 166: Slide fixes from Jarmo's 19 November test and the spacing review

Release tier: extension

Track: Lightweight (small bug fixes, one PR each, no new dependency). Decks stays behind `ritemark.features.decks`, so no new flag.

Branch: `sprint-166-slide-fixes` (this plan); the fixes on `sprint-166-slide-fixes-pr1` to `-pr4`.

Status: **Approved** by Jarmo on 19 November 2026: "kinnitan sprindid 165, 166 ja 167" (I approve Sprints 165, 166 and 167). Phase 3 (DEVELOP).

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
- [ ] A test of the guide's position at ⅓ and ⅔; one shot while dragging.


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
- [ ] A test that fails before; shots of an empty and a filled button being typed into.

### Fix 9: an unknown icon name (PR 9, issue #850)
[#850](https://github.com/ProductoryHQ/ritemark-native/issues/850): when an agent writes an icon name Ritemark doesn't know, the icon's place stays empty. On the slide, wall, strip and page a neutral fallback icon (its look is the Experience lead's call); in the editor a quiet hint on the icon ("Unknown icon: <name>, choose another"); the DECKS rules for agents list the allowed icon names.
- [ ] Tests for the fallback and the hint; shots of the fallback on a slide and the hint in the editor.

## Added on 19 November, third time (Jarmo: "jah kõigile kolmele")

### Fix 10: a gesture over the slide in Slide and handout (PR 10, issue #855)
[#855](https://github.com/ProductoryHQ/ritemark-native/issues/855): over the slide, a gesture means the same in every view. In Slide and handout a wheel or flick over the slide moves one slide, as in Slide only, and the handout scrolls to that slide's part (the strip click's path); over the handout's text the wheel scrolls the text as now and the slide follows the part being read; a long column or pane still scrolls first (#849).
- [ ] A test that fails before; the slide index after each gesture in Slide and handout, at 1440×900.

### Fix 11: a thumbnail takes no click or wheel inside it (PR 11, issue #856)
[#856](https://github.com/ProductoryHQ/ritemark-native/issues/856): a click anywhere on a thumbnail chooses that slide, and a thumbnail's columns and panes never show or catch a scrollbar.
- [x] A test; one shot of a thumbnail with a long column chosen by a centre click.
- Built (PR 11): on the strip nothing in a thumbnail's picture takes the pointer (`decks.css`), so every click and wheel there is the thumbnail's; its columns and panes keep their room and fade but draw no scrollbar. The wall's grid and the presenter view's row draw the same thumbnails and were not changed. Proof: `proof/pr11-thumbnail-clicks/`.

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

## Approval

- [x] Jarmo approved this sprint plan (19 November 2026)
