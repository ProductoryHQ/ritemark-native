# Sprint 165 tasks

Nothing starts until Jarmo approves the plan. The manager creates one issue per PR in milestone v2.3.0 first.

## PR 0: Research (`sprint-165-slide-library-pr0`)
- [x] Synthetic fixture generator (invented decks: copies of each other, real recurring slides, a mix)
- [x] Measure candidate rules for "same slide" and "in most decks"
- [ ] Findings note to the Experience lead; wait for the chosen rules
- [x] No real deck or slide opened, read, counted or quoted

## PR 1: Other decks by folder (`sprint-165-slide-library-pr1`)
- [ ] Host: folder, last-modified day, slide count per deck
- [ ] Panel: folder headings, order, row, closed by default
- [ ] Tests, shots on synthetic decks, lead's look, release-notes line, Risk and How to revert

## PR 2: Sections and Take section (`sprint-165-slide-library-pr2`)
- [ ] Section detection and heading, with tests
- [ ] Take section as one insert and one undo step
- [ ] Tests, shots, lead's look, release-notes line, Risk and How to revert

## PR 3: Search once per slide (`sprint-165-slide-library-pr3`)
- [ ] Grouping by the chosen lineage test; library first
- [ ] "also in N older decks", "Folder › Deck · date", the tick
- [ ] Tests, shots, lead's look, release-notes line, Risk and How to revert

## PR 4: The offer (`sprint-165-slide-library-pr4`)
- [ ] The offer function (no AI call) with the chosen rule
- [ ] Add all, Choose…, Not now; the topic "Every training"; the hidden set
- [ ] Claude's library tool returns the same offer
- [ ] Tests, shots, lead's look, release-notes line, Risk and How to revert

## Sprint end
- [ ] Full test chain once on each final head
- [ ] `qa-validator` sign-off
- [ ] Release plan row and `docs/development/architecture.md` updated if the library's structure changed
