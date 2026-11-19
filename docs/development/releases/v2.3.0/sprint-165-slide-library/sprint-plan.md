# Sprint 165: The Slide library place

Track: SDD (auto-detected: five user-facing requirements, a lineage rule for "the same slide", and a flow from the library panel through the host to the deck file with undo). Override with: "use plain full track".
Branch: sprint-165-slide-library
Release tier: extension
Status: **Approved** by Jarmo on 19 November 2026: "kinnitan sprindid 165, 166 ja 167" (I approve Sprints 165, 166 and 167). Phase 3 (DEVELOP).

The parent release is v2.3.0, and its `release-plan.md` tracks this sprint. The spec is the decks README in the governance repo, section "The library place, from first principles" (`product/design/experience/experiences/decks/README.md`, ritemark-dev 6d59a97), with the sketch `library-panel.html` beside it. Jarmo agreed the design with the Experience lead and said "jah, saada arendusse" (yes, send it to development). That sends it to planning. It is not his approval of this sprint.

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract, which points at the README
- [scenarios.md](scenarios.md): examples that become the manual and test matrix
- [technical-plan.md](technical-plan.md): file pointers
- [tasks.md](tasks.md): the checklist
- [sprint-plan.md](sprint-plan.md): this file

## Goal
The library place fits a trainer who builds a new training from earlier decks: Other decks by folder, a whole section in one move, search that shows each slide once, and an offer of the slides he repeats.

## Feature Flag Check
- Needs a new flag? No. Decks stays behind the existing `ritemark.features.decks`, and every PR lives inside it. Nothing new is added or turned off.

## Linked Issues
One GitHub issue per PR in milestone v2.3.0, which the manager creates when the sprint starts.
- PR 0: [#830](https://github.com/ProductoryHQ/ritemark-native/issues/830)
- PR 1: [#831](https://github.com/ProductoryHQ/ritemark-native/issues/831)
- PR 2: [#832](https://github.com/ProductoryHQ/ritemark-native/issues/832)
- PR 3: [#833](https://github.com/ProductoryHQ/ritemark-native/issues/833)
- PR 4: [#834](https://github.com/ProductoryHQ/ritemark-native/issues/834)

## Pull requests
| PR | Branch | Content | Review tier |
|---|---|---|---|
| 0 | `sprint-165-slide-library-pr0` | Research: measure candidate "most decks" and "same slide" rules on synthetic fixture decks; findings to the Experience lead. Docs and a throwaway script only, no product code | Light |
| 1 | `sprint-165-slide-library-pr1` | Other decks grouped by folder, with date and slide count | Standard |
| 2 | `sprint-165-slide-library-pr2` | Sections in an open deck, and Take section (one undo step) | High (writes into the deck file, undo) |
| 3 | `sprint-165-slide-library-pr3` | Search shows each slide once, with "also in N older decks" and the tick | Standard |
| 4 | `sprint-165-slide-library-pr4` | The offer: slides in most decks, Add all, Choose…, Not now, topic "Every training" | High (writes into the library, a rule the lead chooses) |

Order: PR 0 runs beside PR 1 (its files are apart). PRs 1, 2, 3 and 4 run one after another, because all four change `SlideLibraryPanel.tsx` and its host (`src/decks/DeckLibrary.ts`, `SlideLibraryViewProvider.ts`, the `library/*` messages in `deckProtocol.ts`). PR 3 needs PR 0's lineage test and PR 4 needs PR 0's rule, both agreed with the lead first. Each PR fills the template's Risk and How to revert, gets `REVIEW.md`'s review at its tier with every finding answered, and merges only after the Experience lead has looked at its shots. Shots use synthetic decks only.

## Overlap with Sprint 164 (being built now)
Sprint 164 works in `DeckView.tsx`, `DeckFolds.tsx`, `slide.css` and the slide renderer, and later the Steps pill and the / menu. This sprint's files are the library panel and its host, so there is no shared file today. Three touch points to watch: the thumbnails in the panel use the slide renderer and `slide.css` (read only, so PR 2's and PR 3's shots must be retaken if Sprint 164's spacing lands after them); "insert after the current slide" goes through the deck view's insert path (PR 2 adds a many-slide insert, so check `DeckView.tsx` before it starts); and Label (Sprint 164 PR 3) changes a slide's file form, which Take section copies as it is.

## Removals (HARD RULE #1)
None found. The README's "one kind of library slide" needs nothing removed: `kind` in `DeckLibrary.ts` and `deckLibraryFormat.ts` is the slide's layout, not a template-or-reusable mark, and the library already keeps its topics as decks in the `Slide library` folder. Confirmed by a read-only look. If a PR finds code that really goes, it is listed here and waits for Jarmo's yes by name.

## Success Criteria
- [ ] Other decks show under folder headings (project name for the top level), ordered by newest deck, with name, date and slide count; every deck starts closed.
- [ ] Take section puts a whole section after the current slide, in order, as copies with handout and prompts, and one undo removes it all.
- [ ] Search lists each slide once at its newest copy, library first, with "also in N older decks" and the tick for the open deck.
- [ ] The offer shows up to six repeated slides, never adds by itself, and Not now hides them for good.
- [ ] The offer's rule and the lineage test are chosen by the Experience lead from PR 0's findings before PR 3 and PR 4 start.
- [ ] No real deck or slide of Jarmo's was opened, read, counted or quoted, in research, tests or shots.
- [ ] The Experience lead has seen each PR's shots before it merges.
- [ ] The full test chain ran once on each final head.
- [ ] `qa-validator` has signed off at the sprint's end.

## Release notes
One line per PR, in plain words for people, written with the `release-notes` skill. Decks is behind its flag, so these wait with the rest of Decks.
- PR 1: the slide library lists your other decks by the folder they are in, newest first, so one big deck no longer fills the column.
- PR 2: take a whole section of another deck into yours in one step.
- PR 3: a slide that lives in many decks shows once in search, at its newest copy.
- PR 4: the library offers the slides you use in most of your decks, and you decide whether to keep them.

## Risks
- Decks copied from each other repeat everything, so a naive "most decks" rule offers the wrong slides. PR 0 measures first.
- Take section writes many slides at once. It must be one undo step and must not drop a handout or a prompt.
- Real decks are client material: all fixtures are synthetic, and shots too.

## Approval
- [x] Jarmo approved this sprint plan (19 November 2026)
