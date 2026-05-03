# Sprint 58: Fix .md customEditor Default + File Watcher Regression (VS Code 1.117 Fallout)

## Goal

Restore two broken end-user guarantees introduced by the VS Code 1.117 upgrade: (1) .md/.markdown/.csv files open in Ritemark by default in all contexts, and (2) external disk changes to an open file are detected and presented to the user.

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - Both work items are bug fixes for regressions — correct behavior is always-on.
  - If NO: Document why: These are bug fixes restoring pre-existing behaviour, not new features. No kill-switch or platform restriction applies.

## Success Criteria

- [ ] Opening a .md file from Finder launches Ritemark webview editor (not raw text editor)
- [ ] Opening a .md file via CLI `open file.md` launches Ritemark webview editor
- [ ] Opening a .md file inside a trusted folder workspace launches Ritemark webview editor
- [ ] Opening a .md file in an untrusted / single-file context launches Ritemark webview editor
- [ ] When an external agent edits an open .md file on disk, the Ritemark editor detects the change
- [ ] In clean state (no local edits): external change is applied silently to the webview
- [ ] In dirty state (local unsaved edits exist): external change shows a conflict/refresh prompt
- [ ] CSV conflict detection (handleRefresh lines 810-829) is fully preserved and unbroken
- [ ] All debug `console.log` statements added during today's investigation are removed
- [ ] TypeScript compiles with zero errors (`npx tsc --noEmit`)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `branding/product.json` | Add `workbench.editorAssociations` for *.md, *.markdown, *.csv to `configurationDefaults` |
| `extensions/ritemark/package.json` | Change `priority: "exclusive"` → `priority: "default"` for `ritemark.editor` customEditor |
| `extensions/ritemark/src/ritemarkEditor.ts` | Replace `createFileWatcher` + `handleFileChange` + `pendingSaves` machinery with `onDidChangeTextDocument` listener + `isApplyingFromWebview` flag |
| `extensions/ritemark/webview/src/App.tsx` | Handle new `externalChange` message type (silent content push for clean state); keep `fileChanged` for dirty-conflict path; remove debug console.log |

## Research Findings (Phase 1)

### Regression 1 — customEditor Not Selected as Default

**Root cause (verified):** `extensions/ritemark/package.json:414` declares `"priority": "exclusive"` for `ritemark.editor`. Per VS Code source `vscode/src/vs/workbench/contrib/customEditor/common/customEditor.ts:77-81`, `CustomEditorPriority` only accepts `'default' | 'builtin' | 'option'`. The value `'exclusive'` falls through to `default:` in `contributedCustomEditors.ts:96-109` and is silently coerced to `default`. The built-in text editor then wins over Ritemark because no association is explicitly configured.

**Fix:** Two-part.

Part A — `branding/product.json` `configurationDefaults`: add `workbench.editorAssociations` mapping *.md, *.markdown, *.csv to `ritemark.editor`. This is the canonical VS Code mechanism used by Draw.io, Jupyter, etc. It occupies the `defaultValue` precedence slot — user/workspace settings override it if needed.

Part B — `extensions/ritemark/package.json`: change `"priority": "exclusive"` → `"priority": "default"`. Cleanup only; the invalid value was silently a no-op. Changing it removes a misleading declaration.

**Confirmed current state of `branding/product.json`:** `configurationDefaults` block exists (lines 48-56) with theme, layout, and trust settings. No `workbench.editorAssociations` entry. Safe to add.

**Note on `capabilities.untrustedWorkspaces.supported: true`:** This was already added in earlier debugging. No change needed.

### Regression 2 — File Watcher Broken After VS Code 1.117

**Current architecture (`ritemarkEditor.ts:893-979`):**
- `createFileWatcher` registers a per-file `vscode.workspace.createFileSystemWatcher` in `resolveCustomTextEditor`
- `watcher.onDidChange` → debounced 500ms → checks `pendingSaves` Set → if not our save, postMessages `fileChanged` to webview
- `pendingSaves` is populated by `onWillSaveTextDocument` listener
- Webview `App.tsx:188-195` handles `fileChanged` → shows Refresh button in DocumentHeader

**Why it's broken:** VS Code 1.117 changed how disk-sync is handled internally. The `FileSystemWatcher.onDidChange` event now races with VS Code's own TextDocument sync. The watcher fires but the `pendingSaves` flag timing is disrupted, causing the notification to be silently swallowed or never sent. Debug logs added today confirm the watcher fires (`onDidChange` logged) but the `fileChanged` message does not reach the webview in many cases.

**Chosen fix — migrate to `onDidChangeTextDocument` (Option B):**

`vscode.workspace.onDidChangeTextDocument` fires whenever VS Code's TextDocument model changes, whether from a user keystroke, an `applyEdit`, or VS Code's own disk-sync refresh. This is the correct event: it eliminates the race entirely because VS Code has already resolved the disk state before firing. Key design:

- `isApplyingFromWebview: boolean` flag (per-document, tracked on the provider) replaces `pendingSaves`. Set to `true` immediately before calling `applyEdit`, cleared in `finally`. When `onDidChangeTextDocument` fires with this flag set, skip — it's our own edit.
- When `onDidChangeTextDocument` fires with flag clear: external change. Branch on `document.isDirty`:
  - Clean state → post new content directly to webview (`externalChange` message with full content). No Refresh button needed — content is already correct.
  - Dirty state → post `fileChanged` message to webview → Refresh button appears (existing DocumentHeader path).
- `fileWatchers`, `fileChangeDebounceTimers`, `pendingSaves` Maps/Set and their cleanup code are removed.
- `onDidDelete` behaviour (post `fileDeleted`) is preserved via `FileSystemWatcher` for that event only, OR via handling document close events — to be confirmed during implementation.

**Webview impact (`App.tsx`):**
- `fileChanged` case (lines 188-195) stays for dirty-state conflict path.
- New `externalChange` case: receives `{ type: 'externalChange', content: string }` → directly updates editor content without showing Refresh button.
- Debug `console.log` at line 190 must be removed.

**CSV conflict preservation:** `handleRefresh` (lines 800-835) and `hasFileChangedOnDisk` / `fileLoadTimes` are independent of the watcher machinery. They remain unchanged.

**Risk:** `onDidChangeTextDocument` fires for every keystroke from the webview too (each character triggers an `applyEdit`). The `isApplyingFromWebview` flag must be set and cleared correctly to avoid infinite feedback loops. The flag is synchronous (no async gap between set and the triggered event) because `applyEdit` is awaited and the TextDocument event fires synchronously within the event loop tick after the edit resolves. This is the standard pattern used by extension authors for exactly this scenario.

## Implementation Checklist

### Work Block 1 — customEditor Default Fix (lower risk, do first)

- [ ] Add `"workbench.editorAssociations"` to `configurationDefaults` in `branding/product.json` for `*.md`, `*.markdown`, `*.csv` → `"ritemark.editor"`
- [ ] Change `"priority": "exclusive"` → `"priority": "default"` for `ritemark.editor` in `extensions/ritemark/package.json`
- [ ] Verify `capabilities.untrustedWorkspaces.supported` is already correct (no change needed)
- [ ] Test: open .md from Finder → Ritemark webview opens
- [ ] Test: open .md via `open file.md` from terminal → Ritemark webview opens
- [ ] Test: open .md inside a trusted folder workspace → Ritemark webview opens
- [ ] Test: open .md in untrusted / single-file context → Ritemark webview opens

### Work Block 2 — File Watcher Rewrite

- [ ] Remove `pendingSaves` Set and all references from `ritemarkEditor.ts`
- [ ] Remove `createFileWatcher` method and all call sites from `ritemarkEditor.ts`
- [ ] Remove `handleFileChange` method from `ritemarkEditor.ts`
- [ ] Remove `fileChangeDebounceTimers` Map and all references from `ritemarkEditor.ts`
- [ ] Keep `fileWatchers` Map only for `onDidDelete` (fileDeleted message) — or migrate to document-close event (decide during implementation)
- [ ] Add `isApplyingFromWebview` tracking (per-document Map or single boolean; confirm which during implementation)
- [ ] Add `vscode.workspace.onDidChangeTextDocument` listener in `resolveCustomTextEditor`
- [ ] Listener logic: if `isApplyingFromWebview` → skip; else if `document.isDirty` → post `fileChanged`; else → post `externalChange` with full content
- [ ] Wrap all `applyEdit` calls in `ritemarkEditor.ts` with `isApplyingFromWebview = true` / `finally { isApplyingFromWebview = false }` guard
- [ ] Add `externalChange` message handler in `App.tsx` — update editor content directly (no Refresh button)
- [ ] Remove debug `console.log` from `App.tsx` line 190 (`fileChanged` case)
- [ ] Remove all debug `console.log` statements added to `ritemarkEditor.ts` (watcher events, handleFileChange, onWillSave)
- [ ] Verify CSV conflict detection (`handleRefresh`, `hasFileChangedOnDisk`, `fileLoadTimes`) is untouched and still functional
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Test: external edit to open .md file → webview content updates silently (clean state)
- [ ] Test: external edit to open .md file with unsaved local changes → Refresh button appears (dirty state)
- [ ] Test: external delete of open file → `fileDeleted` message reaches webview

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** YES — cannot begin implementation without Jarmo's explicit approval

## Approval

- [ ] Jarmo approved this sprint plan
