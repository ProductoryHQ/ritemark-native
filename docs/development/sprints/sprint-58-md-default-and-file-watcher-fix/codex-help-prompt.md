# Codex Help Request: Ritemark file-watcher regression after VS Code 1.117 upgrade

## TL;DR

In Ritemark Native (a VS Code OSS fork branded as a markdown editor), the `ritemark.editor` customEditor's external-change detection broke after the 1.117 submodule bump (v1.6.1, commit 275da52). When an agent — specifically Claude Code launched from Ritemark's own AI panel — modifies the open `.md` file on disk, neither `vscode.workspace.onDidChangeTextDocument` nor `vscode.workspace.createFileSystemWatcher().onDidChange` fires. The webview never gets notified, the editor displays stale content. `Cmd+Q` and reopen surfaces the new content (initial load works).

I (the engineer agent) have spent ~3h debugging this and need a second pair of eyes.

## Context

- Repo: `/Users/jarmotuisk/Projects/ritemark-native`
- Custom editor: `extensions/ritemark/src/ritemarkEditor.ts` (`RitemarkEditorProvider implements vscode.CustomTextEditorProvider`)
- Webview React app: `extensions/ritemark/webview/src/`
- VS Code 1.117 submodule at `vscode/`
- Branding overrides: `branding/product.json` (gets copied to `vscode/product.json`)
- Sprint plan: `docs/development/sprints/sprint-58-md-default-and-file-watcher-fix/sprint-plan.md`

## What I've already done in Sprint 58

### Block 1 — customEditor default (FIXED)
- Diagnosed `priority: "exclusive"` was silently invalid (`CustomEditorPriority` enum only allows `default | builtin | option`; see `vscode/src/vs/workbench/contrib/customEditor/common/customEditor.ts:77-81`).
- Added `workbench.editorAssociations` to `branding/product.json` `configurationDefaults`.
- Changed all `priority: "exclusive"` → `"default"` in `extensions/ritemark/package.json`.
- Result: `.md` files now open in Ritemark webview by default in folder workspaces.
- Caveat: in **single-file mode** (`code.sh /path/to/file.md` with no folder open), `editorAssociations` does NOT apply — files still open in plain text editor unless user has the parent folder added as workspace. User accepted this as a separate UX issue.

### Block 2 — file watcher rewrite (STILL BROKEN — that's the problem)

Original architecture used `vscode.workspace.createFileSystemWatcher` per-file with `onDidChange` → debounced 500ms → `pendingSaves` flag check → `webview.postMessage({ type: 'fileChanged' })`.

I migrated to `vscode.workspace.onDidChangeTextDocument` with an `applyingFromWebview` counter (per-document URI) to suppress echoes from our own `applyEdit` calls. Pushes either `externalChange` (silent content swap) or `fileChanged` (refresh button) based on `document.isDirty`.

**Tested with my own external edits** (this Claude Code session writing to the file via the Edit tool from outside VS Code): listener fires correctly. Logs show:
```
[Ritemark][onDidChange] fired uri=... isDirty=false applyingFromWebview=0 reason=undefined changes=1
[Ritemark][onDidChange] EXTERNAL+CLEAN → externalChange (silent push)
[Ritemark][webview] externalChange received, content length=1757
```

**Tested with Ritemark AI panel** (a webview-view that runs Claude Code CLI as a subprocess of the extension host, used to edit the same `.md` file): listener does NOT fire at all. No log line. Webview never receives anything. The editor stays on stale content.

When this happens I see in the logs ONLY initial-mount events:
```
[Ritemark] Extension URI: ...
[Ritemark] Script path: ...
[Ritemark] Script URI: ...
[Ritemark] Initializing editor, type: null
[Ritemark][Editor] useEffect: isExternalChange=false currentMarkdown.length=2127 value.length=2126 lastOnChangeValue.length=2126 editor.isFocused=false will-update=false
[Ritemark] Initializing editor, type: ai-sidebar
```

Note `currentMarkdown.length=2127, value.length=2126` (1-byte difference is the trailing-newline roundtrip — `extractFrontMatter` returns `parsed.content` while turndown gives back content + extra `\n`).

### Hybrid attempt (also not working)

After establishing onDidChangeTextDocument doesn't fire for the AI-panel writes, I added back a slim `FileSystemWatcher.onDidChange` that reads disk directly via `fs.readFileSync`, posts `externalChange` with the disk content. This was supposed to be belt-and-suspenders. **It also doesn't fire** when AI panel writes the file.

Current code is at `extensions/ritemark/src/ritemarkEditor.ts:932-1062`:

```typescript
private createDeleteWatcher(
  document: vscode.TextDocument,
  webview: vscode.Webview
): void {
  const filePath = document.uri.fsPath;
  if (this.deleteWatchers.has(filePath)) return;

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath))
  );

  watcher.onDidChange(() => {
    console.log('[Ritemark][fsWatcher] onDidChange fired:', filePath);
    this.handleExternalDiskChange(document, webview);
  });

  watcher.onDidDelete(() => { /* ... */ });
  this.deleteWatchers.set(filePath, watcher);
}
```

Same `RelativePattern(dirname, basename)` pattern as the old (working) code. But **the `[Ritemark][fsWatcher] onDidChange fired:` log never appears** when the AI panel rewrites the file.

## Critical observation

When I (a separate Claude Code session OUTSIDE Ritemark) wrote to `/Users/jarmotuisk/Projects/refresh-regression-test.md` via the Edit tool, the OLD `[Ritemark][watcher] onDidChange fired:` log DID appear (and the OLD `[Ritemark][handleFileChange] sending fileChanged`). So the `RelativePattern` watcher in single-file mode did work for an external process.

But when the AI panel (subprocess of the extension host's Node process) rewrites the same file, neither the old nor the new watcher fires. And `onDidChangeTextDocument` doesn't fire either.

So the regression is **specifically** triggered by writes from the AI panel's subprocess — possibly via:
- A code path that calls `vscode.workspace.fs.writeFile` (which goes through VS Code's virtual fs layer and might bypass the OS-level watcher VS Code uses for `createFileSystemWatcher`)
- Or `vscode.workspace.applyEdit` followed by save (in which case applyEdit triggers `onDidChangeTextDocument` but our `applyingFromWebview` flag would only catch our own provider's edits, not AI-panel's)
- Or some other VS Code API that updates the TextDocument silently

I have NOT yet read the AI panel implementation in this repo to confirm which path it takes. Files to look at:
- `extensions/ritemark/src/agent/AgentRunner.ts`
- `extensions/ritemark/src/agent/setup.ts`
- `extensions/ritemark/src/agent/installer.ts`
- `extensions/ritemark/src/views/UnifiedViewProvider.ts`
- `extensions/ritemark/src/views/AgentLibraryViewProvider.ts`
- The webview side under `extensions/ritemark/webview/src/components/ai-sidebar/`

## What I need from you

1. **Read the AI panel / agent code** in this repo and figure out exactly HOW it writes to the open `.md` file. Specifically:
   - Does it use `child_process.spawn('claude', ...)` and let Claude CLI write directly via `fs`?
   - Does it intercept Claude's tool calls and route them through `vscode.workspace.fs.writeFile`?
   - Does it use `vscode.workspace.applyEdit`?
   - Does it post a webview message back to `RitemarkEditorProvider` that calls `updateDocument` (which is wrapped in `applyingFromWebview`, so it WOULD be silently swallowed)?

2. **Determine why neither the FileSystemWatcher nor onDidChangeTextDocument fires** for AI-panel writes when both fire for outside-Ritemark Claude CLI writes. The watching API is the same; the writing path must be different.

3. **Recommend the architectural fix.** Options I've considered:
   - **(a)** Have AI panel emit an explicit "I just wrote the file" event the editor provider can subscribe to.
   - **(b)** Use Node's `chokidar` directly inside the editor provider (bypasses VS Code's abstraction entirely).
   - **(c)** Poll file mtime every N seconds (simple but wasteful).
   - **(d)** Somehow inspect what the AI panel's Claude CLI actually does and align our watcher with its write path.
   - **(e)** Fix the `applyingFromWebview` flag so it only suppresses the original `RitemarkEditorProvider` provider's own edits, not other extension code paths that may call `applyEdit` on the same document.

   I lean toward (a) (explicit notification) plus (b) (chokidar fallback) but I need your read on this.

4. **Watch out for the Block 1 caveat.** Don't tell me to "open the file in a folder workspace and that fixes it." It does for the customEditor association, but the file watcher must work in single-file mode AND folder mode. End users open `.md` files from Finder.

## Test setup if you want to reproduce

```bash
cd /Users/jarmotuisk/Projects/ritemark-native
arch -arm64 /bin/zsh -c 'unset ELECTRON_RUN_AS_NODE && source "$HOME/.nvm/nvm.sh" && nvm use && VSCODE_SKIP_PRELAUNCH=1 ./vscode/scripts/code.sh /Users/jarmotuisk/Projects/refresh-regression-test.md 2>&1' &
```

Then in the Ritemark dev window, open the AI sidebar (sparkle icon, top right), select Claude · Opus 4.6 model, type "tee kolmeteistkümnes sissekanne" — the AI will edit the file, the editor will NOT update. Look at the dev tools console (Help → Toggle Developer Tools) for absence of any `[Ritemark][fsWatcher]` or `[Ritemark][onDidChange]` log line.

## Constraints

- No new heavy dependencies if avoidable (chokidar would be acceptable but think twice).
- Must work in single-file mode AND folder workspace mode.
- Must not break the existing CSV conflict detection (`handleRefresh` lines 800+ in `ritemarkEditor.ts`).
- Sprint plan and approval gate live in this repo — `docs/development/sprints/sprint-58-md-default-and-file-watcher-fix/sprint-plan.md`. The sprint is in Phase 3 (implementing) but Block 2 is incomplete.

Please dig in and report back with findings. Concise is fine — what I really need is the answer to "where does the AI panel actually write the file, and what's the right hook to detect it." Once that's known the fix is small.
