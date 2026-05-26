# Sprint 72 Comment Callout Audit

Date: 2026-05-24

Requirement: `R6`

## Decision

Defer #81 from Sprint 72 implementation.

Current Markdown comments are not safe to ship as editor-rendered callouts without a custom TipTap node or a preprocessing placeholder layer. The MVP for Sprint 72 should finish local-file links and TOC heading controls cleanly, then handle comment callouts in a dedicated parser/serialization pass.

## Fixtures

```markdown
Before

<!-- private note -->

After
```

```markdown
<!--
multi-line note
with **markdown-ish** text
-->
```

```markdown
/// private shorthand note
```

## Findings

### `marked`

`marked` preserves standard HTML comments in the generated HTML:

- single-line comment remains `<!-- private note -->`;
- multi-line comment remains an HTML comment block;
- `/// private shorthand note` is parsed as normal paragraph text.

### TipTap editor load path

The editor loads `marked` HTML into the TipTap document schema. The current schema has no comment node and no placeholder conversion for HTML comment nodes. DOM comment nodes are not represented as editable document content by the current StarterKit-based schema.

Expected result in the current app path:

- existing `<!-- -->` comments are likely dropped once loaded into the editor document;
- `///` remains visible literal paragraph text and is not normalized.

### Save / copy-as-Markdown

Turndown drops HTML comments by default:

- `Before <!-- private note --> After` round-trips through `marked` + Turndown as `Before` / `After` with the comment removed;
- a standalone multi-line HTML comment produces empty Markdown;
- `/// private shorthand note` remains literal Markdown text.

That means comments do not currently round-trip through the save/copy path.

### PDF and Word export

V2 PDF and Word export consume editor HTML plus Markdown fallback. Because comments are not represented in the current editor document, they do not have a reliable editor-only callout representation to strip. If implemented naively as visible callout HTML, export would include the private note unless export filtering were added.

## Recommendation

Defer #81 and split follow-up work into:

- parser/load step that converts `<!-- -->` comments into a custom TipTap comment node;
- input rule for `/// note` that stores `<!-- note -->`;
- Turndown rule that serializes comment nodes back to standard HTML comments;
- export filtering that drops comment nodes from PDF/Word/rendered output;
- fixture tests for single-line, multi-line, shorthand, save, copy-as-Markdown, PDF, and Word paths.
