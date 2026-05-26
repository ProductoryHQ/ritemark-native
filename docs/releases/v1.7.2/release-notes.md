---
date: 'TBD'
title: 'Ritemark v1.7.2 — Local file links and TOC restructuring'
author: Jarmo Tuisk
tags:
  - sprint-72
  - markdown-navigation
  - file-links
  - table-of-contents
  - heading-levels
  - link-navigation
  - draft
---

# Ritemark v1.7.2 — Local file links and TOC restructuring

**Status:** Draft
**Type:** Feature release
**Focus:** Make Ritemark's everyday Markdown editing loop faster and calmer. Type `@` anywhere in the editor to link any local file in seconds, restructure long documents from the table of contents with a right-click or `⌥⌘1-6`, and Cmd-click a link to jump straight to the file. No more bouncing through the Finder to find a relative path.

* * *

## Downloads

The release page will list every shipped asset (macOS DMGs and the Windows installer) once the build is cut. Until then:

> _v1.7.2 is in progress. The GitHub Release page is created at cut time._

* * *

## Why This Release

v1.7.2 is built around one observation: the moment a writer wants to **link to another local file** is also the moment they have to leave Ritemark to find the path. They open Finder, click into a folder, count `..` segments, and come back to type something that looks like `../../briefs/q2-plan.md`. Then, when they want to follow that link two weeks later, there is no way to do it from inside Ritemark — the link is just text that styles itself like a link without acting like one.

This release closes that loop in three pieces:

- **Type `@` anywhere in the editor** and a file-search picker opens. Type a few characters of any filename in the workspace. Press Enter — Ritemark inserts a Markdown link with the correct relative path and the basename as the visible text. The Add Link dialog (Cmd+K) understands the same `@`-prefix so the two flows feel identical.
- **Cmd-click that link to follow it.** Markdown targets open as Ritemark documents; PDFs, images, CSVs, source files open through VS Code's default opener so a doc-set can include diagrams, spreadsheets, and code references without dead links. Out-of-workspace traversal attempts and missing files surface non-blocking notifications instead of failing silently.
- **Right-click any row in the persistent Table of Contents** and pick a heading level (H1–H6), or press `⌥⌘1-6` while a TOC row is focused. The whole change is a single undo step and the scroll position stays put — restructuring a long document no longer ricochets the viewport up and down.

This is Sprint 72 — a deliberate pivot to day-to-day Markdown editing instead of more agent infrastructure. The full sprint trail (spec, scenarios, technical plan, tasks, BDD-style verification matrix) lives under `docs/development/sprints/sprint-72-markdown-navigation-annotations/`.

Closes [#79](https://github.com/ProductoryHQ/ritemark-native/issues/79) (TOC heading-level changes from the context menu) and [#80](https://github.com/ProductoryHQ/ritemark-native/issues/80) (`@`-mention local file links). Defers [#81](https://github.com/ProductoryHQ/ritemark-native/issues/81) (Markdown comment callouts) — audit recorded the `marked` → TipTap → Turndown pipeline does not round-trip comments reliably enough to ship without rework.

* * *

## What's New

### Type `@` to link any local file

Anywhere in a Markdown document, type `@` and a search picker appears at the cursor. Start typing — results filter on the fly. Arrow keys move through the list, Enter inserts the file as a Markdown link with the basename as the visible text and a relative path as the target. Escape dismisses the picker without inserting anything.

Two important details from sprint owner feedback:

- **All workspace files are searchable.** The original spec hard-coded a small allowlist (Markdown, txt, PDF, docx, xlsx, csv, images) and during dev verification typing `@test-utils.js` returned "No matching files." A technical writer cannot live with that. The allowlist is gone in v1.7.2 — any file outside heavy/generated folders (`node_modules`, `.git`, `dist`, `out`, `build`, `.next`, `.turbo`, `coverage`, `.app` bundles, `VSCode-*` outputs) is reachable. Markdown still ranks highest; docs/data/images rank next; code and configs come last but they exist.
- **The Add Link dialog speaks the same `@`-syntax.** Open the dialog with Cmd+K, type `@spec` in the URL field, pick `spec.md`, click Add. The relative path lands in the link the same way as the inline picker. The dialog hides the "open in browser" affordance for internal targets — relative paths are never silently auto-prefixed with `https://`.

### Cmd-click follows internal links

The `@`-picker creates links that can finally be followed. Cmd-click (Ctrl-click on Windows/Linux) on any internal Markdown link in the editor:

- **Markdown targets** (`.md`, `.markdown`, `.mdx`) open as Ritemark documents in a new tab.
- **Everything else** — PDFs, images, CSVs, source files, configs — opens through VS Code's default opener, so the Markdown editor never tries to render a file it shouldn't.
- **External URLs** (`http://`, `https://`) keep the existing system-browser behaviour.

The extension host validates every target. The resolved real path (symlinks followed) must lie inside the current workspace, or inside the document's parent directory when there is no workspace folder. Out-of-workspace traversal — including symlinks that escape the workspace at the real-path layer — surfaces a non-blocking warning "Link target is outside the workspace." Missing targets surface "File not found." Both refusals are visible by design; silent no-ops are not acceptable here.

Regular click on a link still opens the Edit Link dialog so you can edit or remove the link without modifier gymnastics. The dialog itself now has a small `↗` icon next to the URL input — works for both internal and external targets — that opens the current target without dismissing-then-clicking the link in the editor body.

### Heading levels from the Table of Contents

The persistent inline Table of Contents (the sticky 220-px rail to the left of the editor on screens ≥960px wide) now treats every row as more than a scroll anchor:

- **Right-click any TOC row** and a context menu lists H1–H6 with the platform-correct shortcut hint (`⌥⌘1-6` on macOS, `Ctrl+Alt+1-6` elsewhere). The current heading's level is disabled — you can only move it, not toggle it back to itself.
- **`⌥⌘1-6` works globally inside the editor.** A new TipTap extension catches the shortcut whether the cursor is inside a heading, at a heading boundary (the position the TOC click leaves the cursor in), or on focus inside a TOC row. The previous TipTap default kept extending text selections instead of changing levels; the new binding talks to a shared helper that uses `setNodeMarkup` so the change is a single undo step.
- **Scroll position stays put.** Changing H2 to H4 on a heading that is currently off-screen no longer yanks the viewport. The helper captures the scroll container's `scrollTop` before the transaction and restores it after.
- **Cmd+Z reverts the level in one step.** Heading-level changes are a single editor transaction by design — undo is not a multi-tap exercise.

The header-dropdown TOC variant (`components/header/TableOfContents.tsx`) is **removed** in this release. It was exported from `header/index.ts` but never imported by any consumer — dead code carried since Sprint 51's inline-ToC redesign.

* * *

## What's Not in This Release

- **Markdown comment callouts (#81)** are deferred. The Sprint 72 audit found that the `marked` → TipTap → Turndown pipeline does not preserve `<!-- ... -->` comments reliably enough to ship editor-only callouts without a parser/export rework. The audit is in `docs/development/sprints/sprint-72-markdown-navigation-annotations/research/comment-callout-audit.md` and the precise blockers are recorded on the issue.
- **No-workspace single-file mode for internal links** is functionally implemented and covered by unit tests in `internalLinkResolver.test.ts`, but the dev-mode manual smoke for that mode is intentionally deferred to a real bug report — the resolver tests cover both the "sibling inside doc parent" and "target escapes doc parent" cases.

* * *

## Under the Hood

- Six new files in the webview side: `extensions/FileLinkSuggestions.tsx`, `extensions/FileLinkSuggestionList.tsx`, `extensions/HeadingLevelShortcuts.ts`, `components/ui/context-menu.tsx` (shadcn/Radix primitive), `lib/linkTargets.ts`, `lib/workspaceFileSearch.ts`.
- Two new files on the extension-host side: `src/workspaceFileLinks.ts` (file enumeration + ranking) and `src/internalLinkResolver.ts` (path-traversal-safe resolution).
- New TipTap extension `HeadingLevelShortcuts` re-binds `Mod-Alt-1..6` to a `setNodeMarkup`-based heading-level change that works at heading boundaries — the StarterKit default `toggleHeading` failed silently when the cursor sat at the position the TOC click placed it.
- One mid-sprint bug worth documenting because it is easy to repeat: `vscode.openWith` requires the **exact** `viewType` registered in `package.json`. Calling it with `ritemark.markdownEditor` (the descriptive name) silently falls back to the default text editor; the registered viewType is `ritemark.editor`. Any future `vscode.openWith` call should be cross-checked against the `customEditors` block in `extensions/ritemark/package.json`.
- One macOS-specific gotcha: `fs.promises.realpath` ENOENTs for non-existent files, leaving the lexical path. When the parent dir is symlinked (the workspace lives under `/tmp` → `/private/tmp`), comparing the lexical missing path against a realpath'd workspace root rejects in-workspace missing files as out-of-workspace. The resolver now walks the parent chain to the deepest existing ancestor, realpath's that, and re-attaches the unresolved tail.

* * *

## Tests and Validation

- `validate-qa.sh` passes on the sprint branch.
- Unit tests (run via `npx tsx`): `workspaceFileLinks.test.ts`, `linkTargets.test.ts` (covers the `KNOWN_FILE_EXTENSIONS` regression — `spec.md`, `Notes.PDF`, `test-utils.js`, `Cargo.toml` all classify as internal; `example.com` and `foo.io` still classify as external), and `internalLinkResolver.test.ts` (11 cases including symlinked workspace root, symlink escape, path-traversal escape, missing file under symlinked parent, fragment/query stripping, URL-encoded paths).
- Manual dev-mode QA matrix is recorded in `docs/development/sprints/sprint-72-markdown-navigation-annotations/tasks.md` Phase 7.5.

* * *

## What's Coming Next

This is a Markdown-editing-loop release. The next release will return to the AI/agent surface backlog (Agent Library polish, possibly the deferred Markdown comments work behind a proper parser rework). The `@`-link feature is intentionally minimal — no backlinks, no graph view, no AI-suggested links — and we'll only expand from here if real usage shows the simpler version is missing something.
