# Release Plan — v1.8.1 Export Integrity + Model Gateway

**Status:** Release candidate
**Target:** v1.8.1
**GitHub milestone:** `v1.8.1` — created 2026-07-06
**Release type:** Full app release (patch)
**Release owner:** Jarmo
**Created:** 2026-07-06

## Release Thesis

A patch release folding in two independently-scoped sprints that both reached "merged to main" around the same time: Sprint 90 makes document export fail-safe and finally renders SVG/draw.io diagrams in exported PDF/Word, and Sprint 89 replaces static, ship-cadence AI model-ID constants with a live-resolving model catalog so new models can appear without a Ritemark release.

## User-Facing Headlines

1. **SVG and draw.io diagrams render in PDF/Word exports** — v1.8.0's draw.io diagrams finally show up in exported documents; one bad image can no longer crash an entire export.
2. **AI models update without waiting for a release** — model lists and defaults resolve from a live provider probe + published catalog, with a new out-of-box Claude default (`claude-sonnet-5`).

## Scope Envelope

### In scope

- Sprint 90 (export-integrity): fail-safe per-image export guard, SVG/draw.io rasterization to PNG for PDF/Word export, atomic `saveAsMarkdown`, `/image` picker SVG fix. Closes #127, #76.
- Sprint 89 (model-gateway): `src/ai/modelCatalog/` waterfall resolver (live probe → remote catalog → cache → bundled), zombie model-ID constant deletion, `claude-sonnet-5` default, `remote-model-catalog` feature flag. Partially advances #109 (model-resolution unification; retry/telemetry unification remains open).

### Out of scope / explicitly deferred

- Vector-preserving SVG-in-PDF (rasterization only, this release).
- Draw.io editing polish (#124 — create-without-slash, link-existing, rename-with-references).
- Retry/telemetry unification across agent runtimes and flow nodes (remainder of #109).
- `UnifiedViewProvider.ts` LOC reduction to ≤1100 target (currently 1223, carried-forward debt).

## Feature-Complete Definition

- [x] Sprint 90 merged to `main` (PR #128, commit c68f8c7).
- [x] Sprint 89 merged to `main` (PR #129, commit 054f2a0).
- [x] `docs/releases/v1.8.1/release-notes.md` + `changelog.md` drafted, covering both sprints.
- [x] Version bumped to `1.8.1` in `branding/product.json` + `extensions/ritemark/package.json`.
- [ ] Gate 1 (macOS arm64 build, sign, DMG) — un-notarized, Jarmo local test.
- [ ] Gate 2 (macOS x64 + Windows) — un-notarized, Jarmo local test.
- [ ] Notarization (arm64 + x64) — only after respective gate + 60-min hardening.
- [ ] GitHub Release published to `jarmo-productory/ritemark-public` + canonical update feed regenerated.
- [ ] `qa-validator` sign-off recorded.

## Sprint Map

| Sprint | Purpose | Issues | PR | Status |
|---|---|---|---|---|
| sprint-90-export-integrity | Fail-safe export + SVG/draw.io rendering + atomic saveAsMarkdown | #127, #76 | #128 | Merged (c68f8c7) |
| sprint-89-model-gateway | Live model-resolution waterfall + published catalog | #109 (partial) | #129 | Merged (054f2a0) |
