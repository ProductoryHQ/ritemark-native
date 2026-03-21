# Good First Issues

Issues suitable for new contributors. File these on GitHub with `good first issue` and `help wanted` labels after the repository goes public.

---

## 1. Data table columns have no max-width

**Labels:** `good first issue`, `help wanted`, `bug`, `data-editor`

**Description:** Long cell content stretches data table columns infinitely. Text never wraps because cells use `whitespace-nowrap` with `text-ellipsis`. Need to add a `max-width` (300-400px) and switch to `whitespace-normal` + `word-break: break-word`.

**Files:** `extensions/ritemark/webview/src/components/DataTable.tsx` (line ~516, header `minWidth: 100` at line ~271)

**Why good first issue:** Single file, CSS-only fix, clear before/after behavior.

**Acceptance criteria:**
- Columns have a reasonable max-width
- Long text wraps within cells
- Both CSV and Excel preview are affected
- Short content columns are not forced to max-width

---

## 2. CSV row deletion with context menu

**Labels:** `good first issue`, `help wanted`, `enhancement`, `data-editor`

**Description:** Add a right-click context menu option to delete a row in CSV editing mode. Currently rows can be added but not deleted.

**Files:** `extensions/ritemark/webview/src/components/DataTable.tsx`

**Why good first issue:** Isolated component, follows existing "add row" pattern, clear UI interaction.

**Acceptance criteria:**
- Right-click on a row shows a context menu with "Delete row" option
- Clicking "Delete row" removes the row
- The CSV file is updated after deletion

---

## 3. Custom Welcome tab icon (Windows)

**Labels:** `good first issue`, `help wanted`, `enhancement`, `windows`

**Description:** On Windows, the Welcome tab shows the default VS Code editor icon. Replace it with the Ritemark icon.

**Files:** Likely in `patches/vscode/` (branding patch) and `branding/` directory

**Why good first issue:** Icon/CSS only change, isolated scope, visible result.

**Acceptance criteria:**
- Welcome tab shows Ritemark icon instead of VS Code default icon
- Works on Windows (macOS may already be correct)

---

## 4. Add YouTube video embed from slash command

**Labels:** `good first issue`, `help wanted`, `enhancement`, `text-editor`

**Description:** Add a `/youtube` slash command that lets users embed a YouTube video in their markdown document. The editor already has a slash command system.

**Files:** `extensions/ritemark/webview/src/components/SlashCommands/` (follow existing slash command patterns)

**Why good first issue:** Clear pattern to follow from existing slash commands, isolated feature.

**Acceptance criteria:**
- `/youtube` appears in slash command palette
- Prompts for a YouTube URL
- Embeds the video in the document
- Saves as standard markdown (e.g., a link or HTML embed)

---

## 5. PowerPoint (.pptx) preview

**Labels:** `help wanted`, `enhancement`, `data-editor`

**Description:** Add read-only preview support for PowerPoint files, following the pattern of existing PDF and Excel preview.

**Files:**
- `extensions/ritemark/src/` (new viewer provider, follow `pdfViewerProvider.ts` pattern)
- `extensions/ritemark/package.json` (register custom editor for `.pptx`)

**Why good first issue:** Clear pattern to follow from PDF/Excel viewers, well-defined scope.

**Acceptance criteria:**
- `.pptx` files open in Ritemark with a preview
- Read-only (no editing required)
- Basic slide content is visible

---

## 6. Batch export folder as .zip of DOCX

**Labels:** `help wanted`, `enhancement`, `export`

**Description:** Add a command to export all markdown files in a folder as a .zip archive of Word documents. The single-file DOCX export already exists.

**Files:**
- `extensions/ritemark/src/export/` (extend existing export module)
- `extensions/ritemark/package.json` (register new command)

**Why good first issue:** Extends existing export functionality, clear scope.

**Acceptance criteria:**
- Right-click folder in explorer shows "Export as DOCX archive" option
- Creates a .zip file containing .docx versions of all .md files in the folder
- Uses existing single-file DOCX export logic

---

## 7. Windows: save triggers stale file notification

**Labels:** `good first issue`, `help wanted`, `bug`, `windows`

**Description:** On Windows, every save triggers the stale file indicator as if the file was modified externally. The file watcher is not distinguishing between internal saves and external changes.

**Files:** `extensions/ritemark/src/` (likely in the custom editor provider or file watcher logic)

**Why good first issue:** Specific and reproducible behavior, important for Windows users, investigation-oriented.

**Acceptance criteria:**
- Saving a file on Windows does not trigger the "file changed externally" notification
- External changes still trigger the notification correctly

---

## Filing Instructions (for Jarmo)

After the repo goes public:

1. Go to GitHub Issues > New Issue
2. Use the title and description from each section above
3. Add the labels listed for each issue
4. Optionally assign a milestone (e.g., "Community Contributions")
