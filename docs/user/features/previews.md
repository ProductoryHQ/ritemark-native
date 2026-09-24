# Word and PDF Previews

> Read Word documents and PDFs page by page, without leaving Ritemark.

Open a `.docx` or `.pdf` file and Ritemark shows it read-only, as pages. Nothing
is uploaded: the preview is drawn on your computer.

---

## The toolbar

Both previews share one toolbar.

| Control | What it does |
|---------|--------------|
| **↑ 3 / 12 ↓** | The page you are reading, and the previous or next page |
| **− 100 % +** | Zoom out or in |
| **Fit width** | Make the page as wide as the window |
| **Fit page** | Show one whole page |
| **Search** (Word) | Find text on every page. See below |
| **Save as Markdown** | Save the document as a Markdown file, with its images in `./images/` |
| **Open in Word** (Word) | Open the file in Microsoft Word, or in Pages or your default app when Word is not installed |
| **↻** (Word) | Read the file from disk again |

Fit width and fit page follow the window as you resize it, until you zoom by hand.

## Searching a Word document

Press **Cmd+F** (Ctrl+F on Windows), or click the search field, and type.

- Every match is highlighted; the current one more strongly.
- The count shows where you are, e.g. *3 of 12*.
- **Enter** goes to the next match, **Shift+Enter** to the previous one. At the end it starts again from the beginning.
- **Escape** clears the search. Press it again to leave the field.

Case doesn't matter, and a match can't run from one paragraph into the next.

## When the file changes

If the Word document is changed and saved in another app, the preview reads it
again and keeps you on the same page. If the file is deleted or moved, the preview
says so and keeps showing the last version it read.

## How close to Word is it?

The preview draws the document itself, as a web page. It comes close to Word for
ordinary documents, but it is not Word, so some things differ:

- **Pages.** A document last saved by Word shows Word's own page breaks. A document
  made by another program (a Google Docs export, for example) shows fewer, longer
  pages: page breaks there come only from manual breaks and section changes.
- **Long tables** are not split across pages the way Word splits them.
- **Fonts.** When a document uses Office fonts (Calibri, Cambria, Aptos) that are
  not installed on your Mac, the preview uses a similar system font. Lines may then
  break in slightly different places, and a page can run a little longer than in
  Word. Fonts embedded in the document are used.
- **Charts, SmartArt and embedded objects** are not drawn, and **equations** are
  drawn only roughly. A note above the document says when it contains any of them.

For the exact layout, use **Open in Word**.

## When a file can't be previewed

The preview tells you why, and offers to open the file elsewhere:

| Message | Why |
|---------|-----|
| *too large to preview* | The file is larger than 50 MB |
| *password-protected* | The preview can't open protected files. Open it in Word and enter the password there |
| *in an older Office format* | Old `.doc` files aren't previewed. Save it again as `.docx` |
| *isn't a Word document* | The file has a `.docx` name but different contents |
| *looks damaged* | Parts of the file are missing. Word may be able to repair it |
| *too complex to preview safely* | The file unpacks to far more than its size, which is how some malicious files are built |

---

Related: [Export](export.md) · [Spreadsheets](spreadsheets.md)
