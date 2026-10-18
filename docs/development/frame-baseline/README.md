# The frame's screenshot baseline

Ritemark 2.0's frame (the window, the places, the tab row, the columns and the menus) in 9 scenes, in Ritemark Light and Ritemark Dark. It is the picture of how the frame should look. The later steps of 2.0 and every VS Code update compare against it, because the frame rests on VS Code's internal class names, which an update can change without warning.

**Status:** captured on 18 October 2026 from Sprint 132's merge 2, on a fresh profile. It was re-taken the same day after You became an icon button in the toggles' muted ink; against the aad4cdd9 set, every scene changed by 0.04%, in the toggles and You only. It was re-taken again after a tab's close button moved to the right (S23 revised): only the terminal and many-tabs scenes changed (0.11–0.16%), where the tabs that are not chosen now keep the close button's room. It is waiting for Jarmo's approval. A second run matched it to the pixel in all 18 scenes. A new baseline replaces these files only when Jarmo approves it.

## The scenes

| File | Scene |
| --- | --- |
| `*-base.png` | One document open, both columns shown |
| `*-two-desks.png` | The document split onto a second desk |
| `*-left-hidden.png`, `*-ai-hidden.png`, `*-both-hidden.png` | One column hidden, then both |
| `*-new-tab-menu.png` | The + menu open |
| `*-more-menu.png` | More (⋯) open |
| `*-terminal.png` | A terminal tab, its text blanked (the prompt names the computer and the account, and differs per machine) |
| `*-many-tabs.png` | Twelve documents: the tab row folds into "N ⌄" |

The dev build lists Copilot Chat and "Chat Debug" in More, from VS Code's built-in Copilot extension. A production build has neither unless Copilot Chat is installed.

## Taking and comparing

1. Launch a dev instance in the background on a **fresh profile** with `sample-project/Harbour leadership programme` (copy it somewhere outside the repo first): see `.claude/skills/ritemark-automation` for the `open -n -g` launch with `--remote-debugging-port` and a short `--user-data-dir` and `--extensions-dir`.
2. Compare with this baseline:

   ```bash
   node scripts/qa/frame-screenshots.mjs --port <cdp-port> --out <folder> --compare docs/development/frame-baseline
   ```

   It lays the page out at 1440 × 900, drives each scene and prints how many pixels changed in each. Open `<folder>/compare.html` to see the baseline, the new capture and the difference side by side. A scene that changed by more than 0.5% is either fixed or, if the change is meant, shown to Jarmo for a new baseline.
3. Measure the frame too: `node scripts/qa/frame-geometry.mjs --port <cdp-port>`.

To take a new baseline, run the same command without `--compare`, with `--out docs/development/frame-baseline`.
