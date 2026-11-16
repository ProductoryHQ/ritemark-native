# Decks demo project (Sprint 157)

A small project to try Decks with, in a dev window (`/rundev`) of the `sprint-157-decks` branch. Copy the folder somewhere else first, so your trying leaves this copy as it is, and open the copy as the project.

- `Harbour Logistics/AI assistants and agents.deck.md`: a 13-slide training deck in all nine kinds. Five of its slides are copies: four from the Slide library, one from another deck.
- `Slide library/AI assistants.deck.md` and `Slide library/Agents.deck.md`: the library's two topics.
- `Northwind/Data in Excel.deck.md`: another earlier deck, shown under Other decks.
- Sprint 161, block slides (`deck: 2`, a bare `slide` fence whose body is Markdown):
  - `Harbour Logistics/Copilot at work.deck.md`: six block slides, with Columns, Boxes, Steps, a table, a picture beside the words and a skipped slide;
  - `Harbour Logistics/AI assistants and agents, as blocks.deck.md`: the 13-slide deck above as `legacyToBlocks` draws it, written out (what its first edit will write); its old notes and hidden words are comments at the end of their parts;
  - `Northwind/Working with data.deck.md`: a mixed deck, older slides and block slides side by side.

The copies start in four different states, so each line under a slide can be seen at once:

| Slide | State |
| --- | --- |
| 5, "Why talk about agents?" | The library has a newer version: an amber dot on its thumbnail, and Use it. |
| 6, "An assistant's four parts" | Changed in this deck: Keep it here, Update the library. |
| 7, "Assistant or agent: which one?" | Both: changed here, and newer in the library. |
| 10, "A scheduled prompt, step by step" | An unchanged copy: "From the library · Agents". |
| 11, "Which tool for which data" | A copy from another deck: "From Data in Excel". |

Decks are behind the `ritemark.features.decks` setting, off by default. Turn it on in the dev window's settings (`"ritemark.features.decks": true`), then open the deck.
