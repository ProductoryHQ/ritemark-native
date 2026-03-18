# Sprint 30: Mermaid Diagram Rendering

## Goal

Render `mermaid` code blocks as visual SVG diagrams inline in the TipTap editor, with a toggle between rendered and source views and graceful error handling.

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - This is a new rendering feature that adds a significant bundle size (mermaid.js ~1.5–2.5MB). It is not platform-specific, premium, or experimental in behavior, but the large download size warrants a kill-switch in case it causes performance problems for users on slower machines.
  - **Decision: No flag at launch.** The feature is pure UI enhancement with no network calls, no permissions, and no risk of data loss. The toggle (code vs. rendered) already provides user control. If bundle size causes regressions we can gate it retroactively via a flag. Document why: small behavioral scope, zero side effects, user-visible toggle built in.

## Success Criteria

- [ ] Opening a file with a ` ```mermaid ` code block shows a rendered SVG diagram, not raw text
- [ ] A "Code" toggle button switches to editable source view and back to rendered view
- [ ] Invalid mermaid syntax shows an error state with the raw code still visible (no crash)
- [ ] Diagrams re-render when the source code changes (after switching back to code view and editing)
- [ ] Theme matches the VS Code editor (dark/light)
- [ ] A `/Mermaid Diagram` slash command inserts a pre-configured mermaid code block
- [ ] Markdown roundtrip is preserved: save and reopen yields identical ` ```mermaid ` fenced block
- [ ] Webview bundle builds without error (`vite build`)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `mermaid` npm dependency | Added to `webview/package.json` |
| Updated `CodeBlockWithCopy.tsx` | Detects `language === 'mermaid'`, renders SVG, handles toggle and errors |
| Mermaid initializer | One-time `mermaid.initialize()` call with VS Code theme detection at module level |
| Slash command entry | "Mermaid Diagram" in `SlashCommands.tsx` |
| CSS styles | Diagram container, toggle button, error state |

## Implementation Checklist

### Phase 1: Dependency and Initialization
- [ ] Add `mermaid` to `extensions/ritemark/webview/package.json` dependencies (use latest v11)
- [ ] Run `npm install` in `extensions/ritemark/webview/`
- [ ] Create `extensions/ritemark/webview/src/lib/mermaid.ts` — initialize mermaid once, export `renderMermaid(id, source)` helper
  - Read `document.body.classList` for `vscode-dark` / `vscode-high-contrast` to pick `dark` or `neutral` theme
  - Call `mermaid.initialize({ startOnLoad: false, theme })` once at module load

### Phase 2: CodeBlockWithCopy Component Extension
- [ ] Update `extensions/ritemark/webview/src/components/CodeBlockWithCopy.tsx`
  - When `node.attrs.language === 'mermaid'`, render in "diagram mode" by default
  - Add state: `showCode: boolean` (default `false` for mermaid blocks, irrelevant for others)
  - Add state: `svgContent: string | null` and `renderError: string | null`
  - `useEffect` watching `node.textContent` + `node.attrs.language`: call `renderMermaid()`, update states
  - Use a unique stable ID per node: `'mermaid-' + useId()` (React 18 `useId` hook)
  - When `showCode === false` (rendered view): show SVG container + hide `NodeViewContent` with CSS (`height: 0; overflow: hidden; position: absolute`), NOT `display: none`
  - When `showCode === true` (code view): show `NodeViewContent` normally + hide SVG
  - Error state: show error message box with raw code visible (fall back to code view)
  - Toggle button: "Diagram" / "Code" label, positioned with existing copy button

### Phase 3: Slash Command
- [ ] Update `extensions/ritemark/webview/src/extensions/SlashCommands.tsx`
  - Add a "Mermaid Diagram" entry with an appropriate icon (e.g., `GitBranch` from lucide-react)
  - Command: `editor.chain().focus().deleteRange(range).setCodeBlock({ language: 'mermaid' }).run()`
  - Insert a starter diagram template as text content after setting the block

### Phase 4: Styles
- [ ] Add CSS for `.mermaid-rendered-diagram` container (padding, border, rounded corners matching other blocks)
- [ ] Add CSS for `.mermaid-toggle-btn` (consistent with existing `.code-copy-btn`)
- [ ] Add CSS for `.mermaid-error` error state (red border, monospace error text)
- [ ] Ensure SVG scales to container width (`svg { max-width: 100%; height: auto; }`)

### Phase 5: Build Verification
- [ ] Run `npm run build` in `extensions/ritemark/webview/` and confirm no errors
- [ ] Note the new bundle size (expected to grow significantly due to mermaid.js)
- [ ] Verify the bundle size does not exceed a sensible threshold (document final size)

## Technical Constraints (from Research)

- `NodeViewContent` MUST remain in the DOM even in rendered mode — use CSS to hide it, not conditional rendering or `display: none`. TipTap loses the editable node reference otherwise.
- `mermaid.initialize()` must be called ONCE at module load, not inside the component render cycle.
- `mermaid.render()` ID must be unique per block. React 18 `useId()` is the right tool.
- mermaid.js cannot be loaded from CDN — VS Code webview CSP blocks external scripts. Must bundle via Vite.
- No new TipTap extension or Turndown rule is needed — roundtrip works via existing fenced code block serialization.

## Risks

| Risk | Mitigation |
|------|------------|
| Bundle size grows by ~1.5–2.5MB | Acceptable for this feature; document final size; revisit if load time regresses |
| `mermaid.render()` ID collisions across multiple blocks | Use `useId()` which is unique per component instance |
| NodeViewContent hidden incorrectly | Use `position: absolute; height: 0; overflow: hidden` not `display: none` |
| Theme mismatch after system theme switch | Re-initialize on `vscode-dark` class change (stretch goal) |
| Mermaid render errors crash component | Wrap `render()` in try/catch, show error UI |

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** Yes — Jarmo must approve before Phase 3 (DEVELOP) begins

## Approval

- [ ] Jarmo approved this sprint plan
