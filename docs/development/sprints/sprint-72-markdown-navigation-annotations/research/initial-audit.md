# Sprint 72 Initial Audit

Date: 2026-05-24

## Summary

Sprint 72 is technically feasible, but #80 is the main implementation driver. `@` file links need a small extension-host search API plus a TipTap suggestion UI. TOC heading changes are narrower because the TOC already tracks ProseMirror positions. Comment callouts should remain audit-first because HTML comments may disappear or round-trip awkwardly through the current `marked` / TipTap / Turndown pipeline.

## Relevant Code Paths

### Editor and serialization

- `extensions/ritemark/webview/src/components/Editor.tsx`
  - Converts Markdown to HTML with `marked`.
  - Converts editor HTML back to Markdown with `turndownService`.
  - Registers TipTap extensions, including `SlashCommands`, `CustomLink`, and heading levels H1-H6.
  - Owns keyboard handling for core editor shortcuts.
- `extensions/ritemark/webview/src/utils/turndownService.ts`
  - Shared Turndown configuration for Markdown output.
- `extensions/ritemark/src/ritemarkEditor.ts`
  - Owns webview message handling for markdown documents.
  - Good place to add a `searchWorkspaceFiles` / `resolveWorkspaceFileLinks` message.

### Existing link UI

- `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`
  - Owns Add/Edit Link dialog.
  - Validates only `http://` and `https://` today via `isValidUrl`.
  - Needs to allow relative paths selected by file search.
  - Existing external link click path opens this same dialog.
- `extensions/ritemark/webview/src/extensions/CustomLink.ts`
  - Click handling is custom.
  - Current configured `validate` in `Editor.tsx` only accepts `http://` / `https://`, so internal relative links need validation changes.

### Existing suggestion UI

- `extensions/ritemark/webview/src/extensions/SlashCommands.tsx`
  - Uses `@tiptap/suggestion`, `ReactRenderer`, and `tippy.js`.
  - This is the best implementation template for inline `@` file link suggestions.
- `extensions/ritemark/webview/src/extensions/CommandsList.tsx`
  - Existing keyboard-navigable popup pattern for slash commands.
  - A separate `FileLinkSuggestionList` should mimic this behavior without overloading slash-command semantics.

### Table of contents

- `extensions/ritemark/webview/src/lib/headingUtils.ts`
  - `getHeadings(editor)` returns `{ level, text, pos }`.
  - `scrollToHeading(editor, pos)` focuses and scrolls.
  - Add a `setHeadingLevel(editor, pos, level)` helper here or nearby.
- `extensions/ritemark/webview/src/components/InlineTableOfContents.tsx`
  - Persistent right-side TOC.
  - Best primary UI for heading-level changes because it is visible during long-document editing.
- `extensions/ritemark/webview/src/components/header/TableOfContents.tsx`
  - Header dropdown TOC.
  - Should either receive the same heading-level affordance or be explicitly kept navigation-only.
- `extensions/ritemark/webview/src/App.tsx`
  - Owns heading refresh and active-heading scroll spy.

## Workstream 1: `@` File Links

Recommended architecture:

1. Extension host receives query from webview.
2. It uses VS Code workspace APIs to search files under the current workspace.
3. It returns capped, ranked results:
   - display name
   - relative path from current document
   - workspace-relative path
   - extension/type
4. Webview renders the suggestions.
5. Selecting a result inserts a TipTap link:
   - inline typed `@foo` becomes linked text
   - link mark `href` is the relative path
   - visible text defaults to basename without extension

Implementation notes:

- Use the existing `SlashCommands` extension as the pattern for TipTap Suggestion wiring.
- Avoid searching `node_modules`, `.git`, `vscode/out`, build/dist directories, and generated app bundles.
- Keep result count small, probably 20.
- Prefer Markdown-ish files in ranking, but allow PDFs, DOCX, spreadsheets, CSV, and images.
- The Add Link dialog should treat `@query` as internal-file mode and not run URL validation for selected relative paths.
- `CustomLink.configure({ validate })` must accept relative internal paths as well as `http(s)`.

Open questions to resolve while implementing:

- Should inline `@` create `[basename](path)` immediately, or insert a link mark with basename text and let Turndown serialize it? Prefer TipTap link mark so editor state stays canonical.
- How should duplicate basenames display? Recommend showing basename plus muted relative folder.
- How should unsaved documents behave? Recommend disable inline internal links with a short empty-state message because relative path cannot be computed reliably.

## Workstream 2: TOC Heading-Level Changes

Recommended architecture:

1. Add a helper that resolves the node at `heading.pos`.
2. Dispatch one transaction that changes node markup to `heading` with the selected `level`.
3. Preserve selection where possible; avoid calling `scrollToHeading` during level changes.
4. Let the existing editor update event refresh headings.

UI recommendation:

- Primary: contextual mini menu or right-click menu in `InlineTableOfContents`.
- Secondary: same menu in `TableOfContents` if the header dropdown remains visible enough to matter.
- Keyboard: when a TOC button has focus, handle `Mod+Alt+1` through `Mod+Alt+6`.

Potential issue:

- Current TOC rows are plain buttons. Adding a context menu should not make hover/focus states shift layout.

## Workstream 3: Comment Callouts

Audit-first because comments cross parsing boundaries:

- `marked` may parse HTML comments into HTML comment nodes.
- TipTap StarterKit may preserve or drop comments depending on schema support.
- `turndownService` may ignore comments or fail to serialize them back.
- Export paths use both Markdown and HTML, so "excluded from export" is easy only if comments are stored as true comments and not rendered callout text.

Recommended audit fixtures:

```markdown
Before

<!-- private note -->

After
```

```markdown
/// private shorthand note
```

```markdown
<!--
multi-line note
with **markdown-ish** text
-->
```

Possible implementation options:

1. TipTap custom node for comments with custom parse/render rules.
2. Preprocess Markdown comments into safe placeholder nodes before `marked`, then Turndown them back to `<!-- -->`.
3. Defer comments to a separate sprint if custom schema work is larger than expected.

Recommendation:

- Ship #80 and #79 first.
- Only ship #81 if the comment round-trip is straightforward after fixture testing.

## Suggested Implementation Order

1. Extension-host file search API and result shape.
2. Link validation/path normalization changes.
3. Inline `@` suggestion extension.
4. Add Link dialog `@` search.
5. TOC heading-level helper and UI.
6. Comment audit fixture and decision.

## Validation Notes

Focused checks should include:

- Relative link insertion from documents in nested folders.
- File names with spaces.
- Duplicate basenames in different folders.
- Large workspace search responsiveness.
- Editor undo after link insertion.
- TOC heading-level undo.
- Export output for comments if #81 ships.
