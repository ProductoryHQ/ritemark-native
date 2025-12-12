# Build System Analysis for DMG Integration

**Date:** 2025-12-08
**Sprint:** 09

---

## Current Build System

### Scripts Inventory

| Script | Purpose | Output | Duration |
|--------|---------|--------|----------|
| `scripts/build-prod.sh` | Master production build | `.app` bundle | ~25 min |
| `scripts/build-mac.sh` | Legacy build script | `.app` bundle | ~25 min |
| `scripts/validate-build-env.sh` | Pre-build checks | Exit code | <30 sec |
| `scripts/validate-build-output.sh` | Post-build checks | Exit code | <10 sec |
| `scripts/apply-patches.sh` | Apply VS Code patches | Modified files | <5 sec |
| `scripts/create-patch.sh` | Create new patches | .patch file | Manual |
| `scripts/update-vscode.sh` | Update VS Code submodule | Updated submodule | Manual |
| `scripts/setup.sh` | Initial project setup | Dependencies | Varies |

### Build Output Structure

```
VSCode-darwin-arm64/
└── RiteMark Native.app/
    ├── Contents/
    │   ├── Info.plist
    │   ├── MacOS/
    │   │   └── Electron (main binary)
    │   ├── Resources/
    │   │   ├── app/
    │   │   │   ├── extensions/
    │   │   │   │   └── ritemark/  (our extension)
    │   │   │   ├── node_modules/
    │   │   │   ├── out/           (VS Code compiled)
    │   │   │   └── package.json
    │   │   ├── electron.asar      (Electron framework)
    │   │   └── Code.icns          (app icon)
    │   └── Frameworks/            (Electron frameworks)
    │       └── Electron Framework.framework/
    └── PkgInfo
```

**Current size:** ~300-400 MB (typical Electron app)

---

## Version Management

### Version Sources

1. **VS Code version:** `vscode/package.json`
   ```json
   {
     "version": "1.94.0"
   }
   ```

2. **RiteMark branding:** `branding/product.json`
   ```json
   {
     "nameLong": "RiteMark Native",
     "quality": "stable"
   }
   ```

3. **Git commit:** Available via `git describe --tags --always`

### Proposed Version Format for DMG

**Pattern:** `RiteMark-Native-{vscode-version}-{quality}-{arch}.dmg`

**Examples:**
- `RiteMark-Native-1.94.0-stable-darwin-arm64.dmg`
- `RiteMark-Native-1.94.0-beta-darwin-arm64.dmg`
- `RiteMark-Native-1.94.0-dev-darwin-arm64.dmg`

**Version extraction script:**
```bash
# Extract version from vscode/package.json
VERSION=$(node -p "require('./vscode/package.json').version")

# Extract quality from branding/product.json
QUALITY=$(node -p "require('./branding/product.json').quality")

# Build DMG filename
DMG_NAME="RiteMark-Native-${VERSION}-${QUALITY}-darwin-arm64.dmg"
```

---

## Integration Points

### Where DMG Creation Fits

**Option A: Extend build-prod.sh (Recommended)**
```bash
# Current: build-prod.sh ends with validation
# New: Add optional Step 6

if [[ "$CREATE_DMG" == "true" ]]; then
  echo -e "${BLUE}Step 6/6: Creating DMG Installer${NC}"
  ./scripts/create-dmg.sh
fi
```

**Usage:**
```bash
# Build only (current behavior)
./scripts/build-prod.sh

# Build + DMG
CREATE_DMG=true ./scripts/build-prod.sh
```

**Option B: Separate script (Also Good)**
```bash
# Build first
./scripts/build-prod.sh

# Then create DMG
./scripts/create-dmg.sh
```

**Recommendation:** Use Option B (separate script) for clarity and modularity.

---

## DMG Creation Script Requirements

### Inputs
1. `.app` bundle at `VSCode-darwin-arm64/RiteMark Native.app`
2. Version from `vscode/package.json`
3. Quality from `branding/product.json`
4. Optional: Custom DMG background image
5. Optional: Volume icon (app icon)

### Validation Checks (Pre-DMG)
- [ ] `.app` bundle exists
- [ ] `.app` is valid (not corrupted)
- [ ] `create-dmg` is installed
- [ ] No existing DMG with same name (or prompt to overwrite)

### Outputs
1. DMG file in project root: `RiteMark-Native-{version}-{arch}.dmg`
2. SHA256 checksum file: `RiteMark-Native-{version}-{arch}.dmg.sha256`
3. Build log (optional)

### Error Handling
- Exit with clear error message if `.app` missing
- Exit if `create-dmg` not installed (with install instructions)
- Exit if DMG creation fails (preserve .app for retry)

---

## Icon Considerations

### Current Icon Assets

**Check if these exist:**
```bash
branding/icons/icon.icns          # macOS app icon (required for DMG volume)
branding/icons/icon.png           # PNG source
branding/icons/icon@2x.png        # Retina source
```

If `.icns` doesn't exist, we need to create it from PNG sources.

### ICNS Creation

**Tool:** `sips` (built into macOS) or `iconutil`

**Process:**
```bash
# Create iconset directory
mkdir -p tmp.iconset

# Generate all sizes
sips -z 16 16     icon.png --out tmp.iconset/icon_16x16.png
sips -z 32 32     icon.png --out tmp.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out tmp.iconset/icon_32x32.png
sips -z 64 64     icon.png --out tmp.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out tmp.iconset/icon_128x128.png
sips -z 256 256   icon.png --out tmp.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out tmp.iconset/icon_256x256.png
sips -z 512 512   icon.png --out tmp.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out tmp.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out tmp.iconset/icon_512x512@2x.png

# Convert to .icns
iconutil -c icns tmp.iconset -o icon.icns

# Cleanup
rm -rf tmp.iconset
```

**Note:** This can be added to the DMG script if `.icns` is missing.

---

## DMG Customization Options

### create-dmg Flags

**Essential:**
- `--volname "RiteMark Native"` - Volume name when mounted
- `--app-drop-link X Y` - Creates Applications folder symlink

**Nice-to-have:**
- `--window-pos X Y` - Initial window position
- `--window-size W H` - Window dimensions
- `--icon-size SIZE` - Icon size in pixels
- `--icon "AppName.app" X Y` - Position of app icon
- `--volicon path/to/icon.icns` - Custom volume icon
- `--background path/to/bg.png` - Custom background image

**Not needed now:**
- `--codesign IDENTITY` - Skip (unsigned build)
- `--notarize CREDENTIALS` - Skip (unsigned build)

### Recommended Settings

```bash
create-dmg \
  --volname "RiteMark Native" \
  --volicon "branding/icons/icon.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "RiteMark Native.app" 200 190 \
  --hide-extension "RiteMark Native.app" \
  --app-drop-link 600 185 \
  --no-internet-enable \
  "RiteMark-Native-${VERSION}-darwin-arm64.dmg" \
  "VSCode-darwin-arm64/"
```

**Result:**
- Clean, professional appearance
- App icon on left, Applications shortcut on right
- No background (simple and clean)
- Standard macOS DMG experience

---

## Testing Checklist

### Development Machine Tests
- [ ] Run `scripts/create-dmg.sh` successfully
- [ ] Verify DMG file created with correct name
- [ ] Verify SHA256 file created
- [ ] Verify DMG size is reasonable (~300-400 MB)

### DMG Functionality Tests
- [ ] Double-click DMG → mounts successfully
- [ ] Volume name is "RiteMark Native"
- [ ] Window shows app and Applications shortcut
- [ ] Drag app to Applications → copies successfully
- [ ] Eject DMG → clean unmount

### App Launch Tests (from Applications folder)
- [ ] Right-click → Open → Gatekeeper warning appears
- [ ] Accept Gatekeeper → app launches
- [ ] Close and re-open → no warning (exception created)
- [ ] App functions correctly (open .md file, edit, save)

### Clean Environment Tests
- [ ] Test on different Mac (not dev machine)
- [ ] Test on macOS Ventura (13.x)
- [ ] Test on macOS Sonoma (14.x)
- [ ] Test on macOS Sequoia (15.x)

---

## Dependencies

### Required Tools

| Tool | Install Method | Purpose | Check Command |
|------|---------------|---------|---------------|
| `create-dmg` | `brew install create-dmg` | DMG creation | `which create-dmg` |
| `node` | Already required | Version extraction | `node --version` |
| `sips` | Built into macOS | Icon generation | `which sips` |
| `iconutil` | Built into macOS | .icns conversion | `which iconutil` |

### Pre-flight Check

Add to `scripts/validate-build-env.sh` or create `scripts/validate-dmg-env.sh`:

```bash
# Check for create-dmg
if ! command -v create-dmg &> /dev/null; then
  echo "ERROR: create-dmg not found"
  echo "Install: brew install create-dmg"
  exit 1
fi

# Check for .icns icon
if [[ ! -f "branding/icons/icon.icns" ]]; then
  echo "WARNING: icon.icns not found"
  echo "DMG will use default volume icon"
  # Could auto-generate here
fi
```

---

## File Naming & Organization

### Output Location

**Proposal:** Keep DMG files in project root, add to `.gitignore`

```
ritemark-native/
├── RiteMark-Native-1.94.0-darwin-arm64.dmg
├── RiteMark-Native-1.94.0-darwin-arm64.dmg.sha256
└── VSCode-darwin-arm64/ (existing)
```

**Already in .gitignore:**
```
*.dmg
```

**Good!** DMG files won't be committed accidentally.

### Distribution

**For beta testing:**
1. Upload DMG + SHA256 to GitHub Releases
2. Tag release: `v1.94.0-beta.1`
3. Include installation instructions in release notes

**GitHub Release Notes Template:**
```markdown
## RiteMark Native v1.94.0-beta.1

### Installation

1. Download `RiteMark-Native-1.94.0-darwin-arm64.dmg`
2. Double-click to mount
3. Drag "RiteMark Native" to Applications folder
4. Right-click app → Open (first time only)
5. Accept Gatekeeper warning

### Verification

SHA256: (from .sha256 file)
\`\`\`bash
shasum -a 256 RiteMark-Native-1.94.0-darwin-arm64.dmg
\`\`\`

### Known Limitations

- Unsigned build (requires Gatekeeper bypass)
- Apple Silicon only (arm64)
```

---

## Rollout Strategy

### Phase 1: Internal Testing (This Sprint)
- Create DMG on dev machine
- Test on clean Mac (borrow or VM)
- Validate installation process
- Document any issues

### Phase 2: Beta Distribution (Future)
- Upload to GitHub Releases
- Share with 2-3 trusted beta testers
- Collect feedback on installation experience

### Phase 3: Signed Distribution (Future Sprint)
- Acquire Apple Developer account
- Implement code signing
- Implement notarization
- Remove Gatekeeper warnings

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `create-dmg` not installed | High | Low | Pre-flight check + docs |
| DMG creation fails | Low | Medium | Validate .app first |
| Users can't install (confused) | Medium | High | Clear documentation |
| DMG too large for GitHub | Low | Low | GitHub allows 2GB files |
| Works on dev Mac, fails elsewhere | Medium | High | Test on clean machine |

---

## Success Criteria

At the end of Sprint 09, we should have:

1. ✅ `scripts/create-dmg.sh` that works reliably
2. ✅ DMG with professional appearance
3. ✅ SHA256 checksum generation
4. ✅ Documentation for users (how to install)
5. ✅ Documentation for developers (how to create DMG)
6. ✅ Tested on at least one non-dev Mac
7. ✅ No code signing required (unsigned works)

---

## Conclusion

**Build system is ready** for DMG integration. The modular script architecture means we can add DMG creation as a separate step without disrupting the existing build process.

**Key integration points:**
1. After successful `build-prod.sh`
2. Before distribution to testers
3. Automated via CI/CD (future)

**Estimated effort:**
- Script creation: 1-2 hours
- Testing: 2-3 hours
- Documentation: 1-2 hours
- **Total: 4-7 hours** (one focused sprint)
