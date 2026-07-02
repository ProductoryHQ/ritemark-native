# Sprint 90 — Tasks

## Phase 1 — Fail-safe (held for single release with Phase 2)

### W1 — imageSource.ts guards (R1, R3)
- [x] Add SVG detection to the file-path branch → return `null` (skip) in Phase 1
- [x] Route/guard GIF/BMP/TIFF data-URLs so only PNG/JPEG reach the raster encoders
- [x] Update `imageSource.test.ts`: file-`.svg` → null, gif/bmp/tiff data-URL → null, png/jpeg unchanged (and wired into `npm test` — was orphaned)

### W2 — Per-image try/catch (R2)
- [x] Wrap IMG case body in `pdfHtmlExporter.ts` with try/catch → warn + skip
- [x] Wrap IMG case body in `wordHtmlExporter.ts` with try/catch → warn + skip (`return []`)
- [x] Confirm outer export catch is no longer reached for a single bad image

### W3 — Atomic saveAsMarkdown (R4)
- [x] Capture pre-existing target image paths before the loop
- [x] Track newly-created paths in `createdImagePaths[]`
- [x] try/catch around images-loop + `.md` write → `unlink` created paths on failure, then re-throw
- [x] New `saveAsMarkdown.test.ts`: fail on Nth image, fail on `.md` write, preserve pre-existing files
- [x] Verify successful-save path is byte-identical (S9)

### Phase 1 gate
- [ ] `npm run compile` clean; pre-commit hook green (deferred — worktree has no node_modules; hook runs real compile at commit)
- [ ] Manual QA S1–S9 (dev instance)

## Phase 2 — Rasterization (feature)

### W0 — Phase 0 audit (was BLOCKING) — DONE
- [x] Decide rasterization site: **webview pre-pass** (audit resolved)
- [x] Verify `.drawio.svg` rasterizes — real fixture HAS rendered geometry; no draw.io runtime needed
- [x] CSP `connect-src` needed for fetch → added
- [x] `research/rasterization-audit.md` written

### W4 — Wire rasterization (R5)
- [x] `lib/svgRasterExport.ts::inlineSvgImagesForExport` — inline data-URL SVG + file-referenced `.svg`/`.drawio.svg`
- [x] Extract shared `rasterizeSvgToPngDataUrl` from mermaid path
- [x] Add `connect-src ${cspSource}` to editor CSP (`ritemarkEditor.ts`)
- [x] Wire into both export handlers in `App.tsx`
- [x] `svgRasterExport.test.ts` (inline / file-ref / non-SVG / failure-degrade / no-images) — wired into `npm test`
- [~] ~~`export-svg-rasterization` flag~~ — DROPPED (no webview flag plumbing; graceful degradation is the safety). Deviation noted for Jarmo.

### W5 — Failure degradation (R5/R2)
- [x] Rasterization failure leaves tag untouched → host Phase-1 guard skips (S12)

### Phase 2 gate
- [ ] Manual QA S10–S12 (dev instance — real PDF/Word with inline SVG + draw.io diagram)
- [ ] Update `docs/development/architecture.md` export-subsystem note

## Sprint close
- [ ] `qa-validator` sign-off
- [ ] Jarmo local test pass (S1–S12)
- [ ] Link this sprint on the issues (#127, #76) at merge
