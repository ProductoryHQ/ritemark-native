# Sprint 72 Spec

## Purpose

Make Ritemark's everyday Markdown editing loop faster and calmer:

- link local project files without remembering paths;
- restructure headings from the table of contents;
- explore editor-only comments without leaking private notes into exported output.

This spec is the source of truth for Sprint 72 implementation. If implementation reveals the spec is wrong, update the spec before changing code.

## Principles

- Prefer user-visible behavior over architecture-first work.
- Keep document editing keyboard-friendly.
- Preserve Markdown portability: saved files should stay understandable outside Ritemark.
- Avoid hidden magic that changes user content unexpectedly.
- Keep #81 comment callouts audit-first until round-trip behavior is proven.

## Requirements

### R1: Inline Local File Links

As a writer, I want to type `@` in the editor and search local project files, so I can create links without leaving the keyboard.

Acceptance criteria:

- Typing `@` at a valid text boundary opens a file-search dropdown.
- Typing characters after `@` filters the dropdown.
- Results show a readable file name and enough path context to distinguish duplicates.
- Arrow keys move through results.
- Enter inserts the selected file as a Markdown link.
- Escape closes the dropdown and leaves typed text intact.
- Inserted links use a path relative to the current document.
- Link text defaults to the target file basename without extension.
- Search ignores heavy/generated folders such as `.git`, `node_modules`, `dist`, `out`, `build`, `.next`, `.turbo`, `coverage`, `.app` bundles, and `VSCode-*` build outputs.
- **All other workspace files are searchable**, not just a hard-coded Markdown/document/image allowlist. Technical writers must be able to link to source files (`.js`, `.ts`, `.py`, `.yaml`, …) and configuration files (`.env.example`, `.toml`, …) by typing their name. Markdown files still rank highest; recognised reference types (txt/pdf/docx/xlsx/csv/images) rank next; everything else is reachable but ranks last.

### R2: Add Link Dialog Local File Search

As a writer using the Add Link dialog, I want the same `@` file search there, so internal links work consistently in both places.

Acceptance criteria:

- Typing `@query` in the Add Link URL field enters internal-file search mode.
- Selecting a result fills the URL field with the relative path.
- Relative paths selected from search pass validation.
- Existing external URL behavior still accepts `example.com`, `http://...`, and `https://...`.
- Opening external links from the dialog still works only for external URLs.

### R3: Relative Path Correctness

As a writer in a nested folder, I want links to resolve correctly from the current file.

Acceptance criteria:

- Links from `docs/notes/meeting.md` to `docs/briefs/q2-plan.md` insert as `../briefs/q2-plan.md`.
- Links from `docs/notes/meeting.md` to `docs/notes/follow-up.md` insert as `follow-up.md`.
- File names with spaces are preserved and encoded only if the existing Markdown/link system requires it.
- Path separators in saved Markdown are `/`, even on Windows.
- If Ritemark cannot determine a stable current document path, internal file insertion is disabled with a clear empty state.
- In a saved single-file document outside a workspace folder, Ritemark may search files near the current document and still compute relative links from that document.

### R3a: Internal Link Activation Safety

As a writer, I want local-file links to behave like internal links, so Ritemark does not accidentally send private relative paths to an external browser.

Acceptance criteria:

- Relative internal links selected from file search are classified separately from external URLs.
- The Add Link dialog does not show the external-open action for relative internal paths.
- Modifier-clicking a relative internal link does not route the path through external browser opening or auto-prefix `https://`.
- The actual navigation behaviour for internal-link activation is owned by **R7** below — R3a guarantees only that internal links never leak into external URL handling.

### R4: TOC Heading-Level Changes

As a writer restructuring a long document, I want to change heading levels from the table of contents.

Acceptance criteria:

- A TOC item exposes heading-level actions for H1-H6 only from a right-click context menu.
- TOC rows do not show always-visible heading dropdowns or inline level controls.
- Choosing a level updates that heading in the editor.
- The TOC refreshes to show the new hierarchy.
- The operation is undoable in one undo step.
- The current scroll position does not jump unexpectedly.
- The editor selection/focus remains predictable after the action.

### R5: TOC Keyboard Shortcuts

As a keyboard-focused writer, I want heading-level shortcuts to work when a TOC row is focused.

Acceptance criteria:

- With a TOC item focused, `Cmd+Opt+1` through `Cmd+Opt+6` change that heading level on macOS.
- Windows/Linux shortcut behavior is documented during implementation.
- If browser/platform conflicts block reliable shortcut capture, the limitation is documented and the pointer/menu UI remains complete.

### R7: Internal Link Navigation

As a writer working across several Markdown files, I want clicking a local-file link to **open that file**, so I can move between documents without leaving Ritemark. Without this, the entire `@`-link feature becomes a dead-end — links would be created but never followed.

Acceptance criteria:

- **Activation gesture:** Cmd-click (macOS) / Ctrl-click (Windows/Linux) on an internal link opens its target. Regular click continues to open the link-edit dialog so users can still edit links inline.
- **Target resolution:** the link's `href` is resolved against the current document's directory on the extension host. The resolved real path (symlinks followed) is then checked for workspace containment.
- **Workspace containment:** the resolved target must lie inside the current workspace folder. If no workspace folder is open, the resolved target must lie inside the current document's directory or any descendant of it. A target outside the allowed root is rejected with a non-blocking warning notification — **the file is not opened**.
- **Non-existent target:** if the resolved path does not exist on disk, Ritemark shows a non-blocking "File not found: `<rel/path>`" notification and does not open anything.
- **Markdown targets** (`.md`, `.markdown`, `.mdx`) open in a Ritemark editor tab (the `ritemark.markdownEditor` custom editor), in the active editor group, in preview mode unless the user double-clicks.
- **Non-Markdown targets** open via `vscode.open` / the default opener for that file type — images, PDFs, source files, configs. Ritemark does NOT try to render them itself.
- **External URLs** (`http://`, `https://`, `mailto:`, …) keep their existing Cmd-click → external-browser behaviour. The internal-navigation path is taken only when `classifyLinkTarget(href).kind === 'internal'`.
- **Path traversal:** dot-segment paths (`../foo.md`) are normal Markdown and are allowed up to the workspace-containment check. Constructed traversal that escapes the root (e.g. `../../../../etc/passwd`) is rejected by the containment check, not by a syntactic blocklist.
- **Errors must be visible, not silent:** every refusal (out-of-workspace, file-not-found) surfaces a notification so the user understands why nothing happened. Silent no-ops are not acceptable.
- **Cursor / selection:** after a successful internal-link navigation, the previously-active editor's selection is left untouched (the user can navigate back via VS Code's "Go Back" history).

### R6: Comment Callout Audit

As a writer, I want private editor-only notes to be visually distinct and omitted from output, but only if that can be done without corrupting Markdown.

Acceptance criteria:

- Audit fixtures cover single-line HTML comments, multi-line HTML comments, and `///` shorthand.
- Audit records how comments behave through load, edit, save, copy-as-Markdown, PDF export, and Word export.
- Sprint decision is recorded: ship #81, partially ship it, or defer it.
- If shipped, comments are stored as standard `<!-- -->` comments and excluded from rendered/exported output.

## Non-Requirements

- No backlinks or graph view.
- No threaded comments or collaboration metadata.
- No AI-generated link suggestions.
- No agent-library changes.
- No implementation of a full external SDD framework in this sprint.

## Resolved Questions

These were open at sprint kickoff and have since been decided. Kept here as a record of intent.

- **Inline `@` links file-type scope:** include _all_ workspace files except heavy/generated folders (R1). The hard-coded extension allowlist (`.md`, `.txt`, `.pdf`, …) is removed mid-sprint after dev verification showed it blocked technical-writer flows (e.g. `@test-utils.js` → "No matching files"). Markdown still ranks first; ranking carries the prioritisation that the allowlist used to carry.
- **Selected file link text:** basename without extension (implemented in R3).
- **TOC dropdown surface:** the persistent inline TOC ships the right-click context menu. The header-dropdown TOC variant (`components/header/TableOfContents.tsx`) is **dead code** — never imported, never rendered — and is removed in this sprint along with the wasted Phase 4 wiring on it.
- **Modifier-click on internal link:** opens the target file (R7). Defining this as in-scope is the main mid-sprint scope expansion.

## Open Questions

- If comments are deferred, should #81 be split into parser/serialization groundwork and UI follow-up?
