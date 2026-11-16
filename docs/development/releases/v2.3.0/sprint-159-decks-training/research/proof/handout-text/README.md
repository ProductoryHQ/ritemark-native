# The handout is a Text document: proof (#750)

A dev window of this branch, on a copy of Sprint 157's demo project, with `ritemark.features.decks` turned on in its settings. It was started with `scripts/qa/dev-launch-isolated.sh`, so it had a fresh profile, throwaway AI homes and `--use-mock-keychain`, on 16 November after 18:00. The page was held at 1440 × 900 by a device-metrics override (`hold-size.mjs.txt`), so the shots are 1440 × 900 at 2×. `hcdp.mjs.txt` drives the window: Quick Open, palette commands, clicks into the deck webview, and shots.

## Opening an older deck writes nothing

1. A copy of "AI assistants and agents.deck.md" was taken before the launch. The deck was written before 16 November, so none of its parts but the first opens with a heading of its own.
2. The deck was opened at 18:05:30 and the window was reloaded at 18:07:20 with a newer bundle, which opened the deck again.
3. Nothing was typed. The caret was clicked into part 2, and the AI column was folded and opened.
4. At 18:08:35 the file was byte for byte the copy, with the same SHA-256 and its mtime from before the launch (`open-writes-nothing.txt`). The tab never showed an unsaved mark.

## The first real edit writes the headings

Typing " Bring water." at the end of part 2's text wrote one heading into each part that had none (`first-edit.diff.txt`):
- `#` for the two Section slides, `##` for every other kind;
- the first part keeps its own "## Welcome", and gets no second heading;
- the 13 slide blocks are byte for byte as they were;
- the library copies' states are the same as before the edit (slide 5 newer, 6 changed, 7 both, 10 as it was), because the stamp leaves the part's heading out.

## Shots for the Experience lead

| What | AI column open | AI column folded |
|---|---|---|
| Older deck, before its first edit (headings drawn from the titles) | `older-before-edit-ai-open-1440.png` | `older-before-edit-ai-folded-1440.png` |
| The same deck, after its first edit (headings written) | `older-after-first-edit-ai-open-1440.png` | `older-after-first-edit-ai-folded-1440.png` |
| A section part (slide 9, "Scheduled prompts", H1; its empty text shows the placeholder) | `section-part-ai-open-1440.png` | `section-part-ai-folded-1440.png` |
| A part with a prompt (slide 8): the editor's own code block, its copy icon on hover | `code-block-part-ai-open-1440.png` | `code-block-part-ai-folded-1440.png` |

More shots:
- **Close-ups at 2×:** `line-meets-divider-closeup.png` shows the line starting at the dotted divider. `line-right-edge-closeup.png` shows its right end, which stops at the handout's scrollbar lane (15 px), not under it.
- `slash-menu-divider-ai-open-1440.png`: "/div" in a deck shows "Divider · a new slide".
- `line-made-slide-ai-open-1440.png`: Divider chosen at the end of slide 13. Slide 14 is a Statement, the caret was in its empty H2, and "Questions" was typed there. The file got a `slide statement` block with a new id and `## Questions`, and no line.
- `library-line-narrow-slide-ai-open-1440.png`: under a narrow slide, "Changed in this deck; …" has a line of its own, with Keep it here and Update the library under it.
- `new-deck-start-card-ai-open-1440.png`: New → Deck. The part's heading shows "Heading", the text shows "Write here. *** starts a new slide.", and the start card sits at the text's edges. The file has no heading in it.

In the demo deck, "TRY IT" and "PROMPT" are capitals in the file's own text. The deck no longer styles labels.

## A deleted heading stays deleted (the `handout: text` mark)

On a fresh copy of the demo project, I typed in part 2 of "AI assistants and agents".
- **First edit:** wrote the headings and added `handout: text` as one more line of the front matter. The other front matter lines stayed byte for byte.
- **Deleting part 3's heading:** I deleted the words of "Shared prompt board" in the handout, and the file was saved with part 3 having no heading.
- **After Developer: Reload Window:** the deck drew no heading (`data-deck-drawn`: 0), and part 3 opens with its text (`deleted-heading-after-reload-ai-open-1440.png`). The file's SHA-256 was the same before and after the reload.
- The words "Bring water." landed mid-sentence because End went to the end of the first wrapped line. That was this test's input, not a fault.
