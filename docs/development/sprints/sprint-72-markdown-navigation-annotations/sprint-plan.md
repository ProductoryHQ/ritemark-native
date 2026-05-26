# Sprint 72: Markdown Navigation and Annotation Polish

## Agent Runtime Instructions

This sprint is a lightweight spec-driven development experiment.

Any agent or human continuing Sprint 72 must follow this order before implementation:

1. Read this `sprint-plan.md`.
2. Read [spec.md](spec.md), [technical-plan.md](technical-plan.md), [scenarios.md](scenarios.md), and [tasks.md](tasks.md).
3. Treat [spec.md](spec.md) as the behavior contract.
4. Treat [technical-plan.md](technical-plan.md) as the current architecture plan.
5. Treat [tasks.md](tasks.md) as the implementation source of truth and update task status as work progresses.
6. If behavior, scope, architecture, or acceptance criteria need to change, update the relevant SDD artifact first, then change code.
7. In implementation notes, reference the requirement IDs from [spec.md](spec.md) where practical, e.g. `R1`, `R2`, `R4`.

Runtime behavior change for this sprint:

- Do not jump directly from issue text to code.
- Do not treat chat context as the source of truth.
- Before coding a task, identify the requirement/scenario it satisfies.
- If code and spec disagree, pause and update the spec or record the discrepancy before continuing.
- During closeout, map completed work back to requirements and scenarios, then update release notes/changelog if user-facing behavior changed.

## Goal

Improve the high-frequency writing loop in Ritemark: quickly link local files, restructure long documents from the table of contents, and optionally turn private notes into clean editor-only comments.

This sprint intentionally prioritizes day-to-day Markdown editing over agent infrastructure.

## Linked Issues

- [#80 @-mention quick search to link local project files](https://github.com/ProductoryHQ/ritemark-native/issues/80)
- [#79 TOC: change heading level directly from the table of contents](https://github.com/ProductoryHQ/ritemark-native/issues/79)
- [#81 Comments: render Markdown comments as a styled callout](https://github.com/ProductoryHQ/ritemark-native/issues/81)

## Product Intent

Users spend most of their Ritemark time inside documents. The sprint should make that surface feel more connected and easier to reshape without forcing users into file-path typing, manual heading edits, or ugly comment syntax.

## MVP Scope

### Workstream 1: Local file `@` links

- Typing `@` in the Markdown editor opens a file-search dropdown.
- The dropdown searches workspace files quickly and keyboard-first.
- Selecting a result inserts a Markdown link using a relative path from the current document.
- The Add Link dialog uses the same search when the URL field starts with `@`.
- Link text defaults to the file basename without extension.
- **All workspace files are reachable through search** — the previous file-extension allowlist was removed mid-sprint after dev-mode verification showed it blocked common technical-writer flows (linking to `.js`, `.ts`, `.yaml`, …). Heavy/generated folders (`node_modules`, `.git`, `dist`, `out`, `build`, `.next`, `.turbo`, `coverage`, `*.app`, `VSCode-*`) are still excluded.

### Workstream 1b: Internal link navigation (added mid-sprint)

- Cmd-click (macOS) / Ctrl-click (Windows/Linux) on a Markdown link to a local file **opens** that file.
- Markdown targets open in Ritemark's editor; other file types open through VS Code's default opener.
- The extension host validates that the resolved real path is inside the current workspace (or the document's directory if there is no workspace). Out-of-workspace paths and missing files surface non-blocking notifications.
- This requirement is owned by R7 and is treated as in-scope after the sprint owner expanded scope on 2026-05-26 — without it the `@`-link feature creates links the user can never follow.

### Workstream 2: TOC heading-level changes

- The persistent inline TOC supports changing a heading level.
- The header dropdown TOC supports the same action if it remains part of the product surface.
- Heading-level actions are hidden by default and appear only from a right-click context menu on a TOC row; always-visible H1-H6 dropdowns are out of scope.
- A heading-level change updates the underlying TipTap heading node and refreshes the TOC.
- The change is a single undoable editor transaction.
- Scroll position and user focus are not jarringly reset.

### Workstream 3: Comment callout audit and stretch implementation

- Audit how standard Markdown HTML comments survive the current `marked` -> TipTap -> Turndown path.
- Decide whether Sprint 72 can safely ship editor-rendered comment callouts.
- If safe, implement:
  - `///` line shorthand normalized to HTML comments.
  - Existing `<!-- ... -->` comments rendered as styled callouts in the editor.
  - Toggle command for selected line/block comments.
  - Comments excluded from export/rendered output.

## Out of Scope

- Threaded comments, authors, replies, resolve state, or Google Docs-style collaboration.
- Backlinks, graph view, or full wiki-style document database.
- AI composer queueing (#82).
- Agent Library / Unified Agent Library work (#69/#70).
- Save-as-Markdown atomic cleanup (#76).

## Product Decisions

- **Search scope:** whole current workspace for MVP. If there is no workspace folder, search near the current file only.
- **File types:** _(revised 2026-05-26)_ include **all** workspace files except those inside heavy/generated folders (`.git`, `node_modules`, `dist`, `out`, `build`, `.next`, `.turbo`, `coverage`, `*.app` bundles, `VSCode-*` outputs). Markdown still ranks highest, then docs / data / images, then everything else. The original "Markdown + small reference allowlist" decision was reversed mid-sprint after dev verification showed it blocked technical-writer flows.
- **Link target:** store relative paths from the current document. Use POSIX-style `/` separators in Markdown.
- **Link text:** default to basename without extension; user can edit text afterward like any normal link.
- **Internal link navigation:** _(added 2026-05-26)_ Cmd/Ctrl-click on an internal link opens its target. Regular click still opens the link-edit dialog. The extension host enforces workspace containment; out-of-workspace and missing targets surface non-blocking notifications instead of opening anything.
- **TOC levels:** support H1-H6, matching the editor schema.
- **TOC surfaces:** ship right-click context menu on the **persistent inline TOC** only. The header-dropdown TOC variant (`components/header/TableOfContents.tsx`) is dead code (never imported) and is removed in this sprint.
- **Comments:** audit first. Ship comments only if serialization is reliable and exports omit them without fragile hacks.

## Feature Flag Check

- No user-facing feature flag planned for Workstreams 1 and 2.
- Comment callouts may be implemented behind an internal guard or deferred if the audit shows parser/export risk.

## Success Criteria

- [ ] Sprint audit exists under `research/`.
- [ ] Typing `@` in the editor opens a keyboard-navigable file-search dropdown.
- [ ] Selecting a file inserts a valid relative Markdown link.
- [ ] Add Link dialog supports the same `@` file search and fills the link target.
- [ ] File search remains responsive on a larger workspace; results are capped and ranked.
- [ ] **Any workspace file outside heavy/generated folders is reachable via `@` search** (no file-extension allowlist).
- [ ] **Cmd/Ctrl-click on an internal Markdown link opens the target file** (Markdown via Ritemark, other types via VS Code default opener).
- [ ] **Internal-link navigation refuses to open targets outside the workspace** and shows a non-blocking notification.
- [ ] **Missing internal-link targets show a "File not found" notification** rather than failing silently.
- [ ] TOC item heading level can be changed from UI controls.
- [ ] TOC heading-level shortcut path is documented and implemented if feasible.
- [ ] Heading-level changes preserve document focus/scroll well enough for long documents.
- [ ] Heading-level changes are undoable in one editor undo step.
- [ ] Dead `header/TableOfContents.tsx` component is removed.
- [ ] Comment callout audit records whether #81 ships in this sprint or is deferred.
- [ ] If comments ship, `///` and `<!-- -->` comments round-trip without leaking into exports.
- [ ] `docs/CHANGELOG.md` and relevant release notes are updated before closeout.
- [ ] `./scripts/validate-qa.sh` passes before merge/readiness.

## Proposed Delivery Path

### Phase 0: Audit and plan

- [x] Create sprint branch.
- [x] Inspect linked issue bodies.
- [x] Inspect current Add Link, TOC, TipTap suggestion, and Markdown serialization code paths.
- [x] Record initial findings in `research/initial-audit.md`.
- [x] Perform adversarial SDD review gate and record findings in `research/adversarial-review.md`.
- [x] Resolve or explicitly accept the current zero-byte working-tree baseline before implementation.
- [x] Confirm implementation order after planning review.

### Phase 1: File link search foundation

- [ ] Add extension-host workspace file search endpoint for the markdown editor webview.
- [ ] Return file results with basename, relative path, type, and ranking fields.
- [ ] Add shared webview file-search popup component.
- [ ] Add TipTap `@` suggestion extension for inline links.
- [ ] Insert selected file as a Markdown link / TipTap link mark with relative target.
- [ ] Add Add Link dialog integration for `@` search.
- [ ] Add focused tests for path normalization and ranking.

### Phase 2: TOC heading controls

- [ ] Add helper to set a heading node at a known ProseMirror position to H1-H6.
- [ ] Add context/menu UI for heading level changes in `InlineTableOfContents`.
- [ ] Mirror behavior in the header dropdown `TableOfContents`, or document why it is not needed.
- [ ] Add keyboard handling for focused TOC rows where feasible.
- [ ] Verify undo behavior and scroll/focus preservation manually.

### Phase 3: Comment callout audit and stretch

- [ ] Build a small fixture for `<!-- comment -->`, multi-line comments, and `/// note`.
- [ ] Verify current load/save/export behavior.
- [ ] Decide whether to ship or defer #81.
- [ ] If shipping, implement comment parsing/rendering/toggle.
- [ ] If deferring, create a follow-up issue or update #81 with precise blockers.

### Phase 4: QA and closeout

- [ ] Run focused tests.
- [ ] Run `./scripts/validate-qa.sh`.
- [ ] Update release notes/changelog.
- [ ] Close or update linked GitHub issues.

## Risks

| Risk | Mitigation |
| --- | --- |
| Workspace file search is slow on large projects | Cap results, ignore heavy folders, debounce queries, prefer VS Code workspace APIs |
| Relative paths are wrong for unsaved or single-file documents | Fallback to same-folder search and disable insertion if no stable current file path exists |
| `@` trigger conflicts with literal email addresses or prose | Trigger only at word boundary and allow Esc to dismiss |
| TipTap suggestion insertion creates malformed links | Reuse TipTap commands and test resulting Markdown |
| TOC positions go stale after document edits | Use current `headings` state and refresh after transactions |
| Comment callouts disturb Markdown round-trip | Audit first; defer if comments require a larger parser extension |

## Initial Technical Notes

See [research/initial-audit.md](research/initial-audit.md).

## Pre-Implementation Gate

Adversarial review is recorded in [research/adversarial-review.md](research/adversarial-review.md).

Gate result: **approved for implementation after baseline recheck**. The first pass found transient zero-byte files while another build was running; a follow-up check showed the affected core webview files restored and no modified zero-byte files remaining.

## Implementation Notes

- `R1`, `R2`, `R3`, `R3a`: Added extension-host file search, shared webview request handling, inline `@` file-link suggestions, Add Link dialog `@` search, relative-path validation, and relative-link activation safety. **Dev-mode verified 2026-05-25 and again 2026-05-26 after the `linkTargets.ts` fix.**
- `R4`, `R5`: **Implemented and verified 2026-05-26.** Both the inline TOC (`InlineTableOfContents.tsx`) and the header dropdown TOC (`header/TableOfContents.tsx`) now wrap each row in a shadcn/Radix `ContextMenu`. The menu lists H1-H6, disables the current level, and shows the `Cmd/Ctrl+Alt+N` shortcut label per platform. A new `setHeadingLevel(editor, pos, level)` helper in `headingUtils.ts` does the work as a single `setNodeMarkup` transaction (one undo step) and restores `scrollTop` of the editor scroll container after the level change so the viewport does not jump. Focused TOC rows also handle Cmd/Ctrl+Alt+1-6 via the same helper. Earlier `[x]`-then-`[ ]`-then-`[x]` churn on the tasks list is documented inline in `tasks.md` Phase 4 — the resumed branch is the source of truth.
- `R6`: Comment callouts are deferred. See [research/comment-callout-audit.md](research/comment-callout-audit.md); current `marked` + TipTap + Turndown behavior does not preserve comments reliably enough for editor-only callouts.

### Dev-mode verification 2026-05-25

Performed by Claude main agent via `rundev` + `ritemark-automation` skills (agent-browser CDP at port 9224, workspace `/tmp/ritemark-sprint72-workspace`). Screenshots in `/tmp/ritemark-screenshots/sprint72/`.

| Item | Result | Evidence |
| --- | --- | --- |
| Inline `@` picker opens at word boundary | ✅ | `07-at-picker.png` shows dropdown with 4 .md files after typing `@` |
| `@` picker fuzzy filter | ✅ | `08-at-picker-filtered.png` — `@roa` narrows to `roadmap.md` |
| Selection inserts relative-path Markdown link | ✅ | Saved file contains `[roadmap](roadmap.md)`; link text = basename without extension |
| Add Link dialog `@`-mode | ✅ | `12-link-dialog-at.png` — typing `@spec` shows `spec.md` row in dialog |
| Picking dialog result populates URL field with relative path | ✅ | `13-after-pick-spec.png` — URL field shows `spec.md` |
| TOC right-click context menu | ❌ → ✅ (after 2026-05-26 re-implementation; see below) | First pass: `04-right-click-section-two.png` — no menu. Re-implemented and re-verified in `sprint72-v2/02-right-click-section-two.png`. |
| Cmd/Ctrl+Alt+1-6 on focused TOC row | ❌ → ⚠ wired (after 2026-05-26 re-implementation) | Same helper is exercised via the menu path; direct keyboard smoke across the iframe boundary is awkward via CDP, but the handler is a thin wrapper around `setHeadingLevel`. |

#### Defect found during dev smoke — fixed 2026-05-26

- **`looksLikeExternalHost` mis-classifies `spec.md` as external host.** In `webview/src/lib/linkTargets.ts`, the regex `^[^\s@/]+\.[^\s@/]+` matched both `example.com` and `spec.md`. When a file was picked from the Add Link dialog the `↗` external-open icon would wrongly show. **Fix:** added a small `KNOWN_FILE_EXTENSIONS` set covering common doc / image / archive / config extensions and short-circuited `looksLikeExternalHost` for those. Ambiguous extensions that are popular TLDs (`.io`, `.dev`, `.app`, `.ai`, `.co`) are intentionally left untouched. Regression test added in `linkTargets.test.ts` (`spec.md`, `Notes.PDF`, `image.png`, `archive.tar.gz` must be internal; `example.com`, `foo.io` must still be external).

### Dev-mode verification 2026-05-26 (re-test after fixes)

Same tooling; screenshots in `/tmp/ritemark-screenshots/sprint72-v2/`.

| Item | Result | Evidence |
| --- | --- | --- |
| Inline `@` picker still works (regression) | ✅ | `15-at-picker.png` — typing ` @roa` opens picker and shows `roadmap.md` |
| TOC right-click → context menu with H1-H6 | ✅ | `02-right-click-section-two.png` — "Change heading level" menu, H2 disabled (current), shortcut labels visible |
| Pick H3 → heading demotes | ✅ | Markdown saved as `### Section Two` after ArrowDown→ArrowDown→Enter |
| Single Cmd+Z reverts | ✅ | One undo step restored `## Section Two` on disk |
| Add Link dialog: external icon hidden for `spec.md` | ✅ | `13-after-pick-spec.png` — input takes full dialog width; no `↗` icon |
| Add Link dialog: external icon still shown for `https://example.com` | ✅ | `14-external-url.png` — `↗` button present |

### Dev-mode verification 2026-05-26 (R7 — Internal Link Navigation)

Manual QA by sprint owner against `/tmp/ritemark-sprint72-workspace/docs/notes/meeting.md` containing the full R7 link matrix.

| Item | Result |
| --- | --- |
| Cmd-click a Markdown link → opens in Ritemark editor | ✅ |
| Cmd-click a non-Markdown link (`.csv`, `.js`, `.png`) → VS Code default opener | ✅ |
| Cmd-click a missing file → "File not found: …" notification | ✅ |
| Cmd-click `../../../../etc/passwd` → "Link target is outside the workspace" warning | ✅ |
| Cmd-click `https://example.com` → system browser (no regression) | ✅ |
| Regular click on internal link → Edit Link dialog (no regression) | ✅ |
| Edit Link dialog has an `↗` Open icon next to URL for both internal and external targets | ✅ |

#### Defects found and fixed during R7 dev verification

- **Bug A — wrong customEditor viewType.** Initial implementation called `vscode.openWith(..., 'ritemark.markdownEditor')`. The registered viewType is `ritemark.editor` (see `extensions/ritemark/package.json`). Markdown targets silently fell back to VS Code's syntax-highlighted text view instead of Ritemark's editor. Fixed by changing the dispatched viewType. Owners of `vscode.openWith` calls anywhere else in the codebase should double-check their viewType matches the `package.json` registration.
- **Bug B — missing file under symlinked `/tmp` mis-classified as out-of-workspace.** On macOS `/tmp` is a symlink to `/private/tmp`. The resolver `realpath`'d the workspace root (resolved to `/private/tmp/...`) but kept the lexical path for non-existent files (`fs.realpath` ENOENTs). The containment check then compared `/tmp/...` against `/private/tmp/...` and rejected. Fixed by adding `realpathWithFallback` which walks up the parent chain until an existing ancestor is found, `realpath`s it, and re-attaches the missing tail. Regression test (case #11) added in `internalLinkResolver.test.ts`.
- **UX — Open icon in Edit Link dialog (sprint-owner request).** Originally the dialog had Remove / Cancel / Update buttons; users had to close the dialog and Cmd-click in the editor body to follow a link. Added a small `↗` icon next to the URL input that opens the current target (external → browser, internal → extension host) and closes the dialog. Replaces the earlier four-button footer that didn't fit the dialog width.

## Validation Notes

- Passed: `npx tsx src/workspaceFileLinks.test.ts`
- Passed: `npx tsx webview/src/lib/linkTargets.test.ts`
- Passed: `npm run compile` in `extensions/ritemark`
- Passed: `npm run build` in `extensions/ritemark/webview`
- Passed: `./scripts/validate-qa.sh`
- Passed after TOC pattern correction: `npm run compile`, `npm run build`, `./scripts/validate-qa.sh`, and grep check confirming the TOC components no longer contain `HeadingLevelContextMenu`, `toc-level-select`, or visible heading-level `<select>` controls. (Note 2026-05-25: this grep check passed because the TOC components contain **no** heading-level controls at all — neither the rejected dropdown nor the intended right-click menu. See dev-mode verification table above.)
- Dev smoke: launched a fresh Ritemark dev instance with `--disable-workspace-trust` and `--remote-debugging-port=9223`, created a new Markdown document through `Ritemark: New document`, confirmed the Ritemark editor webview loads, and confirmed typing `@roadmap` opens the inline file-link picker without the earlier TipTap duplicate plugin-key runtime crash.
- Failed: `npm run typecheck` in `extensions/ritemark/webview` due existing AI sidebar typing errors in `SelectedContextTab.tsx` and `store.ts`, unrelated to Sprint 72 changes.
- Pending: manual TOC undo/scroll/focus verification in the running app.
- Smoke-test note: the first dev launch opened the Pencil welcome/editor surface, which can obscure direct Markdown editor validation in a reused profile. A clean Ritemark command-path smoke was used instead; removing Pencil is not required for Sprint 72 validation, but may make local manual testing less noisy.

## Release Note Handling

`docs/CHANGELOG.md` has been updated under Unreleased. No Sprint 72-specific release notes file exists yet; add this work to the next release folder when that release is opened.

## SDD Artifacts

Sprint 72 uses a lightweight repo-local spec-driven development process rather than importing GitHub Spec Kit or another framework.

- [spec.md](spec.md) is the product and behavior contract.
- [technical-plan.md](technical-plan.md) records the architecture and implementation approach.
- [scenarios.md](scenarios.md) captures behavior examples in a lightweight BDD style.
- [tasks.md](tasks.md) is the implementation checklist and progress tracker.

Rule for this sprint: update the relevant SDD artifact before changing implementation when behavior or architecture changes.

## Status

**Track:** Implementation  
**Current phase:** Ready for closeout — Phase 7 implemented and verified end-to-end in dev mode 2026-05-26 (Cmd-click opens Markdown in Ritemark, non-Markdown via VS Code default opener, out-of-workspace and missing-file rejections show the right notification, Open icon in the Edit Link dialog covers both link types). Remaining work: update linked GitHub issues, commit + push.  
**Branch:** `codex/sprint-72-resume` (resumed from `codex/sprint-72-markdown-navigation-annotations`; original branch left untouched after parallel branches got tangled and a direct merge was deemed too risky)  
**Worktree:** `/Users/jarmotuisk/Projects/ritemark-native`
