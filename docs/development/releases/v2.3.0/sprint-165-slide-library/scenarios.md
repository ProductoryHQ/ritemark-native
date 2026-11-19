# Sprint 165 scenarios

All with synthetic decks (invented names and words). They become the manual and test matrix.

## R1, R2: Other decks by folder
- Given decks in `Acme/` (newest 12 Nov), `Beta/` (newest 3 Nov) and two at the project's top level, when the place opens, then folder headings read Acme, Beta and the project's name, in the order of their newest deck.
- Given a folder with three decks, then they list newest first, each with name, "12 Nov" and a slide count; a deck last changed last year shows the year.
- Given a long list, every deck is closed; "From another deck…" opens only the newest.
- Given a folder heading, then clicking it does nothing (no open or close).

## R3: Sections and Take section
- Given an open deck with two section slides, then the slides before the first have no heading and each section shows number, title and Take section.
- Given a deck with no section slides, then its slides show as today, with no Take section.
- Given the current slide is 4 in my deck, when I press Take section on a three-slide section, then three copies follow slide 4 in order, with handout text and prompts, and one undo removes all three.
- Given I click or drag one slide, then it goes in as today.

## R4: Search
- Given a slide copied across four decks, when I search a word in it, then it shows once at its newest copy, with "also in 3 older decks" and "Folder › Deck · date".
- Given a hit in the library and in a deck, then the library hit comes first.
- Given the open deck already has a copy, then the thumbnail has a tick.
- Given two slides with the same words but no shared lineage, then both show.

## R6: The offer
- Given synthetic decks where four slides recur and the rest differ, then the top shows "These 4 slides are in most of your decks."
- Given decks copied from one another with nothing else different, then nothing is offered for the slides that only repeat because of the copying (the lead's rule decides the exact line).
- Given Add all, then the topic "Every training" exists (made if missing) with those slides; Choose… adds only the ticked ones; Not now hides them and the same slides are not offered again.
- Given any state, nothing is added without a press.
