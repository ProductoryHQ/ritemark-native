# Save as PDF: the print path (Sprint 170 PR 0, #884)

19 November 2026, on main 12b3bfb8 (VS Code at the pin, Electron 43.8.63).

## Answer

Print with Electron's own `webContents.printToPDF` in a hidden `BrowserWindow`, run in the main process behind a small new command that a VS Code patch adds. That is **shell-tier** (a patch, so a full app release), and it adds **no dependency**. The extension host builds the HTML (the page builder's output, or the wall's slide markup) as it does now, writes it to a temporary folder beside its pictures and fonts, calls the command with the file and the paper, and gets the PDF bytes back to write where the save dialog says.

No extension-tier path prints silently and faithfully; the one that looked like it would (CDP through the browser API) fails, see B below.

## The candidates

| Candidate | Tier | New dependency | Verdict |
| --- | --- | --- | --- |
| A. Electron `webContents.printToPDF`, hidden window, main process | Shell (patch) | None | **Recommended.** Proven below. |
| B. CDP `Page.printToPDF` through the proposed `browser` API (`vscode.window.openBrowserTab(...).startCDPSession()`) | Extension (a built-in extension may declare `enabledApiProposals: ["browser"]` in `package.json`) | None | **Doesn't work.** Electron 43 answers "'Page.printToPDF' wasn't found": headful Chromium doesn't implement CDP printing. It would also open a visible browser tab. |
| C. VS Code's own print or export | — | — | **None exists.** VS Code has no print-to-PDF path in the workbench or the main process (no `printToPDF` anywhere in `vscode/src`). |
| D. A webview's `window.print()` | Extension | None | **Not silent.** Opens the system print dialog; the user picks "Save as PDF" there, the file name and folder aren't ours, and kind 1's 16:9 paper depends on the dialog. Fine as a fallback, not as the design. |
| E. Spawn the app's own Electron binary with a print script | Extension | None | **Unproven, likely blocked.** A packaged app runs its bundled `app` and ignores an app path on the command line, and `ELECTRON_RUN_AS_NODE` gives Node without `BrowserWindow`. Not worth a second app instance. |
| F. Bundle headless Chromium (Puppeteer's chrome-headless-shell) | Extension-tier code, but a shell release in practice (a `node_modules` external) | ~100 MB+ per platform, signing and notarizing a second browser | **Too big.** Same Chromium we already ship. |
| G. pdfkit (today's Export as PDF) | Extension | None | Can't render HTML or CSS, so neither the page nor a slide. |

## The proof

`research/print-proof/` holds a throwaway Electron app (`main.js`, `page.html`, `package.json`). Run it with VS Code's Electron binary: `vscode/.build/electron/Ritemark.app/Contents/MacOS/Ritemark --user-data-dir=<short tmp> <print-proof folder> <out folder>`. The page has two 1280×720 slides, a `@font-face` font (Source Serif 4 woff2 from the extension), a PNG picture, a link, a gradient background, a `@page { size: 1280px 720px; margin: 0 }` rule and a `.noprint` element hidden in `@media print`.

What A produced (`pdfinfo`, `pdffonts`, `pdfimages`, `pdftotext`, and the page drawn back to PNG):

- **Pages:** 2, each 960 × 540 pt, exactly 16:9 from the CSS `@page` size (`preferCSSPageSize: true`). One `break-after: page` per slide gives one page per slide.
- **Fonts:** Source Serif 4 embedded and subset (as Type 3, which is how Skia writes a variable font; text stays selectable and searchable: `pdftotext` reads it back).
- **Picture:** embedded, with its alpha mask.
- **Link:** a live `/URI (https://ritemark.app/)` annotation.
- **Print rules honoured:** the `@media print` element is gone; backgrounds print with `printBackground: true` and `print-color-adjust: exact`.
- **Offline:** everything loads from `file://`; nothing is fetched.

So A is as faithful as Chromium's print preview: whatever the published page prints in a browser, this prints the same, since it is the same engine and the same `PRINT_CSS`.

## What the patch looks like (for PR 1, not built here)

- One main-process command, for example `_ritemark.printHtmlToPdf(fileUri, { pageSize?, landscape? }) → Uint8Array`, registered next to patch 010's browser bridge, in a new patch or an extension of 010.
- It opens a `BrowserWindow({ show: false })` with `javascript: true`, sandboxed, no node integration, its own in-memory session whose `webRequest` cancels everything that isn't `file://` under the temporary folder (offline, and no stray fetches from deck content), waits for `document.fonts.ready` and every `img` to decode, calls `printToPDF({ preferCSSPageSize: true, printBackground: true })`, closes the window and returns the bytes.
- The paper comes from the HTML: kind 1 sets `@page { size: 1280px 720px; margin: 0 }` around the wall's slide markup; kinds 2 and 3 are the page builder's output with its existing `PRINT_CSS` (A4 portrait, 14mm 15mm), so the page's print and the PDF can't drift.
- The extension side stays extension-tier code: building the HTML, the save dialog, writing the file, the deck bar's note. Only the command is shell-tier, so Save as PDF reaches users with the next shell release.

## Not tested here

- Windows (same Electron API; expected to behave the same).
- A full deck through the real page builder; this proof is one synthetic page.
- Very long decks (memory and time of one `printToPDF` call).
