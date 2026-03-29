# Research: Codebase Analysis for Knowledge Graph

## Existing Infrastructure That Matters

### RAG Indexer (`extensions/ritemark/src/rag/indexer.ts`)

The `DocumentIndexer` class is highly relevant as a starting point for the Link Index (Layer 2):

- Already walks all `.md` files in workspace via `walkDirectory()`
- Already watches for `create`, `change`, `delete` events via `vscode.FileSystemWatcher`
- Uses `getFileHash()` for change detection
- Stores data in an Orama vector store (`VectorStore`, SQLite-backed)
- Has `onProgress` event emitter for UI feedback
- Lives at `.ritemark/` in the workspace root

**Key insight:** The link indexer should be a separate, lightweight service that runs alongside the RAG indexer. It does NOT need embeddings or chunking — just regex-based `[[...]]` scanning. We can reuse the file-walking, watching, and `.ritemark/` storage patterns verbatim.

### Extension Entry Point (`extensions/ritemark/src/extension.ts`)

- `documentIndexer` is registered at activation time with `let documentIndexer: DocumentIndexer | null = null`
- Follows the pattern: create → `init()` → `startWatching()` → `indexAll()`
- The link indexer would follow the identical lifecycle pattern

### Editor Provider (`extensions/ritemark/src/ritemarkEditor.ts`)

- Messages flow via `webview.onDidReceiveMessage` switch-case
- The extension host can push data to the webview at any time via `webview.postMessage()`
- The `case 'ready'` handler sends a `buildLoadMessage()` payload — we can add backlink/forward-link data here
- File path of the currently open document is always available as `document.uri.fsPath`

### Bridge Protocol (`extensions/ritemark/webview/src/bridge.ts`)

- `sendToExtension(type, data)` — webview → extension (e.g., wiki-link click navigation)
- `onMessage(callback)` — extension → webview (e.g., push fresh backlink list, respond to navigation)
- Internal events (`emitInternalEvent`) for within-webview coordination (e.g., autocomplete popup)

### TipTap Extension Patterns

Existing custom extensions to reference:

| Extension | File | Pattern Used |
|-----------|------|--------------|
| `CustomLink` | `extensions/CustomLink.ts` | `Link.extend()` — adds ProseMirror plugin for DOM event interception |
| `SlashCommands` | `extensions/SlashCommands.tsx` | `Extension.create()` + `@tiptap/suggestion` for trigger-based popups |
| `ImageExtension` | `extensions/imageExtensions.ts` | Node view with custom rendering |
| `CodeBlockWithCopyExtension` | `extensions/CodeBlockWithCopyExtension.ts` | Node view with React component (`NodeViewContent`) |

**Key insight for wiki-link extension:**
The `[[note]]` token is best implemented as a **custom inline Node** (not a Mark). Reasons:
- Nodes can be styled as a discrete visual chip (like a pill/badge), matching Obsidian behavior
- Marks wrap arbitrary text ranges; Nodes represent atomic units with fixed content
- Deleting a wiki-link should remove the whole `[[note]]` token atomically
- Aliases `[[note|display text]]` need two stored attributes (`href`, `label`) — nodes support this naturally

The closest analog in TipTap itself is `@tiptap/extension-mention` (the `@mention` pattern) — it is an inline node that stores an `id` and `label`, renders as a chip, and uses `@tiptap/suggestion` for the autocomplete. The wiki-link extension should extend or mirror `@tiptap/extension-mention`.

### React Flow (`@xyflow/react`)

Already a dependency in `extensions/ritemark/webview/package.json` (version `^12.3.5`). Used in `FlowCanvas.tsx` with:
- `ReactFlow` + `ReactFlowProvider`
- Custom node types via `nodeTypes` map
- ELKjs for auto-layout (also already installed: `elkjs ^0.9.3`)

**Key insight:** The graph view can reuse the existing import without adding any new dependencies. We need a different layout algorithm though — **d3-force** (force-directed) for the organic Obsidian-style graph, versus the layered DAG layout used in Flows. ReactFlow does not bundle d3-force — we would need `d3-force` as a new dependency, or implement a simple spring simulation ourselves, or use ReactFlow's built-in `fitView` and let ELK handle an alternative layout like `elk.algorithm: 'force'`.

**ELK has a force algorithm** (`elk.algorithm: 'force'`) — this can produce organic graph layouts and is already installed. This avoids a new dependency entirely.

### Feature Flag System (`extensions/ritemark/src/features/flags.ts`)

Current `FlagId` type is a union literal. Adding a new flag requires:
1. Adding the string literal to the `FlagId` type union
2. Adding the entry to the `FLAGS` record
3. Optionally adding a `when` clause in `package.json` to show/hide view contributions

### View Registration Pattern (`extensions/ritemark/package.json`)

Views are registered under `contributes.views` keyed by a container ID. Existing containers:
- `ritemark-ai` → `auxiliarybar` (right sidebar)
- `ritemark-flows` → `activitybar` (left activity bar)

The backlinks panel and graph view need new containers. Options:
- Add them to `ritemark-flows` container (reuse activity bar entry)
- Create a new `ritemark-graph` activity bar container
- Add a graph view as a custom editor (`*.graph` virtual file type) — more complex, gives full webview real estate

**Recommended:** New `ritemark-graph` activity bar container with two webview views:
1. `ritemark.graphView` — the full interactive graph
2. A separate `explorer`-panel contribution for backlinks — simpler: put backlinks in the `explorer` container as a tree view, alongside the file explorer

## Turndown / Markdown Roundtrip

Wiki-links `[[note]]` are not standard markdown. They need custom handling:
- **TipTap → Markdown serialization**: need a custom Turndown rule (or intercept the serializer) to convert the inline node back to `[[note]]` text
- **Markdown → TipTap loading**: the `content` string loaded from disk contains raw `[[note]]` text; TipTap's HTML parser won't understand it. Need to preprocess the markdown before passing to TipTap.

Current flow in `ritemarkEditor.ts`:
1. `document.getText()` → raw markdown string (with front matter stripped by `extractFrontMatter()`)
2. Sent to webview as `content` field
3. Webview calls `marked(content)` → HTML, then passes to `editor.commands.setContent(html)`

For wiki-links to work:
- During `marked()` parsing: intercept `[[note]]` → `<wiki-link href="note" label="note"></wiki-link>` (custom marked extension or preprocessor regex)
- TipTap then parses the custom tag via `parseHTML` rules on the wiki-link Node extension
- On save: Turndown converts `<wiki-link>` element back to `[[note]]` syntax

## Performance Considerations (Large Vaults)

For 1000+ files:
- Link index is pure text scanning (no embeddings), so indexing 1000 files should be fast (<5 seconds)
- In-memory index is feasible; persist to `.ritemark/link-index.json` for load-time restoration
- Graph rendering with 1000+ nodes: ReactFlow handles thousands of nodes in practice, but force layout becomes slow with ELK. Option: cap "global graph" at top-N nodes by connection count, or use canvas-based rendering for large graphs (ReactFlow supports `nodesFocusable: false` mode for performance)
- Autocomplete: fuzzy search on 1000 filenames is instant with a simple substring filter

## Summary of Key Technical Decisions to Surface in Plan

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Wiki-link node type | Mark vs. Node | Node (atomic, supports attributes) |
| Autocomplete mechanism | Custom popup vs. `@tiptap/suggestion` | `@tiptap/suggestion` (already used in SlashCommands and Mentions) |
| Markdown → TipTap | marked extension vs. regex preprocess | Regex preprocess on `content` before `marked()` call |
| TipTap → Markdown | Custom Turndown rule vs. serializer hook | Custom Turndown rule (consistent with how tables/tasks are handled) |
| Link index storage | In-memory only vs. persisted JSON | Persisted JSON at `.ritemark/link-index.json` (fast restart) |
| Link index architecture | Extend RAG indexer vs. standalone class | Standalone `LinkIndexer` class (separate concerns; no embeddings needed) |
| Graph layout engine | d3-force vs. ELK force | ELK force (already installed; no new deps) |
| Graph view host | New activity bar container vs. custom editor | New `ritemark-graph` activity bar container |
| Backlinks panel location | Separate view vs. embedded in AI sidebar | Separate view in `explorer` container (visible alongside file tree) |
| Standard link support | `[text](file.md)` also feeds graph? | Yes — both `[[note]]` and `[text](file.md)` internal links should feed the graph |
| Alias support | `[[note]]` only vs. `[[note|display text]]` | Include aliases from the start; trivial to add with the Node approach |
| Scope | Workspace only vs. current folder | Full workspace (matches Obsidian vault behavior) |
