# PR 4 proof: Publish from the deck's bar

Nothing was sent anywhere. Two kinds of proof:

- **The fake Cloudflare host** (`PublishController.test.ts`, 43 of 43 pass): the controller with the real Cloudflare host against the local fake server, 2.2's real gather on a deck's page on disk, and the record store.
- **A dev window** (`scripts/qa/dev-launch-isolated.sh`: its own profile, AI homes and mock keychain), opened on a copy of the demo project, with `ritemark.features.decks` on. No Cloudflare account was connected. The sheet harness (`RITEMARK_PUBLISH_SHEET_HARNESS`) drew frame 3, with a test stand-in for the account. For the chip, a publish record was written into the run's own profile, with a stand-in address that was never opened. The window was quit as soon as the checks were done.

## Against the fake host (unit tests)

- **A first publish.** The sheet shows the deck's rows: "5 slides and their handout, 2 prompts with Copy, and the pictures they use." and "On your computer: speaker notes on 2 slides, and 1 skipped slide." What goes is the page and its one picture. None of the 21 private test words is in any request or uploaded byte.
- **Edits to the deck.**
  - A change to the speaker notes and to a skipped slide writes the same page. It doesn't show as changed.
  - A public edit shows "changed". Update the page then goes without the sheet (same pictures, nothing key-shaped), keeps the address, and the change is gone after it.
- **How the bar's Publish ends.** `publishFromBar` says how it ended. A cancel in the sheet is `cancelled`, with no record and no failure line. A second press while the sheet is open is `busy` and changes nothing, and the first press is still a cancel. A failed upload is `failed`, with its line, and the next press is `published`. Before the whole-window sheet, Publish is `not-ready`. The deck's bar takes its page back only on a cancel, a refusal or `not-ready`, never on `busy` or `failed`.
- **The sheet's rows only when the sheet shows.** An unchanged Update goes without the sheet and without asking for its rows.

## In the dev window, at 1440 × 900

| Shot | Shows |
| --- | --- |
| `pr4-setup-sheet-1440.png` | Publish pressed with no account: 2.2's frame 2, Set up. This one came from the Preamble check deck, open behind the main tab. Its page, `Preamble check.html`, was written beside the deck. Cancel took it back: the folder afterwards held only the two decks. |
| `pr4-sheet-what-goes-1440.png` | Frame 3 for the demo deck's page, from the sheet harness. What goes: "12 slides and their handout, 2 prompts with Copy, and the pictures they use. Nothing else from the project." What stays: "On your computer: speaker notes on 1 slide, and 1 skipped slide." The harness logged `1 file(s), 0 left out, 0 key-shaped place(s); answered cancel; nothing sent`. |
| `pr4-chip-published-1440.png` | The chip, "Published". It was drawn after a speaker-notes change on disk, which is no change. |
| `pr4-chip-menu-unchanged-1440.png` | Its menu: See online, Copy link, Update the page (unavailable, "No changes"), Unpublish. |
| `pr4-chip-changed-1440.png` | After a public edit on disk ("two short breaks"): "Published · changed". |
| `pr4-chip-menu-changed-1440.png` | The menu, with Update the page available. |

The thumbnails carry their fit (`data-step`, all 0 for the demo deck).

## The review's fixes, in a second dev window (same isolation, Decks on, no account)

A copy of the demo project with two more decks: "Fit check", whose second slide needs one size smaller to fit, and "Broken front", whose front matter has a colon in a value (`subtitle: Training: Day 1`) and a test word (`client: FRONTWORDQXZ`).

- **The fit, with the strip hidden.**
  - With the strip shown, the thumbnails measured `[0, 1, 0]`.
  - The strip was hidden, so no thumbnail was there, and Publish was pressed twice in one go. `Fit check.html` was written, and one sheet opened (`pr4-two-presses-one-sheet-1440.png`).
  - The written page was compared with the page built for each possible list of steps. It is byte for byte the page for `[0, 1, 0]`, and differs from `[0, 0, 0]`, which is what the bar sent before this fix.
- **Cancel takes the page back.** After Cancel, the folder held only the decks again. The take-back now comes from the flow's own `cancelled`.
- **A front matter the editor can't read.** The deck view shows such a front matter as words at the top of its handout (`pr4-broken-front-matter-view-1440.png`). That is the editor's own rule, unchanged here. The page written for it has neither `FRONTWORDQXZ` nor `Training: Day`, and it has the handout's words. Cancel took it back too.
- **Decks turned off in Settings** hid the bar's Publish at once, and turned on again showed it.

The window was run twice, after round 2's fixes and again after round 3's (the page held while it is written, `publishText`), with the same results each time.

Fault first for the front matter: each guard put in `publishText` in turn, then `publicDeck.test.ts` run.

| `publishText`'s guard | The test |
| --- | --- |
| None (round 1) | fails: `the front matter's words reached the page ("---\ndeck: 1\nclient: FRONTWORDQXZ\nsubtitle: Training: Day 1\n---\n")` |
| Round 2's: the editor's body starts with a front matter | fails: `the front matter's words reached the page ("---\ndeck: 1\n---note: FRONTWORDQXZ\nclient: FRONTWORDQXZ\n---\n")` |
| Round 3's: the editor's body is exactly what follows the front matter `parseDeck` reads | passes |

## The bar and the sheet's line (the Experience lead, frame 2)

These come after PR 3 reached main and Present (PRs 5 and 6) joined the bar. A dev window again, at 1440 × 900.

| Shot | Shows |
| --- | --- |
| `pr4-bar-unpublished-1440.png`, `pr4-bar-unpublished-closeup.png` | Not yet published, left to right: Card \| Borderless, Saved, **Publish** (outlined, with the globe), **Present** (the filled indigo split button, the bar's one primary, at the right end). |
| `pr4-bar-published-1440.png`, `pr4-bar-published-closeup.png` | Published: the chip, "Published" with its caret, in Publish's place. A stand-in record was written into the run's own profile; nothing was sent. |
| `pr4-sheet-deck-line-1440.png` | The sheet for the deck's page, from the sheet harness: "People open it in their browser, on a computer or a phone." under the title. Every other page keeps 2.2's line, which the tests check. |

Measured in the window, every control is 30 px tall with its top at 7 px, so all are centred on the bar's line. That covers Card \| Borderless, Publish and the chip, and both parts of Present. The sizes are the shared ones: the Button's new `bar` size, which a split button takes as `size="bar"`, and nothing set by hand.

Every other shot in these windows carries a dev-build toast, "Activating extension 'GitHub.copilot-chat' failed…". It comes from VS Code's own built-in Copilot Chat in the development build, not from Ritemark or this PR, and Ritemark's release builds don't ship that extension.

## Not verified

- A real publish, Update and Unpublish against Cloudflare, and the page on a phone. Only Jarmo can run these, on his account.
- Copy link and See online in the window. They are 2.2's commands; Copy link would have written to the computer's clipboard.
- Publishing…, Unpublishing… and the menu's actions with a connected account in a window (they are covered by the unit tests).
- In a window: the page built from words typed a moment before the press, before the document has them. It wasn't tried; `publishText`'s tests cover the joining.
- In a window: a press while the page's sheet is open from the browser's bar. `holdPage`, `isBusy` and `busy` are covered by the unit tests.
