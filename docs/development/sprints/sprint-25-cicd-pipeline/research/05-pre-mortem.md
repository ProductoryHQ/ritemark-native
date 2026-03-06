# Pre-Mortem Analysis: Sprint 24 CI/CD Pipeline

**Created:** 2026-01-25
**Technique:** Imagine the project failed. What went wrong?

---

## The Scenario

*It's 3 weeks from now. Sprint 24 is declared a failure. The CI/CD pipeline doesn't work reliably, users are frustrated, and we've wasted significant time. Let's work backwards to understand what went wrong.*

---

## Category 1: Build Failures

### 1.1 VS Code Submodule Too Old

**What happened:** Windows builds fail with cryptic `win32ContextMenu` errors. We spend days debugging before realizing our VS Code commit predates the August 2025 fix.

**Warning signs:**
- Build logs mention "Cannot find module 'win32ContextMenu'"
- Error occurs only on Windows, not macOS
- Same code works in VSCodium

**Prevention:**
```bash
# Before starting implementation, verify:
cd vscode
git log --oneline --grep="win32ContextMenu" | head -5
# If no results, submodule is too old
```

**Mitigation:** Update VS Code submodule to post-August 2025 commit before starting CI work.

---

### 1.2 Native Module Compilation Fails

**What happened:** Windows build hangs for 2 hours then fails with `node-gyp rebuild` errors. MSVC toolchain missing or misconfigured.

**Warning signs:**
- Build stalls at "Building native modules..."
- Errors mention `cl.exe`, `msbuild`, or `vcvarsall.bat`
- Works locally on Windows VM but fails in CI

**Prevention:**
```yaml
# Explicitly configure MSVC in workflow
env:
  npm_config_msvs_version: "2022"

- name: Setup MSVC
  uses: ilammy/msvc-dev-cmd@v1
```

**Mitigation:** Test Windows build in fresh VM first. Document exact toolchain requirements.

---

### 1.3 Spectre-Mitigated Libraries Missing

**What happened:** Build succeeds but app crashes on launch with "vcruntime140.dll" errors.

**Warning signs:**
- Build completes but artifact is broken
- Error only appears when running, not building
- Works on dev machine with VS installed

**Prevention:**
```yaml
# Install Visual Studio Build Tools with Spectre libs
- name: Install VS Build Tools
  run: |
    choco install visualstudio2022buildtools --package-parameters `
      "--add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
       --add Microsoft.VisualStudio.Component.VC.Spectre.x86.x64"
```

**Mitigation:** Add smoke test that actually launches the app.

---

### 1.4 Node Version Mismatch

**What happened:** Native modules compiled with Node 20 don't work with Electron's Node 18. App shows blank window.

**Warning signs:**
- "Module version mismatch" in console
- Works in dev, breaks in production
- `process.versions.node` differs between build and runtime

**Prevention:**
```yaml
# Pin exact Node version from .nvmrc
- uses: actions/setup-node@v4
  with:
    node-version-file: 'vscode/.nvmrc'  # Use VS Code's pinned version
```

**Mitigation:** Log Node versions at every build step. Compare with Electron's embedded Node.

---

### 1.5 Out of Memory / Timeout

**What happened:** Builds randomly fail at different stages. Sometimes TypeScript compilation, sometimes packaging. CI logs show "Killed" or just stop.

**Warning signs:**
- Inconsistent failure points
- Works locally (more RAM)
- "JavaScript heap out of memory"

**Prevention:**
```yaml
env:
  NODE_OPTIONS: "--max_old_space_size=8192"

# Use larger runners if needed
runs-on: windows-2022  # Not windows-latest (might be smaller)
```

**Mitigation:** Set explicit timeouts. Add memory monitoring to build script.

---

## Category 2: Integration Failures

### 2.1 Extension Not Copied to Build

**What happened:** Build succeeds, DMG looks fine, but opening .md files shows plain text editor. Ritemark extension missing from app bundle.

**Warning signs:**
- `ls extensions/ritemark` in build output shows nothing
- App launches but "Ritemark" not in Extensions list
- Same issue we had in v1.0.1 release

**Prevention:**
```yaml
# Explicit validation step
- name: Verify extension in build
  run: |
    test -d "VSCode-win32-x64/resources/app/extensions/ritemark" || exit 1
    test -f "VSCode-win32-x64/resources/app/extensions/ritemark/out/extension.js" || exit 1
```

**Mitigation:** This is THE MOST LIKELY failure. Add multiple verification points.

---

### 2.2 Symlink Breaks in CI

**What happened:** The `vscode/extensions/ritemark → ../../extensions/ritemark` symlink doesn't work in CI. Git checkout doesn't preserve symlinks on Windows.

**Warning signs:**
- "ENOENT: no such file or directory" for extension files
- Works on Mac CI, breaks on Windows CI
- `git config core.symlinks` shows `false`

**Prevention:**
```yaml
# Windows: recreate symlink after checkout
- name: Fix symlinks (Windows)
  if: runner.os == 'Windows'
  shell: pwsh
  run: |
    Remove-Item -Recurse -Force vscode/extensions/ritemark -ErrorAction SilentlyContinue
    New-Item -ItemType Junction -Path vscode/extensions/ritemark -Target (Resolve-Path extensions/ritemark)
```

**Mitigation:** Test symlink handling early. Consider copying instead of symlinking in CI.

---

### 2.3 Webview Bundle Wrong Size

**What happened:** App opens .md files but shows blank white editor. webview.js exists but is 64KB (dev build) instead of 900KB (prod build).

**Warning signs:**
- Editor area is white/blank
- DevTools shows "Cannot find module 'react'"
- `stat webview.js` shows wrong size

**Prevention:**
```yaml
- name: Validate webview bundle
  run: |
    size=$(stat -f%z extensions/ritemark/media/webview.js 2>/dev/null || stat -c%s extensions/ritemark/media/webview.js)
    if [ "$size" -lt 500000 ]; then
      echo "ERROR: webview.js is $size bytes, expected >500KB"
      exit 1
    fi
```

**Mitigation:** This is a KNOWN issue. Build webview explicitly before packaging.

---

### 2.4 Patches Don't Apply Cleanly

**What happened:** VS Code updated, our patches no longer apply. Build fails with "patch does not apply" errors.

**Warning signs:**
- "error: patch failed" in logs
- Worked last week, fails now
- VS Code submodule was updated

**Prevention:**
```yaml
- name: Apply patches
  run: |
    ./scripts/apply-patches.sh || {
      echo "Patches failed to apply. VS Code may have been updated."
      echo "Run: ./scripts/apply-patches.sh --dry-run"
      exit 1
    }
```

**Mitigation:** Test patch application before any VS Code update. Keep patches minimal.

---

### 2.5 node_modules Stripped from Extension

**What happened:** TipTap editor doesn't load. Console shows "Cannot find module '@tiptap/core'". We accidentally removed runtime dependencies during "cleanup".

**Warning signs:**
- This EXACT bug happened in v1.0.1
- Build succeeds, app launches, but editor is broken
- `ls node_modules | wc -l` shows 0 or very few packages

**Prevention:**
```yaml
# NEVER remove extensions/ritemark/node_modules
# Only remove: webview/node_modules (dev deps), webview/src (source)
- name: Clean dev-only files
  run: |
    rm -rf extensions/ritemark/webview/node_modules
    rm -rf extensions/ritemark/webview/src
    # DO NOT: rm -rf extensions/ritemark/node_modules  <-- RUNTIME DEPS!
```

**Mitigation:** Add explicit check: `node_modules` must have 100+ packages.

---

## Category 3: Platform-Specific Issues

### 3.1 Windows SmartScreen Blocks Installation

**What happened:** Users download ZIP, extract, run Ritemark.exe → Windows shows scary red warning → users give up or think it's malware.

**Warning signs:**
- Support emails: "Windows says it's dangerous"
- Download count high but active users low
- Reviews mention "virus warning"

**Prevention:**
```markdown
# In release notes (MANDATORY for unsigned builds):
## Windows Installation

Windows SmartScreen may show a warning because Ritemark is new.
1. Click "More info"
2. Click "Run anyway"

This is normal for new apps without expensive code signing certificates.
```

**Mitigation:** Document clearly. Consider EV certificate for Level 2 (~$400/year).

---

### 3.2 Windows Path Length Issues

**What happened:** Build fails randomly with "ENAMETOOLONG" or files silently missing. Windows MAX_PATH (260 chars) exceeded by deeply nested node_modules.

**Warning signs:**
- Inconsistent failures
- Works in short path (`C:\b`), fails in long path
- Missing files in specific deep directories

**Prevention:**
```yaml
# Clone to short path
- name: Checkout
  uses: actions/checkout@v4
  with:
    path: 'r'  # Short path: D:\a\r instead of D:\a\ritemark-native

# Or enable long paths
- name: Enable long paths
  run: git config --system core.longpaths true
```

**Mitigation:** Keep build paths short. Test in worst-case path length.

---

### 3.3 macOS Signing Complexity

**What happened:** Hybrid signing (CI builds, local signs) seemed simple but:
- Jarmo forgets to sign before testing
- Signs wrong build (old artifact)
- Notarization times out
- Stapling fails silently

**Warning signs:**
- "App is damaged" errors on user machines
- Gatekeeper blocks app
- Works on Jarmo's machine (Gatekeeper disabled)

**Prevention:**
```bash
# Signing checklist (add to release-manager):
1. Download EXACT artifact from draft release
2. Verify SHA256 matches
3. Sign: codesign --force --deep --sign "Developer ID" Ritemark.app
4. Notarize: xcrun notarytool submit ...
5. Wait for "Accepted" (not just "In Progress")
6. Staple: xcrun stapler staple Ritemark.app
7. Verify: spctl --assess --type exec Ritemark.app
8. Re-create DMG with signed app
9. Upload signed DMG, replacing unsigned
```

**Mitigation:** Create explicit signing script. Add verification at each step.

---

### 3.4 Architecture Mismatch

**What happened:** macOS build produces x64 binary instead of arm64. Works in Rosetta but slow. Or worse: Windows build produces wrong arch.

**Warning signs:**
- `file Ritemark.app/Contents/MacOS/Electron` shows wrong arch
- App works but CPU usage high (emulation)
- Crash reports mention "Bad CPU type"

**Prevention:**
```yaml
env:
  npm_config_arch: arm64
  npm_config_target_arch: arm64
  VSCODE_ARCH: arm64

- name: Verify architecture
  run: |
    file VSCode-darwin-arm64/Ritemark.app/Contents/MacOS/Electron | grep -q "arm64" || exit 1
```

**Mitigation:** Explicit arch in all env vars. Verify in build output.

---

## Category 4: CI/CD Infrastructure Issues

### 4.1 GitHub Actions Minutes Exceeded

**What happened:** Mid-month, all builds start failing. "You have exceeded your GitHub Actions minutes quota."

**Warning signs:**
- All workflows fail immediately (not during build)
- Error mentions "billing" or "minutes"
- Happened after busy release week

**Prevention:**
```yaml
# Don't build on every PR (expensive)
on:
  pull_request:
    paths:
      - 'extensions/**'
      - 'patches/**'
      - '.github/workflows/**'
    # Ignore: docs, README, etc.

# Cancel redundant builds
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Mitigation:** Monitor usage weekly. Set billing alerts. Have fallback (local builds).

---

### 4.2 Secrets Not Available

**What happened:** Release workflow fails with "secret not found". Secrets only available on main branch, but we're building from tag.

**Warning signs:**
- Works on main, fails on tags
- Error: "Context access might be invalid: secrets.XXX"
- Workflow runs but skips signing steps

**Prevention:**
```yaml
# Ensure secrets available for tags
on:
  push:
    tags:
      - 'v*'
    branches:
      - main  # Keep main for testing

# Or use environment with required reviewers
jobs:
  release:
    environment: production  # Requires manual approval, has secrets
```

**Mitigation:** Test secret availability with dummy workflow first.

---

### 4.3 Cache Poisoning / Stale Cache

**What happened:** Build succeeds but artifact is broken. Old cached node_modules incompatible with updated dependencies.

**Warning signs:**
- Build faster than expected (cache hit)
- Works after "clear cache", breaks again
- package-lock.json changed but cache key didn't

**Prevention:**
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    # Include ALL lockfiles that affect deps:
    key: ${{ runner.os }}-${{ hashFiles('**/package-lock.json', '**/yarn.lock', 'vscode/**/package-lock.json') }}
```

**Mitigation:** When debugging, always try with `actions/cache` step removed.

---

### 4.4 Runner Not Available

**What happened:** Windows builds queued for hours. "No runners available" or stuck at "Waiting for runner".

**Warning signs:**
- Build stuck at "Queued" status
- Other repos building fine
- Happens during GitHub incidents

**Prevention:**
```yaml
# Use specific runner version, not 'latest'
runs-on: windows-2022  # Not windows-latest

# Or use matrix for fallback
strategy:
  matrix:
    os: [windows-2022, windows-2019]  # Try both
```

**Mitigation:** Have local Windows VM as backup. Monitor GitHub Status.

---

## Category 5: Process / Human Failures

### 5.1 Draft Release Accidentally Published

**What happened:** Someone (or automation) published draft release before testing. Broken build now public. Users download, complain.

**Warning signs:**
- Release visible on public repo
- No "tested locally" confirmation from Jarmo
- GitHub notification: "Release published"

**Prevention:**
```yaml
# NEVER auto-publish
# Always create as draft:
- name: Create Release
  run: |
    gh release create $TAG --draft --title "..." --notes "..."
    #                 ^^^^^^ ALWAYS DRAFT
```

**Mitigation:** release-manager MUST verify Gate 2 before publishing. Add GitHub branch protection.

---

### 5.2 Wrong Version Tagged

**What happened:** Tagged v1.2.0 but package.json says 1.1.9. Version mismatch everywhere. Users confused.

**Warning signs:**
- Tag doesn't match package.json
- Update checker shows wrong version
- "About" dialog shows different version than release

**Prevention:**
```yaml
- name: Verify version consistency
  run: |
    TAG_VERSION="${GITHUB_REF#refs/tags/v}"
    PKG_VERSION=$(jq -r .version extensions/ritemark/package.json)
    PRODUCT_VERSION=$(jq -r .ritemarkVersion branding/product.json)

    if [ "$TAG_VERSION" != "$PKG_VERSION" ] || [ "$TAG_VERSION" != "$PRODUCT_VERSION" ]; then
      echo "VERSION MISMATCH!"
      echo "Tag: $TAG_VERSION, Package: $PKG_VERSION, Product: $PRODUCT_VERSION"
      exit 1
    fi
```

**Mitigation:** Automate version check. Block release if mismatch.

---

### 5.3 Testing Shortcuts Taken

**What happened:** Under time pressure, Jarmo approved release without full testing. "It built successfully, should be fine." It wasn't fine.

**Warning signs:**
- Quick "approved" without specific test confirmation
- Release during crunch time
- "I'll test after release" mentality

**Prevention:**
```markdown
# Gate 2 checklist (release-manager enforces):
□ Downloaded artifact from draft release (not local build)
□ Verified SHA256 checksum matches
□ Installed fresh (removed old version first)
□ Opened existing .md file - editor loads
□ Created new .md file - can type
□ Tested specific sprint features: [list]
□ Tested on both platforms (if releasing both)
```

**Mitigation:** release-manager REFUSES to proceed without explicit checklist confirmation.

---

### 5.4 Forgot to Update release-manager

**What happened:** CI produces artifacts in new location/format. release-manager still looks for old paths. Validation fails. Release blocked.

**Warning signs:**
- release-manager can't find artifacts
- "File not found" for expected paths
- Works manually, fails via agent

**Prevention:**
```markdown
# Sprint 24 MUST include:
- [ ] Update release-manager to support CI artifacts
- [ ] Test release-manager with draft release
- [ ] Document new artifact locations
```

**Mitigation:** Include release-manager testing in Sprint 24 scope.

---

## Category 6: Downstream Failures

### 6.1 Update Service Breaks on Windows

**What happened:** macOS users get updates fine. Windows users click "Check for Updates" → nothing happens or error.

**Warning signs:**
- Update service hardcoded `darwin-arm64`
- `getUpdateAssetUrl()` doesn't handle `win32`
- Console shows "No matching asset found"

**Prevention:**
```typescript
// Update service MUST support:
function getAssetForPlatform(assets: Asset[], platform: string): Asset {
  const patterns: Record<string, RegExp> = {
    'darwin-arm64': /\.dmg$/,
    'darwin-x64': /\.dmg$/,
    'win32-x64': /\.zip$/,
    'win32-arm64': /\.zip$/,
  };
  // ...
}
```

**Mitigation:** This is IN SCOPE for Sprint 24. Test update flow on both platforms.

---

### 6.2 App Works in CI, Breaks in Real World

**What happened:** All CI checks pass. Artifact looks fine. Users install → various crashes. Reasons:
- Different Windows versions (10 vs 11)
- Antivirus interference
- Non-English locale
- Screen readers / accessibility tools
- Older hardware

**Warning signs:**
- "Works on my machine" × 1000
- Bug reports with no repro in CI
- Only certain users affected

**Prevention:**
```markdown
# Future: Diverse test matrix
- Windows 10 (not just 11)
- Non-admin user
- With popular antivirus
- Non-English locale
- Screen reader enabled
```

**Mitigation:** Level 1: Accept some edge cases. Level 2+: Broader test coverage.

---

### 6.3 ZIP Extraction Issues on Windows

**What happened:** Users download ZIP, extract with Windows Explorer, run app → missing DLLs. The ZIP was too deep or Windows partially extracted.

**Warning signs:**
- "vcruntime140.dll not found"
- Works after extracting with 7-Zip
- Nested folders in ZIP

**Prevention:**
```yaml
# Ensure flat ZIP structure
- name: Create ZIP
  run: |
    cd VSCode-win32-x64
    7z a -tzip ../Ritemark-$VERSION-win32-x64.zip . -mx=9
    # Contents at root, not in subfolder
```

**Mitigation:** Test ZIP extraction with Windows Explorer specifically.

---

## Risk Severity Matrix

| Risk | Likelihood | Impact | Priority |
|------|------------|--------|----------|
| Extension not copied | 🔴 High | 🔴 Critical | P0 |
| node_modules stripped | 🔴 High | 🔴 Critical | P0 |
| Webview wrong size | 🔴 High | 🔴 Critical | P0 |
| Symlink breaks (Windows) | 🔴 High | 🟡 High | P0 |
| VS Code too old | 🟡 Medium | 🔴 Critical | P1 |
| Native module fails | 🟡 Medium | 🔴 Critical | P1 |
| Version mismatch | 🟡 Medium | 🟡 High | P1 |
| SmartScreen warning | 🔴 High | 🟡 Medium | P1 |
| Update service breaks | 🟡 Medium | 🟡 High | P1 |
| Minutes exceeded | 🟢 Low | 🟡 High | P2 |
| Cache poisoning | 🟢 Low | 🟡 Medium | P2 |
| Testing shortcuts | 🟡 Medium | 🟡 Medium | P2 |

---

## Top 10 "Must Prevent" List

Based on likelihood × impact, these are the failures we MUST prevent:

1. **Extension not in build** - Add 3+ verification points
2. **node_modules stripped** - Explicit "DO NOT DELETE" comments
3. **Webview bundle wrong size** - Size check in CI
4. **Symlink breaks on Windows** - Use Junction, verify
5. **VS Code submodule too old** - Check before starting
6. **Version mismatch** - Automated consistency check
7. **SmartScreen warning** - Document workaround prominently
8. **Update service Windows** - In scope, test explicitly
9. **Signing process error** - Detailed checklist
10. **Draft accidentally published** - ALWAYS draft, Gate 2 required

---

## Checklist: Failure Prevention

Add these to Sprint 24 implementation:

### In CI Workflows

```yaml
# After every build step, verify:
- name: Verify extension integrity
  run: |
    # 1. Extension folder exists
    test -d "$BUILD/resources/app/extensions/ritemark"

    # 2. Compiled JS exists and non-empty
    test -s "$BUILD/resources/app/extensions/ritemark/out/extension.js"

    # 3. Webview bundle is production size
    size=$(stat -c%s "$BUILD/.../media/webview.js")
    [ "$size" -gt 500000 ]

    # 4. node_modules has runtime deps
    count=$(ls "$BUILD/.../extensions/ritemark/node_modules" | wc -l)
    [ "$count" -gt 100 ]

    # 5. Version matches tag
    pkg_version=$(jq -r .version "$BUILD/.../extensions/ritemark/package.json")
    [ "v$pkg_version" = "$GITHUB_REF_NAME" ]
```

### In release-manager

```markdown
## Pre-Flight Checklist (MANDATORY)

Before any release discussion:

□ CI build completed successfully
□ Both platform artifacts uploaded
□ SHA256 checksums present
□ Downloaded artifact (not local build)
□ Extracted/mounted artifact
□ Extension folder present
□ webview.js > 500KB
□ node_modules > 100 packages
□ App launches without error
□ .md file opens in Ritemark editor
□ Version in About matches release tag
```

### In Documentation

```markdown
## Known Issues: Windows

### SmartScreen Warning
[Full explanation + screenshots]

### First Launch Slow
[Explanation: Windows Defender scanning]

### Antivirus False Positives
[List known AV issues + whitelist instructions]
```

---

## Conclusion

The pre-mortem reveals that most failures cluster around:

1. **Build integrity** - Extension, node_modules, webview
2. **Platform quirks** - Windows symlinks, paths, signing
3. **Human process** - Testing shortcuts, version mismatches

The mitigation strategy is:

1. **Multiple verification points** - Don't trust single checks
2. **Explicit automation** - Remove human error opportunity
3. **Clear checklists** - Gate 2 must be specific
4. **Documented workarounds** - SmartScreen, AV issues

If we address the Top 10 list, we have high confidence in Sprint 24 success.
