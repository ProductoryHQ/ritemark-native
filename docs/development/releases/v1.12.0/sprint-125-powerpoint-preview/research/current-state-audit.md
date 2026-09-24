# Sprint 125 Phase 0 — PowerPoint preview today

Read on `sprint-125-powerpoint-preview`, branched from `origin/main` `9940d086`
(Sprint 124 merged, 2026-09-24). Every claim is a line of code, a measurement, or a
quoted source. The renderer spike is its own document:
[renderer-spike.md](./renderer-spike.md).

## 1. What a `.pptx` does today

Nothing in Ritemark handles it. `package.json` registers custom editors for `.md`,
`.csv`, `.xlsx`/`.xls`, `.flow.json`, `.pdf`, `.docx`, `.drawio.svg` and audio, and
none for `.pptx`. Opened in a dev build, a PowerPoint-saved deck falls through to
VS Code's text editor, which says *"The file is not displayed in the text editor
because it is either binary or uses an unsupported text encoding."* with **Open
Anyway**, and that button shows the raw ZIP bytes. There is no way to open the file
in PowerPoint from there.

## 2. What Sprint 124 left to build on

| Piece | Where | Reuse for PowerPoint |
|---|---|---|
| Office bundle `media/office-preview.js` (1.3 MB), built by `vite build --mode office` | `webview/src/office/main.tsx`, `OfficePreviewApp.tsx` | The app routes on `fileType`; today only `'docx'` (`OfficePreviewApp.tsx:25`). A `'pptx'` branch joins it. The release tooling (pre-commit hook, extension-update file list, preflights, `build-prod.sh`, staging) already knows the file, so **no release script changes** |
| Read-only provider pattern | `src/docxEditorProvider.ts` | Registration with `retainContextWhenHidden` (31–36), the size gate before reading (51), the host pre-check (133) → `loadError` (137) or `load` (143), the CSP (178), the external-app resolution (206–221), the file watcher → `fileChanged` / `fileDeleted` (233–259). A PowerPoint provider is the same shape |
| Host pre-check | `src/officePreview/officePackageCheck.ts` | Size, CFB container (password-protected / legacy), ZIP directory, entry count, ratio; `checkOfficePackage(buffer, 'word/')` takes the part prefix, so `'ppt/'` works. **But see §4** |
| Toolbar | `viewers/ViewerToolbar.tsx` | `PageIndicator`, `ZoomControls`, `SplitButton`, compact mode — the redesigned bar Jarmo approved |
| Search | `FindBarShell.tsx`, `viewers/documentSearch.ts` (`findDocumentMatches`, line 30), CSS Custom Highlight API | pptx-renderer draws text as DOM (charts are canvas), so slide text can be searched the same way |
| Zoom and fit | `viewers/viewerLayout.ts`, the stage-in-a-sizer transform in `docxPreview.css` | Slides are fixed-size boxes like pages |
| Office font aliases | `viewers/docx/officeFonts.ts` (`OFFICE_FONT_ALIASES` line 24, 88 % at line 33, `installOfficeFontAliases` line 74) | pptx-renderer's own stack starts with the Office family name (spike defect 7), so the same `@font-face` aliases catch it |

## 3. External app

`resolveExternalApp` in `docxEditorProvider.ts` (206–221) tries Word, then Pages on a
Mac, then the system default. For PowerPoint the order would be PowerPoint, then
Keynote, then the default.

`isAppInstalled` (`src/utils/openExternal.ts:21`) checks the Windows registry only
for Excel and Word; **for any other app it returns `true`** (lines 36–37, "assume
file association will handle it"). On Windows a PowerPoint button would therefore
say "Open in PowerPoint" whether or not PowerPoint is installed. It needs a
`powerpnt.exe` App Paths check like Word's.

## 4. The host pre-check reads declared sizes only

`officePackageCheck.ts:3`: *"Nothing is inflated."* The unpacked total and the
per-part ratio (155–158) come from the sizes the ZIP's central directory declares.
The spike's `f4-bomb-lying-size` rewrites those sizes to 4 KiB for a part that
inflates to 504 MiB. The renderer's own limits did not catch it (they check the same
declared sizes), JSZip inflated all of it, and peak RSS reached about 940 MB before
JSZip threw *"uncompressed data size mismatch"*.

The Word preview has the same shape: the host check reads declared sizes, and
docx-preview inflates through the same JSZip 3.10.1. So a `.docx` that lies about
its sizes **very likely** gets past Sprint 124's check too. This is not yet shown
with a Word fixture. The fix serves both formats: inflate every part in the
extension host with Node's `zlib.inflateRawSync(…, { maxOutputLength })` and a
running total, and refuse before any byte reaches the webview.

## 5. The renderer

The spike measured `@aiden0z/pptx-renderer` 1.3.0, the current release (npm,
modified 2026-09-14). The release plan named 1.2.4 as of 2026-09-13.

| Dependency | Version | Already in the webview? |
|---|---|---|
| `jszip` | `^3.10.1` | yes, 3.10.1 pinned (Sprint 124) — satisfies the range |
| `echarts` | `^6.0.0` (6.1.0 installed) | no — ~615 KiB min of the renderer's weight |
| `mtx-decompressor` | `^1.4.2`, bundled inside the renderer's dist | no |
| `pdfjs-dist` (peer) | `>=5 <7`, **optional** | yes, 5.4.296 (react-pdf); unused with `pdfjs: false` |

Adding it to `office-preview.js` takes that bundle from 1.3 MB to about 2.4 MB
(spike: +1,123 KiB min / +351 KiB gzip). `webview.js` (8.35 MB) is unaffected.

## 6. Licences to carry

ECharts is Apache-2.0 and ships a `NOTICE` file that must travel with it;
`mtx-decompressor` is MPL-2.0 (file-level: carry the notice and a source link). The
extension ships **no third-party notices file today** (`extensions/ritemark/` has
`LICENSE` only), and the Office bundle is minified. A notices file next to the
bundle is part of this sprint.

## 7. Feature flag

`src/features/flags.ts` has no `powerpoint-preview` flag. The release plan
(decision 2026-09-13) asks for a default-on experimental kill switch "while keeping
the registered editor capable of showing a safe disabled fallback": a custom editor
cannot be unregistered at run time, so with the flag off the provider shows a short
message with **Open in PowerPoint** instead of the preview.

## 8. What the machine can do for ground truth

- Microsoft PowerPoint 16.113.1 is installed; AppleScript can re-save a deck and
  export it to PDF (the spike's `ppt-ground-truth.sh`; `open` often never answers
  the Apple Event, so the script polls for the presentation by name).
- `python-pptx` 1.0.2 is installed and wrote the spike's fixtures. Node has no
  maintained PPTX writer, so the corpus generator stays Python: a research script,
  not a runtime or build dependency.
- `pdftoppm` turns the PDFs into PNG pages; Sprint 124's `compare.py` compares them.

## 9. Not known yet

- The real webview. The spike ran headless Chromium under the Word preview's CSP;
  links (`<a target="_blank">`, `window.open`) and the Tailwind preflight leak
  (spike defect 9) must be checked in a dev build.
- A real deck. Everything so far is synthetic.
- SmartArt, equations, embedded fonts, audio and video, hidden slides and 4:3 decks:
  python-pptx cannot write most of them.

## Conclusions for the plan

1. The Office bundle, the provider pattern, the toolbar, search, zoom and font
   aliases all exist; PowerPoint is mostly a new branch through them.
2. The renderer is chosen on evidence (spike): 1.3.0, pinned, with a chart pre-pass
   for its two misleading defects.
3. The host pre-check needs a bounded inflate — for PowerPoint, and very likely for
   Word as well.
4. Windows needs a real PowerPoint check before the button names PowerPoint.
5. A notices file must ship with the bundle.
6. Staying inside `office-preview.js` keeps the sprint off every shell-tier path.
