# The frame's screenshot baseline

Ritemark 2.0's frame (the window, the places, the tab row, the columns and the menus) in 9 scenes, in Ritemark Light and Ritemark Dark. It is the picture of how the frame should look. The later steps of 2.0 and every VS Code update compare against it, because the frame rests on VS Code's internal class names, which an update can change without warning.

**Status:** captured on 18 October 2026 from Sprint 132's merge 2, on a fresh profile. It was re-taken the same day after You became an icon button in the toggles' muted ink; against the aad4cdd9 set, every scene changed by 0.04%, in the toggles and You only. It was re-taken again after a tab's close button moved to the right (S23 revised): only the terminal and many-tabs scenes changed (0.11–0.16%), where the tabs that are not chosen now keep the close button's room. A second run matched it to the pixel in all 18 scenes. **Jarmo approved it on 18 October 2026** ("baseline ok"), and merge 2 merged as `cb59f4cd`. A new baseline replaces these files only when Jarmo approves it.

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

### The welcome (Sprint 133)

Ten more files, taken at 1440 × 900 from Sprint 133's head (`a3be9376`, merged as `eae1dedd`). **Jarmo approved them into this baseline on 19 October 2026** ("all looks good now! Proceed", through the Development manager).

| File | Scene |
| --- | --- |
| `*-welcome-step-1.png`, `*-welcome-step-2.png` | A fresh profile's welcome: Your AI, then Set up project |
| `*-welcome-update-on.png`, `*-welcome-update-off.png` | The update sheet for a v1.14.0 profile that pressed OK, and one that chose Opt Out |
| `*-welcome-start.png` | A finished profile's window with no folder: "Where do you want to start?" |

The provider rows and cards show what the capturing computer is signed in to (here Claude and ChatGPT), and the update sheet's projects are that profile's recents, so check a capture against these by eye; don't diff it to zero. At a window under about 900 tall the welcome takes its compact rhythm, which these 1440 × 900 frames don't show (Sprint 133's `qa-evidence/765/` does).

## Taking and comparing

1. Launch a dev instance in the background on a **fresh profile** with `sample-project/Harbour leadership programme` (copy it somewhere outside the repo first): see `.claude/skills/ritemark-automation` for the `open -n -g` launch with `--remote-debugging-port` and a short `--user-data-dir` and `--extensions-dir`.
2. Compare with this baseline:

   ```bash
   node scripts/qa/frame-screenshots.mjs --port <cdp-port> --out <folder> --compare docs/development/frame-baseline
   ```

   It lays the page out at 1440 × 900, drives each scene and prints how many pixels changed in each. Open `<folder>/compare.html` to see the baseline, the new capture and the difference side by side. A scene that changed by more than 0.5% is either fixed or, if the change is meant, shown to Jarmo for a new baseline.
3. Measure the frame too: `node scripts/qa/frame-geometry.mjs --port <cdp-port>`.

To take a new baseline, run the same command without `--compare`, with `--out docs/development/frame-baseline`.

The welcome's scenes: `node scripts/qa/welcome-screenshots.mjs --port <cdp-port> --out <folder> --scene step-1 --then-skip` on a fresh profile with no folder, `--scene update-on` or `update-off` on a copy of a v1.14.0 profile, and `--scene start --page Welcome` on a finished profile's new window.
