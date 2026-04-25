# Titlebar Actions Cleanup — Sprint 53

## Goal

Right side of titlebar should contain ONLY two icons:
- Toggle Primary Side Bar (panel-left)
- Toggle Secondary Side Bar (panel-right)

## What was wrong

1. **Settings gear** rendering in titlebar (Sprint 53 had moved Settings to ActivityBar bottom but the titlebar registration wasn't fully removed).
2. **Chat icon** (`codicon-chat-sparkle`) rendering, despite multiple prior attempts in patch 003 to suppress chat.
3. **Action toolbar appearing on the LEFT**, next to traffic lights, instead of the right.

## Root causes (each surprising)

### 1. Stale compiled output

Source files in `vscode/src/` were correctly updated by an in-progress edit to patch 002, but `vscode/out/` (the compiled JS that dev mode actually serves) was stale. Symptom: source was clean, but the gear still rendered.

**Fix:** start the watcher (`npm run watch-clientd` from `vscode/`) so future TS edits auto-recompile. Without a watcher running, edits to `.ts` files are invisible at runtime.

### 2. Chat icon — moving target

Patch 003 already disables chat at the view-container level (`chatParticipant.contribution.ts`: `isDefault: false`, descriptor commented out). But upstream VS Code added a NEW entry surface in:

```
vscode/src/vs/workbench/contrib/chat/browser/agentSessions/experiments/agentSessionsExperiments.contribution.ts
```

Two `MenuRegistry.appendMenuItem` blocks (lines 226–256 in upstream commit at time of fix):
- `MenuId.CommandCenter` — fires when command center is enabled
- `MenuId.TitleBar` — fires when command center is disabled (our case)

Both render `Codicon.chatSparkle`. Patched 003 to comment out both.

**Critical pattern:** every upstream sync may add new chat surfaces. Re-grep `Codicon.chatSparkle` registrations after each VS Code update.

### 3. Toolbar position — patch 002 was deliberately moving it left

The shock: `titlebarPart.ts:483` upstream code already appends to `this.rightContent`. Patch 002 contained an unexplained hunk reverting it to `this.leftContent`:

```diff
-			this.actionToolBarElement = append(this.rightContent, ...);
+			this.actionToolBarElement = append(this.leftContent, ...);
```

Probably a leftover from an earlier Sprint 53 layout experiment. The Settings gear had been masking the visual impact (gear was rendered separately on the right, making the toolbar look right-aligned).

**Fix:** removed the hunk from patch 002 — upstream `rightContent` behavior is now restored.

## Files changed

| File | Change |
|------|--------|
| `vscode/src/vs/workbench/contrib/chat/browser/agentSessions/experiments/agentSessionsExperiments.contribution.ts` | Comment out both `MenuRegistry.appendMenuItem` blocks; comment out unused `Codicon` import |
| `vscode/src/vs/workbench/browser/parts/titlebar/titlebarPart.ts:483` | Restored to upstream `rightContent` |
| `patches/vscode/002-ritemark-ui-layout.patch` | Removed `rightContent → leftContent` hunk |
| `patches/vscode/003-ritemark-menu-cleanup.patch` | Added new file diff for chat contribution |
| `CLAUDE.md` | Trimmed over-specific titlebar invariants table; added chat-whack-a-mole warning |

## Diagnosis playbook (for future titlebar issues)

1. **Inspect runtime DOM** — Help → Toggle Developer Tools, find icon. Note `aria-label`, codicon class, and parent toolbar's `aria-label`.
2. **Match aria-label string** to source — grep `localize(...)` in `vscode/src/`.
3. **Trace registration** — find `MenuRegistry.appendMenuItem(MenuId.X, ...)` for the offending command id.
4. **Check `vscode/out/` matches `vscode/src/`** — stale compile = phantom bug. Run watcher.
5. **Re-read existing patches** — they may already touch the area in surprising ways (e.g., reverting upstream to a worse default).
6. **Test in clean profile** if state caching is suspected: `./vscode/scripts/code.sh --user-data-dir /tmp/clean --extensions-dir /tmp/clean-ext`.

## Layers of titlebar UI (cheat sheet)

The "Title actions" toolbar (`<ul aria-label="Title actions">`) renders combined items from:

| Source menu | Where contributed | Notes |
|-------------|-------------------|-------|
| `MenuId.LayoutControlMenu` | `layoutActions.ts:382-407` | Sidebar toggles (Ritemark custom) |
| `MenuId.TitleBar` | wherever — chat, others | Global "right-side" actions; we now block chat here |
| `MenuId.CommandCenter` | only if `window.commandCenter` enabled | Currently disabled in Ritemark |
| Activity actions (`GLOBAL_ACTIVITY_ID`, `ACCOUNTS_ACTIVITY_ID`) | `titlebarPart.ts:686-692` | Already commented out by patch 002 |

Toolbar position: `titlebarPart.ts:483` — `leftContent` vs `rightContent`. Upstream default is `rightContent`.
