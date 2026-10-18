# Sprint 135 Spec: VS Code to the current release

## Purpose

Ritemark 2.0 is built on VS Code 1.117.0, from April 2026, with Electron 39 and Node 22. VS Code now ships every week. On 18 October 2026 the newest release was 1.142.0 (14 October), with Electron 43 and Node 24. This sprint moves the pin once, to the release frozen when the sprint starts, and carries every Ritemark patch across. It then proves that 2.0 looks and works as Steps 1–3 left it. People should notice nothing except what upstream fixed.

It is the "Update" step of the [v2.0.0 release plan](../release-plan.md). It starts only after Steps 1, 2 and 3 are merged, and Step 4 starts after it.

## Principles

- **The screenshot baseline is the contract.** Every visible difference from Step 1's baseline is a defect until it is fixed, pinned back, or approved by Jarmo.
- **One target, frozen once.** It is picked by a written rule at Phase 0. A new VS Code minor never replaces it during the sprint.
- **Classify every hunk, never whole files.** Each hunk of each patch is compared with main's patch. Nothing is borrowed from another worktree file by file (memory: patch rebase classification).
- **Each patch keeps its domain.** 002 keeps placement, 018 the frame's sizes and drawing, 019 the tab row. The stacking check (pre-commit Check 14) keeps passing.
- **No feature rides along.** The only behaviour changes are the ones upstream forces, and each one is listed.
- **One move, one rollback point.** The gitlink, the patches, `branding/product.json`, the Node pins and the harness change together in one merge.
- **The clean-room rules do not change.** Production builds run only from exact `origin/main` in a new release worktree.

## Requirements

### R1: The target is picked by rule and frozen

As Jarmo, I want the VS Code version chosen by a written rule on one day, so the sprint does not chase a target that moves every week.

Acceptance criteria:

- On Phase 0 day, the newest stable release is read from `gh api repos/microsoft/vscode/releases`, leaving out pre-releases. The shallow `vscode/` submodule's tags are not used: they stop at 1.119.0.
- The freeze is recorded in `notes/freeze.md` and in the sprint plan's status line: the tag, its commit, the date, the target's `.nvmrc` Node version and its `.npmrc` Electron version.
- Until the merge, only a recovery release of the same minor (1.N.1, 1.N.2, …) may replace the target. The stack is dry-applied again on it, and its upstream diff from the frozen tag is read. A new minor never replaces the target (decision D1).
- On the planning date the rule gives 1.142.0: commit `d956e8a6ac5d904486557eea07e1d6bd62a4d36f`, Node 24.18.0, Electron 43.7.7.

### R2: Every patch is rebased, hunk by hunk

As engineering, I want each patch carried to the target with its intent proven unchanged, so nothing Ritemark does is silently lost, as in the 2026-03-22 consolidation.

Acceptance criteria:

- Every patch on main at the freeze applies on the target, in order: 001–019 today, plus whatever Steps 2 and 3 add or remove. The dry run's "can apply / conflicts" counts are read (not only its labels). Then a real apply from a pristine tree succeeds, and a second run is clean.
- `notes/rebase.md` classifies every hunk of every failing file in one of these classes:
  - **carried**: applies as is, perhaps at an offset;
  - **re-based**: the same lines on new context;
  - **re-cut**: upstream changed the mechanism the hunk used, so new code gives the same behaviour;
  - **moved**: carried to where upstream moved the code;
  - **dropped, upstream**: upstream now does the same thing itself, with the proof named;
  - **dropped, 2.0**: a 2.0 step removed the need, with the step named;
  - **cascade**: it failed only because an earlier patch's hunk in the same file had failed.
- For each patch, the `+`/`-` lines of the new patch are compared with main's patch (the hunk-level diff from the memory note). Any behavioural difference (a flipped value, a swapped identifier, a new import, a new CSS rule) appears in `notes/rebase.md` with its reason.
- Each patch's file list and count are recorded before and after (`PATCH-RULES.md` §8), and every difference is explained. No file drops silently.
- `scripts/check-patch-stacking.mjs` passes. If its list of known pairs changes, each change is explained.
- No patch is renamed, split or merged with another in this sprint. Each header names the new VS Code version.

### R3: The toolchain that comes with the target

As engineering, I want the build environment to match the target exactly, so builds pass VS Code's own Node gate and native code matches its Electron.

Acceptance criteria:

- The repository root `.nvmrc` equals the target's `vscode/.nvmrc` (24.18.0 at 1.142.0). So do the Node pins in all six workflows that carry one (`build-windows.yml`, `build-macos-x64.yml`, `windows-canary.yml`, `windows-test-overlay.yml`, `build-whisper.yml`, `agent-runtime-matrix.yml`), changed in the same commit.
- On the Mac, the Node is arm64, installed by `nvm` from an `arch -arm64` shell. `scripts/validate-build-env.sh` passes. Dev mode and the production build run with that Node under the `arch -arm64 /bin/zsh` wrapper.
- VS Code's `preinstall` gate (the same major as `.nvmrc`, and at least its minor) passes on the Mac, on macOS x64 CI and on Windows CI.
- The Electron version is the one the target's `.npmrc` names (43.7.7 at 1.142.0). The built app reports it.
- The extension builds and tests on the new Node: `npm run compile` (tsc, then esbuild), the webview's `npm run build`, and the extension's unit tests.
- The Node table and build-environment text in `.claude/skills/vscode-development/SKILL.md` are updated.

### R4: Native modules match their architecture and Electron

As engineering, I want native modules checked after the bump, so the terminal, file watching and logging do not die quietly, as in issue #39.

Acceptance criteria:

- In dev, after `npm ci` in `vscode/` with arm64 Node, `scripts/check-native-modules.sh` passes. Its list is derived from the `.node` files that are actually in `vscode/node_modules`, not from a fixed list that skips missing modules. Every `.node` file that is not universal is arm64.
- Stale compiled output of built-in extensions is wiped (step 5 of `update-vscode.sh`, issue #41). The JSON, CSS and HTML language servers start in dev.
- In each built app (darwin-arm64, darwin-x64, win32-x64), every `.node` file has the target's architecture. `scripts/validate-build-output.sh` checks this; today it checks only the agent binaries and Whisper.
- In dev and in the production build, these work: the terminal (`node-pty`), file watching (`@parcel/watcher`), logging (`@vscode/spdlog`) and keyboard layouts (`native-keymap`).

### R5: Windows CI is green with the new toolchain

As Jarmo, I want Windows to build and install from main after the update, so Step 4 starts from a working Windows build.

Acceptance criteria:

- `Build Windows (x64)` passes at the merged main commit, and its installer passes the round trip: install, start, uninstall.
- The three node-gyp layers (memory: VS2026 Windows CI break) are checked again against the target's Node and npm:
  - **Layer 1:** if npm's bundled node-gyp now finds VS2026, the patch step goes; otherwise it stays, re-pinned for Node 24.
  - **Layer 2:** upstream's `build/npm/preinstall.ts` knows VS2026 at 1.142.0 (`vs2026_install`). The `vs2022_install` wiring is removed or renamed to match.
  - **Layer 3:** every `package-lock.json` under `vscode/` is scanned for a local `node-gyp`. Copilot's `ignore-scripts=true` stays only if a shadowing copy is still there.
- `windows-canary.yml` changes in the same commit as `build-windows.yml`, as its drift-prevention comment requires.
- Patch 008 strips the non-Windows binaries again, and packaging (`rcedit`) passes.
- The built app runs on a Windows PC with 2.0's frame (S12).

### R6: The base window matches Step 1's baseline

As Jarmo, I want the window to look exactly as approved in Step 1, so the update changes nothing I did not see.

Acceptance criteria:

- `scripts/qa/frame-screenshots.mjs` (Sprint 132, merge 2) captures its scenes on the updated build, in light and dark, on a fresh profile. The captures are compared with the baseline approved at Sprint 132's merge 2, plus any scenes Steps 2 and 3 added.
- Every difference is listed in `qa/screenshot-diff.md` with its cause and outcome:
  - **fixed**: back to the baseline;
  - **pinned back**: an upstream default pinned in `branding/product.json` `configurationDefaults`;
  - **upstream-forced**: shown to the Experience lead, then to Jarmo.
- The baseline is replaced only after Jarmo approves the new captures (decision D5).
- The Windows captures are compared with those from Sprint 132's last Windows round in the same way.

### R7: 2.0's surfaces work after the move

As engineering, I want the frame's numbers and behaviour proven on the target, so the patches carry the frame and not just compile.

Acceptance criteria:

- `scripts/qa/frame-geometry.mjs` gives the same numbers as at Sprint 132's merge 2 for each scene: normal, left column hidden, both hidden, two desks.
- The VS Code unit tests from patch 019 (`ritemarkPermanentTabs.test.ts`, `ritemarkTerminalTabs.test.ts`), and any that Steps 2 and 3 add, pass on the target.
- The shell scenarios of Sprints 132, 133 and 134 are run again on the updated build. Sprint 132's are listed in [tasks.md](tasks.md); Steps 2 and 3's are added by number at Phase 0.
- Every class selector in `ritemarkSurfaces.css` still matches an element in the target's workbench (the selector audit). Every DOM read left after Sprint 132's E2 still finds what it looks for.

### R8: Nothing is lost, and nothing new and stray appears

As Jarmo, I want everything Ritemark 1.14 and 2.0 can do still reachable, and no new VS Code chrome showing up.

Acceptance criteria:

- Sprint 132's before-and-after inventory (R15, S44) is walked again on the updated build, and every row works.
- A lived-in v1.14.0 profile and a profile from main before the update both open in the updated build with their tabs, terminals, chats, projects and settings. This includes VS Code's own state migrations across the gap.
- Upstream's new ways into chat and agents are found and hidden. The search covers `Codicon.chatSparkle` registrations, `MenuId.TitleBar`, `MenuId.CommandCenter`, the agent sessions views and the status bar. The menus, the strips and the status bar hold what Steps 1–3 left.
- Each new built-in extension is decided: shipped as is, hidden or stripped. At 1.142.0 that is `mermaid-markdown-features` and `theme-modern-icons`, and `mermaid-chat-features` is gone. The rule is "no new visible surface without Jarmo".
- The default-drift scan: every `'default':` added or changed between the pin and the target in `workbench.contribution.ts` (and in the other contribution files that touch chrome) is reviewed. Whatever Ritemark's look depends on is pinned in `branding/product.json` `configurationDefaults`.
- Fields that upstream `product.json` gained since 1.117.0 are merged into `branding/product.json`, which replaces upstream's file whole. No required field is missing (the 1.117 `builtInExtensionsEnabledWithAutoUpdates` crash).

### R9: Ritemark's features that sit on VS Code still work

Acceptance criteria:

- **The integrated browser:** the AI's page context (009), the agent's actions (010) and Browser Recent's navigation pushes. Upstream reworked `browserView`: at 1.142.0, 6 of 009's 8 hunks and 9 of 010's 12 do not apply.
- **The smaller patches:** save receipts (014), the shell watchdog (012), the cloud-file error (011), configuration defaults on desktop (013), the Help menu (015), the store policy (016), and the launch check (017, or what replaces it in Step 2).
- **The extension host on the new Node:**
  - an authenticated Claude Code turn, a Codex turn and the OpenCode permission gate, on darwin-arm64, darwin-x64 and Windows;
  - Flows, PDF and DOCX export, the Office previews, and dictation on the Mac;
  - the Claude Agent SDK's EMFILE preload on Windows;
  - the browser MCP adapter, which runs under `ELECTRON_RUN_AS_NODE`.
- The agent runtime matrix workflow passes.

### R10: A rollback point

As Jarmo, I want one step back to a known-good main, so a bad update never strands 2.0.

Acceptance criteria:

- Before the merge, the release plan records main's last commit on 1.117.0 as the rollback point, together with the clean-room production build check made at that commit (Step 3's build check, or a new one).
- The update lands as one squash commit with the gitlink, the patches, `branding/product.json`, every Node pin and the harness changes. Reverting that commit returns main to a buildable 1.117.0.
- `technical-plan.md` has a rollback recipe, which goes into `SKILL.md`.
- The recipe is rehearsed once before the PR: a scratch branch with the revert starts dev mode on 1.117.0 (S20).

### E1: Drift and the upstream diff are measured

- At the freeze, `scripts/check-vscode-drift.sh <target>` runs on main, and its output goes into `notes/drift.md` with the failing hunks per patch.
- `check-vscode-drift.sh` gains a hunk count, so it reports failing hunks as well as failing files.
- For each file the patches touch, the size of upstream's change from the pin to the target is listed. The audits start from this list.

### E2: The update tooling is fixed

`scripts/update-vscode.sh` predates the shallow submodule and the shared-stash rules:

- Without a tag, it picks the newest tag in the shallow submodule (1.119.0 today). It must require an explicit tag and fetch exactly that tag.
- `--check` runs a bare `git stash` / `git stash pop` and a checkout in the shared submodule. It is replaced by `check-vscode-drift.sh`.
- `git clean -fd` in `vscode/` removes the extension symlink. It keeps it with `-e extensions/ritemark`.
- The checklist it prints gains: the Node pins to change, the default-drift scan, the `product.json` merge, the frame-geometry check, and the screenshot comparison that Sprint 132's E4 adds.

### E3: Builds and docs

- After the merge: a production build from a clean-room release worktree at the merged commit (a build check, not a release), macOS x64 CI, and Windows CI, all green.
- The embedded build provenance names the new gitlink and patch digest.
- Docs updated:
  - `CLAUDE.md`'s patch table (007's purpose line names 1.117);
  - `PATCH-RULES.md`'s table and 003's inventory, which says 14 files where 003 now has 21;
  - `SKILL.md`: the Node table, a pitfalls section for this update, and the rollback recipe;
  - `references/layout-invariants.md`, wherever an enforcing file or symbol moved;
  - `architecture.md`'s history line.

## Non-Requirements

- **A second VS Code update before 2.0 ships.** Only recovery releases of the frozen minor are taken until the release candidate (decision D2).
- **New features or redesigns.** Upstream features that come along are hidden or left as they are, never adopted for their own sake.
- **Renaming, splitting or merging patches.** The domains stay as Sprint 132 left them.
- **Bundled agent runtime updates** (Claude Code, Codex, OpenCode). They wait for Step 4's runtime review.
- **The release itself:** version 2.0.0, notes, notarization (Step 4).
- **The columns coming over the desk**, and anything else the release plan leaves out of 2.0.

## Resolved Questions

- **2026-10-17 (engineering, Sprint 132's plan):** the pin stays at 1.117.0 for Steps 1–3, and one update sprint follows Step 3.
- **2026-10-17 (engineering, on Jarmo's "You decide"):** each Windows round is built from main, with no separate unsigned branch builds. This sprint keeps that (D4).

## Open Questions

Decisions for Jarmo, each with a recommendation, are in [sprint-plan.md](sprint-plan.md#decisions-for-jarmo) (D1–D5).

- **Steps 2 and 3's patches and scenarios** are not planned yet. Phase 0 adds them by name and number.
- **The target** is whatever R1's rule gives on Phase 0 day. Every 1.142.0 number in these documents is the planning-time measurement.
