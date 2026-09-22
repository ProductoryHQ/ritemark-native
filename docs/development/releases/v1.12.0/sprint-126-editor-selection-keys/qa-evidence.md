# Sprint 126 QA evidence — Shift+End / Shift+Home

**Date:** 2026-09-22 · **Branch:** `sprint-126-editor-selection-keys` · **Issue:** [#332](https://github.com/ProductoryHQ/ritemark-native/issues/332)
**Decision applied:** visual line, clamped to the text block (Option B, approved 2026-09-22).

## Automated

`npx tsx webview/src/extensions/selectionBoundary.test.ts` — passes.

The test was verified to fail for the right reason before being accepted: replacing the clamp's body with `return proposedHead` (the pre-fix behaviour) fails the first assertion with `64 !== 26` — head 64 is the end of the document, head 26 is the end of `Start here.`. That is the bug, reproduced at the level the clamp operates on.

Full suite: `npm test` in `extensions/ritemark` — exit 0, with `selectionBoundary.test.ts` wired into the `test` script.
Typecheck: `npm run typecheck` in `extensions/ritemark/webview` — clean. `npm run compile` in `extensions/ritemark` — clean.

## Hand check in a dev build

Dev instance launched from this worktree (`vscode/extensions/ritemark` → this branch's extension source; console confirmed it loaded `…/.claude/worktrees/heuristic-albattani-0cd9ec/vscode/extensions/ritemark/media/webview.js`). Document `repro.md`: `# Reopen check` / `Start here.` / a paragraph long enough to wrap onto three visual lines / an ordered list.

Driven through CDP against the editor webview, reading `window.getSelection()` after each keystroke:

| Case | Keys | Result |
| --- | --- | --- |
| The original bug | caret at start of `Start here.`, `Shift+End` | selects `"Start here."` — nothing below it. Was: that paragraph **plus every following block**. |
| Idempotence | `Shift+End` again | still `"Start here."` — the selection does not grow. |
| **Wrapped paragraph** | caret at start, `Shift+End` | selects **85 of 186 characters**, ending at `…wrap onto more than ` — the first *visual line* only. This is the approved Option B behaviour working inside the VS Code webview. |
| `Shift+Home` | caret at end of `Start here.` | selects back to `"Start here."`, not to the start of the document. |
| Control: `Shift+Cmd+End` | | not claimed by the new binding (selection untouched) — `Shift-End` and `Meta-Shift-End` are distinct keymap entries. |
| Control: plain `End` | | not claimed by the new binding — it was correct before and is left alone. |

Screenshot of the clamped selection (`Start here.` highlighted; the wrapped paragraph and the ordered list below it untouched): [`../screenshots/s126-shift-end-clamped.png`](../screenshots/s126-shift-end-clamped.png), captured 2026-09-22. The AI sidebar's "Working on selected text" panel independently showed `Start here.` — i.e. the *host* also saw a one-paragraph selection, not a DOM-only artefact.

**`Selection.modify` works inside the VS Code webview.** The Option A fallback in the sprint plan is therefore not needed, and stays in the code only as the defensive path for a browser that lacks the API.

## Known limits of this evidence

- **The raw bug cannot be reproduced by automation.** A CDP-dispatched `Shift+End` arrives with `code: ""` and `which: 0`, so Blink's editing-command mapping never fires and the caret does not move at all. Verified independently in a standalone contenteditable page (Chromium 152 / macOS). The hand checks above therefore prove that *the new binding fires and produces the correct selection*; they do not re-demonstrate the original destructive behaviour. Jarmo's 2026-09-22 reproduction remains the record of that.
- **Delete-after-select was not exercised.** The destructive step follows mechanically from the selection, which is what the tests pin; it was not run against a fixture.
- **The dev instance ran on a CoW-cloned VS Code tree.** For the hand check, `git reset --hard` in the submodule left the source pristine, so `apply-patches.sh` re-applied 12 of 16 patches and 4 failed — the pre-existing condition already recorded for the pristine pin, not something this sprint introduced. Runtime came from the already-compiled `out/`, and `vscode/product.json` was taken from the main checkout so the launcher could find `Ritemark.app`. None of this touches the webview bundle under test.
- **`validate-qa.sh` was run against a fully-patched tree, not that one.** With only 12 patches applied the VS Code native TypeScript check fails in `src/vs/workbench/contrib/browserView/…` — the half-applied browser-bridge patches, unrelated to this change. The submodule was re-cloned from the main checkout in its patched state and the validator then exited 0 (`Codex QA validation passed`), so the shell check genuinely ran rather than being skipped.
