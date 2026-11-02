# Sprint 152 QA evidence

E1: each requirement's check, failing on `main` first and passing on its branch. PR 1's rows are below; PR 2 adds its
own. Every run here is the Mac, a hidden dev instance of the PR's tree (VS Code `d956e8a6` with the 19 patches), with
scratch profiles and AI homes, signed in to nothing.

## PR 1 (`sprint-152-startup-contract`)

| Req | Check | On `main` (`f84f4513`) | On the branch |
| --- | --- | --- | --- |
| R8 | `project-check.mjs --first-frame`, five runs of each start with the extension host held 10 s | Fails in every start, the runs agreeing (A1, *The failing set*) | The check itself is this PR; the same starts on the branch (two sets) give the same moves except R6's (below), all of them the shell's, for PR 2 |
| R5 | `startLook.test.ts`: the messages in A4's orders, at each step what the view draws | The gate alone (main's view) draws the empty chat, then the AI's sign-in screen, then "Almost there!" (the test's last block asserts it) | The mark until the look is certain, then one look: "Almost there!" not signed in, the chat signed in or with a conversation, never a sign-in screen before the chat; once the chosen AI has answered, a hung other AI or a lost onboarding status settles after 2 s; a failed start is its own look |
| R5 | The AI column traced in the running app (A4's tracer), not signed in, Claude chosen | First window: ground, the view's empty frame, "Preparing Agent Chat…", the empty chat, "Sign in with Claude.ai…", "Almost there!" at 2.5 s. Held start: the shell's mark, then 0.33 s of bare ground, then the card | First window: ground, the view's ground while its mark waits for its second, its mark at 1.13 s, "Almost there!" at 2.66 s. Reload: the same, "Almost there!" at 2.25 s. Held start: the shell's mark from 1.25 s, the view's mark at 11.15 s with the shell's still under it (no bare ground), "Almost there!" at 12.97 s |
| R5 | The two marks' places | — | Both centred at (1244, 456) in workbench pixels: the shell's in its pane `[1048, 44, 392, 824]`, the view's at (196, 412) in its window, whose frame is that same box |
| R5 | `aiStartingMark.test.ts`: the column's first frame, the mark's wait and turn, the ring's values | No such mark in the view | The view's mark waits the rest of the second, or shows at once turned to where the shell's is; the same ring and words as patch 018's |
| R5 | A chat opened on a conversation while its AI's check hangs: the sheet's and rail's top edges and the conversation's foot, read in the running view before the notice and at it (10 s) | No notice: the 15 s card drew on the ground above the sheet, pushing the sheet and rail down about 120 px | Light and Dark alike: the sheet's top 0 → 0 px, the rail's top 0 → 0 px; the conversation's foot 610.8 → 477.9 px; the notice from 579.9 to 704.8 px, inside the sheet under the AI disclosure, directly above the box |
| R6 | `project-check.mjs --first-frame relaunch --ai-closed` | 5 of 5: the AI column the person closed opens at Ritemark's start (+11.0–11.2 s), the desk 400 narrower | The AI column stays closed (no AI column move); the start still fails on the shell's moves (a stored place at +0.24 s, the terminal tab's name at +2.36 s), which PR 2 removes |

Screenshots of the AI column's start on the branch, not signed in, Light and Dark: `qa/r5-light-*.png`, `qa/r5-dark-*.png`
(the view's mark; the 10 s line before and after the view has read which AI, held there by pausing the extension host
over its inspector; "Almost there!"; the failure, from an `agent:bootstrap-error` delivered to the view as the host
sends it; the restored chat's notice, its conversation delivered as the host's `conversation/get` answer carries it).
The failure card and the notice were retaken after the Experience lead's check of #632. Signed in: not run (no
signed-in AI in a scratch home).

Tests: the extension's `npm test` (with the two new files), the webview's `tsc --noEmit`, the extension's `tsc --noEmit`.

## PR 2 (`sprint-152-startup-contract-shell`)

`main` here is `origin/main` at `4aac8f8d` with PR 1's commits (its patches unchanged), applied from the pin; the branch
is the same with PR 2's patches, applied from the pin and identical to the tree the work was done in (19 of 19 changed
files). The first-frame check holds the extension host 10 s, then lets it go.

| Req | Check | On `main` | On the branch |
| --- | --- | --- | --- |
| R1, R4 | `--first-frame new-profile` | Fails: VS Code's side places bar goes and the desk moves 40 at +0.22 s; the welcome alone takes the window at +12.16 s | Passes 5 of 5 (Light and Dark): the welcome alone from the first frame, 5 boxes kept their place |
| R1, R3 | `--first-frame new-project` (a folder the profile never opened) | Fails (2 of 2): Home's and the board's tabs come at +10.9–11.2 s, in front none → Home → Task board → Home; the left column Documents → Home at +11.5–11.7 s, the head's rows go | Passes 10 of 10: Home's place and Home's and the Task board's tabs from the first frame, 14 boxes kept their place |
| R2 | `--first-frame switch` (a project left on Home, with a document) | Fails: the left column's place none → Home at +0.21 s; the head's 12 px box goes | Passes 5 of 5: Home checked from the first frame, 14 boxes kept their place |
| R2, A1 | `--first-frame relaunch` (a terminal on the desk) | Fails: as the switch at +0.22 s; the terminal tab nameless with a width step at +0.12–0.22 s, then "Terminal" at +2.25 s | The terminal tab named "Terminal" from the first frame, no nameless or "bash" step. 2 of 5 pass; 3 show a 0.46 px width step of that tab at +0.11–0.13 s (114.04 → 114.5, which the check rounds to 114 → 115): 019's whole-pixel tab pass first measures the restored terminal tab on a layout after the first frame. Round 1's code: 8 of 10 passed |
| R6 | `--first-frame relaunch --ai-closed` | Fails: as the relaunch (the AI column stays closed: PR 1's R6) | Passes 4 of 5; one shows the same 0.46 px step at +0.24 s. The AI column stays closed |
| R9 | `--first-frame new-profile` on a folder | Fails: 17 boxes move at +0.22 s: VS Code's side bar with Documents goes, Ritemark's seven places come, the AI column comes (the desk 1144 → 784) | Passes 2 of 2 (Light and Dark): all six places, Home's place and the AI column from the first frame, 14 boxes kept their place |
| R3 | A project left on Documents: Reload Window, then a quit and a new start | (not a move on `main`: the stored place is VS Code's default) | Documents after both (it opened on Home in round 1's code: the review's finding 1, fixed) |
| R2 | `project-check.mjs --switch-to <folder> --measure 10` (Sprint 145's) | 9 PASS, 10 switches | 9 PASS, 10 switches (the AI column 0 ms after Home at worst; Home first every time) |
| R2 | `ritemarkTerminalTabs.test.ts`, `ritemarkSwitchGuard.test.ts` | pass | pass, with their new cases (a restored terminal's given name; #623's attempt) |
| Finding 3 | A project window started with Ritemark turned off, then on | the AI column stays closed at the second start | it comes back; over three starts (off, off, on): closed, closed (waiting), open |
| #633 | A scratch profile, `git.path` pointing at nothing and no git on `PATH`, a folder with `.git` | "Git not found. Install it or configure it using the "git.path" setting." with **Download Git** (`qa/pr2-main-633-git-not-found.png`, on `main`'s own tree) | no notification (`qa/pr2-633-git-not-found.png`) |
| #623 | `ritemarkSwitchGuard.test.ts` (the attempt passed, and whether it still goes on after another participant's veto), `switchProject.test.ts` (a stale attempt stops no chat; an older shell as before) | the tests don't run on `main`'s code (no attempt) | pass |
| R7 | `check-frame-manifest.test.mjs` (fixtures from this repository: a renamed head command, a renamed permanent tab, a place added and one gone, a default that differs or is no longer set, a manifest with no settings list, the script through a symlink) | no check | 10 pass; `--ref HEAD` passes |
| R7 | `validate-build-output.sh`'s Check 4b on a stand-in app | `main`'s product.json: FAIL, no `ritemarkFrame` block | OK (6 places, 2 permanent tabs) |
| R1, R3, R4, R9 | `ritemarkFrame.test.ts`, `ritemarkWelcomeAlone.test.ts` | — | pass |
| R1 | `frame-screenshots.mjs` on the baseline's sample project, fresh profile, both trees; the branch's 34 scenes compared with `main`'s pixel by pixel; `frame-geometry.mjs` | 34 scenes; JOINS ok 34 of 34; geometry 34 PASS, 2 skipped. Against `docs/development/frame-baseline` every scene differs 0.6–12.5% on both trees alike (the baseline has signed-in AIs; these runs have scratch homes) | 0 of 34 scenes differ by more than the check's 0.5% from `main`'s (worst 0.305%: the project's folder path on Home and the settings foot, which name each run's folder; sub-pixel specks in two tab rows); More's order is `main`'s in both themes. (Until the seeding fix, a seeded Documents with no order made VS Code's places that register after it go in at the places' end one before the other, so More had Chat Debug before Extensions; the places row's stored order on a new profile, read after it settles, was `main`'s again once only the extension's places are seeded, twice each.) JOINS ok 34 of 34; geometry 34 PASS, 2 skipped |
| E2 | Hunks in 002, 018, 019; `check-patch-stacking.mjs` | 88, 123, 60 | 91, 126, 60: 3 new hunks in upstream files (002's `layout.ts` import; 018's `paneCompositeBar.ts` import and check), no upstream file newly touched; stacking clean |

Tests: `./scripts/test.sh --grep Ritemark` (73 passing), `npm run typecheck-client`, the extension's `npm test` and
`tsc --noEmit`, `node --test scripts/check-frame-manifest.test.mjs`, the dry run (19 of 19 OK) and a real apply from the
pin, the pre-commit validator.

Screenshots, not signed in, in `qa/`: each start on the branch while the extension host is held (what a slow start
shows; nothing moves after the first frame), Light and Dark, and `main`'s first frame in Light beside them
(`pr2-main-<start>-first-light.png`): `pr2-new-profile-held-*.png` (the welcome alone; `main`: VS
Code's empty window with the side places bar), `pr2-new-project-held-*.png` (Home's place and Home's and the Task
board's tabs; `main`: Documents and an empty desk), `pr2-switch-held-*.png` (Home checked in the places row; `main`:
none checked), `pr2-relaunch-ai-closed-held-light.png` and `pr2-relaunch-held-dark.png` (the terminal tab named; `main`: nameless), and
`pr2-new-profile-on-folder-held-*.png` (all six places; `main`: VS Code's side bar with Documents alone).

Not run: Windows (2.2's Gate 2); signed in (no signed-in AI in a scratch home); the S47 traces as Sprint 145 ran them
(the relaunch start, with the extension host held and a terminal on the desk, and the unit tests cover the same order).
Not built: the welcome alone's turning mark after 1 s and line after 10 s (the Experience lead's answer 1: the ground
stays plain until the welcome opens), the desk's mark after 1 s on a Home tab not yet filled (answers 2 and 3; VS
Code's progress line runs under the tab meanwhile), W5's hand-over of the shell's moment to the AI view.

Gate 2 rows for the Windows session, on 2.2's candidate (PR 2 can't run through the overlay, which builds only `main`):

- A cold first start after an install, no folder: the welcome alone from the first frame, the plain ground until the welcome opens; no side places bar, no AI column.
- After an update, a project left on Home: Home checked in the places row from the first frame, the AI column there, Home's tab in front; nothing moves when Ritemark starts (`project-check.mjs --first-frame relaunch` where it runs, by eye otherwise).
- Open Recent into a folder never opened: Home's place and Home's and the Task board's tabs from the first frame.
- Reload Window with a terminal on the desk: the terminal's tab named from the first frame.
- A PC without Git, a folder with `.git`: no "Git not found" notification (#633).
- The window log (`renderer.log`) of a normal start has no `[ritemark] slot released:` line.
