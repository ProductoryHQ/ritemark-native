---
date: '2026-05-03'
title: ''
author: Jarmo Tuisk
tags:
  - bugfix
  - file-handling
  - agents
---
# Ritemark v1.6.2 — Markdown Defaults + Live External Edits

**Status:** Released (2026-05-03)  
**Type:** Patch release  
**Focus:** Two regressions from v1.6.1 — `.md` files reliably open in Ritemark, and edits made by agents or other tools show up live in the open editor

* * *

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |

> Windows: coming soon — the installer will be added as a follow-up asset on the v1.6.2 release.

* * *

## What's Fixed

### Markdown Files Open in Ritemark Again

In v1.6.1, some users found that `.md` files were opening in a plain text view instead of the WYSIWYG Ritemark editor — especially when launched from Finder or opened as a single file outside a folder workspace.

v1.6.2 restores the expected behaviour: `.md`, `.markdown`, `.csv`, and the rest of Ritemark's supported file types are now registered as the canonical Ritemark editor at the application level. Open a markdown file from anywhere — Finder, the dock, a `open file.md` from terminal, or directly inside a folder — and you land in the Ritemark editor.

If you ever want to peek at the raw markdown source instead, the per-workspace override still works: right-click → **Reopen With** → choose the text editor.

### External Edits Show Up Live in the Editor

When the Ritemark AI panel (Claude Opus, Sonnet, or Haiku) edited the file you were currently viewing, the editor in v1.6.1 would stay on the stale version — you had to manually refresh or restart to see the agent's changes. The same problem affected any external write: Claude Code from outside Ritemark, a terminal `sed`, another editor, anything.

v1.6.2 makes external edits propagate to the open editor automatically:

-   **Clean state (no unsaved local edits):** the editor swaps to the new content silently. No prompt, no flicker — your view just catches up to disk.
    
-   **Dirty state (you have unsaved local edits):** a Refresh banner appears at the top of the document so you can choose to keep your changes or load the new version. If you don't react within 10 seconds, the editor auto-reloads — so agent-driven workflows aren't blocked waiting on a click.
    

This works for any external write to the open file, not just AI panel edits. Agents, terminal commands, file syncing tools, and other editors all trigger the same path.

* * *

## What Didn't Change

No new features, no UX redesign. v1.6.2 is purely a fix release — every other surface behaves the same as v1.6.1.

* * *

## Upgrade

Auto-update will offer v1.6.2 to existing v1.6.1 users on next launch. You can also download the DMG directly from the release page. No settings migration is required.

* * *

## Known Limitations

-   **Standalone single-file mode on macOS:** if you open a totally standalone `.md` file (no surrounding folder workspace at all), VS Code's workspace-level editor association doesn't apply, and the file may still open in plain text. Most files opened from Finder pick up folder context automatically and are unaffected. If you hit this case, **Reopen With → Ritemark** still works, and a permanent fix is on the wishlist for a future sprint.
    

* * *

## Technical Notes

For developers and changelog readers.

**Sprint:** [Sprint 58 — Fix .md customEditor Default + File Watcher Regression](../../development/sprints/sprint-58-md-default-and-file-watcher-fix/sprint-plan.md)

**Commits:**

-   `fb4ec30` — Sprint 58 implementation
    
-   `f466007` — version bump to 1.6.2
    

**Changes:**

-   `branding/product.json` — added `workbench.editorAssociations` to `configurationDefaults`, mapping `*.md`, `*.markdown`, `*.csv` (plus `*.xlsx`, `*.xls`, `*.pdf`, `*.docx`, `*.flow.json`) to their Ritemark editor IDs. This is the canonical VS Code mechanism (used by Draw.io, Jupyter, etc.) and occupies the `defaultValue` precedence slot — user/workspace settings still override it.
    
-   `extensions/ritemark/package.json` — corrected `priority: "exclusive"` → `priority: "default"` on five `customEditor` entries. The `exclusive` value was silently coerced to `default` by VS Code's `CustomEditorPriority` enum (only `'default' | 'builtin' | 'option'` are valid), but the misleading declaration is now gone. Also declared `capabilities.untrustedWorkspaces.supported: true` to keep custom editors active in untrusted contexts.
    
-   `extensions/ritemark/src/ritemarkEditor.ts` — replaced the v1.6.1 `pendingSaves` Set + per-file `FileSystemWatcher.onDidChange` machinery (which raced VS Code 1.117's internal disk-sync) with an `applyingFromWebview` counter + `vscode.workspace.onDidChangeTextDocument` listener + `handleExternalDiskChange` helper. The new path reads the disk directly, dedupes against the in-memory document, and routes to the right webview message. A 3-second `startPolling` fallback covers cases where `onDidChangeTextDocument` doesn't fire (some external write tools), and a 10-second auto-reload timer drives the dirty-state Refresh banner. A slim `FileSystemWatcher` is kept for `onDidDelete` only.
    
-   `extensions/ritemark/webview/src/App.tsx` — handles the new `externalChange` message (silent content swap for clean state) alongside the existing `fileChanged` message (Refresh banner for dirty state).
    

**Upgrade notes:** No breaking changes. No new runtime dependencies. CSV conflict detection (`handleRefresh`, `hasFileChangedOnDisk`, `fileLoadTimes`) is preserved unchanged.

* * *

## Sprints Rolled Up

-   **Sprint 58** — `.md` customEditor default fix + file watcher rewrite (both v1.6.1 regressions)
    

Every great editor knows that watching files is half the battle. This one just happens to watch them really, really well.
