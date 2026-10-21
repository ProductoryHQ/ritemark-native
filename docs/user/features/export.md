# Share

> Send a copy of your document as a PDF or Word file with one click.

**Share**, at the right end of the document's bar, sends a copy of your markdown document in a format anyone can open. The document itself stays on your computer; sharing sends a copy. The copies use HTML-based rendering for higher visual fidelity.

---

## What You Can Do

- **Send a copy as a PDF** - For reading and printing; looks the same everywhere
- **Send a copy as a Word document** - Editable .docx for people who edit in Word or Google Docs
- **Publish to Google Docs** - One Google Doc you update from here. See [Publish to Google Docs](google-docs.md)
- **Copy as Markdown** - For email and chat
- **HTML-based rendering** - Copies are made from the editor's HTML, not line-by-line markdown parsing
- **Preserve formatting** - Headings, lists, tables, code blocks, and metadata carry over reliably

---

## How to Share a Copy

1. Open any markdown document
2. Click **Share** on the document's bar (top-right), or choose **File → Share**
3. Under **Send a copy**, choose **PDF** or **Word document**
4. Pick a save location
5. Done - file is saved

Share's PDF, Word and Google Docs items are for markdown documents. A PDF or Word file has its own **Share**, with **Show in Finder** (**Show in File Explorer** on Windows) and **Open in Preview** or **Open in Word**; see [Previews](previews.md).

---

## PDF Copy

Creates a `.pdf` file that looks great on any device.

### What's Included

| Element | How It Appears |
|---------|----------------|
| Headings | H1 (24pt), H2 (18pt), H3 (14pt) |
| Paragraphs | 11pt body text |
| Bold/Italic | Preserved |
| Links | Link text preserved |
| Bullet lists | Standard bullets (•) |
| Numbered lists | Sequential numbers |
| Task lists | Checkboxes (checked/unchecked) |
| Blockquotes | Italic gray text |
| Code blocks | Monospace font, syntax-colored tokens |
| Tables | Grid with borders |
| Horizontal rules | Light gray line |
| Header/Footer | Document title and page numbering |

### Document Properties

If you've set [document properties](document-properties.md):
- **Title** - Used as PDF title metadata
- **Author** - Used as PDF author metadata

### Page Format

- **Size:** A4
- **Margins:** 1 inch on all sides
- **Style:** one clean sans-serif style for every document; there is no template to choose

---

## Word Copy

Creates a `.docx` file editable in Microsoft Word, Google Docs, or LibreOffice.

### What's Included

| Element | How It Appears |
|---------|----------------|
| Headings | Styled as Heading 1, 2, 3 |
| Paragraphs | Normal style |
| Bold/Italic | Preserved |
| Lists | Proper bullet/number formatting (incl. nested) |
| Tables | Formatted tables |
| Footer | Document label in footer |

### Document Properties

If you've set document properties:
- **Title** - Document title
- **Author** - Author name

### Page Format

- **Font:** The same style for every document
- **Size:** Letter/A4 (depends on your region)

---

## Known Limitations

Some elements have limitations:

| Element | PDF | Word |
|---------|-----|------|
| Remote (http/https) images | Not embedded | Not embedded |
| Very complex merged tables | May need manual adjustment | May need manual adjustment |
| Advanced CSS from editor | Simplified for print-safe output | Simplified for document-safe output |

---

## File Names

Default filename: Same as your document name with new extension.
- `my-document.md` → `my-document.pdf`
- `my-document.md` → `my-document.docx`

You can change the name in the save dialog.

---

## Tips

- **Check before sending** - Open the copy to verify formatting
- **Large documents** - Share works on documents of any size
- **Tables** - Complex tables may need manual adjustment in a Word copy
- **One at a time** - Share sends one document at a time

---

## Use Cases

| Goal | Use |
|------|-----|
| Share with non-technical people | PDF |
| Client deliverable | PDF |
| Collaborative editing | Word |
| Print | PDF |
| Further editing | Word |

---

## Related

- [Document Properties](document-properties.md) - Add title and author
- [Publish to Google Docs](google-docs.md) - Share's Google Docs items
- [Core Editor](editor.md) - Basic editing
