# Sprint 165 spec: the Slide library place

The source of truth is the decks README, section "The library place, from first principles" (governance repo, `product/design/experience/experiences/decks/README.md`, ritemark-dev 6d59a97), and the sketch `library-panel.html` (made-up content). This file numbers the requirements so PRs and scenarios can name them. Where the two differ, the README wins.

- **R1 Order.** The library's topics are on top, Other decks below.
- **R2 Other decks by folder.** Each folder is a plain heading with a folder icon, never opened or closed. Decks at the project's top level go under the project's name. Folders are ordered by their newest deck, decks within a folder newest first. A row shows name, last-modified day ("12 Nov", with the year when it is not this year) and slide count. Every deck starts closed. "From another deck…" still opens the newest.
- **R3 Sections and Take section.** An open deck shows its sections: a section starts at a section slide (title only, with a number) and runs to the next one. Slides before the first have no heading. A deck without sections shows its slides as now. A heading has number, title and Take section, which inserts all the section's slides (the section slide included) after the open deck's current slide, in order, as copies with handout and prompts, as one undo step. A single slide still goes in by click or drag.
- **R4 Search shows each slide once.** It searches the library and every deck by title and words, library hits first. A slide in several decks shows once, at its newest copy, with "also in N older decks" and "Folder › Deck · date". Two slides are the same if they share a lineage (copies of one slide, the same id across copied decks); the exact test is proposed to the lead by PR 0. A tick on a thumbnail means its copy is already in the open deck.
- **R5 One kind of library slide.** No template/reusable split; topics stay decks in the `Slide library` folder. Already how the code works; nothing to build or remove.
- **R6 The offer.** At the top of the library: "These 4 slides are in most of your decks." with Add all, Choose… and Not now. Up to six slides, each at its newest copy. Added slides go into a topic "Every training", made if missing. Not now hides those slides for good. It never adds by itself. The app works it out with no AI call. Claude can do the same when asked, with its library tools. "Most decks" means slides that recur across decks whose other content differs, with the rule chosen by the lead after PR 0.

## Hard limits
- Decks stays behind `ritemark.features.decks`.
- Nothing from Jarmo's real decks is opened, read, counted or quoted: research, tests and shots use synthetic decks only.
- Every button gets a tooltip, and no popup stays open on an outside click (existing rules).
