# Sprint 82: Draw.io Diagram Embedding

Track: SDD (auto-detected: 5 user-facing requirements + multi-component flow: webview ↔ bridge ↔ extension host ↔ filesystem + vendored binary bundle)
Branch: `sprint-82-drawio-diagrams` (create after approval)
Status: Phase 2 — awaiting Jarmo approval

---

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (source of truth)
- [scenarios.md](scenarios.md) — BDD examples (manual QA matrix)
- [technical-plan.md](technical-plan.md) — architecture, workstreams, message shapes
- [tasks.md](tasks.md) — implementation checklist
- [sprint-plan.md](sprint-plan.md) — this file (intent + status + decisions)

---

## Goal

Users can insert and edit draw.io diagrams embedded in markdown files, with diagrams stored as `.drawio.svg` files in the `images/` folder beside the `.md` (existing image attachment pattern), rendered inline in the Ritemark preview, and editable via a native `DrawioEditorProvider` backed by the Apache 2.0 draw.io JS library.

## Linked Issues

- [#111] feat: embed draw.io diagrams in markdown files

---

## MVP Scope

Five requirements (full detail in `spec.md`):

| Req | What |
|---|---|
| R1 | `DrawioEditorProvider` — open `.drawio.svg` in draw.io editing panel inside Ritemark |
| R2 | draw.io bundle vendoring — pinned Apache 2.0 artifact, offline-first, reproducible |
| R3 | webview ↔ host message protocol — `drawio:load`, `drawio:ready`, `drawio:save` |
| R4 | TipTap click-to-edit — `.drawio.svg` renders inline; clicking opens the editor |
| R5 | "Insert Diagram" slash command — creates new `.drawio.svg` and inserts `![]()` reference |

Out of scope this sprint: `.drawio` (raw XML) and `.drawio.png` formats; export to PNG/PDF; inline base64; AI-driven diagram generation.

---

## Feature Flag Check

This sprint introduces a new user-visible feature backed by a ~10 MB vendored binary bundle. A feature flag is required as a kill-switch.

- Flag ID: `drawio-diagrams`
- Default: ON (HARD RULE #2 — features are ON by default)
- Status: `stable` — kill-switch only, not surfaced in Settings (Jarmo decision, 2026-06-10, Q3)
- Platforms: darwin, win32, linux
- The `DrawioEditorProvider` is only registered when `isEnabled('drawio-diagrams')` is true.

---

## Success Criteria

- [ ] Opening a `.drawio.svg` file shows the draw.io editor with the diagram loaded (R1)
- [ ] Saving in the draw.io editor writes the updated file to disk (R1, R3)
- [ ] The draw.io bundle loads entirely from local `media/drawio/` — no external network requests (R2)
- [ ] `scripts/vendor-drawio.sh` lets a fresh-checkout developer re-vendor the bundle (R2)
- [ ] `.drawio.svg` images render inline in TipTap markdown preview (R4)
- [ ] Clicking a draw.io diagram in the preview opens its editor (R4)
- [ ] `/diagram` slash command creates a new `.drawio.svg` file and inserts the image reference (R5)
- [ ] The draw.io bundle does NOT enter `media/webview.js` (GH#107 constraint)
- [ ] TypeScript compiles cleanly; pre-commit hook passes; `qa-validator` signs off

---

## Pre-Implementation Gate (Phase 0 Audit)

Phase 3 implementation is BLOCKED until `research/drawio-bundle-audit.md` is complete and answers:
1. Does the draw.io single-file release artifact work in a VS Code webview iframe under the CSP constraints?
2. Does the `proto=json` embed API support `load` / `export` / `save` message round-trips as needed by R3?

If the audit finds blockers, implementation scope is adjusted before any code is written.

---

## Product Decisions

- **2026-06-10:** File format = `.drawio.svg` only (not `.drawio` or `.drawio.png`). Rationale: self-contained SVG renders anywhere; same pattern as image attachments; most portable. Source: Jarmo comment on GH#111.
- **2026-06-10:** Library = draw.io Apache 2.0 (jgraph/drawio), NOT hediet/vscode-drawio (GPL-3.0). Rationale: license incompatibility with commercial distribution. Source: Jarmo comment on GH#111.
- **2026-06-10:** Clean-room implementation — no GPL-3.0 code copied; hediet extension readable for inspiration only. Source: Jarmo comment on GH#111.
- **2026-06-10:** draw.io bundle kept SEPARATE from `media/webview.js` to avoid worsening GH#107 webview bundle bloat. Source: Jarmo comment on GH#111.

---

## Open Decisions — RESOLVED (Jarmo, 2026-06-10)

| Q | Question | Decision |
|---|---|---|
| Q2 | Gitignore the ~10 MB bundle vs commit it to git? | **Commit to git** — simpler onboarding; `vendor-drawio.sh` used only for version updates |
| Q3 | Feature flag status: `experimental` vs `stable`? | **`stable`** — kill-switch only, not surfaced in Settings |

---

## Effort Estimate

| Workstream | Estimate |
|---|---|
| W0 Audit (draw.io bundle + embed API verification) | 0.5 day |
| W1 `DrawioEditorProvider` (host-side load/save) | 1.5 days |
| W2 Bundle vendoring + vendor script | 0.5 day |
| W3 `ritemarkEditor.ts` handlers (2 message types) | 0.5 day |
| W4 TipTap webview (ResizableImage + blockItems) | 1 day |
| W5 Feature flag + architecture doc | 0.5 day |
| Integration testing (16 scenarios) | 1 day |
| **Total** | **~5.5 days** |

---

## Approval

- [ ] Jarmo approved this sprint plan
