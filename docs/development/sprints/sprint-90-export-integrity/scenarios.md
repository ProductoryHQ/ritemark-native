# Sprint 90 — Scenarios (manual QA matrix)

BDD examples. Each maps to a requirement in `spec.md`. Fixtures live in `./fixtures/` (created during implementation).

## Phase 1 — Fail-safe

**S1 — File-referenced SVG does not crash PDF (R1/R2)**
- Given a `.md` with `![](images/diagram.drawio.svg)` and other text/images
- When I Export → PDF
- Then export completes, the PDF opens, all non-SVG content is present, and no error toast appears

**S2 — File-referenced SVG does not crash Word (R1/R2)**
- Given the same document
- When I Export → Word
- Then export completes and the `.docx` opens with all non-SVG content intact (no broken-image box in Phase 1)

**S3 — Corrupt/unreadable image is skipped, export survives (R2)**
- Given a `.md` referencing a truncated/corrupt `.png` plus valid content
- When I Export → PDF and → Word
- Then the bad image is omitted, everything else renders, export succeeds

**S4 — GIF/BMP/TIFF data-URL no longer crashes PDF (R3)**
- Given a `.md` with an inline `data:image/gif;base64,…`
- When I Export → PDF
- Then export completes with the GIF skipped (no pdfkit decode crash)

**S5 — Baseline raster export unchanged (regression)**
- Given a `.md` with PNG and JPEG images
- When I Export → PDF and → Word
- Then images render exactly as before this sprint

## Phase 1 — saveAsMarkdown atomicity

**S6 — Failure mid-images leaves no orphans (R4)**
- Given a DOCX/PDF import with 5 images, with a synthetic failure injected on the 3rd image write
- When Save as Markdown runs and fails
- Then `<targetDir>/images/` contains none of the newly-created images and no `.md` is left behind

**S7 — Failure on `.md` write cleans up all images (R4)**
- Given all 5 images write successfully but the `.md` write fails
- Then all 5 newly-created images are removed; no `.md` remains

**S8 — Pre-existing files preserved on failure (R4)**
- Given `images/` already contains a user file `photo.png`
- And a save fails mid-way
- Then `photo.png` is still present and untouched

**S9 — Successful save unchanged (regression, R4)**
- Given a normal DOCX with images
- When Save as Markdown succeeds
- Then the `.md` + all images are written exactly as before this sprint

## Phase 2 — Rasterization

**S10 — Inline SVG renders in PDF and Word (R5)**
- Given a `.md` with a `data:image/svg+xml` image
- When I Export → PDF and → Word
- Then the SVG appears as a visible raster image at correct aspect ratio

**S11 — draw.io diagram renders in PDF and Word (R5)**
- Given a `.md` embedding a `.drawio.svg` created via `/diagram`
- When I Export → PDF and → Word
- Then the diagram appears as a visible image in both outputs

**S12 — Rasterization failure degrades to skip, not crash (R5/R2)**
- Given a malformed `.svg` that cannot be rasterized
- When I export
- Then it is skipped gracefully (fall back to R1 behaviour), export still completes

## Intentionally-untested / accepted limitations

- Vector-quality scaling of rasterized SVG at very high zoom (we rasterize at a fixed target DPI).
- Very large SVGs (multi-MB) — perf not tuned this sprint; note if a real report appears.
