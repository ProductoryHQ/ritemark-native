# Sprint 90: Export Integrity

Track: SDD (2 issues, 5 requirements, spans host exporters + webview rasterization + filesystem)
Branch: `sprint-90-export-integrity`
Status: Phase 3 — Phase 1 + Phase 2 implemented (2026-07-02). Unit tests green. Awaiting real `tsc`/pre-commit compile + manual QA (S1–S12) on the dev instance.

---

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (source of truth)
- [scenarios.md](scenarios.md) — BDD examples (manual QA matrix S1–S12)
- [technical-plan.md](technical-plan.md) — pipeline, workstreams, rasterization decision
- [tasks.md](tasks.md) — implementation checklist
- [sprint-plan.md](sprint-plan.md) — this file (intent + status + decisions)

---

## Goal

Export never silently drops content and never crashes on a valid document. Embedded SVGs and draw.io diagrams actually appear in exported PDF/Word, and a failed "Save as Markdown" leaves no orphaned files.

## Linked Issues

- [#127](https://github.com/ProductoryHQ/ritemark-native/issues/127) — embedded SVG (incl. draw.io) dropped or breaks PDF/Word export
- [#76](https://github.com/ProductoryHQ/ritemark-native/issues/76) — atomic `saveAsMarkdownHandler` cleanup on failure

---

## Scope

| Req | Phase | What |
|---|---|---|
| R1 | 1 | File-referenced `.svg` skips gracefully instead of crashing PDF export |
| R2 | 1 | Per-image try/catch in both exporters — one bad image never aborts the export |
| R3 | 1 | GIF/BMP/TIFF data-URLs guarded (pass regex today, crash pdfkit) |
| R4 | 1 | `saveAsMarkdown` rolls back newly-created images on failure; preserves pre-existing files |
| R5 | 2 | Rasterize SVG→PNG (webview canvas, no native dep) so diagrams/SVGs render in export |

**Phase 1 (R1–R4)** is low-risk, dependency-free, and independently shippable.
**Phase 2 (R5)** is the feature; gated on a Phase 0 audit (W0).

## Out of scope

- **#124** draw.io create/link/rename UX → separate follow-on (proposed Sprint 91). Only the "diagrams now export" benefit lands here.
- Any new runtime dependency (`sharp`/`resvg`/`canvas`/`puppeteer`).
- Vector-preserving SVG-in-PDF; legacy (non-v2) export paths.

## Feature Flag Check

- Phase 1: no flag (bug-fix hardening of existing export).
- Phase 2: **flag dropped** (deviation from the approved plan). Feature flags are not plumbed to the webview, where the rasterization runs, so a flag would need new plumbing. The pre-pass already degrades gracefully (rasterize failure → host Phase-1 skip, never a crash), which provides the safety a kill-switch would. Flagged for Jarmo — say the word if you want the flag added.

## Success Criteria

- [ ] `.svg`-referencing doc exports to PDF without crashing (R1/R2) — S1/S2
- [ ] Corrupt image skipped, export completes (R2) — S3
- [ ] GIF/BMP/TIFF data-URL no longer crashes PDF (R3) — S4
- [ ] Raster export unchanged from today (regression) — S5/S9
- [ ] Failed `saveAsMarkdown` leaves zero new files, preserves pre-existing (R4) — S6/S7/S8
- [ ] After Phase 2: inline SVG + `.drawio.svg` appear in exported PDF **and** Word (R5) — S10/S11
- [ ] Rasterization failure degrades to skip, never crashes (R5/R2) — S12
- [ ] TS compiles; pre-commit green; `qa-validator` signs off

## Pre-Implementation Gate (Phase 0 Audit — Phase 2 only)

Phase 2 code is BLOCKED until `research/rasterization-audit.md` resolves:
1. Rasterization site — webview pre-pass vs host↔webview round-trip.
2. `.drawio.svg` rasterizes correctly on canvas (no tainted-canvas/CSP block).
3. Target DPI / max dimensions.

Phase 1 has **no** audit gate and may start immediately.

## Product Decisions

- **2026-07-01:** Scope = #127 + #76; #124 deferred to its own sprint. Source: Jarmo approval.
- **2026-07-01:** Rasterize via webview `<canvas>`, no native module — avoids the native-module/notarization/arch landmine. Confirmed direction pending W0 wiring audit. Source: Jarmo approval.
- **2026-07-01:** Phase 1 (fail-safe) is independently shippable ahead of Phase 2.

## Open Decisions — for Jarmo

| Q | Question | Resolution |
|---|---|---|
| Q1 | Ship Phase 1 as its own release, or hold for Phase 2? | **Hold — single release with Phase 2** (Jarmo, 2026-07-02) |
| Q2 | Rasterization site (resolved in W0 audit) | Webview pre-pass preferred — confirming in W0 |

## Approval

- [x] Jarmo approved this sprint plan (2026-07-01)
- [x] Phase 0 audit complete — [research/rasterization-audit.md](research/rasterization-audit.md) (2026-07-02)
