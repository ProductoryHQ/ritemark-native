# Sprint 164: Slide only by default, spacing on the slide, the Label block

Track: SDD (auto-detected: three user-facing requirements, a file-format and migration change, and a view-to-renderer-to-published-page flow). Override with: "use plain full track".
Branch: sprint-164-deck-finish
Release tier: extension
Status: **Approved** by Jarmo on 19 November 2026, with the three removals by name: "kinnitan sprindi 164 koos eemaldustega" (I approve Sprint 164 with the removals). Phase 3 (DEVELOP): PR 1 and PR 2 started. **Done** on 19 November: see Close-out.

The parent release is v2.3.0, and its `release-plan.md` tracks this sprint (the release plan is written elsewhere and is not edited here). The spec is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`), agreed with Jarmo on 19 November in ritemark-dev commits 3eb72b7, 5bc0f70 and 7382bee.

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract, which points at the README
- [scenarios.md](scenarios.md): examples that become the manual and test matrix
- [technical-plan.md](technical-plan.md): file pointers
- [tasks.md](tasks.md): the checklist
- [sprint-plan.md](sprint-plan.md): this file

## Goal
Finish the Decks look after Jarmo's rundev test on 19 November: a deck opens in Slide only, the slide's spacing follows variant D, and the exercise pill becomes a free Label block.

## Feature Flag Check
- Needs a new flag? No. Decks stays behind the existing `ritemark.features.decks`, and all three PRs live inside it. Nothing new is added or turned off.

## Linked Issues
One GitHub issue per PR in milestone v2.3.0, which the manager creates when the sprint starts.
- PR 1: [#816](https://github.com/ProductoryHQ/ritemark-native/issues/816)
- PR 2: [#817](https://github.com/ProductoryHQ/ritemark-native/issues/817)
- PR 3: [#818](https://github.com/ProductoryHQ/ritemark-native/issues/818)

## Pull requests
| PR | Branch | Content | Review tier |
|---|---|---|---|
| 1 | `sprint-164-deck-finish-pr1` | A deck opens in Slide only | Standard |
| 2 | `sprint-164-deck-finish-pr2` | Spacing on the slide, variant D | High (every surface changes) |
| 3 | `sprint-164-deck-finish-pr3` | Label, a block of its own | High (file format, migration, the published page) |

Order: PR 1 and PR 2 run side by side, because their files are apart. PR 3 starts after PR 2 merges, because both change the same `slide.css` lines. Each PR fills the template's Risk and How to revert, gets `REVIEW.md`'s review at its tier with every finding answered, and merges only after the Experience lead has looked at its shots.

## Removals (HARD RULE #1)
Jarmo approved all three by name on 19 November 2026 ("kinnitan sprindi 164 koos eemaldustega"). They are what the README says goes, and no code is deleted without it.
- The Label row in a slide's Settings (`webview/src/components/decks/SlideSettings.tsx`, the `LabelRow`). The Label block replaces it.
- The rule that a new Steps block takes the deck's last label (`lastPillLabel` and its callers in the / menu and the block bar). A new Steps block comes without a Label.
- The pill rule that uses a column's padding-top (`slide.css`, about lines 309 and 310). It goes because PR 2 removes that padding, and a Steps block's pill is migrated to a Label by PR 3.

## Success Criteria
- [ ] Every deck, new ones included, opens in Slide only, keeps the chosen view while open, and starts in Slide only again on reopen. Nothing is stored in the file.
- [ ] The spacing matches variant D on the editor, strip, wall and page, at every fit level.
- [ ] A Label can be added from the / menu, stands anywhere on a slide, and round-trips as `[text]{.label}`.
- [ ] Existing Steps pills become Labels in the same place with the person's words.
- [ ] The Experience lead has seen each PR's shots before it merges.
- [ ] The full test chain ran once on each final head.
- [ ] `qa-validator` has signed off at the sprint's end.

## Release notes
One line per PR, in plain words for people, written with the `release-notes` skill:
- PR 1: a deck opens with just the slide, and you choose when to bring the handout in.
- PR 2: the space on every slide is even: between blocks, inside boxes and between columns.
- PR 3: Label is a block you add anywhere on a slide, in your own words.

## Risks
- The spacing change touches every surface, so the before and after shots matter more than any test.
- The file form `[text]{.label}` may clash with the parser (tell the Experience lead if it does).
- Migration must not lose a person's pill words.

## Close-out
Sprint 164 closed on 19 November 2026.

- **PR 1, [#819](https://github.com/ProductoryHQ/ritemark-native/pull/819)** (Standard): every deck, new ones too, opens in Slide only; the view chosen is kept while the deck is open, and a reopened deck starts in Slide only again. Nothing is written to the file.
- **PR 2, [#821](https://github.com/ProductoryHQ/ritemark-native/pull/821)** (High): spacing on the slide follows variant D: 12 px under blocks, 18 px inside surfaces (table cells 18 and 9), 32 px between columns with no column padding, and 16 px between boxes, on the editor, the strip, the wall and the page.
- **PR 3, [#858](https://github.com/ProductoryHQ/ritemark-native/pull/858)** (High): Label is a block of its own, added from the / menu and written `[text]{.label}`. An existing Steps pill becomes a Label in the same place, with the person's words. The three removals Jarmo approved by name are done: Settings' Label row, the last-label rule and the pill's padding-top rule.
- **PR 4, [#892](https://github.com/ProductoryHQ/ritemark-native/pull/892)** (Standard): the dead code PR 3 left only so that `DeckView.tsx` still compiled is gone (`withStepsTag`, the `blockStepsTagOf` alias, `SlideSettings`' `stepsTag`/`onUndo` props, DeckView's `stepsTagSetting`, `updateSlideMarkdown`). No behaviour changes.

The Experience lead approved the shots of #819, #821 and #858. The full test chain ran once on each final head (the PRs' Review records), and `qa-validator` signed off on 19 November.

**The decision about a bare `::: steps`.** Jarmo said a Label is free and tied to no block. So a Steps block written without a pill (`::: steps`) no longer draws the default "Exercise" pill. A pill that was written (`tag="…"`) becomes a Label with its words, and a v1 Exercise slide still converts with "Exercise" as its Label.

**Not run:** Windows, and the presenter view on a second display.

## Approval
- [x] Jarmo approved this sprint plan (19 November 2026), with the three removals
