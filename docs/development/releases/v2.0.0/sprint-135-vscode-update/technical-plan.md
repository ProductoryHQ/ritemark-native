# Sprint 135 Technical Plan

The plan for [spec.md](spec.md). Code shapes here are proposals: when the work needs something else, this file changes first. Every 1.142.0 number is the planning-time measurement (18 October 2026, main at `d781a0e1`, patches 001–019). Phase 0 measures again at the frozen target and on main as it is after Step 3.

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| VS Code submodule | The gitlink moves from `10c8e557` (1.117.0) to the frozen target's commit | `vscode` |
| Patches | Every patch is rebased in place. Names, numbers and domains stay as they are | `patches/vscode/*.patch` |
| Branding | New upstream `product.json` fields are merged in; chrome defaults that drifted are pinned in `configurationDefaults` | `branding/product.json` |
| Toolchain pins | Node to the target's `.nvmrc` at the root and in six workflows; the Windows node-gyp workarounds re-checked | `.nvmrc`, `.github/workflows/*.yml` |
| Harness | `update-vscode.sh` fixed; hunk counts in the drift check; native-module checks derived from the files present, in dev and in the built app | `scripts/` |
| Extension | Nothing, unless the new Node or Electron forces a change. Any change is listed under R9 | `extensions/ritemark/` |
| Docs | Patch tables, the Node table, a pitfalls section, the rollback recipe, layout invariants | `CLAUDE.md`, `.claude/skills/vscode-development/`, `docs/development/architecture.md` |

The release tier is **shell**: `vscode`, `patches/`, `branding/product.json`, `.github/workflows/build-*` and several listed scripts all change.

## Starting numbers (planning time)

Patch stack on VS Code 1.142.0, measured two ways:

- **Files:** `check-vscode-drift.sh 1.142.0` dry-applies each patch in a temporary index and excludes each failing file. Result: **15 of 19 patches fail, in 58 file patches**. It agrees with Sprint 132's merge-1 measurement.
- **Hunks:** each patch is applied in order with `git apply --reject` to a sparse checkout of 1.142.0, and the rejected hunks are counted. Hunks that apply stay applied, so a later patch sees its base, as it will in the rebase.

| Patch | Files | Hunks | Hunks rejected | Failing files (temporary-index check) | Note |
|---|---|---|---|---|---|
| 001 branding | 15 | 32 | 10 | 7 | `build/lib/optimize.ts` is gone upstream (core bundling moved to esbuild); 3 Getting Started files, which Step 2 changes |
| 002 placement | 25 | 83 | 22 | 12 | Layout actions, the parts, the title bar, `workbench.contribution.ts`, `terminal.contribution.ts` |
| 003 menus | 21 | 39 | 12 | 8 | Menus, chat status, agent sessions, extension enablement, profiles |
| 004 build system | 4 | 7 | 1 | 1 | `electron-main/app.ts` |
| 005 Windows and OSS | 3 | 5 | 2 | 2 | `build/lib/electron.ts`, `defaultAccount.ts` |
| 006 dev launch | 4 | 4 | 0 | 0 | |
| 007 Copilot Chat compat | 4 | 13 | 7 | 3 | Chat contributions, chat setup, `onboardingVariationA.ts` |
| 008 Windows strip | 1 | 1 | 1 | 1 | `build/.moduleignore` |
| 009 browser context | 4 | 8 | 6 | 2 | `browserView` reworked upstream |
| 010 browser actions | 4 | 12 | 9 | 2 | Same files as 009 (stacked pair) |
| 011 cloud-file error | 1 | 1 | 0 | 0 | |
| 012 shell watchdog | 1 | 5 | 0 | 0 | |
| 013 configuration defaults | 2 | 3 | 1 | 1 | `base/common/product.ts` |
| 014 save receipts | 7 | 16 | 0 | 0 | |
| 015 Help menu | 6 | 14 | 2 | 2 | `menubarControl.ts` and its test (shared with 003) |
| 016 store policy | 1 | 2 | 0 | 1 | Cascade: applies once 001's hunks in `gettingStarted.ts` are in |
| 017 launch check | 1 | 3 | 0 | 1 | Cascade, as 016 |
| 018 surfaces and frame | 29 | 61 | 17 | 12 | `window.ts`, `windowImpl.ts`, `defaultStyles.ts`, `layoutService.ts`, both title bar parts, the sidebar, editor, AI and status bar parts, `overlayWebview.ts`, `menusExtensionPoint.ts` |
| 019 tab row | 13 | 38 | 8 | 3 | `editorGroupView.ts`, `editorTabsControl.ts`, `multiEditorTabsControl.ts` |
| **Total** | | **347** | **98** | **58** | 249 hunks apply as they are, some at an offset |

The toolchain at the pin and at 1.142.0:

| | 1.117.0 (pin) | 1.142.0 |
|---|---|---|
| Node (`.nvmrc`) | 22.22.1 | 24.18.0 |
| Electron (`.npmrc` target) | 39.8.7 | 43.7.7 |
| Server Node (`remote/.npmrc`) | 22.22.1 | 24.21.0 |
| Core bundling | gulp + `build/lib/optimize.ts` | esbuild (`build/lib/esbuild.ts`); `tsgo` type-check in `core-ci` |
| Windows toolchain check (`preinstall.ts`) | VS 2022/2019 folder names only | Knows VS 2026 (`vs2026_install`) |
| Built-in extensions | `mermaid-chat-features` | `mermaid-markdown-features`, `theme-modern-icons`; `mermaid-chat-features` gone |

The raw output is in [notes/drift.md](notes/drift.md).

## Workstream 1: Freeze and measure (R1, E1)

- Read the newest stable release from `gh api 'repos/microsoft/vscode/releases?per_page=10'`, leaving out pre-releases. Resolve its commit with `gh api repos/microsoft/vscode/git/ref/tags/<tag>`.
- Read the target's `.nvmrc`, `.npmrc` and `remote/.npmrc` through the API, without a checkout. Write `notes/freeze.md`.
- Run `check-vscode-drift.sh <target>` on main as it is after Step 3, with the hunk count E1 adds, and record the result in `notes/drift.md`.
- **The upstream diff inventory:** for each file any patch touches, record the size of upstream's change from 1.117.0 to the target. Fetch only those files' blobs: a blob-less clone of both tags plus a sparse checkout, as the drift script does. Files that changed a lot but still apply are listed too, because a clean apply can still hide a changed mechanism (the stylesheet and the DOM reads).
- **A recovery release before the merge (S2):** repeat the dry run on it, and read upstream's diff between the two tags for the patched files. Move only if each new failure is classified as R2 requires.

## Workstream 2: Audits first

Each audit goes in `research/` before the rebase touches the files it covers.

### 2a. The frame on the new layout code (`research/frame-audit.md`)

Patch 018 is where 2.0 adds most to every bump (feasibility §2.3), and at 1.142.0 it fails in 12 of its 29 files. For each 018 and 019 file, read upstream's diff from the pin to the target and sort the changes:

- **Moved lines** around the same mechanism: the rebase is mechanical.
- **A changed mechanism** that 018 hooks into. Candidates: how the main window decides it has no custom title bar (`window.ts`, `layoutService.ts` `shouldShowCustomTitleBar`); the window controls overlay on Windows; placing the traffic lights (`windowImpl.ts`, Electron 43's window button APIs); how parts lay out their content (`sidebarPart.ts`, `auxiliaryBarPart.ts`, `editorPart.ts`, `statusbarPart.ts`); overlay webviews following their sheets (`overlayWebview.ts`); the default styles (`defaultStyles.ts`); menu contributions (`menusExtensionPoint.ts`).
- **Upstream now offers it.** If upstream added a setting or API that does what 018 does by hand (for example a compact or hidden title bar), 018 uses it and drops its own code, as long as the frame's numbers stay the same.

It also covers:

- **The selector audit:** every class in `ritemarkSurfaces.css` (139 rule blocks, nearly all under `.monaco-workbench`, with 99 `!important` at Sprint 132's start) is searched for in the target's `src/`. A class that no longer exists, or that moved to another element, is listed.
- **The DOM reads:** every place where 018 or 019 still reads the DOM's structure (after Sprint 132's E2 replaced the walks it could) is checked against the target.
- **The decision.** For each changed mechanism: carry, re-cut, or adopt upstream's. If a mechanism cannot be carried to the target, the audit names the newest release where it still holds, for decision D3.

### 2b. The toolchain (`research/toolchain-audit.md`)

- Node 24.18.0 arm64 through `nvm`; the npm version that comes with it; VS Code's `preinstall` gate.
- The node-gyp bundled with that npm: does it map VS 2026 (major 18)? This decides Windows layer 1.
- `package-lock.json` files under the target's `vscode/` that pin a local `node-gyp` (layer 3's blast radius).
- What the target's build needs from Xcode, the macOS SDK and Python. The arm64 runners and `macos-15-intel` for x64.
- The esbuild-based core bundle: `build-prod.sh` still calls `npm run gulp vscode-$TARGET`, and at 1.142.0 that task still exists, now running `esbuild-bundle-*` inside. Confirm that every step `build-prod.sh` relies on before and after the gulp task (the extension copy, product.json handling, `ritemarkVersion`, provenance) still finds its inputs.
- Electron 43's breaking changes since 39, read for the APIs that patches 004, 012 and 018 and the extension use.

### 2c. The browser bridge (`research/browser-bridge-audit.md`)

Read upstream's `browserView` changes from the pin to the target (`common/browserView.ts`, `electron-browser/browserView.contribution.ts`, `platform/browserView`). Map 009's page context, 010's actions and Browser Recent's navigation push onto the new code. If upstream now exposes what 009 or 010 adds by hand, use it.

### 2d. New surfaces and defaults (`research/surfaces-audit.md`)

- **New ways into chat and agents:** search the target for `Codicon.chatSparkle` registrations and for contributions to `MenuId.TitleBar`, `MenuId.CommandCenter`, the status bar and the agent sessions views, and compare with the pin.
- **New built-ins:** `mermaid-markdown-features` and `theme-modern-icons` at 1.142.0. What each shows, and whether Ritemark ships, hides or strips it.
- **Default drift:** `git diff 1.117.0..<target>` of `workbench.contribution.ts` and the other contribution files that register chrome settings. List every new or changed `'default':` that touches what people see.
- **`product.json`:** upstream's fields that are new since 1.117.0, and the fields `IProductConfiguration` (`base/common/product.ts`, patch 013) now expects.

## Workstream 3: The rebase, patch by patch (R2)

### The working tree

- The sprint worktree, with `vscode/` from the copy-on-write clone recipe (memory: `cow-clone-vscode-for-worktree-dev`). Fetch the target commit and the pin commit into it (depth 1 each), so both trees' blobs are present.
- Start pristine at the target: reset, then `git clean -fd -e extensions/ritemark`.
- Work on a local scratch branch inside `vscode/`, with one commit per patch, starting from the target. Before any dry run, put `vscode/`'s HEAD back on the target commit with `git reset --soft` (memory: vscode HEAD at the pin for the dry run).

### Per patch, in order 001 → last

1. **Apply with `git apply --3way`.** With the pin's blobs present, git uses each file's `index` line to merge three ways and leaves conflict markers instead of `.rej` files. Hunks that merge cleanly are still listed as "carried".
2. **Resolve each conflict by intent.** Read the patch's header and the hunk's old behaviour. Read the audit for that file. Give each hunk a class in `notes/rebase.md` (the classes are in spec R2).
3. **Commit the patch on the scratch branch.** Regenerate the patch file from the diff between this commit and the previous one. Each patch is then a diff on top of the patches before it, which keeps the stacked pairs (009 → 010, 001 → 016 → 017, 003 → 015) correct by construction. Keep each patch's header, and add one line naming the target version.
4. **Prove the intent.** Compare the `+`/`-` lines of the new patch with main's patch for each file (the awk recipe in the patch rebase classification memory). Every behavioural difference is explained in `notes/rebase.md` or fixed. Count and diff the file list (`PATCH-RULES.md` §8).
5. **Compile early.** Run the type-check after each group of patches: the target's `core-ci` type-check and `npm run compile`. Unused imports fail VS Code's build (`PATCH-RULES.md` §9), and the new type-checker may be stricter.

### What to expect, per patch, at 1.142.0

| Patch | Expected classes | Watch for |
|---|---|---|
| 001 | `.woff2` loader **moved** from `optimize.ts` to the esbuild bundle configuration; resource includes and `build/next/index.ts` **re-based**; Getting Started hunks **dropped, 2.0** if Step 2's welcome replaced them, otherwise re-based | The fonts must reach the production bundle (S30, and a font check in the built app) |
| 002 | Mostly **re-based**; layout toggles and the parts' placement may be **re-cut** | Placement only: no size or drawing comes back into 002 |
| 003 | **Re-based**; chat and agent session hunks may be **re-cut** or **dropped, upstream**; new entry points **added** (S24) | Keep 003's inventory complete (`PATCH-RULES.md` §2, updated to 21 files) |
| 004, 005, 013 | **Re-based** | 013: new product fields (W8) |
| 007 | `onboardingVariationA.ts`: check whether upstream still asserts `defaultChatAgent`; if not, **dropped, upstream** | Copilot Chat still opens only from More, as a tab |
| 008 | **Re-based** against the new `.moduleignore` | Windows packaging (W6) |
| 009, 010 | **Re-cut** onto the reworked `browserView` (audit 2c) | 010's rejects may be partly a cascade from 009 |
| 015 | **Re-based**, after 003 | Its test file too |
| 016, 017 | **Cascade** (apply once 001 is in), or **dropped, 2.0** if Step 2 removed the Getting Started rows | |
| 018 | **Re-based** and **re-cut** per audit 2a | The frame's numbers (W7) |
| 019 | **Re-based**; the tab controls may be **re-cut** | The unit tests (R7) and the folded tabs |

## Workstream 4: The toolchain (R3)

- Change, in one commit: the root `.nvmrc`; `NODE_VERSION` / `node-version` in `build-windows.yml`, `build-macos-x64.yml`, `windows-canary.yml`, `windows-test-overlay.yml`, `build-whisper.yml` and `agent-runtime-matrix.yml`. Then grep the repository for the old version outside `docs/` and `vscode/`.
- Install with `arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm install <version>'`, and confirm with `node -p process.arch` that it is arm64.
- `validate-build-env.sh` already reads `vscode/.nvmrc`. Check that it still passes, and that it fails on Node 22 and on x64 (S7).
- In `vscode/`: `npm ci` under the wrapper, then the compile. In the extension: `npm ci`, `npm run compile`, the webview's `npm run build`, and the unit tests.
- `SKILL.md`: the Node table. The webview line ("Node v20") is checked on Node 24 and corrected.

## Workstream 5: Native modules (R4)

- `check-native-modules.sh`: derive the list from `find vscode/node_modules -name '*.node'`. Skip universal binaries (both architectures in `file`'s output) and modules that build only for Windows. Fail on any module that is not arm64. Keep printing the `npm rebuild` fix.
- `update-vscode.sh`'s step 5 (wiping built-in extensions' `out/`) stays. Its step 6 runs the new check.
- `validate-build-output.sh`: a new check of every `.node` file inside the built app, for the target's architecture: arm64 or x86_64 by `file` on the Mac, and the PE machine type on Windows, as the script already does for agent binaries.
- In dev and in the production build: the terminal, file watching, logging and keyboard layouts (S10).

## Workstream 6: Windows CI (R5)

- Apply audit 2b's findings to `build-windows.yml` and, in the same commit, to `windows-canary.yml`:
  - **Layer 1:** drop the node-gyp swap if npm's bundled node-gyp finds VS 2026. Otherwise re-pin it to a node-gyp that supports Node 24, and keep the version guard.
  - **Layer 2:** replace `vs2022_install` with `vs2026_install` if the target's `preinstall.ts` needs it, or remove the wiring if detection works on its own.
  - **Layer 3:** keep copilot's `ignore-scripts=true` only if the target's copilot lockfile still pins a local node-gyp.
- `windows-test-overlay.yml` gets the new Node pin. Its overlay carries extension files only, so it cannot test this sprint's shell changes.
- Windows CI builds only canonical `origin/main` (`build-windows.yml` verifies it), so the first Windows build of the update runs after the merge (decision D4). It needs the usual repository-visibility toggle.
- On a Windows PC: S12, S27, S29.

## Workstream 7: The frame against the baseline (R6, R7)

- `frame-geometry.mjs` on dev mode, each scene, compared number by number with the JSON from Sprint 132's merge 2 (`sprint-132-surfaces-and-frame/qa/frame-geometry-*.json`, updated at merge 2).
- `frame-screenshots.mjs` on a fresh profile, light and dark, compared with the approved baseline. The dev instance follows the CDP isolation rules: its own port and profile, launched without taking focus (memories: dev-instance CDP isolation, no pop-up test windows).
- **Each difference** gets a row in `qa/screenshot-diff.md`: the scene, before, after, the cause, and the outcome (fixed, pinned back, or upstream-forced). Pinnable causes are pinned before anything goes to the Experience lead.
- **Upstream-forced differences** go to the Experience lead with the screenshots, then to Jarmo. The baseline is replaced in the same PR only after Jarmo's yes (D5).
- **Windows:** the same comparison on the Windows build from main against the last Windows round's captures, after the merge.

## Workstream 8: Nothing lost, nothing stray (R8)

- Walk Sprint 132's before-and-after inventory again.
- Open S23's two profiles, each copied into a scratch user-data directory first.
- Apply audit 2d:
  - hide new chat and agent entry points in 003, or in 007 for Copilot Chat;
  - ship, hide or strip each new built-in (stripping goes where Copilot's is stripped today);
  - pin drifted chrome defaults in `branding/product.json` `configurationDefaults` (live on desktop through patch 013);
  - merge new upstream `product.json` fields into `branding/product.json`.
- Update `PATCH-RULES.md` §3–§7's expected states where 2.0 changed them, so the checklist describes 2.0 and not 1.x.

## Workstream 9: Ritemark's features on VS Code (R9)

- Apply audit 2c to 009 and 010, then run S26.
- **The extension host on Electron 43's Node:**
  - S27 on darwin-arm64 in dev, and on darwin-x64 and Windows with the CI builds after the merge;
  - the agent runtime matrix workflow;
  - Flows (the `flow-testing` skill's mock suite), PDF and DOCX export, the Office previews, dictation;
  - the browser MCP adapter started by OpenCode under `ELECTRON_RUN_AS_NODE`.
- **On Windows:** S29 for the Claude Agent SDK's EMFILE preload. The preload wraps `fs.promises`, and Node 24 may have changed what it wraps.

## Workstream 10: Tooling (E1, E2)

- **`check-vscode-drift.sh`:** add a hunk count. After the file pass, apply each patch with `--reject` in the sparse checkout, as the planning measurement did, and print the rejected hunks next to the failing files.
- **`update-vscode.sh`:**
  - require an explicit tag, and fetch exactly that tag (`git fetch --depth 1 origin tag <tag>`);
  - replace `--check` with a call to `check-vscode-drift.sh`, so no stash and no checkout happen in the shared submodule;
  - `git clean -fd -e extensions/ritemark`;
  - the printed checklist: the Node pins, `npm ci` under the arm64 wrapper, the native-module check, the default-drift scan, the `product.json` merge, the frame-geometry check, the screenshot comparison.
- Both scripts are on the shell-tier list. They change in this sprint's PR, and the release-tier denylist does not change.

## Workstream 11: The rollback point (R10)

- **Before the PR:** record main's last 1.117.0 commit and its clean-room build check in the release plan's tracker. If Step 3's build check was made at an earlier commit, make a new one at the PR's base.
- **One squash merge** carries everything. No other shell-tier PR merges between the update's merge and its green production build and Windows CI (D4).
- **The recipe**, which goes into `SKILL.md`:

  ```bash
  git revert <update squash commit>        # in a PR, after Jarmo's yes
  nvm use                                  # back to the root .nvmrc (22.22.1)
  git -C vscode reset --hard HEAD && git -C vscode clean -fd -e extensions/ritemark   # the update's patches off first
  git submodule update vscode              # the 1.117.0 gitlink (refuses while patches are applied; S20 found it)
  git -C vscode clean -fd -e extensions/ritemark
  arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use && cd vscode && npm ci'
  ./scripts/apply-patches.sh
  ./scripts/check-native-modules.sh
  ```

  Plus the `out/` wipe of `update-vscode.sh`'s step 5. Each developer worktree with its own `vscode/` needs the same, or a new copy-on-write clone.
- **The rehearsal (S20):** on a scratch branch before the PR. The scratch branch is never pushed.
- **When to roll back:** if main's production build, Windows CI or a Gate-level scenario (the frame, a runtime turn, saving) cannot be made green by a fix-forward PR, the session asks Jarmo to roll back. Once Step 4's release candidate is cut, the rollback point no longer applies; the clean-room rules govern from then on.

## Delivery plan: one merge

The gitlink, the patches and the Node pins cannot land apart: VS Code 1.117.0's `preinstall` refuses Node 24, and the target's refuses Node 22. So the sprint merges once.

1. **On the branch, in this order:** the freeze and audits; the tooling fixes (W10, testable on 1.117.0); the toolchain commit; the rebase, one commit per patch; branding and defaults; the native-module checks; the Windows workflow changes; docs. Then the Mac checks in dev: W7, W8 and W9, plus S5, S8 and S20.
2. **The PR**, with the screenshot diff and Jarmo's baseline approval (D5) linked. pr-reviewer and qa-validator run. It merges only with Jarmo's admin-merge yes.
3. **After the merge:** the clean-room production build at the merged commit (S30), macOS x64 CI, Windows CI and a Windows PC round (S11, S12, S27, S29). Main stays closed to other shell-tier merges until these are green, or until the rollback.

## Risks inside the sprint

| Risk | Severity | Retirement |
|---|---|---|
| Upstream changed the layout code 018 relies on (the title bar, window controls, the parts' layout), so the frame cannot be carried by rebasing | High | Audit 2a first, file by file. Adopt upstream's mechanism where it gives the same numbers. If a mechanism cannot be carried, step back to the newest release where it holds (D3). The geometry and screenshot checks prove the result |
| The stylesheet and the DOM reads break with no apply error | High | The selector audit before any screenshot; the screenshot comparison on a fresh profile in both themes |
| Node 24 and Electron 43 change behaviour the extension relies on (child processes, `fs`, ESM loading, the EMFILE preload) | Medium | W9 on all three targets; the runtime matrix |
| Windows CI breaks in a new way with the new Node, npm and node-gyp | Medium | Audit 2b before the merge; the three-layer rule; the canary changes in the same commit; the rollback point |
| A production-only crash, as in 1.117 (`onboardingVariationA`, chat setup, `builtInExtensionsEnabledWithAutoUpdates`) | Medium | The `product.json` merge (W8); the target's minified `core-ci` compile before the PR; the production build right after the merge, with main closed to other shell merges |
| The browser bridge (009, 010) needs a re-cut onto a reworked `browserView` | Medium | Audit 2c; S26 |
| An upstream default changes Ritemark's look only on fresh profiles | Medium | The default-drift scan; every check on a fresh profile |
| A recovery release lands mid-sprint and moves the files under the rebase | Low | S2: dry-run and diff first; move only if every new failure is classified |
| Steps 2 and 3 add patches or scenarios that this plan does not list | Low | Phase 0 adds them by name and number before the rebase starts |
| The rebase hides a one-line intent change inside a hunk (Sprint 55) | Medium | The hunk-level diff of every patch against main's (R2) |
