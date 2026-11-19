# Sprint 166: Two slide editor fixes from Jarmo's 19 November test

Release tier: extension

Track: Lightweight (two bug fixes, one PR each, no new dependency). Decks stays behind `ritemark.features.decks`, so no new flag.

Branch: `sprint-166-slide-fixes` (this plan); the fixes on `sprint-166-slide-fixes-pr1` and `sprint-166-slide-fixes-pr2`.

Status: plan waiting for Jarmo's approval.

## Goal

On a block slide, the formatting bubble's buttons change the selected text; and in Slide only, the wheel, the trackpad and the keys move between slides, as designed on 16 November.

## Fix 1: the formatting bubble (PR 1, issue #822)

Issue [#822](https://github.com/ProductoryHQ/ritemark-native/issues/822), milestone v2.3.0. Jarmo, 19 November: "bugi? Ükski nendest ei muuda mitte midagi slaidi teksti peal" (bug? none of these change anything in the slide's text). He selected a heading's word inside a Columns block; the bubble appeared and showed the right state (H3 lit), and none of its buttons changed the text.

Likely cause, not yet proven: the bubble reads the slide editor's selection but its commands run on another editor instance, or the click blurs the slide and the selection is lost first. The first step is a test that reproduces it. Where to look: `extensions/ritemark/webview/src/components/decks/blocks/SlideEditor.tsx` (`<FormattingBubbleMenu editor={editor} appendToBody />`) and `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`, which the Text editor uses too.

- [ ] A test that fails before the fix; the cause found and fixed at its source.
- [ ] Each bubble button changes the text on a plain slide body and in a Columns block (Jarmo's case).
- [ ] ⌘B and ⌘I from the keyboard still work; ⌘Z after a bubble change undoes it.
- [ ] The Text editor's bubble is unchanged.
- [ ] Two shots or a short recording, before and after, on a synthetic deck.

## Fix 2: moving between slides in Slide only (PR 2, issue #824)

Issue [#824](https://github.com/ProductoryHQ/ritemark-native/issues/824), milestone v2.3.0. Jarmo, 19 November: "Editori vaates raske navigeerida slaidide vahel. Hetkel ainus viis minna thumbnail list kaudu." (It's hard to move between slides in the editor view; the only way now is the thumbnail list.)

As designed (his own 16 November ask, built for the full-slide view): in Slide only, a wheel or trackpad gesture anywhere over the stage moves one slide, over the slide and over the empty bands around it; ↑ ↓, Page Up, Page Down, Home and End do the same when the cursor isn't in the words. The Experience lead recommends keeping one slide per gesture rather than a continuous scroll.

Seen on main: the full-slide wheel effect in `extensions/ritemark/webview/src/components/decks/DeckView.tsx` (about lines 961–985) is attached only to the stage and only while the full-slide view is on, and returns early when the stage can scroll and the pointer isn't over the slide, so the empty bands may do nothing. Other suspects: the effect running before the stage exists after the view switch, the slide editor taking the wheel, the trackpad threshold. The empty bands should step whenever the stage itself has nothing to scroll.

- [ ] A test that fails before the fix.
- [ ] Proof: the slide index after each gesture, with mouse-wheel and trackpad-style events, over the slide and over the bands, at 1440×900, and after each key.
- [ ] Typing, selecting and scrolling inside the words still behave as before.

**Order:** PR 2 starts after Sprint 164 PR 1 (#819) merges, because both change `DeckView.tsx`. PR 1 can start at once.

## For both PRs

- REVIEW.md tier: Standard. The PR fills Risk and How to revert; the review record names the reviewed commit; the Experience lead looks at the shots before the merge.
- One plain line each in the Decks section of `docs/releases/v2.3.0/release-notes.md`.
- `Closes #822` and `Closes #824`.
- The full test chain once on each final head; `qa-validator` at the sprint's end.
- Synthetic decks only in tests and shots; never real client material.

## Not in this sprint

Which of the bubble's items belong on a slide (a checklist, H1 or H2) is a later question for the Experience lead. This sprint makes the buttons that are shown work, and removes none of them. Continuous scrolling between slides (asked about by Jarmo) is not built; the one-slide-per-gesture design stays unless he decides otherwise.

## Removals (HARD RULE #1)

None.

## Approval

- [ ] Jarmo approved this sprint plan
