# Patch Rules -- Lessons from the Consolidation Disaster

This document captures hard-won knowledge from the patch consolidation incident where 38 of 45 patched files were silently lost during a merge of patch 007 into patch 003, causing a full day of UI regressions.

---

## 1. Patch Architecture (Current State)

Eighteen patches, numbered 001 through 019 (017 retired with the Getting Started page in Sprint 133), each owning a specific domain:

| Patch | Domain | Summary |
|-------|--------|---------|
| `001-ritemark-branding.patch` | Branding | Theme, fonts, icons, about dialog, breadcrumbs; Help: Welcome opens Ritemark's welcome; the Phosphor font declared once, in codicon.css (Sprint 145) |
| `002-ritemark-ui-layout.patch` | UI Layout | Sidebar, titlebar, tabs, explorer, panels, Cmd+B removal; the AI column restored with the layout (Sprint 145) |
| `003-ritemark-menu-cleanup.patch` | Menu Cleanup + OSS Fixes | 26 files -- Selection/Go/Terminal/Run menus hidden, Edit menu cleaned, Chat/Debug hidden, the palette's developer commands left out, the Agents window closed, no agent host prewarm, defaultChatAgent null-safety |
| `004-ritemark-build-system.patch` | Build System | jschardet, microphone permission, integrity check skip; packaging skips the built-in Copilot's SDK shim when a build from source has stripped the SDK, and product.json names Ritemark's source commit (`RITEMARK_SOURCE_COMMIT`; the commit reader also follows a gitdir file) (Sprint 135) |
| `005-ritemark-windows-and-oss-fixes.patch` | Windows + OSS | Windows-specific and OSS compatibility fixes |
| `006-ritemark-dev-launch-fallback.patch` | Dev Launch | Development launch fallback behavior |
| `007-ritemark-vscode-1117-compat.patch` | Compatibility | Copilot Chat compatibility (since 1.117; rebased onto 1.142): the narrow setup actions instead of `ChatSetupContribution`, the onboarding module's fallback, the Copilot Chat launcher opens Copilot Chat as a tab; `webviewEditor.ts` opens a custom editor with no options (upstream's later fix, Sprint 135) |
| `008-ritemark-windows-binary-strip.patch` | Windows packaging | Strips the Claude Agent SDK's non-Windows native binaries (upstream strips Copilot's itself since 1.142) |
| `009-ritemark-browser-context-bridge.patch` | Browser | The active browser tab's context for AI chat; navigation pushes for Browser Recent |
| `010-ritemark-browser-action-bridge.patch` | Browser | AI agent actions in the integrated browser; the bar: no Add Element to Chat, Developer tools in ⋯ (Sprint 135) |
| `011-ritemark-cloud-file-error.patch` | Windows | OneDrive/SharePoint cloud-file read errors |
| `012-ritemark-shell-watchdog.patch` | Updates | Quarantines a broken user-dir extension copy |
| `013-ritemark-configuration-defaults.patch` | Defaults | product.json `configurationDefaults` on desktop |
| `014-ritemark-save-receipts.patch` | Saving | Text-file save receipts; a save refused as newer goes to Ritemark first when its editor holds the document (Sprint 137, #454); a reload of such a clean document asks Ritemark first and takes its merge (Sprint 145, #588) |
| `015-ritemark-help-menu-policy.patch` | Menus | The Help menu focused on Ritemark, with Getting started, Support and Send feedback |
| `016-ritemark-store-acquisition-policy.patch` | Store policy | No external software-acquisition promotion (Source Control's Git download button); File changes' Git welcome words, Ritemark's, and no Publish to GitHub paragraph (Sprint 146) |
| `018-ritemark-surfaces.patch` | The 2.0 frame | No title row, strips, sheets and gaps, zoom, Ritemark's menus, the left column's head, the welcome alone, a file's extension muted, File changes as Source Control's name, the desk's whole edge (sizes, drawing and names); a switch lands on Home, a loading column shows the ground (Sprint 145); no outline on a view's welcome words after a mouse open, the left column's slider one tone over a row (Sprint 146) |
| `019-ritemark-tab-row.patch` | The 2.0 tab row | Tab sizes, the +, folded tabs, permanent tabs, terminals as tabs, an empty desk's tiles, a restored task tab's title; restored terminals wait for a document (Sprint 145); a tab's menu without VS Code's items, and Show in Documents (Sprint 146) |

**Rule:** Patches must not overlap in domain. Two patches may touch one file (002 and 018 share `titlebarPart.ts`,
`auxiliaryBarPart.ts` and `paneCompositePart.ts`: placement and drawing), but no hunk may build on another patch's
lines outside the known pairs; `scripts/check-patch-stacking.mjs` (pre-commit Check 14) enforces it. A patch
may also use what an earlier one adds without sharing its lines, which the check cannot see; the later patch's
header names it (018 uses the `ICommandService` that 007 injects into `paneCompositeBar.ts`). For 002, 018
and 019, a change goes in the patch that owns its kind: placement, the frame's sizes and drawing, or the tab row
(`references/layout-invariants.md`).

---

## 2. Patch 003 Complete File Inventory (26 Files)

This is the authoritative reference (VS Code 1.142.0, Sprint 135). If ANY file is missing after a future patch change, it is a regression.

| # | File Path | What It Does |
|---|-----------|-------------|
| 1 | `extensions/git/package.json` | Removes Git's "Clone Repository" welcome view from Documents (the explorer). |
| 2 | `src/vs/editor/contrib/comment/browser/comment.ts` | Removes Toggle Line Comment and Toggle Block Comment from the Edit menu. Removes `MenuId` import. |
| 3 | `src/vs/platform/actions/common/actions.ts` | Adds `MenubarViewMenuAdvanced` MenuId for the View ▸ Advanced submenu. |
| 4 | `src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts` | Null-safety: `defaultChatAgent?.extensionId` (OSS builds may lack it). |
| 5 | `src/vs/platform/extensionManagement/common/extensionGalleryService.ts` | Null-safety: `defaultChatAgent?.extensionId` in gallery filtering and deprecation logic. |
| 6 | `src/vs/platform/windows/electron-main/windowsMainService.ts` | Sprint 135: no Agents window. `openAgentsWindow` opens a normal window in Ritemark (`--agents`, agent links, tryout hand-offs). |
| 7 | `src/vs/workbench/browser/actions/workspaceActions.ts` | Hides the workspace (`.code-workspace`) items from the File menu. |
| 8 | `src/vs/workbench/browser/parts/editor/editor.contribution.ts` | Hides File ▸ Share (vscode.dev links) and View ▸ Editor Layout. |
| 9 | `src/vs/workbench/browser/parts/titlebar/menubar.contribution.ts` | Hides the Selection, Go and Terminal menus (moved here from `menubarControl.ts` at 1.142). |
| 10 | `src/vs/workbench/contrib/chat/browser/agentSessions/experiments/agentSessionsExperiments.contribution.ts` | Hides the Agents and Chat entries in the command center and the title bar. |
| 11 | `src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts` | Keeps the Chat view out of the AI column's default; registers the Copilot Chat launcher's container; no Chat entry in the View menu (007 opens Copilot Chat as a tab). |
| 12 | `src/vs/workbench/contrib/chat/browser/chatStatus/chatStatusEntry.ts` | Hides the Copilot status bar entry: `update()` disposes it. |
| 13 | `src/vs/workbench/contrib/chat/common/constants.ts` | Sprint 135: `OPEN_AGENTS_WINDOW_PRECONDITION` is false, so no command, button or shortcut opens the Agents window. |
| 14 | `src/vs/workbench/contrib/debug/browser/debug.contribution.ts` | Hides the Run menu and View ▸ Run; the debug container hides when empty and its welcome view never shows. |
| 15 | `src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts` | Removes Emmet: Expand Abbreviation from the Edit menu. |
| 16 | `src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts` | Null-safety: `defaultChatAgent?.extensionId` in uninstall logic. |
| 17 | `src/vs/workbench/contrib/files/browser/fileActions.contribution.ts` | The File menu's New Document and New Table; hides Revert File. |
| 18 | `src/vs/workbench/contrib/outline/browser/outline.contribution.ts` | No Outline section in Documents. |
| 19 | `src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts` | All commands leaves out VS Code's developer and debugging commands (`isHiddenFromRitemarkPalette`; Sprint 134), and from Sprint 135 the Agents window's commands and 1.142's new Developer commands. |
| 20 | `src/vs/workbench/contrib/quickaccess/test/browser/ritemarkPalettePolicy.test.ts` | The palette filter's test. |
| 21 | `src/vs/workbench/contrib/timeline/browser/timeline.contribution.ts` | No Timeline section in Documents. |
| 22 | `src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts` | No File ▸ New Window with Profile. |
| 23 | `src/vs/workbench/contrib/welcomeViews/common/newFile.contribution.ts` | New File… is palette-only, not in the File menu. |
| 24 | `src/vs/workbench/services/agentHost/electron-browser/agentHostService.ts` | No agent host prewarm at window start (Sprint 135 E5): with a commit in product.json it started GitHub's Copilot runtime in every window; the agent host starts only when something asks for it. |
| 25 | `src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts` | Null-safety on `defaultChatAgent`; skips the built-in chat extension's enablement migration (`ensureChatExtensionInitialDisabledState` is empty), so a Marketplace Copilot Chat is never disabled behind the person's back. |
| 26 | `src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts` | Null-safety: the same `extensionId?.toLowerCase()` pattern as #25. |

**Verification command:**
```bash
grep '^diff --git' patches/vscode/003-ritemark-menu-cleanup.patch | wc -l
# Must show: 26
```

---

## 3. Menu Bar Expected State

Ritemark 2.0 on VS Code 1.142 (Sprint 135's QA read the menus from the data the workbench sends to the Mac's menu bar, `lastKnownMenubarData` in the profile's `storage.json`). On Windows the same menus open from the menu button on the left column's strip (018).

| Menu | Visible? | Notes |
|------|----------|-------|
| Ritemark (app menu) | YES | macOS app menu |
| File | YES | Includes File ▸ New tab, Switch project and Share (`ritemark/fileMenu`, 018) |
| Edit | YES | Cleaned: no Toggle Comment, no Block Comment, no Emmet Expand Abbreviation (003) |
| Selection | NO | Removed in `menubar.contribution.ts` (003) |
| View | YES | Cleaned: no Appearance submenu, no Editor Layout, no Extensions, no Run; Copilot Chat only while it is installed and not disabled (003, 007) |
| Go | NO | Removed in `menubar.contribution.ts` (003) |
| Run | NO | Removed (`debug.contribution.ts`, 003) |
| Terminal | NO | Removed in `menubar.contribution.ts` (003) |
| Window | YES | macOS's own |
| Help | YES | Getting started, Support, View License, Advanced ▸ Toggle Developer Tools; anything else upstream adds stays hidden (015) |

---

## 4. The Strips (no title row)

2.0 has no title row on the Mac or on Windows (018). The top line is three 44-high strips, every control centred on the line at 26.

| Element | Where | Notes |
|---------|-------|-------|
| macOS traffic lights | Left column's strip | Placed by 018 (`windowImpl.ts`, `window.ts`) |
| Left column toggle | Left column's strip; the desk's strip when the column is hidden | 018 |
| Home and Task board tabs, the document tabs, "N ⌄", the + | The desk's strip | 019 |
| AI toggle, You | The AI's strip | You is a menu: Settings ⌘, and Help (018) |
| Windows minimize, maximize, close | Right end of the AI's strip | 018 |
| Chat sparkle, Accounts, layout controls, Copilot entries in the command center | NO | 002, 003 |

---

## 5. Places Row Expected State

| Item | Visible? | Notes |
|------|----------|-------|
| Home, Documents, Tasks, Browser, Agents, Transcribe | YES, in this order | The row on top of the left column (002) |
| More | YES | Copilot Chat (while installed and not disabled, opens as a tab, 007), Search, File changes, Extensions, then other extensions' places (002) |
| Run and Debug | NO | `hideIfEmpty: true` + welcome view condition `'never-show'` (003) |
| VS Code's Agents window | NO | Its precondition is false (003) |

---

## 6. Status Bar Expected State

| Element | Visible? | Notes |
|---------|----------|-------|
| Word count, AI Ready, Report AI issue, notifications | YES | The extension's items and the bell |
| Copilot icon | NO | `chatStatusEntry.ts` disposes the entry (003) |
| Remote indicator, problem counts | NO | Hidden by 018's stylesheet (`ritemarkSurfaces.css`); Problems stays in the View menu |

---

## 7. Keybinding Overrides

| Keybinding | Default VS Code Behavior | Ritemark Behavior | Enforced By |
|------------|--------------------------|-------------------|-------------|
| Cmd+B | Toggle sidebar | Bold text (TipTap) | Patch 002 removes the keybinding |
| Ctrl+Alt+I (⌃⌘I) | Open Chat | Copilot Chat as a tab, and nothing without a usable Copilot Chat | 007 |
| Cmd+T / Ctrl+T | Go to Symbol in Workspace | The + of the desk in front (`ritemark.newTab`) | 019 |
| Ctrl+` | Toggle the terminal panel | A new terminal tab (`workbench.action.createTerminalEditor`) | 002 removes the toggle; the extension's `package.json` binds the new tab |

---

## 8. Consolidation Rules (NEVER VIOLATE)

These rules exist because violating them caused a full day of regressions.

### Before consolidation

1. **Count files in old patch:** `grep '^diff --git' patches/vscode/OLD.patch | wc -l`
2. **List every file in old patch:** `grep '^diff --git' patches/vscode/OLD.patch`
3. **Save these counts and lists** -- you will compare against the new patch.

### During consolidation

4. **For EVERY file in the old patch, verify the change is preserved in the new patch.** Do not assume any change is "handled by another patch" without explicitly checking.
5. **Never silently drop files.** If a file is intentionally removed, document why.
6. **Test-apply before committing:** `git apply --check patches/vscode/NEW.patch`

### After consolidation

7. **Count files in new patch** and compare against the sum of old patches.
8. **Diff the file lists** -- old vs new. Every file must be accounted for.
9. **Test the FULL UI** (see Section 10 below).

### Why this matters

The consolidation disaster happened because `git diff` was run on a subset of files, silently dropping 38 of 45 patched files. There was no validation step to compare old vs new file counts. The loss was not detected until visual testing revealed menus reappearing, keybindings breaking, and sidebar icons returning.

---

## 9. Common Build Failures

### "declared but never read"

VS Code's strict TypeScript build treats unused imports and variables as errors. The build takes approximately 22 minutes, so catching these early is critical.

**When commenting out code in patches:**
- ALWAYS remove imports that become unused
- ALWAYS remove variables/methods that become unused
- Check for cascading unused references (removing one call may leave its imports unused)

### Suppressing unused errors

| Technique | Works? | Example |
|-----------|--------|---------|
| Remove the import | YES | Delete the import line entirely |
| `void variable;` | YES | `void chatViewContainer;` |
| Underscore prefix on constructor DI params | YES | `private readonly _statusbarService` |
| Underscore prefix on local variables | NO | Does NOT suppress in VS Code's build config |

### `out/` directory gotcha

In dev mode (`./scripts/code.sh`), VS Code serves from `out/`, not `src/`. TypeScript auto-compiles to `out/`, but CSS and static assets do NOT auto-copy. After editing CSS or adding fonts, you must manually copy them:
```bash
cp src/vs/path/to/file.css out/vs/path/to/file.css
```

### Numeric constants in `out/`

Compiled JS in `out/` uses numeric constants instead of enum names:
- `KeyMod.CtrlCmd | KeyCode.KeyB` becomes `2048 | 32`
- When debugging keybinding issues in `out/`, remember to decode these values

---

## 10. Testing Protocol After Any Patch Change

Before declaring ANY patch change complete, verify ALL of the following. Do not skip items.

### Menu Bar Checklist (§3)

- [ ] File menu visible, with New tab first, Switch project after Open Folder…, Share after Save
- [ ] Edit menu visible, NO Toggle Comment, NO Block Comment, NO Emmet
- [ ] Selection menu NOT visible
- [ ] View menu visible, NO Appearance submenu, NO Editor Layout submenu, NO Extensions, NO Run
- [ ] Go menu NOT visible
- [ ] Run menu NOT visible
- [ ] Terminal menu NOT visible
- [ ] Window menu visible
- [ ] Help menu: Getting started, Support, Send feedback, View License, Advanced ▸ Toggle Developer Tools

On the Mac the menus can be read from the profile's `storage.json` (`lastKnownMenubarData`) without opening them.

### Strips Checklist (§4)

- [ ] No title row on the Mac or on Windows
- [ ] Left column toggle on the left column's strip; the tab row and the + on the desk's strip; the AI toggle and You on the AI's strip
- [ ] NO Accounts, chat sparkle or layout controls

### Places Row Checklist (§5)

- [ ] Home, Documents, Tasks, Browser, Agents, Transcribe, then More
- [ ] More: Copilot Chat (only while installed and not disabled), Search, File changes, Extensions
- [ ] Run and Debug NOT visible
- [ ] VS Code's Agents window cannot open

### Status Bar Checklist (§6)

- [ ] Copilot icon NOT visible
- [ ] No remote indicator or problem counts

### Keybinding Checklist (§7)

- [ ] Cmd+B does NOT toggle the left column; it bolds in the editor
- [ ] Cmd+T opens the desk's + menu
- [ ] Ctrl+` opens a terminal tab, never the panel

### Build Checklist

- [ ] `grep '^diff --git' patches/vscode/003-ritemark-menu-cleanup.patch | wc -l` shows 26 (§2)
- [ ] `./scripts/apply-patches.sh --dry-run` reports every patch can apply and none conflicts (it checks against `vscode/`'s HEAD, so keep HEAD at the pin)
- [ ] `node scripts/check-patch-stacking.mjs` passes
- [ ] TypeScript compiles without "declared but never read" errors (`npm run typecheck-client` in `vscode/`)

---

## Appendix: The Consolidation Disaster (2026-03-22)

### What happened

During Sprint 39, patch 007 (defaultChatAgent null-safety, 7 files) was consolidated into patch 003 (menu cleanup, 7 files at the time). The goal was to reduce patch count from 7 to 6.

### What went wrong

1. A `git diff` was generated for the consolidated patch, but it only captured changes from files that were currently modified in the working tree.
2. 38 of 45 total patched files across ALL patches were silently lost.
3. No validation was performed to compare old file count vs new file count.
4. The patch was committed and applied without testing.

### What broke

- Go, Terminal, and Run menus reappeared in the menu bar
- Cmd+B started toggling the sidebar again (conflicting with Bold)
- Run and Debug icon reappeared in the activity bar
- Copilot status bar icon reappeared
- Extensions entry reappeared in View menu
- Editor Layout submenu reappeared in View menu
- Toggle Comment and Block Comment reappeared in Edit menu
- Emmet Expand Abbreviation reappeared in Edit menu

### How it was fixed

Each of the 14 files had to be manually re-patched, one at a time, with careful attention to import removal and `void` suppression patterns. The fix took an entire working day.

### Root cause

No validation step existed to verify that a consolidated patch preserved all files from the original patches. The consolidation rules in Section 8 now prevent this from recurring.
