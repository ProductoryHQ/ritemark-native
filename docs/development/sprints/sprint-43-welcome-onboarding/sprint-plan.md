# Sprint 43: Welcome Onboarding

## Goal

Turn Ritemark's startup Welcome page into a true onboarding home for non-technical users while preserving fast access to `Recent files` for returning users.

## Feature Flag Check

- [x] Does this sprint need a feature flag? NO.
  This replaces the default startup Welcome experience for all users.

## Success Criteria

- [x] First-time users can understand what Ritemark is for without needing to know what VS Code is
- [x] The startup Welcome page presents 2 clear primary actions: `New document` and `Open folder`
- [x] `Recent files` remains visible and useful on the Welcome page for returning users
- [x] Launch check shows setup/auth state from the same settings-backed extension layer
- [x] `New document` opens a file in the Ritemark editor, not VS Code plain text
- [x] Welcome is shown only in empty windows
- [x] The Welcome implementation has a single maintained source of truth in the VS Code core patch path
- [ ] Dev build and production build both show the same Welcome layout

## Deliverables

| Deliverable | Description | Status |
| --- | --- | --- |
| Welcome home | Branded hero, recent files, and launch check implemented in VS Code Welcome | Done |
| Hero section | Product logo, final product line, split `New document` action, `Open folder` | Done |
| Recent files column | Left column, standard VS Code recently opened list | Done |
| Launch check column | Right column, compact auth/environment summary | Done |
| External learn links | Support and blog links with Welcome-specific tracking | Done |
| Create actions | `New document`, `New table`, `New flow` wired to real behavior | Done |
| Patch sync | `001-ritemark-branding.patch` aligned with final Welcome implementation | Done |
| Prod parity validation | Confirm dev and prod builds match | Pending |

## Implementation Checklist

### Phase 1: UX/UI lock

- [x] Welcome stays Ritemark-first, not VS Code-first
- [x] One Welcome home, no first-run vs returning-user split
- [x] Hero actions finalized as `New document` and `Open folder`
- [x] Recent work remains visible on the home screen
- [x] Launch check defined as a compact right-side status area

### Phase 2: Implementation

- [x] Route empty-window startup to the Welcome home
- [x] Prevent first-run auto-jump into walkthrough detail
- [x] Rebuild the Welcome home around hero + recent + launch check
- [x] Keep recently-opened list functional
- [x] Add extension-backed launch check rendering
- [x] Add `ritemark.newDocument`
- [x] Add `ritemark.newTable`
- [x] Add `ritemark.flows.new` folder-first behavior
- [x] Ensure `New document` and `New table` create real draft files under `~/Documents/Ritemark`
- [x] Ensure CSV drafts open with a real 10x20 starter table
- [x] Add final hero art, logo asset, and product-styled split-button
- [x] Replace old learn/footer idea with final support/blog links
- [x] Add Welcome UTM tags to outbound links
- [x] Remove the old Quick Pick based create-menu path

### Phase 3: Cleanup

- [x] Update sprint docs to match the final Welcome behavior
- [x] Regenerate `001-ritemark-branding.patch`
- [x] Verify patch applies cleanly on a fresh VS Code state

### Phase 4: Validation

- [x] Dev smoke test: empty window Welcome
- [x] Dev smoke test: recent work rendering
- [x] Dev smoke test: `New document`
- [x] Dev smoke test: `New table`
- [x] Dev smoke test: `New flow`
- [x] Dev smoke test: launch check/auth states
- [x] Dev smoke test: hero links
- [ ] Prod parity check during `1.5.0` testing
- [ ] Run repository QA validation during release readiness

## Follow-up To-Do

- [ ] Claude Code authentication is currently not user-friendly enough. Research alternative authentication UX and integration approaches in a separate sprint.
- [ ] Codex Flow node does not exist yet. Keep Codex-related UI/copy free of Flow node references until that capability ships.

## Key Files

| File | Purpose |
| --- | --- |
| `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts` | Main Welcome layout, split-button, launch check, hero links |
| `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStartedGuide.css` | Ritemark-specific Welcome styling |
| `vscode/product.json` | `openToWelcomeMainPage` first-run routing |
| `extensions/ritemark/src/extension.ts` | Create commands, draft-file creation, and launch-check bridge |
| `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts` | Auth/environment status source |
| `extensions/ritemark/src/ritemarkEditor.ts` | CSV starter initialization fallback in the custom editor |
| `extensions/ritemark/src/flows/FlowStorage.ts` | Starter flow scaffold |
| `patches/vscode/001-ritemark-branding.patch` | Maintained branding and Welcome patch |

## Status

**Current Phase:** Cleanup  
**Validation Plan:** Deferred to `1.5.0` production testing and release readiness
