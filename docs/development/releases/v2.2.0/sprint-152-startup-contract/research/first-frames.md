# A1: The inventory seen (R3, R4, R6, R9; rows 4, 5, 11, 13–17)

1–2 November 2026, for Sprint 152's PR 1, on `origin/main` (`f84f4513`). Each *read* row of [the proposal's inventory](../../../../analysis/2026-11-01-startup-contract.md#inventory-what-is-drawn-at-start-that-depends-on-the-extension) is here seen or not, with when and how. It is also the failing set the first-frame check (R8) has to show on `main`.

## How it was run

- **The tree:** VS Code `d956e8a6` with the 19 patches applied by `apply-patches.sh` to a fresh checkout of the pin, `npm run transpile-client`, the built-in extensions compiled, and `main`'s extension and webview bundle (the bundle rebuilt byte for byte from `main`'s source). The dev Electron is 43.8.3; patch 020 moves the build to 43.8.6, which changes nothing drawn.
- **The instances:** hidden (`open -n -g -j`), one per set of starts and reused across them, a fresh profile under `/private/tmp`, its own shared-data folder, scratch Claude, Codex and XDG homes, `--use-mock-keychain`, CDP on a port checked to be free. Every extension host was held (`--inspect-brk-extensions`) and let go over its inspector 10 s after the window's first frame, once the check had found that the inspector's process belongs to the instance (Sprint 145's S47 method).
- **The check:** `scripts/qa/project-check.mjs --first-frame <start>` (W1, in this PR) sampled the window every 50 ms from its first moment: the boxes of the left column, the desk, the AI column, the status bar, VS Code's side places bar, the places row's items, the head's rows and the tab row's first tabs, and what is in front (the desk's tab, the left column's place). The first frame is the first sample after `code/didRemovePartsSplash`; the window has settled when Ritemark has been started 5 s (its Send feedback is in the status bar) and nothing has changed for 2 s. Times below are from the first frame. Each run also captured the first frame, the held window and the settled one.
- **The starts:** five sets, each a fresh profile: a new profile (no folder), a new project (Open Recent into a folder the profile never opened, twice), a switch (Open Recent back into the first, a document left in front), a relaunch (Reload Window with a document in front and a terminal on the desk), and a relaunch with the AI column closed by its toggle first. Two more starts launched a fresh profile straight onto a folder (R9's start). Sets 1, 3 and 5 started Light; 2 and 4 started Dark, which holds until Ritemark's first activation sets a new profile to follow the system (`extension.ts`, the design-foundations theme migration), so their later starts were Light. The boxes are the same in both.

Captures: [`qa/`](../qa/), `a1-*.png`.

## The rows

| Row | What | Seen? | When, and what it looked like |
| --- | --- | --- | --- |
| 4 | The places row on a profile with nothing stored | **Seen** | A new profile launched on a folder (2 of 2): at the first frame the places are VS Code's, on its 40 px side bar, with Documents alone; at +0.29–0.31 s, when the extensions are read, the side bar goes, the left column moves 40 left, Ritemark's seven places draw on top and the AI column comes (the desk loses 360): [`a1-new-profile-on-folder-first.png`](../qa/a1-new-profile-on-folder-first.png). Also once in ten new projects opened after a new profile's empty window (Documents and More, then all seven, at +0.23 s): whether the placeholders were stored by then is a race. **R9 stays.** |
| 5 | The left column in a project opened for the first time | **Seen**, 10 of 10 | Documents' tree with the project's head at the first frame; Home's place at Ritemark's start (+11.6–11.9 s held), when the head's rows go, since Home's place has none: [`a1-new-project-first.png`](../qa/a1-new-project-first.png). |
| 11 | Home and the Task board in a project opened for the first time | **Seen**, 10 of 10 | The empty desk's Text, Table and Web page tiles from the first frame; Home's tab at +10.9–11.2 s, the board's at +11.2–11.4 s. In front: nothing, then Home, then **the Task board for about 0.4 s**, then Home again (`permanentTabs.ts` opens the board after Home and goes back). |
| 13 | A window with no folder: the welcome alone | **Seen**, 5 of 5 | VS Code's empty window at the first frame: its 40 px side bar, the empty desk's tiles, VS Code's colours ([`a1-new-profile-first-light.png`](../qa/a1-new-profile-first-light.png), [`-dark`](../qa/a1-new-profile-first-dark.png)). At +0.18–0.29 s the side bar goes and the desk widens by 40 (row 15). At Ritemark's start (+11.8–12.0 s held) the welcome alone. **Not seen:** the AI column showing first. Upstream's rule for new users ("Show auxiliary bar even in empty workspaces") didn't show it in this tree. |
| 14 | The AI column the person closed | **Seen**, 5 of 5 | Closed by its toggle, then Reload Window: closed at the first frame, open at Ritemark's start (+11.0–11.2 s held; the activation-time `ritemark.unifiedView.focus`), the desk 400 narrower: [`a1-relaunch-ai-closed-held.png`](../qa/a1-relaunch-ai-closed-held.png), [`-settled`](../qa/a1-relaunch-ai-closed-settled.png). |
| 15 | The settings that shape the frame | **Seen** for one | `workbench.activityBar.location`: a new profile's first frame has VS Code's side bar, and the setting moves it at +0.2–0.3 s (rows 4 and 13). The others on R1's list draw nothing at a new profile's first frame in these starts (no tab, document or terminal exists then), but they are known only from the same moment, so **R1's list stands as written.** |
| 16 | Colours before the theme is read | **Seen** | A new profile's first frame is VS Code's own theme, not the ground: Light, a white desk on grey parts with VS Code's dark grey side bar; Dark, VS Code's dark greys. Ritemark's theme arrives with the extensions (+0.2–0.3 s). The Experience lead's answer 1 asks for the ground in its place, so this goes to PR 2's decision with R4, not to 2.3. |
| 17 | Ritemark's status bar items | Seen, no move | Send feedback and the AI's status come at Ritemark's start, at the bar's right end; the bar's box never moved. The lead's answer 7 allows them late. |

## Seen, and not in the inventory

- **A stored Ritemark place shows only when the extensions are read** (5 of 5 switches, 5 of 5 relaunches): a window left on Home's place has no place at its first frame, the places row with nothing chosen and the left column's ground below it, then Home's place at +0.19–0.25 s, with its loading badge ([`a1-switch-held.png`](../qa/a1-switch-held.png)). Home's view container is the extension's, so VS Code can't open it before then. The check also sees the project head's empty 12 px box go at that moment.
- **A restored terminal tab is nameless at the first frame** (10 of 10 relaunches): 67 px wide with no label, then "Terminal" and 115 px at +2.25–2.34 s, when the terminal reconnects to its process. Anything to its right in the tab row moves 48 px. Patch 019 owns terminals as tabs; the tab could show its stored title (`Terminal`) from the first frame.
- **VS Code's indigo progress lines while Ritemark starts:** under the left column's toggle and along the desk's top edge, for Home's place and Home's page (visible in every held capture). Sprint 145 hid the AI column's; the framework allows indigo as a fill or an icon, never a line. A question for PR 2's slot loading look.
- **The held start's own toast**, "Extension host did not start in 10 seconds, it might be stopped on the first line and needs a debugger to continue.", is the dev method's, not a product move.

## Sprint 145's four, on `main`

Kept, by the same runs: a switch has Home in front from the first frame (5 of 5); the AI column's box is the same from the first frame in every switch and relaunch; the restored terminal is behind the document in front from the first frame; the head's rows keep their room until the extensions are read (no head-row move in ten new projects).

## The failing set

What `project-check.mjs --first-frame` reports on `main`, five runs each (agreeing, apart from the race in row 4), with the extension host held 10 s:

| Start | Fails | What moves |
| --- | --- | --- |
| `new-profile` | 5 of 5 | the desk (+40 wide) and the side places bar going, +0.18–0.29 s; the welcome alone in front at +11.8–12.0 s (rows 13, 15) |
| `new-project` | 10 of 10 | Home's and the board's tabs coming at +10.9–11.4 s; in front (none) → Home → Task board → Home; the left column Documents → Home and the head's rows going at +11.6–11.9 s; once in ten, the places row at +0.23 s (rows 4, 5, 11) |
| `switch` | 5 of 5 | the left column's place (none) → Home and the head's empty box going, +0.19–0.22 s |
| `relaunch` | 5 of 5 | the same, +0.21–0.25 s; the terminal tab's name and width at +2.25–2.34 s |
| `relaunch --ai-closed` | 5 of 5 | as `relaunch`, and the AI column opening (the desk 400 narrower) at +11.0–11.2 s (row 14) |
| a new profile onto a folder (`new-profile`, R9's start) | 2 of 2 | at +0.29–0.31 s the left column (40 left), the desk, the AI column coming, the side places bar going, the seven places coming; at +11.9–12.4 s Home's and the board's tabs and Home's place (rows 4, 5, 11) |

PR 1 changes one of these: R6 keeps the closed AI column closed, so `relaunch --ai-closed` loses its AI column move on the branch (`qa-evidence.md`). The rest are the shell's, for PR 2.
