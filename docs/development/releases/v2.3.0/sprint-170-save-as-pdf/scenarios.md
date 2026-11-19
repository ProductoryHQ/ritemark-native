# Sprint 170 scenarios

Synthetic decks only. Each row is a test or a manual check.

| # | Given | When | Then | Spec |
|---|---|---|---|---|
| 1 | A deck in Slide only | The ▾ is opened | The item reads "Save slides as PDF…" | R1, R2 |
| 2 | Slide and handout | The ▾ is opened | "Save slides and handout as PDF…" | R2 |
| 3 | Handout only | The ▾ is opened | "Save handout as PDF…" | R2 |
| 4 | The window under 600 px | The ▾ is opened | The item says slides | R2 |
| 5 | The pointer on the ▾ and on Publish | Hover and Tab | Each has its own hover and focus; Publish still publishes | R1 |
| 6 | Slide only, a tab and a three-step reveal on a slide | Save | One 16:9 page for it with the chosen tab and every reveal shown | R3 |
| 7 | A skipped slide | Save, any kind | It is not in the PDF | R6 |
| 8 | A slide with a comment and a note | Save, any kind | Neither appears | R6 |
| 9 | A Link and a Button | Save, any kind | Both are clickable in the PDF; Copy and ↗ are not drawn | R6 |
| 10 | Slide and handout | Save | A4 portrait, the page's print | R4 |
| 11 | Handout only | Save | A4 portrait, the text alone, each part with its number and heading, no slide pictures | R5 |
| 12 | The computer offline | Save | Fonts and pictures are all in the file | R6 |
| 13 | Deck "Day one" | Save in each view | The dialog names "Day one.pdf", "Day one – slides and handout.pdf", "Day one – handout.pdf", in the deck's folder | R7, R8 |
| 14 | The file exists | Save | The system's Replace question; No leaves it untouched | R8 |
| 15 | The dialog is cancelled | | Nothing is written and no note shows | R8 |
| 16 | A save finished | | The bar says "Saved as <name>.pdf" with Show in folder, which opens the folder | R9 |
