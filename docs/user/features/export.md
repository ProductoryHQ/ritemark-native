# Export

> Share your documents as PDF or Word files with one click.

Export your markdown documents to professional formats that anyone can open. Export V2 uses HTML-based rendering for higher visual fidelity.

---

## What You Can Do

- **Export to PDF** - Universal format, looks the same everywhere
- **Export to Word** - Editable .docx for Microsoft Word or Google Docs
- **HTML-based rendering** - Export from editor HTML, not line-by-line markdown parsing
- **Template styles** - Choose `Default` or `Clean` template from Export menu
- **Preserve formatting** - Headings, lists, tables, code blocks, and metadata export more reliably

---

## How to Export

1. Open any markdown document
2. Click **Export** in the document header (top-right)
3. Choose **PDF** or **Word** template option (`Default` or `Clean`)
4. Pick a save location
5. Done - file is saved

The export button only appears for markdown files (not CSV or Excel).

---

## PDF Export

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
- **Templates:** Default (sans-serif), Clean (serif)

---

## Word Export

Creates a `.docx` file editable in Microsoft Word, Google Docs, or LibreOffice.

### What's Included

| Element | How It Appears |
|---------|----------------|
| Headings | Styled as Heading 1, 2, 3 |
| Paragraphs | Normal style with template fonts |
| Bold/Italic | Preserved |
| Lists | Proper bullet/number formatting (incl. nested) |
| Tables | Formatted tables |
| Footer | Document label in footer |

### Document Properties

If you've set document properties:
- **Title** - Document title
- **Author** - Author name

### Page Format

- **Font:** Based on chosen template (`Default` or `Clean`)
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

- **Check before sharing** - Open the exported file to verify formatting
- **Large documents** - Export works on documents of any size
- **Tables** - Complex tables may need manual adjustment after Word export
- **No batch export** - Export one document at a time

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
- [Core Editor](editor.md) - Basic editing
