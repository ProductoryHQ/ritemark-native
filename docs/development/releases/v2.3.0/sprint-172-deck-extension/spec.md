# Sprint 172 spec: decks get their own extension, `.rtms`

The behaviour contract is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`): decision 1, decision 10, "The file" and "The editor" under "For the build", and item 20 (New → Deck), as the Experience lead updated them in ritemark-dev 765e122 after Jarmo's word on 21 November 2026. The why and the name check are issue [#940](https://github.com/ProductoryHQ/ritemark-native/issues/940). This file numbers it for tests. If they differ, the README wins and this file is corrected.

## Purpose

A deck in Finder looks like any Markdown file today, and a double-click can open it in another app as raw text. From 2.3 a deck is a file of its own kind, `<name>.rtms`, that Finder and Explorer name and draw as a Ritemark deck, and that always opens in Ritemark as a deck.

## Principles

- The file stays Markdown inside: `deck: 1` front matter and slide fences, unchanged.
- Nothing is renamed behind anyone's back: a `.deck.md` made before keeps its name and keeps opening as a deck.
- One rule names decks, in one file, for the host, the search worker and the webview.
- A dev build never claims the file type on anyone's Mac; only a release build declares it.

## Requirements

- **R1. The file.** A new deck is `<name>.rtms`. Its text is the same Markdown a `.deck.md` holds.
- **R2. It opens as a deck.** With `ritemark.features.decks` on, the Ritemark editor opens `*.rtms` and `*.deck.md` as decks, from Finder or Explorer, from Documents, from a link, from Search and from Home's Last changed.
- **R3. New and copies.** New → Deck (and Home's Deck card) makes `Untitled.rtms`, then `Untitled 2.rtms` and on. Making a copy makes `<name> (copy).rtms`. A new library topic is `Slide library/<topic>.rtms`.
- **R4. Old decks.** A `.deck.md` opens as a deck, is listed, searched, published, presented and saved as before, and its name never changes. A `from:` line naming a `.deck.md` source keeps working.
- **R5. The lists.** Documents, the tabs, Search, the link list, the chat's chips, Home and the Slide library show a deck's name with ".rtms" muted after it (".deck.md" for an old one), and the deck's icon.
- **R6. Decks off.** With `ritemark.features.decks` off, a `.rtms` opens in the Ritemark editor as an ordinary document, as a `.deck.md` does today, and can be edited and saved.
- **R7. Every Markdown place takes it.** A `.rtms` passes every check a `.md` passes for being a document a person writes: editing and saving through the editor's sync, search, links, the chat's file links, the folder counts, a Flow's text input. It does not become a task card, an agent file or a sample file.
- **R8. The agents.** The DECKS instructions and the deck tools name `.rtms` (and accept `.deck.md`). Claude and Codex inside Ritemark list, read and edit a `.rtms` deck, and the deck view shows their change.
- **R9. The Mac's file type.** A release build declares the type `ai.productory.ritemark.deck`: Finder's kind is "Ritemark Deck"; its icon is the system's document page with the deck icon as its badge and the word DECK (macOS 11 and later); Ritemark is its owner, so a double-click opens Ritemark; it conforms to plain text, so Quick Look shows its text and Spotlight finds its words.
- **R10. Windows.** The installer registers `.rtms` as "Ritemark Deck", with the deck icon, opening in Ritemark, for every install (not behind the ".md" task box), and removes it on uninstall.
- **R11. Nothing else changes.** `.md` files keep their association and icon; the deck's format, the published page and Present are as before.

## Non-requirements

- Renaming existing `.deck.md` files, by the app or by an offer.
- Opening a `.rtms` in other Markdown apps, Linux, or a mime type of its own.
- A drawn Mac icon of our own (the system draws the page).
- Ritemark 2.2 or older opening a `.rtms` (decks are new in 2.3).

## Resolved questions

- **No patch.** The type is stamped into the release build's plist by a script (research `rtms-audit.md` §1); patch 018 already splits `.rtms` by its last dot.
- **The language.** `.rtms` joins the `markdown` language, since it is Markdown inside.
- **Type identifier.** `ai.productory.ritemark.deck`, under the app's bundle id `ai.productory.ritemark`.

## Open questions

For the Experience lead (see `sprint-plan.md` Questions): the Windows icon, the badge glyph, the name of a copy of an old deck, and whether Windows registers `.rtms` always.
