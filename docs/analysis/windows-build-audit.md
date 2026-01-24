# Windows Build Audit - RiteMark Native

**Date:** 2026-01-24
**Status:** Research / Pre-Implementation
**Goal:** Determine the best strategy for producing a Windows production build of RiteMark Native.

---

## Executive Summary

**Cross-compiling from macOS to Windows is NOT viable** for VS Code forks. Native Node.js modules (compiled via node-gyp) require the Windows C++ toolchain (`cl.exe` / MSVC) which is unavailable on macOS. The recommended approach - used by VSCodium and all major VS Code forks - is to **build natively on Windows** (locally or via CI).

---

## Table of Contents

1. [Cross-Compile vs Native Build](#1-cross-compile-vs-native-build)
2. [Current State of Windows Support](#2-current-state-of-windows-support)
3. [Known Build Failures & Blockers](#3-known-build-failures--blockers)
4. [Windows Build Prerequisites](#4-windows-build-prerequisites)
5. [Recommended Build Strategy](#5-recommended-build-strategy)
6. [Code Changes Required](#6-code-changes-required)
7. [Code Signing & Distribution](#7-code-signing--distribution)
8. [CI/CD Pipeline Design](#8-cicd-pipeline-design)
9. [Action Items](#9-action-items)

---

## 1. Cross-Compile vs Native Build

### Why Cross-Compilation Fails

| Issue | Detail |
|-------|--------|
| node-gyp | Not a compiler - adapts to the host platform's toolchain. On macOS it uses clang/g++, cannot produce Windows binaries. |
| Native modules | VS Code uses native Node modules (e.g., `node-pty`, `native-keymap`, `spdlog`) that MUST be compiled with MSVC for Windows. |
| Electron | Electron's native layer needs platform-specific compilation. |
| VS Code build system | `gulp vscode-win32-x64` downloads prebuilt Node headers but still invokes node-gyp for extensions. |

> "node-gyp isn't a compiler, it's a build system that adapts to the platform it's on - on Windows it will use Visual Studio and on Linux/macOS it will use g++/clang."
> -- node-gyp GitHub issue #829

### How VSCodium Does It

VSCodium (the largest VS Code OSS fork) uses **separate GitHub Actions runners per platform**:
- `stable-linux.yml` runs on `ubuntu-latest`
- `stable-windows.yml` runs on `windows-latest`
- `stable-macos.yml` runs on `macos-latest`

Each workflow builds natively on its target platform. There is no cross-compilation.

### Verdict

| Approach | Feasibility | Reliability |
|----------|-------------|-------------|
| Cross-compile macOS → Windows | Not feasible | Native modules will fail |
| Build on Windows (local) | Fully feasible | High |
| Build on Windows (CI) | Fully feasible | High (automated) |
| Docker + Wine | Experimental | Low - fragile, unsupported |

**Recommendation: Build natively on Windows, either locally or via GitHub Actions CI.**

---

## 2. Current State of Windows Support

### What's Already Done

| Component | Status | Notes |
|-----------|--------|-------|
| `branding/product.json` | Ready | Has `win32DirName`, `win32AppUserModelId`, etc. |
| `branding/icons/icon.ico` | Ready | Windows icon exists |
| `installer/windows/ritemark.iss` | Ready | Inno Setup script (x64, Windows 10+, user-level install) |
| `scripts/create-windows-installer.sh` | Ready | Uses Docker + `amake/innosetup` |
| `scripts/build-windows.sh` | Broken | Tries cross-compilation, will fail on native modules |
| Feature flags (`win32` platform) | Partial | Voice dictation correctly excluded; other flags OK |
| Update service | Not ready | Hardcoded to look for `darwin-arm64` DMG assets |

### What's Missing

| Component | Status | Action Needed |
|-----------|--------|---------------|
| `win32ContextMenu` in product.json | Missing | May cause build failure (see Section 3) |
| Windows native build script | Missing | Need PowerShell or batch script for building ON Windows |
| Windows CI workflow | Missing | GitHub Actions `.yml` for `windows-latest` |
| Windows code signing | Not started | Certificate + signing toolchain needed |
| Update service Windows support | Not started | Need to handle `.exe`/`.zip` assets |
| Windows binary for whisper-cli | Not needed | Voice dictation disabled on Windows via feature flag |

---

## 3. Known Build Failures & Blockers

### 3.1 `win32ContextMenu` TypeError (CRITICAL)

**VS Code Issue:** [#262382](https://github.com/microsoft/vscode/issues/262382)

When running `gulp vscode-win32-x64`, the build fails at the `package-win32-x64` step:
```
TypeError: Cannot read properties of undefined (reading 'x64')
```

**Root cause:** `gulpfile.vscode.js` references `product.win32ContextMenu[arch].clsid` which doesn't exist in OSS product.json.

**Fix:** PR [#262434](https://github.com/microsoft/vscode/pull/262434) skips AppX packaging for OSS builds. Check if our VS Code submodule (`cdc0f6d`) includes this fix. If not, we need a patch.

### 3.2 Native Module Compilation

These VS Code native modules MUST compile on the target platform:
- `node-pty` (terminal emulator)
- `native-keymap` (keyboard layout detection)
- `spdlog` (logging)
- `windows-mutex` (Windows-specific)
- `@vscode/windows-process-tree`
- `native-watchdog`

### 3.3 Spectre-Mitigated Libraries

With npm >= 10.2.3 or node-gyp >= 10.0.0, Windows builds may fail with:
```
error: Spectre-mitigated libraries are required for this project
```

**Fix:** Install via Visual Studio Installer:
- MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs (Latest)
- C++ ATL for latest build tools with Spectre Mitigations
- C++ MFC for latest build tools with Spectre Mitigations

### 3.4 Path and Profile Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| Spaces in clone path | node-gyp compilation errors | Clone to `C:\Dev\ritemark-native` |
| Non-ASCII profile path | node-gyp failures | Use ASCII-only Windows username |
| Long paths | Various failures | Enable Win32 long paths in registry |

---

## 4. Windows Build Prerequisites

### System Requirements

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | >= 20.x (x64) | Runtime, must match `.nvmrc` |
| Python | 3.11.x | Required by node-gyp |
| Visual Studio Build Tools 2022 | Latest | C++ compilation |
| Git | Latest | Source control |
| 7-Zip | Latest | Packaging |

### Visual Studio Workloads & Components

**Required workload:** "Desktop Development with C++"

**Individual components:**
- MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
- MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs
- C++ ATL for latest build tools with Spectre Mitigations
- Windows 10/11 SDK (latest)

### Environment Configuration

```powershell
# Set npm architecture (if needed for ARM64 Windows)
$env:npm_config_arch = "x64"

# Set MSVC version
npm config set msvs_version 2022

# Ensure Python is accessible
python --version  # Should be 3.11.x

# Verify setuptools installed
pip install setuptools
```

---

## 5. Recommended Build Strategy

### Option A: GitHub Actions CI (Recommended for Production)

```yaml
# .github/workflows/build-windows.yml
name: Build Windows
on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      # ... build steps
```

**Pros:** Automated, reproducible, no local Windows machine needed
**Cons:** Slower iteration, runner time costs, debugging is harder

### Option B: Local Windows Build (Recommended for Development)

Use a Windows machine or VM (Parallels/VMware on Mac) for interactive development and testing.

**Pros:** Fast iteration, easy debugging, full control
**Cons:** Requires Windows machine/license

### Option C: Hybrid (Best of Both)

- **Development/testing:** Local Windows VM (Option B)
- **Production releases:** GitHub Actions CI (Option A)

This is what VSCodium uses and is the recommended approach.

---

## 6. Code Changes Required

### 6.1 CRITICAL - Must Fix Before Build

| File | Issue | Fix |
|------|-------|-----|
| `branding/product.json` | Missing `win32ContextMenu` | Add CLSID or verify our VS Code commit has the AppX skip fix |
| `scripts/build-windows.sh` | Assumes cross-compilation | Rewrite as PowerShell script for native Windows build |
| `extensions/ritemark/src/update/githubClient.ts` | Hardcoded `darwin-arm64` + `.dmg` | Add `win32-x64` + `.zip`/`.exe` lookup |
| `extensions/ritemark/src/update/updateService.ts` | Hardcoded DMG reference | Platform-aware asset selection |

### 6.2 IMPORTANT - Should Fix

| File | Issue | Fix |
|------|-------|-----|
| `scripts/validate-build-env.sh` | Hardcoded `arm64` check | Add `x64` for Windows or make platform-aware |
| `scripts/validate-build-output.sh` | Hardcoded `VSCode-darwin-arm64` path | Parameterize output path |
| `.claude/hooks/pre-commit-validator.sh` | Uses `stat -f%z` (macOS only) | Use `wc -c` or platform-detect |

### 6.3 Already Handled by Feature Flags

| Feature | Windows Behavior | Why It's OK |
|---------|-----------------|-------------|
| Voice dictation | Disabled (platform: `darwin` only) | Feature flag gates it correctly |
| Whisper binaries | Not loaded | Flag prevents initialization |
| Microphone patch (#009) | Uses Electron API | Works cross-platform |

---

## 7. Code Signing & Distribution

### Industry Change (June 2023+)

As of June 2023, all code signing certificates require **hardware security modules (HSM)** compliant with FIPS 140 Level 2. Software-based `.pfx`/`.p12` certificates are no longer available for purchase.

### Windows Signing Options

| Option | Platform | Cost | Complexity |
|--------|----------|------|------------|
| Azure Trusted Signing | Cloud | ~$10/month | Medium - new service, limited availability |
| DigiCert KeyLocker | Cloud HSM | ~$500/year | Medium |
| AWS CloudHSM | Cloud | ~$1.50/hr | High |
| USB Token (e.g., SafeNet) | Physical | ~$400 one-time + cert cost | Low (but requires Windows machine) |
| No signing (unsigned) | N/A | Free | None - but shows SmartScreen warning |

### SmartScreen Considerations

Unsigned Windows apps trigger Microsoft SmartScreen warnings:
- "Windows protected your PC" dialog
- Requires user to click "More info" → "Run anyway"
- Reputation builds over time with signed apps (EV certs get immediate trust)

### Recommended Approach (Phased)

1. **Phase 1 (MVP):** Ship unsigned ZIP distribution. Document SmartScreen bypass for users.
2. **Phase 2:** Add code signing via Azure Trusted Signing or DigiCert KeyLocker in CI.
3. **Phase 3:** Inno Setup installer with signed binaries for a polished experience.

---

## 8. CI/CD Pipeline Design

### Workflow Structure (Following VSCodium's Pattern)

```
.github/workflows/
├── build-macos.yml          # Existing (darwin-arm64)
├── build-windows.yml        # NEW (win32-x64)
└── release.yml              # Orchestrates both, creates GitHub Release
```

### Windows Build Steps

```yaml
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      # 1. Checkout with submodules
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      # 2. Setup tools
      - uses: actions/setup-node@v4
        with:
          node-version-file: 'vscode/.nvmrc'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      # 3. Apply patches
      - run: bash ./scripts/apply-patches.sh

      # 4. Install dependencies
      - run: |
          cd vscode
          yarn install

      # 5. Compile extension
      - run: |
          cd extensions/ritemark
          npm run compile

      # 6. Build webview bundle (if not committed)
      - run: |
          cd extensions/ritemark/webview
          npm install && npm run build

      # 7. Build VS Code for Windows
      - run: |
          cd vscode
          yarn gulp vscode-win32-x64-min-ci

      # 8. Copy extension to build output
      - run: |
          xcopy /E /I extensions\ritemark VSCode-win32-x64\resources\app\extensions\ritemark

      # 9. Package as ZIP
      - run: 7z a dist/RiteMark-win32-x64.zip ./VSCode-win32-x64/*

      # 10. Upload artifact
      - uses: actions/upload-artifact@v4
        with:
          name: ritemark-windows-x64
          path: dist/RiteMark-win32-x64.zip
```

### Caching Strategy

```yaml
- uses: actions/cache@v4
  with:
    path: |
      vscode/node_modules
      extensions/ritemark/node_modules
      ~/.cache/node-gyp
    key: windows-x64-${{ hashFiles('vscode/yarn.lock') }}
```

---

## 9. Action Items

### Immediate (Before First Build Attempt)

1. **Verify `win32ContextMenu` fix** - Check if VS Code commit `cdc0f6d` includes PR #262434 fix. If not, create patch `010-skip-appx-oss.patch`.
2. **Create `scripts/build-windows.ps1`** - Native PowerShell build script for Windows machines.
3. **Update `product.json`** - Add any missing Windows-specific fields if needed.
4. **Test build on Windows** - Set up a Windows VM or use GitHub Actions to verify the build completes.

### Short-Term (First Working Build)

5. **Update `githubClient.ts`** - Platform-aware asset detection for updates.
6. **Update `updateService.ts`** - Support ZIP/EXE downloads on Windows.
7. **Create `.github/workflows/build-windows.yml`** - Automated CI builds.
8. **Test extension loading** - Verify RiteMark extension activates on Windows build.
9. **Test file associations** - Verify `.md` files open in RiteMark editor.

### Medium-Term (Production Quality)

10. **Code signing** - Obtain certificate, integrate into CI.
11. **Inno Setup integration** - Build installer in CI (already have `.iss` script).
12. **SmartScreen reputation** - Submit for Microsoft reputation or use EV cert.
13. **Auto-update for Windows** - Implement Windows update flow.
14. **Windows-specific testing** - Path handling, UNC paths, OneDrive integration.

---

## References

- [VS Code "How to Contribute" Wiki](https://github.com/microsoft/vscode/wiki/How-to-Contribute) - Official build prerequisites
- [VSCodium Build Docs](https://github.com/VSCodium/vscodium/blob/master/docs/howto-build.md) - Fork build reference
- [VSCodium Architecture (DeepWiki)](https://deepwiki.com/VSCodium/vscodium) - CI/CD pipeline design
- [VS Code Issue #262382](https://github.com/microsoft/vscode/issues/262382) - `win32ContextMenu` build failure
- [Electron Code Signing Docs](https://www.electronjs.org/docs/latest/tutorial/code-signing) - Signing requirements
- [electron-builder Windows Signing on Unix](https://www.electron.build/tutorials/code-signing-windows-apps-on-unix.html) - Cross-platform signing (limited)
- [node-gyp Cross-Compilation Issue #829](https://github.com/nodejs/node-gyp/issues/829) - Why cross-compile fails
- [@electron/windows-sign](https://github.com/electron/windows-sign) - Windows signing tool
