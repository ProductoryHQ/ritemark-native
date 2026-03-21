# Sprint 46: Mermaid Diagrams — Research Findings

## 1. How Code Blocks Currently Work

### Extension Stack

Code blocks are handled by `CodeBlockWithCopyExtension`, which extends `@tiptap/extension-code-block-lowlight`:

- **File:** `extensions/ritemark/webview/src/extensions/CodeBlockWithCopyExtension.ts`
- It overrides `addNodeView()` to return a React `NodeViewRenderer`, which renders the component at:
  `extensions/ritemark/webview/src/components/CodeBlockWithCopy.tsx`

### NodeView Component (`CodeBlockWithCopy.tsx`)

The component uses two TipTap primitives:
- `<NodeViewWrapper as="pre">` — wraps the block and provides drag/selection handles
- `<NodeViewContent as="code">` — renders the editable code content inside

It adds a copy button (Copy/Copied! with `lucide-react` icons) layered over the block.

The component receives `node.textContent` and `node.attrs.language` as props.

### Editor Registration (`Editor.tsx`)

In `useEditor()`, `StarterKit` is configured with `codeBlock: false` to suppress the default. The custom extension is registered:

```typescript
CodeBlockWithCopyExtension.configure({
  lowlight,
  defaultLanguage: 'plaintext',
  HTMLAttributes: { class: 'tiptap-code-block' },
})
```

`lowlight` is created with `createLowlight(common)` — the common language pack from `lowlight` v3.

### Markdown Roundtrip

- **Load:** `marked` parses markdown to HTML (including ` ```mermaid ` blocks as `<pre><code class="language-mermaid">`)
- **Save:** `TurndownService` with `codeBlockStyle: 'fenced'` serializes `<pre><code>` back to fenced code blocks, preserving the language identifier

No custom Turndown rule for code blocks exists — the default fenced style handles it. This means the mermaid language tag is preserved across load/save cycles.

---

## 2. TipTap Extensions for Code Blocks

### Currently Used
- `@tiptap/extension-code-block-lowlight` v2.1.0 — syntax highlighting via lowlight/highlight.js
- Custom `CodeBlockWithCopyExtension` extends it with a React NodeView

### Mermaid-Specific TipTap Options (from ecosystem research)

There is no official `@tiptap/extension-mermaid`. The standard approach in the TipTap community is:

**Option A: Extend existing NodeView in `CodeBlockWithCopy`**
- Detect `node.attrs.language === 'mermaid'` inside the existing React component
- Conditionally render either the raw code view OR an SVG rendered by mermaid.js
- This requires **no new TipTap extension** — just React component logic

**Option B: Create a separate `MermaidBlock` TipTap node**
- Register a distinct ProseMirror node type for mermaid blocks
- Requires parsing rules to convert `<pre><code class="language-mermaid">` to the new node
- More complex, but gives finer control over serialization
- Risk: the separate node type can break the markdown roundtrip unless Turndown gets a custom rule

**Recommendation: Option A** — lower risk, no new node type, reuses existing serialization.

---

## 3. Webview Bundle Setup

### Vite Config (`extensions/ritemark/webview/vite.config.ts`)

Key facts:
- Output: single `../media/webview.js` (IIFE, `inlineDynamicImports: true`)
- **No code splitting** — everything is bundled into one file
- `assetsInlineLimit: 50000` — assets under 50KB are base64-inlined
- No CSP exceptions exist for external CDN scripts

This means mermaid.js **must be bundled** into `webview.js` rather than loaded from a CDN. CDN loading would be blocked by the VS Code webview Content Security Policy.

### Current Bundle Size
~900KB (per CLAUDE.md invariant). mermaid.js is approximately 1.5–2.5MB minified (it includes Dagre, elkjs layouts, and D3). This will significantly increase bundle size.

**Mitigation strategies:**
1. Use `mermaid` with tree-shaking — import only what is needed
2. `mermaid` v11 supports lazy-loading diagrams; only the core is needed upfront
3. Use `mermaid/dist/mermaid.esm.min.mjs` (the ES module build) for better tree-shaking

---

## 4. How to Integrate mermaid.js Rendering

### mermaid.js v11 API (current stable)

```typescript
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'neutral' })

// Render to SVG string
const { svg } = await mermaid.render('diagram-id', diagramSource)
```

The `render()` function:
- Is async
- Returns `{ svg: string, bindFunctions?: (el: Element) => void }`
- Throws on invalid syntax — must be caught

### Integration in `CodeBlockWithCopy.tsx`

```typescript
// When language === 'mermaid':
const [rendered, setRendered] = useState<string | null>(null)
const [error, setError] = useState<string | null>(null)
const [showCode, setShowCode] = useState(false)

useEffect(() => {
  if (node.attrs.language !== 'mermaid') return
  mermaid.render('mermaid-' + uniqueId, node.textContent)
    .then(({ svg }) => setRendered(svg))
    .catch((err) => setError(err.message))
}, [node.textContent, node.attrs.language])
```

### Theme Integration

mermaid supports VS Code dark/light themes via its `theme` config:
- `'dark'` for dark themes
- `'neutral'` or `'default'` for light themes
- `'base'` with custom `themeVariables` for full control

The webview already uses VS Code CSS variables (e.g., `--vscode-editor-background`). mermaid's `themeVariables` can be configured to match.

### Toggle (Code vs. Rendered)

The existing `CodeBlockWithCopy` component can be enhanced with a toggle button (similar to the existing copy button). When in "code" mode, the `NodeViewContent` is shown normally. When in "rendered" mode, the SVG is shown and the `NodeViewContent` is hidden (but still present for editing).

**Critical:** `NodeViewContent` must remain in the DOM (even if hidden via CSS) when the cursor is inside the block, otherwise TipTap loses the editable node reference.

---

## 5. Existing Mermaid-Related Code

**None found.** `grep -r "mermaid"` across `extensions/ritemark/` returns no results. This is a greenfield addition.

---

## 6. Key Risks and Constraints

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundle size increase (~1.5–2.5MB) | Webview load time | Measure actual delta; mermaid ESM may tree-shake |
| Mermaid `render()` ID collisions | Broken SVG output | Use stable unique IDs per node (ProseMirror node position or UUID) |
| NodeViewContent must stay in DOM | Editing broken if hidden | Use CSS visibility/height:0, not `display:none` or conditional render |
| VS Code webview CSP | Cannot load external mermaid CDN | Bundle with Vite (confirmed viable) |
| Dark/light theme sync | Diagrams don't match editor theme | Read `document.body.classList` for `vscode-dark` class |
| `mermaid.initialize()` called multiple times | Config errors | Call once at module load, not inside component |

---

## 7. Turndown Serialization for Mermaid Blocks

Because we are using Option A (extending the existing NodeView, not a new node type), the ProseMirror node type remains `codeBlock` with `language: "mermaid"`. Turndown's default fenced code block rule will serialize this as:

```
```mermaid
graph TD...
```
```

No custom Turndown rule needed. The roundtrip is preserved.

---

## 8. Slash Command Addition

A "Mermaid Diagram" entry in the slash command menu (`SlashCommands.tsx`) would insert a code block with `language: 'mermaid'` pre-filled. This uses the existing `setCodeBlock({ language: 'mermaid' })` command from CodeBlockLowlight.

---

## Summary

The cleanest implementation path:

1. Add `mermaid` npm dependency to `webview/package.json`
2. Extend `CodeBlockWithCopy.tsx` to detect language `'mermaid'`, render SVG, handle toggle and errors
3. Initialize mermaid once at module level with VS Code theme detection
4. Add a "Mermaid Diagram" slash command entry
5. Add CSS for the rendered diagram container and toggle button
6. No new TipTap extension or Turndown rule required
