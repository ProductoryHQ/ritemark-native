# Sprint 120 QA evidence

Dev build from this worktree (`sprint-120-editor-input-intent`, CoW-cloned VS Code
shell, clean profile), 2026-09-22. Every line below is a reading taken from the
running editor's document, not from the rendered text alone.

## Automated

| Suite | Result |
| --- | --- |
| `npx tsx webview/src/extensions/BoundedOrderedList.test.ts` | pass |
| `npx tsx webview/src/extensions/orderedListTyping.test.ts` | pass |
| `npx tsx webview/src/utils/orderedListRoundTrip.test.ts` | pass |
| the same typing test with the stock `@tiptap/extension-ordered-list` | **fails** on the first assertion (`orderedList(start=2026)` where a paragraph is expected) — the test catches the defect it was written for |
| `npm test` (full extension suite) | see Phase 5 below |
| `npx tsc --noEmit` (webview) | clean |

## In the running editor

Fixture: a Markdown file whose last block is a real `2026.` ordered list, so the
list's `start` can be watched while typing above it.

| # | Action | Document afterwards |
| --- | --- | --- |
| 1 | Type `2026. was a good year` in a new paragraph | `P: "2026. was a good year"` — no list, and the `OL[start=2026]` below is untouched |
| 2 | Type `1. first` ⏎ `second` | `OL` with two items — deliberate lists still work |
| 3 | Type `1999. ` in an empty paragraph **directly above** the `2026.` list | `P: "1999. "`, `OL[start=2026]` unchanged — the Phase 0 corruption path is closed |
| 4 | Type `99. ninety-nine` | `OL[start=99]` — the last converting marker |
| 5 | Type `100. one hundred` | `P: "100. one hundred"` — the first that stays prose |
| 6 | Save → the file | `2026\. was the year we shipped it.` (escaped prose) and `1.  first` / `2.  second` (a real list) |
| 7 | Close the tab, reopen the file | both come back as they were: paragraph stays a paragraph, list stays a list with two items |

Screenshot of 4, 5 and the prose year side by side: `p4-evidence.png` (session
scratch).

## Known behaviour, deliberately not changed

Typing a **deliberate** in-range marker (`5. `) in an empty paragraph directly
above an existing list merges the two into one list, and the list takes the new
number. Observed: `OL[start=2026]` → `OL[start=5]`.

That is what the file already means — Markdown cannot hold two adjacent ordered
lists with different starts (see the audit, *The adjacent-list merge,
re-examined*), so the editor showing one list matches what saving and reopening
would produce.

Undo of that merge:

- **Cmd+Z restores everything**, including `start=2026`. Verified in the running
  editor.
- **Backspace** (the input-rule undo) un-converts the new item but leaves the
  list at `start=5`, because the merge is a separate transaction appended by the
  auto-joiner and the input-rules plugin only stores its own. Pre-existing
  behaviour, unchanged by this sprint, and no longer reachable by accident now
  that a year does not convert. Cmd+Z is the recovery path.

## Found while validating, out of scope

`Shift+End` selects from the caret to the **end of the document** rather than the
end of the line (plain `End` is correct). One Delete away from losing content; it
destroyed a fixture list during this session. TipTap binds `Home`/`End` but not
their Shift variants, so they fall through to Chrome's macOS default. Filed as a
separate task — not fixed here.
