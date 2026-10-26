# Audit A5: equations and quotes in a real Google Doc

**Not run.** This session had no test Google account, and a person's own account is not used for tests. The code is built and unit-tested to the Docs API's documented requests; a real Doc has not seen it.

## What is built (`src/googleDocs/mapper.ts`)

| Case | Requests |
|---|---|
| Display equation | its own paragraph, centred, with the picture inserted at a placeholder by `insertInlineImage` with `objectSize` from the picture's size in pt |
| Inline equation | a placeholder token in its sentence (`⁣RITEMARK_MATH_n⁣`), replaced by `insertInlineImage` with `objectSize` |
| Equation in a table cell | its LaTeX, because Ritemark fills table cells with text only; the result notification says how many |
| A typo | its LaTeX in the code font; the result notification counts it |
| A quote (#408) | `indentStart` and `indentFirstLine` at the same value, so every line of the quote lines up; a 0.5 pt left border; `fields: 'indentStart,indentFirstLine,borderLeft'` |
| The change hash | ignores picture bytes, so a re-render of the same equation does not count as a change (`hashableExportHtml`) |

Pictures reach Google the way diagrams already do: uploaded to the person's Drive, shared by link while Docs copies them, then unshared and deleted.

## What a test account must check (S39–S41)

1. An inline picture lands in its sentence at the text's size. Google Docs puts an inline image's bottom on the text's baseline, so an equation with a subscript or a fraction sits higher than in the editor, by its depth. Whether that reads acceptably is part of the check.
2. A display equation is centred on its own line.
3. #408: a long quote's second line starts at the first line's indent, with a thin bar on the left and the text's padding as drawn.
4. An unchanged document is "already up to date" after a publish.

If any of these fails, the plan's order holds: equations in Google Docs are the first thing to cut (decision 2), the quote fix stays.
