# Patch Risk Matrix: 1.109.5 -> 1.117.0

Date: 2026-04-25

## Summary

Dry-run results on the Sprint 57 worktree:

- Base `1.109.5`: `6/6` patches apply cleanly.
- Target `1.117.0`: `1/6` patches apply cleanly.

Patch outcome on raw `1.117.0`:

| Patch | Result | Risk | Initial classification |
| --- | --- | --- | --- |
| `001-ritemark-branding.patch` | Rebased and validated | Medium | Completed on `1.117.0`, with minor patch whitespace warnings to polish later |
| `002-ritemark-ui-layout.patch` | Rebased and validated | High | Completed on `1.117.0`, with substantial workbench chrome drift handled |
| `003-ritemark-menu-cleanup.patch` | Rebased and validated | High | Completed on `1.117.0`, with menu/chat/agent churn reconciled |
| `004-ritemark-build-system.patch` | Applied cleanly | Low | Stable |
| `005-ritemark-windows-and-oss-fixes.patch` | Rebased and validated | Low | Completed on `1.117.0` |
| `006-ritemark-dev-launch-fallback.patch` | Rebased and validated | Low | Completed on `1.117.0` |

## Patch Notes

### 001 - Branding

Conflicts observed in:

- `build/gulpfile.vscode.ts`
- `src/vs/base/browser/ui/codicons/codicon/codicon.css`
- `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts`
- `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts`

Interpretation:

- Welcome/onboarding changed significantly upstream.
- Branding asset packaging changed enough that the patch no longer lands mechanically.
- Codicon/font customization still likely needed, but CSS context has shifted.

Architectural meaning:

- This is still Ritemark-owned product surface.
- Rebase work is required, but the feature intent remains valid.

Progress update:

- Fully rebased locally on `1.117.0`.
- Validated by reverse/apply round-trip against the patched submodule.
- Includes:
  - font asset packaging
  - `woff2` bundling
  - Phosphor icon font registration
  - splash/default theme behavior
  - About dialog branding/version handling
  - workbench UI font wiring
  - breadcrumb sizing/styling
  - startup welcome default
  - custom Welcome page implementation and guide styling
- Patch still emits two `git apply` whitespace warnings for blank EOF lines; this is hygiene work, not a functional blocker.

### 002 - UI Layout

Conflicts observed in:

- activity bar CSS and TS
- auxiliary bar actions
- panel actions
- title bar parts
- terminal contribution wiring

Interpretation:

- Upstream workbench chrome evolved substantially.
- Some conflicts likely reflect VS Code's newer agent/titlebar/browser/terminal surfaces.

Architectural meaning:

- High-risk patch because it touches Ritemark's strongest UX invariants:
  - right-side AI/sidebar behavior
  - terminal placement
  - custom activity bar/title bar layout

Progress update:

- Rebased locally on `1.117.0`.
- Validated by reverse/apply round-trip against the patched submodule.
- Required one additional upstream integration point during validation:
  - `src/vs/platform/actions/common/actions.ts` now defines `MenuId.MenubarViewMenuAdvanced` for the new Ritemark `View > Advanced` submenu.
- Validation passed after the rebase with `./scripts/validate-qa.sh`.

### 003 - Menu Cleanup

Conflicts observed in:

- editor layout menu wiring
- chat participant contribution
- debug menu contribution
- emmet action/menu imports
- agent session experiments contribution

Interpretation:

- Menus are no longer just classic IDE menus; agent/chat surfaces now participate deeply.
- Cleanup decisions may need to be revisited, not blindly rebased.

Architectural meaning:

- High-risk product patch.
- This is where Ritemark could accidentally expose too much generic VS Code or hide useful new agent functionality.

Progress update:

- Rebased locally on `1.117.0`.
- Validated by reverse/apply round-trip against the patched submodule.
- Includes:
  - optional-guard fixes around `defaultChatAgent`
  - removal of generic top-level Go / Run / Terminal surfaces
  - hiding upstream chat status/titlebar entry points
  - disabling chat view registration in favor of Ritemark-owned surfaces
  - removing classic Edit-menu items that conflict with the document-first UI

### 004 - Build System

Result:

- Applies cleanly on `1.117.0` and is now also applied in the validation worktree.

Interpretation:

- Good sign: core build-system customization has stayed structurally compatible.

Architectural meaning:

- Low-risk carry-forward patch.

### 005 - Windows and OSS Fixes

Conflicts observed in:

- `build/lib/electron.ts`
- `src/vs/workbench/services/accounts/browser/defaultAccount.ts`

Interpretation:

- One conflict is build metadata drift.
- One conflict is exactly in the OSS/default-account area that already caused Sprint 41 startup fragility.

Architectural meaning:

- Medium risk technically, but high leverage.
- Needs careful re-verification so we do not reintroduce startup/account assumptions.

Progress update:

- Rebased locally on `1.117.0`.
- Validated by reverse/apply round-trip against the patched submodule.
- One old hunk was intentionally dropped because upstream no longer uses the same Electron up-to-date shortcut path.

### 006 - Dev Launch Fallback

Conflicts observed in:

- `scripts/code-cli.sh`
- `scripts/code.sh`
- `scripts/node-electron.sh`
- `scripts/test.sh`

Interpretation:

- Upstream script wrappers changed shape, but this looks like localized shell-script drift rather than product-surface redesign.

Architectural meaning:

- Medium risk.
- Likely straightforward to rebase once we inspect the new script templates.

Progress update:

- Rebased locally on `1.117.0`.
- Validated by reverse/apply round-trip against the patched submodule.
- Fallback paths were updated to the new `nameShort` executable layout used by upstream scripts.

## Recommended Repair Order

1. `005-ritemark-windows-and-oss-fixes.patch`
2. `006-ritemark-dev-launch-fallback.patch`
3. `001-ritemark-branding.patch`
4. `003-ritemark-menu-cleanup.patch`
5. `002-ritemark-ui-layout.patch`

Reasoning:

- Start with smaller, high-leverage correctness fixes.
- Leave the heaviest chrome/layout patch for last because it depends on what survives in menus/titlebar/terminal integration.

Current status:

1. `005` complete
2. `006` complete
3. `001` complete
4. `003` complete
5. `002` complete

Current stack status:

- `./scripts/apply-patches.sh --dry-run` reports `001` through `006` as already applied on the Sprint 57 `1.117.0` tree.
- `./scripts/validate-qa.sh` passes on the repaired tree.

## Immediate Next Questions

1. Which parts of `002` and `003` should stay as long-term product invariants versus become upstream-configurable behavior?
2. Which `1.117` upstream agent/browser/media capabilities are worth explicitly surfacing in Ritemark after the base upgrade?
3. Should the Node runtime expectation (`22.22.1`) become an explicit documented prerequisite in local upgrade workflow notes?
