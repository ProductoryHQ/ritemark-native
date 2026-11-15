# PR 3 proof: the handout page

The page was built by `buildDeckPage` from the demo deck (`docs/development/sprints/sprint-157-decks/demo-project/Harbour Logistics/AI assistants and agents.deck.md`, a copy outside the repo), written beside it by `writeDeckPage`, and opened from disk in a headless Chromium (agent-browser, its own profile). Nothing was published. The deck's 13 slides give 12 on the page: slide 12 (a Picture slide) is skipped.

## The fault first: each privacy rule taken out

Each of `publicDeck`'s rules was taken out in turn and `publicDeck.test.ts` run; each time the test failed and named the word that leaked, and passed again with the rule back.

| Rule taken out | The test's failure |
| --- | --- |
| Skipped slides kept | `skippedTitle: "SKIPTITLEQXN" must not go public` |
| Notes fences kept | `strayNotes: "STRAYNOTESQXF" must not go public` |
| Comments kept | `standaloneComment: "STANDALONEQXI" must not go public` |
| `<mark>` tags kept | `anchoredComment: "ANCHOREDQXG" must not go public` |
| Every word of a slide kept | `id: "idqxc" must not go public` |

The same 21 test words are checked in the page's bytes (`pageHtml.test.ts`) and in every file 2.2's gather sends (`pageFile.test.ts`, a real project on disk: the page and the one picture a shown part uses; no `.md`, no picture only a skipped slide uses, no key-shaped hit with the fonts inlined, `scriptBuilt` false).

## The page, at 1440 × 900 and 390 × 844

| Shot | Shows |
| --- | --- |
| `pr3-page-top-*.png` | The top: client and session, 1 / 12, Contents; on a computer the slide on the left, centred, arrows under it; on a phone the slide at the top, the text under it. |
| `pr3-section-band-*.png` | Section 1 as the grey band with "Section 1" over its title, the current part (4 / 12), reached from Contents. |
| `pr3-copy-copied-*.png` | Copy on a prompt says Copied. |
| `pr3-copy-fallback-*.png` | With no clipboard and a refused copy command: the prompt's words selected, and "Selected. Press Ctrl+C or ⌘C to copy." |
| `pr3-ticks-after-reload-*.png` | The exercise's four steps ticked, then the page read again: still ticked (`[true,true,true,true]`). |
| `pr3-contents-*.png` | Contents, every part by number and title, sections bold, the finished exercise with a tick. |
| `pr3-borderless-*.png` | The same deck with `look: borderless`: the slide's words on white. |

## The scroll rule

One 400 px wheel turn at a time at 1440 × 900, the slide shown after each turn. Down: `2 3 4 5 6 7 8 9 10 11 12 12 12 12`; up: `11 10 9 8 7 6 5 4 3 2 1 1 1 1`. One part at a time, both ways, none skipped. `pageScript.test.ts` runs the page's copy of the rule and `scrollRule.ts` over 10,000 generated states and they agree on every answer.

## Not verified here

- That the text before the first slide shows in the deck view's handout. Read from the code (the handout is the editor holding the whole file, and nothing hides blocks before the first part head); the dev window check is in PR 4.
- That the deck view's fit steps give the same fit on the page (they reach the page in PR 4).
- Safari and Firefox; a real phone.
