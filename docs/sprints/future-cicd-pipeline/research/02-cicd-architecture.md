# CI/CD Pipeline Architecture Design

**Sprint:** 24 - Cross-Platform CI/CD Pipeline
**Phase:** 1 (Research)
**Date:** 2026-01-25

---

## Executive Summary

This document proposes a **3-level maturity model** for RiteMark's CI/CD pipeline, starting with "Works" and evolving to "Pro" quality over multiple phases.

---

## 1. Maturity Model

### Level 0: "Hope" (CURRENT STATE)
- ❌ No automation
- ❌ Manual builds only
- ❌ No validation gates
- ❌ Error-prone release process

### Level 1: "Works" (MVP Target)
- ✅ Basic CI workflows
- ✅ Automated builds on tag
- ✅ Windows + macOS artifacts
- ✅ Manual release upload
- ❌ No PR validation
- ❌ No signing
- ❌ No smoke tests

### Level 2: "Reliable" (Phase 2 Target)
- ✅ PR validation (fast checks)
- ✅ Matrix builds (x64, arm64)
- ✅ Build caching
- ✅ Smoke tests
- ✅ Quality gates integrated
- ✅ Basic checksums
- ❌ Not signed
- ❌ Not automated release

### Level 3: "Pro" (Final Target)
- ✅ Full PR validation
- ✅ Signed builds (macOS notarized, Windows signed)
- ✅ Automated GitHub Releases
- ✅ Auto-update tested in CI
- ✅ Rollback on failure
- ✅ Multi-platform smoke tests

**Sprint 24 Goal:** Achieve Level 1 ("Works") for Windows + macOS

---

## 2. Proposed Workflow Structure

```
.github/workflows/
├── ci.yml                    # Fast PR validation (Linux only)
├── build-windows.yml         # Windows production build
├── build-macos.yml           # macOS production build
└── release.yml               # Orchestration + GitHub Release
```

### Workflow Responsibilities

| Workflow | Trigger | Runs On | Duration | Purpose |
|----------|---------|---------|----------|---------|
| `ci.yml` | Every PR, push to main | ubuntu-latest | ~5 min | Fast validation (TypeScript, lint, tests) |
| `build-windows.yml` | Tag `v*`, manual | windows-latest | ~35 min | Build Windows x64 artifact |
| `build-macos.yml` | Tag `v*`, manual | macos-latest | ~30 min | Build macOS arm64 artifact |
| `release.yml` | Tag `v*` | ubuntu-latest | ~2 min | Create GitHub Release, upload artifacts |

---

## 3. Workflow Design: `ci.yml` (PR Validation)

### Goal
Fail fast on broken code BEFORE expensive platform builds.

### Strategy
Run on cheap Linux runner. No full VS Code build (too slow for PR feedback).

### Checks
```yaml
name: CI - PR Validation

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout with submodules
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Apply patches
        run: ./scripts/apply-patches.sh

      - name: Install VS Code dependencies
        working-directory: vscode
        run: npm ci

      - name: Install extension dependencies
        working-directory: extensions/ritemark
        run: npm ci

      - name: TypeScript compilation (VS Code)
        working-directory: vscode
        run: npm run compile

      - name: TypeScript compilation (RiteMark extension)
        working-directory: extensions/ritemark
        run: npm run compile

      - name: Verify webview bundle exists
        run: |
          WEBVIEW_SIZE=$(stat -c%s extensions/ritemark/media/webview.js)
          if [ $WEBVIEW_SIZE -lt 500000 ]; then
            echo "ERROR: webview.js too small ($WEBVIEW_SIZE bytes)"
            exit 1
          fi
          echo "OK: webview.js is $WEBVIEW_SIZE bytes"

      - name: Run qa-validator checks
        run: |
          # Invoke qa-validator agent via script
          # (Future: convert qa-validator to standalone script)
          echo "TODO: Integrate qa-validator"
```

**Key Design Decisions:**
- ✅ Uses `ubuntu-latest` (cheapest runner, ~$0.008/min vs $0.08/min for macOS)
- ✅ Skips full VS Code build (30+ min → 5 min)
- ✅ Validates TypeScript compilation only
- ✅ Checks webview bundle integrity
- ❌ Does NOT build VS Code executable (too slow for PR feedback)
- ❌ Does NOT run on expensive runners (Windows/macOS reserved for releases)

**Cost Analysis:**
- 5 min × 20 PRs/month = 100 min/month (~$0.80)
- Within GitHub free tier (2000 min/month)

---

## 4. Workflow Design: `build-windows.yml`

### Goal
Produce a working, tested Windows x64 production build.

### Key Challenges
1. **Native build required** - Must run on `windows-latest` (no cross-compile)
2. **Extension copy critical** - Must copy RiteMark extension after build
3. **Path handling** - Windows uses backslashes, bash uses forward slashes
4. **Validation** - Must verify webview.js, extension.js sizes

### Proposed Workflow

```yaml
name: Build - Windows x64

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest
    timeout-minutes: 60

    steps:
      - name: Checkout with submodules
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Apply patches
        shell: bash
        run: ./scripts/apply-patches.sh

      - name: Install VS Code dependencies
        working-directory: vscode
        run: npm ci

      - name: Compile extension
        working-directory: extensions/ritemark
        run: |
          npm ci
          npm run compile

      - name: Verify webview bundle (pre-build)
        shell: bash
        run: |
          WEBVIEW_SIZE=$(stat -c%s extensions/ritemark/media/webview.js)
          if [ $WEBVIEW_SIZE -lt 500000 ]; then
            echo "ERROR: webview.js missing or corrupted"
            exit 1
          fi

      - name: Build VS Code for Windows
        working-directory: vscode
        run: npm run gulp vscode-win32-x64-min

      - name: Copy RiteMark extension
        shell: bash
        run: |
          APP_DIR="VSCode-win32-x64"
          EXT_DEST="$APP_DIR/resources/app/extensions/ritemark"

          echo "Copying extension..."
          cp -R extensions/ritemark "$EXT_DEST"

          echo "Removing dev files..."
          rm -rf "$EXT_DEST/webview/node_modules"
          rm -rf "$EXT_DEST/webview/src"

      - name: Validate build output
        shell: bash
        run: |
          EXT_DIR="VSCode-win32-x64/resources/app/extensions/ritemark"

          # Check webview.js
          WEBVIEW_SIZE=$(stat -c%s "$EXT_DIR/media/webview.js")
          if [ $WEBVIEW_SIZE -lt 500000 ]; then
            echo "FAIL: webview.js ($WEBVIEW_SIZE bytes)"
            exit 1
          fi
          echo "OK: webview.js ($WEBVIEW_SIZE bytes)"

          # Check extension.js
          EXT_SIZE=$(stat -c%s "$EXT_DIR/out/extension.js")
          if [ $EXT_SIZE -lt 1000 ]; then
            echo "FAIL: extension.js ($EXT_SIZE bytes)"
            exit 1
          fi
          echo "OK: extension.js ($EXT_SIZE bytes)"

      - name: Create ZIP artifact
        shell: bash
        run: |
          VERSION=$(node -p "require('./branding/product.json').ritemarkVersion")
          ZIP_NAME="RiteMark-${VERSION}-win32-x64.zip"

          7z a "dist/$ZIP_NAME" ./VSCode-win32-x64/*

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ritemark-windows-x64
          path: dist/*.zip
          retention-days: 30
```

**Critical Steps:**
1. ✅ Run on `windows-latest` (native build)
2. ✅ Setup Python 3.11 (required by node-gyp)
3. ✅ Apply patches before build
4. ✅ Pre-validate webview bundle exists
5. ✅ Build VS Code with `gulp vscode-win32-x64-min`
6. ✅ **Copy RiteMark extension** (CRITICAL - missing from old script)
7. ✅ Post-validate build output (size checks)
8. ✅ Create ZIP for distribution

**Shell Strategy:**
- Use `shell: bash` for consistency
- Git Bash available on `windows-latest` by default
- Same scripts work on Windows/macOS/Linux

---

## 5. Workflow Design: `build-macos.yml`

### Goal
Replicate existing `build-prod.sh` in CI, add artifact upload.

### Strategy
Port `build-prod.sh` to GitHub Actions with minimal changes.

### Proposed Workflow

```yaml
name: Build - macOS arm64

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build-macos:
    runs-on: macos-latest-xlarge  # M1 runner (faster)
    timeout-minutes: 45

    steps:
      - name: Checkout with submodules
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run production build script
        run: ./scripts/build-prod.sh

      - name: Create DMG
        run: ./scripts/create-dmg.sh
        env:
          SKIP_CODESIGN: true  # Level 1: unsigned builds
          SKIP_NOTARIZE: true

      - name: Upload DMG artifact
        uses: actions/upload-artifact@v4
        with:
          name: ritemark-macos-arm64
          path: dist/*.dmg
          retention-days: 30
```

**Level 1 Simplification:**
- ❌ Skip code signing (requires secrets setup)
- ❌ Skip notarization (requires Apple Developer account in CI)
- ✅ Build works and produces DMG
- ✅ Can test locally

**Level 2 Upgrade:**
- Add `APPLE_CERTIFICATE` secret
- Add `APPLE_ID` / `APPLE_PASSWORD` secrets
- Enable codesign + notarize in CI

---

## 6. Workflow Design: `release.yml`

### Goal
Orchestrate Windows + macOS builds, create GitHub Release, upload artifacts.

### Proposed Workflow

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    uses: ./.github/workflows/build-windows.yml

  build-macos:
    uses: ./.github/workflows/build-macos.yml

  create-release:
    needs: [build-windows, build-macos]
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required to create releases

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download Windows artifact
        uses: actions/download-artifact@v4
        with:
          name: ritemark-windows-x64
          path: dist/

      - name: Download macOS artifact
        uses: actions/download-artifact@v4
        with:
          name: ritemark-macos-arm64
          path: dist/

      - name: Generate checksums
        run: |
          cd dist
          sha256sum *.zip *.dmg > checksums.txt

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dist/*.zip
            dist/*.dmg
            dist/checksums.txt
          draft: true  # Level 1: manual review before publish
          generate_release_notes: true
```

**Key Features:**
- ✅ Waits for both platform builds
- ✅ Downloads artifacts from both jobs
- ✅ Generates SHA256 checksums
- ✅ Creates draft release (manual publish for safety)
- ✅ Auto-generates release notes from commits

**Level 2 Upgrade:**
- Change `draft: false` for auto-publish
- Add release notes template
- Invoke `product-marketer` agent for changelog

---

## 7. Caching Strategy

### Node Modules Cache

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Auto-caches ~/.npm
    cache-dependency-path: |
      vscode/package-lock.json
      extensions/ritemark/package-lock.json
```

**Benefit:** ~2-5 min saved per build

### node-gyp Cache (Windows)

```yaml
- name: Cache node-gyp
  uses: actions/cache@v4
  with:
    path: |
      ~/.cache/node-gyp
      ~/AppData/Local/node-gyp
    key: ${{ runner.os }}-node-gyp-${{ hashFiles('vscode/package-lock.json') }}
```

**Benefit:** ~1-3 min saved on Windows native module compilation

### Build Output Cache (Experimental)

```yaml
- name: Cache VS Code build
  uses: actions/cache@v4
  with:
    path: vscode/.build
    key: ${{ runner.os }}-vscode-${{ hashFiles('vscode/package-lock.json') }}
```

**Risk:** May cause stale build issues. Only enable if builds are too slow.

---

## 8. Concurrency Control

### Cancel Old Runs

```yaml
name: Build - Windows x64

on:
  push:
    tags: ['v*']

concurrency:
  group: build-windows-${{ github.ref }}
  cancel-in-progress: true
```

**Benefit:**
- Pushing `v1.0.4` then `v1.0.5` → cancels v1.0.4 build
- Saves runner time
- Prevents duplicate releases

---

## 9. Quality Gates Integration

### qa-validator Integration

**Challenge:** `qa-validator` is currently a Claude agent, not a standalone script.

**Options:**

**Option A: Script Wrapper (Recommended for Level 1)**
```bash
# scripts/qa-check.sh
#!/bin/bash
# Minimal quality checks that can run without Claude

set -e

echo "Running quality checks..."

# 1. TypeScript compilation
echo "[1/4] TypeScript compilation..."
cd vscode && npm run compile && cd ..
cd extensions/ritemark && npm run compile && cd ../..

# 2. Webview bundle check
echo "[2/4] Webview bundle..."
WEBVIEW_SIZE=$(stat -c%s extensions/ritemark/media/webview.js 2>/dev/null || stat -f%z extensions/ritemark/media/webview.js)
if [ $WEBVIEW_SIZE -lt 500000 ]; then
  echo "FAIL: webview.js too small"
  exit 1
fi

# 3. File icon check
echo "[3/4] File icons..."
ICON_COUNT=$(find extensions/ritemark/fileicons/icons -name "*.svg" 2>/dev/null | wc -l | tr -d ' ')
if [ $ICON_COUNT -lt 10 ]; then
  echo "FAIL: Missing icons"
  exit 1
fi

# 4. Git status
echo "[4/4] Git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "FAIL: Uncommitted changes"
  exit 1
fi

echo "All checks passed!"
```

**Option B: Full Agent (Level 3)**
- Convert `qa-validator` to Python script
- Run in CI with full validation
- Requires more development effort

---

## 10. Error Handling & Self-Healing

### Backup/Restore Pattern (from build-prod.sh)

```yaml
- name: Backup extension before build
  run: |
    cp -R extensions/ritemark .ritemark-backup

- name: Build VS Code
  run: npm run gulp vscode-win32-x64-min
  working-directory: vscode

- name: Verify extension integrity
  run: |
    WEBVIEW_SIZE=$(stat -c%s extensions/ritemark/media/webview.js)
    if [ $WEBVIEW_SIZE -lt 500000 ]; then
      echo "Extension corrupted during build! Restoring..."
      rm -rf extensions/ritemark
      mv .ritemark-backup extensions/ritemark
      exit 1
    fi
    rm -rf .ritemark-backup
```

**Benefit:** Detects symlink corruption during VS Code build (known issue)

---

## 11. Smoke Tests (Level 2)

### Windows Smoke Test

```yaml
- name: Smoke test - Launch app
  shell: pwsh
  run: |
    $app = "VSCode-win32-x64/Code - OSS.exe"
    Start-Process $app -ArgumentList "--version" -Wait -NoNewWindow

- name: Smoke test - Open markdown file
  shell: pwsh
  run: |
    echo "# Test" > test.md
    $app = "VSCode-win32-x64/Code - OSS.exe"
    Start-Process $app -ArgumentList "test.md" -Wait -NoNewWindow
    # Check if process started without crash
```

### macOS Smoke Test

```yaml
- name: Smoke test - Launch app
  run: |
    ./VSCode-darwin-arm64/RiteMark.app/Contents/MacOS/Electron --version

- name: Smoke test - Verify extension
  run: |
    EXTS=$(./VSCode-darwin-arm64/RiteMark.app/Contents/MacOS/Electron --list-extensions)
    if ! echo "$EXTS" | grep -q "ritemark"; then
      echo "ERROR: RiteMark extension not found"
      exit 1
    fi
```

---

## 12. Cost Analysis

### GitHub Actions Free Tier
- **Linux:** 2000 min/month free
- **macOS:** Uses 10× multiplier (200 min = 2000 min)
- **Windows:** Uses 2× multiplier (1000 min = 2000 min)

### Projected Usage (Per Month)

| Workflow | Runs | Duration | Platform | Multiplier | Total Minutes |
|----------|------|----------|----------|------------|---------------|
| CI (PRs) | 20 | 5 min | Linux | 1× | 100 min |
| Windows builds | 4 | 35 min | Windows | 2× | 280 min |
| macOS builds | 4 | 30 min | macOS | 10× | 1200 min |
| **TOTAL** | | | | | **1580 min** |

**Verdict:** Within free tier (2000 min), but close. Optimize if needed.

### Cost Optimizations
1. **Cache aggressively** (node_modules, node-gyp)
2. **Matrix builds only on tags** (not every commit)
3. **Cancel old runs** (concurrency control)
4. **Fast-fail PR validation** (Linux only, no full build)

---

## 13. Migration Path

### Phase 1: Level 1 ("Works") - This Sprint
1. Create `.github/workflows/ci.yml`
2. Create `.github/workflows/build-windows.yml`
3. Create `.github/workflows/build-macos.yml`
4. Create `.github/workflows/release.yml`
5. Test with manual triggers first
6. Enable on tag push after validation

### Phase 2: Level 2 ("Reliable") - Future Sprint
1. Add PR validation (full TypeScript checks)
2. Add build caching
3. Add smoke tests
4. Add matrix builds (x64, arm64)
5. Integrate qa-validator as script

### Phase 3: Level 3 ("Pro") - Future Sprint
1. Add code signing (macOS notarization, Windows Authenticode)
2. Auto-publish releases
3. Add rollback automation
4. Add update flow testing
5. Add telemetry for build success rates

---

## 14. Success Metrics

### Level 1 Success Criteria
- ✅ Windows build produces working `.zip` artifact
- ✅ macOS build produces working `.dmg` artifact
- ✅ Both builds validate webview.js integrity
- ✅ GitHub Release created with both artifacts
- ✅ Checksums generated
- ✅ Build time < 45 min per platform

### Level 2 Success Criteria
- ✅ PR validation fails on broken TypeScript
- ✅ Smoke tests pass on both platforms
- ✅ Cache hit rate > 80%
- ✅ Build time < 30 min per platform

### Level 3 Success Criteria
- ✅ Signed builds (SmartScreen/Gatekeeper bypass)
- ✅ Auto-update flow tested in CI
- ✅ Zero manual steps in release process
- ✅ Rollback < 5 min on failure

---

## References

- VSCodium CI workflows: https://github.com/VSCodium/vscodium/tree/master/.github/workflows
- Electron Forge CI best practices: https://www.electronforge.io/guides/continuous-integration
- GitHub Actions pricing: https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- rules_ts concurrency patterns: https://github.com/aspect-build/rules_ts
