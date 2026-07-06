# v1.8.1 Test Checklist

**Release:** Ritemark v1.8.1 — Export Integrity (SVG/draw.io in PDF & Word) + Model Gateway (live-resolving AI models)
**Date:** 2026-07-06 (arm64 build)
**Scope:**
- **Sprint 90** (export integrity — fail-safe image export, SVG/draw.io rasterized rendering in PDF/Word, atomic `saveAsMarkdown`, `/image` picker SVG fix; #127, #76; PR #128)
- **Sprint 89** (model gateway — live-resolving model catalog waterfall, new `claude-sonnet-5` default, zombie model-ID constants deleted; #109 partial; PR #129)

> Before opening the new DMG: **quit any running Ritemark.app** (Cmd+Q). Two instances share the user-data dir and cause a blank webview / SW `InvalidStateError`.

---

## macOS Apple Silicon (darwin-arm64) — GATE 1

**DMG:** `dist/Ritemark-1.8.1-darwin-arm64.dmg` (signed Developer ID, **un-notarized** — right-click → **Open** to bypass Gatekeeper, or `xattr -dr com.apple.quarantine '/Applications/Ritemark.app'`)
**SHA256:** `5e44143c7884990db699f22f74afdd0497165a114e675bdb4a655ff66cdedb9c`

### Installation

- [ ] DMG mounts; app copies to `/Applications` cleanly
- [ ] Right-click → **Open** launches it (un-notarized warning is expected)
- [ ] About dialog shows version **`1.8.1`** (VS Code base `1.117.0` is expected in Info.plist — not a bug)
- [ ] App icon renders correctly in Dock and Finder
- [ ] Markdown file opens in the Ritemark editor; typing + autosave work

### Export integrity (Sprint 90) — headline

- [ ] **S1–S2** — a markdown doc referencing a file `.svg` image exports to PDF **and** Word without crashing
- [ ] **S3** — a corrupt/unreadable image in the doc is skipped (warned), rest of the export completes
- [ ] **S4** — a GIF/BMP/TIFF data-URL image no longer crashes PDF export (skips gracefully)
- [ ] **S5** — baseline PNG/JPEG export still works, unchanged (regression check)
- [ ] **S6–S8** — `saveAsMarkdown` (convert imported doc to markdown) leaves no orphaned image files if interrupted mid-write or on `.md`-write failure; pre-existing `images/` files are untouched
- [ ] **S9** — a normal successful `saveAsMarkdown` is byte-identical to pre-1.8.1 output
- [ ] **S10** — an inline SVG (pasted/generated `data:image/svg+xml`) renders as a real image in exported PDF and Word
- [ ] **S11** — a `.drawio.svg` diagram created via `/diagram` renders in exported PDF and Word (this is the v1.8.0 draw.io diagrams finally showing up)
- [ ] **S12** — a malformed/unparseable SVG degrades to a skip, not a crash — export still completes
- [ ] Inserting an SVG via the `/image` picker works (previously rejected with "Invalid image data URL")

### Model Gateway (Sprint 89) — headline

- [ ] **S13** — with a real Anthropic API key configured, the AI sidebar's model picker resolves `claude-sonnet-5` as the out-of-box default (live provider probe, not just the bundled fallback)
- [ ] Model list in the AI sidebar, Flow LLM node picker, and BYOK picker are all populated and consistent (all three now draw from the same catalog)
- [ ] With no API key configured, the app still starts and shows a sensible bundled/cached model list (no crash, no blank picker) — offline/no-network cold start
- [ ] A Flow using an LLM node still runs successfully end-to-end

### Regression sweep

- [ ] AI sidebar chat works (Claude Code)
- [ ] Settings page loads and saves an API key
- [ ] Flows panel opens; an existing flow runs
- [ ] Integrated browser opens a page
- [ ] PDF/DOCX preview opens
- [ ] draw.io `/diagram` creation + edit + autosave still works (Sprint 82 regression check, since export now touches the same files)

---

## macOS Intel (darwin-x64) + Windows — GATE 2

**DMG:** `dist/Ritemark-1.8.1-darwin-x64.dmg` (signed, un-notarized) — built via CI, not yet triggered
**Windows:** `Ritemark-1.8.1-win32-x64-setup.exe` (CI artifact) — built via CI, not yet triggered

- [ ] x64: installs + launches; markdown editing works
- [ ] x64: export a doc with an SVG/draw.io diagram to PDF/Word — renders correctly
- [ ] x64: AI sidebar resolves a model list without crashing
- [ ] Windows: installer runs; app launches; same export + model-list smoke test
- [ ] Windows: agent runtimes start (bundled binaries unpack correctly)
