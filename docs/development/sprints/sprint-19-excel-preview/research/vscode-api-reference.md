# VS Code Custom Editor API Reference - Sprint 19

**Date:** 2026-01-12
**Purpose:** Document VS Code API patterns for binary file handling

---

## CustomReadonlyEditorProvider Interface

Based on VS Code's `media-preview` extension (imagePreview).

### Interface Definition

```typescript
interface CustomReadonlyEditorProvider<T extends CustomDocument = CustomDocument> {
  /**
   * Create a CustomDocument for the given resource.
   * Called when VS Code needs to open a file.
   */
  openCustomDocument(
    uri: Uri,
    openContext: CustomDocumentOpenContext,
    token: CancellationToken
  ): Thenable<T> | T;

  /**
   * Resolve a custom editor for the given document and webview panel.
   * Called after openCustomDocument succeeds.
   */
  resolveCustomEditor(
    document: T,
    webviewPanel: WebviewPanel,
    token: CancellationToken
  ): Thenable<void> | void;
}
```

### CustomDocument Interface

```typescript
interface CustomDocument {
  readonly uri: Uri;
  dispose(): void;
}
```

---

## Real-World Example: Image Preview

From `/vscode/extensions/media-preview/src/imagePreview/index.ts`:

```typescript
export class PreviewManager implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'imagePreview.previewEditor';

  // 1. Open the document (read binary file)
  public async openCustomDocument(uri: vscode.Uri) {
    return { uri, dispose: () => { } };
  }

  // 2. Resolve the editor (setup webview)
  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel,
  ): Promise<void> {
    const preview = new ImagePreview(
      this.extensionRoot,
      document.uri,
      webviewEditor,
      // ... status bar entries
    );

    // Track lifecycle
    webviewEditor.onDidDispose(() => {
      this._previews.delete(preview);
    });
  }
}
```

**Key Observations:**
1. **Minimal CustomDocument** - Just `{ uri, dispose }` is enough for read-only
2. **No file reading in openCustomDocument** - Just return a document handle
3. **Actual loading happens in resolveCustomEditor** - Webview setup and content loading
4. **Lifecycle management** - Track webview disposal

---

## Pattern for Sprint 19

### ExcelDocument (Minimal Implementation)

```typescript
export class ExcelDocument implements vscode.CustomDocument {
  constructor(
    readonly uri: vscode.Uri,
    readonly buffer: Buffer  // We'll store the buffer for convenience
  ) {}

  dispose(): void {
    // Nothing to dispose - Buffer will be GC'd
  }
}
```

### ExcelEditorProvider

```typescript
export class ExcelEditorProvider implements vscode.CustomReadonlyEditorProvider<ExcelDocument> {

  // Step 1: Read file and create document
  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<ExcelDocument> {
    const buffer = await vscode.workspace.fs.readFile(uri);
    return new ExcelDocument(uri, Buffer.from(buffer));
  }

  // Step 2: Setup webview and send content
  async resolveCustomEditor(
    document: ExcelDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    // Load HTML
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // Handle messages
    webviewPanel.webview.onDidReceiveMessage(message => {
      if (message.type === 'ready') {
        // Send file content as Base64
        webviewPanel.webview.postMessage({
          type: 'load',
          fileType: 'xlsx',
          content: document.buffer.toString('base64'),
          encoding: 'base64'
        });
      }
    });
  }
}
```

---

## Key Differences from CustomTextEditorProvider

| Aspect | CustomTextEditorProvider | CustomReadonlyEditorProvider |
|--------|--------------------------|------------------------------|
| **Document type** | `TextDocument` (VS Code managed) | `CustomDocument` (we manage) |
| **File reading** | Automatic by VS Code | We read in `openCustomDocument` |
| **Method name** | `resolveCustomTextEditor` | `resolveCustomEditor` |
| **Binary files** | ❌ Blocked by VS Code | ✅ Fully supported |
| **Editing** | Read-write (automatic save) | Read-only (no save handling) |
| **onChange events** | `onDidChangeTextDocument` | N/A (read-only) |

---

## Registration Pattern

### package.json

```json
"customEditors": [
  {
    "viewType": "ritemark.excelViewer",
    "displayName": "Excel Preview",
    "selector": [
      {"filenamePattern": "*.xlsx"},
      {"filenamePattern": "*.xls"}
    ],
    "priority": "default"
  }
]
```

### extension.ts

```typescript
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'ritemark.excelViewer',
      new ExcelEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true  // Keep state on tab switch
        }
      }
    )
  );
}
```

---

## Why This Approach Works

1. **Separate provider** - No mixing of text/binary file handling
2. **Clean lifecycle** - `openCustomDocument` → `resolveCustomEditor` → `dispose`
3. **Buffer storage** - Read file once in `openCustomDocument`, reuse in `resolveCustomEditor`
4. **Base64 encoding** - Send binary to webview as Base64 string (SheetJS supports this natively)
5. **Reuse webview** - Same React app, just different message payload

---

## Testing Checklist

- [ ] Open .xlsx file - should show preview
- [ ] Open .xls file - should show preview
- [ ] Open .md file - should still open in TipTap editor (no regression)
- [ ] Open .csv file - should still open in SpreadsheetViewer (no regression)
- [ ] Close Excel preview - dispose() called, no memory leak
- [ ] Switch tabs - webview retains state (retainContextWhenHidden)
- [ ] Large Excel file (5MB) - loads without crash

---

## References

- **VS Code API:** `vscode.d.ts` - `CustomReadonlyEditorProvider` interface
- **Example:** `/vscode/extensions/media-preview/src/imagePreview/index.ts`
- **Guide:** https://code.visualstudio.com/api/extension-guides/custom-editors
