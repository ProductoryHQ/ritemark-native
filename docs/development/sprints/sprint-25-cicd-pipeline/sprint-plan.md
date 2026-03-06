# Sprint 25: Cross-Platform CI/CD Pipeline

## Goal

Automated GitHub Actions pipeline that builds, validates, and releases Ritemark Native for Windows (x64) and macOS (arm64). Level 1 maturity: unsigned builds, draft releases, quality gates.

## Feature Flag

No. Infrastructure work, no runtime behavior changes.

## Success Criteria

- [ ] `build-windows.yml` produces a working Windows build with Ritemark icon and clean UI
- [ ] `build-macos.yml` produces a working macOS arm64 DMG
- [ ] `release.yml` creates draft GitHub Release with both platform artifacts + checksums
- [ ] `ci.yml` runs fast PR validation (TypeScript, webview integrity)
- [ ] Update service detects platform and downloads correct artifact (`.dmg` / `.zip`)
- [ ] Jarmo tests both artifacts locally before first real release

## What's Done

- [x] **Phase 0: Windows PoC** (2026-01-28) — `build-windows.yml` exists, builds successfully, app launches and opens .md files. Run #21445463668, artifact ~168MB ZIP.
- [x] **Research** — VSCodium CI analysis, Windows build requirements, cost estimates, Codex review (9 gaps), delivery architecture design. See `research/` folder.
- [x] **Plan** — Original approved by Jarmo 2026-01-25 (as Sprint 24). Rewritten 2026-01-28 after Phase 0 results.

### Known Issues from Phase 0 Testing

| Issue | Root Cause | Fix |
| --- | --- | --- |
| Ritemark icon missing | CI doesn't copy `branding/icons/icon.ico` to `vscode/resources/win32/code.ico` | Add `cp` step before gulp build |
| Sidebar shows Run/Debug, Extensions, Accounts, Manage | CI clones fresh VS Code — submodule-only UI customizations are lost (no patches for them) | Create missing patches (010, 011, update 004) |
| No installer | ZIP only, no Inno Setup | Add `installer/ritemark.iss` + Inno Setup CI step |

See README.md "Phase 0 Results" for detailed research on each fix.

* * *

## Implementation Checklist

### Phase 3: Harden Windows Build

Fix the three issues found during Phase 0 testing:

- [ ] Add branding icon step to `build-windows.yml` (`cp branding/icons/icon.ico vscode/resources/win32/code.ico`)
- [ ] Create `010-hide-accounts-manage-gear.patch` (target: `globalCompositeBar.ts`)
- [ ] Create `011-hide-run-debug-sidebar.patch` (target: `debug.contribution.ts` — `hideIfEmpty: true`, WelcomeView `when: never-show`)
- [ ] Update `004-hide-extensions-view-menu.patch` to include `hideIfEmpty: true`
- [ ] Create `installer/ritemark.iss` (Inno Setup script, .md-focused)
- [ ] Add Inno Setup steps to `build-windows.yml` (`choco install innosetup --version=6.4.3`)
- [ ] Add `on: workflow_call` trigger to `build-windows.yml` (for reuse by `release.yml`)
- [ ] Test: trigger build, download, verify icon + clean sidebar + installer works

### Phase 4: Remaining Workflows

- [ ] Create `build-macos.yml` -   Wraps existing `build-prod.sh` + `create-dmg.sh`      -   Upload DMG artifact      -   Add `on: workflow_call` trigger
- [ ] Create `ci.yml` (PR validation) -   TypeScript compilation check      -   Webview bundle integrity (> 500KB)      -   File icon count (> 10)      -   Runs on Linux (fast, cheap)
- [ ] Create `release.yml` -   Triggered by tag push (`v*`) + manual      -   Calls `build-windows.yml` and `build-macos.yml` via `workflow_call`      -   Version consistency gate: tag matches package.json      -   SHA256 checksums for all artifacts      -   Creates draft GitHub Release with artifacts attached

### Phase 5: Update Service

Make the existing update service work cross-platform:

- [ ] Fix `githubClient.ts` — detect platform, match correct asset pattern (`.dmg` for darwin, `.zip` for win32)
- [ ] Fix `updateService.ts` — platform-aware download, ZIP extraction on Windows, keep DMG for macOS
- [ ] Manual test: verify macOS still works, verify Windows detects `.zip`

### Phase 6: Test, Clean Up, Deploy

- [ ] Test all 4 workflows with manual triggers
- [ ] Jarmo tests Windows installer + macOS DMG locally
- [ ] Create test release tag (e.g. `v0.0.1-test`), verify draft release, delete after
- [ ] Document SmartScreen workaround for unsigned Windows builds
- [ ] Create real release tag when ready

* * *

## Out of Scope

| Item | Rationale |
| --- | --- |
| Linux builds | No user demand |
| Windows ARM | < 5% market share |
| Code signing in CI | Level 2 (future sprint) |
| Auto-publish releases | Risky without smoke tests |
| `scripts/build-windows.ps1` | Nobody builds Windows locally — CI does it |
| `scripts/qa-check.sh` | Inline checks in CI workflow, don't need separate script |
| release-manager agent update | Documentation work, not blocking pipeline |

## Key Decisions

1.  Windows x64 only, macOS arm64 only, no Linux
    
2.  Draft releases only (manual publish)
    
3.  No code signing in CI (Level 1)
    
4.  Node 20 hardcoded in workflows
    
5.  Inno Setup 6.4.3 (last free version) for Windows installer
    
6.  Artifact retention: 30 days
    
7.  Triggers: tag push (`v*`) + `workflow_dispatch`
    

## Risks

| Risk | Mitigation |
| --- | --- |
| Patches fail on Windows | Test patches on fresh VS Code 1.94.0 clone locally first |
| SmartScreen warns users | Document workaround in release notes |
| macOS runner costs (10x multiplier) | Monitor usage, stay under 2000 min/month free tier |
| Update service breaks macOS while adding Windows | Test both platforms before release |

* * *

## Approval

- [x] Jarmo approved original plan (2026-01-25)
- [x] Jarmo approves rewritten plan (2026-01-28, post-Phase 0)