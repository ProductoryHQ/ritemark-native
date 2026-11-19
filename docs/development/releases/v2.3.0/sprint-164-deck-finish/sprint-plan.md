# Sprint 164: Slide only by default, spacing on the slide, the Label block

Track: SDD (auto-detected: three user-facing requirements, a file-format and migration change, and a view-to-renderer-to-published-page flow). Override with: "use plain full track".
Branch: sprint-164-deck-finish
Release tier: extension
Status: Phase 2 (PLAN), waiting for Jarmo's approval

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
- PR 1: to be created
- PR 2: to be created
- PR 3: to be created

## Pull requests
| PR | Branch | Content | Review tier |
|---|---|---|---|
| 1 | `sprint-164-deck-finish-pr1` | A deck opens in Slide only | Standard |
| 2 | `sprint-164-deck-finish-pr2` | Spacing on the slide, variant D | High (every surface changes) |
| 3 | `sprint-164-deck-finish-pr3` | Label, a block of its own | High (file format, migration, the published page) |

Order: PR 1 and PR 2 run side by side, because their files are apart. PR 3 starts after PR 2 merges, because both change the same `slide.css` lines. Each PR fills the template's Risk and How to revert, gets `REVIEW.md`'s review at its tier with every finding answered, and merges only after the Experience lead has looked at its shots.

## Removals (HARD RULE #1)
Each of these needs Jarmo's yes by name before PR 3 starts. They are what the README says goes, and no code is deleted without it.
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

## Approval
- [ ] Jarmo approved this sprint plan
