# Sprint 126: Editor Selection Keys

Track: Lightweight<br>
Release tier: extension

**Status:** Implemented and validated — awaiting QA/PR. Decision approved and applied (Option B).<br>
**Branch:** `sprint-126-editor-selection-keys`<br>
**Issue:** [#332](https://github.com/ProductoryHQ/ritemark-native/issues/332) (label: bug)<br>
**Worktree:** `.claude/worktrees/heuristic-albattani-0cd9ec`, branched from main `e9094517`<br>
**Release:** [v1.12.0](../release-plan.md)

## Goal

Stop `Shift+End`/`Shift+Home` in the TipTap webview editor from selecting past the current text block, so a follow-up Delete can no longer wipe unrelated content elsewhere in the document.

## Phase 0 — done

The audit is complete: [research/current-state-audit.md](./research/current-state-audit.md). Findings:

- The defect is Chrome's native contenteditable fallback, and nothing above it: TipTap's core `Keymap` extension binds `Mod-a` and macOS `Ctrl-a`/`Ctrl-e` (`selectTextblockStart`/`selectTextblockEnd`) but never `Home`, `End`, `Shift-Home`, or `Shift-End`; ProseMirror's `baseKeymap` binds none of those either; Ritemark's own webview adds no handling of its own (grep confirmed across `extensions/ritemark/webview/src` and `extensions/ritemark/src`). All four keystrokes fall through to Chrome, whose macOS default for `Shift+End` is "extend selection to end of document."
- Reproduced by hand: on the repro document (`# Reopen check` / `Start here.` / a paragraph / an ordered list), `Home` then `Shift+End` in the first paragraph selects that paragraph plus every following block. Plain `End` from the same position is correct — collapsed at the paragraph's last character.
- Fix location identified: `extensions/ritemark/webview/src/components/Editor.tsx`, the `useEditor({ extensions: [...] })` array at line 337. `HeadingLevelShortcuts.ts` is the existing precedent for a custom `Extension.create({ addKeyboardShortcuts() {...} })`, registered right after `StarterKit`.
- Automation limit found: CDP/automated key synthesis cannot reproduce the raw bug — a dispatched `Shift+End` arrives with `code: ""` and `which: 0`, so Blink's editing-command mapping never fires. The bug must be confirmed by hand in a dev build; the fix is automatable, because a ProseMirror keymap binding matches on `event.key`, which IS present.
- The webview dev server (port 5173) renders only "Loading..." standalone — validation needs a real dev build via `/rundev`, not the bare Vite server.

## Open Decision (Jarmo approves before code)

On a paragraph that wraps onto several visual lines, what should `Shift+End` extend to? This matters because Ritemark's prose column is narrow enough that long paragraphs wrap often — it is not an edge case.

| Option | Behaviour | Cost |
| --- | --- | --- |
| **A. Clamp to the text block (ProseMirror-native)** | Bind `Shift-Home`/`Shift-End` to a command that sets a `TextSelection` from the existing anchor to `$from.start()`/`$from.end()` of the current text block. Pure ProseMirror, no DOM, fully unit-testable in the `orderedListTyping.test.ts` style. | On a wrapped paragraph, `Shift+End` selects to the end of the *whole* paragraph while plain `End` only moves to the end of the visual line — the pair diverges, and on a long paragraph `Shift+End` still over-selects several lines: a smaller version of the same surprise. |
| **B. Mirror the visual line, clamped to the text block (recommended)** | Bind the same keys; let the browser compute the visual-line boundary (`Selection.modify('extend', 'forward'\|'backward', 'lineboundary')`), then clamp the resulting ProseMirror selection so its head can never leave the current text block. Matches every native editor and matches plain `End` exactly. The clamp is a pure function and stays unit-testable; the binding itself needs a dev-build check because it touches the DOM. | DOM-dependent, so one part of it is validated by hand rather than by unit test. Fall back to Option A if `Selection.modify` proves unreliable inside the VS Code webview. |
| C. Also rebind plain `Home`/`End` to the text block | Makes the pair consistent by changing plain `End` too. | Rejected — plain `End` works today and matches the platform; changing it is a regression for wrapped paragraphs and widens the blast radius of a data-loss fix. |

Recommendation: **Option B.** The clamp is what actually kills the data loss and is common to A and B; the visual-line part is what makes `Shift+End` mean "what `End` does, but extending," which is what a person pressing it intends.

**Decided 2026-09-22 (Jarmo: "visual line, approved, start Phase 1").** Option B. Validated in a dev build: `Selection.modify('extend', …, 'lineboundary')` works inside the VS Code webview, so the Option A fallback was not needed — it remains in the code only as the defensive path for a browser without the API. Evidence: [qa-evidence.md](./qa-evidence.md).

Also flagged, not assumed broken: `Shift-Mod-Home`/`Shift-Mod-End` (select to document start/end) are correct today. Phase 0 did not exercise them by hand; confirming they still work after the fix is a Definition of Done item, not a foregone conclusion.

## Scope

- Add a new custom keymap extension (following the `HeadingLevelShortcuts` pattern) that binds `Shift-Home`/`Shift-End` in `extensions/ritemark/webview/src/components/Editor.tsx`'s extensions array.
- Implement whichever option Jarmo approves; ship the shared clamp (common to A and B) regardless of which visual-line behaviour is chosen.
- Cover the original repro document (heading, paragraph, ordered list) and a long/wrapped paragraph case.
- Confirm `Shift-Mod-Home`/`Shift-Mod-End` still reach document start/end — checked, not assumed broken.
- Leave plain `Home`/`End` untouched; they are correct today.

## Deliverables

| Deliverable | Description |
|---|---|
| Selection-boundary keymap extension | Binds `Shift-Home`/`Shift-End` per the approved option; clamps the resulting selection's head to the current text block. |
| Regression test | Unit test in the `orderedListTyping.test.ts` style, pinning the clamp against real ProseMirror state (schema via `getSchema(extensions)`, no DOM). |
| Docs and release notes | `docs/CHANGELOG.md` and `docs/releases/v1.12.0/release-notes.md` entries. |

## Definition of Done

- [x] `Shift+End` never selects past the end of the current text block, from any position within it.
- [x] `Shift+Home` never selects past the start of the current text block.
- [x] The selection anchor is preserved — `Shift+End`/`Shift+Home` extend the existing selection, they do not replace it.
- [x] Repeated `Shift+End` (or `Shift+Home`) from the same position is idempotent.
- [x] `Shift-Mod-Home`/`Shift-Mod-End` still reach document start/end.
- [x] A unit test in the `orderedListTyping.test.ts` style pins the clamp against real ProseMirror state.
- [x] The new test is wired into `extensions/ritemark/package.json`'s `test` script.
- [x] `npm test` passes.
- [x] `./scripts/validate-qa.sh` passes.
- [x] Hand-validated in a dev build via `/rundev`, including the original repro document and a wrapped paragraph.
- [x] `docs/CHANGELOG.md` and `docs/releases/v1.12.0/release-notes.md` entries added.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| The bug cannot be reproduced by automated key synthesis (CDP dispatch lacks `code`/`which`) | Medium | Fix is pinned by a ProseMirror-level unit test (matches on `event.key`, which automation CAN set) plus one mandatory hand check in a dev build via `/rundev` before merge. |
| `Selection.modify('extend', ..., 'lineboundary')` (Option B) behaves differently inside the VS Code webview's Chromium than in a standalone page | Medium | Fall back to Option A (clamp only, no visual-line awareness) if the DOM API proves unreliable; the clamp is shared and unit-tested either way. |
| A carelessly implemented clamp also blocks legitimate document-boundary selection (`Shift-Mod-Home`/`Shift-Mod-End`) | High | Explicit Definition-of-Done check plus a regression test; the `Mod`-qualified variants already bind to different ProseMirror commands. |
| Fix regresses plain `Home`/`End` (correct today) | High | Plain `Home`/`End` are left untouched; only the `Shift`-qualified bindings are added. |

## Out of Scope

- Plain `Home`/`End` behaviour (works correctly today).
- Any other selection or navigation key not named here.
- TipTap 2→3 migration.
- Sprint 120's ordered-list input rule (#280) — separate, already in flight on its own branch.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-22 | Approved behaviour: `Shift+End`/`Shift+Home` extend to the **visual line** boundary, clamped to the current text block | Option B. Matches plain `End` and every native editor; the clamp is what stops the data loss. `Selection.modify` confirmed working in the webview, so the fallback stayed defensive |
| 2026-09-22 | Phase 0 audit confirms the defect is Chrome's native `Shift+End`/`Shift+Home` fallback: TipTap's `Keymap` extension and ProseMirror's `baseKeymap` bind `Mod-a`/`Ctrl-a`/`Ctrl-e` but never `Home`/`End`/`Shift-Home`/`Shift-End`, and Ritemark's webview adds no handling of its own | `research/current-state-audit.md` |

## Planning Approval

- [x] Jarmo approves the `Shift+End`/`Shift+Home` behaviour decision (Option A, B, or C). *(Option B, "visual line", 2026-09-22)*
- [x] Jarmo approves this sprint plan. *("approved, start Phase 1", 2026-09-22)*
- [x] GitHub issue exists and is labeled bug. ([#332](https://github.com/ProductoryHQ/ritemark-native/issues/332))
- [x] Worktree and branch created for the Phase 0 audit. (`sprint-126-editor-selection-keys`, from main `e9094517`)
