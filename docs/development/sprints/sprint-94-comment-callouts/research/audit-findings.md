# Sprint 94 — Independent Code Audit Findings

Date: 2026-07-14. Auditor: independent subagent (adversarial review of the A2/A4 changeset).
The auditor's core point: the round-trip tests validated the `marked ↔ Turndown` string layer but **not** the TipTap `getHTML()` layer where the real data and export flow — so several design guarantees were false in the shipping path.

## Resolved this session (verified live in the webview dev server)

| # | Finding | Fix | Verified |
|---|---|---|---|
| H2 | `stripComments` regex broke when a note contained `>` (`getHTML()` does NOT escape `>` in attributes), leaking/mangling note text into PDF/Word | Quote-aware regexes `(?:"[^"]*"\|[^">])*` in `htmlPipeline.ts` | 5/5 strip fixtures incl. `>` and `</mark>` in the note |
| H3 | `excludes: '_'` on `CommentMark` stripped bold/italic/link from anchored text | Removed the override (default excludes = self only) | Live: `**healthy**` stays bold inside an anchored comment |
| — | Rail didn't render in headless/background tab (`requestAnimationFrame` paused) | `rescan` uses `setTimeout(…,0)` instead of rAF | Live: rail renders |
| — | One comment over mixed formatting rendered as several `<mark>` fragments → duplicate markers | Dedup markers by note+agent in `scan()` | Live: bold-split comment = one marker |
| — | Open bubble rendered behind neighbouring markers | `zIndex: 30` on the open rail item (Jarmo request) | Live: bubble sits on top |

## Open — Gate-A blockers (must fix before Gate A sign-off; feature is flag-gated and NOT shipped)

- **H1 — silent `-->` truncation via the wired `///` path.** `hasCommentTerminator` is defined + unit-tested but has **zero call sites** — it is never wired. A user can create a `///` note, type `A --> B`, save (`<!-- A --> B -->`), and on reload the non-greedy `<!--([\s\S]*?)-->` matches `<!-- A -->` and truncates; ` B -->` leaks as body text. **Silent data corruption** — the exact thing the guard was meant to prevent. Fix: reject `-->` at input (wire `hasCommentTerminator`) OR escape it losslessly on save; add a `getHTML()`-layer round-trip test.
- **M1 — multi-line standalone notes lose line breaks in the real editor.** The round-trip test skips TipTap; the real path (marked → TipTap parse → `getHTML` → Turndown) collapses a `block+` node's whitespace, so `line1\nline2` saves as `line1 line2`. The "verbatim multi-line body" guarantee fails in production. Root cause: `marked` emits a text child but `CommentNode` is `block+`. Fix + a TipTap-layer test.
- **M2 — global `marked` mutation bleeds into the AI sidebar.** `ensureCommentMarkedPipeline()` mutates the module-global `marked` singleton; `RenderedMarkdown.tsx` (AI sidebar) uses the same global, so any AI response containing `<!-- … -->` now renders a visible `<ritemark-comment>` instead of a hidden comment. Fix: use a scoped `new Marked()` instance for the editor only.
- **M3 — anchored-comment creation is unwired.** `setCommentMark`, `hasCommentTerminator`, `ALIAS_TO_AGENT_ID` have no call sites; the rail only reads/removes. There is no toolbar "Comment" button / compose flow yet, so anchored comments can only be created by hand-editing markdown. (This is the remaining A3 create-flow work.)

## Low (track, not blocking)

- L1 — `commentMarkedRegistered` latch + `useEditor` frozen extension list: toggling the flag mid-session (no reload) could drop comments. Not reachable normally (flag read atomically at mount — auditor confirmed).
- L2 — `stripComments` regex 1 not nesting-safe (nesting hard to produce; `CommentNode` is `defining`).
- L3 — empty body `<!---->` → empty force-filled paragraph; harmless.
- L4 — `///`-space wraps prose starting with `///`; `Mod-/` is a common chord — UX papercuts.
- Polish — anchored delete leaves the text selected (raises the bubble menu); collapse the selection after `unsetMark`.

## Second-pass audit (2026-07-14, after the `///` rework) — all resolved

Ran a second independent adversarial audit on the reworked changeset (atom `CommentNode`, `Enter` lift, rail positional targeting). It cleared XSS, `stripComments` on the atom form, and anti-blank content as safe, and found 5 new defects — all now fixed and (H-A/H-B) verified live:

| # | Finding | Fix | Verified |
|---|---|---|---|
| H-A | Rail delete/edit of a comment spanning a link operated on only the FIRST of several `<mark>` fragments → partial delete / split into two comments | Rail identity + edit/delete now use the **full mark range** via `getMarkRange` (`m.from`/`m.to`), not one fragment's `textContent.length` | **Live:** deleting a 3-fragment link-spanning comment removes all 3, keeps the text |
| H-B | Dedupe by `note+agent` text hid genuinely distinct comments with identical text (orphaned, unreachable) | Dedupe by **positional identity** — mark range for marks, node position for nodes | **Live:** two identical `<!-- TODO -->` show as two markers |
| H-C | `Enter` on a `/// ` line inside a list item replaced the list item's mandatory paragraph → schema-invalid `TransformError` | Guard with `container.canReplaceWith(...)` before lifting; bail (normal Enter) where invalid | Compile + logic (canReplaceWith is false for a list item's paragraph) |
| M-A | An empty-note anchored mark persisted to disk and forced a compose bubble on every reload | Turndown `commentMark` rule unwraps an empty-note mark (empty = not a real comment) | Harness (empty-note mark → unwrapped) |
| L-A | `@codex.com` false-positive alias; `@Claude` (capitalized) false-negative | Case-insensitive + `(?=$|[\s:])` lookahead; lowercase the captured alias | Harness (7/7) |

Remaining low/perf (tracked, non-blocking): L-B global `commentMarkedRegistered` latch (flag is application-scoped), L-C rail rescans on `selectionUpdate` (perf on very large docs), and the `///`-lift leaves the atom node-selected (raises the toolbar briefly — collapse the selection).

## Auditor-confirmed correct (cleared)

- Flag-OFF = pre-sprint baseline, no NEW data loss.
- Flag read correctly at mount (`features` + `isReady` in the same `load` message; `<Editor>` guarded by `if (!isReady) return`).
- Tokenizer registration ordering (runs before `initialContent` is parsed).
- Fenced-code isolation, alias parsing, quote/`&` escaping in the markdown-storage path.
