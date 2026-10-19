# The frame's screenshot baseline

Ritemark 2.0's frame (the window, the places, the tab row, the columns and the menus) in 9 scenes, and from Sprint 134 the project at the centre in 8 more, in Ritemark Light and Ritemark Dark. It is the picture of how the frame should look. The later steps of 2.0 and every VS Code update compare against it, because the frame rests on VS Code's internal class names, which an update can change without warning.

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
| `*-home.png` | Sprint 134: Home in front, the projects list in the left column |
| `*-switcher.png` | Sprint 134: the project's menu with Switch project ▸ open |
| `*-tasks.png`, `*-browser.png`, `*-transcribe.png`, `*-agents.png` | Sprint 134: each place with the project's head; Agents with `proofreader.md` in its chosen green |
| `*-settings-foot.png` | Sprint 134: the foot of Ritemark Settings, with Advanced settings |
| `*-share-question.png` | Sprint 134: a page the script serves itself (port 47134), its share question waiting on the AI's sheet |

Sprint 134 also changed the first 9: Home and the Task board are the tab row's first two tabs, and the document's bar reads Saved and Share. **Jarmo approved Sprint 134's set of 34 on 19 October 2026** ("baseline ok"), taken on a fresh profile with the sample at `/private/tmp/ritemark-frame/`; a second run matched it (`docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/qa-evidence.md`, E3).

Two scenes carry what differs per run or per computer, in a few pixels: the settings foot shows the last update check's time, the bundled runtimes' versions and whether the voice model is installed, and the projects list and Home show the sample's place on disk (hence the fixed copy location below).

The dev build lists Copilot Chat and "Chat Debug" in More, from VS Code's built-in Copilot extension. A production build has neither unless Copilot Chat is installed.

## Taking and comparing

1. Copy `sample-project/Harbour leadership programme` to `/tmp/ritemark-frame/` and launch a dev instance in the background on a **fresh profile** with `/private/tmp/ritemark-frame/Harbour leadership programme`: see `.claude/skills/ritemark-automation` for the `open -n -g` launch with `--remote-debugging-port` and a short `--user-data-dir` and `--extensions-dir`.
2. Compare with this baseline:

   ```bash
   node scripts/qa/frame-screenshots.mjs --port <cdp-port> --out <folder> --compare docs/development/frame-baseline
   ```

   It lays the page out at 1440 × 900, drives each scene and prints how many pixels changed in each. Open `<folder>/compare.html` to see the baseline, the new capture and the difference side by side. A scene that changed by more than 0.5% is either fixed or, if the change is meant, shown to Jarmo for a new baseline.
3. Measure the frame too: `node scripts/qa/frame-geometry.mjs --port <cdp-port>`, and check the project at the centre: `node scripts/qa/project-check.mjs --port <cdp-port> --user-data-dir <profile> --close-all --share-question` (Sprint 134).

To take a new baseline, run the same command without `--compare`, with `--out docs/development/frame-baseline`.
