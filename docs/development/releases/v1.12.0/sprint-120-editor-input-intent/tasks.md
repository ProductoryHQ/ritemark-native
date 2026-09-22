# Sprint 120 Tasks

Implementation checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with branch diff/evidence.

> **Gate:** Phase 0 is audit only and is already complete. Phase 1 code begins only after Jarmo approves the number-bound decision and the sprint plan.

## Phase 0: Audit (done)

- [x] Capture the input-rule/save/load evidence and the adjacent-list merge/renumber finding in `research/current-state-audit.md`. *(2026-09-22)*

## Phase 1: Bounded input rule

The approved bound is **99** (LibreOffice Writer's), decided 2026-09-22 — the plan
was drafted with a provisional `999`.

- [x] Add `webview/src/extensions/BoundedOrderedList.ts`, overriding `@tiptap/extension-ordered-list`'s `addInputRules()` with `/^([1-9]\d?)\.\s$/` in place of the default `/^(\d+)\.\s$/`. The node, its `start` attribute, the join predicate and the keepMarks/keepAttributes variant are TipTap's own, unchanged.
- [x] Wire it into `webview/src/components/Editor.tsx` in place of the unmodified `OrderedList`.
- [x] Add `webview/src/extensions/BoundedOrderedList.test.ts`: `1.`, `2.`, `9.`, `10.`, `42.`, `99.` convert; `100.`, `999.`, `1999.`, `2026.`, `12345.` stay prose; non-markers (`0.`, `01.`, `1.` without a space, `1)`, a number mid-sentence) are untouched; both rule variants are bounded and the node is still `orderedList`.
- [x] Register both new test files in the extension's `npm test` script.

## Phase 2: Adjacent lists — what the file can actually hold

Re-scoped 2026-09-22 after the round-trip probe (see the audit's *The adjacent-list
merge, re-examined*): Markdown cannot represent two adjacent ordered lists with
different starts, so blocking the join would make the editor diverge from the file.
No guard is written; the format truth is pinned in a test instead.

- [x] Probe the load and save paths to establish whether two adjacent ordered lists survive a round trip. They do not — the first marker wins.
- [x] Record the finding and the revised conclusion in `research/current-state-audit.md`.
- [x] Add `webview/src/utils/orderedListRoundTrip.test.ts`: a year stays prose through save and reopen, a deliberate list keeps its `start`, an authored `2026.` list still loads as a list, and two adjacent lists reopen as one.
- [ ] Phase 4 hand check: after a deliberate `5. ` merges into the list below, Backspace restores the document as it was, including the list's `start`.

## Phase 3: Round-trip regression

`webview/src/extensions/orderedListTyping.test.ts` types character by character
into a real ProseMirror document built from the editor's own schema, through
TipTap's own input-rules plugin, then saves and reopens the result — no DOM, the
same fake-editor pattern as `extensions/comment/commentIds.test.ts`.

- [x] Typing: assert against document state, not a rendered class. `2026. was a good year for lists.` stays one paragraph with every character intact; `1. `, `5. `, `99. ` produce `orderedList(start=N)`; `100. ` and `1999. ` stay paragraphs; a number mid-sentence never converts.
- [x] Confirm the test would catch the defect: with the stock `@tiptap/extension-ordered-list` swapped back in, it fails on the first assertion (`orderedList(start=2026)` instead of `paragraph`).
- [x] Save: the typed year serializes escaped (`2026\.`), a typed list serializes as a real marker — asserted on the document the typing produced, not a hand-written fixture.
- [x] Reopen: each saved string is parsed back through the editor's `marked` instance; the year has no `<ol>`, the list does.
- [x] Undo: Backspace straight after a conversion (`undoInputRule`) removes the list and puts `5. ` back as plain text.
- [x] Paste: nothing to change or test — `handlePaste` in `Editor.tsx` only intercepts images, the ordered-list extension has no paste rule, and input rules do not run on paste. Pasted text stays text; pasted Markdown is converted only on the load path, which this sprint does not touch.
- [ ] Undo of a merge, and the full undo/redo stack: needs the auto-joiner and the history plugin, which live in the assembled editor — Phase 4.

## Phase 4: RunDev validation

- [ ] Type several plausible years, including `2026. `, at the start of a paragraph and confirm they stay prose in a running dev build.
- [ ] Type `1. Item` and `5. Item` and confirm ordered lists still create normally.
- [ ] Type a year in an empty paragraph directly above an existing list and confirm it stays prose and the list below is untouched.
- [ ] Type `5. ` directly above an existing list, let it merge, then press Backspace and confirm the document is back as it was, list `start` included.
- [ ] Save, close, and reopen the test document and confirm both the prose numbers and the real lists survived unchanged.

## Phase 5: QA and closeout

- [ ] Run `npm test` (webview + extension host suites) and record the result.
- [ ] Run `./scripts/validate-qa.sh` and record the result.
- [ ] Update `docs/development/architecture.md` if the extension structure changed.
- [ ] Add a `docs/CHANGELOG.md` entry and a `docs/releases/v1.12.0/release-notes.md` entry.
- [ ] Update the v1.12.0 release-plan tracker (Sprint 120 row: branch, PR, merge/QA/release-note status) and close issue [#280](https://github.com/ProductoryHQ/ritemark-native/issues/280) with evidence.
- [ ] Open the PR from `sprint-120-editor-input-intent` to `main`.
