# Proof: removing a slide from the handout, and Slide settings in the slide's own menu (PR #770)

Experience 46, "Removing a slide from the handout" (Jarmo, 16 November; joined for block slides on 17 November) and "Nothing around the slide" (Jarmo, 17 November: "slaidi settings peaks olema siin: mitte kuskil ülal tööriistaribas").

All shots are 1440 × 900 (taken at 2×) in one isolated dev instance (`scripts/qa/dev-launch-isolated.sh`, no AI signed in) on the PR's head after both review rounds, on a copy of the demo project with one demo deck, `courses/ai-at-work/AI at work, week 2.deck.md` (nine block slides, the fifth empty, two comments on slide 4, a picture beside slide 4). Each pair is the AI column open (the slide above the handout) and folded (the slide beside it).

## The fault, first

- **On main, an empty slide can't be removed from the handout.** With main's plugins (the guard, the lines, the drawn headings, the conversion) and ProseMirror's own Backspace pressed three times in the empty part of slide 5: `5 slides (was 5)` after each press; the slide's node is selected and the guard refuses its deletion. Only the strip's Delete removes it.
- **A joined slide that became full showed no "This slide is full" line** (`fault-joined-full-no-line-before-fix-ai-open-1440x900.png`, an earlier build of this PR): the slide on the stage before was full too, its stage's cleanup said "no longer full" after the new stage had measured. Fixed in `SlideEditor` (the new stage tells its state once its words are in the page); `06-joined-full-*` is after the fix.

## The shots

| Shot | What it shows |
| --- | --- |
| `01-empty-part-about-to-go-*` | The caret in slide 5's empty part ("Write here. *** starts a new slide."). |
| `02-deleted-bar-undo-*` | Backspace: slide 5 and its line are gone; the bar says "Slide 5 is deleted." with Undo. |
| `03-join-first-press-*` | Backspace at the very start of part 4's first line: the line between the parts in the accent, the note "Backspace again joins slide 4 into slide 3. Nothing is lost.", and slide 4's thumbnail lit. Nothing written. |
| `04-joined-*` | The second press: slide 3 holds slide 4's blocks after its own, "What it taught us" as an H3 with both of slide 4's comments on it, the columns, and slide 4's picture as a Picture block at the end; slide 3 keeps its own settings. Part 4's text follows on in part 3. The bar says "Slide 4 is joined to slide 3." with Undo and, the slide being full, "This slide is full…" with Split at the cursor. |
| `05-part-number-menu-*` | The part number's ⋯: the strip's own menu (Duplicate, Skip slide, Add to library…, Slide settings…, Delete slide ⌫). |
| `06-joined-full-*` | Slide 8 joined into slide 7: the slide at its smallest step and still full; the bar's two lines, the words shortened, Undo and Split at the cursor whole. |
| `07-thumb-menu-slide-settings-*` | The thumbnail's menu (right-click) with Slide settings…; the bar has no gear. |
| `08-settings-beside-thumbnail-*` | Slide settings beside the thumbnail, top-aligned: Picture, then "This deck · all 9 slides" with Card \| Borderless. No Skip slide (it's in the menu). |
| `09-stage-menu-slide-settings-*` | The slide's own right-click menu: Cut, Copy, Paste, Comment ⌘/, a line, Slide settings…. |
| `10-settings-from-part-number-*` | Slide settings from the part number's ⋯, on the number's left. |
| `11-v1-deck-joined-ai-folded-*` | A deck of today's (v1) slides with old notes: the join converts it in the same step; the bar keeps "Old notes are now comments in the handout." with the join's line. |

## Undo and the file, byte for byte (the app run)

Each scene ended with the bar's Undo, and the deck file on disk was then compared with the deck as written (`cmp`):

- Backspace in the empty part: the file saved without exactly slide 5's block; the bar's Undo gave it back **byte for byte**.
- The join of slide 4 into slide 3: the first press wrote nothing; after the second, the bar's Undo gave the file back **byte for byte**.
- The join of slide 8 into slide 7 (full): the bar's Undo gave the file back **byte for byte**.
- The v1 deck (`deck: 1`, a `notes` block): the join wrote `deck: 2`, `handout: text`, the converted block slide with the H3, the notes as a comment in the handout and the written headings; **one** Undo from the bar gave the file back byte for byte, front matter included.

## Tests

`webview/src/components/decks/handout/deckRemove.test.ts` (in `npm run test:decks`): the empty part's removal and its Undo, byte for byte; no removal from a non-empty part (in its words, at a later line, at a heading inside the part, by typing over a line); the join (block order, H1 → H3, the picture last, the handout following on, the upper slide's settings, every comment's anchor, Undo byte for byte, the typing after it a step of its own); the first press cancelled by Esc, a letter, an arrow, a click, a blur and a caret move, with nothing written, and a modifier alone keeping the mark; the menu's items and actions; a v1 deck's join (and one whose upper slide has notes) as one undo step; a skipped slide never joined into a shown one; no join across a block left open; and no comment's words on the page after a join (`publicDeck`, `pageHtml`). `slideSettingsPopup.test.ts` and `DeckFolds.test.ts`: the popover's order, its anchors, Skip slide only in the menu, the stage menu's item, no gear in the bar, and Deck look… for a deck with no slides.

## Not verified

- Windows (no platform-specific code here).
- Deck look… on a deck with no slides, in the app (source-level test only).
- A slide of a kind this build doesn't know (its right-click Slide settings), in the app.
- Keyboard ⌘Z in the app: CDP's synthetic ⌘Z doesn't reach VS Code's keybinding; the bar's Undo (the deck's own undo of that step) was used, and the unit tests run the editor's undo.
