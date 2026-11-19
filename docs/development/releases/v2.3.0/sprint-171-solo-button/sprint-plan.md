# Sprint 171: A solo Button stays where it is when chosen

Release tier: extension

Track: Lightweight (one domain, a CSS fix well under 200 LOC, no dependency, no flag). Decks stays behind `ritemark.features.decks`.

Branch: `sprint-171-solo-button` (this plan and the one PR).

Status: **Approved** by Jarmo on 19 November 2026: "1 jah", "kinnitatud" (Jarmo) and "jah sa tee ise otsuseid" (Jarmo to the Experience lead): the Development manager and the Experience lead approve small plans tonight. Phase 3 (DEVELOP).

## Goal

A button with no words beside it keeps its pill exactly where it is when it is chosen and when it is no longer chosen.

## The issue (PR 1, issue #876)

Issue [#876](https://github.com/ProductoryHQ/ritemark-native/issues/876), milestone v2.3.0, from the Experience lead's review of #873: a solo button (no words beside it) becomes a card when it is chosen, so the pill jumps under the pointer. The design is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`, the Button block).

The fix: when a solo button is chosen, its card grows outward around the pill, and the card's padding is taken back as a negative margin, so the pill stays exactly where it was. When it is no longer chosen, the card goes away the same way and nothing around it moves.

Where to look: the unchosen solo rule in `extensions/ritemark/webview/src/components/decks/slide/slide.css` (`.blk-button.is-solo:not(.is-chosen)`, about line 229) and its twin in `extensions/ritemark/webview/src/extensions/buttonBlock/buttonBlock.css` (line 28), which draws the same block in a Text document and must not change.

- [ ] A test that measures the pill's position before and after choosing (and after un-choosing); it fails before the fix.
- [ ] The card's edge shows as before; the blocks around the button do not move when it is chosen or not.
- [ ] A button with words beside it is unchanged; the Text document's button is unchanged.
- [ ] One before shot and one after shot, on a synthetic deck.

## For this PR

- REVIEW.md tier: Standard. The PR fills Risk and How to revert; the review record names the reviewed commit; the Experience lead looks at the two shots before the merge.
- One plain line in the Decks section of `docs/releases/v2.3.0/release-notes.md`: a button that stands alone no longer moves when you click it.
- `Closes #876`.
- The full test chain once on the final head; `qa-validator` at the sprint's end.
- Synthetic decks only in tests and shots.

## Removals (HARD RULE #1)

None.

## Approval

- [ ] The Development manager and the Experience lead approved this sprint plan (delegated by Jarmo; pending)

## The Experience lead's correction (19 November, with the approval)

The README's rule is that a lone button never moves under the pointer that chooses it, in a Text document too. Check the Text document's solo button: if it jumps as well, fix it the same way; if not, leave `buttonBlock.css` alone. Before and after shots for both surfaces.
