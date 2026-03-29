# Sprint 47: Knowledge Graph

## Goal

Add Obsidian-style knowledge graph visualization to Ritemark Native by building a layered stack: wiki-links (`[[note]]` syntax) → link index → backlinks panel → graph view.

## Feature Flag Check

- [x] Does this sprint need a feature flag? **YES**
  - Large, layered feature being built incrementally
  - Experimental initially; each layer can be enabled/disabled independently
  - Flag ID: `knowledge-graph`
  - Status: `experimental` initially, `stable` when all four layers are complete
  - Platforms: `darwin`, `win32`, `linux`

## Success Criteria

- [ ] Typing `[[note name]]` in the editor renders a styled wiki-link chip
- [ ] Cmd+click on a wiki-link navigates to the linked file
- [ ] Typing `[[` shows an autocomplete dropdown with fuzzy-matched file names
- [ ] A background `LinkIndexer` scans the workspace and builds a bidirectional link graph
- [ ] A "Backlinks" panel in the sidebar shows files that link to the current note, with context previews
- [ ] A "Graph View" panel renders the full vault as a force-directed interactive graph
- [ ] A "Local Graph" mode shows only notes connected to the current file (2-hop radius)
- [ ] Clicking a node in the graph opens the corresponding file
- [ ] All layers are gated behind the `knowledge-graph` feature flag
- [ ] Markdown roundtrip preserves `[[...]]` syntax correctly (no data loss)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `WikiLinkExtension.ts` | TipTap inline node: parses/renders `[[note]]` and `[[note\|alias]]` |
| Wiki-link autocomplete | `@tiptap/suggestion` popup on `[[` trigger, fuzzy file search |
| Cmd+click navigation | Extension host resolves link target to file path, opens in editor |
| `LinkIndexer.ts` | Background file scanner + watcher, builds bidirectional graph |
| `LinkParser.ts` | Regex utilities for parsing `[[...]]` tokens from markdown |
| `BacklinksViewProvider.ts` | VS Code sidebar view showing backlinks for current file |
| `BacklinksPanel.tsx` | React webview component: clickable list with context previews |
| `GraphViewProvider.ts` | VS Code sidebar view hosting the graph canvas |
| `GraphView.tsx` | React Flow graph with local/global toggle, color by folder, node sizing |
| Feature flag `knowledge-graph` | Defined in `flags.ts`, gates all features in this sprint |

## Implementation Checklist

### Phase 1: Feature Flag + Link Index Foundation

- [ ] Add `knowledge-graph` flag to `extensions/ritemark/src/features/flags.ts`
- [ ] Create `extensions/ritemark/src/links/LinkParser.ts` — regex for `[[target]]`, `[[target|alias]]`, and `[text](relative.md)`
- [ ] Create `extensions/ritemark/src/links/LinkIndexer.ts` — file scanner + watcher + graph structure
- [ ] Create `extensions/ritemark/src/links/index.ts` — public exports
- [ ] Register `LinkIndexer` in `extension.ts` alongside `DocumentIndexer` (only when flag enabled)
- [ ] Add unit tests for `LinkParser.ts` (roundtrip edge cases)

### Phase 2: Wiki-Link TipTap Extension

- [ ] Create `extensions/ritemark/webview/src/extensions/WikiLinkExtension.ts`
  - Inline node schema: `{ target: string, alias: string | null }`
  - `toMarkdown` serializer: outputs `[[target]]` or `[[target|alias]]`
  - `fromMarkdown`: parse `[[...]]` tokens in input
  - Renders as styled chip: `<span class="wiki-link">` with CSS
- [ ] Register `WikiLinkExtension` in the editor (alongside other extensions)
- [ ] Add `turndown` rule for wiki-link spans (HTML → MD conversion)
- [ ] Add `marked` extension for `[[...]]` tokens (MD → HTML parsing)
- [ ] Wire Cmd+click: send `{ type: 'wiki-link:navigate', target }` to extension host
- [ ] Handle `wiki-link:navigate` in `ritemarkEditor.ts` — resolve file, open in editor

### Phase 3: Wiki-Link Autocomplete

- [ ] Create `extensions/ritemark/webview/src/extensions/WikiLinkSuggestion.ts`
  - Trigger: `[[`
  - File list: received from extension host via `{ type: 'workspace:files' }` message
  - Fuzzy filter on file basenames
  - Insert selected file as `[[filename]]` node
- [ ] Extension host: send workspace file list on webview load and on file create/delete
- [ ] Add message handler in `ritemarkEditor.ts` for `wiki-link:request-files`

### Phase 4: Backlinks Panel

- [ ] Create `extensions/ritemark/src/views/BacklinksViewProvider.ts`
  - Implements `vscode.WebviewViewProvider`
  - Listens for active editor changes
  - Queries `LinkIndexer` for inbound edges
  - Sends `{ type: 'backlinks:update', items: [{path, title, preview}] }` to webview
- [ ] Create `extensions/ritemark/webview/src/components/backlinks/BacklinksPanel.tsx`
  - Renders list of backlinks with title + 1-line preview
  - Click → send `{ type: 'backlinks:navigate', path }` to extension host
- [ ] Register `BacklinksViewProvider` in `extension.ts`
- [ ] Add view contribution to `package.json` (sidebar, below explorer)

### Phase 5: Graph View

- [ ] Create `extensions/ritemark/src/views/GraphViewProvider.ts`
  - Sends full graph data `{ type: 'graph:data', nodes, edges }` to webview
  - Listens for active editor change to highlight current node
- [ ] Create `extensions/ritemark/webview/src/components/graph/GraphView.tsx`
  - React Flow canvas with ELK force layout
  - Local/global toggle switch
  - Color nodes by folder (hash path → CSS color)
  - Node size: proportional to connection count (min 8px, max 24px)
  - Click node → `{ type: 'graph:navigate', path }`
  - Minimap for global view
- [ ] Register `GraphViewProvider` in `extension.ts`
- [ ] Add view contribution to `package.json`

### Phase 6: Integration + Polish

- [ ] Gate all new UI behind `isEnabled('knowledge-graph')` checks
- [ ] Add CSS for wiki-link chip style (matches Ritemark design language)
- [ ] Handle unresolved wiki-links (file not found): show with muted/strikethrough style
- [ ] Test markdown roundtrip with wiki-links: save → reload → verify `[[...]]` preserved
- [ ] Test backlinks panel updates when files are renamed/deleted
- [ ] Test graph updates on new file creation

## Open Decisions (Resolved in Research)

| Decision | Resolution |
|----------|-----------|
| Wiki-link syntax | Support both `[[note]]` and `[[note\|alias]]` |
| Standard links in graph | Optional, default OFF — config in feature settings |
| TipTap node vs mark | Inline node (atomic, serializable) |
| Link resolution | Case-insensitive, strip `.md` extension |
| Graph layout | ELK: `mrtree` for local, `force` for global |
| New npm packages | Zero — all dependencies already present |
| Feature flag | Yes — `knowledge-graph`, status: `experimental` |

## Risks

| Risk | Mitigation |
|------|-----------|
| Markdown roundtrip breaks for `[[...]]` | Unit test serialize/deserialize; inline node ensures atomicity |
| ELK layout hangs on large vaults | Node cap 500 for global view; local graph stays small |
| Autocomplete conflicts with slash commands | Different trigger chars `[[` vs `/` — no conflict |
| Link ambiguity (two files same name) | First match wins; show warning in backlinks panel |

## Research Documents

| Document | Contents |
|----------|----------|
| `research/01-codebase-analysis.md` | Existing infrastructure audit (RAG indexer, TipTap extensions, React Flow, bridge protocol) |
| `research/02-dependency-audit.md` | Dependency check — zero new deps needed |
| `research/03-architecture-design.md` | Full architecture: WikiLink node, LinkIndexer, Backlinks panel, Graph view |

## Status

**Current Phase:** 1 (RESEARCH) — Complete
**Next:** Phase 2 (DESIGN) — Awaiting Jarmo's approval

## Approval

- [ ] Jarmo approved this sprint plan
