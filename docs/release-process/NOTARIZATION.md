# Apple Notarization Reference

## IMPORTANT: Notarize the DMG, NOT the .app!

**Always notarize the DMG file, not the .app bundle.** This ensures:
- Users download a file with the notarization ticket already stapled
- No Gatekeeper warnings when opening the DMG
- Offline verification works immediately

## Correct Workflow

```
1. Sign app         → ./scripts/codesign-app.sh
2. Create DMG       → ./scripts/create-dmg.sh [arm64|x64]
3. Notarize DMG     → ./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-ARCH.dmg
4. Verify           → ./scripts/verify-notarization.sh dist/Ritemark-X.Y.Z-darwin-ARCH.dmg
5. Release          → ./scripts/release-dmg.sh X.Y.Z
```

### Multi-Architecture Builds

For full releases, notarize BOTH architectures:

```bash
# Apple Silicon (M1/M2/M3)
./scripts/notarize-dmg.sh dist/Ritemark-1.3.0-darwin-arm64.dmg

# Intel Mac
./scripts/notarize-dmg.sh dist/Ritemark-1.3.0-darwin-x64.dmg
```

---

## Pre-Release Verification (MANDATORY)

**Before uploading ANY DMG to GitHub, run the verification script:**

```bash
# Apple Silicon
./scripts/verify-notarization.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg

# Intel Mac
./scripts/verify-notarization.sh dist/Ritemark-X.Y.Z-darwin-x64.dmg
```

This script MUST pass. It checks:
1. DMG file integrity
2. Code signature validity
3. Notarization status (not just Developer ID, but "Notarized Developer ID")
4. Stapled ticket presence
5. Apple server ticket confirmation
6. Hardened runtime and secure timestamp
7. Extension bundle integrity (webview.js, node_modules)

**Exit code 0 = Safe to release. Any other exit code = DO NOT release.**

### Safe Release Workflow

Use the release wrapper script (includes automatic verification):

```bash
# Dry run first (no actual upload)
./scripts/release-dmg.sh 1.2.0 --dry-run

# Actual release
./scripts/release-dmg.sh 1.2.0
```

This script:
1. Finds the versioned DMG
2. Runs verify-notarization.sh (BLOCKS if fails)
3. Creates stable Ritemark.dmg copy
4. Checks release notes exist
5. Uploads to GitHub

---

## Timeline Expectations

| Submission Type | Expected Time |
|-----------------|---------------|
| First-ever submission | 24-72 hours (Apple's initial review) |
| Subsequent submissions | Minutes to hours |
| Peak times (Monday mornings, holidays) | May be slower |

## Commands

**Check status:**
```bash
source .signing-config && xcrun notarytool info <submission-id> --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

**View all submissions:**
```bash
source .signing-config && xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

**Get failure log (if rejected):**
```bash
source .signing-config && xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

**Staple ticket to DMG:**
```bash
xcrun stapler staple "dist/Ritemark-X.Y.Z-darwin-arm64.dmg"
```

**Validate stapling:**
```bash
xcrun stapler validate "dist/Ritemark-X.Y.Z-darwin-arm64.dmg"
```

## Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `In Progress` | Apple is reviewing | Wait (check again in 15-30 min) |
| `Accepted` | SUCCESS | Proceed to stapling |
| `Invalid` | Failed validation | Get log, fix issues, resubmit |
| `Rejected` | Policy violation | Get log, fix issues, resubmit |

## Common Failures

| Issue | Cause | Fix |
|-------|-------|-----|
| Unsigned binary | Nested binary not signed | Re-run `./scripts/codesign-app.sh` |
| Missing entitlements | Hardened runtime issue | Check `branding/entitlements.plist` |
| Invalid signature | Signing error | Rebuild and re-sign |
| Missing secure timestamp | Old codesign options | Add `--timestamp` to codesign |

## Important Files

| File | Purpose |
|------|---------|
| `.signing-config` | Apple credentials (APPLE_TEAM_ID, APPLE_ID, APPLE_APP_PASSWORD) |
| `scripts/codesign-app.sh` | Signs all app components with Developer ID |
| `scripts/create-dmg.sh` | Creates and signs DMG image |
| `scripts/notarize-dmg.sh` | **Submits DMG to Apple notarization and staples ticket** |
| `scripts/verify-notarization.sh` | **Verifies DMG is properly notarized (MANDATORY before release)** |
| `scripts/release-dmg.sh` | **Safe release wrapper with automatic verification** |
| `branding/entitlements.plist` | Hardened runtime permissions |

### Deprecated

| File | Status |
|------|--------|
| `scripts/notarize-app.sh` | **DEPRECATED** - use `notarize-dmg.sh` instead |

## Apple Developer Account

- **Team ID:** JKBSC3ZDT5
- **Apple ID:** jarmo@productory.eu
- **Certificate:** Developer ID Application: Jarmo Tuisk (JKBSC3ZDT5)

## Release Checklist

Before any GitHub release (for EACH architecture):

- [ ] App is code-signed: `./scripts/codesign-app.sh`
- [ ] DMG is created: `./scripts/create-dmg.sh [arm64|x64]`
- [ ] **DMG is notarized: `./scripts/notarize-dmg.sh dist/Ritemark-X.Y.Z-darwin-ARCH.dmg`**
- [ ] **Verification passes: `./scripts/verify-notarization.sh dist/Ritemark-X.Y.Z-darwin-ARCH.dmg`**
- [ ] Release notes exist: `docs/releases/vX.Y.Z.md`
- [ ] Upload to GitHub: `./scripts/release-dmg.sh X.Y.Z`
