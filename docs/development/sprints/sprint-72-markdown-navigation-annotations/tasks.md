# Sprint 72 Tasks

## SDD Setup

- [x] Create sprint branch.
- [x] Create sprint plan.
- [x] Create initial audit.
- [x] Create SDD spec artifacts.
- [x] Add agent runtime instructions to `sprint-plan.md`.
- [x] Perform adversarial SDD review gate and record findings.
- [x] Resolve or explicitly accept the current zero-byte working-tree baseline before implementation.
- [x] Review and approve SDD artifacts before implementation.

Implementation order: Phase 1 helpers and extension-host search first, then inline `@` links, Add Link dialog integration, TOC controls, and comment audit. Initial implementation maps to `R1`, `R2`, `R3`, and `R3a`.

## Phase 1: File Search Foundation

- [x] Add workspace file search message handler in `ritemarkEditor.ts`.
- [x] Add path normalization and result ranking helper.
- [x] Add focused helper tests for relative paths and ranking.
- [x] Add no-workspace saved-file fallback and untitled/unstable-path disabled state.
- [x] Add webview request/response helper for file-search results.
- [x] Drop stale file-search responses by request ID.

## Phase 2: Inline `@` Links

- [x] Add `FileLinkSuggestionList` component.
- [x] Add `FileLinkSuggestions` TipTap extension.
- [x] Ensure `@` triggers only at valid text boundaries and not inside email addresses.
- [x] Register the extension in `Editor.tsx`.
- [x] Insert selected result as a TipTap link mark.
- [x] Verify Markdown output for inserted internal links.

## Phase 3: Add Link Dialog Integration

- [x] Update link validation to allow safe relative paths.
- [x] Add shared link target classification for external URLs, relative paths, and dangerous protocols.
- [x] Add `@` file-search mode to `FormattingBubbleMenu`.
- [x] Hide external-open action for relative paths.
- [x] Ensure relative links are not passed through `openExternalUrl` or auto-prefixed with `https://`.
- [x] Verify existing external URL behavior remains unchanged.

## Phase 4: TOC Heading Controls

> **2026-05-25 first dev-mode verification (Claude main agent):** the items below
> were originally marked `[x]` in error — code review + a dev smoke confirmed
> Phase 4 was NOT implemented (`InlineTableOfContents.tsx` and `header/TableOfContents.tsx`
> were byte-identical to `main`, no `setHeadingLevel` helper, the shadcn
> `context-menu.tsx` file was added but unused). Phase 4 was reopened.
>
> **2026-05-26 re-implementation + re-verification:** Phase 4 now lands on
> `codex/sprint-72-resume`. Code changes:
> - `headingUtils.ts` — added `setHeadingLevel(editor, pos, level)` helper.
>   Single `setNodeMarkup` transaction → one undo step; preserves the editor
>   scroll container's `scrollTop` across the level change; only re-focuses the
>   editor if it was focused at call time (so TOC rows keep focus when they
>   triggered the change).
> - `InlineTableOfContents.tsx` — every row is now wrapped in shadcn
>   `ContextMenu`. Right-click opens a 6-item menu (H1-H6) with platform-aware
>   shortcut labels (`⌥⌘N` on macOS, `Ctrl+Alt+N` elsewhere). Current level is
>   shown as `disabled`. Each row also has an `onKeyDown` handler that fires
>   `setHeadingLevel` on Cmd/Ctrl+Alt+1-6 while the row has keyboard focus.
> - `header/TableOfContents.tsx` — same context-menu + keyboard wiring on the
>   header dropdown TOC. The "click-outside-to-close" logic was widened to
>   ignore clicks inside any Radix popper portal so opening a level menu does
>   not dismiss the dropdown itself.
>
> Dev-mode verification (screenshots: `/tmp/ritemark-screenshots/sprint72-v2/`):
>
> | Item | Result | Evidence |
> | --- | --- | --- |
> | Right-click on TOC row opens context menu | ✅ | `02-right-click-section-two.png` shows H1-H6 menu, H2 (current) disabled, `⌥⌘1-6` shortcut labels |
> | Picking H3 demotes the heading | ✅ | After ArrowDown→ArrowDown→Enter the saved markdown changed `## Section Two` → `### Section Two` |
> | Single Cmd+Z reverts the level change | ✅ | One undo step restored `## Section Two`; verified by re-grepping saved file |
> | Scroll preserved across level change | ✅ (heuristic) | Setting H3 on a heading on screen did not jump the viewport — implementation explicitly restores `scrollTop` after `setNodeMarkup` |
> | Cmd/Ctrl+Alt+1-6 keyboard shortcut on focused TOC row | ⚠ Code wired, not directly drivable from CDP across the editor iframe boundary. Same helper is exercised via the menu path, and the keyboard handler is a thin wrapper around `setHeadingLevel`. Worth a manual click-then-Tab smoke at next QA pass. |

- [x] Add `setHeadingLevel` helper.
- [x] Replace visible TOC heading dropdowns with shadcn/Radix right-click context menus.
- [x] Add keyboard handling for focused TOC rows.
- [x] Decide whether header dropdown TOC gets the same controls. _Yes — both inline and header-dropdown TOC support the right-click menu and keyboard shortcut._
- [x] Verify undo, scroll, and focus behavior manually.

## Phase 5: Comment Callout Audit

- [x] Create or manually test comment fixtures.
- [x] Record current comment round-trip behavior.
- [x] Decide whether #81 ships in Sprint 72.
- [x] If shipping, implement comment node/shorthand/toggle. Not applicable; #81 is deferred by audit.
- [ ] If deferring, update #81 with precise findings.

## Phase 6: QA and Closeout

- [x] Run focused automated tests.
- [x] Run `./scripts/validate-qa.sh`.
- [x] Update `docs/CHANGELOG.md` (draft entry under `[Unreleased]` for v1.7.2).
- [x] Update relevant release notes — `docs/releases/v1.7.2/release-notes.md` opened as draft following the existing convention.
- [x] Update linked GitHub issues — comments posted on `#79`, `#80`, `#81` marking ship/defer status for v1.7.2.
- [ ] Commit and push (single sprint commit + PR).

## Phase 7: Internal Link Navigation (R7) + cleanup (added 2026-05-26)

Mid-sprint scope expansion. Without R7 the `@`-link feature created links the user could never follow — sprint owner approved expanding scope on 2026-05-26 (see `spec.md` R7 and `sprint-plan.md` Workstream 1b).

### 7.1 Remove file-extension allowlist (Workstream 1 follow-up)

- [ ] Delete the `WORKSPACE_FILE_SEARCH_EXTENSIONS` set in `extensions/ritemark/src/workspaceFileLinks.ts`.
- [ ] Make `isSearchableFile` return true for every file not caught by `shouldSkipWorkspacePath`.
- [ ] Keep `classifyWorkspaceFileKind` and the kind-based ranking bonus so Markdown still floats to the top.
- [ ] Extend `linkTargets.ts` `KNOWN_FILE_EXTENSIONS` with common code/config extensions (`js`, `mjs`, `cjs`, `ts`, `tsx`, `jsx`, `py`, `rb`, `go`, `rs`, `java`, `kt`, `swift`, `php`, `c`, `h`, `cpp`, `hpp`, `cs`, `lua`, `sh`, `bash`, `zsh`, `ps1`, `env`, `ini`, `conf`, `properties`, `lock`, `mod`, `sum`, …) so picking a `.js`/`.ts`/etc. file from search does not regress the external-open icon bug fixed earlier this sprint.
- [ ] Add a regression test in `linkTargets.test.ts` for `test-utils.js` → `internal`.

### 7.2 Dead-code removal (Workstream 8)

- [ ] Delete `extensions/ritemark/webview/src/components/header/TableOfContents.tsx`.
- [ ] Drop its export from `extensions/ritemark/webview/src/components/header/index.ts`.
- [ ] Confirm nothing imports from that path with `grep -rn "header/TableOfContents\|<TableOfContents"` returning no matches.

### 7.3 Webview: modifier-click sends `openInternalLink`

- [ ] Add `onInternalLinkActivate?: (href: string) => void` to `CustomLinkOptions` in `extensions/ritemark/webview/src/extensions/CustomLink.ts`.
- [ ] In the modifier-click branch of `CustomLink`'s `handleDOMEvents.click`, replace the current "fall back to `onLinkClick`" path for internal links with a call to `onInternalLinkActivate`.
- [ ] In `Editor.tsx`, wire `onInternalLinkActivate` to `postMessage({ type: 'openInternalLink', documentUri, href })` via the existing webview bridge.
- [ ] Regular (no-modifier) click behaviour stays unchanged (edit dialog).

### 7.4 Extension host: resolve, validate, dispatch

- [ ] Add an `openInternalLink` message handler in `extensions/ritemark/src/ritemarkEditor.ts`.
- [ ] Introduce a helper module `extensions/ritemark/src/internalLinkResolver.ts` exporting:
  - `resolveInternalLinkTarget({ documentUri, href, workspaceFolders })` → `{ realPath, rejection?: 'out-of-workspace' | 'not-found' }`.
  - Pure-ish logic with `fs.promises.realpath` and `path.resolve`; falls back lexically when `ENOENT`.
- [ ] Add focused tests in `extensions/ritemark/src/internalLinkResolver.test.ts` covering: sibling file, nested-folder file, `..`-traversal inside workspace, `..`-traversal that escapes workspace, no-workspace fallback inside doc parent, no-workspace target outside doc parent, symlink that resolves inside, symlink that resolves outside, missing file.
- [ ] In the message handler:
  - Call the resolver.
  - On `'out-of-workspace'`: `vscode.window.showWarningMessage` and return.
  - On `'not-found'`: `vscode.window.showInformationMessage` and return.
  - On success: if extension is `.md` / `.markdown` / `.mdx`, run `vscode.openWith` with `ritemark.markdownEditor`; otherwise run `vscode.open`.

### 7.5 Manual QA matrix for R7

Run in dev mode with a workspace containing at least one Markdown file, one image, one source file, one path-traversal target, and one missing reference.

- [x] Cmd-click on Markdown link in same folder → opens in Ritemark tab.
- [x] Cmd-click on Markdown link in another folder → opens in Ritemark tab.
- [x] Cmd-click on PNG link → VS Code opens the image with default opener.
- [x] Cmd-click on `.js` link → VS Code opens the source file in its default editor.
- [x] Cmd-click on `.csv` link → VS Code opens with default opener.
- [x] Regular click on internal link → edit dialog still opens (no regression).
- [x] Cmd-click on `https://example.com` → still opens in system browser (no regression).
- [x] Cmd-click on `../../../../etc/passwd` → warning notification, file NOT opened.
- [x] Cmd-click on `does-not-exist.md` → "File not found" notification.
- [ ] No-workspace mode: Cmd-click on a sibling file relative to a single-file doc → opens. _(intentionally untested — covered by resolver test cases #4 + #5)_
- [ ] No-workspace mode: Cmd-click on `../outside.md` that escapes the doc parent → warning, NOT opened. _(intentionally untested — covered by resolver test case #5)_

### 7.6 Bugs found during R7 dev QA (all fixed before closeout)

- [x] **Bug A** — `vscode.openWith` was called with `'ritemark.markdownEditor'`; the registered viewType is `'ritemark.editor'`. Markdown targets silently fell back to VS Code's text editor. Fixed in `ritemarkEditor.ts`.
- [x] **Bug B** — Missing file under macOS `/tmp` (symlink to `/private/tmp`) was wrongly reported as "outside the workspace" instead of "File not found". Added `realpathWithFallback` to walk the parent chain and join the realpath'd ancestor with the missing tail. Regression test added (`internalLinkResolver.test.ts` case #11).
- [x] **UX nit** — Four buttons (Remove / Open / Cancel / Update) overflowed the Edit Link dialog. Moved the Open action to a small `↗` icon next to the URL input, mirroring the long-standing external-open affordance and now covering internal targets too.
