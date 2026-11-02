# A2: pdf.js in the search worker (R2, E4)

Run on 1–2 November 2026 on the Mac (darwin-arm64), on `sprint-148-search-words`. **Answer: pdf.js is inlined** into the worker's own bundle, `out/search/searchWorker.js`; it is not an esbuild external, so an extension release carries it.

## What was tried

`pdfjs-dist` 5.4.296 (Apache-2.0), the webview's version (`webview/package-lock.json`), added to the extension as a dev dependency: it is needed only to build the bundle, never at run time. Its legacy Node build, `legacy/build/pdf.mjs`, and its parser, `legacy/build/pdf.worker.mjs`, both through esbuild into one CJS bundle for `node20`.

| Question | Result |
|---|---|
| Does esbuild inline it into CJS? | Yes, with no warnings. Both modules are loaded with `await import()` of a literal on the first PDF; esbuild turns each into an inlined lazy init, so a project without PDFs never runs pdf.js's start-up code. No top-level `await` in either module. |
| A dynamic path left? | pdf.js's own `import(this.workerSrc)` stays in the bundle but is never reached: `globalThis.pdfjsWorker` is set to the bundled parser before `getDocument`, so pdf.js uses its "fake worker" in this thread. `import.meta.url` becomes `{}` in CJS: pdf.js's `createRequire(import.meta.url)` throws, which it catches, so the canvas package is never looked for. No `__dirname` or `__filename` in the bundle (checked on the built file). |
| A canvas package? | Not needed for text. pdf.js's drawing code builds one `DOMMatrix` when its module loads (`SCALE_MATRIX`), and Node has none, so the reader puts a stub class there first (the constructor only; drawing is never asked for). Without it the module fails to load. Its other warnings (`ImageData`, `Path2D`) are only warnings. |
| `@napi-rs/canvas` (pdf.js's optional, native dependency) | Replaced by an empty stub through `overrides` in `package.json` (`npm-stubs/napi-rs-canvas`), so no native canvas is ever installed. The Mac builds copy the whole `node_modules` into the app, dev dependencies included; without the stub a 25 MB native module would ship and need signing. |
| Does it run in Electron? | Yes. In a worker thread of an Electron utility process (the kind of process VS Code's extension host is), on the main checkout's dev Electron 39.8.7 (Node 22.22.1): pdf.js's `isNodeJS` is true there, since `process.type` is unset in a worker thread, and every fixture read as in plain Node. The shipped 2.2 has Electron 43.8.3 (Node 24); the same check belongs on the 2.2 candidate. |
| Bytes handed to pdf.js | pdf.js transfers them, which detaches their buffer. The reader copies a view that shares its buffer (a pooled `Buffer`) first, so nothing else is detached. |

## The fixtures

Made with the extension's own `pdfkit` (no client material), plus a Word-exported PDF from Sprint 124's corpus. `readers.test.ts` holds each case.

| Fixture | Result |
|---|---|
| Text, a heading, two pages | Read; the heading is its own passage; passages carry their page |
| Estonian letters (`Käsi, õun, sõber, šokolaad ja žürii.`) | Read as written |
| A line's last word and the next line's first | Kept apart: the preview's chunks keep no line ends, so the reader reads `hasEOL` from the same text items |
| 500 pages | 101–124 ms |
| Scanned-style (no text layer) | Found by name (`scanned`, the preview's threshold) |
| Damaged (cut to a third), not a PDF | `InvalidPDFException` in ~1 ms: found by name (`unreadable`) |
| 09-long-document.pdf (Word's export, 29 pages) | 64–80 ms |

## Size

`out/search/searchWorker.js` is 3.6 MB (pdf.js's main module and parser are ~3.4 MB of it), unminified, as the other bundles are. It loads only in the worker, never in the extension host's main thread. Its licence notices are in a `/*! */` comment esbuild keeps (pdf.js's own header uses `@licstart`, which esbuild doesn't keep).
