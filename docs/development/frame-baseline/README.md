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

Sprint 134 also changed the first 9: Home and the Task board are the tab row's first two tabs, and the document's bar reads Saved and Share. Jarmo approved Sprint 134's first set of 34 on 19 October 2026 ("baseline ok"). It was re-taken the same day after main's #465 (the chosen tab's extension in body ink), the tab's × centred and the project's head made as wide as the column, with the run made steadier (Ritemark Settings scrolled only once settled; no focus or hover left over from a step): 32 scenes changed by under 0.15%, and two of the first set's captures were wrong and are corrected (the settings foot showed the page's top; transcribe caught the AI's sheet focused). **Jarmo approved the retake on 19 October 2026** ("its ok"). It was taken on a fresh profile with the sample at `/private/tmp/ritemark-frame/`; a second fresh profile matched it, 30 scenes to the pixel (`docs/development/releases/v2.0.0/sprint-134-project-at-the-centre/qa-evidence.md`, E3).

Some scenes carry what differs per run or per computer, in a few pixels: the settings foot shows the last update check's time, the bundled runtimes' versions and whether the voice model is installed (0.01% between two runs); Home's Last changed may swap two documents copied in the same second (0.13%); the projects list and Home show the sample's place on disk (hence the fixed copy location below).

**VS Code 1.142 (Sprint 135):** the two share-question files changed with the browser bar and nothing else (0.7% Light, 0.94% Dark). The bar reads back, forward, reload, the address, Show Claude this page and ⋯, with no Add Element to Chat and Developer tools in ⋯, as the Experience lead decided (patch 010). **Jarmo approved the new files on 20 October 2026** ("replace", through the Development manager). They were taken on a fresh profile with the shared recents cleared, from main's product source at `3113b080`. In the same run the other 32 scenes matched: 28 to the pixel, Home at 0.13% and the settings foot at 0.06%, for the reasons above (`docs/development/releases/v2.0.0/sprint-135-vscode-update/qa/screenshot-diff.md`).

The dev build lists Copilot Chat and "Chat Debug" in More, from VS Code's built-in Copilot extension. A production build has neither unless Copilot Chat is installed.

### The welcome (Sprint 133)

Ten more files, taken at 1440 × 900 from Sprint 133's head (`a3be9376`, merged as `eae1dedd`). **Jarmo approved them into this baseline on 19 October 2026** ("all looks good now! Proceed", through the Development manager). The two step-2 files were re-taken the same day after usage data became on by default (#469): only the switch's line changed (0.22%), now on with the Experience lead's final words. **Jarmo approved them on 19 October 2026** ("its ok").

| File | Scene |
| --- | --- |
| `*-welcome-step-1.png`, `*-welcome-step-2.png` | A fresh profile's welcome: Your AI, then Set up project |
| `*-welcome-update-on.png`, `*-welcome-update-off.png` | The update sheet for a v1.14.0 profile that pressed OK, and one that chose Opt Out |
| `*-welcome-start.png` | A finished profile's window with no folder: "Where do you want to start?" |

The provider rows and cards show what the capturing computer is signed in to (here Claude and ChatGPT), and the update sheet's projects are that profile's recents, so check a capture against these by eye; don't diff it to zero. At a window under about 900 tall the welcome takes its compact rhythm, which these 1440 × 900 frames don't show (Sprint 133's `qa-evidence/765/` does).

## Taking and comparing

1. Copy `sample-project/Harbour leadership programme` to `/tmp/ritemark-frame/` and launch a dev instance in the background on a **fresh profile** with `/private/tmp/ritemark-frame/Harbour leadership programme`: see `.claude/skills/ritemark-automation` for the `open -n -g` launch with `--remote-debugging-port` and a short `--user-data-dir` and `--extensions-dir`.
2. Compare with this baseline:

   ```bash
   node scripts/qa/frame-screenshots.mjs --port <cdp-port> --out <folder> --compare docs/development/frame-baseline
   ```

   It lays the page out at 1440 × 900, drives each scene and prints how many pixels changed in each. Open `<folder>/compare.html` to see the baseline, the new capture and the difference side by side. A scene that changed by more than 0.5% is either fixed or, if the change is meant, shown to Jarmo for a new baseline.
3. Measure the frame too: `node scripts/qa/frame-geometry.mjs --port <cdp-port>`, and check the project at the centre: `node scripts/qa/project-check.mjs --port <cdp-port> --user-data-dir <profile> --close-all --share-question` (Sprint 134).

To take a new baseline, run the same command without `--compare`, with `--out docs/development/frame-baseline`.

## Comparing a release candidate

Every shell release's test checklist carries this check, from Sprint 136 (its R3; the `release` skill, Step 2):

1. Install the candidate as a person would, then launch it in the background with its own short profile, extensions and shared data folders, the test marker and a debugging port (the `ritemark-automation` skill, "Launching an installed build"). `--shared-data-dir` keeps the run's folders out of the installed app's recent list (#475), and `RITEMARK_BUILD_CHANNEL=test` keeps it from counting as a person in usage data (#480). Open the sample project on a fresh profile, as for the baseline.
2. Compare, with the release images:

   ```bash
   node scripts/qa/frame-screenshots.mjs --port <cdp-port> --out <folder> \
     --compare docs/development/frame-baseline --release docs/development/frame-baseline/release
   node scripts/qa/frame-geometry.mjs --port <cdp-port>
   ```

3. A scene over 0.5% is fixed, or Jarmo approves it, before Gate 1 passes.

**The release images.** A production build differs from this dev baseline by design in More, which has no Copilot Chat (Sprint 135's E5: 1.05% and 1.02%). `release/` holds a production build's image for each such scene, and `--release` compares that scene with it; every other scene compares with the baseline above. The first images come from Sprint 136's first candidate, and they change only with Jarmo's approval, as the baseline does. Until `release/` exists, More's two scenes are read by eye against the dev images.

**Windows.** The window buttons and the menu button make Windows' top different from the Mac's, so Windows has its own images (`release-win32/`) where the Windows session can run the scripts; otherwise its screenshots are compared by eye with the last Windows round's.

The welcome's scenes: `node scripts/qa/welcome-screenshots.mjs --port <cdp-port> --out <folder> --scene step-1 --then-skip` on a fresh profile with no folder, `--scene update-on` or `update-off` on a copy of a v1.14.0 profile, and `--scene start --page Welcome` on a finished profile's new window.
