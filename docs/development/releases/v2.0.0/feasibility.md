# Ritemark 2.0 — feasibility read

**Status:** Written 2026-10-17 by a session the Development manager started on Jarmo's request, and updated the same day with Jarmo's decisions (see *Decisions taken on 17 October*). Docs only: no product code was written and no sprint was started. The plan built on it is [release-plan.md](release-plan.md); every sprint in it needs Jarmo's approval before any code.<br>
**Question:** can the drawn 2.0 (the new frame and theme, the welcome, the project at the centre) be built into `ritemark-native` from the Experience lead's proof of concept, while 1.x releases keep shipping?<br>
**Inputs:**
- The Experience lead's technical analysis, `ritemark-dev`: `product/design/experience/technical/README.md`, in its latest version (17 October: the You menu holds only Settings and Help, Ritemark's own menus are the default on the Mac too, You is an outline circle).
- Jarmo's decision of 15 October, `ritemark-dev`: `product/design/experience/migration.md`. 2.0 is one new Ritemark that ships the welcome, the new theme with its surfaces and the project at the centre together; the theme comes first, then the welcome, then the rest; patching VS Code is fine.
- The proof of concept: a local copy of this repository on branch `poc/2.0-surfaces` (not pushed, not for release). Its VS Code side is `patches/vscode/018-ritemark-surfaces-poc.patch`; the rest is in `extensions/ritemark`.
- This repository: `CLAUDE.md`, `docs/development/architecture.md`, `.claude/skills/vscode-development/` (`PATCH-RULES.md`, `references/layout-invariants.md`), the release-tier rules and the release scripts and workflows.

## The answer in short

Yes, 2.0 can be built, with about six decisions from Jarmo. The frame and the theme go into the patch stack as one new patch, and most of the welcome and the project work is extension code. Three things are not yet known because nobody has tried them: a production build with the patch, the frame on Windows, and what the AI column does with the terminal and Copilot Chat once its row of icons is gone.

The proof of concept shows the design works on the real app. It is not a patch to merge:

- **It has no switch.** Patch 018 reads no setting. Apart from the title row, which only the Mac loses, every change applies on every platform, so merging it would change 1.x.
- **It edits 1.x in place:** both themes, the product icon theme, the file icons and the extension's `configurationDefaults`. The defaults are in `package.json`, which every extension release ships, so the next extension release would move every 1.x user's layout.
- **It stacks on patch 002** in 8 hunks instead of folding into it.
- **It removes a feature:** it unregisters Home's launcher.
- **It carries proof-of-concept code** and has no tests.

## Decisions taken on 17 October

Jarmo answered the read's questions the same day:

- **"We will focus on 2.0 from now on."** 1.x releases pause, so 2.0 is built straight on main with no switch (section 4). Two of the reasons above fall away: the missing switch, and editing 1.x in place. The others stand.
- **"Terminal must be one type of tab."** The terminal is a tab on the desk.
- **Windows: "try to mimic as much apple as possible".** No title row on Windows either.
- **More: "we need it for activity bar icons that do not fit to visible area".** The ⋯ at the end of the places row holds the places that do not fit.
- **Copilot Chat goes behind More.**
- **The usage-data choice is on the welcome, and nothing is counted until the person says yes.**
- **People updating from 1.x see the welcome once.**

Jarmo left the technical choices to engineering ("You decide"). These are decided as follows:

- **Patch ownership:** the new patch owns geometry and drawing, and patch 002 keeps placement (section 2.2).
- **Windows testing:** each Windows round is built from main (section 5).
- **Copilot Chat's tab:** chosen from More, it opens as a tab on the desk, so the AI column holds only Ritemark's AI.
- **The first 2.0 start fills the project list** from the recent folders, chats and task boards on the computer.

Still open, with a recommendation, for the step that needs them:

- **The ChatGPT API key:** not in 2.0.
- **Narrow windows:** include the simple part in Step 1.

## Verdicts

| Item | Verdict | Why |
|---|---|---|
| Folding patch 018 into the stack | **Feasible** | 8 of 018's 78 hunks sit on lines that patch 002 (7) or 007 (1) wrote. Moving 002's size lines into the new patch removes the stacking. All 18 patches apply in order on the pinned VS Code 1.117.0 |
| The cost to `update-vscode.sh` bumps | **Feasible, with a lasting cost** | On 1.118.0 and 1.119.0, patch 018 fails in 4 of its 25 upstream files. Two of them are files where 002 already fails (the title bar and the layout toggles); two are new (the webview overlay and the Mac title bar). Its stylesheet (99 `!important` declarations) and its walks up the editor's DOM break visibly, not at apply time, so every bump needs a screenshot check |
| Layout invariants | **Feasible; decided** | Five of the eight written invariants change, and seven new rules are written down. "Layout invariants owned by patch 002" is a locked decision in `architecture.md`. Jarmo left it to engineering: the new patch owns geometry and drawing, and 002 keeps placement |
| The Windows frame | **Not yet known; decided: like the Mac** | Never run on Windows. With no title row, the menu goes behind a button and the window controls need 138 px. A Windows build of a shell change comes only from an exact `origin/main` commit, and since main is 2.0 from Step 1 that is where each round is built |
| Zoom | **Feasible** | The title bar already keeps its height through zoom (`preventZoom`); the strips can do the same. Not tried |
| A permanent More (⋯) | **Feasible; decided** | The ⋯ holds the places that do not fit. With the default places in a normal-width column it is always there, so VS Code's overflow is enough, in Ritemark's look and menu. Copilot Chat's launcher moves into it |
| Copilot Chat's launcher | **Feasible; decided** | Behind More, opening as a tab on the desk. Patch 007's launcher and its move of Copilot Chat into the AI column change. Not tried |
| The left column's head | **Feasible** | Built in the proof of concept as shell code (`ritemarkProjectHead.ts`). Its words and menu should come from the extension, so that extension releases can change them |
| The terminal as a tab | **Feasible; decided, in Step 1** | Undo three guards (14 hunks in 5 files of patch 002) and reverse one written invariant. The terminal opens from the +, and no terminal opens by itself at start |
| 2.0 on main | **Decided: no switch** | Jarmo: "We will focus on 2.0 from now on". 1.x releases pause, so main becomes 2.0 step by step and nothing has to keep the 1.x look working. Section 4 keeps the switch's analysis as the road not taken |
| What pausing 1.x costs | **Known** | No fixes and no runtime updates reach users until 2.0 ships. New models still arrive through the model catalog feed. An urgent fix for v1.14.0 would need an exception to the release rules. See section 4 |
| Tests and the production build | **Not yet known** | Patch 018 has never been built for production, and the proof of concept added no tests. No release script needs to change for an 18th patch |
| Windows CI | **Feasible; decided** | `build-windows.yml` builds only the exact canonical `origin/main` commit, on the paid runner. Each Windows round is a merge and a build from main, with no separate branch builds |

## What was read and run

- Read: the analysis and migration files in full, and the Experience lead's session up to its last turn (17 October, 13:27). The analysis file already describes every proof-of-concept commit.
- Diffed the proof of concept against its base, `ffad1448` (the v1.14.0 version commit). It has 26 commits and changes 63 files, +5,049 / −679 lines including the sample project. Main has 6 commits since that base; 2 files overlap (`media/webview.js` and `taskBoard/taskBoardHost.ts`).
- Counted patch 018's files, hunks and lines, and those of patches 001 to 017.
- Compared every hunk of 018 with the lines that patches 001 to 017 add, to find the hunks that replace or depend on another patch's lines.
- Dry-applied patches 001 to 017 and then 018, in order, on VS Code 1.117.0, 1.118.0 and 1.119.0. This ran in a temporary Git index (`git apply --cached`), the way `apply-patches.sh --dry-run` does, so no working tree was touched. On the newer tags each failing file was then excluded, to find every file that conflicts.
- Counted the upstream changes to 018's files between 1.116.0, 1.117.0, 1.118.0 and 1.119.0.
- Read the flag system (`src/features/flags.ts`, `featureGate.ts`), the release scripts that consume patches (`release-preflight.sh`, `build-provenance.mjs`), pre-commit Check 8, and `build-windows.yml` and `windows-test-overlay.yml`.
- Not run: the proof of concept itself (the Experience lead ran and measured it many times), a production build, any test suite. Nothing in the proof-of-concept copy was changed.

## 1. The proof of concept, measured

| | Size |
|---|---|
| Patch 018 | 2,986 lines, 30 files: 25 upstream VS Code files and 5 new ones; 78 hunks; +2,188 / −54 lines. The analysis's first figure ("about 700 lines in 22 files") was the first cut |
| New files | `media/ritemarkSurfaces.css` (881 lines), `editor/ritemarkFoldedTabs.ts` (234), `sidebar/ritemarkProjectHead.ts` (142), `editor/ritemarkNewTab.ts` (138), `ritemarkFrameStrip.ts` (63) |
| Upstream files | 73 hunks, +527 / −54. These are what conflict when VS Code moves; the new files never do |
| For comparison | Patch 002 has 31 files and 88 hunks. All 17 patches together touch 103 files |
| The extension | New `views/HomePanel.ts` (499 lines), `views/ProjectsViewProvider.ts` (221), `views/permanentTabs.ts` (123); `extension.ts` +51; `package.json` (seven `ritemark.*` surface colours, new defaults); both themes; 50 product icons; dark variants of 12 file icons; 9 webview files |
| Tests | None added |

What patch 018 does with the platform:

- `RITEMARK_FRAME_WITHOUT_TITLE_ROW = isMacintosh && isNative` is a constant; it appears on 15 added lines in 7 files, imports included. Everything else in the patch applies on Windows too: the 44 title row, the sheets and the 8 px gaps, the tab row, the menus. None of it has been seen on Windows.
- The patch reads no setting at all.
- The latest change (17 October) makes Ritemark's own menus VS Code's default on every platform (`desktop.contribution.ts`: `window.menuStyle` defaults to `custom`), and gives a menu's chosen row the theme's menu colours (`defaultStyles.ts`, `menu.ts`).

## 2. Folding patch 018 into the stack

### 2.1 Where 018 meets the stack

10 of 018's 25 upstream files are already patched: 9 by patch 002 and 1 by patch 007. Today 7 files are in two patches, and `PATCH-RULES.md` says each file should belong to one patch. Patch 018 as it is would more than double that, to 17.

In those 10 files 018 has 32 hunks. **8 of them sit on another patch's lines**:

| File | 018 hunk | On whose lines |
|---|---|---|
| `editor/editorTabsControl.ts` | Replaces `normal: 40 as const, // Ritemark: taller tabs` with 44 | 002 (upstream is 35) |
| `files/browser/views/explorerViewer.ts` | Replaces `ITEM_HEIGHT = 28` with 32 | 002 (upstream is 22) |
| `files/browser/media/explorerviewlet.css` | Replaces `height: 28px; line-height: 28px` with 32 | 002 |
| `actions/layoutActions.ts` | Turns off the left toggle by replacing the `when` that 002 wrote | 002 |
| `parts/compositeBar.ts` (2 hunks) | The 2.0 order of the places, next to 002's Tasks and Agent Library order | 002, as context |
| `titlebar/titlebarPart.ts` | Imports next to 002's changed import | 002, as context |
| `parts/paneCompositeBar.ts` | A constructor parameter next to 007's | 007, as context |

When 002 changes, for example at every VS Code bump, each of these 018 hunks has to be regenerated after it. That is the stacking the real patch avoids.

### 2.2 How the real patch folds

The rule: **patch 002 keeps placement (what sits where), and the surfaces patch owns geometry and drawing (sizes, gaps, strips, sheets, styles).** A size that 002 sets today moves into the surfaces patch, which sets the 2.0 value. A first mapping, to be settled in the Sprint 1 plan:

| File | Patch 002 today | Proof of concept adds | Real patch |
|---|---|---|---|
| `editorTabsControl.ts` | Tab height 40 (its only hunk) | Tab height 44, the tab's tooltip | The file moves to the surfaces patch |
| `explorerViewer.ts` | Row height 28 (its only hunk) | Row height 32 | The file moves to the surfaces patch |
| `explorerviewlet.css` | Row height 28, and the tree's styling | Row height 32 | The height lines move to the surfaces patch; the tree's styling stays in 002 |
| `paneCompositePart.ts` | A 40 px places bar set in injected CSS; the AI column starts on the AI | The places row's inset | Sizes move to the surfaces patch; the AI default stays in 002 |
| `layoutActions.ts` | The layout toggles rewritten | The left toggle hidden | The 2.0 condition joins 002's line |
| `compositeBar.ts` | Tasks and Agent Library order for older profiles | 2.0's order of the places | The 2.0 order joins 002's code (it is placement) |
| `titlebarPart.ts` | The accounts and global activity actions hidden | The 44 row, the toggles, You | The 2.0 hunks are regenerated so that none uses 002's lines as context |
| `auxiliaryBarPart.ts`, `paneCompositeBar.ts` | The AI first in its column; 007's Copilot Chat code | The AI column without title rows; the places open their tabs | Checked again after the proof-of-concept-only hunks are dropped (section 6) |

The target can be measured: **no hunk in the new patch removes, or uses as context, a line that an earlier patch wrote.** The check used for this read compared each hunk's removed and context lines with the lines that patches 001 to 017 add. It is small enough to become a harness check in Sprint 1. The Sprint 1 plan can also split the work into two patches by domain, for example the surfaces and frame in one and the tab row (`editorGroupView.ts`, the tabs controls, the + and the folded tabs) in another. Two smaller patches are easier to regenerate.

The consolidation rules in `PATCH-RULES.md` §8 apply as they stand, because hunks move out of 002: count and list 002's files before and after, and test the whole UI.

### 2.3 The cost to upstream bumps

Dry-applied in a temporary index:

| VS Code | Patches 001–017 | Patch 018 |
|---|---|---|
| 1.117.0 (the pin) | All apply | Applies |
| 1.118.0 | 002, 003, 010 and 015 fail (002 in 5 files, each of the others in 1) | Fails in 4 files: `layoutActions.ts`, `titlebar/titlebarPart.ts`, `webview/browser/overlayWebview.ts`, `electron-browser/parts/titlebar/titlebarPart.ts` |
| 1.119.0 | 007 and 009 fail too | The same 4 files |

Upstream changed 6 of 018's files between 1.116 and 1.117, 7 between 1.117 and 1.118, and 2 between 1.118 and 1.119. A title bar file changed in both of the last two releases. The frame without a title row lives in the title bar, so the title bar is where 2.0 adds most to every bump.

Two costs do not show up in `git apply`:

- **The stylesheet.** `ritemarkSurfaces.css` has 139 rule blocks, nearly all under `.monaco-workbench`, with 99 `!important` declarations. When upstream renames a class, the stylesheet still applies and the window just looks different.
- **The DOM walks.** `editorGroupView.ts` finds its neighbours by climbing `parentElement` three levels to `.monaco-split-view2`. Upstream can change that structure without touching any line of the patch.

So every bump needs a screenshot comparison of the base window (light and dark), added to `update-vscode.sh`'s checklist, as well as `--check`. Using VS Code's own layout events and grid information instead of DOM walks, where it exists, lowers this cost. That is Sprint 1 work.

### 2.4 Layout invariants that change

`references/layout-invariants.md`, today and in 2.0:

| Today | In 2.0 |
|---|---|
| Home first in the Activity Bar | The places in a row at the top of the left column, Ritemark's own first: Home, Documents, Tasks, Browser, Agents, Transcribe (Jarmo, 16 October) |
| Tasks right below the Explorer | Unchanged: third, after Documents |
| Agent Library last of Ritemark's containers | Agents fifth, before Transcribe |
| The AI panel in the right sidebar | Unchanged, as the AI's sheet: no VS Code title rows and no row of icons |
| The terminal in the right sidebar | Gone: the terminal is a tab on the desk (Jarmo, 17 October) |
| The terminal editor area is never used | Reversed: the terminal opens only as a tab, from the + |
| The title bar's action toolbar on the right | No title row: each column's strip carries its toggle, and You. On Windows the window controls sit at the right end of the AI's strip, or of the desk's strip when the AI is hidden |

New rules for the page, each with what enforces it: the strip is 44 with its centre line at 26; sheets are 8 px from each other, from the window's edges and from the status bar; tabs are 36 high and at least 120 wide; rows are 32; the status bar is 24; Home and Tasks are the first two pinned tabs and cannot be closed, unpinned or moved; a full tab row folds the tabs used longest ago instead of scrolling. `architecture.md`'s locked decision becomes "Layout invariants owned by patches 002 (placement) and 018 (geometry)". Jarmo left this ownership to engineering on 17 October ("You decide"). The Step 1 plan records it in `architecture.md`.

## 3. The open items

### The Windows frame

On Windows the menu bar and the window controls live in the title row. With patch 018 as it is, Windows gets a 44 title row (30 or 35 today, depending on the command center) and all of 2.0's drawing below it, the proof of concept's "stage 1", which has been seen only on the Mac. There are two ways:

- **Keep the 44 title row on Windows.** The menu bar and the window controls stay where Windows users expect them; the left toggle and You go in the title row; the tabs start below it. Windows and the Mac then have different tops, two frames to keep and test.
- **No title row on Windows either.** The menu goes behind a button in the left strip (VS Code's compact menu exists). The window controls overlay (Electron draws minimize, maximize and close, 138 px wide) sits over the AI's strip with the strip's height (`updateWindowControls` exists for that). The strip's drag region must leave the controls free, and when the AI column is hidden the desk's strip makes room. Not yet known: keyboard access to the menu (Alt), the hover menu on the maximize button, high-DPI scaling.

Either way, someone has to see it on a Windows PC, and a Windows build of a shell change comes only from main (section 5). **Verdict: not yet known.** **Decided (Jarmo, 17 October): the second way**, "mimic as much apple as possible".

### Zoom

The strips are part of the window's page, so they grow with zoom; the macOS traffic lights are native, so they don't. VS Code's title bar handles this itself: with `preventZoom` it divides its height by the zoom factor and keeps its native size. The strips can do the same, which keeps the top line and the traffic lights together while the documents zoom. Alternatively the traffic lights can be placed again on each zoom change. Small, in Sprint 1, not tried. **Feasible.**

### A permanent More (⋯) in the places row

VS Code shows ⋯ only when the pinned places overflow the row. The proof of concept's latest rule (Jarmo, 16 October) keeps every place in the row after Ritemark's own and folds what does not fit into that overflow menu. A ⋯ that is always there means showing the overflow action always in `compositeBar.ts`, a few lines in a file the patch changes anyway, or adding a Ritemark place that opens a list. **Decided (Jarmo, 17 October):** More is there for the places that do not fit. With the default places in a normal-width column something always overflows, so VS Code's overflow is enough, drawn as Ritemark's ⋯ with Ritemark's menu. Copilot Chat's launcher goes into it.

### Copilot Chat's launcher

Patch 007 (`chatSetupContributions.ts`) adds a Copilot Chat launcher to the places row and moves Copilot Chat's view into the AI column (the auxiliary bar). In 2.0 the AI column has no row of icons, so opening Copilot Chat would replace the AI's sheet with no visible way back except the toggles. This has not been tried. The possible homes are:

- one of the agents inside the AI's sheet (the deepest change);
- a tab on the desk;
- the launcher in the places row, plus a small switch in the AI column;
- behind More or You.

Patch 007 already fails in this file on 1.119.0. **Decided (Jarmo, 17 October): behind More.** Chosen from there, it opens as a tab on the desk (engineering's choice), so the AI column holds only Ritemark's AI.

### The left column's head

Built in the proof of concept as shell code (`sidebar/ritemarkProjectHead.ts`, 142 lines, which `sidebarPart.ts` creates): the project's mark, its name and a chevron for its menu (Switch project, Open a folder, Reveal in Finder, then the folder tools), then New and Search as rows, then Documents over the tree. For release, the head's place and drawing stay in the shell, and its words and menu entries come from the extension through commands and context keys, so that extension releases can change them. On Windows "Reveal in Finder" becomes "Reveal in File Explorer". The head's place is Sprint 1; what it shows is Sprint 3. **Feasible.**

### The terminal as a tab

Patch 002 has three guards that keep the terminal out of the editor area, and `layout-invariants.md` says it is never used:

1. `terminal.contribution.ts` puts the terminal view in the auxiliary bar.
2. `terminalConfigurationService.ts` ignores `terminal.integrated.defaultLocation = editor` (with its test).
3. `terminalEditorSerializer.ts` restores old terminal tabs into the view, with `terminalView.ts`.

That is 5 files and 14 hunks. Three of those files fail on both 1.118.0 and 1.119.0, so the guards are already part of every bump's cost.

In 2.0 this is not optional any more. The proof of concept sets `RITEMARK_AI_SIDE_ALONE = true`, which removes the AI column's row of icons. But patch 002 still puts the terminal in that column, and the extension opens a terminal there 2.5 s after start (`extension.ts:598-608`). So the terminal would have no visible way in. The options:

- **A tab on the desk.** Undo the guards, add Terminal to the +'s menu, and drop the guards' hunks from 002, which means fewer conflicts at bumps.
- **Stay in the AI column** with a switch in the AI sheet's header. That is webview work and a change to the drawing.
- **VS Code's bottom panel.**

**Decided (Jarmo, 17 October): "Terminal must be one type of tab."** It is done in Step 1, because Step 1 removes the row of icons. The extension's terminal at start goes in the same step.

## 4. Building 2.0 on main

**Decided (Jarmo, 17 October): "We will focus on 2.0 from now on."** 1.x releases pause, and 2.0 is built straight on main with no switch. v1.14.0 is the last 1.x release.

What that means:

- **Each step merges into main as 2.0.** From the first merge main is no longer 1.x, so no release, shell or extension, is built from main until 2.0. Extension releases pause too: they ship the extension's JavaScript and `package.json` from main, so they would carry part of 2.0.
- **Nothing has to keep the 1.x look working beside the new one.** The patch sets 2.0's values directly; the themes, icons and defaults change in place; the stylesheet needs no scoping class. That removes the gating work described below, and the check of the old look in every 1.x release.
- **Features still stay** (HARD RULE #1). What the Home launcher, the Getting Started page and its launch check do today must stay reachable in 2.0 when they are replaced.
- **Main stays buildable and usable at every merge**, so each step can be tried in a dev build and in a Windows build from main.
- **While 1.x is paused:**
  - New models still reach v1.14.0 users through the model catalog feed (`ritemark-public`). That needs no release, as long as the bundled runtimes can run them.
  - Runtime updates (Claude Code, Codex, OpenCode) wait for 2.0, and Step 4's runtime review covers the whole gap since v1.14.0.
  - An urgent fix for v1.14.0 would need an exception to the clean-room rule: a release worktree from the v1.14.0 tag instead of main. Jarmo decides if one is ever needed.
- **The milestones.** The open v1.15.0 milestone has no issues; the Development manager can close it and open v2.0.0.

**Considered and not taken: a switch.** Keeping 1.x releases going would have needed 2.0 behind one internal setting:

- a flag in `flags.ts`, off by default (an exception to HARD RULE #2), whose setting the shell reads too;
- every upstream hunk branching on it, with the 1.x value kept;
- 2.0's defaults registered only when it is on;
- the stylesheet scoped under a class, and 2.0 themes and icons under their own ids;
- an extension check that the shell has the patch.

Even then it could not have hidden the patch's cost to every 1.x release, the static files, the window the main process makes or the state 2.0 writes, and every 1.x shell release would have needed a screenshot check of the old look. The other alternative, a long-lived 2.0 branch, meant every VS Code update and 1.x fix done twice, and no Windows build until the end, because Windows builds only from main.

## 5. Tests, the production build and Windows CI

- **The clean-room release worktree.** Patches come from Git, and `build-prod.sh` applies them itself. The 5 new files are created by the patch, as patches 001, 009, 010 and 015 already create files. No change is needed in `create-release-worktree.sh`, `build-provenance.mjs` (it hashes the whole `patches/vscode` directory) or `release-preflight.sh` (it applies every `*.patch` to a vanilla clone, however many there are). The release that carries the patch is shell-tier by path (`patches/`).
- **The name.** The proof of concept's patch says NOT FOR RELEASE in its own name and header. The real patch is a new file, for example `018-ritemark-surfaces.patch`, built from the proof of concept rather than copied.
- **The validators.** Pre-commit Check 8 still searches the dry-run output for "Already applied|Would apply", and the dry-run's summary always prints those labels, so the check gates nothing; read the counts. `CLAUDE.md`'s "Current patches (17)" table needs the new patch. `PATCH-RULES.md`'s patch table still lists six patches and should be brought up to date in the same change. `AGENTS.md` follows through the harness sync. The webview bundle check: the proof of concept committed a rebuilt `media/webview.js`, and main has rebuilt it since ([#431](https://github.com/ProductoryHQ/ritemark-native/pull/431)), so the sprints rebuild it from source.
- **The production build has never run with the patch.** VS Code's strict build fails on any unused import ("declared but never read", `PATCH-RULES.md` §9). The patch removes VS Code's macOS 26 title bar sizes and the `DEFAULT_CUSTOM_TITLEBAR_HEIGHT` imports, so every import those leave unused must go. In dev mode CSS is served from `out/` and is not copied automatically, so a dev run can show an old stylesheet; the production build is the real check. Sprint 1 ends with a production build.
- **Tests.** The proof of concept added none, and no workflow runs VS Code's own unit tests. Sprint 1 adds:
  - VS Code unit tests for the editor group's rule (Home and Tasks cannot be closed, unpinned or moved; "Close all" leaves exactly those two), run locally with VS Code's test runner;
  - extension unit tests for the permanent tabs and, in Sprint 3, the project list;
  - geometry checks over CDP (the `ritemark-automation` skill) for the numbers the proof of concept measured by hand: the centre line 26, the sheets 8 from the edges and from the status bar, rows 32, tabs at least 120;
  - a screenshot comparison of the base window in light and dark, which becomes the baseline for every later step and bump;
  - a check that everything v1.14.0 can do is still reachable in 2.0.
- **Windows CI.** `build-windows.yml` takes a `source_commit` that must equal canonical `origin/main`, runs on the paid `windows-8core` runner, and needs the repository's visibility toggled. `windows-test-overlay.yml` lays only extension files over an installed app. So **a shell change can be seen on Windows only after it merges.** Since main is 2.0 from Step 1, each Windows round of the frame is a merge and a paid build from main. **Decided:** no separate unsigned branch builds. Windows' Smart App Control can block unsigned apps, and a branch build would need the same paid runner anyway. After Step 1, the welcome and the project work are mostly extension code, which the existing overlay can lay over a Windows app built from main.
- **macOS.** The traffic lights are placed after the window is on screen, in two lifecycle phases; that was seen on one Mac. The patch replaces VS Code's own Mac title bar heights (32 on macOS 26, 28 before it) with 44, so it needs checking on macOS 12 to 15 and on 26.
- **Accessibility.** VoiceOver, keyboard order through the strips and high contrast have not been checked (the analysis says so). Sprint 1 checks them.
- **Extra windows.** Auxiliary windows keep VS Code's title bar; the patch skips them on purpose.

## 6. What comes over from the proof of concept, and what does not

**Comes over** as the starting point: the measurements and rules; the layout approach (the part is given less room and CSS draws the card, as VS Code's own Agent Sessions window does); the five new files; the editor group's rule for Home and Tasks; the folded tabs; the seven `ritemark.*` surface colours; the 50 product icons; the dark file icons; the webview changes that draw the AI's sheet.

**Does not come over:**

- The patch's name and header, and code that only served the proof of concept:
  - the one-time re-pin of places an earlier version had unpinned (`RITEMARK_REPIN_ONCE` and its storage key `ritemark.places.repinned`);
  - the empty `RITEMARK_SECONDARY_PLACES` set and the code that reads it;
  - the second You menu with five items in the title-row path (the strip's two-item menu is the current one);
  - the `ritemark.poc.addSampleProjects` command, the sample project and `poc/run.sh`.
- The shell hunk that makes the Tasks place open the board (`RITEMARK_PLACE_TABS`). Main's [#431](https://github.com/ProductoryHQ/ritemark-native/pull/431) already does that in the extension (`TasksViewProvider.ts`), so only Home needs it, and in the extension too.
- **Swapping Home's launcher for the projects list without keeping what it does.** The proof of concept unregisters `HomeViewProvider`. In 2.0 the projects list replaces it, and what the launcher does (a new document, a new AI conversation, recent work, the Task board) stays reachable from 2.0's Home (HARD RULE #1).
- **Home and the projects list as HTML strings filled with `innerHTML`.** They are rebuilt in the shared React bundle with the UI components (`CLAUDE.md` UI rule), with project names and card titles escaped.
- **`_workbench.getRecentlyOpened`, an internal VS Code command, as the project list.** Sprint 3's own list in Ritemark's storage replaces it, filled from the recent folders on the first 2.0 start.
- The proof of concept's edits to the themes, the product icon theme, the light file icons (from `currentColor` to fixed colours) and the `package.json` defaults are fine to make in place now that 1.x is paused. The theme pass redoes them for every surface rather than copying them.
- The committed `media/webview.js`.
