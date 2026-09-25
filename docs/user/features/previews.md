# Word, PowerPoint and PDF Previews

> Read Word documents, PowerPoint presentations and PDFs without leaving Ritemark.

Open a `.docx`, `.pptx` or `.pdf` file and Ritemark shows it read-only: a Word
document or PDF as pages, a presentation as its slides. Nothing is uploaded: the
preview is drawn on your computer.

---

## The toolbar

The previews share one toolbar. Scroll to move through the pages or slides.

| Control | What it does |
|---------|--------------|
| *Page 3 of 12* / *Slide 3 of 24* | Where you are |
| **−** / **+** | Zoom out or in |
| **Fit width ▾** | The zoom menu: **Fit width** makes the page as wide as the window, **Fit page** (**Fit slide** for a presentation) shows a whole one, or pick a size from 50 % to 200 % |
| Magnifier (Word, PowerPoint) | Find text. See below |
| **Open in Word ▾** (Word) | Open the file in Microsoft Word, or in Pages or your default app when Word is not installed. The arrow beside it offers **Save as Markdown** |
| **Open in PowerPoint** (PowerPoint) | Open the file in Microsoft PowerPoint, or in Keynote or your default app when PowerPoint is not installed |
| **Save as Markdown** (PDF) | Save the document as a Markdown file, with its images in `./images/` |

Fit width and fit page follow the window as you resize it, until you zoom by hand.
In a narrow window the labels become icons; hover one to see what it does.

## Presentations

A presentation reads like a document someone sent you: the slides stack one under
another, and each slide's **speaker notes** sit under it, in quiet text. A slide
without notes has nothing under it.

Only the slides near where you are reading are drawn at a time, so a long deck
full of charts stays quick.

A link on a slide opens in your browser, after Ritemark asks whether to open the
site, as any link in Ritemark does.

## Searching

Press **Cmd+F** (Ctrl+F on Windows), or click the magnifier, and type. The find bar
is the same one the Markdown editor uses.

- Every match is highlighted; the current one more strongly.
- The count shows where you are, e.g. *3 of 12*.
- **Enter** goes to the next match, **Shift+Enter** to the previous one. At the end it starts again from the beginning.
- **Escape** closes the find bar and clears the highlights.

Case doesn't matter, and a match can't run from one paragraph into the next. In a
presentation, search covers every slide and its speaker notes, and the count
includes slides you have not scrolled to yet.

## When the file changes

If the document or presentation is changed and saved in another app, the preview
reads it again and keeps you on the same page or slide. If the file is deleted or
moved, the preview says so and keeps showing the last version it read.

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

## How close to PowerPoint is it?

Text, bullets, tables, pictures, shapes, layouts, backgrounds and design themes
come close to PowerPoint. Some things differ:

- **Fonts.** Office fonts that are not installed on your Mac are drawn in a similar
  system font, as in Word documents, and a font installed nowhere is drawn in a plain
  sans font. Lines may break in slightly different places.
- **Charts** are drawn, but approximately: labels may be formatted differently
  (0.46 instead of 46 %), a legend can crowd the axis labels, and the scale of an
  axis can differ.
- **Text in shapes** that are not rectangles (a triangle, a chevron) can be cut off
  at the shape's edges.
- **Animations, transitions, audio and video** are not played. A note above the
  presentation says when it has audio, video or embedded objects.

For the exact slides, and to present them, use **Open in PowerPoint**.

## When a file can't be previewed

The preview tells you why, and offers to open the file elsewhere:

| Message | Why |
|---------|-----|
| *too large to preview* | The file is larger than 50 MB |
| *password-protected* | The preview can't open protected files. Open it in Word or PowerPoint and enter the password there |
| *in an older Office format* | The file is in the old `.doc` or `.ppt` format under a new name. Save it again as `.docx` or `.pptx` |
| *isn't a Word document* / *isn't a presentation* | The file has a `.docx` or `.pptx` name but different contents |
| *looks damaged* | Parts of the file are missing, or it does not hold what it says it holds. Word or PowerPoint may be able to repair it |
| *too complex to preview safely* | The file unpacks to far more than its size, which is how some malicious files are built |

The PowerPoint preview can be turned off with the setting
`ritemark.features.powerpoint-preview`. A presentation then says so and offers
**Open in PowerPoint**.

---

Related: [Export](export.md) · [Spreadsheets](spreadsheets.md)
