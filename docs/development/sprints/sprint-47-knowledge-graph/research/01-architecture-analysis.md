# Sprint 47: Knowledge Graph — Architecture Analysis

## Overview

This document maps the existing codebase patterns that the graph feature will build on and identifies integration points.

---

## Existing Infrastructure That Can Be Reused

### 1. RAG Indexer (`extensions/ritemark/src/rag/indexer.ts`)

The existing `DocumentIndexer` already does most of what the link index needs:

- Scans all `.md` / `.markdown` files recursively in workspace
- `vscode.FileSystemWatcher` for create/change/delete events
- Skips hidden dirs and `node_modules`
- File hash-based change detection (avoids re-scanning unchanged files)
- `indexAll()`, `indexFile()`, `reindexFile()`, `removeFile()` lifecycle
- Stores in `.ritemark/` directory inside workspace

The link indexer is a lighter sibling: same file-discovery and watch logic, but instead of generating embeddings it parses `[[...]]` and `[text](file.md)` references and builds a directed graph in memory (serialized to a small JSON file).

**Key decision:** Build as a separate `LinkIndexer` class, not entangled into the RAG embeddings pipeline. They can share file-discovery utilities but run independently.

### 2. File System Watcher Pattern

```ts
// Already proven pattern in DocumentIndexer:
this.watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(this.workspacePath, pattern)
);
this.watcher.onDidCreate(uri => this.indexFile(uri.fsPath));
this.watcher.onDidChange(uri => this.reindexFile(uri.fsPath));
this.watcher.onDidDelete(uri => this.removeFile(uri.fsPath));
```

Copy verbatim into `LinkIndexer`.

### 3. `@xyflow/react` (React Flow) Already a Dependency

`extensions/ritemark/webview/package.json` already lists:
```json
"@xyflow/react": "^12.3.5"
```

The `FlowCanvas` component in `webview/src/components/flows/FlowCanvas.tsx` shows how to use React Flow within a custom webview panel. The graph view can reuse the same setup (ReactFlow provider, node/edge types, Zustand store pattern).

### 4. TipTap Extension Pattern

Existing extensions in `webview/src/extensions/`:
- `CustomLink.ts` — extends `@tiptap/extension-link`, adds ProseMirror plugin with DOM event handler
- `CodeBlockWithCopyExtension.ts` — custom node with NodeView
- `imageExtensions.ts` — custom node types

The wiki-link TipTap extension will follow the **inline node** pattern (not a mark) because:
- Wiki-links need their own `toMarkdown` serializer that outputs `[[note]]`
- As a mark, the content is plain text and harder to keep consistent
- As an inline node, the entire `[[note]]` token is atomic — delete/navigate atomically

### 5. Extension Host Messaging Pattern

`ritemarkEditor.ts` already handles rich message passing between extension host and webview:
- `webview.postMessage({type: 'load', ...})` for sending data to webview
- `webview.onDidReceiveMessage` handler for messages from webview
- Feature flags forwarded on load: `features: { voiceDictation, markdownExport }`

The link index data and graph view will follow the same pattern.

### 6. Sidebar View Pattern (`UnifiedViewProvider.ts`)

The backlinks panel will be a new VS Code `WebviewViewProvider` registered in `package.json` as a sidebar view, similar to how `UnifiedViewProvider` works for the AI chat panel.

---

## The Four Layers — Implementation Strategy

### Layer 1: Wiki-Links TipTap Extension

**Location:** `extensions/ritemark/webview/src/extensions/WikiLinkExtension.ts`

**Approach:** Custom inline node
- Input rule: typing `[[` triggers autocomplete (using `@tiptap/suggestion` already installed)
- Node schema: `{ type: 'wiki_link', attrs: { target: string, alias: string | null } }`
- Renders as: `<span class="wiki-link" data-target="...">display text</span>`
- `toMarkdown`: serialize back to `[[target]]` or `[[target|alias]]`
- `fromMarkdown`: parse `[[...]]` tokens in the markdown input

**Markdown roundtrip challenge:** The turndown (HTML → MD) serializer needs a rule for wiki-link spans. The marked (MD → HTML) parser needs an extension to recognize `[[...]]`. Both already have extension mechanisms in use.

**Cmd+click navigation:** Send `{ type: 'wiki-link:navigate', target: 'note name' }` to extension host, which resolves to a file path and calls `vscode.commands.executeCommand('vscode.openWith', uri, 'ritemark.editor')`.

**Autocomplete:** `@tiptap/suggestion` is already installed (used for slash commands). Wiki-link autocomplete will reuse the same infrastructure — trigger on `[[`, fuzzy-search filenames in workspace, insert `[[selected]]`.

### Layer 2: Link Index

**Location:** `extensions/ritemark/src/links/LinkIndexer.ts`

**Data structure:**
```ts
interface LinkGraph {
  version: 1;
  updatedAt: string;
  nodes: Record<string, NodeMeta>;    // filePath → { title, wordCount }
  edges: Array<{ from: string; to: string; alias: string | null }>;
}
```

**Resolution:** Map `[[note name]]` to a file path using a case-insensitive, extension-optional lookup: `note name` → scan workspace for `**/note name.md` (or `**/Note name.md`).

**Persistence:** Store index in `.ritemark/link-graph.json`. On startup, load if exists, then watch for changes to keep it current.

**Standard link support:** Parse both `[[wiki]]` and `[text](relative/path.md)` as edges (optional, controlled by config). Standard links use relative paths so resolution is simpler.

### Layer 3: Backlinks Panel

**Location:**
- `extensions/ritemark/src/views/BacklinksViewProvider.ts` (VS Code WebviewViewProvider)
- `extensions/ritemark/webview/src/components/backlinks/BacklinksPanel.tsx`

**Flow:**
1. User opens a file → `RitemarkEditorProvider` emits current file path
2. `BacklinksViewProvider` queries `LinkIndexer` for inbound edges to current file
3. Sends `{ type: 'backlinks:update', links: [{path, title, preview}] }` to webview
4. Panel renders a clickable list

**Preview extraction:** Read first 200 characters of context around the `[[...]]` reference in the source file.

### Layer 4: Graph View

**Location:**
- `extensions/ritemark/src/views/GraphViewProvider.ts`
- `extensions/ritemark/webview/src/components/graph/GraphView.tsx`

**Modes:**
- **Local graph:** nodes reachable within N hops from current note (default N=2)
- **Global graph:** entire vault

**React Flow config for force-directed layout:**
- `elkjs` is already installed (`"elkjs": "^0.9.3"`) — use ELK force layout
- Node size proportional to connection count (in-degree + out-degree)
- Color by folder (hash folder path → color from palette)
- Click node → navigate to file

---

## Key Design Decisions to Surface in Sprint Plan

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Wiki-link syntax | `[[note]]` only vs `[[note\|alias]]` | Support both — aliases are standard Obsidian; small incremental cost |
| Standard link graph inclusion | Yes / No / Optional | Make it optional via config; default OFF to keep things simple |
| Scope | Current workspace folder only | Yes — workspace root; multi-root workspaces use first folder |
| TipTap node vs mark | Inline node vs mark | Inline node — atomic, serializeable, Obsidian-compatible |
| Link resolution | Exact filename match vs fuzzy | Case-insensitive, extension-optional (strip `.md`) |
| Graph layout engine | D3-force vs ELK force vs manual | ELK already bundled; use ELK `mrtree` for local, `force` for global |
| Feature flag | Yes — experimental initially | Flag ID: `knowledge-graph` |

---

## Performance Considerations (1000+ files)

- **Link indexing** is CPU-cheap: regex scan, no AI/embeddings. 1000 files at ~10ms each = ~10 seconds max, incremental after that.
- **Graph rendering** with 1000+ nodes can lag. Mitigations:
  - Local graph (2-hop radius) keeps visible nodes to ~20–50
  - Global graph: use React Flow's minimap + hide node labels at zoom < 0.3
  - Debounce layout recalculation on file changes (500ms)
- **Autocomplete** fuzzy search: keep an in-memory filename list, update on file create/delete. Fuzzy match 1000 names is instant.

---

## Risk Areas

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Markdown roundtrip breaks for wiki-links | Medium | Thorough unit tests for serialize/deserialize; keep wiki-links as inline nodes |
| ELK layout hangs on large graphs | Low | Run ELK in a Web Worker or impose node count cap (e.g., 500 nodes max for global view) |
| Link resolution ambiguity (two files with same name) | Low | Show warning in backlinks panel; first match wins |
| `@tiptap/suggestion` conflicts with slash commands | Low | Each suggestion has its own trigger character; `[[` vs `/` are distinct |

---

## File Inventory for This Sprint

**New files to create:**
```
extensions/ritemark/src/links/
├── LinkIndexer.ts          # File watcher + graph builder
├── LinkParser.ts           # Regex/parser for [[...]] and [text](url)
└── index.ts

extensions/ritemark/src/views/
├── BacklinksViewProvider.ts
└── GraphViewProvider.ts

extensions/ritemark/webview/src/extensions/
└── WikiLinkExtension.ts

extensions/ritemark/webview/src/components/backlinks/
├── BacklinksPanel.tsx
└── index.ts

extensions/ritemark/webview/src/components/graph/
├── GraphView.tsx
├── GraphStore.ts
└── index.ts
```

**Modified files:**
```
extensions/ritemark/src/extension.ts       # Register new providers
extensions/ritemark/src/ritemarkEditor.ts  # Forward wiki-link navigate msgs
extensions/ritemark/src/features/flags.ts  # Add knowledge-graph flag
extensions/ritemark/package.json           # Register sidebar views
```
