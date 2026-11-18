# Sprint 163 PR 3: the Button block (proof)

One isolated dev window of this branch (`scripts/qa/dev-launch-isolated.sh`, a fresh profile, throwaway AI homes, `--use-mock-keychain`, `ritemark.features.decks` on in that profile only), on 19 November 2026 between about 00:15 and 00:40 EET, on a copy of Sprint 157's demo project with a `Workbook.deck.md` and a `Materials.md` added. The page was held at 1440 × 900 by a device-metrics override, so the window's shots are 1440 × 900 at 2×. It was launched once and stopped at the end (`LEFT=0`). Nothing was signed in to, and no button's Open was pressed in the window (it would open the system browser).

1. `1-slide-slash-button-1440x900.png`: `/` on a new line of a slide, Button chosen in Blocks, after Table.
2. `2-address-sheet-refused-1440x900.png`: the new button chosen (its ring, "Words beside it (optional)" and "Button" faint), its bar, and the address sheet refusing an `http://` address: "Use a full address that starts with https://". Esc then closed it and left the address as it was (checked).
3. `3-chosen-button-bar-1440x900.png`: the exercise slide's button with words beside it, chosen: the accent ring and the bar under it (Address, Open, Delete).
4. `4-button-alone-1440x900.png`: a button with no words beside it, not chosen: the button alone. Its address was taken with Enter in the sheet, the caret went onto its words, and "Open the emails" was typed there. A SharePoint Word link shows the page icon.
5. `5-wall-1440x900.png`: the exercise slide on the wall (Present), the button 1:1 with the editor's, carrying its address for the host (`data-href`, no link the window follows).
6. `6-text-document-1440x900.png`: a Text document with two buttons, the first chosen with its bar; the second (a Forms address) has the arrow out.
7. `7-page-slide-720x860.png`: the published page's slide, built locally from the same deck (`pageHtml`, no publish) and opened headless from 127.0.0.1: the button is an `<a target="_blank" rel="noopener noreferrer">`; a click opened a new tab with its address and left the page where it was.

Also checked in the window: Delete on the bar took the button out of the file, and ⌘Z brought it back byte for byte; opening `Materials.md`, choosing a button and leaving it wrote nothing (its modification time stayed that of its writing); the untouched exercise slide kept its four-backtick fence and its bytes after the other slide was edited.
