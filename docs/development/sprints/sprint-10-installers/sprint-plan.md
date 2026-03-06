# Sprint 10: Multi-Platform Installers (macOS DMG + Windows x64)

**Goal:** Create professional installers for both macOS (DMG) and Windows (NSIS) for easy distribution and installation

**Status:** Phase 2 (PLAN) - Awaiting approval

---

## Problem Statement

Currently, Ritemark Native builds to a `.app` bundle in `VSCode-darwin-arm64/`. To distribute for testing:
- Users must navigate into that directory
- No standard "drag to Applications" installation
- Harder to share with beta testers
- No professional distribution format
- **No Windows installer at all** (Windows users need full VS Code OSS build process)

**What we need:**

**Phase A: macOS DMG** (Priority 1)
- Standard macOS DMG installer with drag-to-Applications UI
- Unsigned (no Apple Developer account required yet)
- Professional appearance with app icon
- Easy to distribute via GitHub Releases or direct download

**Phase B: Windows x64 Installer** (Priority 2)
- Cross-compile from macOS using VS Code's build system
- NSIS installer (VS Code's standard approach)
- User has Windows machine for testing (no dev environment there)
- Professional installer with Start Menu shortcuts

---

## Success Criteria

### Phase A: macOS DMG
- [x] Research completed (DMG creation options, build integration)
- [ ] `scripts/create-dmg.sh` script creates working DMG installer
- [ ] DMG includes "drag to Applications" UI
- [ ] DMG uses Ritemark branding (icon, volume name)
- [ ] SHA256 checksum generated automatically
- [ ] Installation tested on a non-dev Mac
- [ ] User documentation created (installation instructions)

### Phase B: Windows x64 Installer
- [ ] Research completed (Windows build requirements, cross-compilation)
- [ ] `yarn gulp vscode-win32-x64` produces working Windows build
- [ ] NSIS installer created via VS Code's standard tooling
- [ ] Installer includes Ritemark branding (icon, product name)
- [ ] SHA256 checksum generated automatically
- [ ] Installation tested on Windows machine
- [ ] User documentation created (Windows installation instructions)

### Final Deliverable
- [ ] Developer documentation created (how to build both installers)
- [ ] Both installers work without code signing

---

## Deliverables

### 1. macOS DMG Creation Script
**File:** `scripts/create-dmg.sh`

**Features:**
- Validates `.app` bundle exists
- Extracts version from `vscode/package.json`
- Uses `create-dmg` tool to generate installer
- Creates professional DMG with:
  - Volume name: "Ritemark Native"
  - App icon on left, Applications shortcut on right
  - Custom volume icon (Ritemark logo)
  - Standard 800x400 window
- Generates SHA256 checksum file
- Outputs: `Ritemark-Native-{version}-darwin-arm64.dmg`

### 2. Windows Build Script
**File:** `scripts/build-windows.sh`

**Features:**
- Validates build environment (patches applied, Node.js version)
- Runs `yarn gulp vscode-win32-x64` from `vscode/` directory
- Uses VS Code's built-in NSIS installer creation
- Outputs to `vscode/.build/win32-x64/` (or similar)
- Generates SHA256 checksum file
- Outputs: `Ritemark-Native-{version}-win32-x64-Setup.exe`

### 3. Environment Validation
**Enhancement to:** `scripts/validate-build-env.sh` OR **New:** `scripts/validate-installer-env.sh`

**Checks:**
- **macOS:** `create-dmg` tool installed (via Homebrew)
- **Windows:** Wine/cross-compilation tools available (if needed)
- `icon.icns` exists in `branding/icons/`
- `icon.ico` exists in `branding/icons/` (for Windows)
- Node.js available (for version extraction)

### 4. User Documentation
**File:** `docs/installation-guide.md`

**Contents:**
- **macOS:**
  - How to download DMG
  - How to install (drag to Applications)
  - How to bypass Gatekeeper warning (first launch)
  - How to verify download (SHA256)
  - Troubleshooting common issues
- **Windows:**
  - How to download installer
  - How to run installer (double-click .exe)
  - Installation options (Start Menu shortcuts)
  - How to verify download (SHA256)
  - Troubleshooting common issues

### 5. Developer Documentation
**File:** `docs/building-installers.md`

**Contents:**
- **macOS DMG:**
  - How to build DMG (`scripts/create-dmg.sh`)
  - How to customize DMG appearance
- **Windows Installer:**
  - How to build Windows installer (`scripts/build-windows.sh`)
  - How to cross-compile from macOS
  - How to customize NSIS installer
- **Both:**
  - How to distribute (GitHub Releases)
  - Future: code signing and notarization steps

---

## Implementation Checklist

### Phase 1: Research (COMPLETE ✅ for macOS, PENDING for Windows)
- [x] Research DMG creation tools (chose `create-dmg`)
- [x] Analyze current build system integration points
- [x] Verify icon assets exist (`icon.icns` confirmed)
- [x] Document unsigned distribution workflow
- [x] Identify testing requirements
- [ ] Research Windows cross-compilation from macOS
- [ ] Verify VS Code's Windows build works (`yarn gulp vscode-win32-x64`)
- [ ] Verify `icon.ico` exists or needs creation
- [ ] Document Windows NSIS installer process

---

### Phase A: macOS DMG Implementation

#### A1: Tool Setup
- [ ] Install `create-dmg`: `brew install create-dmg`
- [ ] Verify `create-dmg` works with test run
- [ ] Confirm icon.icns is properly formatted

#### A2: Create DMG Script
- [ ] Create `scripts/create-dmg.sh`
- [ ] Add pre-flight checks (.app exists, create-dmg installed)
- [ ] Implement version extraction from package.json
- [ ] Implement create-dmg invocation with branding
- [ ] Generate SHA256 checksum
- [ ] Add error handling and user-friendly messages
- [ ] Make script executable (`chmod +x`)

#### A3: Testing macOS DMG
- [ ] Test DMG creation on dev machine
- [ ] Verify DMG mounts correctly
- [ ] Verify drag-to-Applications works
- [ ] Test app launch from Applications (Gatekeeper warning)
- [ ] Test subsequent launches (no warning)
- [ ] Test on a clean Mac (non-dev environment)
- [ ] Verify SHA256 checksum matches

#### A4: Documentation (macOS)
- [ ] Create macOS section in `docs/installation-guide.md`
- [ ] Create macOS section in `docs/building-installers.md`
- [ ] Document Gatekeeper bypass process with screenshots

---

### Phase B: Windows Installer Implementation

#### B1: Environment Setup
- [ ] Verify Windows icon exists: `branding/icons/icon.ico`
- [ ] If missing, create from icon.png: `convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`
- [ ] Test `yarn gulp vscode-win32-x64` from `vscode/` directory
- [ ] Verify output directory and files

#### B2: Create Windows Build Script
- [ ] Create `scripts/build-windows.sh`
- [ ] Add pre-flight checks (patches applied, Node.js version)
- [ ] Implement version extraction from package.json
- [ ] Invoke `yarn gulp vscode-win32-x64` with proper environment
- [ ] Locate NSIS installer output
- [ ] Copy installer to root directory with proper naming
- [ ] Generate SHA256 checksum
- [ ] Add error handling and user-friendly messages
- [ ] Make script executable (`chmod +x`)

#### B3: Testing Windows Installer
- [ ] Build Windows installer on macOS
- [ ] Transfer installer to Windows test machine
- [ ] Verify installer runs without errors
- [ ] Test installation to default location (Program Files)
- [ ] Verify Start Menu shortcuts created
- [ ] Test app launch from Start Menu
- [ ] Test app launch from desktop shortcut (if created)
- [ ] Verify SHA256 checksum matches
- [ ] Test uninstaller

#### B4: Documentation (Windows)
- [ ] Create Windows section in `docs/installation-guide.md`
- [ ] Create Windows section in `docs/building-installers.md`
- [ ] Document cross-compilation process
- [ ] Document testing workflow (macOS → Windows transfer)

---

### Phase C: Integration & Finalization

#### C1: Integration
- [ ] Add installer creation to build workflow (optional automation)
- [ ] Update .gitignore for installer artifacts (`.dmg`, `.exe`, `*.sha256`)
- [ ] Consider adding to `build-prod.sh` as optional step
- [ ] Create unified `scripts/build-all-installers.sh` (calls both DMG and Windows scripts)

#### C2: Validation & Commit
- [ ] Run full test suite (both installers + installations)
- [ ] Invoke `qa-validator` for pre-commit checks
- [ ] Commit all Sprint 10 deliverables
- [ ] Update ROADMAP.md to mark Sprint 10 complete

---

## Technical Specifications

### macOS DMG Naming Convention
```
Ritemark-Native-{version}-darwin-arm64.dmg
Ritemark-Native-{version}-darwin-arm64.dmg.sha256

Example:
Ritemark-Native-1.94.0-darwin-arm64.dmg
Ritemark-Native-1.94.0-darwin-arm64.dmg.sha256
```

### Windows Installer Naming Convention
```
Ritemark-Native-{version}-win32-x64-Setup.exe
Ritemark-Native-{version}-win32-x64-Setup.exe.sha256

Example:
Ritemark-Native-1.94.0-win32-x64-Setup.exe
Ritemark-Native-1.94.0-win32-x64-Setup.exe.sha256
```

### DMG Contents
```
Ritemark Native (mounted volume)
├── Ritemark Native.app
└── Applications → /Applications (symlink)
```

### Windows Build Output
```
vscode/.build/win32-x64/
├── Ritemark Native/
│   ├── Ritemark Native.exe
│   ├── resources/
│   └── ...
└── system-setup/
    └── Ritemark-Native-{version}-Setup.exe (NSIS installer)
```

### DMG Properties
- **Volume Name:** "Ritemark Native"
- **Window Size:** 800x400 pixels
- **Icon Size:** 100x100 pixels
- **Background:** None (clean default)
- **Volume Icon:** `branding/icons/icon.icns`

### create-dmg Command
```bash
create-dmg \
  --volname "Ritemark Native" \
  --volicon "branding/icons/icon.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "Ritemark Native.app" 200 190 \
  --hide-extension "Ritemark Native.app" \
  --app-drop-link 600 185 \
  --no-internet-enable \
  "Ritemark-Native-${VERSION}-darwin-arm64.dmg" \
  "VSCode-darwin-arm64/"
```

### Windows Build Command
```bash
cd vscode
yarn gulp vscode-win32-x64
```

**Note:** VS Code's build system automatically creates NSIS installer via `gulp` tasks.

---

## User Installation Flows

### macOS Installation Flow

#### 1. Download DMG
- From GitHub Releases or direct link
- File: `Ritemark-Native-{version}-darwin-arm64.dmg`

#### 2. Verify Download (Optional but Recommended)
```bash
shasum -a 256 Ritemark-Native-1.94.0-darwin-arm64.dmg
# Compare with .sha256 file
```

#### 3. Install
- Double-click DMG to mount
- Drag "Ritemark Native.app" to Applications folder
- Wait for copy to complete
- Eject DMG

#### 4. First Launch
- Open Applications folder
- **Right-click** "Ritemark Native.app" → **Open**
- Gatekeeper warning: "Cannot verify developer"
- Click **Open** to create exception
- App launches

#### 5. Subsequent Launches
- Normal double-click (no warning)

---

### Windows Installation Flow

#### 1. Download Installer
- From GitHub Releases or direct link
- File: `Ritemark-Native-{version}-win32-x64-Setup.exe`

#### 2. Verify Download (Optional but Recommended)
```powershell
certutil -hashfile Ritemark-Native-1.94.0-win32-x64-Setup.exe SHA256
# Compare with .sha256 file
```

#### 3. Install
- Double-click `.exe` installer
- Windows SmartScreen warning: "Unrecognized app"
- Click **More info** → **Run anyway**
- Follow installer prompts:
  - Choose installation location (default: `C:\Program Files\Ritemark Native`)
  - Create Start Menu shortcuts
  - Create desktop shortcut (optional)
- Click **Install**

#### 4. First Launch
- Start Menu → Ritemark Native
- Or desktop shortcut (if created)
- App launches

#### 5. Uninstall (if needed)
- Settings → Apps → Ritemark Native → Uninstall
- Or: Start Menu → Ritemark Native → Uninstall

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `create-dmg` not installed | High | Low | Pre-flight check, clear install instructions |
| DMG creation fails | Low | Medium | Validate .app exists before DMG step |
| Users confused by Gatekeeper | Medium | High | Clear documentation with screenshots |
| DMG doesn't work on other Macs | Low | High | Test on clean machine before release |
| Icon doesn't show up | Low | Low | Verify icon.icns format before DMG creation |
| **Windows cross-compilation fails** | **Medium** | **High** | Test early, document known issues, fallback to Windows-native build if needed |
| **Windows icon missing** | **High** | **Low** | Create icon.ico from existing icon.png |
| **NSIS installer not created** | **Low** | **High** | Verify VS Code build process includes NSIS step |
| **Windows SmartScreen blocks install** | **High** | **Medium** | Clear documentation on "Run anyway" process |
| **No Windows test environment** | **Low** | **High** | User has Windows machine for testing |

---

## Dependencies

### Tools Required (macOS Build Host)
| Tool | Install | Purpose | Already Have? |
|------|---------|---------|---------------|
| `create-dmg` | `brew install create-dmg` | DMG creation | ❌ Need to install |
| Node.js | Already required | Version extraction, builds | ✅ Yes |
| `sips` | Built into macOS | Icon verification | ✅ Yes |
| ImageMagick | `brew install imagemagick` | icon.ico creation (if needed) | ❓ Check |
| Yarn | Already required | VS Code builds | ✅ Yes |

### Tools Required (Windows Test Machine)
| Tool | Install | Purpose | Already Have? |
|------|---------|---------|---------------|
| Windows 10/11 | N/A | Testing installer | ✅ Yes (user has it) |
| PowerShell | Built-in | Checksum verification | ✅ Yes |

### Files Required
| File | Location | Status |
|------|----------|--------|
| **macOS App bundle** | `VSCode-darwin-arm64/Ritemark Native.app` | ✅ Built by `build-prod.sh` |
| **macOS Icon** | `branding/icons/icon.icns` | ✅ Exists |
| **Windows Icon** | `branding/icons/icon.ico` | ❓ Check (may need to create) |
| Product config | `branding/product.json` | ✅ Exists |
| Version source | `vscode/package.json` | ✅ Exists |

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `scripts/create-dmg.sh` | Create | macOS DMG creation script |
| `scripts/build-windows.sh` | Create | Windows installer build script |
| `scripts/build-all-installers.sh` | Create | Unified script to build both |
| `scripts/validate-installer-env.sh` | Create (optional) | Pre-flight checks for installer tools |
| `docs/installation-guide.md` | Create | User-facing installation instructions (both platforms) |
| `docs/building-installers.md` | Create | Developer documentation (both platforms) |
| `branding/icons/icon.ico` | Create (if missing) | Windows icon |
| `.gitignore` | Update | Add `*.exe`, `*.sha256` (already has `*.dmg`) |

---

## Testing Strategy

### Automated Tests (Both Platforms)
- ✅ Installer file created successfully
- ✅ Installer file size reasonable
- ✅ SHA256 file created
- ✅ SHA256 checksum matches file

### Manual Tests (macOS)
- ✅ DMG appearance (window size, icon positions)
- ✅ Drag to Applications works
- ✅ App launches from Applications
- ✅ Gatekeeper warning appears on first launch
- ✅ Gatekeeper exception created (subsequent launches work)

### Manual Tests (Windows)
- ✅ Installer runs without errors
- ✅ Installation to default location works
- ✅ Start Menu shortcuts created
- ✅ App launches from Start Menu
- ✅ Desktop shortcut works (if created)
- ✅ Uninstaller works
- ✅ SmartScreen bypass process works

### Environment Tests
**macOS:**
- ✅ macOS Ventura (13.x)
- ✅ macOS Sonoma (14.x)
- ✅ macOS Sequoia (15.x)
- ✅ Clean Mac (non-dev environment)

**Windows:**
- ✅ Windows 10 (64-bit)
- ✅ Windows 11 (64-bit)
- ✅ Clean Windows (non-dev environment)

---

## Future Enhancements (Not This Sprint)

### Signed Distribution (Future Sprint)
**macOS:**
- Apple Developer account enrollment ($99/year)
- Code signing with Developer ID certificate
- Notarization via `notarytool`
- Stapling notarization ticket to DMG
- No Gatekeeper warnings for users

**Windows:**
- Code signing certificate purchase (~$200-400/year)
- Sign executable with certificate
- No SmartScreen warnings for users

### Advanced Installer Customization
**macOS:**
- Custom background image with branding
- Custom window background color
- Universal binary (arm64+x64)

**Windows:**
- Custom installer UI themes
- Silent install options
- MSI installer (enterprise deployment)

### Linux Distribution (Future Sprint)
- AppImage (self-contained)
- Snap package
- Flatpak package
- .deb package (Debian/Ubuntu)
- .rpm package (Fedora/RHEL)

### CI/CD Integration
- Automated installer creation on tag push
- Upload to GitHub Releases automatically
- Multi-platform builds in parallel

---

## Estimated Effort

| Phase | Task | Time Estimate |
|-------|------|---------------|
| **Phase A: macOS DMG** | | |
| A1 | Tool setup | 15 minutes |
| A2 | Create DMG script | 1-2 hours |
| A3 | Testing macOS | 2-3 hours |
| A4 | Documentation (macOS) | 1 hour |
| **Phase B: Windows Installer** | | |
| B1 | Environment setup | 30 minutes - 1 hour |
| B2 | Create Windows script | 2-3 hours |
| B3 | Testing Windows | 3-4 hours (includes transfer to test machine) |
| B4 | Documentation (Windows) | 1 hour |
| **Phase C: Integration** | | |
| C1 | Integration | 1 hour |
| C2 | Validation & commit | 30 minutes |
| **Total** | | **12-17 hours** |

This is a substantial but achievable sprint covering both platforms.

---

## References

### Research Documents
- `docs/sprints/sprint-10-installers/research/dmg-creation-research.md`
- `docs/sprints/sprint-10-installers/research/build-system-analysis.md`
- `docs/sprints/sprint-10-installers/research/windows-build-research.md` (to be created)

### External Resources
**macOS:**
- [create-dmg GitHub](https://github.com/create-dmg/create-dmg)
- [Apple Gatekeeper Guide](https://support.apple.com/en-us/HT202491)
- [Distributing Mac Apps Outside App Store](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)

**Windows:**
- [VS Code Build Documentation](https://github.com/microsoft/vscode/wiki/How-to-Contribute)
- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)
- [Windows SmartScreen Guide](https://learn.microsoft.com/en-us/windows/security/threat-protection/microsoft-defender-smartscreen/microsoft-defender-smartscreen-overview)

### Related Sprints
- Sprint 08: Build Stability (completed - validates builds before packaging)
- Sprint 09: Renamed to Sprint 10 (this sprint)
- Sprint 11+: Code signing and notarization (future)

---

## Approval

- [ ] Jarmo approved this sprint plan

**Awaiting approval to proceed to Phase 3 (DEVELOP).**

---

## Notes

### Why Unsigned?
- **macOS:** No Apple Developer account required (saves $99/year for now)
- **Windows:** No code signing certificate required (saves $200-400/year for now)
- Faster iteration (no notarization/signing wait time)
- Suitable for beta testing and internal use
- Can upgrade to signed in future sprint

### Why create-dmg?
- Simple, focused tool
- No code signing assumptions
- Professional results
- Easy to automate
- MIT licensed (compatible with our project)

### Why VS Code's Built-in NSIS?
- Already integrated into VS Code build system
- Professional results
- No additional dependencies
- Used by VS Code itself (proven solution)

### Distribution Strategy
**Short-term:** GitHub Releases (manual upload)
**Long-term:** Automated CI/CD with multi-platform builds

### Cross-Compilation Strategy
- **macOS → Windows:** VS Code supports this via `yarn gulp vscode-win32-x64`
- **Testing:** Transfer installer to Windows test machine
- **No dev environment needed on Windows:** Just testing

### Why Both Platforms in One Sprint?
- Shared infrastructure (version extraction, checksums, documentation)
- Similar testing workflows
- Better user experience (simultaneous release)
- More efficient than two separate sprints
