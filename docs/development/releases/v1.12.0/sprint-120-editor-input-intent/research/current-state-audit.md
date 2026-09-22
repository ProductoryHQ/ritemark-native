# Sprint 120 Phase 0 — where the false list comes from

**Status:** desk audit and live reproduction, 2026-09-22, on `main` at `e9094517` (dev build, macOS arm64).
**Issue:** [#280](https://github.com/ProductoryHQ/ritemark-native/issues/280). The release plan asks Phase 0 to say whether the behaviour is TipTap's input rule, an editor wrapper, or Markdown rehydration, and to fix it at the narrowest correct layer without special-casing one literal year.

## Answer

It is **the input rule, and only the input rule**. Both Markdown directions already treat a year as prose when the author meant prose.

| Layer | What it does today | Verdict |
| --- | --- | --- |
| Typing (TipTap) | `@tiptap/extension-ordered-list` ships `inputRegex = /^(\d+)\.\s$/` and Ritemark uses it unchanged (`webview/src/components/Editor.tsx`, `OrderedList.configure({ HTMLAttributes })`). Any integer plus `. ` converts the paragraph. | **The defect** |
| Save (HTML → Markdown) | `createTurndownService()` keeps Turndown's default escaping, whose last rule is `[/^(\d+)\. /g, '$1\\. ']`. A paragraph `2026. a` is written as `2026\. a`. `Editor.tsx:149` uses this same service for the editor's save path. | Correct |
| Load (Markdown → HTML) | The scoped `marked` instance renders `2026\. a` as a paragraph and `2026. b` as an ordered list with `start="2026"`. The second is what CommonMark says that line is. | Correct |

## Live reproduction

1. **Typing.** In a Markdown document, at the end of a paragraph: Enter, then `2026. a`.
   Result: `<ol class="tiptap-ordered-list" start="2026"><li><p>a</p></li></ol>`.
   Saved file: `2026.  a` (list serialization), which reopens as the same list. The author's prose is gone from the file, not just from the view.
2. **Escaped prose round-trips.** A file containing `2026\. a` opens as a paragraph, and typing prose that never triggers the rule saves back escaped. So the file format can hold both meanings; only the editor's guess is wrong.
3. **Adjacent list corruption (new finding).** With an ordered list `start="2026"` already in the document, typing `1999. ` in the empty paragraph directly above it:
   - the new paragraph becomes a list item **and merges with the existing list**;
   - the existing list's `start` changes from `2026` to `1999`, so its numbering silently changes;
   - pressing Backspace (the input-rule undo) turns the new item back into a paragraph but **leaves `start="1999"`**. The original numbering is not restored.

   First reading: worse than the reported bug. That reading was wrong — see the next section, which is the one that stands.

## The adjacent-list merge, re-examined (2026-09-22, before writing Phase 2 code)

The merge in observation 3 comes from `tiptap-extension-auto-joiner`, not from the
input rule: its `joinableNodes` always contains `bulletList` and `orderedList`
whatever `elementsToJoin` says, so two adjacent ordered lists are always joined.
Before writing a guard against it, the question was whether the *unjoined*
document is even representable. It is not:

| Markdown in | What the editor's `marked` gives back |
| --- | --- |
| `5. a` + blank line + `2026. b` | one `<ol start="5">` with items `a`, `b` |
| `5. a` + `2026. b` | one `<ol start="5">` with items `a`, `b` |
| the same two, separated by `<!-- -->` | two lists — but only because of the HTML comment |

And in the other direction, saving two separate lists
(`<ol start="5">a</ol><ol start="2026">b</ol>`) produces Markdown that reopens as
a single list starting at 5.

So a CommonMark file cannot hold two adjacent ordered lists with different start
numbers; the first marker wins and the second is renumbered. Blocking the join
would show the author two lists that silently become one the next time the file
is opened — the editor would be promising something the format does not keep.
**The merge is not a separate defect. It is what the file already means, shown at
typing time.**

What remains of observation 3 after the Phase 1 bound:

- `1999. ` (and any 3+ digit number) no longer creates a list at all, so the
  accidental path that motivated the finding is closed.
- A deliberate `5. ` typed above an existing list still merges — and that is the
  correct outcome, because the saved file would produce exactly that list.
- The one thing still worth checking by hand is undo fidelity: after the merge,
  Backspace (the input-rule undo) must put the document back as it was, including
  the list's `start`. That is a Phase 4 check in the running app, not a guard in
  the extension.

`webview/src/utils/orderedListRoundTrip.test.ts` pins all of the above, so a
future change cannot re-introduce a guard on a false premise.

## What the fix has to keep

- `1. Item` still creates a list (the overwhelmingly common deliberate marker).
- Imported and pasted Markdown lists keep their semantics: the load path must not change.
- Prose stays prose through save and reopen, which already works once the editor stops converting.


## What other editors do

**LibreOffice Writer bounds the number at two digits.** `SwAutoFormat::GetDigitLevel` in `sw/source/core/edit/autofmt.cxx` stops as soon as a third digit appears:

```cpp
if( 3 == ++nDigitCnt )   // more than 2 numbers are not an enum anymore
    return USHRT_MAX;
```

So `99. ` starts a list in Writer and `2026. ` stays prose. ([source](https://docs.libreoffice.org/sw/html/autofmt_8cxx_source.html))

**Microsoft Word:** its AutoFormat As You Type documentation describes the feature ("when you type 1. followed by a space, Word assumes you are starting a numbered list") but does not publish the numeric rule, and the behaviour was not verified here. No claim is made about it.

This is why the bound below is **99**, not a number we invented.

## Decision for Jarmo

**What counts as a deliberate list marker when typing?** The input rule only sees the number, never the text that follows, so this is a product choice, not something we can detect.

| Option | Behaviour | Cost |
| --- | --- | --- |
| **A. Bound the number (proposed)** | Convert `1.`–`99.`, the LibreOffice Writer bound; three digits and up stay prose. | A list deliberately started at 100+ must be made with the toolbar or the slash menu. |
| B. Only `1.` converts | Every other number stays prose. | Breaks the normal habit of continuing a list at `2.`, `3.` after a paragraph break. |
| C. Exclude a year-like range (1000–2999) | `3000. ` would still convert. | An arbitrary window, and the release plan asks us not to encode "a year". |

Option A is what this sprint proposes, with the bound taken from LibreOffice Writer rather than invented: one bound, no year knowledge, and every number a person actually starts a list with keeps working.

**Decided 2026-09-22 (Jarmo):** Option A. The bound is 99, matching LibreOffice Writer's rule. The adjacent-list merge is fixed regardless of the option, because a bounded rule no longer fires there — but the sprint should also cover the merge case with a test, since a deliberate `5. ` typed above an existing list can still merge.

**Addendum 2026-09-22 (same day, before Phase 2 code):** that last clause does not survive the round-trip evidence above. A deliberate `5. ` above an existing list merges, and the merge is correct — Markdown gives the same single list. Phase 2 therefore ships the round-trip test that documents this instead of a guard against the join. Nothing else in the decision changes: the bound is still 99.
