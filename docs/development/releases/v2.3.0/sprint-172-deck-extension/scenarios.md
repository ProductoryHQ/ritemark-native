# Sprint 172 scenarios

Synthetic decks only (the demo project). Each row is a test or a manual check; the rows marked Gate 2 are the TEST-CHECKLIST's.

| # | Given | When | Then | Spec |
|---|---|---|---|---|
| 1 | A project folder, decks on | New → Deck | `Untitled.rtms` is made in the folder New was opened from and opens as a deck | R1, R3 |
| 2 | `Untitled.rtms` exists | New → Deck again | `Untitled 2.rtms` | R3 |
| 3 | A deck `Day one.rtms` | Make a copy | `Day one (copy).rtms`, opening as a deck | R3 |
| 4 | An old `Training.deck.md` | Make a copy | `Training (copy).rtms`; the old file is untouched | R3, R4 |
| 5 | An old `Training.deck.md` | Open, edit a slide, save | It opens as a deck; after the save its name is still `Training.deck.md` and only the edited slide's text changed | R4 |
| 6 | A deck `Agents.rtms` in `Slide library/`, and an old topic `AI assistants.deck.md` | Open the Slide library place | Both topics are listed by name; taking a slide from each writes its `from:` line with the source's own name | R4, R5 |
| 7 | A slide copied earlier from `Slide library/AI assistants.deck.md` | The library slide changes | "The library has a newer version" shows, as before | R4 |
| 8 | Add a slide to the library under a new topic "Safety" | Add | `Slide library/Safety.rtms` is made | R3 |
| 9 | `Day one.rtms` and `Training.deck.md` in a folder | Look at Documents, a tab, Search, the link list, Home's Last changed | "Day one" with ".rtms" muted, "Training" with ".deck.md" muted, both with the deck's icon | R5 |
| 10 | A word from one of `Day one.rtms`'s slides | Search for it | The deck is found | R5, R7 |
| 11 | A Text document with a link to `Day one.rtms` | ⌘-click the link | The deck opens as a deck | R2, R7 |
| 12 | Decks off in that profile | Open `Day one.rtms` | It opens in the Ritemark editor as a document, its slide blocks as code; type and save: the words are saved | R6, R7 |
| 13 | Decks off | Open `Training.deck.md` | It opens as a document, as today | R6 |
| 14 | A `.rtms` open as a deck | Another app changes the file on disk | The deck view shows the change, as for a `.deck.md` | R7 |
| 15 | A `.rtms` named `Tasks/notes.rtms` in the Task board's folder | Open the Task board | It is not a card | R7 |
| 16 | The folder holds 2 `.rtms` and 1 `.md`, decks on | Home's line for the folder | "3 files: 2 decks and 1 text document." | R7 |
| 17 | Same folder, decks off | The same line | "3 files: 3 text documents." | R6, R7 |
| 18 | Claude in an isolated test window, test keys only | Ask it to list decks, then change slide 2's title in `Day one.rtms` | list_decks lists `Day one.rtms`; the slide's title changes in the deck view; the file still opens as a deck | R8 |
| 19 | Codex in the same window | The same ask | The same | R8 |
| 20 | An AI asked to make a new deck | It writes the file | The file is `<name>.rtms` | R8 |
| 21 | A deck tool given `notes.md` | Call read_deck | "notes.md is not a deck in this project" | R8 |
| 22 | The stand-in bundle on the GitHub runner | The proof workflow | UTType for `rtms` is `ai.productory.ritemark.deck`, "Ritemark Deck", conforms to `public.plain-text`; the stand-in opens the file; the drawn icon is a page with the badge and DECK; Quick Look's thumbnail shows text; Spotlight's importer reads the words | R9 |
| 23 | The built RC app | `validate-build-output.sh` | The plist has the document type and the exported type, `plutil -lint` passes, `deck-badge.icns` is in `Resources` | R9 |
| 24 | A dev build launched | Look at its plist | No `ai.productory.ritemark.deck` in it | Principles |
| 25 | The RC in `/Applications` (Gate 2) | Finder, Get Info on `Day one.rtms` | Kind "Ritemark Deck"; the system page with the deck badge and DECK | R9 |
| 26 | The RC (Gate 2) | Double-click `Day one.rtms` in Finder, Ritemark closed and open | It opens in Ritemark as a deck | R2, R9 |
| 27 | The RC (Gate 2) | Space on it in Finder; Spotlight for a slide's word | Quick Look shows its text; Spotlight finds it | R9 |
| 28 | A `.md` file in Finder with the RC | Get Info | Its kind and icon are as with 2.2 | R11 |
| 29 | The Windows installer on the CI runner | Install, probe, uninstall | `.rtms` → `Ritemark.rtms` "Ritemark Deck", the icon file at `DefaultIcon`, the open command; all gone after uninstall | R10 |
| 30 | A Windows PC with the RC (Gate 2) | Explorer on `Day one.rtms`, then double-click | The deck icon and "Ritemark Deck"; it opens in Ritemark as a deck | R10 |
