# Sprint 120: Editor Input Intent

Track: Lightweight<br>
Release tier: extension

**Status:** Implementation — bound approved and shipped (Phase 1), Phase 2 re-scoped, Phases 3–5 open.<br>
**Branch:** `sprint-120-editor-input-intent`<br>
**Issue:** [#280](https://github.com/ProductoryHQ/ritemark-native/issues/280)<br>
**Worktree:** `.claude/worktrees/sprint-120-editor-input-intent`, branched from main `e9094517`<br>
**Release:** [v1.12.0](../release-plan.md)

## Goal

Stop the ordered-list input rule from converting a plausible prose number like `2026. ` into a numbered list, while every deliberate list marker a person actually types keeps working.

## Phase 0 — done

The audit is complete: [research/current-state-audit.md](./research/current-state-audit.md). Findings:

- The defect is the input rule only: `@tiptap/extension-ordered-list`'s `inputRegex = /^(\d+)\.\s$/`, used unchanged in `webview/src/components/Editor.tsx:373` (`OrderedList.configure(...)`). Any integer plus `. ` converts the paragraph.
- Save (HTML → Markdown, Turndown) and load (Markdown → HTML, the scoped `marked` instance) already treat a year as prose vs. a list correctly. The fix must stay in the typing layer; do not touch the load or save path.
- Second finding: typing `1999. ` in an empty paragraph directly above an existing `start="2026"` ordered list merges into that list and rewrites its `start` to `1999`; pressing Backspace (the input-rule undo) reverts the new item to a paragraph but leaves `start="1999"` behind. **Re-examined 2026-09-22 (see below) — not a separate defect.**

## Open Decision (Jarmo approves before code)

The input rule only sees the number, never the text that follows — "what counts as a deliberate list marker while typing" is a product choice, not something the code can detect.

| Option | Behaviour | Cost |
| --- | --- | --- |
| **A. Bound the number (recommended)** | Convert `1.`–`99.`, LibreOffice Writer's own bound; three digits and up stay prose. | A list deliberately started at 100+ needs the toolbar or slash menu instead of typing. |
| B. Only `1.` converts | Every other number stays prose. | Breaks continuing a list at `2.`, `3.` after a paragraph break — the normal habit. |
| C. Exclude a year-like range (1000–2999) | `3000. ` still converts. | Arbitrary window; encodes "a year" contrary to the release plan's boundary. |

Recommendation: **Option A.** One numeric bound, no year-specific knowledge, and every number a person actually starts a list with keeps working.

**Decided 2026-09-22 (Jarmo: "variant A on ka ok").** Option A, with the bound at **99** rather than an invented number: LibreOffice Writer's autoformat stops at two digits (`GetDigitLevel`: "more than 2 numbers are not an enum anymore"). Microsoft Word's numeric rule is not published and was not verified, so nothing is claimed about it. Evidence: [research/current-state-audit.md](./research/current-state-audit.md#what-other-editors-do).

## Scope

- Bound the ordered-list input rule so it fires only for `1.`–`99.` at the start of a paragraph.
- Pin the adjacent-list behaviour in a round-trip test rather than guarding against it (Phase 2, re-scoped 2026-09-22 — see Product Decisions and [tasks.md](./tasks.md)).
- Cover typing, paste, save, reopen, undo, and redo with automated tests — not only the first keystroke.
- Leave the Turndown (save) and `marked` (load) Markdown paths untouched; the audit found both already correct.

## Deliverables

| Deliverable | Description |
|---|---|
| Bounded ordered-list input rule | Replaces the unbounded TipTap default in the editor's `OrderedList` configuration. |
| Ordered-list round-trip test | Pins what the Markdown file can hold: a year stays prose, a deliberate list keeps its `start`, and two adjacent lists are one list in the file. |
| Automated regression coverage | Unit tests for the rule boundary and integration coverage for the full typing/paste/save/reopen/undo/redo cycle. |
| Docs and release notes | Architecture note if the extension structure changes; `docs/CHANGELOG.md` and `docs/releases/v1.12.0/release-notes.md` entries. |

## Definition of Done

- [ ] Typing `2026. ` (or any 4+ digit number) at the start of a paragraph never converts it to an ordered list.
- [ ] Typing `1.`–`99.` at the start of a paragraph still converts it to an ordered list.
- [ ] Typing a year above an existing ordered list leaves that list untouched (it no longer converts at all); a deliberate in-range marker may merge, which is what the saved file means.
- [ ] Pasted and reopened Markdown lists keep their original semantics (load path unchanged, verified by test).
- [ ] Save → reopen round-trips correctly for both prose numbers and real lists.
- [ ] Undo and redo behave correctly for both the suppressed-conversion case and the real-list case.
- [ ] `npm test` passes (webview + extension host suites).
- [ ] `./scripts/validate-qa.sh` passes.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Bounding the input rule breaks a legitimate high-number list start or imported CommonMark | High | Explicit boundary tests (1, 9, 99, 999, 1000, 2026); load path is untouched and separately tested. |
| A guard against the adjacent-list join would make the editor diverge from the file | High | Resolved by the round-trip evidence: no guard is written, and `orderedListRoundTrip.test.ts` documents why. |
| Fix regresses the Backspace input-rule undo for real lists | Medium | Round-trip test suite (Phase 3) exercises undo/redo explicitly. |

## Out of Scope

- TipTap 2→3 migration (release plan, out of scope).
- Broad Markdown list-serialization cleanup beyond this defect (release plan, out of scope).
- Any change to the Turndown (save) or `marked` (load) Markdown paths — the audit found both already correct.
- Bullet lists, task lists, and other input rules — only the ordered-list rule is affected.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-22 | Phase 0 audit confirms the defect lives only in TipTap's ordered-list input rule; Turndown (save) and `marked` (load) already treat prose vs. list numbers correctly | `research/current-state-audit.md` |
| 2026-09-22 | Approved bound: convert `1.`–`99.` only, no year-specific logic | Option A, with LibreOffice Writer's two-digit bound rather than an invented one |
| 2026-09-22 | Phase 2 re-scoped: no guard against the adjacent-list join; ship a round-trip test instead | Markdown cannot hold two adjacent ordered lists with different starts — the first marker wins, so a guard would show a document the file cannot keep. Evidence in the audit, *The adjacent-list merge, re-examined* |

## Planning Approval

- [x] Jarmo approves the number-bound decision (Option A, B, or C). *(Option A, "variant A on ka ok", 2026-09-22)*
- [x] Jarmo approves this sprint plan. *("alusta", 2026-09-22)*
- [x] GitHub issue exists and is assigned to milestone v1.12.0. ([#280](https://github.com/ProductoryHQ/ritemark-native/issues/280))
- [x] Worktree and branch created for the Phase 0 audit. (`sprint-120-editor-input-intent`, from main `e9094517`)
