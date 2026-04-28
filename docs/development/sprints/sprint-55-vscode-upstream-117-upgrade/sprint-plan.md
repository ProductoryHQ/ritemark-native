# Sprint 55: VS Code OSS Upgrade 1.109.5 -> 1.117.0

## ZERO REGRESSION MANDATE

**This is non-negotiable.** Every Sprint 54 (v1.6.0 Agent Library) feature must work identically after the upgrade:

- Agent Library activity bar entry
- 6px vertical spacing between activity bar icons
- Properties side panel
- All other v1.6.0 features

Phase 4 contains an explicit Sprint 54 regression checklist. This gate cannot be skipped.

---

## Context

Ritemark's VS Code OSS base has been on `1.109.5` since Sprint 41. Sprint 57 attempted this upgrade but was started before Sprint 54 (Agent Library, v1.6.0) was merged, so its rebased patches are incomplete — they are missing Sprint 54's chrome contributions.

Sprint 55 starts fresh. The source of truth for patches is `main`'s current 6-patch stack.

**Submodule SHA bump:** `0725862` (1.109.5) -> `10c8e55` (1.117.0)

---

## Goal

Upgrade the VS Code OSS submodule from 1.109.5 to 1.117.0 with all 6 Ritemark patches cleanly rebased on top, zero regressions from Sprint 54, and a production build ready for Jarmo to test.

---

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - No. This is a dependency upgrade and patch rebase. No new user-facing feature is being shipped. All existing features remain on by default.

---

## Source of Truth Strategy

- **Patches:** main's current 6 patches are the source of truth. They include all Sprint 54 work.
- **Sprint 57's rebased patches:** reference only — useful as a hint for which hunks needed line-number adjustments in 1.117.0, but never copied as-is into this sprint's patches.
- **Submodule:** bump to `10c8e55` (1.117.0 tag).

Sprint 57 worktree location (read-only reference): `/Users/jarmotuisk/Projects/ritemark-native-sprint-57-vscode-upstream-value-audit/`

---

## Success Criteria

- [ ] `vscode/` submodule points to `10c8e55` (1.117.0)
- [ ] `./scripts/apply-patches.sh --dry-run` shows all 6 patches "Already applied"
- [ ] All 6 patches validate via reverse/apply round-trip
- [ ] `./scripts/validate-qa.sh` passes
- [ ] Dev mode launches cleanly (no startup errors)
- [ ] All Sprint 54 regression checks pass (explicit checklist in Phase 4)
- [ ] All CLAUDE.md layout invariants confirmed
- [ ] Production build completes and Jarmo tests and approves the DMG

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Rebased patch 001 | Branding patch updated for 1.117.0 file positions |
| Rebased patch 002 | UI layout patch updated for 1.117.0 workbench chrome changes |
| Rebased patch 003 | Menu cleanup patch updated for 1.117.0 agent/chat surface changes |
| Patch 004 | Build system patch (expected to apply cleanly per sprint-57 research) |
| Rebased patch 005 | Windows/OSS fixes patch updated for 1.117.0 |
| Rebased patch 006 | Dev launch fallback patch updated for 1.117.0 |
| Submodule bump | `vscode/` `.gitmodules` pointer updated to 1.117.0 SHA |
| Prod build + DMG | arm64 build, signed, DMG, notarized — handed to Jarmo for Gate 2 |

---

## Implementation Checklist

### Phase 1: Setup (research complete — done as part of plan creation)

- [x] Create `docs/development/sprints/sprint-55-vscode-upstream-117-upgrade/` directory
- [x] Copy 4 research docs verbatim from sprint-57 worktree:
  - [x] `research/upstream-value-audit.md`
  - [x] `research/patch-risk-matrix.md`
  - [x] `research/full-brand-checklist.md`
  - [x] `research/agent-harness-architecture-audit.md`
- [x] Write `sprint-plan.md`

### Phase 3: Patch Rebase (Jarmo approved — COMPLETE)

Repair order (per patch-risk-matrix research — smallest risk first):

- [x] Confirm branch is `feat/sprint-55-vscode-117` and `main`'s 6 patches are present
- [x] Run `./scripts/apply-patches.sh --dry-run` on current base (1.109.5) — was 6/6 clean
- [x] Bump `vscode/` submodule pointer to `10c8e55` (1.117.0) (committed in `9487dc9`)
- [x] Run `./scripts/apply-patches.sh --dry-run` on new base — classified failures (only 002 conflicted)
- [x] Rebase `005-ritemark-windows-and-oss-fixes.patch` (low risk) — committed in `bf218f3`
  - [x] Validated via reverse/apply round-trip
- [x] Rebase `006-ritemark-dev-launch-fallback.patch` (low risk) — committed in `bf218f3`
  - [x] Validated via reverse/apply round-trip
- [x] Rebase `004-ritemark-build-system.patch` (applied cleanly, no rebase needed)
  - [x] Validated via reverse/apply round-trip
- [x] Rebase `001-ritemark-branding.patch` (medium risk) — committed in `bf218f3`
  - [x] Validated via reverse/apply round-trip
- [x] Rebase `003-ritemark-menu-cleanup.patch` (high risk) — committed in `bf218f3`
  - [x] Validated via reverse/apply round-trip
- [x] Rebase `002-ritemark-ui-layout.patch` (high risk) — committed in `9487dc9`
  - [x] Validated via reverse/apply round-trip (forward + reverse + status clean)
  - [x] Sprint 54 chrome invariants verified: ACTION_HEIGHT=40, ACTIVITYBAR_WIDTH=40, ICON_SIZE=16, compositeSize=40, 28px action labels, 6px margin-bottom + last-child reset, active-item-indicator pill rule
  - [x] Approach: 6 of 8 conflicting files used sprint-57 post-patched copy (no Sprint 54 contributions); 2 high-risk files (`activitybarPart.ts`, `activityaction.css`) manually merged to preserve Sprint 54 chrome on top of upstream's CSS-var migration and compact-mode constants
- [x] Run `./scripts/apply-patches.sh --dry-run` — shows all 6 "Can apply" (clean tree) / 6/6 OK
- [ ] Run `./scripts/validate-qa.sh` — STALE CHECK (see note below); pre-existing on `main`
- [ ] Inspect salvageable scripts from sprint-57 (deferred to Phase 4 / future sprint):
  - [ ] `scripts/apply-patches.sh` enhanced validation
  - [ ] `scripts/build-mac.sh` error handling
  - [ ] `scripts/sync-dev-branding-assets.sh`
  - [ ] Icon theme `weight` change (`"200"` -> `"normal"`)

**Note on `validate-qa.sh`:** The pre-commit-validator hook contains a stale assertion (`webview.js missing document-header component`) that fails on this branch AND on `main`. The `document-header` component was removed in Sprint 54's toolbar redesign (commit `7d08a9f`), but `.claude/hooks/pre-commit-validator.sh` was not updated to reflect the new invariant. This is a pre-existing maintenance issue, NOT a Sprint 55 regression. Recommend updating the hook to assert a current component name (e.g. one of the Sprint 54 toolbar/properties-panel anchors) as a separate change.

Note: do NOT remove unused imports after any VS Code file edit — build fails after 22 min otherwise.

### Phase 4: Validation and Regression Gate

#### Sprint 54 Regression Checklist (ZERO REGRESSION MANDATE)

- [ ] Agent Library activity bar entry is present and renders correctly
- [ ] 6px vertical spacing between activity bar icons is intact
- [ ] Properties side panel opens and functions correctly
- [ ] All other v1.6.0 features confirmed working

#### CLAUDE.md Layout Invariants

- [ ] Ritemark AI panel is in the right sidebar (auxiliary bar), not the primary sidebar
- [ ] Terminal opens in auxiliary bar, not as an editor tab
- [ ] New window: terminal does NOT open as editor tab
- [ ] Window reload: terminal does NOT restore as editor tab
- [ ] AI/chat terminal tools do NOT move terminal into editor area

#### Branding Invariants (from full-brand-checklist.md)

- [ ] B10: app menu bar shows "Ritemark" (not "Code - OSS")
- [ ] B11: window title shows Ritemark identity
- [ ] B22: titlebar SVG icon is branded
- [ ] B23: explorer/activity bar icons render correctly, no broken glyphs
- [ ] B35: workbench text uses Sofia Sans (brand font, not system fallback)
- [ ] B43/B44: Welcome page hero and footer icons render
- [ ] B50/B51: About dialog shows correct branding and Productory copyright

#### Menu Cleanup Invariants

- [ ] View menu is product-appropriate (no generic VS Code dev tools leaked)
- [ ] "View > Advanced" submenu is present and functional
- [ ] Go menu, Run menu, Terminal menu are hidden or appropriately scoped
- [ ] Command palette does not surface noisy upstream experimental agent/browser commands
- [ ] No unwanted Copilot Chat entry points in menus or titlebar

#### Extension Loading

- [ ] `vscode/extensions/ritemark` symlink resolves correctly: `ls -la vscode/extensions/ritemark` shows `-> ../../extensions/ritemark`
- [ ] Ritemark extension activates on `.md` file open
- [ ] Markdown editor (TipTap/webview) loads and is not blank
- [ ] `media/webview.js` is approximately 900KB (not 64KB stub)

#### QA Validation

- [ ] `./scripts/validate-qa.sh` passes all checks
- [ ] Dev mode startup: no console errors related to patches or missing assets
- [ ] Node version: confirm `vscode/.nvmrc` expectation (1.117.0 expects `22.22.1` per sprint-57 research)

### Phase 5: Production Build and DMG

- [ ] Run production build per CLAUDE.md procedure (arm64 Node v20, `arch -arm64` wrapper, `./scripts/build-prod.sh`)
- [ ] Build completes without errors
- [ ] Sign arm64 app
- [ ] Create DMG
- [ ] Notarize DMG via `./scripts/notarize-dmg.sh`
- [ ] Hand DMG to Jarmo for testing (Gate 2)
- [ ] Jarmo confirms: "tested locally" or "approved for release"

---

## Patch Rebase Reference (from sprint-57 research)

Sprint-57 completed a full patch rebase onto 1.117.0. That work is reference-only for this sprint because sprint-57's patches are missing Sprint 54's chrome contributions. Use sprint-57's rebased patches only to understand how upstream file positions shifted — do not copy hunks verbatim without validating they include Sprint 54 changes.

Key findings from sprint-57:

- Patch 004 applied cleanly with no changes needed
- Patch 001: conflicts in gulpfile, codicon.css, two gettingStarted files
- Patch 002: conflicts in activity bar CSS/TS, auxiliary bar actions, panel actions, title bar parts, terminal contribution
- Patch 003: conflicts in editor layout menu, chat participant contribution, debug menu, emmet imports, agent session experiments
- Patch 005: conflicts in `build/lib/electron.ts` and `defaultAccount.ts`; one hunk intentionally dropped (Electron up-to-date shortcut path removed upstream)
- Patch 006: conflicts in `code-cli.sh`, `code.sh`, `node-electron.sh`, `test.sh` — upstream script shape changed

---

## Risk Areas

| Risk | Mitigation |
|------|-----------|
| Sprint 54 chrome changes conflict with upstream 1.117.0 chrome changes | Rebase from main's patches (not sprint-57's); use sprint-57 as line-number reference only |
| Terminal placement regression (Sprint 41 lesson) | Explicit smoke tests: new window, reload window, AI terminal tools |
| Menu cleanup needs updating for new 1.117.0 agent/browser surfaces | Audit all new entry points before hiding/keeping |
| Built-in Copilot in 1.116 may affect OSS build | Inspect whether it appears in OSS; guard against licensing/auth/telemetry surprises |
| `vscode/.nvmrc` now expects Node 22.22.1 | Use correct nvm version for dev-mode validation; prod build still uses Node v20 arm64 |
| Unused imports after patch edits | Always remove unused imports after any VS Code file edit — build fails after 22 min |

---

## Out of Scope (Deferred)

- Product-value enablement sprint: which 1.117 upstream features become explicit Ritemark UX (agent harness, image carousel, browser tooling) — this is a separate future sprint
- Windows build for this release — arm64 DMG is the primary test gate
- 1.118 upgrade — no stable tag observed at sprint start

---

## Status

**Current Phase:** 4 (VALIDATION) — handed off to Jarmo
**Approval Required:** Phase 4 dev-mode + Sprint 54 regression checks; Phase 5 production build/DMG

## Approval

- [x] Jarmo approved this sprint plan
- [x] Jarmo approved Phase 3 patch rebase work ("approved - proceed")

## Phase 3 Handoff Summary

All 6 patches now apply cleanly on VS Code 1.117.0. Two commits on this branch advance Sprint 55:

- `bf218f3` — patches 001, 003, 005, 006 rebased onto 1.117.0 (4 simpler rebases done first)
- `9487dc9` — patch 002 rebased + submodule bump to 1.117.0 (`10c8e55`)

`./scripts/apply-patches.sh --dry-run` reports 6/6 OK on a clean 1.117.0 tree. Round-trip validation passes on every patch. Sprint 54 chrome invariants (Agent Library entry, 6px icon spacing, 28px action labels, active-item-indicator pill, 40px container) are preserved in the rebased patches.

**Jarmo, Phase 4 next:** apply patches, launch dev mode, run the Sprint 54 regression checklist below. Build and DMG (Phase 5) per CLAUDE.md when validation passes.
