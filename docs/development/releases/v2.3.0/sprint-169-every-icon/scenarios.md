# Sprint 169 scenarios

Synthetic decks only.

- **S1 Before typing:** a deck whose boxes use `truck` and `brain`. The menu opens with those two first, then the 24, "No icon" at the foot. (R1)
- **S2 "truck":** typing "truck" shows truck icons, and the choice writes `icon: truck`. (R1, R3)
- **S3 "people":** typing "people" finds icons by tag, such as `users` and `user-circle`. (R1)
- **S4 "mail":** typing "mail" finds `envelope-simple` and the other envelopes, through the aliases. (R1)
- **S5 Nothing matches:** "zzzq" shows "No icons match", and "No icon" is still at the foot. (R1)
- **S6 Every surface:** a box with `icon: truck` draws it in the editor, on the strip, on the wall, in the presenter view and on the published page opened offline. (R4)
- **S7 The page is small:** the page's source holds the drawings of the deck's icons only. (R4)
- **S8 Old decks:** a deck using only the 24 and aliases reads and draws exactly as before. (R3)
- **S9 Unknown name:** `icon: not-a-real-icon` draws `circle-dashed` on the usual ground on all surfaces; in the editor the tooltip says "No icon named “not-a-real-icon”", and Choose an icon opens the menu with that name in the search. (R5)
- **S10 Mark for Boxes:** a Boxes block set to Number, Dot or Arrow does not draw the icon, as today. (Sprint 167 PR 2)
