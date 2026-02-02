# Current State Analysis - Cross-Platform CI/CD

**Sprint:** 24 - Cross-Platform CI/CD Pipeline
**Phase:** 1 (Research)
**Date:** 2026-01-25

---

## Executive Summary

Ritemark Native currently has **NO automated CI/CD pipeline**. All builds are manual, macOS-specific, and error-prone. This research documents the current state and gaps that must be addressed.

---

## 1. GitHub Actions Status

### Current State
```bash
$ ls -la .github/workflows/
# No such directory
```

**Finding:** `.github/workflows/` directory does not exist. There is ZERO automation.

### Impact
- No PR validation (can merge broken code)
- No automatic builds (all manual)
- No quality gates (can ship bugs)
- No release automation (error-prone manual process)

---

## 2. Existing Build Scripts Analysis

### macOS Build: `scripts/build-prod.sh`

**Status:** ✅ WORKS - Mature, battle-tested

**Key Features:**
- 7-step build pipeline with validation gates
- Pre-build validation (`validate-build-env.sh`)
- Backup/restore guardrail (prevents corruption)
- Extension copy validation (webview.js, extension.js size checks)
- Post-build validation (`validate-build-output.sh`)
- Timestamp fixing (1980 → current)
- ~25 minute build time

**Platform-Specific:**
- Target: `darwin-arm64` (hardcoded)
- Uses: `stat -f%z` (macOS-only syntax)
- Uses: `SetFile` (Xcode command line tool)
- Gulp target: `vscode-darwin-arm64`

**Quality Guardrails:**
```bash
# Example: Webview bundle size check
WEBVIEW_SIZE=$(stat -f%z "$EXT_DEST/media/webview.js")
if [[ $WEBVIEW_SIZE -lt 500000 ]]; then
  echo "FAIL: webview.js corrupted"
  exit 1
fi
```

### Windows Build: `scripts/build-windows.sh`

**Status:** ❌ BROKEN - Assumes cross-compilation

**Critical Issues:**
1. **Runs `yarn gulp vscode-win32-x64` from macOS**
   - Will fail on native modules (node-pty, native-keymap, etc.)
   - node-gyp can't cross-compile to Windows from macOS
2. **Missing Ritemark extension copy step**
   - Only builds VS Code, doesn't copy `extensions/ritemark/`
   - Resulting app won't open `.md` files
3. **No validation steps**
   - No pre-build checks
   - No post-build verification
4. **No quality gates**
   - Can produce broken builds without detection

**Conclusion:** `build-windows.sh` is a **non-functional template**. It cannot produce a working Windows build.

---

## 3. Platform-Specific Code Analysis

### Update Service Hardcoding

**File:** `extensions/ritemark/src/update/githubClient.ts`
```typescript
// PROBLEM: Hardcoded darwin-arm64
const assetPattern = /Ritemark.*darwin-arm64\.dmg$/;
```

**File:** `extensions/ritemark/src/update/updateService.ts`
```typescript
// PROBLEM: Assumes DMG format only
private async downloadUpdate(downloadUrl: string): Promise<string> {
  const fileName = path.basename(downloadUrl); // Assumes .dmg
  // ...
}
```

**Impact:** Auto-update will NEVER work on Windows (even if we build it).

### Whisper Binary Paths

**File:** `extensions/ritemark/src/voiceDictation/whisperCpp.ts`
```typescript
// Already handles platform correctly via feature flags
// Voice dictation is darwin-only (good!)
```

**Impact:** None - already properly gated.

---

## 4. Build Environment Requirements

### macOS (Current, Working)
- Node.js 20.x (arm64, NOT Rosetta)
- Xcode Command Line Tools
- SetFile (timestamp fixing)
- ~25 min build time on M1/M2

### Windows (Not Working)
**Per `docs/analysis/windows-build-audit.md`:**
- Node.js 20.x (x64)
- Python 3.11.x (for node-gyp)
- Visual Studio Build Tools 2022
- MSVC v143 with Spectre-mitigated libraries
- Windows 10/11 SDK
- 7-Zip (for packaging)
- **MUST build natively on Windows** (no cross-compile)

### Linux (Unknown)
- Not currently needed (not a target platform)
- Could add later if demand exists

---

## 5. Release Artifact Analysis

### Current Release Process (Manual)

**From Sprint 20 and recent releases:**
1. Jarmo builds locally with `./scripts/build-prod.sh`
2. Jarmo runs `./scripts/create-dmg.sh`
3. Jarmo signs with `./scripts/codesign-app.sh`
4. Jarmo notarizes with `./scripts/notarize-app.sh`
5. Jarmo manually creates GitHub Release
6. Jarmo manually uploads DMG

**Release Assets (Current):**
- `Ritemark-1.0.3-darwin-arm64.dmg` (signed, notarized)
- No Windows builds
- No checksums
- No release notes automation

**Problems:**
- 100% manual (error-prone)
- No validation before upload
- No rollback mechanism
- Single platform only
- Requires Jarmo's machine

---

## 6. Quality Gate Analysis

### Current Gates (via `qa-validator` agent)

**Pre-commit checks:**
- TypeScript compilation
- Extension compilation
- Webview bundle size check
- File icon validation
- Git status (no uncommitted changes allowed)

**Missing Gates:**
- No automated PR validation
- No build artifact validation in CI
- No cross-platform compatibility checks
- No smoke tests
- No update flow testing

---

## 7. Dependencies & Tooling

### Node/npm Version

**Current:** Not tracked in repository root

**VS Code Requirement:**
```bash
# vscode/.nvmrc should specify Node 20.x
# But vscode/ is a submodule (may not be initialized)
```

**Problem:** No `.nvmrc` in project root → CI might use wrong Node version

### VS Code Submodule

**Current Commit:** Unknown (submodule not initialized in analysis environment)

**Critical Check Needed:**
- Does our VS Code commit include PR #262434 fix?
  - Issue: `win32ContextMenu` TypeError on Windows build
  - Fix: Skip AppX packaging for OSS builds
  - Merged: Aug 20, 2025

**If not included:** Need patch `010-skip-appx-oss.patch`

---

## 8. Best Practices Review (VSCodium)

### VSCodium CI Architecture

**Workflow Structure:**
```
.github/workflows/
├── stable-linux.yml         # ubuntu-latest
├── stable-windows.yml       # windows-latest
├── stable-macos.yml         # macos-latest
└── nightly.yml              # All platforms
```

**Key Patterns:**
1. **Separate workflows per platform** (easier to debug)
2. **Matrix builds** (x64, arm64)
3. **Conditional runners** (expensive runners only on main, not PRs)
4. **Concurrency control** (cancel old runs)
5. **Build caching** (node_modules, node-gyp cache)
6. **Self-healing validation** (restore from backup on corruption)
7. **Smoke tests** (launch app, verify extensions load)

**Build Times:**
- Linux: ~15 min
- Windows: ~35-50 min
- macOS: ~30-40 min

**Runner Strategy:**
```yaml
# Cheap PRs (Linux only, quick validation)
on: pull_request
  runs-on: ubuntu-latest

# Expensive releases (all platforms)
on: push
  tags: ['v*']
  runs-on: [ubuntu-latest, windows-latest, macos-latest]
```

---

## 9. Gaps Summary

| Gap | Impact | Priority |
|-----|--------|----------|
| No CI/CD workflows | Can't automate builds | CRITICAL |
| Windows build broken | Can't ship Windows | CRITICAL |
| Update service macOS-only | Windows users can't update | HIGH |
| No PR validation | Can merge broken code | HIGH |
| No build artifact validation | Can ship corrupt builds | HIGH |
| No .nvmrc in root | CI might use wrong Node | MEDIUM |
| No checksums in releases | Can't verify downloads | MEDIUM |
| Manual release process | Error-prone, slow | MEDIUM |
| No smoke tests | Ship without basic validation | MEDIUM |
| No Linux builds | Can't support Linux users | LOW (not prioritized) |

---

## 10. Key Decisions Required

### Platform Support
- **macOS:** darwin-arm64 (current) + darwin-x64 (Intel Macs)?
- **Windows:** win32-x64 only or also win32-arm64?
- **Linux:** Add linux-x64 or wait for demand?

### Build Strategy
- **Local dev:** Keep manual scripts? Hybrid approach?
- **CI frequency:** Every PR? Only on main? Only on tags?
- **Runner costs:** GitHub free tier (2000 min/month) or paid?

### Signing & Distribution
- **Windows signing:** Unsigned Phase 1 → Azure Trusted Signing Phase 2?
- **macOS signing:** Keep manual codesign/notarize or move to CI?
- **Installer:** DMG (macOS) + ZIP (Windows) → Add MSI/EXE later?

### Quality Gates
- **PR validation:** Fast checks only (TypeScript, lint) or full build?
- **Release validation:** Smoke tests? Manual QA? Both?
- **Rollback:** Auto-rollback on validation failure?

---

## References

- `docs/analysis/windows-build-audit.md` - Comprehensive Windows build research
- `scripts/build-prod.sh` - Current macOS build pipeline
- VSCodium workflows - Industry reference for VS Code fork CI
- Electron Forge best practices - Electron app CI patterns
