# Sprint 167: Five small block details on the slide

Track: SDD (auto-detected: five user-facing requirements, a file-format change, and a view-to-editor-to-renderer-to-published-page flow). Override with: "use plain full track".
Branch: sprint-167-block-details
Release tier: extension
Status: **Done** (20 November 2026). Approved by Jarmo on 19 November 2026: "kinnitan sprindid 165, 166 ja 167" (I approve Sprints 165, 166 and 167).

The parent release is v2.3.0, and its `release-plan.md` tracks this sprint. The spec is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`, section "Five small things from Jarmo's rundev test", ritemark-dev commit 9f05294), with the sketches in `block-details.html` beside it. Jarmo agreed the sketches with the Experience lead on 19 November ("muu on PERFECT!" for A, B, C and E, and "SOBIB D", with three refinements to D's corner chip). That sent them to planning. It is not his approval of this sprint.

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract, which points at the README
- [scenarios.md](scenarios.md): examples that become the manual and test matrix
- [technical-plan.md](technical-plan.md): file pointers
- [tasks.md](tasks.md): the checklist
- [sprint-plan.md](sprint-plan.md): this file

## Goal
Make five things a person could not find or do on a slide obvious: where the content sits, how one box or item is moved or deleted, how Boxes get numbers, how a picture goes behind, and which corner the logo takes.

## Feature Flag Check
- Needs a new flag? No. Decks stays behind the existing `ritemark.features.decks`, and every PR lives inside it. Nothing new is added or turned off.

## Linked Issues
One GitHub issue per PR in milestone v2.3.0, which the manager creates when the sprint starts.
- PR 1: [#835](https://github.com/ProductoryHQ/ritemark-native/issues/835)
- PR 2: [#836](https://github.com/ProductoryHQ/ritemark-native/issues/836)
- PR 3: [#837](https://github.com/ProductoryHQ/ritemark-native/issues/837)
- PR 4: [#838](https://github.com/ProductoryHQ/ritemark-native/issues/838)
- PR 5: [#839](https://github.com/ProductoryHQ/ritemark-native/issues/839)

## Pull requests
| PR | Branch | Content | Review tier |
|---|---|---|---|
| 1 | `sprint-167-block-details-pr1` | E: the logo's corner, four corners, and room for the logo in each | High (theme file values, every surface) |
| 2 | `sprint-167-block-details-pr2` | C: Mark for Boxes in the bar | Standard |
| 3 | `sprint-167-block-details-pr3` | A: slide content Top, Middle, Bottom | High (file format: a new slide setting) |
| 4 | `sprint-167-block-details-pr4` | D: a picture behind, the corner chip and the picture bar | High (file format use, the published page, picture handling) |
| 5 | `sprint-167-block-details-pr5` | B: one item's own handle | High (editor behaviour, every block) |

- **Follow-up** ([#912](https://github.com/ProductoryHQ/ritemark-native/pull/912), [#905](https://github.com/ProductoryHQ/ritemark-native/issues/905), branch `sprint-167-block-details-page-behind`, Standard): on the published page in one column, a picture behind runs the full height of the slide as drawn there, cover-cropped round its focus, and never ends partway down the words. The Experience lead's rule (20 November); approved under the overnight delegation by the Development manager and the Experience lead.

## Order and overlap
- **Can start now: PR 1 (E).** Its files are the theme editor's logo row, the theme file, the logo drawing and the page. Its slide.css lines are the logo room rules, apart from Sprint 164 PR 2's spacing lines. If they meet, PR 1 rebases onto PR 2 once it merges.
- **Waits for Sprint 164 PR 2 and PR 3: PR 2 (C), PR 3 (A) and PR 4 (D).** Sprint 164 PR 2 rewrites the spacing in `slide.css`, which A and D also change. Sprint 164 PR 3 adds the Label block and removes the Label row, so it changes the / menu, the block bar and Slide settings, which C (the bar) and A and D (Slide settings) change as well. Starting earlier only builds merge conflicts.
- **Waits for Sprint 166 to merge: PR 5 (B).** Sprint 166's formatting bubble lives in `SlideEditor.tsx`, which B's handle needs to hook into, and B also reads the block bar after Sprint 164 PR 3.
- **Within this sprint:** PR 3 (A) goes before PR 4 (D), since both add rows to Slide settings and D's chip placement reads the logo corner from PR 1. PR 2 (C) and PR 3 (A) both follow Sprint 164 PR 3, but their files are apart, so they may run side by side after it.
- **Sprint 165 (the library panel)** works in the Decks view and the library, apart from every file here. Nothing waits for it.
- Each PR fills the template's Risk and How to revert, gets `REVIEW.md`'s review at its tier with every finding answered, and merges only after the Experience lead has looked at its shots, taken on synthetic decks only, never on Jarmo's real decks.

## Removals (HARD RULE #1)
None. A narrow look at the code found nothing that goes. D's centred prompt over the title was a gap in the design, and the corner chip keeps its function (choose, ChatGPT), so it is a move, not a removal. If a PR's author finds something that really goes, it is listed here and waits for Jarmo's yes by name before any code is deleted.

## Success Criteria
- [x] The logo can take any of four corners, and words never run under it.
- [x] Boxes take a Mark (Icon, Number, Dot, Arrow); Number follows moves, adds and deletes.
- [x] A slide's content sits Top, Middle or Bottom on the editor, strip, wall, page and presenter view; the setting is written only when it isn't the default.
- [x] A picture goes behind without the centred prompt, from the chip, Slide settings, a paste or a drop, and a placed one can be chosen, replaced and removed.
- [x] One box, column or item can be duplicated, moved or deleted from its own handle.
- [x] The Experience lead has seen each PR's shots before it merges.
- [x] The full test chain ran once on each final head.
- [x] `qa-validator` has signed off at the sprint's end.

## Release notes
One line per PR, in plain words for people, written with the `release-notes` skill:
- PR 1: the theme's logo can sit in any of the four corners, and the slide leaves room for it.
- PR 2: Boxes can be numbered, or marked with an icon, a dot or an arrow, from the bar.
- PR 3: choose whether a slide's content sits at the top, the middle or the bottom.
- PR 4: a picture behind the slide is easy to add, choose, replace and remove.
- PR 5: every box, column and item has its own handle to duplicate, move or delete it.

## Risks
- A's file setting touches every surface and old decks, so a deck with no setting must read exactly as today.
- B's handle must not cover words or take clicks from the editor; Sprint 166's bubble sits in the same editor.
- D's chip must never take clicks from the words under it.
- Waiting for Sprint 164 leaves four PRs unable to start. The order above is the cost of not colliding.

## Questions
- Jarmo: the order puts the logo corner first and the handle last. Is that right, or is the handle (B) the one you want first?
- Experience lead: the README says a title or section slide "reads as Bottom". Is that only a value shown in Slide settings, or are the slides' own default positions kept in the theme? The plan assumes the first.

## Approval
- [x] Jarmo approved this sprint plan (19 November 2026)

## Close-out (20 November 2026)
- PR 1 [#844](https://github.com/ProductoryHQ/ritemark-native/pull/844) (the logo in any of four corners; closes #835), PR 2 [#878](https://github.com/ProductoryHQ/ritemark-native/pull/878) (Mark for Boxes; #836), PR 3 [#891](https://github.com/ProductoryHQ/ritemark-native/pull/891) (content Top, Middle or Bottom; #837), PR 4 [#900](https://github.com/ProductoryHQ/ritemark-native/pull/900) (a picture behind, from the corner chip; #838), PR 5 [#911](https://github.com/ProductoryHQ/ritemark-native/pull/911) (one item's own handle; #839), and the follow-up [#912](https://github.com/ProductoryHQ/ritemark-native/pull/912) (a picture behind runs the full height of the slide on a phone's page; #905): all merged after the Experience lead's look at their shots, on synthetic decks.
- #900 also fixed a blank-deck crash that was on main (a picture going missing while its slide is on screen), with a test.
- Tests: the full chain gave EXIT 0 on each final head (see `tasks.md`). #911 and #912 each merged while main had moved only in files the other didn't touch; both records say so.
- Not run: ChatGPT making a picture end to end (no sign-in in isolated windows), a real ⌘V and Finder drag, the native file picker (stubbed), a real phone browser for #912, Windows.
- Follow-up still open: [#910](https://github.com/ProductoryHQ/ritemark-native/issues/910), a box's icon from the keyboard (an Icon button on the block bar), filed under Sprint 169.
