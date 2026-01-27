# Sprint 24: Cross-Platform CI/CD Pipeline

## Goal

Implement automated GitHub Actions workflows to build, validate, and release RiteMark Native for Windows (x64) and macOS (arm64), achieving Level 1 ("Works") maturity with draft releases and quality gates.

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - **NO** - This is infrastructure/DevOps work (CI/CD pipelines)
  - Not a user-facing feature
  - No runtime behavior changes
  - No platform-specific logic (except build outputs)

## Success Criteria

- [x] `.github/workflows/ci.yml` runs fast PR validation (TypeScript, lint) in < 10 min
- [x] `.github/workflows/build-windows.yml` produces working Windows x64 ZIP artifact
- [x] `.github/workflows/build-macos.yml` produces working macOS arm64 DMG artifact
- [x] `.github/workflows/release.yml` creates draft GitHub Release with both artifacts
- [x] Windows build validates webview.js (> 500KB), extension.js (> 1KB)
- [x] macOS build validates same (reuses existing build-prod.sh validation)
- [x] SHA256 checksums generated for all artifacts
- [x] Update service (`githubClient.ts`, `updateService.ts`) detects platform correctly
- [x] Build time < 45 min per platform
- [x] All workflows tested with manual triggers before enabling on tags

## Deliverables

| Deliverable | Description | Location |
|-------------|-------------|----------|
| PR validation workflow | Fast checks (TypeScript, lint) on Linux runner | `.github/workflows/ci.yml` |
| Windows build workflow | Native Windows x64 build with artifact upload | `.github/workflows/build-windows.yml` |
| macOS build workflow | macOS arm64 build with DMG creation | `.github/workflows/build-macos.yml` |
| Release orchestration | Multi-platform release with checksums | `.github/workflows/release.yml` |
| Windows build script | PowerShell script for local Windows builds | `scripts/build-windows.ps1` |
| QA check script | Minimal validation checks for CI | `scripts/qa-check.sh` |
| Update service fixes | Platform-aware asset detection | `extensions/ritemark/src/update/` |
| **release-manager update** | Support CI artifacts + Windows verification | `.claude/agents/release-manager.md` |
| Documentation | CI/CD usage guide | `docs/sprints/sprint-24-cicd-pipeline/notes/ci-usage.md` |

## Implementation Checklist

### Phase 1: Research (COMPLETED)
- [x] Analyze current build scripts and gaps
- [x] Review VSCodium CI architecture
- [x] Document Windows build requirements
- [x] Design 3-level maturity model (Level 0→1→2→3)
- [x] Create decision log for platform support
- [x] Analyze costs and GitHub Actions free tier limits
- [x] Document risks and mitigation strategies

### Phase 2: Plan (COMPLETED)
- [x] Review sprint plan with Jarmo
- [x] Confirm platform decisions (Windows x64 only, macOS arm64 only)
- [x] Confirm Level 1 scope (unsigned builds, draft releases)
- [x] Get approval to proceed to Phase 3
- [x] Add release-manager agent update to scope

### Phase 3: Development - Workflows
- [ ] Create `.github/workflows/ci.yml` (PR validation)
  - Fast TypeScript compilation checks
  - Webview bundle integrity check
  - File icon count validation
  - Git status check (no uncommitted changes)
- [ ] Create `.github/workflows/build-windows.yml`
  - Setup: Node 20, Python 3.11, Git Bash
  - Apply patches
  - Install dependencies (VS Code + RiteMark extension)
  - Backup extension before build (corruption guardrail)
  - Build VS Code with `gulp vscode-win32-x64-min`
  - Verify + restore extension if corrupted
  - Copy RiteMark extension to production app
  - Validate build output (webview.js, extension.js sizes)
  - Create ZIP artifact
  - Upload artifact with 30-day retention
- [ ] Create `.github/workflows/build-macos.yml`
  - Setup: Node 20, macOS runner
  - Run `./scripts/build-prod.sh` (reuse existing)
  - Run `./scripts/create-dmg.sh` (skip signing/notarization)
  - Upload DMG artifact
- [ ] Create `.github/workflows/release.yml`
  - Wait for Windows + macOS builds
  - Download both artifacts
  - Generate SHA256 checksums
  - Create draft GitHub Release
  - Upload artifacts + checksums
  - Auto-generate release notes

### Phase 4: Development - Scripts
- [ ] Create `scripts/build-windows.ps1` (native Windows build script)
  - Pre-flight checks (Node, Python, VS Code dir)
  - Apply patches
  - Install dependencies
  - Build VS Code
  - Copy extension
  - Validate output
  - Create ZIP
  - Generate checksum
- [ ] Create `scripts/qa-check.sh` (minimal CI validation)
  - TypeScript compilation (VS Code)
  - TypeScript compilation (RiteMark extension)
  - Webview bundle size check (> 500KB)
  - File icon count check (> 10)
  - Git status check (no uncommitted changes)

### Phase 5: Development - Update Service Fixes
- [ ] Fix `extensions/ritemark/src/update/githubClient.ts`
  - Detect current platform (darwin, win32, linux)
  - Platform-specific asset pattern (`.dmg` for darwin, `.zip` for win32)
  - Handle multiple architecture suffixes (arm64, x64)
- [ ] Fix `extensions/ritemark/src/update/updateService.ts`
  - Platform-aware download path
  - Handle ZIP extraction on Windows
  - Keep DMG handling for macOS
  - Add error handling for unsupported platforms
- [ ] Test update flow manually (future release will validate)

### Phase 5b: Development - release-manager Agent Update
- [ ] Update `.claude/agents/release-manager.md`
  - Add dual-mode support (CI artifacts vs local builds)
  - Add `gh release download` commands for CI artifacts
  - Add Windows ZIP verification checks
  - Add Windows-specific checklist (no signing, SmartScreen docs)
  - Update Pre-Release Audit to detect artifact source
  - Add SHA256 checksum verification for CI artifacts
  - Document SmartScreen workaround text for release notes

### Phase 6: Testing & Validation
- [ ] Test `ci.yml` with manual trigger on PR branch
- [ ] Test `build-windows.yml` with manual trigger
  - Verify artifact uploaded
  - Download and test locally on Windows
  - Verify .md files open in RiteMark editor
- [ ] Test `build-macos.yml` with manual trigger
  - Verify DMG uploaded
  - Download and test locally on macOS
  - Verify .md files open in RiteMark editor
- [ ] Test `release.yml` with test tag (e.g., `v0.0.1-test`)
  - Verify draft release created
  - Verify both artifacts present
  - Verify checksums correct
  - Delete test release after validation
- [ ] Invoke `qa-validator` agent for final checks

### Phase 7: Cleanup
- [ ] Remove test artifacts and releases
- [ ] Add comments to workflows explaining key steps
- [ ] Update `CLAUDE.md` with CI/CD workflow info
- [ ] Document SmartScreen workaround for unsigned Windows builds
- [ ] Clean up any debug code or temporary files

### Phase 8: Deploy
- [ ] Final commit with all workflows
- [ ] Push to GitHub
- [ ] Verify workflows appear in Actions tab
- [ ] Create real release tag (e.g., `v1.0.4`)
- [ ] Monitor build progress
- [ ] Verify draft release created
- [ ] Test both artifacts locally
- [ ] Jarmo publishes release
- [ ] Invoke `qa-validator` for final production check

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| VS Code missing `win32ContextMenu` fix | Windows build fails | Medium | Check commit history, create patch if needed |
| Extension symlink corruption during build | App can't open .md files | High | Backup/restore pattern, post-build validation |
| Native module compilation failure (Windows) | Build fails | Medium | Use windows-latest (has MSVC), setup Python 3.11 |
| Runner time exceeds free tier | Can't build releases | Low | Optimize caching, monitor usage, upgrade if needed |
| Update service breaks on Windows | Auto-update fails | High | Must fix before release (in scope) |
| Artifact upload fails | Build succeeds but artifact lost | Low | Use latest action version, 30-day retention |
| SmartScreen warnings scare users | Low adoption | High | Document workaround clearly in release notes |

## Out of Scope (Explicit Non-Goals)

These are explicitly NOT included in Sprint 24:

| Item | Rationale | Future Sprint? |
|------|-----------|----------------|
| Linux builds | No user demand yet | Maybe (if requested) |
| Windows ARM builds | Market share < 5% | Maybe (if requested) |
| Intel Mac builds | Rosetta works well | Maybe (if issues reported) |
| Code signing in CI | Complex setup, not MVP | Yes (Level 2, Sprint 25+) |
| Full smoke tests | Requires GUI automation | Yes (Level 2) |
| Auto-publish releases | Risky without smoke tests | Yes (Level 3) |
| Update flow testing in CI | Requires 2+ releases | Yes (Level 3) |
| Matrix builds (multiple architectures) | Not needed for MVP | Yes (Level 2) |
| Self-hosted runners | Within free tier limits | Maybe (if costs too high) |
| Cross-compilation | Proven infeasible | No (never) |

## Technical Notes

### Platform Support Matrix (Level 1)

| Platform | Architecture | Build Method | Artifact | Signed? |
|----------|--------------|--------------|----------|---------|
| macOS | arm64 | GitHub Actions (macos-latest-xlarge) | DMG | No (manual post-build) |
| Windows | x64 | GitHub Actions (windows-latest) | ZIP | No (unsigned) |
| Linux | - | Not supported | - | - |

### Runner Cost Estimate (Per Month)

| Workflow | Runs | Duration | Platform | Multiplier | Total Minutes |
|----------|------|----------|----------|------------|---------------|
| CI (PRs) | 20 | 5 min | Linux | 1× | 100 min |
| Windows builds | 4 | 35 min | Windows | 2× | 280 min |
| macOS builds | 4 | 30 min | macOS | 10× | 1200 min |
| **TOTAL** | | | | | **1580 min** |

**Free Tier Limit:** 2000 min/month (safe margin: 420 min)

### File Changes Summary

```
New files (6):
- .github/workflows/ci.yml (~60 lines)
- .github/workflows/build-windows.yml (~120 lines)
- .github/workflows/build-macos.yml (~50 lines)
- .github/workflows/release.yml (~70 lines)
- scripts/build-windows.ps1 (~150 lines)
- scripts/qa-check.sh (~80 lines)

Modified files (3):
- extensions/ritemark/src/update/githubClient.ts (~30 lines changed)
- extensions/ritemark/src/update/updateService.ts (~50 lines changed)
- CLAUDE.md (~30 lines added for CI/CD section)

Total new code: ~530 lines
Total changes: ~610 lines
```

### Dependencies

**No new npm packages required.**

Uses GitHub Actions and existing tools:
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/setup-python@v5`
- `actions/upload-artifact@v4`
- `actions/download-artifact@v4`
- `softprops/action-gh-release@v1`

### Performance Impact

**Build Times (Projected):**
- PR validation: 5-8 min (Linux, fast checks only)
- Windows build: 30-40 min (native compilation)
- macOS build: 25-35 min (existing script)
- Release orchestration: 1-2 min (download + upload)

**Total Release Pipeline:** ~60-80 min (parallel builds)

## Testing Checklist

### Manual Tests (Before Phase 8)
- [ ] `ci.yml` passes on clean PR
- [ ] `ci.yml` fails on broken TypeScript
- [ ] `ci.yml` fails on missing webview bundle
- [ ] Windows build completes without errors
- [ ] Windows ZIP extracts correctly
- [ ] Windows app launches and opens .md files
- [ ] macOS build completes without errors
- [ ] macOS DMG mounts and installs
- [ ] macOS app launches and opens .md files
- [ ] Release workflow creates draft
- [ ] Checksums are correct (manual verification)

### Integration Tests
- [ ] Update service detects platform correctly
- [ ] Update service finds correct asset (darwin → .dmg, win32 → .zip)
- [ ] Update service handles missing assets gracefully
- [ ] All existing features work on Windows build
- [ ] All existing features work on macOS build

## Status

**Current Phase:** 3 (DEVELOP) ✅

**Approval:** Granted by Jarmo on 2026-01-25

**Gate:** PASSED - Implementation authorized

## Approval

- [x] Jarmo approved this sprint plan (2026-01-25)

**Approval context:** "jah ja siis approved!" - includes release-manager agent update in scope

---

## Key Decisions Summary

The following decisions were made during research and are reflected in this plan:

1. **Windows:** x64 only (ARM out of scope)
2. **macOS:** arm64 only (Intel via Rosetta)
3. **Linux:** Out of scope (no demand)
4. **PR Validation:** Fast checks on Linux only (no full platform builds)
5. **Build Triggers:** Tags (`v*`) + manual (`workflow_dispatch`)
6. **Release Strategy:** Draft releases (manual publish for safety)
7. **Code Signing:** Skip in CI (Level 1), add in Level 2
8. **Smoke Tests:** Skip in Level 1, add in Level 2
9. **Node Version:** Hardcode `20` in workflows
10. **Caching:** Use built-in `cache: 'npm'` only
11. **Artifact Retention:** 30 days
12. **QA Checks:** Minimal script (not full qa-validator agent)

All decisions are **reversible** and can be upgraded in future sprints (Level 2/3).

---

## Post-Approval: Implementation Notes

This section will be filled during Phase 3+ (Development) with:
- Actual workflow YAML snippets
- Edge cases encountered
- Adjustments made to the plan
- Useful patterns discovered
- Build logs and debugging notes

(To be completed after approval)
