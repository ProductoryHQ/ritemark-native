# Sprint 135 Scenarios

These are the manual QA matrix. Each names the requirement it shows. "S" numbers are stable: a new scenario gets a new number. Unless a scenario says otherwise, it runs on the updated build, in Ritemark Light and Ritemark Dark, on a fresh `--user-data-dir`.

Most of the visible behaviour is already pinned down by earlier sprints. S17 and S18 re-run Sprint 132's shell scenarios and Steps 2 and 3's, listed in [tasks.md](tasks.md). This file adds what is new about an update.

## Feature: The target is picked and frozen (R1)

### S1: Phase 0 picks the target
Given Jarmo has approved this plan and Steps 1–3 are merged
When the newest stable release is read from GitHub's releases list
Then the target is that tag, and `notes/freeze.md` records its commit, its Node and Electron versions and the date
And the shallow submodule's tags are not used.

### S2: A recovery release of the same minor comes out
Given the target is 1.N.0 and the rebase is under way
When upstream publishes 1.N.1
Then the stack is dry-applied on 1.N.1 and upstream's diff from 1.N.0 is read
And the target moves to 1.N.1 only if the stack still applies, or each new failure is classified as in R2.

### S3: A new minor comes out
Given the target is frozen
When upstream publishes 1.(N+1).0
Then the target does not change, and the new release is noted for after 2.0.

## Feature: Every patch is rebased hunk by hunk (R2)

### S4: A behavioural change hidden inside a hunk
Given a patch file was re-based mostly by hand
When its `+`/`-` lines are compared with main's patch
Then a flipped value, a swapped identifier, a new import or a new CSS rule shows up and is either explained in `notes/rebase.md` or fixed
And a file that drops out of the patch fails the before-and-after file count.

### S5: From pristine, and a second run
Given `vscode/` is at the target with no patches, and untracked files cleaned except the extension link
When `./scripts/apply-patches.sh` runs, then runs again
Then the first run applies every patch, and the second run applies nothing, finds every patch already there and exits 0
And `--dry-run`'s counts say every patch can apply and none conflicts.

### S6: A cascade is not counted as drift
Given 001 fails in `gettingStarted.ts` on the target
When 001's failing hunks are re-based and the dry run is repeated
Then 016 and 017 apply without changes, because their failure was a cascade from 001 (true at 1.142.0).

## Feature: The toolchain (R3)

### S7: A wrong Node is refused
Given a shell with Node 22, or with x64 Node under Rosetta
When `scripts/validate-build-env.sh` runs, or `npm ci` in `vscode/`
Then the check fails and names the arm64 Node version from `vscode/.nvmrc`, and VS Code's `preinstall` stops before installing anything.

### S8: A fresh clone, from the docs only
Given a new clone of the repository on the Mac
When the steps in `SKILL.md` are followed (nvm, the arm64 wrapper, `npm ci`, apply patches, compile)
Then dev mode starts on the target with Ritemark, and the About box shows the target's VS Code and Electron versions.

## Feature: Native modules (R4)

### S9: An x64 module is caught
Given `npm rebuild` was run in `vscode/` from an x64 shell
When `scripts/check-native-modules.sh` runs
Then each wrong `.node` file is named with its `file` output, and the fix command is printed
And a module that upstream added since 1.117.0 is in the check, because the list comes from the files present.

### S10: The native features work
Given dev mode, and then the production build
When the person opens a terminal tab, edits a file outside Ritemark, and switches the keyboard layout
Then the terminal runs, the change shows in the tree and the editor, and shortcuts follow the layout
And the logs have no `ERR_DLOPEN_FAILED`.

## Feature: Windows (R5)

### S11: Windows CI from main
Given the update is merged
When `Build Windows (x64)` is dispatched for the merged commit
Then the build passes the node-gyp and preinstall steps without workarounds that are no longer needed, packaging strips the non-Windows binaries, and the installer's round trip passes.

### S12: The frame on a Windows PC
Given the Windows build from the merged commit, installed on a Windows PC
When Ritemark opens on a project
Then there is no title row; the menu button works by mouse and by Alt; minimize, maximize and close sit at the right end of the AI's strip; dragging and snapping work
And the Windows screenshots match the last Windows round's, or each difference is in `qa/screenshot-diff.md`.

## Feature: The screenshot baseline (R6)

### S13: No difference
Given the baseline approved at Sprint 132's merge 2 (with Steps 2 and 3's scenes)
When `frame-screenshots.mjs` captures the same scenes on the updated build
Then every scene matches, in light and dark.

### S14: A difference upstream forced
Given a scene differs because Electron 43's Chromium draws something differently and no setting brings it back
When the difference is written up with the before and after
Then the Experience lead reviews it, then Jarmo, and the baseline changes only after Jarmo approves.

### S15: A difference from an upstream default
Given a scene differs because upstream changed a setting's default
When the default-drift scan finds the setting
Then its old value is pinned in `branding/product.json` `configurationDefaults`, and the scene matches again.

## Feature: 2.0's surfaces after the move (R7)

### S16: The frame's numbers
Given dev mode on the target
When `frame-geometry.mjs` runs each scene (normal, left hidden, both hidden, two desks)
Then every number equals Sprint 132 merge 2's: strips 44 with controls on the line at 26, the 8 gaps, tabs 36, rows 32, the status bar 24.

### S17: Sprint 132's shell scenarios
Given the updated build
When Sprint 132's shell scenarios listed in [tasks.md](tasks.md) are run
Then each passes as it did on 1.117.0.

### S18: Steps 2 and 3's shell scenarios
Given the updated build
When the welcome, landing, Home, the projects list and switching in place are run, using the scenarios of Sprints 133 and 134 that Phase 0 listed
Then each passes as it did on 1.117.0.

### S19: A class upstream renamed
Given `ritemarkSurfaces.css` styles a workbench class
When the selector audit finds that the target no longer renders that class
Then the rule is moved to the class that replaced it before any screenshot is taken, and the change is listed in `notes/rebase.md` under 018.

## Feature: The rollback point (R10)

### S20: The rehearsal
Given the sprint branch is ready for its PR
When a scratch branch reverts the sprint's squashed change and follows the rollback recipe
Then dev mode starts on 1.117.0 with Node 22.22.1, all patches apply, and the native-module check passes
And the scratch branch is deleted.

### S21: Rolling back on main
Given the update is merged, and main's production build or Windows CI cannot be made green by a fix-forward PR
When Jarmo agrees to roll back
Then one revert PR returns the gitlink, the patches, `branding/product.json` and the Node pins to the rollback point, and the clean-room build at the revert commit passes.

## Feature: Nothing lost, nothing stray (R8)

### S22: The inventory
Given Sprint 132's before-and-after inventory
When every row is tried on the updated build
Then every row works.

### S23: Profiles from before the update
Given a lived-in v1.14.0 profile and a profile used on main before the update (projects, chats, task boards, a terminal tab, a moved view, a chosen theme)
When each opens in the updated build
Then tabs, terminals, chats, projects and settings come back, and nothing is lost.

### S24: A new way into chat
Given upstream added a new chat or agents entry point between the pin and the target
When the window, the menus and the command palette are checked
Then the entry point is hidden by patch 003, or by 007 where it concerns Copilot Chat, and Copilot Chat still opens only from More, as a tab.

### S25: A new built-in extension
Given `mermaid-markdown-features` and `theme-modern-icons` are new built-ins at 1.142.0
When each is reviewed
Then each is shipped, hidden or stripped by the rule "no new visible surface without Jarmo", and the decision is in `notes/rebase.md`.

## Feature: Ritemark's features on VS Code (R9)

### S26: The browser and the agent
Given a project and a page open in Ritemark's browser
When the AI is asked about the page, and to click a link and fill a field
Then the page's context reaches the AI, the actions happen in the page, and the page appears in Browser Recent.

### S27: The three runtimes
Given darwin-arm64, darwin-x64 and Windows builds
When an authenticated Claude Code turn, a Codex turn and an OpenCode turn that asks for permission are run
Then each turn completes, and OpenCode's write waits for the person's yes.

### S28: Saving and the smaller patches
Given a Markdown document open
When it is saved, edited outside Ritemark and saved again, and the Help menu is opened
Then the save is acknowledged against the written text (014), the Help menu lists only Ritemark's entries (015), and the welcome's checks show no Node line on the bundled runtimes (017, or its Step 2 replacement).

### S29: Windows file handles
Given the Windows build, and a project with many files
When the Claude Agent SDK runs a turn that reads many files
Then no EMFILE error reaches the person (the v1.7.3 preload on Node 24).

## Feature: Builds (E3)

### S30: The clean-room build at the merged commit
Given the update is merged
When a release worktree is created at the merged commit and `build-prod.sh` runs
Then the build succeeds, `validate-build-output.sh` passes (including every `.node` file's architecture), and the embedded provenance names the new gitlink and patch digest.
