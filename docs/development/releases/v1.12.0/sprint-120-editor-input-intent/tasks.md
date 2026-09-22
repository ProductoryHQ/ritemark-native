# Sprint 120 Tasks

Implementation checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with branch diff/evidence.

> **Gate:** Phase 0 is audit only and is already complete. Phase 1 code begins only after Jarmo approves the number-bound decision and the sprint plan.

## Phase 0: Audit (done)

- [x] Capture the input-rule/save/load evidence and the adjacent-list merge/renumber finding in `research/current-state-audit.md`. *(2026-09-22)*

## Phase 1: Bounded input rule

- [ ] Add a bounded ordered-list extension (e.g. `webview/src/extensions/BoundedOrderedList.ts`) that overrides `@tiptap/extension-ordered-list`'s `addInputRules()` with the approved `1`–`999` bound in place of the default `/^(\d+)\.\s$/`.
- [ ] Wire the bounded extension into `webview/src/components/Editor.tsx` (currently `OrderedList.configure({ HTMLAttributes: { class: 'tiptap-ordered-list' } })` at line 373) in place of the unmodified `OrderedList`.
- [ ] Add unit tests for the rule boundary, e.g. `webview/src/extensions/BoundedOrderedList.test.ts`: `1.`, `9.`, `99.`, `999.` convert to a list; `1000.`, `2026.` stay prose.

## Phase 2: Adjacent-list merge/renumber fix

- [ ] Reproduce and fix the case where typing a number in an empty paragraph directly above an existing ordered list merges it into that list and rewrites the list's `start`.
- [ ] Add a test: an empty paragraph directly above a `start="2026"` list, typing an in-range number (e.g. `5. `), confirms the existing list's `start` is preserved.
- [ ] Add a test for the Backspace input-rule undo: reverting the new item's conversion must not leave the adjacent list's `start` changed from before the keystroke.

## Phase 3: Round-trip regression

- [ ] Typing: a prose number at the start of a paragraph does not convert; an in-range number does; assert against editor document state, not just the rendered DOM class.
- [ ] Paste: pasting Markdown containing both an escaped prose number (`2026\. a`) and a real list (`1. a`) preserves both semantics after paste.
- [ ] Save: Turndown output for a prose-number paragraph stays escaped (`2026\. a`); output for a real list is unescaped (`1. a`).
- [ ] Reopen: a document saved through the fix round-trips through the scoped `marked` load path back to the same editor state it was saved from.
- [ ] Undo/redo: both the suppressed-conversion case and the real-list-creation case survive at least one undo/redo cycle without state drift.

## Phase 4: RunDev validation

- [ ] Type several plausible years, including `2026. `, at the start of a paragraph and confirm they stay prose in a running dev build.
- [ ] Type `1. Item` and `5. Item` and confirm ordered lists still create normally.
- [ ] Type a number in an empty paragraph directly above an existing list and confirm the existing list's numbering is unaffected.
- [ ] Save, close, and reopen the test document and confirm both the prose numbers and the real lists survived unchanged.

## Phase 5: QA and closeout

- [ ] Run `npm test` (webview + extension host suites) and record the result.
- [ ] Run `./scripts/validate-qa.sh` and record the result.
- [ ] Update `docs/development/architecture.md` if the extension structure changed.
- [ ] Add a `docs/CHANGELOG.md` entry and a `docs/releases/v1.12.0/release-notes.md` entry.
- [ ] Update the v1.12.0 release-plan tracker (Sprint 120 row: branch, PR, merge/QA/release-note status) and close issue [#280](https://github.com/ProductoryHQ/ritemark-native/issues/280) with evidence.
- [ ] Open the PR from `sprint-120-editor-input-intent` to `main`.
