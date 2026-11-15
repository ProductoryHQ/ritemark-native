# PR 7's proof: New → Deck

A dev window of this branch on a copy of Sprint 157's demo project, with `ritemark.features.decks` turned on in its settings. It ran on a fresh profile, with throwaway AI homes and `--use-mock-keychain`. The shots are 1440 × 900 at 2×. `new-deck.sh.txt` drives it: it chooses a folder in Documents, then New → Deck, then a row of the quick pick. The CDP helper it uses is `../pr1/cdp.mjs.txt`.

- `new-menu-flag-on-1440.png`: New on Documents, with Deck after Table.
- `quick-pick-1440.png`: the quick pick. "Empty deck" comes first, then the project's decks newest first, each with its folder and the day it was last changed. The Slide library's topics are left out.
- `copy-opened-title-selected-1440.png`: "AI assistants and agents" copied with Harbour Logistics chosen in Documents.
  - The copy, "AI assistants and agents (copy).deck.md", lands in Harbour Logistics. It is byte for byte the deck it copies, since the folder is the same.
  - It opens as a deck with the title slide's title selected. The view reported the selection as "AI assistants and agents", with the caret in the slide's `title`.
- `empty-deck-title-selected-1440.png`: Empty deck with Northwind chosen.
  - "Untitled.deck.md" is made in Northwind: a title slide reading "The deck's title", selected. Typing "Harbour kickoff" replaced it, and the saved file read `title: Harbour kickoff`.
- A copy of a deck whose name already holds "(copy)" was made in Northwind, a different folder, and named "… (copy) (copy).deck.md". The demo decks have no relative paths, so the rebase of pictures and links into another folder is shown by `newDeck.test.ts` instead.
- `new-menu-flag-off-1440.png`: the flag turned off in the same window. New is Text, Table, Flow, Other file… and Folder, with no Deck.
