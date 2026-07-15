# Sprint 94 Tasks

Status is the source of truth for "what is done" only when it agrees with the code — see the spec-driven-sprint skill's Discrepancy Detection section. Do not pre-tick.

Structure follows `technical-plan.md` Revision 2: **Gate A (lossless core)** must be green before **Gate B (AI assignment)**. UI is `ui-mock.html` (margin-anchored model).

## Phase 0: Audit — DONE (proven, not just planned)

- [x] Prove the `marked` custom-extension approach: intercepts `<!-- -->` outside fences, leaves fenced `<!-- -->` untouched, emits a ProseMirror-parseable `<ritemark-comment>` element. — 21 round-trip/XSS fixtures green (harness, Node 22).
- [x] Decide the `-->`-inside-content mitigation: **reject at input time** (`hasCommentTerminator`), never silent-strip (Codex #4). On the load path the non-greedy regex already stops at the first `-->`, so a stored body cannot contain one.
- [x] Confirm the export chokepoint: `extensions/ritemark/src/export/v2/htmlPipeline.ts:73` `normalizeHtml` is the single shared PDF/Word step (already runs `stripUnsafeTags`).
- [x] Confirm the `marked` config: both `Editor.tsx` call sites use the global `marked` import → register once via `marked.use(commentMarkedExtension)`.
- [x] Decide anchored-note encoding: `<mark data-comment="…">` carries the note in its attribute (single token, no orphan sync); standalone `///` notes stay `<!-- -->`.
- [ ] `///` at line start doesn't get swallowed by the single-`/` `SlashCommands` popup — verify when the input rule lands (Gate A, Phase A3).
- [ ] `Cmd+/` capturable in a real dev-mode webview session — verify in dev (Gate A, Phase A3).
- [ ] Resolve `spec.md` Open Questions with Jarmo (rich vs plain content, Resolve confirmation UX). Aliases (claude/codex/opencode) and flag status (experimental) now decided in the plan.

## Gate A — lossless comment core (must be green before Gate B)

### A1 — round-trip core — DONE
- [x] `commentModel.ts` — alias parse, HTML/attr escape, `-->` terminator guard.
- [x] `commentMarkedExtension.ts` — block tokenizer `<!-- -->` → `<ritemark-comment>` (body verbatim, escaped; alias derived).
- [x] `commentTurndownRules.ts` — `<ritemark-comment>` → `<!-- -->` and `<mark data-comment>` → itself.
- [x] `commentRoundTrip.test.ts` — fixtures: standalone, assigned, multi-line, code-fence-not-converted, XSS, break-out, anchored, attr-escape, model helpers. (Runs green via esbuild+Node harness; see test-runner note below.)

### A2 — TipTap primitives + wiring — DONE (compiles; round-trip green)
- [x] `CommentMark` (anchored): `Mark.create`, `parseHTML` `mark[data-comment]`, `renderHTML` `<mark class=ritemark-comment-mark>`, set/unset commands.
- [x] `CommentNode` (standalone): wrapper node `content: 'block+'` (Codex #2), `parseHTML` `ritemark-comment`, `renderHTML`.
- [x] Register comment `marked` tokenizer (flag-gated, lazy — off keeps `<!-- -->` untouched, no data loss) + `addCommentTurndownRules(turndownService)` in `Editor.tsx`.
- [x] Register both extensions in `useEditor`, gated on the `commentCallouts` flag prop.
- [ ] Plain-text sanitizer on `CommentNode` (decoupled from `block+` content model). — deferred to A3 dev pass.

### A3 — margin rail UI + create/read/delete (the mock) — PARTIAL (logic in extensions; visual layer needs dev-mode)
- [x] `///` line-start input rule → wraps into a standalone comment (`wrappingInputRule` in `CommentNode`). Collision check with `SlashCommands` = dev-mode verify.
- [x] `Cmd+/` toggle wrap/unwrap (`addKeyboardShortcuts` in `CommentNode`). Dev-mode capture = verify.
- [x] Margin-rail React layer (`MarginCommentRail.tsx`): markers per comment aligned via DOM scan, collision-resolved, deduped (bold-split comment = one marker), hover read bubble, delete. **Verified live in the webview dev server.** (rAF→setTimeout so it works in background tabs; open bubble `zIndex` on top per Jarmo.)
- [x] Anchored highlight = soft-yellow token (`#FEF3C7`), not browser default. Standalone `///` note hidden from body (margin-only). Verified live.
- [x] Toolbar "Comment" action in `FormattingBubbleMenu.tsx` (icon + label, ink) + compose bubble in the rail (audit M3). **Verified live:** select → Comment → empty mark + compose → type → save → highlight + marker.
- [x] H1 (anchored path) fixed: `hasCommentTerminator` wired in the compose bubble — a `-->` shows an inline error and disables save. **Verified live.**
- [x] Mention colon consistency: `parseCommentBody` now accepts `@claude` with OR without a colon (`@(alias)\b\s*:?\s*…`); `@claudex`/mid-sentence correctly not matched. Verified (8/8 harness).
- [x] Anchored-delete polish: selection collapses after `unsetMark`. Verified live.
- [x] **`///` standalone flow reworked (verified live).** Rearchitected the standalone note to the same "note in an attribute" model as the anchored mark:
  - `CommentNode` is now a block **atom** with `note`/`agentAlias` attributes (not editable content) → margin-only, no hidden inline typing. The note is also emitted as text content so Turndown doesn't drop the empty element as "blank".
  - `Enter` on a `/// …` line (via `addKeyboardShortcuts`, so it wins over StarterKit's split) lifts the line into a standalone note; a `-->` lifts to an empty note so the rail's compose surfaces the error (H1 for the `///` path). **Verified live.**
  - `Cmd/Ctrl+/` comments the selection (anchored) or inserts a standalone note.
  - Rail handles node compose/edit/delete via `commentNodePos` + `updateAttributes`/`deleteRange`.
  - M1 re-solved cleaner: the attribute preserves `\n` natively (reverted the `<p>`-per-line approach). **Verified live** (`line one\nline two` round-trips).
- [ ] Minor: lifting a `///` note leaves the atom node-selected → raises the toolbar briefly. Collapse the selection after the lift.

### A4 — export strip + feature flag — DONE (verified)
- [x] Comment-strip at `htmlPipeline.ts` `normalizeHtml` (unwrap `<mark data-comment>` keeping text; remove `<ritemark-comment>`). 6/6 strip fixtures green. PDF/Word file inspection = dev-mode.
- [x] `comment-callouts` flag `status: 'experimental'` + `ritemark.features.comment-callouts` package.json setting (default **true** = kill-switch ON) + delivered via the existing editor `features` payload (`ritemarkEditor.ts`) → `App.tsx` → `Editor` prop. Gates the whole extension registration.

### A5 — Gate A sign-off
- [ ] **Audit blockers (see `research/audit-findings.md`):**
  - [x] H1 (anchored) — `hasCommentTerminator` wired in the compose bubble (verified). **Remaining:** the `///` standalone path still unguarded.
  - [x] M1 — fixed: the `marked` renderer emits one `<p>` per body line and the Turndown rule rejoins children with `\n`, so line breaks survive the real TipTap `getHTML()` path. **Verified live** (multi-line comment loads as a 2-`<p>` `CommentNode`).
  - [x] M2 — scoped `new Marked()` (`editorMarked`) for the editor load path; the global `marked` is no longer mutated, so AI-sidebar chat rendering is unaffected. (Compiles; verify chat rendering in a full session.)
- [x] Audit H2 (export `>`-leak) + H3 (formatting stripped) fixed & verified.
- [ ] Add round-trip tests at the TipTap `getHTML()` layer (not just marked↔Turndown) — the gap the audit exploited.
- [ ] Manual: full load/edit/save/copy cycle (anchored + standalone, single + multi-line) in dev mode.
- [ ] `qa-validator` on the core (user routes).

## Gate B — AI assignment — IMPLEMENTED (compile-verified; runtime test pending in the full app)

- [x] `@alias` parsed from body (source of truth); agent badge on the assigned marker.
- [x] Send-to-AI relay (Codex #1): editor `comment:send-to-ai` (`sendToExtension`) → `RitemarkEditorProvider` case → `unifiedViewProvider.submitCommentPrompt()` (reveals sidebar) → `comment:submit` → store routes to `sendAgentMessage`/`sendCodexMessage`/`sendOpenCodeMessage` → existing `agent-execute`. New `ExtensionMessage` variant `comment:submit`.
- [x] Context block: the anchored span text is appended to the prompt.
- [x] Routes to the mentioned agent's id (claude-code/codex/opencode) via `ALIAS_TO_AGENT_ID` regardless of the sidebar's active runtime; `setPendingRuntime` updates the UI.
- [x] "Send to AI" button in the assigned-comment bubble with a "Sent" confirmation state.
- [x] **Runtime QA (Jarmo, in the running dev app):** Send to AI → sidebar opens → the mentioned agent receives the prompt. Confirmed working 2026-07-15 ("runtime — all works").
- [ ] `FileLinkSuggestions.tsx` guard: skip `@` file-search inside a comment (deferred — the `@` popup only triggers in the editor body, not in the rail compose textarea, so lower risk).

## Polish (audit low items) — DONE

- [x] `///`-lift collapses to a text cursor after the note (no lingering node-selection / toolbar pop) — `TextSelection.near`.
- [x] L-C: rail no longer rescans on `selectionUpdate` (positions don't change on cursor move) — perf.

## Phase 8: Architecture Gate + QA + Closeout

- [x] Update `docs/development/architecture.md` — Sprint 94 note (comment subsystem, the `comment:send-to-ai`/`comment:submit` relay, the flag, the cache-buster).
- [x] Record the comment-yellow exception in `ritemark-design/references/components.md` (rationale + date).
- [x] Runtime QA confirmed by Jarmo in the dev app ("runtime — all works").
- [x] Update `docs/CHANGELOG.md` (v1.8.3 draft entry).
- [ ] Update `releases/v1.8.3/release-plan.md` tracker (branch/PR/QA status).
- [ ] Update / close GH #81 with implementation summary.
- [ ] `qa-validator` before merge to `main`.
- [ ] Merge sprint branch → `main` (prod comes from main).
- [ ] Re-check GH #142 before ship (v1.8.3 is full-DMG regardless).
- [ ] Deferred to a follow-up: `FileLinkSuggestions.tsx` guard for `@` inside a `///` line; wiring vitest for the webview `.test.ts` files (pre-existing gap).

## Note — webview test runner gap (pre-existing)

`extensions/ritemark/webview` has `.test.ts` files but **no configured vitest** (no `test` script, vitest not a dep). Gate A's `commentRoundTrip.test.ts` was proven via an esbuild-bundled Node 22 harness. Wiring vitest so these tests run in CI is a pre-existing gap, tracked separately — not Sprint 94 scope.
