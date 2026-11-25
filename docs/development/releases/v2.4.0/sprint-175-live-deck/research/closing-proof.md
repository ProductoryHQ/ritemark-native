# Sprint 175 closing proof

The table records evidence available in the merged tests and PR commit bodies for [S1–S21](../scenarios.md). A pass applies to the behaviour named in the evidence column. The remaining checks need a run by the Development manager. Experience frame numbers come from the [sprint plan](../sprint-plan.md) and [tasks](../tasks.md). The drawings are outside this checkout.

| Scenario | Name | Status | Evidence and remaining checks | Experience shot |
|---|---|---|---|---|
| S1 | Turning it on. | pass (test: DeckPublish.test.ts, deckPublish.test.ts) | The switch sends the on action and the publisher builds the same page as a manual update. Verify the full sequence on the publishing test account. The shipped chip keeps **Live** with a spinner while sending (PR 7, `8124c236`). | Experience 52, frames 1–2 |
| S2 | Turning it off. | pass (test: DeckPublish.test.ts, liveUpdate.test.ts) | The menu sends the off action and restores manual update. The controller stops an in-flight attempt before sending when switched off. Check a subsequent save in the test window. | Experience 52, frames 1–2 |
| S3 | A key typed while Live. | pass (test: liveUpdate.test.ts, DeckPublish.test.ts) | The update pauses, the guarded retry refuses the key, and a clean save waits for Go on. Menu tests cover the pause copy, slide action and disabled Go on. Check the open page, key selection and absence of interruptions on the publishing test account. | Experience 52, frame 4 |
| S4 | An AI takes the key out. | pass (test: liveDeckTurn.test.ts, liveUpdate.test.ts) | The first turn gets a pause step. A later save during the existing pause gets no step and leaves the pause in place. Run the two turns with a live page. | Experience 52, frames 3–4 |
| S5 | A picture from outside the deck's folder. | not run: Windows path case and link checks | `liveUpdate.test.ts` covers the outside-folder and link-escape guards. Repeat with real Windows paths and links. | — |
| S6 | A picture inside it. | pass (test: liveUpdate.test.ts, pictureClean.test.ts) | The fake upload covers cleaned picture bytes, accepted pictures and pauses for oversize, file count and uncleanable pictures. The cleaner tests metadata removal and orientation. Check the delivered picture and tooltip on the publishing test account. | Experience 52, frame 1 |
| S7 | Two quick saves while a deploy runs. | pass (test: deckLive.test.ts) | A held send followed by B and C sends only A and C and stays in the updating state until done. Verify the published page on the test account. The shipped chip shows a spinner beside **Live**. | Experience 52, frame 1 |
| S8 | An AI turn edits a live deck. | pass (test: deckPublish.test.ts, liveDeckTurn.test.ts) | Receipts produce the success and pause steps, and timetable-only saves produce no step. Run all three turns with a live page and check the status bar. | Experience 52, frame 3 |
| S9 | A reader on a phone, a slide changed. | pass (test: pageFollower.test.ts) | Scroll and selection delay the update, and the reader stays on the slide with a two-second highlight. PR 5 records a live screenshot check (`b6f43ae1`). The shipped update message is in the top bar (`5b9ba2d2`). Repeat the full interaction on a phone. | Experience 52, changed-slide view |
| S10 | A slide added before the reader's. | pass (test: pageFollower.test.ts) | Inserting before the reader updates the count and address, keeps the slide by key and shows no highlight. Check tick retention on the published page. | — |
| S11 | A removed slide, on a phone. | pass (test window, PR 5) | The live check's screenshots show the removed-slide note, including the phone layout (`b6f43ae1`). `pageFollower.test.ts` covers the next-or-last destination and the persistent note. Repeat the copy-and-continue sequence on a phone. | Experience 52, removed-slide view |
| S12 | An edge that serves an older version. | pass (test: pageFollower.test.ts) | The fake edge serves an older version, malformed metadata and stale page content before the newer version is accepted. | — |
| S13 | Minutes only. | pass (test: deckPublish.test.ts, publicDeck.test.ts) | Timing changes preserve the public digest and the live save yields no send or chat step. Check the status bar, list and chip together with the switch in both positions. | Experience 51, frames 8–9 |
| S14 | Offline. | pass (test: deckLive.test.ts, liveUpdate.test.ts) | The offline retry takes only the latest save and stops when the deck closes. The controller rechecks the page. Repeat with a connection drop and a blocked edit before reconnecting. | Experience 52, frame 1 |
| S15 | Opening the window. | pass (test: deckPublish.test.ts, deckLive.test.ts) | Attaching a live deck sends nothing, the idle state is Live, and subsequent saves send changed content. | Experience 52, frame 1 |
| S16 | Signed out. | pass (test: liveUpdate.test.ts, DeckPublish.test.ts) | A refused connection pauses the update, and the chip explains why. The fake publisher tests resuming after reconnecting. Check that Go on opens Connect in the test window. | Experience 52, frame 4 |
| S17 | Unpublish. | pass (test: liveUpdate.test.ts) | Unpublishing removes the paused live record. A fresh publish record has no live preference. Check removal and republishing on the test account. | — |
| S18 | A page from 2.3. | not run: needs a page published by 2.3 and one manual update on the test account | `pageFollower.test.ts` covers a locally built page without version requests. `deckVersion.test.ts` covers the version file written with deck publishing. | — |
| S19 | The page opened with `#6` and no update. | pass (test: pageFollower.test.ts) | The initial link opens at position six and retains the address. | — |
| S20 | No tool publishes. | pass (test: ritemarkTools.test.ts) | Checks the shared tool and dispatch surfaces and the deck-view-only action route. | — |
| S21 | The timetable. | pass (test window, PR 3) | The test window exercised the minutes box (`db483c53`). `timetable.test.ts`, `timetableDisplay.test.ts`, `DeckMinutes.test.ts` and `timetableList.test.ts` cover the timing rules and controls. Still check entry down the full list, the over-session foot and a slide copied from the library. | Experience 51, frames 8–9 |

The shipped Go on can accept an outside-folder file within the project. Over-limit files still block the update (`liveUpdate.test.ts`, spec R12). A moved page can pause the update when Ritemark refuses the page path or cannot write the page there. Recognition of an arbitrary move is unproven.

## Closing check (25 Nov)

The qa-validator signed off with open items on `7eefb46c`.

- S5 (Windows path case and links).
- S18 (a page published by 2.3, then one Update).
- Windows checks (OneDrive-held pictures, 150 % chip scaling).
- Live repeats on the release build at Gate 2 for the scenarios marked "pass (test)" that name a test account, phone or test window (S1, S2, S3, S6, S7, S9, S11, S16, S17 and S21).

#1015's open nit (a page found outside the project at the last check went offline instead of pausing) was fixed in #1024: `deckPublish.ts` now pauses there with the outside-project message.
