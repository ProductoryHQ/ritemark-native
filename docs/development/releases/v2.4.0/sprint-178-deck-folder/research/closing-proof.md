# Sprint 178 closing proof

This page checks the sprint against its spec, R1–R7 in the [sprint plan](../sprint-plan.md) (the Decks README section "A deck's own folder"), as built on 27 November 2026.

Two changes after the plan shape what is checked:
- In 2.4 the folder sits beside the deck rather than folded under it (Jarmo, 26 November). Patch 023 was dropped (#1105, closed), and folding comes after 2.4 (#1108).
- The folder is named after the whole deck file: `Kickoff.rtms.files`, or `Kickoff.deck.md.files` for an older deck (Jarmo, 27 November).

## The PRs

| PR | What |
|---|---|
| #1110 | New deck pictures go into the deck's folder: paste, drop, the picker, the strip and ChatGPT pictures for slides. Every deck line that named `images/` now names the folder. |
| #1119 | Publish writes the page, `fonts/` and `logos/` into the deck's folder. An old deck's files move at its next Publish, keeping the same link. A picture from above the deck's folder goes up at `/pictures/<hash>.<ext>` (Jarmo, "1A"). |
| #1113 | Rename, move, delete and copy follow the deck. Search, Home and the Slide library skip the folder's files. |
| #1122 | The fix after an outside review of #1113. A folder follows or leaves with the deck only when it is the deck's: the deck's pictures and its Ritemark-marked page, nothing else. The folder name becomes `<deck file>.files`. |
| #1124 | Lists (Search, Home's Last changed, the Home card's count) leave out only Ritemark's files in a deck's folder, so a person's note there still shows (#1121). |

## The spec, item by item

| Item | Status | Evidence | Still to check |
|---|---|---|---|
| R1 · One folder per deck, named after it | pass (tests and test window) | `deckFileName` tests (the name rule for both endings). The test window shows `Kickoff.rtms.files` beside `Kickoff.rtms`, with the deck's picture showing, in light and dark (#1122). | — |
| R2 · Only when needed | pass (test window, #1110) | A new deck has no folder. Its first picture makes the folder, and the picture shows with its link. | — |
| R3 · In the tree; lists show the deck, not its files | changed for 2.4: beside the deck, not folded (#1108 after 2.4). Lists: pass (tests and test window) | Search walk, freshness, Home and guidance tests (#1124). In the test window, Search finds a person's note in `Kickoff.rtms.files` but not the deck's page. The Home card reads "4 files: 2 decks and 2 text documents", and Last changed lists the note. | — |
| R4 · Moves with the deck in Ritemark | pass (tests and test window) | `deckFolderFollow` (38 tests) and `copyDeckFolder` tests. The test window showed rename, move, Copy/Paste and Alt-drag (#1113). A delete sends a folder holding only the deck's picture to the Trash with "“Pitch.rtms.files” went to the Trash with the deck." A folder holding a person's note stays with "“Kickoff.rtms.files” stayed where it was, because it holds more than the deck's pictures and published page." Both notices use the information icon (#1122). | A deck renamed in Finder or Explorer, outside Ritemark, at Gate 2. |
| R5 · Decks made before | pass (tests and live contract) | `deckPublishLayout` pins (27 tests) cover an old deck's next Publish against a stand-in Cloudflare server: the same link, fonts and logos taken back only when Ritemark wrote them, and a 2.3 record kept. The live contract (`scripts/qa/cloudflare-contract.mjs`) on the Cloudflare test account passed 11 of 11 on 27 November: connect, deploy, no-index, an update at the same address with a dropped file answering 404, unpublish, and no Worker left. | **RC Gate 2:** update a deck published with 2.3. The link stays the same, and the old page, fonts and logos leave the deck's side. |
| R6 · The words | pass (Experience lead) | The lead wrote or approved every new line: the picture bar, the Gamma paste bar, the import line and Publish's taken-name line (#1110, #1119), and both folder notices (decks spec d42134f, #1122). | — |
| R7 · Documents keep `images/` | pass (tests) | The picture writers' tests keep `images/` for documents (#1110). | — |

## Not run in this sprint

- **Windows paths.** A deck folder with spaces in its path, and on another drive letter. This needs a Windows PC, so it is proposed for RC Gate 2, where Windows runs anyway; Jarmo's answer is pending.
- **Other documents that use the folder's pictures.** A note elsewhere that shows a picture from `Kickoff.rtms.files/` isn't checked when the deck is deleted or moved. That gap was already there before this sprint's fix, and it is filed as #1123.

## Reviews

- #1119 and #1122 had High reviews by an independent reviewer, with every finding answered. The Review records are on the PRs.
- #1110, #1113 and #1124 had Standard reviews.
- Before the merge, the Experience lead saw shots from isolated test windows for every PR that changes what the person sees.
