# Sprint 165 tasks

Nothing starts until Jarmo approves the plan. The manager creates one issue per PR in milestone v2.3.0 first.

## PR 0: Research (`sprint-165-slide-library-pr0`)
- [x] Synthetic fixture generator (invented decks: copies of each other, real recurring slides, a mix)
- [x] Measure candidate rules for "same slide" and "in most decks"
- [x] Findings note to the Experience lead (`research/library-rules.md`); he chose rule G (the same slide) and rule F4 (most decks) before PR 3 and PR 4 started
- [x] No real deck or slide opened, read, counted or quoted

## PR 1: Other decks by folder (`sprint-165-slide-library-pr1`)
- [x] Host: folder, last-modified day, slide count per deck
- [x] Panel: folder headings, order, row, closed by default
- [x] Tests, shots on synthetic decks, lead's look, release-notes line, Risk and How to revert

## PR 2: Sections and Take section (`sprint-165-slide-library-pr2`)
- [x] Section detection and heading, with tests
- [x] Take section as one insert and one undo step
- [x] Tests, shots, lead's look, release-notes line, Risk and How to revert

## PR 3: Search once per slide (`sprint-165-slide-library-pr3`)
- [x] Grouping by the chosen lineage test; library first
- [x] "also in N older decks", "Folder › Deck · date", the tick
- [x] Tests, shots, lead's look, release-notes line, Risk and How to revert

## PR 4: The offer (`sprint-165-slide-library-pr4`)
- [x] The offer function (no AI call) with the chosen rule
- [x] Add all, Choose…, Not now; the topic "Every training"; the hidden set
- [x] Claude's library tool returns the same offer
- [x] Tests, shots, release-notes line, Risk and How to revert
- [x] Lead's look (the Experience lead approved it, 19 November)

## Sprint end
- [x] Full test chain once on each final head: EXIT 0 in the Review records of #843 (PR 1) and #895 (PR 4); #861 (PR 2) and #877 (PR 3) recorded no exit code on their final heads, and both are covered by #895's full chain on `e4487e1a` (EXIT 0), whose tree holds them. PR 0 is docs and a script, with no chain
- [x] `qa-validator` sign-off (20 November): every PR check passed; it asked for these records, the release plan's row, #887's note and the architecture rows, which this close-out adds
- [x] Release plan row and `docs/development/architecture.md` updated (the close-out adds the row for PRs 1 and 2 beside PR 3's and PR 4's)
