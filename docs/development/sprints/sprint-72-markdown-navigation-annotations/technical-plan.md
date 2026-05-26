# Sprint 72 Technical Plan

## Architecture Overview

Sprint 72 touches two main surfaces:

- Extension host file discovery and path normalization.
- Webview editor UI and TipTap behavior.

The extension host should own filesystem access. The webview should own UI state, suggestions, and editor transactions.

## Workstream 1: Local File Search API

### Extension Host

Add a webview message handler in `extensions/ritemark/src/ritemarkEditor.ts`.

Proposed message:

```ts
type SearchWorkspaceFilesRequest = {
  type: 'searchWorkspaceFiles'
  requestId: string
  query: string
  limit?: number
}
```

Proposed response:

```ts
type SearchWorkspaceFilesResponse = {
  type: 'workspaceFileSearchResults'
  requestId: string
  results: WorkspaceFileLinkResult[]
}

type WorkspaceFileLinkResult = {
  label: string
  relativePath: string
  workspacePath: string
  directory: string
  extension: string
  kind: 'markdown' | 'document' | 'data' | 'image' | 'other'
}
```

Implementation notes:

- Use `vscode.workspace.findFiles` with include/exclude patterns.
- Exclude `.git`, `node_modules`, `dist`, `out`, `build`, `.next`, `.turbo`, `coverage`, `VSCode-*`, `*.app` bundles, and other heavy/generated folders. **No file-extension allowlist.** Every other workspace file is searchable.
- Compute `relativePath` from `path.dirname(document.uri.fsPath)` to each candidate.
- Normalize separators to `/`.
- Rank exact basename prefix first, then substring/fuzzy-ish matches.
- After scoring by match quality, apply a kind bonus: `markdown` > `document` > `data`/`image` > `other`. The bonus only nudges ranking — it never excludes a result that matches the query.
- Cap results to keep the UI responsive.
- If `document.isUntitled` or the document path is otherwise unstable, return an empty-state response that disables insertion.
- If there is no workspace folder but the current document has a stable file path, search a capped set of nearby files under the current document directory.

### Webview Bridge

Add a small request/response helper in the webview side if one does not already exist.

Requirements:

- Debounce query changes.
- Drop stale responses by `requestId`.
- Keep popup responsive while a request is in flight.

## Workstream 2: Inline `@` Link Suggestion

Add a new TipTap extension, likely:

```text
extensions/ritemark/webview/src/extensions/FileLinkSuggestions.tsx
extensions/ritemark/webview/src/extensions/FileLinkSuggestionList.tsx
```

Pattern:

- Reuse `@tiptap/suggestion`, `ReactRenderer`, and `tippy.js` from `SlashCommands.tsx`.
- Trigger on `@`.
- Only activate at a text boundary.
- On select:
  - delete the `@query` range;
  - insert visible text as target basename without extension;
  - apply a link mark with `href: relativePath`.

Potential command shape:

```ts
editor
  .chain()
  .focus()
  .deleteRange(range)
  .insertContent({
    type: 'text',
    text: result.label,
    marks: [{ type: 'link', attrs: { href: result.relativePath } }],
  })
  .run()
```

## Workstream 3: Add Link Dialog Integration

Update `FormattingBubbleMenu.tsx`.

Changes:

- Detect `linkUrl.startsWith('@')`.
- Show file-search results below the input.
- Selecting a result sets `linkUrl` to `result.relativePath`.
- Allow internal relative paths through validation.
- Hide/disable the "open external" button for relative paths.
- Use text-input semantics for the URL field while supporting `@query` and relative paths; do not rely on browser URL input validation for internal-file mode.

Validation helpers should distinguish:

- external URL input;
- normalized external URL;
- internal relative path selected from search.
- rejected dangerous protocol or malformed path.

## Workstream 4: Link Validation

Current `CustomLink` validation in `Editor.tsx` only accepts `http://` and `https://`.

Update validation to accept:

- `http://...`
- `https://...`
- relative internal paths that do not start with a dangerous protocol.

Reject:

- `javascript:`
- `data:` unless existing image behavior requires otherwise for image nodes only;
- empty strings;
- obvious malformed control-character paths.

Update link activation handling so relative internal links are not passed to external browser opening or auto-prefixed with `https://`. **Modifier-click on a relative link must send an `openInternalLink` message to the extension host** — see Workstream 7. Regular-click behaviour (edit dialog) is unchanged.

## Workstream 5: TOC Heading Controls

Add a helper in `headingUtils.ts`:

```ts
export function setHeadingLevel(editor: Editor, pos: number, level: 1 | 2 | 3 | 4 | 5 | 6): boolean
```

Implementation direction:

- Inspect `editor.state.doc.nodeAt(pos)`.
- Ensure node is a heading.
- Dispatch a single transaction using `setNodeMarkup`.
- Preserve current selection when possible.

Update `InlineTableOfContents.tsx`:

- Add stable row focus handling.
- Add heading-level right-click context menu using the shared shadcn/Radix `components/ui/context-menu` primitive.
- Do not render visible H1-H6 dropdowns or inline heading-level controls.
- Add keyboard handler for `Mod+Alt+1..6`.

Update `TableOfContents.tsx` with the same right-click context-menu behavior if it remains part of the product surface.

## Workstream 7: Internal Link Navigation (R7)

The webview cannot read the filesystem and cannot decide what counts as "inside the workspace". All navigation work happens on the extension host. The webview's only job is to detect the modifier-click and forward a request.

### Webview side

In `CustomLink.ts`, change the modifier-click branch for internal links from "open the edit dialog" to "post a navigation request":

```ts
if (event.metaKey || event.ctrlKey) {
  const target = classifyLinkTarget(href)
  if (target.kind === 'external') {
    openExternalUrl(href)
    return true
  }
  if (target.kind === 'internal') {
    // Send to extension host instead of opening the edit dialog.
    onInternalLinkActivate?.(target.href)
    return true
  }
  // Fall through: dangerous / empty → no-op.
  return true
}
```

`onInternalLinkActivate` is a new option on `CustomLink`, plumbed from `Editor.tsx` via the existing webview-extension bridge as `postMessage({ type: 'openInternalLink', href })`.

### Extension host side

Add a new message handler in `extensions/ritemark/src/ritemarkEditor.ts`:

```ts
type OpenInternalLinkRequest = {
  type: 'openInternalLink'
  documentUri: string   // sender doc URI; used for relative resolution
  href: string          // raw link target as stored in Markdown
}
```

Handler steps:

1. **Parse** `href` and strip any fragment / query. (`#section` fragments are allowed — they should not block navigation to the target file; for now, ignore the fragment when opening.)
2. **Resolve** the absolute path: `path.resolve(path.dirname(documentUri.fsPath), decodedHref)`.
3. **Real-path** the resolved path using `fs.promises.realpath`. If the path does not exist yet, catch `ENOENT` and use the lexically-resolved path for the containment check; surface "File not found" later.
4. **Workspace-containment check:**
   - Find the workspace folder that contains `documentUri` (first match wins for multi-root).
   - If a workspace folder exists, require the real path to be inside it.
   - If no workspace folder, require the real path to be inside the document's parent directory or a descendant.
   - On failure: `vscode.window.showWarningMessage('Link target is outside the workspace: ...')` and return.
5. **Existence check:** if `realpath` threw `ENOENT`, `vscode.window.showInformationMessage('File not found: ' + href)` and return.
6. **Dispatch open:**
   - If the target's extension is in `{ .md, .markdown, .mdx }`, open through Ritemark's custom editor:  
     `vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(realPath), 'ritemark.markdownEditor')`.
   - Otherwise defer to VS Code:  
     `vscode.commands.executeCommand('vscode.open', vscode.Uri.file(realPath))`.

Helpers worth extracting to keep the handler small and testable:

- `resolveInternalLinkTarget(documentUri, href, workspaceFolders): { realPath, rejection?: 'out-of-workspace' | 'not-found' }` — pure-ish logic that can be unit-tested against synthetic filesystem layouts.
- `pickWorkspaceFolderForDocument(documentUri, workspaceFolders)` — small wrapper around `vscode.workspace.getWorkspaceFolder`.

### Tests

- Unit: `resolveInternalLinkTarget` with cases for sibling file, nested file, dot-segment traversal that stays inside the workspace, dot-segment traversal that escapes the workspace, no-workspace fallback inside doc parent, no-workspace target escapes doc parent.
- Manual smoke: click-through from one doc to another in a workspace; Cmd-click on an image link opens the image; Cmd-click on `https://...` still goes to the browser; Cmd-click on a missing file shows "File not found".

## Workstream 8: Dead-code cleanup

Remove `extensions/ritemark/webview/src/components/header/TableOfContents.tsx` and its export from `header/index.ts`. The component is exported but never imported by any consumer (`grep -rn "header/TableOfContents\|<TableOfContents" src` returns only the export line). Phase 4 wiring that was previously added to it during this sprint goes with the deletion.

## Workstream 6: Comment Callout Audit

Before implementation, create fixtures manually and inspect current behavior:

- load/save `<!-- private note -->`;
- load/save multi-line comment;
- load/save `/// shorthand`;
- copy as Markdown;
- PDF/Word export if comment nodes survive.

Likely implementation paths:

1. Custom TipTap comment node.
2. Preprocess Markdown comments into placeholder HTML before `marked`.
3. Defer to a dedicated parser sprint.

Decision rule:

- If comments round-trip naturally or with a small custom node, ship.
- If preserving comments requires broad parser/export surgery, defer #81 and finish #80/#79 cleanly.

## Tests and Validation

Automated candidates:

- Path normalization/ranking helper tests.
- Link validation helper tests.
- Link target classification tests for external URLs, safe relative paths, and dangerous protocols.
- Heading-level helper tests if extractable outside React.
- TipTap suggestion boundary tests for prose `@`, email addresses, and stale async search responses where feasible.

Manual QA:

- Inline `@` insertion in nested folders.
- Inline `@` does not trigger inside email addresses.
- Add Link dialog internal search.
- Add Link dialog hides external-open controls for relative internal links.
- Duplicate basenames.
- Spaces in file names.
- Saved single-file/no-workspace fallback and untitled-file disabled state.
- Keyboard navigation.
- TOC heading-level change and undo.
- Comment fixtures if #81 proceeds.
