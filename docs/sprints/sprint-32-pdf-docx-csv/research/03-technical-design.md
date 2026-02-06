# Technical Design

## Overview

This sprint adds three major features:
1. PDF Preview (read-only)
2. DOCX Preview (read-only)
3. CSV Editing Enhancements (sort, add/delete rows/columns, multi-line cells)

## Architecture Decision

**All features follow existing patterns** - no architectural changes needed.

### PDF & DOCX: Follow Excel Pattern
- New CustomReadonlyEditorProvider classes
- Binary file → Base64 → Webview
- Client-side parsing and rendering
- File watching for external changes
- Refresh button in toolbar

### CSV Enhancements: Extend Existing
- Enhance DataTable.tsx component
- Add operations to SpreadsheetViewer.tsx
- Keep existing PapaParse flow

## 1. PDF Preview Design

### Extension Side: PdfEditorProvider

**Location:** `src/pdfEditorProvider.ts` (NEW)

**Pattern:** CustomReadonlyEditorProvider (like ExcelEditorProvider)

**Structure:**
```typescript
export class PdfEditorProvider implements vscode.CustomReadonlyEditorProvider<PdfDocument> {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'ritemark.pdfViewer',
      new PdfEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    );
  }

  async openCustomDocument(uri: vscode.Uri): Promise<PdfDocument> {
    const buffer = await fs.readFile(uri.fsPath);
    return new PdfDocument(uri, buffer);
  }

  async resolveCustomEditor(
    document: PdfDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    // Setup webview
    // Send PDF data as base64
    // Handle messages (refresh, error)
    // Create file watcher
  }
}
```

**Document class:**
```typescript
// src/pdfDocument.ts (NEW)
export class PdfDocument implements vscode.CustomDocument {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly buffer: Buffer
  ) {}

  dispose(): void {
    // No resources to clean up
  }
}
```

### Webview Side: PdfViewer Component

**Location:** `webview/src/components/PdfViewer.tsx` (NEW)

**Key features:**
- Page navigation (previous/next/jump to page)
- Zoom controls (fit width, fit page, custom zoom)
- Canvas rendering with PDF.js
- Text selection support
- Search functionality (future enhancement)
- Download button

**Component structure:**
```typescript
interface PdfViewerProps {
  content: string;       // Base64 PDF data
  filename: string;
  sizeBytes?: number;
}

export function PdfViewer({ content, filename, sizeBytes }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);

  // Load PDF on mount
  useEffect(() => {
    loadPdf(content);
  }, [content]);

  // Render current page
  // Page navigation
  // Zoom controls
  // Toolbar
}
```

**Toolbar:**
- Page: [< 1 / 10 >]
- Zoom: [- 100% +] [Fit Width] [Fit Page]
- [Refresh] (if file changed externally)
- [Download]

### Routing in App.tsx

Add PDF routing:
```typescript
type FileType = 'markdown' | 'csv' | 'xlsx' | 'pdf' | 'docx'

// Route to PdfViewer
if (fileType === 'pdf') {
  return <PdfViewer content={content} filename={filename} sizeBytes={sizeBytes} />
}
```

### Package.json Registration

```json
{
  "viewType": "ritemark.pdfViewer",
  "displayName": "PDF Preview",
  "selector": [
    {"filenamePattern": "*.pdf"}
  ],
  "priority": "exclusive"
}
```

## 2. DOCX Preview Design

### Extension Side: DocxEditorProvider

**Location:** `src/docxEditorProvider.ts` (NEW)

**Pattern:** CustomReadonlyEditorProvider (same as PDF)

**Structure:**
```typescript
export class DocxEditorProvider implements vscode.CustomReadonlyEditorProvider<DocxDocument> {
  // Same pattern as PdfEditorProvider
  // Read binary file → Base64 → Send to webview
}
```

**Document class:**
```typescript
// src/docxDocument.ts (NEW)
export class DocxDocument implements vscode.CustomDocument {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly buffer: Buffer
  ) {}

  dispose(): void {}
}
```

### Webview Side: DocxViewer Component

**Location:** `webview/src/components/DocxViewer.tsx` (NEW)

**Key features:**
- Convert DOCX to HTML using mammoth
- Render HTML in styled container
- Preserve document formatting
- Handle embedded images (base64 data URLs)
- Download button
- Print button (future)

**Component structure:**
```typescript
interface DocxViewerProps {
  content: string;       // Base64 DOCX data
  filename: string;
  encoding?: string;
  sizeBytes?: number;
}

export function DocxViewer({ content, filename, encoding, sizeBytes }: DocxViewerProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    convertDocx(content, encoding);
  }, [content]);

  const convertDocx = async (base64: string, enc?: string) => {
    try {
      // Decode base64 to ArrayBuffer
      const arrayBuffer = base64ToArrayBuffer(base64);

      // Convert using mammoth
      const result = await mammoth.convertToHtml({ arrayBuffer });

      setHtml(result.value);

      // Log warnings if any
      if (result.messages.length > 0) {
        console.warn('DOCX conversion warnings:', result.messages);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="docx-viewer">
      <Toolbar />
      <div
        className="docx-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
```

**Styling:**
- Document-like appearance (white background, max-width, margins)
- VS Code theme support for text colors
- Preserve DOCX styles (headings, lists, bold, italic)

**Toolbar:**
- [Refresh] (if file changed externally)
- [Download]
- [Print] (future)

### Routing in App.tsx

Add DOCX routing:
```typescript
if (fileType === 'docx') {
  return <DocxViewer content={content} filename={filename} encoding={encoding} sizeBytes={sizeBytes} />
}
```

### Package.json Registration

```json
{
  "viewType": "ritemark.docxViewer",
  "displayName": "Word Preview",
  "selector": [
    {"filenamePattern": "*.docx"},
    {"filenamePattern": "*.doc"}
  ],
  "priority": "exclusive"
}
```

**Note:** `.doc` (old Word format) may not work with mammoth. We'll support `.docx` only and show error message for `.doc`.

## 3. CSV Editing Enhancements

### No New Files Needed

Enhance existing:
- `webview/src/components/SpreadsheetViewer.tsx`
- `webview/src/components/DataTable.tsx`
- `webview/src/components/header/SpreadsheetToolbar.tsx` (if needed)

### Feature 1: Sort Columns

**UI:** Click column header to toggle sort (asc → desc → none)

**Implementation in DataTable.tsx:**
```typescript
import { getSortedRowModel, type SortingState } from '@tanstack/react-table';

const [sorting, setSorting] = useState<SortingState>([]);

const table = useReactTable({
  data,
  columns: columnDefs,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(), // Enable sorting
  onSortingChange: setSorting,
  state: { sorting }
});
```

**Header rendering:**
```typescript
<th onClick={() => header.column.toggleSorting()}>
  {header.column.columnDef.header}
  {header.column.getIsSorted() === 'asc' && ' ↑'}
  {header.column.getIsSorted() === 'desc' && ' ↓'}
</th>
```

**No backend sync needed:** Sorting is view-only, doesn't change file until user edits.

### Feature 2: Add/Delete Rows

**UI:** Buttons in toolbar or context menu

**Add row:**
```typescript
const handleAddRow = useCallback(() => {
  if (!parsedData || !onChange) return;

  // Create new empty row
  const newRow: Record<string, unknown> = {};
  parsedData.columns.forEach(col => {
    newRow[col] = '';
  });

  const newRows = [...parsedData.rows, newRow];

  setParsedData({ ...parsedData, rows: newRows });

  // Serialize and notify
  const csvString = Papa.unparse(newRows, { columns: parsedData.columns });
  onChange(csvString);
}, [parsedData, onChange]);
```

**Delete row:**
```typescript
const handleDeleteRow = useCallback((rowIndex: number) => {
  if (!parsedData || !onChange) return;

  const newRows = parsedData.rows.filter((_, idx) => idx !== rowIndex);

  setParsedData({ ...parsedData, rows: newRows });

  const csvString = Papa.unparse(newRows, { columns: parsedData.columns });
  onChange(csvString);
}, [parsedData, onChange]);
```

**UI placement:**
- Toolbar: [+ Add Row] button
- Row actions: Click row number → context menu → Delete

### Feature 3: Add/Delete Columns

**Add column:**
```typescript
const handleAddColumn = useCallback((columnName: string) => {
  if (!parsedData || !onChange) return;

  // Add column to list
  const newColumns = [...parsedData.columns, columnName];

  // Add empty values to all rows
  const newRows = parsedData.rows.map(row => ({
    ...row,
    [columnName]: ''
  }));

  setParsedData({ columns: newColumns, rows: newRows });

  const csvString = Papa.unparse(newRows, { columns: newColumns });
  onChange(csvString);
}, [parsedData, onChange]);
```

**Delete column:**
```typescript
const handleDeleteColumn = useCallback((columnId: string) => {
  if (!parsedData || !onChange) return;

  const newColumns = parsedData.columns.filter(col => col !== columnId);

  const newRows = parsedData.rows.map(row => {
    const { [columnId]: _, ...rest } = row;
    return rest;
  });

  setParsedData({ columns: newColumns, rows: newRows });

  const csvString = Papa.unparse(newRows, { columns: newColumns });
  onChange(csvString);
}, [parsedData, onChange]);
```

**UI placement:**
- Toolbar: [+ Add Column] button → prompt for column name
- Column header: Right-click → Delete Column

### Feature 4: Multi-line Cell Editing

**Current:** Single-line input with Enter to save

**Enhanced:** Modal or expanding textarea

**Option A: Modal Dialog (Better UX)**

```typescript
function EditCellDialog({
  value,
  rowIndex,
  columnId,
  onSave,
  onCancel
}: EditCellDialogProps) {
  const [editValue, setEditValue] = useState(value);

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Cell</DialogTitle>
        </DialogHeader>
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full h-48 p-2 border rounded"
          autoFocus
        />
        <DialogFooter>
          <Button onClick={onCancel} variant="ghost">Cancel</Button>
          <Button onClick={() => onSave(editValue)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Trigger:** Double-click cell (single-click = select row, double-click = edit)

**Option B: Inline Textarea (Simpler)**

Replace `<input>` with `<textarea>` in EditableCell component:
```typescript
<textarea
  ref={textareaRef}
  value={editValue}
  onChange={(e) => setEditValue(e.target.value)}
  onBlur={handleBlur}
  className="w-full min-h-[60px] bg-transparent resize-y"
  rows={3}
/>
```

**Recommended:** Option A (modal) for better UX and cleaner table layout.

## Extension Registration Changes

Register new providers in `src/extension.ts`:

```typescript
// Register PDF viewer (read-only)
context.subscriptions.push(
  PdfEditorProvider.register(context)
);

// Register DOCX viewer (read-only)
context.subscriptions.push(
  DocxEditorProvider.register(context)
);

// Excel and CSV already registered - no changes
```

## Message Protocol Extensions

### PDF Viewer Messages

**Webview → Extension:**
- `ready` - webview mounted
- `refresh` - reload file from disk
- `error` - parsing error

**Extension → Webview:**
- `load` - send PDF data
  ```json
  {
    "type": "load",
    "fileType": "pdf",
    "content": "base64...",
    "encoding": "base64",
    "filename": "document.pdf",
    "sizeBytes": 1234567
  }
  ```
- `fileChanged` - file modified externally

### DOCX Viewer Messages

Same as PDF (identical protocol).

### CSV Editing Messages

**No changes needed** - existing `contentChanged` message handles all edits.

## File Size Handling

### PDF Files
- **Large file warning:** Show warning for PDFs > 10MB
- **Lazy page loading:** Render pages on-demand (not all at once)
- **Worker offloading:** PDF.js uses web worker for parsing

### DOCX Files
- **Large file warning:** Show warning for DOCX > 5MB
- **Conversion may take time:** Show spinner during mammoth conversion
- **Memory consideration:** HTML output can be large for complex docs

### CSV Files
- **Already handled:** 10,000 row limit with warning

## Error Handling

### PDF Errors
- Corrupted PDF → Show error message with "Open in external app" button
- Unsupported PDF version → Show warning
- Rendering failure → Show page-specific error

### DOCX Errors
- Corrupted DOCX → Show error message
- Unsupported .doc format → "Only .docx supported, please convert"
- Image loading failure → Log warning, show broken image placeholder

### CSV Errors
- Already handled in existing code

## Performance Considerations

### Initial Load
- PDF.js worker loads async (no blocking)
- mammoth conversion runs async (shows spinner)
- Large files get warning before processing

### Memory Usage
- PDF.js: ~10-20MB for worker + cached pages
- mammoth: ~5-10MB during conversion
- Acceptable for Electron app

### Webview Bundle Size
- Current: ~900KB
- After sprint: ~3.5MB
- Trade-off acceptable for built-in app

## Testing Strategy

### Unit Tests
- Not required for webview components (React testing not set up)
- Manual testing sufficient

### Manual Testing
1. **PDF Preview:**
   - Open small PDF (1 page)
   - Open large PDF (100+ pages)
   - Test page navigation
   - Test zoom controls
   - Test file change notification + refresh
   - Test corrupted PDF error handling

2. **DOCX Preview:**
   - Open simple DOCX (text only)
   - Open complex DOCX (images, tables, formatting)
   - Open .doc file (should show error)
   - Test file change notification + refresh
   - Test corrupted DOCX error handling

3. **CSV Editing:**
   - Sort column (asc/desc/none)
   - Add new row
   - Delete row
   - Add new column (with name prompt)
   - Delete column
   - Edit cell with multi-line text (double-click → modal)
   - Verify all edits persist to file

## Security Considerations

### PDF Viewing
- **No JavaScript execution:** PDF.js renders to canvas (no embedded JS execution)
- **Safe for untrusted PDFs**

### DOCX Viewing
- **HTML injection risk:** Use `dangerouslySetInnerHTML` carefully
- **Mammoth sanitizes:** Library outputs clean HTML (no script tags)
- **CSP protection:** VS Code webview CSP prevents inline scripts

### CSV Editing
- **No injection risk:** PapaParse escapes values
- **File system:** VS Code handles file writes (no direct FS access)

## Future Enhancements (Not in Sprint)

### PDF
- Text search
- Annotations
- Print support
- PDF form filling

### DOCX
- Edit support (convert HTML back to DOCX)
- Comments/track changes viewing
- Print support

### CSV
- Filter rows
- Formula support
- Cell formatting (colors, alignment)
- Import/export to Excel

## Rollback Plan

If any feature fails QA:
- **PDF/DOCX:** Remove custom editor registration from package.json (files open in external app)
- **CSV enhancements:** Revert DataTable.tsx and SpreadsheetViewer.tsx changes (editing still works, just loses new features)

No database migrations or breaking changes - safe to rollback.
