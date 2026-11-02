# Bundles (E4)

| Bundle | Before Sprint 148 (`b2ac230e`) | After PR 1 | Notes |
|---|---|---|---|
| `media/webview.js` | 8,749,976 bytes | unchanged | PR 1 changes no webview code. After PR 2 (the results view, the AI sheet's turn reveal): see below. |
| `media/office-preview.js` | 2,620,152 bytes | unchanged | |
| `out/extension.js` | — | 5.9 MB | `SearchHost`, the worker client, the tasks source: a few KB. |
| `out/search/searchWorker.js` | — (new) | 3.6 MB | The worker's own entry: pdf.js's legacy build and parser (~3.4 MB), `ignore`, `marked`, `papaparse`, the index. Loaded only in the worker thread. Its licence notices are a `/*! */` comment esbuild keeps at the end. |

`out/` is built, not committed: the sizes are of `npm run compile` on the PR's head.

**After PR 2:** `media/webview.js` 8,768,410 bytes, 18,434 more than before Sprint 148 (+0.2 %): the results view (`components/search/`, lazy like the other pages) and the AI sheet's turn reveal. `media/office-preview.js` unchanged.

## New dependencies

- `pdfjs-dist` 5.4.296 (Apache-2.0), a **dev** dependency: inlined into the worker's bundle at build time, so nothing loads it from `node_modules`. Its optional native `@napi-rs/canvas` is replaced by an empty stub (`npm-stubs/napi-rs-canvas`, through `overrides`), so no native canvas is installed or shipped. The Mac builds copy `node_modules` whole, dev dependencies included, so pdfjs-dist's 36 MB also lands in the Mac app, unused; Windows prunes dev dependencies. Taking dev dependencies out of the Mac app is a shell-tier change of its own (`build-prod.sh`, `copy-extension-for-target.mjs`), not this PR's.
- `ignore` 7.0.12 (MIT), a dependency, inlined. 7.0.12 is a month old; 7.0.13 and 7.0.14 were under two weeks old when it was added.
