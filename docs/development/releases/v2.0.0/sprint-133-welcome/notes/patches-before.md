# Patches before Sprint 133 (PATCH-RULES.md §8)

Recorded 2026-10-18 on `sprint-133-welcome` at `9b5ef30a` (main `de2b7d6b`), VS Code at the pin `10c8e557` (1.117.0).

## The starting tree

- `vscode/` copy-on-write cloned from the `s44-fixes` worktree (same gitlink, no `patches/` diff against `de2b7d6b`), then `git -C vscode reset --hard HEAD`, `git -C vscode clean -fd -e extensions/ritemark` and `./scripts/apply-patches.sh`.
- Patches 001–019: 19 applied, 0 skipped, 0 failed. A second run: every patch "Already applied", 0 failed. `git -C vscode status --short`: 160 entries.
- `npm run transpile-client` (4 s) and `npm run compile-check-ts-native` (6 s): both exit 0.
- Pre-commit validator by hand (`CLAUDE_PROJECT_DIR="$PWD"`): passed; stacking check "19 patches, no hunk builds on another patch's lines outside the known pairs".

## The patches this sprint changes

Counted by `+++` lines (016's second file has no `diff --git` header, so `grep '^diff --git'` undercounts it).

| Patch | Files | Hunks | Lines | sha256 (first 16) |
|---|---|---|---|---|
| `001-ritemark-branding.patch` | 15 | 32 | 1,393 | `b392eada7896db91` |
| `016-ritemark-store-acquisition-policy.patch` | 2 | 2 | 105 | `79ced4019f40209c` |
| `017-ritemark-launch-check-node.patch` | 1 | 3 | 68 | `17737aa81c874681` |
| `018-ritemark-surfaces.patch` | 36 | 70 | 3,625 | (gains hunks; not shrunk) |

### 001's files and hunks

| Hunks | File | Getting Started? |
|---|---|---|
| 1 | `build/gulpfile.vscode.ts` | no |
| 2 | `build/lib/optimize.ts` | no |
| 1 | `build/next/index.ts` | no |
| 1 | `src/vs/base/browser/ui/codicons/codicon/codicon.css` | no |
| 2 | `src/vs/code/electron-browser/workbench/workbench.ts` | no |
| 2 | `src/vs/platform/dialogs/electron-browser/dialog.ts` | no |
| 1 | `src/vs/platform/theme/common/iconRegistry.ts` | no |
| 1 | `src/vs/platform/theme/electron-main/themeMainServiceImpl.ts` | no |
| 1 | `src/vs/workbench/browser/media/style.css` | no |
| 1 | `src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts` | no |
| 3 | `src/vs/workbench/browser/parts/editor/media/editortitlecontrol.css` | no |
| 2 | `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts` | yes (audit) |
| 10 | `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` | yes |
| 3 | `src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css` | yes |
| 1 | `src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStartedGuide.css` (created) | yes |

### 016's files and hunks

| Hunks | File | Getting Started? |
|---|---|---|
| 1 | `extensions/git/package.nls.json` | no (Source Control, stays) |
| 1 | `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` | yes |

### 017's files and hunks

| Hunks | File | Getting Started? |
|---|---|---|
| 3 | `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` | yes (the whole patch) |

The research audit (`research/getting-started-retirement-audit.md`) sorts each hunk; `patches-after.md` is compared against this file at the end of W2.
