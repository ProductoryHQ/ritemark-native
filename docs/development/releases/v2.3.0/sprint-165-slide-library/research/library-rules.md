# Slide library: the "same slide" and "most decks" rules (Sprint 165 PR 0, #830)

Research for the Experience lead, who chooses both rules before PR 3 and PR 4 start. Synthetic decks only: the script makes up every deck and reads no file on disk. No real deck or slide was opened, read, counted or quoted.

## How it was measured

The script `library-rules.ts` beside this note builds a made-up project and scores each rule against the truth it knows. It writes and parses the decks with the app's own deck code (`deckFormat.ts`, `deckLibraryFormat.ts`): ids from `newId`, `from:` lines from `writeFrom` with `slideStamp`, parsing with `parseDeck`. Run it from the repo root with `extensions/ritemark/node_modules/.bin/tsx docs/development/releases/v2.3.0/sprint-165-slide-library/research/library-rules.ts [balanced|dominant]` (set `NODE_PATH` to an `extensions/ritemark/node_modules` if the checkout has none).

How the app copies today, which the generator follows:

- **New → Deck, copy an earlier deck** (`newDeck.ts`, `copiedDeckText`) keeps the deck as written: every slide keeps its id and its `from:` line. In one folder the text is unchanged byte for byte, which is what the script uses.
- **The library's insert and copying between decks** (`DeckLibrary.ts`, `copies`) give the copy a new id and a line `from: <deck path>#<source id> @<stamp>`.
- **A slide typed again by hand** gets a new id and no `from:` line.

Each project holds a library topic with four recurring slides (a break, contact, questions, a pair exercise) and a fifth recurring slide, "Thank you", that is always typed by hand. Each deck family starts from one deck (a title, its own "Agenda", nine slides of its own, and most of the recurring slides, 15% of them typed again instead of inserted). Each later deck copies an earlier member, then drops up to two slides, edits one or two words, rewrites the client line, adds one to three new slides, rewrites one slide into a different one under the same id half the time, and sometimes takes one slide from another family. Two shapes, 30 projects each:

- **balanced:** families of 7, 4, 3 and 2 decks and three decks on their own (19 decks, about 300 slides).
- **dominant:** one course copied 12 times, one of 3, three decks alone (18 decks). This is the shape where copied decks repeat everything.

## Same slide

Scored over every pair of slides in decks: precision is the share of merged pairs that really are one slide, recall the share of real pairs that were merged.

| Rule | balanced precision | balanced recall | dominant precision | dominant recall |
|---|---|---|---|---|
| A. The same id | 0.93 | 0.53 | 0.91 | 0.81 |
| B. A `from:` chain only | 0.92 | 0.33 | 0.88 | 0.22 |
| C. The same id or a `from:` chain | 0.93 | 0.79 | 0.90 | 0.92 |
| D. The same normalized title and body | 1.00 | 0.75 | 1.00 | 0.71 |
| E. The same title only (a strawman) | 0.81 | 1.00 | 0.89 | 1.00 |
| F. C or D | 0.93 | 0.95 | 0.90 | 0.98 |
| G. C, but an id or `from:` link counts only when the two slides still share at least 30% of their words (Jaccard), or D | **0.99** | **0.93** | **0.97** | **0.97** |

Normalized means lower case, punctuation dropped, white space folded, over the title and every item's words.

What each gets wrong:

- **A** misses every library insert (each copy gets a new id) and merges a slide rewritten into another under the old id. Ids are four characters, so unrelated decks can also share an id by chance: two new ids match with a chance of about one in 1.2 million, so among 1,000 slides made apart there is roughly a one-in-three chance that some two share an id (the guard in G stops most such merges, since they share few words).
- **B** misses every copy made by copying a whole deck, which carries no new `from:`.
- **C** joins both, so it keeps A's false merges of rewritten slides and still misses slides typed again.
- **D** never merges wrongly here, but one edited word splits a copy from its source.
- **E** merges every course's own "Agenda" into one.
- **F** has the best recall but keeps the rewritten-slide merges.
- **G** drops most of those (a rewritten slide shares few words with its old self) and catches slides typed again word for word. It still misses a slide typed again with a word changed, and still merges a rewrite that kept a third of its words.

**Recommendation: G.** It is the only test that is right on both sides: lineage (id and `from:`) finds copies whatever was edited, the words guard stops a slide rewritten into another from riding its old id, and the exact-words match finds the slides people typed again.

## Most decks

The offer shows up to six slides. The truth is the five recurring slides of each project. Precision is the share of offered slides that are recurring, recall the share of the five that were offered. Each rule was run on the true grouping and on rule G's grouping (what the app would really see).

A family is a set of decks joined by near-copies: two decks are near-copies when the Jaccard similarity of their slides' lineages is at the threshold or above, and families are joined through chains of them.

| Rule | balanced, rule G P / R | dominant, rule G P / R | dominant, true grouping P / R |
|---|---|---|---|
| N1. In half the decks or more | 0.99 / 0.73 | 0.44 / 0.53 | 0.48 / 0.57 |
| N2. In a third of the decks or more | 0.72 / 0.86 | 0.44 / 0.53 | 0.48 / 0.57 |
| F1. Families at Jaccard 0.5, in half the families | 1.00 / 0.85 | 1.00 / 0.85 | 1.00 / 0.91 |
| F2. Families at Jaccard 0.3, in half the families | 1.00 / 0.85 | 1.00 / 0.85 | 1.00 / 0.91 |
| F3. Families at Jaccard 0.5, in 3 families or more | 1.00 / 0.99 | 1.00 / 0.85 | 1.00 / 0.91 |
| F4. Families at Jaccard 0.5, in a third of the families and in 3 or more | **1.00 / 0.99** | **1.00 / 0.85** | 1.00 / 0.91 |

On rule A's grouping (the same id only) every rule offers nothing right: inserted slides carry new ids, so a recurring slide never shows as one slide across families. The "most decks" rule needs G's grouping, or at least C's.

What each gets wrong:

- **N1 and N2** count decks, so one course copied twelve times fills the offer with that course's own slides (about half the offers wrong).
- **F1 and F2** need half the families, which misses a recurring slide that a few families left out. The threshold, 0.3 or 0.5, made no difference here: copied decks share far more than half their lineages and unrelated decks almost nothing.
- **F3 and F4** offer nothing wrong in either shape. What they miss is a recurring slide that by chance is in fewer than three families, which matters most when a project has only a few families (the dominant shape has five). F4 also keeps a growing project from offering a slide that three of thirty families share.

**Recommendation: F4, on rule G's grouping.** Counting families instead of decks is what stops a much-copied course from crowding the offer, and "a third of the families and at least three" offered no wrong slide in either shape while missing only slides in fewer than three families.

Its limits: a project with fewer than three families gets no offer at all; a family that copied in a recurring slide only once counts the same as one that uses it every time; and a deck reworked so much that it shares under half its lineage with its source counts as its own family, which can lift a family's slides into the offer.

## Notes for PR 3 and PR 4

- Both rules run on what the decks hold: ids, `from:` lines and words. No AI call, no new data in the file.
- The words guard and the families' threshold are two numbers (0.3 and 0.5); the measurements were flat around them, so they can stay as constants with tests.
- "Newest copy" for search can be the slide in the most recently changed deck within the G group.
