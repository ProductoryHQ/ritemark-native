# Sprint 161, PR 1: proof shots

One dev run (17 November, evening): `scripts/qa/dev-launch-isolated.sh` with a fresh profile, throwaway AI homes and the mock keychain, on a copy of the demo project, `ritemark.features.decks` on, `RITEMARK_PRESENT_WINDOWED=1`. Launched once and stopped (`LEFT=0`). Nothing was signed in to. The deck view's shots are the workbench at 1440 × 900; the page's are the page Publish writes (`publicDeck` and `pageHtml`, the same code), opened from a local folder in a headless browser at 1440 × 900 and 390 × 844.

| Shot | What it shows |
| --- | --- |
| `stage-v2-columns-1440x900.png` | A block slide (`deck: 2`) with Columns, on the stage (read-only in this PR) and in the strip, all drawn by the one renderer. |
| `stage-v2-steps-settings-1440x900.png` | A Steps block with its pill (`tag="Harjutus"`) and a picture place on the right; Settings shows only Picture and Skip slide for a block slide (frame 26). |
| `stage-v1-converted-boxes-1440x900.png` | A v1 Boxes slide as `legacyToBlocks` draws it (the demo deck written out as blocks), on the stage. |
| `stage-v1-converted-section-1440x900.png` | A v1 Section slide as blocks: its number over the title, big and low. |
| `stage-v1-deck-unchanged-1440x900.png` | Today's v1 demo deck: drawn and edited by its layouts, as before. |
| `wall-v2-columns-1440x900.png` | The wall, a block slide. |
| `presenter-your-comments-1440x900.png` | The presenter view's "Your comments": the part's anchored comment, with the words it is on. |
| `presenter-no-comments-1440x900.png` | "No comments on this slide." |
| `page-v2-columns-1440x900.png`, `page-v2-columns-390x844.png` | The handout page: the same block slide; the anchored comment's note is gone, its words stay; slide 4's Steps pill in its label. |
| `page-v1-converted-boxes-1440x900.png` | The converted v1 deck's page: Boxes as blocks, and an exercise's steps with ticks. |

After the run, every deck file in the copy was byte for byte the demo project's (`diff -r`), after opening, Settings, presenting and ⌘S on each deck.

Seen and not ours: VS Code's toast "Activating extension 'GitHub.copilot-chat' failed" on this dev build (it came before any deck opened); it was dismissed before the shots.
