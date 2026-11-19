# Sprint 166: The formatting bubble works on a block slide

Release tier: extension

Track: Lightweight (one component, a bug fix, under 200 lines, no new dependency). Decks stays behind `ritemark.features.decks`, so no new flag.

Branch: `sprint-166-slide-bubble`

Status: plan waiting for Jarmo's approval.

## Goal

On a block slide, the formatting bubble's buttons change the text that is selected.

## The bug

Issue [#822](https://github.com/ProductoryHQ/ritemark-native/issues/822), milestone v2.3.0. Jarmo found it in his dev test on 19 November: "bugi? Ükski nendest ei muuda mitte midagi slaidi teksti peal" (bug? none of these change anything in the slide's text).

He selected a heading's word inside a Columns block. The formatting bubble appeared and showed the right state (H3 lit): B, I, H1, H2, H3, the lists, quote, code and link. None of its buttons changed the text.

Likely cause, not yet proven: the bubble reads the slide editor's selection, but its commands run on another editor instance (the handout or the document editor), or the click blurs the slide and the selection is lost first. The first step of the fix is to find out which, with a test that reproduces it.

Where to look: the slide editor mounts the bubble at `extensions/ritemark/webview/src/components/decks/blocks/SlideEditor.tsx` (`<FormattingBubbleMenu editor={editor} appendToBody />`). The bubble itself is `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`, and the Text editor uses it too through `extensions/ritemark/webview/src/components/Editor.tsx`.

## Success Criteria

- [ ] On a plain slide body, select a word and press each bubble button: the text changes.
- [ ] The same inside a Columns block, on a heading's word (Jarmo's case).
- [ ] ⌘B and ⌘I from the keyboard still work on the slide.
- [ ] ⌘Z after a bubble change undoes that change.
- [ ] The Text editor's bubble is unchanged.
- [ ] A test fails before the fix and passes after it.

## Implementation Checklist

- [ ] Reproduce on a synthetic deck, with the flag on, and write the test that fails.
- [ ] Find which of the two causes it is, and fix it at its source.
- [ ] Check the plain slide body and a Columns block by hand.
- [ ] Check ⌘B and ⌘I from the keyboard, and ⌘Z after a bubble change.
- [ ] Check that the Text editor's bubble behaves as before.
- [ ] Take one short screen recording, or two shots, before and after (synthetic deck only, no real client material).
- [ ] Add one plain line to the Decks section of `docs/releases/v2.3.0/release-notes.md`.
- [ ] Open one PR from this branch holding the plan and the fix, with `Closes #822`.

## Review

REVIEW.md tier: Standard. The PR's Risk and How to revert are filled in as the template asks, and the review record names the reviewed commit.

## Not in this sprint

Which of the bubble's items belong on a slide (a checklist, H1 or H2, for example) is a later question for the Experience lead. This sprint makes the buttons that are shown work, and removes none of them.

## Approval

- [ ] Jarmo approved this sprint plan
