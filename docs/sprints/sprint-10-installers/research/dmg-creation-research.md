# DMG Creation Research for RiteMark Native

**Date:** 2025-12-08
**Sprint:** 09
**Researcher:** Claude (sprint-manager)

---

## Objective

Create an unsigned macOS DMG installer for RiteMark Native that:
1. Works without Apple Developer account signing/notarization
2. Provides a clean drag-to-Applications installation experience
3. Can be distributed for local testing and internal use
4. Can be upgraded later to signed/notarized version

---

## Current State Analysis

### What We Have
- **Build output:** `VSCode-darwin-arm64/RiteMark Native.app`
- **Platform:** darwin-arm64 (Apple Silicon)
- **Build script:** `scripts/build-prod.sh` (~25 min build)
- **Validation:** Pre/post-build validation scripts ensure integrity
- **App structure:** Standard macOS `.app` bundle with all resources

### What We Need
- DMG installer with drag-to-Applications UI
- Unsigned (no code signing required)
- Distribution mechanism for beta testers

---

## DMG Creation Options

### Option 1: `create-dmg` (Recommended)
**Repository:** https://github.com/create-dmg/create-dmg
**License:** MIT
**Install:** `brew install create-dmg`

**Pros:**
- Simple, focused tool for one purpose
- No code signing required
- CLI-based, easy to script
- Active maintenance
- Supports custom backgrounds, icons, window positioning
- Used by many indie Mac apps

**Cons:**
- Requires Homebrew (acceptable for dev environment)
- No built-in signing (feature for us!)

**Usage:**
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
  "RiteMark-Native-Installer.dmg" \
  "VSCode-darwin-arm64/"
```

### Option 2: `appdmg` (Node-based)
**Repository:** https://github.com/LinusU/node-appdmg
**License:** MIT
**Install:** `npm install -g appdmg`

**Pros:**
- Node-based (fits our ecosystem)
- JSON configuration
- Good control over appearance

**Cons:**
- Requires Node version compatibility
- More complex config
- Less actively maintained than create-dmg

### Option 3: `hdiutil` (Native macOS)
**Built into macOS**

**Pros:**
- No dependencies
- Native tool

**Cons:**
- Lower-level, requires more scripting
- No drag-to-Applications UI by default
- Manual AppleScript for window customization
- More complex to maintain

### Option 4: `electron-installer-dmg`
**Repository:** https://github.com/electron-userland/electron-installer-dmg

**Pros:**
- Designed for Electron apps (VS Code is Electron)
- Good defaults

**Cons:**
- Overkill for our needs
- More dependencies
- May expect signing

---

## Recommendation: `create-dmg`

**Reasoning:**
1. **Simplicity:** One tool, one purpose
2. **No signing assumed:** Built for unsigned development distribution
3. **Easy to script:** Simple CLI arguments
4. **Professional appearance:** Standard drag-to-Applications UI
5. **Future-proof:** Can add signing later without changing workflow

---

## DMG Distribution Workflow

### Unsigned Distribution (Phase 1 - Current Sprint)
```
Build .app → Create DMG → Distribute → User opens, drags to Applications
```

**User Experience:**
1. Download DMG file
2. Double-click to mount
3. Drag app to Applications folder
4. First launch: Right-click → Open (bypass Gatekeeper warning)
5. Subsequent launches: Normal double-click

**Gatekeeper Warning:**
> "RiteMark Native" cannot be opened because the developer cannot be verified.

**User Action:**
- Right-click app → Open → Confirm "Open"
- This creates a Gatekeeper exception
- Future launches work normally

### Signed Distribution (Future Sprint)
When Apple Developer account is available:
1. Add code signing to build process
2. Notarize the .app before DMG creation
3. Create DMG (same process)
4. No Gatekeeper warning for users

---

## Technical Details

### DMG Contents
```
RiteMark-Native-[version].dmg
├── RiteMark Native.app/  (the actual app)
└── Applications@ (symlink to /Applications)
```

### DMG Properties
- **Volume name:** "RiteMark Native [version]"
- **Window size:** 800x400 pixels
- **Icon size:** 100x100 pixels
- **Background:** Optional custom background image
- **Layout:** App icon on left, Applications folder shortcut on right

### File Naming Convention
```
RiteMark-Native-[version]-darwin-arm64.dmg

Examples:
- RiteMark-Native-1.0.0-beta.1-darwin-arm64.dmg
- RiteMark-Native-1.94.0-darwin-arm64.dmg
```

Version source: `vscode/package.json` + optional suffix

---

## Build Integration

### Current Flow
```
scripts/build-prod.sh
  ├─ Step 1: validate-build-env.sh
  ├─ Step 2: gulp vscode-darwin-arm64 (~25 min)
  ├─ Step 3: Copy extension
  ├─ Step 4: Verify extension
  └─ Step 5: validate-build-output.sh
```

### Enhanced Flow (After Sprint 09)
```
scripts/build-prod.sh
  ├─ (existing steps 1-5)
  └─ Output: VSCode-darwin-arm64/RiteMark Native.app

scripts/create-dmg.sh (NEW)
  ├─ Step 1: Verify .app exists
  ├─ Step 2: Extract version from package.json
  ├─ Step 3: Run create-dmg with proper naming
  ├─ Step 4: Validate DMG created
  └─ Output: RiteMark-Native-[version]-darwin-arm64.dmg

scripts/build-and-package.sh (NEW - Optional convenience)
  ├─ Run build-prod.sh
  └─ Run create-dmg.sh
```

---

## Security & Privacy Considerations

### Unsigned DMG Implications
**Safe for:**
- Internal testing
- Beta tester distribution (documented process)
- Development/debugging
- Local network distribution

**Not suitable for:**
- Public release
- App Store distribution
- Enterprise deployment
- Users without technical guidance

### User Instructions Required
Must provide clear documentation:
1. How to bypass Gatekeeper warning
2. Why the warning appears (unsigned build)
3. Verification steps (SHA256 checksum)
4. Plan for signed releases

### Future Signing Requirements
For public release (future sprint):
- Apple Developer Program account ($99/year)
- Developer ID Application certificate
- Code signing: `codesign` command
- Notarization: Submit to Apple, wait for approval (~5-15 min)
- Stapling: Attach notarization ticket to DMG

---

## Testing Strategy

### DMG Creation Tests
1. **Build test:** Create DMG on development machine
2. **Mount test:** Double-click DMG, verify it mounts
3. **Installation test:** Drag to Applications, verify it copies
4. **Launch test:** Right-click → Open, verify app launches
5. **Subsequent launch:** Double-click app, verify it opens
6. **Unmount test:** Eject DMG, verify cleanup

### Environment Tests
- **arm64 Mac:** Primary target (MacBook Pro M1/M2/M3)
- **x64 Mac (Rosetta):** Future consideration
- **macOS versions:** Test on Ventura (13.x), Sonoma (14.x), Sequoia (15.x)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| DMG creation fails | Build succeeds but can't distribute | Validate .app before DMG step |
| Users confused by Gatekeeper | Poor first impression | Clear documentation, screenshots |
| DMG tool not installed | Build fails | Check for `create-dmg` in validation script |
| Version number incorrect | Confusing distribution | Parse from package.json automatically |
| DMG too large | Slow downloads | Already optimized - .app is ~300-400MB |

---

## Cost Analysis

### Unsigned Distribution (Sprint 09)
- **Apple Developer account:** Not required
- **Tools:** Free (create-dmg is MIT licensed)
- **Hosting:** GitHub Releases (free for public repos)
- **Total:** $0

### Signed Distribution (Future)
- **Apple Developer account:** $99/year
- **Tools:** Built into macOS (codesign, notarytool)
- **Time:** +5-15 minutes per build (notarization wait)
- **Total:** $99/year

---

## References

### Tools
- [create-dmg](https://github.com/create-dmg/create-dmg) - Recommended DMG creator
- [hdiutil man page](https://ss64.com/osx/hdiutil.html) - Native macOS disk image tool

### Guides
- [Distributing Mac Apps Outside the App Store](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
- [Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/Introduction/Introduction.html)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

### VS Code References
- VS Code uses Azure Pipelines for official builds
- Microsoft signs with their Developer ID
- VS Code OSS forks often distribute unsigned for testing

---

## Conclusion

**Recommended approach:**
1. Install `create-dmg` via Homebrew
2. Create `scripts/create-dmg.sh` script
3. Use semantic versioning from package.json
4. Distribute unsigned DMG for beta testing
5. Document Gatekeeper bypass process
6. Plan for code signing in future sprint

**Implementation effort:** Low (1-2 hours)
**Testing effort:** Medium (need to test on clean Mac)
**Documentation effort:** Medium (need user guide)

This approach provides immediate value (distributable installer) while keeping the door open for professional signed distribution in the future.
