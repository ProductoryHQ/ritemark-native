# Sprint 161, PR 2: proof shots

Three dev runs on the night of 16–17 November (after 23:00 EET), each `scripts/qa/dev-launch-isolated.sh` with a fresh profile, throwaway AI homes and the mock keychain, on a copy of the demo project, `ritemark.features.decks` on, `RITEMARK_PRESENT_WINDOWED=1` from the second run on. Each was launched once and stopped (`LEFT=0`). Nothing was signed in to. The workbench is 1440 × 900; "AI open" is the AI column shown, "AI folded" hidden. The page shots are the page Publish writes (`publicDeck` and `pageHtml`, the same code) for the converted demo deck, opened from a local folder in a headless Chromium shell at 1440 × 900 and 390 × 844.

The deck is `Harbour Logistics/AI assistants and agents.deck.md`, a v1 deck (`deck: 1`) whose title slide has a ```` ```notes ```` block.

| Shot | What it shows |
| --- | --- |
| `v1-deck-before-first-edit-1440x900.png`, `…-ai-folded-…` | The v1 deck as opened: every slide drawn as the block slide its conversion writes (the stage, the strip). The file is byte for byte as it was, after the open, clicks on the slide and in the handout, a key, and a wait past autosave (`shasum` the same before and after). |
| `above-full-size-no-notes-row-ai-open-1440x900.png` | The "above" layout (the room is under 1,100): no notes row under the slide, which takes its pane's height − 32 (measured: pane 390, slide 358). |
| `typing-on-block-slide-caret-1440x900.png`, `…-caret-ai-folded-…` | Typing on the slide: the caret after the typed "!", in the slide's own type, scaled with `transform: scale`. |
| `typing-on-block-slide-caret-notice-1440x900.png`, `typing-on-block-slide-notice-ai-folded-1440x900.png` | The first edit converted the deck (`deck: 2`, `handout: text`, every slide a bare `slide`), and the bar says so: "This deck is now written like text. Its old notes and hidden words are comments in the handout, only for you." With the AI open the line gives way to the bar's controls (ellipsis, full words in its tooltip). |
| `fault-before-fix-notice-squeezes-present-1440x900.png` | The fault before its fix (run 1): the long line took the room of the bar's buttons and Present lost its label. Fixed in `decks.css` (the bar's controls never shrink; the line does). |
| `columns-slide-being-edited-ai-folded-1440x900.png` | A Columns slide edited in place: ", in the files too" typed into the first column; the thumbnail follows. In the file only that line changed. (VS Code's tooltip for the AI toggle is over Present: the pointer was left there.) |
| `bubble-menu-on-scaled-slide-ai-folded-1440x900.png` | A word selected on the slide: the formatting menu at its real size, centred over the selection (it lives in `document.body`, outside the scaled frame). |
| `settings-no-layout-grid-1440x900.png` | Slide settings on a converted slide: Picture and Skip slide, no layout grid. |
| `handout-part-with-converted-comment-ai-folded-1440x900.png` | The old notes as a Ritemark comment at the end of slide 1's part, opened in the margin. |
| `presenter-your-comments-converted-notes-1440x900.png` | The presenter view: "Your comments" shows that comment. |
| `wall-converted-title-1440x900.png` | The wall: the converted title slide, no comment on it. |
| `page-converted-deck-1440x900.png`, `page-converted-deck-390x844.png` | The page of the converted deck: no comment word in its HTML (`grep` for the notes' words: 0), the section band kept for the converted Section slide. |

**One Undo, in the app.** After the first edit, ⌘Z on the slide put the file back byte for byte (`cmp` with the demo project's: equal); ⌘⇧Z wrote the converted bytes again. Run 1 found that the front matter lost its blank line on that round trip (gray-matter rewrote it for `deck: 1` → `2`); `joinFrontMatter` now changes a plain value in place, with a test.

**IME, in the app.** A composition (`Input.imeSetComposition`, "ありがとう") on the Columns slide wrote nothing while composing; on commit the word landed whole, once, where the caret was.

**Library marks, found in run 2 and fixed.** After the conversion, slide `g001` (a library copy whose source has a newer version) showed "changed" as well as "newer": the view's conversion renewed a copy's `from:` stamp without its handout. With the part's handout passed (`deckConvert.ts`), the marks before and after the conversion are the same (`g001:newer a001:changed a002:changed+newer`, read with the host's `sourceStates`), with a test.

After the runs, every deck in the copy but the one edited was byte for byte the demo project's (`diff -rq`).
