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

- [x] A test that measures the pill's position before and after choosing (and after un-choosing); it fails before the fix.
- [x] The card's edge shows as before; the blocks around the button do not move when it is chosen or not.
- [x] A button with words beside it is unchanged. The Text document's solo button jumped too (the words' field opened on its left and pushed it about 520 px right, and 10 px down), so it gets the same fix (the Experience lead's correction).
- [x] One before shot and one after shot, on a synthetic deck.

## For this PR

- REVIEW.md tier: Standard. The PR fills Risk and How to revert; the review record names the reviewed commit; the Experience lead looks at the two shots before the merge.
- One plain line in the Decks section of `docs/releases/v2.3.0/release-notes.md`: a button that stands alone no longer moves when you click it.
- `Closes #876`.
- The full test chain once on the final head; `qa-validator` at the sprint's end.
- Synthetic decks only in tests and shots.

## Removals (HARD RULE #1)

None.

## Approval

- [x] The Development manager and the Experience lead approved this sprint plan (delegated by Jarmo on 19 November 2026: "1 jah", "kinnitatud"; the Experience lead's approval came with the correction below)

## The Experience lead's correction (19 November, with the approval)

The README's rule is that a lone button never moves under the pointer that chooses it, in a Text document too. Check the Text document's solo button: if it jumps as well, fix it the same way; if not, leave `buttonBlock.css` alone. Before and after shots for both surfaces.

## Close-out (19 November 2026)

- PR 1, [#890](https://github.com/ProductoryHQ/ritemark-native/pull/890), merged (`3435f67b`) and closed [#876](https://github.com/ProductoryHQ/ritemark-native/issues/876). The Text document's lone button jumped too, so `buttonBlock.css` got the same fix; before and after shots for both surfaces are in `proof/`.
- Tests: #890's review record says the full chain ran once on its final head, `5f358114`, but its exit code was not written down. Main's code with #890 in it later passed the full chain with EXIT 0 on #892's final head, `5bb9c4da` (Sprint 164 PR 4's review record), which is the evidence this close-out relies on.
- `qa-validator` at the sprint's end (19 November): every check passed apart from the unticked approval line above, which this close-out ticks, and the missing exit code, answered in the line before.
- Not run: Windows (the fix is CSS that doesn't differ by platform).
