# A3: Word text through the Office preview's zip reader (R2)

Run on 1 November 2026 on the Mac, on `sprint-148-search-words`. Cases in `src/search/worker/readers.test.ts`.

## How it reads

1. `checkOfficePackage(bytes, 'word/')`, the preview's own check with its limits (`OFFICE_PREVIEW_LIMITS`: 50 MB, 10,000 entries, 400 MB unpacked, the bomb ratio, every part inflated to its declared size).
2. `readZipDirectory` finds `word/document.xml`; `readZipEntry`, new in `officePackageCheck.ts`, inflates that one entry capped at its declared size. It shares the local-header arithmetic with `verifyDeclaredSizes` (`entryDataRange`), which is otherwise unchanged; the file's own tests still pass.
3. The XML is scanned tag by tag: `w:t` text kept; `w:tab`, `w:br`, `w:cr` as spaces; one passage per paragraph (`w:p`) and per table cell (`w:tc`, its paragraphs joined); a text box's paragraphs (`w:txbxContent`) are passages of their own.

## The cases

| Case | Result |
|---|---|
| Runs split by formatting (`Harbour ` + **report** + ` for 2027`) | One passage, `Harbour report for 2027` |
| A tab and a line break | Spaces |
| A table | One passage per cell |
| Estonian and other marks (`Käsi ja õun`, `Müller and José`) | As written |
| Deleted text (`w:delText`), a field's code (`w:instrText`, `PAGE`) | Left out: no words |
| Inserted text (`w:ins`) | Kept |
| A text box | Its own passage |
| `03-tables.docx` (Sprint 124's corpus, saved by Word) | Read, with its routes table |
| `f3-password-protected.docx` | Found by name (`protected`) |
| `f2-truncated.docx`, `f1-not-a-zip.docx`, a legacy `.doc` renamed | Found by name (`unreadable`); a real `.doc` isn't a kind search reads |
| `f4-decompression-bomb.docx` | Refused by the preview's check |

## Left out in Sprint 148, as proposed

Headers, footers, footnotes, endnotes and comments (`header*.xml`, `footnotes.xml`, `comments.xml`). Their words are the person's too; adding them is one loop over more parts, and the reader version (`READER_VERSION`) drops the old copies when it changes.
