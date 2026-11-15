# PR 4 proof: Publish from the deck's bar

Nothing was sent anywhere. Two kinds of proof:

- **The fake Cloudflare host** (`PublishController.test.ts`, 43 of 43 pass): the controller with the real Cloudflare host against the local fake server, 2.2's real gather on a deck's page on disk, and the record store.
- **A dev window** (`scripts/qa/dev-launch-isolated.sh`: its own profile, AI homes and mock keychain), opened on a copy of the demo project, with `ritemark.features.decks` on. No Cloudflare account was connected. The sheet harness (`RITEMARK_PUBLISH_SHEET_HARNESS`) drew frame 3, with a test stand-in for the account. For the chip, a publish record was written into the run's own profile, with a stand-in address that was never opened. The window was quit as soon as the checks were done.

## Against the fake host (unit tests)

- **A first publish.** The sheet shows the deck's rows: "5 slides and their handout, 2 prompts with Copy, and the pictures they use." and "On your computer: speaker notes on 2 slides, and 1 skipped slide." What goes is the page and its one picture. None of the 21 private test words is in any request or uploaded byte.
- **Edits to the deck.**
  - A change to the speaker notes and to a skipped slide writes the same page. It doesn't show as changed.
  - A public edit shows "changed". Update the page then goes without the sheet (same pictures, nothing key-shaped), keeps the address, and the change is gone after it.
- **A first publish cancelled in the sheet** leaves no record and no failure line. The deck's bar reads that state as a cancel and takes its page back.

## In the dev window, at 1440 × 900

| Shot | Shows |
| --- | --- |
| `pr4-bar-publish-1440.png` | The deck's bar: Card and Borderless, Saved, then **Publish**, ready because the whole-window sheet is there. |
| `pr4-setup-sheet-1440.png` | Publish pressed with no account: 2.2's frame 2, Set up. This one came from the Preamble check deck, open behind the main tab. Its page, `Preamble check.html`, was written beside the deck. Cancel took it back: the folder afterwards held only the two decks. |
| `pr4-sheet-what-goes-1440.png` | Frame 3 for the demo deck's page, from the sheet harness. What goes: "12 slides and their handout, 2 prompts with Copy, and the pictures they use. Nothing else from the project." What stays: "On your computer: speaker notes on 1 slide, and 1 skipped slide." The harness logged `1 file(s), 0 left out, 0 key-shaped place(s); answered cancel; nothing sent`. |
| `pr4-chip-published-1440.png` | The chip, "Published". It was drawn after a speaker-notes change on disk, which is no change. |
| `pr4-chip-menu-unchanged-1440.png` | Its menu: See online, Copy link, Update the page (unavailable, "No changes"), Unpublish. |
| `pr4-chip-changed-1440.png` | After a public edit on disk ("two short breaks"): "Published · changed". |
| `pr4-chip-menu-changed-1440.png` | The menu, with Update the page available. |

The thumbnails carry their fit for Publish (`data-step`, all 0 for the demo deck).

## Not verified

- A real publish, Update and Unpublish against Cloudflare, and the page on a phone. Only Jarmo can run these, on his account.
- Copy link and See online in the window. They are 2.2's commands; Copy link would have written to the computer's clipboard.
- Publishing…, Unpublishing… and the menu's actions with a connected account in a window (they are covered by the unit tests).
