# PR 4's checks: the shell patches (R7, R8, R9)

1–2 November 2026, on the Mac, branch `sprint-146-controls-shell` from `origin/main` at `8aa08f99`. What the checks found is in [file-changes-audit.md](file-changes-audit.md) (A6), [tab-menu-audit.md](tab-menu-audit.md) (A7) and [hover-row-audit.md](hover-row-audit.md) (A8).

## The tree

- **VS Code 1.142 at the pin `d956e8a6`**, a copy-on-write clone of a sibling worktree's 1.142 tree (with its `node_modules` and `.build/electron`), made its own repository with the pin fetched (`--depth 1`), reset to the pin and cleaned (`git clean -fd -e extensions/ritemark`). `main`'s 19 patches applied with `./scripts/apply-patches.sh`; that state was kept on a local branch (`main-patched`) as the "before". The main checkout's own `vscode/` is 1.117 and wasn't used.
- **Built-in extensions:** the cloned tree had no compiled `out/` for them, so on the first launch the Git extension never started (File changes said "Scanning folder…" for good). `npm run gulp compile-extensions` compiled them, and `main`'s runs were taken again on a fresh profile after it.
- **Electron:** the clone's `.build/electron` is 43.8.3; patch 020 now asks for 43.8.6. The runs here used 43.8.3, which changes nothing PR 4 touches (CSS, strings, a menu).
- **The patches:** `./scripts/create-patch.sh` writes a new numbered patch from `git diff <file>`; each changed file's section came out of it as `021-…` and was moved into the patch that owns the file (016, 018, 019), in path order, and the temporary patch removed. Then the tree was reset to the pin and cleaned again, the new stack applied from scratch, and the result compared with the hand-edited tree: identical (no file differs), and against `main-patched` only the six files below differ. A second `apply-patches.sh` skipped all 19 (already applied).

| Patch | File | What |
| --- | --- | --- |
| 016 | `extensions/git/package.nls.json` | The lead's words for every Git welcome state (R7) |
| 016 | `extensions/github/package.json` | The two Publish to GitHub welcome entries removed (R7, decision 4) |
| 018 | `src/vs/workbench/browser/media/ritemarkSurfaces.css` | No outline on a view's welcome words after a mouse open (R7); the left column's slider one tone over a row (R9) |
| 019 | `src/vs/workbench/browser/parts/editor/editorTabsControl.ts` | The tab's menu passes through the filter (R8) |
| 019 | `src/vs/workbench/browser/parts/editor/ritemarkTabMenu.ts` (new) | The filter (R8) |
| 019 | `src/vs/workbench/test/browser/parts/editor/ritemarkTabMenu.test.ts` (new) | Its test |

## Results

| Check | Result |
| --- | --- |
| `./scripts/apply-patches.sh --dry-run` (vscode's HEAD at the pin) | 19 of 19 can apply, 0 conflicts |
| `node scripts/check-patch-stacking.mjs` | OK: no hunk builds on another patch's lines outside the known pairs |
| A real apply from the pin, then a re-run | 19 applied; then 19 skipped; the tree equals the hand-edited one |
| `npm run typecheck-client` (in `vscode/`) | passes |
| `./scripts/test.sh --grep Ritemark` (in `vscode/`) | 62 passing, 0 failing (5 new: `Ritemark tab menu`) |
| `npm run eslint --` the three TypeScript files | clean |
| `node build/stylelint.ts` | exit 0; `ritemarkSurfaces.css` keeps only its old "unknown variable" notes for the `--rm-*` and `--vscode-ritemark-*` tokens (the new lines read `--rm-ground` like the others) |
| The frame: `frame-screenshots.mjs` on `main`'s tree, then `--compare` with it on PR 4's | 0 of 34 scenes differ (Home 0.09%, Ritemark Settings' foot 0.01–0.02%: the times and the swapped "last changed" documents the baseline's README names; everything else 0%); **JOINS ok in 34 of 34 on both** |
| `frame-geometry.mjs` | 34 PASS, 0 FAIL on both, and the same two SKIPs on both ("tab 1's/tab 2's label sits on the line": no label measured) |

The frame was compared with `main`'s own capture, not with `docs/development/frame-baseline/`: the launches isolate the AIs' homes, so the AI's sheet shows its sign-in, and every scene differs from the 2.0 baseline by about 8% for that alone (the release plan's Risks). The joins pass doesn't depend on the baseline.

## The launches

Five hidden dev launches, each quit afterwards and its profile deleted: `open -n -g -j` of the clone's dev Electron, `--use-mock-keychain`, a short profile under `/private/tmp/claude-501/`, its own extensions and shared-data folders, scratch `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `XDG_*`, no bundled agents in the worktree and no AI command-line tool on the PATH, the three backgrounding flags, CDP on 9361–9364 (each checked free first; each listener was the instance's own). Nothing was signed in. `document.hasFocus()` was false in each when first read.

1. `main`, Git on the PATH: dropped after the Git extension was found not compiled.
2. `main`, Git on the PATH, a fresh profile: the frame capture and geometry, A6's places and File changes, A7's menus, A8's rows.
3. `main`, no Git on the PATH (`/usr/bin` and `/usr/local/bin` left out): File changes with no Git.
4. PR 4, Git on the PATH, a fresh profile: the frame compare and geometry, the same audits, All commands, Show in Documents, Git turned off, Set up Git here, closed and Open it again.
5. PR 4, no Git on the PATH: File changes with no Git.

## Not run here

- **Windows**: no Windows build of a branch here (Windows CI builds only `main`). Gate 2 on 2.2's candidate: File changes on a PC without Git (S43), a tab's menu (S47), the hovered row at 100%, 125% and 150%.
- File changes' `empty`, `workspace`, `emptyWorkspace`, parent-folder and unsafe states on screen (their words are in the patch); a Word tab's menu (no `.docx` in the sample); Search's slider over a row (its results didn't overflow).
- A production build: Add File to Chat shows only while chat is on; the filter drops it either way.
