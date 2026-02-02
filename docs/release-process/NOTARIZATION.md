# Apple Notarization Reference

## Pre-Release Verification (MANDATORY)

**Before uploading ANY DMG to GitHub, run the verification script:**

```bash
./scripts/verify-notarization.sh dist/Ritemark-X.Y.Z-darwin-arm64.dmg
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

**Staple after acceptance:**
```bash
xcrun stapler staple "VSCode-darwin-arm64/Ritemark.app"
```

**Validate stapling:**
```bash
xcrun stapler validate "VSCode-darwin-arm64/Ritemark.app"
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
| `scripts/notarize-app.sh` | Submits app to Apple notarization |
| `scripts/create-dmg.sh` | Creates distributable DMG image |
| `scripts/verify-notarization.sh` | **Verifies DMG is properly notarized (MANDATORY before release)** |
| `scripts/release-dmg.sh` | **Safe release wrapper with automatic verification** |
| `branding/entitlements.plist` | Hardened runtime permissions |

## Apple Developer Account

- **Team ID:** JKBSC3ZDT5
- **Apple ID:** jarmo@productory.eu
- **Certificate:** Developer ID Application: Jarmo Tuisk (JKBSC3ZDT5)

## Release Checklist

Before any GitHub release:

- [ ] App is code-signed: `./scripts/codesign-app.sh`
- [ ] App is notarized: `./scripts/notarize-app.sh`
- [ ] Ticket is stapled: `xcrun stapler staple "VSCode-darwin-arm64/Ritemark.app"`
- [ ] DMG is created: `./scripts/create-dmg.sh`
- [ ] **Verification passes: `./scripts/verify-notarization.sh`**
- [ ] Release notes exist: `docs/releases/vX.Y.Z.md`
- [ ] Upload to GitHub: `./scripts/release-dmg.sh X.Y.Z`
