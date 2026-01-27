# Technical Decisions & Risk Analysis

**Sprint:** 24 - Cross-Platform CI/CD Pipeline
**Phase:** 1 (Research)
**Date:** 2026-01-25

---

## Executive Summary

This document catalogs the key technical decisions required for Sprint 24 and analyzes associated risks with mitigation strategies.

---

## 1. Platform Support Decisions

### Decision 1: Windows Architecture

**Options:**
- **A:** x64 only
- **B:** x64 + arm64 (Windows on ARM)

**Analysis:**

| Factor | x64 Only | x64 + arm64 |
|--------|----------|-------------|
| Build complexity | Low (1 workflow) | High (matrix builds) |
| Build time | 35 min | 70 min (2× builds) |
| Runner cost | $0.56/build | $1.12/build |
| Market coverage | 95%+ of Windows PCs | 99%+ (includes Surface Pro X, etc.) |
| Testing effort | Low | High (need ARM device) |

**Recommendation:** **Start with x64 only** (Option A)

**Rationale:**
- Windows ARM market share < 5%
- VS Code OSS doesn't have mature ARM Windows support yet
- Can add ARM later if demand exists
- Focus on getting ONE working Windows build first

**Decision:** x64 only for Sprint 24. ARM is out of scope.

---

### Decision 2: macOS Architecture

**Options:**
- **A:** arm64 only (current)
- **B:** arm64 + x64 (Intel Macs)

**Analysis:**

| Factor | arm64 Only | arm64 + x64 |
|--------|------------|-------------|
| Current state | Already working | Need new build |
| Apple Silicon coverage | M1/M2/M3 Macs | All Macs |
| Intel Mac coverage | Rosetta 2 emulation | Native |
| Build time | 30 min | 60 min (2× builds) |
| Runner cost | $3.00/build | $6.00/build |
| Universal Binary | No | Possible (combine) |

**Recommendation:** **arm64 only** (Option A)

**Rationale:**
- Intel Macs can run arm64 via Rosetta 2 (works well for Electron apps)
- Apple Silicon now 80%+ of Mac market (and growing)
- Universal Binaries double build size (~500MB → 1GB)
- Runner costs 2× higher for marginal benefit
- Can add x64 later if users report Rosetta issues

**Decision:** arm64 only for Sprint 24. x64 is out of scope.

---

### Decision 3: Linux Support

**Options:**
- **A:** Add Linux x64 build
- **B:** Wait for user demand

**Recommendation:** **Wait for demand** (Option B)

**Rationale:**
- No users have requested Linux builds yet
- Adds complexity (new workflow, packaging, testing)
- Linux users are tech-savvy (can build from source if needed)
- Focus limited resources on Windows (high-value, high-difficulty)

**Decision:** Linux is out of scope for Sprint 24.

---

## 2. CI/CD Strategy Decisions

### Decision 4: PR Validation Scope

**Options:**
- **A:** Fast checks only (TypeScript, lint) on Linux
- **B:** Full builds on all platforms
- **C:** No PR validation (only on tags)

**Analysis:**

| Option | Feedback Time | Cost | Value | Blocker? |
|--------|---------------|------|-------|----------|
| A (Fast) | 5 min | Low (~$0.05) | High (catches 80% of issues) | No |
| B (Full) | 90 min | High (~$10) | High (catches 100% of issues) | Yes (too slow) |
| C (None) | N/A | Free | None | No |

**Recommendation:** **Option A** (Fast checks only)

**Rationale:**
- PR validation should fail fast (< 10 min)
- Full platform builds too slow for PR feedback loop
- Most issues caught by TypeScript/lint (syntax, type errors)
- Platform-specific issues caught on tag builds (pre-release)
- Cost-effective (~$1/month vs $200/month for full builds on every PR)

**Decision:** PR validation runs fast checks on Linux only.

---

### Decision 5: Build Trigger Strategy

**Options:**
- **A:** Every commit to main
- **B:** Only on tags (e.g., `v1.0.4`)
- **C:** Manual trigger only

**Recommendation:** **Option B** (tags) + **Option C** (manual) for Level 1

**Rationale:**
- Building on every commit wastes runner time (most commits aren't releases)
- Tags signal intent to release (semantic versioning)
- Manual trigger allows testing CI without creating release
- Can add `push: branches: [main]` later if needed

**Decision:** Trigger on `push: tags: ['v*']` and `workflow_dispatch`.

---

### Decision 6: Release Automation Level

**Options:**
- **A:** Full auto-publish (draft: false)
- **B:** Draft release (manual publish)
- **C:** Artifact only (no release)

**Recommendation:** **Option B** (draft release) for Level 1

**Rationale:**
- Auto-publish risky without smoke tests (could ship broken build)
- Draft allows Jarmo to test locally before publish
- Can auto-publish in Level 3 after smoke tests added

**Decision:** Create draft GitHub Release. Jarmo publishes manually.

---

## 3. Tooling & Infrastructure Decisions

### Decision 7: Node Version Management

**Options:**
- **A:** Add `.nvmrc` to project root
- **B:** Read from `vscode/.nvmrc`
- **C:** Hardcode `node-version: '20'`

**Recommendation:** **Option C** (hardcode) for Level 1

**Rationale:**
- VS Code's `.nvmrc` might not be initialized (submodule)
- Adding project `.nvmrc` could conflict with VS Code's version
- Hardcoding `20` works now, easy to change later
- All VS Code 1.94.x uses Node 20

**Decision:** Hardcode `node-version: '20'` in workflows. Add `.nvmrc` in Level 2 if needed.

---

### Decision 8: Caching Strategy

**Options:**
- **A:** No caching (simple but slow)
- **B:** Cache node_modules only
- **C:** Cache node_modules + node-gyp + build output

**Recommendation:** **Option B** for Level 1, **Option C** for Level 2

**Rationale:**
- Node modules cache built into `setup-node@v4` (free speedup)
- node-gyp cache requires manual setup (add in Level 2)
- Build output cache risky (stale builds) - only if needed

**Decision:** Use `cache: 'npm'` in setup-node for Level 1.

---

### Decision 9: Artifact Retention

**Options:**
- **A:** 1 day (min for GitHub Actions)
- **B:** 30 days
- **C:** 90 days (max)

**Recommendation:** **Option B** (30 days)

**Rationale:**
- 1 day too short (testing, rollback needs)
- 90 days wastes storage (old builds rarely needed)
- 30 days balances testing time + storage costs

**Decision:** `retention-days: 30` for build artifacts.

---

## 4. Code Signing Decisions

### Decision 10: macOS Code Signing

**Options:**
- **A:** Keep manual (local signing)
- **B:** Move to CI (secrets-based)

**Recommendation:** **Option A** (manual) for Level 1, **Option B** for Level 2

**Rationale:**
- Signing works locally now (no need to change)
- Moving to CI requires setting up secrets (complex)
- Unsigned CI builds still useful for testing
- Can add signing in Level 2 after basic pipeline proven

**Decision:** Skip code signing in CI for Level 1. Jarmo signs locally post-build.

---

### Decision 11: Windows Code Signing

**Options:**
- **A:** Unsigned builds (SmartScreen warning)
- **B:** Azure Trusted Signing
- **C:** DigiCert KeyLocker
- **D:** USB token (local signing)

**Analysis:**

| Option | Cost | Setup | CI-Friendly | SmartScreen Bypass |
|--------|------|-------|-------------|-------------------|
| A (Unsigned) | Free | None | Yes | No (warning shown) |
| B (Azure) | ~$10/month | Medium | Yes | After reputation |
| C (DigiCert) | ~$500/year | High | Yes | After reputation |
| D (USB) | ~$400 one-time | Low | No (requires Windows machine) | After reputation |

**Recommendation:** **Option A** (unsigned) for Level 1

**Rationale:**
- Windows signing requires HSM (hardware token or cloud HSM)
- Unsigned builds work but show SmartScreen warning
- Users can click "More info" → "Run anyway"
- Document SmartScreen bypass in release notes
- Add signing in Level 2 after pipeline proven

**Decision:** Ship unsigned Windows builds. Document SmartScreen workaround.

---

## 5. Quality Gate Decisions

### Decision 12: qa-validator Integration

**Options:**
- **A:** Convert to standalone script
- **B:** Run minimal checks only
- **C:** Skip in CI (local only)

**Recommendation:** **Option B** (minimal checks) for Level 1

**Rationale:**
- Full qa-validator is Claude agent (can't run in CI)
- Converting to script is complex (separate sprint)
- Minimal checks (TypeScript, webview size, icons) catch most issues
- Can invoke full qa-validator locally before tagging

**Decision:** Create `scripts/qa-check.sh` with minimal checks. Full qa-validator runs locally.

---

### Decision 13: Smoke Test Coverage

**Options:**
- **A:** No smoke tests
- **B:** Launch app + version check
- **C:** Launch app + open .md file + verify extension

**Recommendation:** **Option A** (none) for Level 1, **Option B** for Level 2

**Rationale:**
- Smoke tests require GUI automation (complex)
- Level 1 goal is "build works and produces artifact"
- Size validation catches most corruption issues
- Can add basic launch test in Level 2

**Decision:** No smoke tests in Level 1. Add in Level 2.

---

## 6. Risk Analysis

### Risk 1: VS Code Submodule Version

**Issue:** VS Code commit `cdc0f6d` may not include `win32ContextMenu` fix (PR #262434)

**Impact:** Windows build fails with TypeError

**Probability:** Medium (need to check commit history)

**Mitigation:**
1. Check if fix is included: `cd vscode && git log --oneline --grep="win32ContextMenu"`
2. If NOT included: Create patch `010-skip-appx-oss.patch`
3. If included: No action needed

**Action Item:** Verify before Phase 3.

---

### Risk 2: Extension Symlink Corruption

**Issue:** `vscode/extensions/ritemark` symlink breaks during gulp build

**Impact:** Extension not copied, app can't open .md files

**Probability:** High (known issue from build-prod.sh)

**Mitigation:**
1. Backup extension before build
2. Verify webview.js size after build
3. Restore from backup if corrupted
4. Copy extension AFTER build (not rely on symlink)

**Action Item:** Implement backup/restore in Windows workflow.

---

### Risk 3: Native Module Compilation Failure

**Issue:** node-gyp fails to compile Windows native modules

**Impact:** Build fails or app crashes on launch

**Probability:** Medium (new environment, untested)

**Mitigation:**
1. Use `windows-latest` runner (has MSVC pre-installed)
2. Setup Python 3.11 (required by node-gyp)
3. Run test build with `workflow_dispatch` first
4. Check GitHub Actions docs for known issues

**Action Item:** Test Windows build manually before enabling on tags.

---

### Risk 4: Runner Time Limits

**Issue:** Build exceeds 6-hour timeout or free tier quota

**Impact:** Build fails, can't release

**Probability:** Low (builds take ~30-40 min)

**Mitigation:**
1. Set `timeout-minutes: 60` per job
2. Monitor runner usage in GitHub billing
3. Optimize caching if builds slow down
4. Consider self-hosted runner if costs too high

**Action Item:** Monitor first 5 builds, optimize if needed.

---

### Risk 5: Artifact Upload Failure

**Issue:** Network error during artifact upload

**Impact:** Build succeeds but artifact lost

**Probability:** Low (GitHub infra reliable)

**Mitigation:**
1. Use `upload-artifact@v4` (latest, most reliable)
2. Set `retention-days: 30` (can re-download if needed)
3. Keep local build scripts working (fallback to manual)

**Action Item:** None (GitHub infra handles retries).

---

### Risk 6: Update Service Breaks

**Issue:** `darwin-arm64` hardcoding prevents Windows updates

**Impact:** Windows users can't auto-update

**Probability:** High (known issue from research)

**Mitigation:**
1. Fix `githubClient.ts` to detect platform
2. Fix `updateService.ts` to handle .zip files
3. Test update flow manually before release

**Action Item:** MUST fix before shipping Windows build (this sprint).

---

### Risk 7: GitHub Actions Quota Exceeded

**Issue:** Free tier (2000 min/month) runs out

**Impact:** Can't build until next month

**Probability:** Low (projected 1580 min/month)

**Mitigation:**
1. Optimize caching (saves ~5-10 min/build)
2. Cancel old runs (concurrency control)
3. Limit matrix builds to tags only
4. Upgrade to paid plan if needed (~$0.008/min Linux, $0.08/min macOS)

**Action Item:** Monitor usage, optimize if approaching limit.

---

### Risk 8: Code Signing Certificate Expiry

**Issue:** Jarmo's Apple certificate expires during release

**Impact:** Can't sign macOS builds

**Probability:** Low (Jarmo monitors expiry)

**Mitigation:**
1. Document certificate renewal process
2. Set calendar reminder 30 days before expiry
3. Keep unsigned builds as backup

**Action Item:** None (existing process works).

---

## 7. Dependencies & Blockers

### External Dependencies

| Dependency | Owner | Risk | Mitigation |
|------------|-------|------|------------|
| GitHub Actions | GitHub | Low (99.9% uptime) | None needed |
| VS Code upstream | Microsoft | Low (stable submodule) | Pin to specific commit |
| Node.js 20.x | Node.js team | Low (LTS until 2026) | None needed |
| MSVC on windows-latest | GitHub | Medium (version changes) | Test before each release |

### Internal Dependencies

| Dependency | Status | Blocker? |
|------------|--------|----------|
| `build-prod.sh` | ✅ Works | No |
| `apply-patches.sh` | ✅ Works | No |
| `create-dmg.sh` | ✅ Works | No |
| `codesign-app.sh` | ✅ Works (local only) | No |
| `notarize-app.sh` | ✅ Works (local only) | No |
| `scripts/build-windows.ps1` | ❌ Does not exist | Yes (must create) |
| Update service platform detection | ❌ Not implemented | Yes (must fix) |

---

## 8. Out of Scope (Explicit Non-Goals)

These are explicitly NOT included in Sprint 24:

| Item | Why Out of Scope | Future Sprint? |
|------|------------------|----------------|
| Linux builds | No user demand yet | Maybe (if requested) |
| ARM Windows builds | Market share < 5% | Maybe (if requested) |
| Intel Mac builds | Rosetta works well | Maybe (if users report issues) |
| Code signing in CI | Complex setup, not needed for MVP | Yes (Level 2) |
| Full smoke tests | Requires GUI automation | Yes (Level 2) |
| Auto-publish releases | Risky without smoke tests | Yes (Level 3) |
| Update flow testing | Requires 2+ releases to test | Yes (Level 3) |
| Self-hosted runners | Not needed yet (within free tier) | Maybe (if costs too high) |
| Docker-based builds | Adds complexity, not needed | No |
| Cross-compilation | Proven infeasible for native modules | No |

---

## 9. Success Criteria (Detailed)

### Must Have (Blocking Release)
- ✅ Windows x64 build completes in CI
- ✅ macOS arm64 build completes in CI
- ✅ Both builds pass webview.js validation (> 500KB)
- ✅ Both builds pass extension.js validation (> 1KB)
- ✅ Both builds copied to production app bundle
- ✅ ZIP artifact created for Windows
- ✅ DMG artifact created for macOS
- ✅ SHA256 checksums generated
- ✅ GitHub Release created (draft)
- ✅ Update service platform detection fixed

### Should Have (Quality Improvements)
- ✅ PR validation catches TypeScript errors
- ✅ Build time < 45 min per platform
- ✅ Cache hit rate > 50%
- ✅ Concurrency control (cancel old runs)

### Nice to Have (Future Enhancements)
- ❌ Smoke tests (Level 2)
- ❌ Code signing in CI (Level 2)
- ❌ Auto-publish releases (Level 3)
- ❌ Matrix builds (x64, arm64) (Level 3)

---

## 10. Rollback Plan

### If Windows Build Fails
1. Remove `build-windows.yml` from workflows
2. Document known issues
3. Continue manual macOS releases
4. Fix issues in follow-up sprint

### If macOS Build Fails
1. Revert to manual `build-prod.sh` locally
2. Fix CI workflow separately
3. Keep Windows CI working (separate workflow)

### If Update Service Breaks
1. Revert update service changes
2. Ship without auto-update
3. Document manual download instructions

### If All CI Fails
1. Delete `.github/workflows/` directory
2. Continue manual releases (existing process works)
3. Research fails, try again in future sprint

**Philosophy:** CI is an enhancement, not a blocker. Manual process works as fallback.

---

## 11. Decision Log

| # | Decision | Rationale | Reversible? |
|---|----------|-----------|-------------|
| 1 | Windows x64 only | Market coverage + simplicity | Yes (can add ARM later) |
| 2 | macOS arm64 only | Rosetta works well | Yes (can add x64 later) |
| 3 | Linux out of scope | No demand yet | Yes (can add later) |
| 4 | PR validation: fast checks | Cost-effective | Yes (can add full builds later) |
| 5 | Trigger on tags + manual | Prevents waste | Yes (can add main branch later) |
| 6 | Draft releases | Safety first | Yes (can auto-publish later) |
| 7 | Hardcode Node 20 | Simple, works now | Yes (can add .nvmrc later) |
| 8 | Cache node_modules only | Built-in, easy | Yes (can add more caching later) |
| 9 | 30-day retention | Balance testing + storage | Yes (can change anytime) |
| 10 | Manual macOS signing | Works now, low risk | Yes (can move to CI later) |
| 11 | Unsigned Windows builds | Avoid complexity | Yes (can add signing later) |
| 12 | Minimal qa-checks | Pragmatic | Yes (can convert to full script later) |
| 13 | No smoke tests | Level 1 MVP | Yes (can add later) |

**Key Principle:** All decisions are **reversible**. Start simple, add complexity only when proven needed.

---

## References

- `docs/analysis/windows-build-audit.md` - Windows build requirements
- `scripts/build-prod.sh` - Current macOS build process
- VSCodium CI architecture - Industry best practices
- GitHub Actions pricing - Cost analysis source
