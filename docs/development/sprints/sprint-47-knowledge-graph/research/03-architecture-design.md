# Architecture Design: Knowledge Graph & Wiki-links

## Overview

This document describes the full architecture for adding Obsidian-style wiki-links, backlinks, and a knowledge graph view to Ritemark Native.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      TipTap Editor (Webview)                    │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ WikiLink Node     │  │ LinkAutocomplete │  │ Graph View   │  │
│  │ (inline, atomic)  │  │ (@tiptap/suggest │  │ (@xyflow/    │  │
│  │ [[note|label]]    │  │  char: '[[')     │  │  react +     │  │
│  │                   │  │                  │  │  ELK force)  │  │
│  └────────┬──────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                      │                    │          │
│  ┌────────┴──────────────────────┴────────────────────┴───────┐ │
│  │                    bridge.ts (postMessage)                  │ │
│  └────────────────────────────┬────────────────────────────────┘ │
└───────────────────────────────┼──────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Extension Host      │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │ LinkIndexer     │  │
                    │  │ - scanFile()    │  │
                    │  │ - getBacklinks()│  │
                    │  │ - getGraph()    │  │
                    │  │ - resolve()     │  │
                    │  └────────┬────────┘  │
                    │           │           │
                    │  ┌────────┴────────┐  │
                    │  │ FileWatcher     │  │
                    │  │ (reuse pattern  │  │
                    │  │  from RAG)      │  │
                    │  └────────┬────────┘  │
                    │           │           │
                    │  ┌────────┴────────┐  │
                    │  │ .ritemark/      │  │
                    │  │ link-index.json │  │
                    │  └─────────────────┘  │
                    └───────────────────────┘
```

## Layer 1: Wiki-link TipTap Extension

### Node Definition

```typescript
// WikiLink — custom inline Node
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true, // Cannot place cursor inside

  addAttributes() {
    return {
      href: { default: null },   // Target file path/name
      label: { default: null },  // Display text (for [[note|label]] syntax)
    }
  },

  parseHTML() {
    return [{ tag: 'wiki-link' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['wiki-link', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView)
  },
})
```

### Node View Component

```tsx
// WikiLinkView.tsx — renders the [[link]] as a clickable chip
import { NodeViewWrapper } from '@tiptap/react'

export function WikiLinkView({ node }: any) {
  const { href, label } = node.attrs
  const displayText = label || href

  return (
    <NodeViewWrapper as="span" className="wiki-link-chip">
      <span className="wiki-link-brackets">[[</span>
      <span className="wiki-link-text">{displayText}</span>
      <span className="wiki-link-brackets">]]</span>
    </NodeViewWrapper>
  )
}
```

### Styling

```css
.wiki-link-chip {
  display: inline;
  cursor: pointer;
  color: var(--vscode-textLink-foreground);
}
.wiki-link-chip:hover {
  text-decoration: underline;
}
.wiki-link-brackets {
  opacity: 0.4;
}
```

### Click Navigation

Add a ProseMirror plugin (same pattern as CustomLink.ts):
- Regular click: navigate to the linked file (send `wikilink:navigate` to extension host)
- Cmd/Ctrl+click: open in split editor

### Markdown Roundtrip

**Loading (MD → TipTap):**
Before passing content to `marked()`, preprocess with regex:
```typescript
// Convert [[note]] and [[note|label]] to custom HTML tags
content = content.replace(
  /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
  (_, href, label) => `<wiki-link href="${href}"${label ? ` label="${label}"` : ''}></wiki-link>`
)
```

**Saving (TipTap → MD):**
Custom Turndown rule:
```typescript
turndownService.addRule('wikiLink', {
  filter: 'wiki-link',
  replacement: (content, node) => {
    const href = node.getAttribute('href')
    const label = node.getAttribute('label')
    return label ? `[[${href}|${label}]]` : `[[${href}]]`
  },
})
```

## Layer 1b: Autocomplete

Reuse `@tiptap/suggestion` (same as SlashCommands):

```typescript
// Trigger on `[[` character sequence
Suggestion({
  editor,
  char: '[[',
  items: ({ query }) => {
    // Request file list from extension host
    sendToExtension('wikilink:search', { query })
    // Return will be async — use a reactive store
    return getFilteredFiles(query)
  },
  command: ({ editor, range, props }) => {
    editor.chain().focus().deleteRange(range)
      .insertContent({
        type: 'wikiLink',
        attrs: { href: props.path, label: props.displayName },
      })
      .run()
  },
  render: () => {
    // Same tippy.js popup pattern as SlashCommands
  },
})
```

**Note:** `@tiptap/suggestion` uses a single `char` trigger. For `[[` (two chars), we need to configure `char: '['` and check the preceding character in `allow()`, OR use an input rule. The Mention extension handles this — study its approach.

**Alternative:** Use ProseMirror `inputRules` to detect `[[` and open a custom popup. This gives more control than suggestion.

## Layer 2: Link Indexer

### Data Structure

```typescript
interface LinkIndex {
  // Forward links: file → list of targets
  forward: Map<string, LinkEntry[]>
  // Reverse links: file → list of sources (backlinks)
  reverse: Map<string, LinkEntry[]>
  // File metadata: path → stats
  files: Map<string, { hash: string; title: string; modified: number }>
}

interface LinkEntry {
  sourcePath: string
  targetPath: string  // Resolved absolute path (or null if unresolved)
  targetName: string  // Raw link text from [[...]]
  lineNumber: number
  context: string     // Surrounding text for preview
}
```

### Scanning Algorithm

```typescript
// Regex for both wiki-links and standard markdown links to local files
const WIKI_LINK_RE = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g
const MD_LINK_RE = /\[([^\]]+)\]\((?!https?:\/\/)([^)]+\.md)\)/g

function scanFile(content: string, filePath: string): LinkEntry[] {
  const links: LinkEntry[] = []
  // ... extract all wiki-links and local markdown links
  // ... resolve target paths relative to workspace
  return links
}
```

### Resolution Strategy

1. Exact match: `[[recipes]]` → `recipes.md` in workspace
2. Basename match: `[[recipes]]` → `cooking/recipes.md`
3. Case-insensitive match
4. If ambiguous (multiple matches), prefer same directory, then alphabetical

### Lifecycle

```
activate() → new LinkIndexer()
         → init() (load from .ritemark/link-index.json)
         → indexAll() (scan all .md files)
         → startWatching() (FileSystemWatcher)
         → on file change → re-scan single file → update forward/reverse maps
```

## Layer 3: Backlinks Panel

### Option A: TreeView (simpler)

Register a `TreeDataProvider` in the extension host. Shows backlinks for the active editor's file. Updates when active editor changes.

```
Backlinks (3)
├── Daily Notes / 2026-03-28.md — "...discussed the [[recipes]] from..."
├── Cooking / meal-plan.md — "...see [[recipes]] for details..."
└── Shopping / list.md — "...items from [[recipes|favorite recipes]]..."
```

**Pros:** Native VS Code UI, minimal webview code, works in explorer sidebar.
**Cons:** Limited styling, can't show inline previews richly.

### Option B: Webview panel (richer)

A webview-based panel showing backlinks with rich context, similar to Obsidian.

**Recommendation:** Start with TreeView (Option A) — faster to build, more native. Upgrade to webview panel later if needed.

## Layer 4: Graph View

### Hosting

New webview panel, similar to how Flows works. Options:
1. **Activity bar view** — in left sidebar, always accessible
2. **Command palette** — `Ritemark: Open Graph View` opens a webview editor tab
3. **Both** — sidebar for local graph, tab for global graph

**Recommendation:** Command opens a webview tab (full real estate), with a mini local graph in the explorer sidebar.

### React Flow Configuration for Knowledge Graph

```tsx
// Key differences from FlowCanvas:
const graphConfig = {
  // Layout
  elkOptions: {
    'elk.algorithm': 'force',
    'elk.force.temperature': 0.01,     // Controls convergence
    'elk.spacing.nodeNode': 80,
  },
  // Node styling
  nodeTypes: {
    noteNode: NoteGraphNode,  // Custom node: circle + label
  },
  // Interaction
  panOnScroll: true,
  zoomOnScroll: true,
  minZoom: 0.1,
  maxZoom: 3,
  fitView: true,
}
```

### Node Appearance

Inspired by Obsidian's graph:
- **Size:** Proportional to connection count (min 8px, max 40px)
- **Color:** By folder/tag (configurable color map)
- **Label:** File name (without extension), shown on hover or always for large nodes
- **Current file:** Highlighted (larger, different color)
- **Edges:** Thin gray lines, highlighted on hover

### Local vs Global Graph

| Feature | Local Graph | Global Graph |
|---------|-------------|--------------|
| Scope | Current file + N-depth neighbors | All files |
| Default depth | 1 (direct connections) | All |
| Performance concern | None (<100 nodes) | Yes (1000+ nodes) |
| Location | Sidebar panel | Full editor tab |

### Performance Strategy for Large Graphs

1. **Lazy rendering:** Only render nodes in viewport
2. **Clustering:** Group folder contents into single nodes when zoomed out
3. **Progressive loading:** Show top-N connected nodes first, load more on demand
4. **Canvas mode:** ReactFlow's `nodesFocusable: false` for better performance

## Implementation Phases

### Phase A: Wiki-links Core (MVP)
- WikiLink TipTap node extension
- Markdown roundtrip (parse + serialize)
- Click to navigate
- Basic styling
- **Estimated complexity:** Medium

### Phase B: Autocomplete
- `[[` trigger with file search popup
- File list from extension host
- Fuzzy matching
- **Estimated complexity:** Medium (pattern exists in SlashCommands)

### Phase C: Link Indexer
- Scan all .md files for links
- Build forward/reverse maps
- File watcher for live updates
- Persist to disk
- **Estimated complexity:** Medium

### Phase D: Backlinks Panel
- TreeView provider
- Context snippets
- Updates on active editor change
- **Estimated complexity:** Low

### Phase E: Graph View
- React Flow graph component
- ELK force layout
- Local graph (sidebar)
- Global graph (editor tab)
- Visual customization (colors, sizes)
- **Estimated complexity:** High (but well-supported by existing deps)

## Open Questions for Jarmo

1. **Link syntax scope:** Support only `[[note]]` wiki-links, or also recognize `[text](file.md)` standard markdown links in the graph?
2. **Heading anchors:** Support `[[note#heading]]` for linking to specific sections?
3. **Graph view priority:** Is the graph view essential for v1, or can we ship wiki-links + backlinks first and add the graph later?
4. **Unresolved links:** Show broken/unresolved `[[links]]` in a different color? Allow creating new files from them?
5. **Tags in graph:** Should `#tags` also create connections in the graph (like Obsidian)?
