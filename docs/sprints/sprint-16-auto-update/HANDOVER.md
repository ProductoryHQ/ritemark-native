# Handover: Code Signing & Notarization

**Date:** 2026-01-12
**Status:** Waiting for Apple Notarization

---

## Current State Summary

Ritemark v1.0.1 has been:
- ✅ Built (production build completed)
- ✅ Signed (Developer ID Application certificate)
- ⏳ Submitted for notarization (waiting for Apple)
- ⏳ DMG creation (blocked on notarization)
- ⏳ GitHub release upload (blocked on DMG)

---

## Active Notarization Submission

```
Submission ID: a8e1af43-4716-40ca-b2b8-8e433f9d87ad
Submitted:     2026-01-12T09:38:28.241Z
Status:        In Progress (as of last check)
```

### Check Status Command

```bash
cd /Users/jarmotuisk/Projects/ritemark-native
source .signing-config && xcrun notarytool info a8e1af43-4716-40ca-b2b8-8e433f9d87ad --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

### Expected Status Values
- `In Progress` - Still processing (wait more)
- `Accepted` - SUCCESS! Proceed to stapling
- `Invalid` - Failed, check log for details
- `Rejected` - Failed, check log for details

---

## When Notarization Completes

### If Status = "Accepted"

1. **Staple the notarization ticket to the app:**
   ```bash
   xcrun stapler staple "VSCode-darwin-arm64/Ritemark.app"
   ```

2. **Verify stapling worked:**
   ```bash
   xcrun stapler validate "VSCode-darwin-arm64/Ritemark.app"
   ```

3. **Create the DMG:**
   ```bash
   ./scripts/create-dmg.sh
   ```

4. **Test the DMG:**
   - Copy DMG to Downloads folder
   - Double-click to mount
   - Drag Ritemark to Applications
   - Launch - should NOT show "damaged" warning
   - Verify version shows 1.0.1 in About

5. **Upload to GitHub:**
   - Go to https://github.com/jarmo-productory/ritemark-public/releases
   - Edit v1.0.1 release (or create new)
   - Upload the signed/notarized DMG
   - Update release notes

### If Status = "Invalid" or "Rejected"

1. **Get the detailed log:**
   ```bash
   source .signing-config && xcrun notarytool log a8e1af43-4716-40ca-b2b8-8e433f9d87ad --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$APPLE_TEAM_ID"
   ```

2. **Common issues and fixes:**
   - Unsigned binaries → Re-run `./scripts/codesign-app.sh`
   - Missing entitlements → Check `branding/entitlements.plist`
   - Invalid signature → Rebuild and re-sign

3. **Resubmit after fixing:**
   ```bash
   ./scripts/notarize-app.sh
   ```

---

## Important Files

| File | Purpose |
|------|---------|
| `.signing-config` | Apple credentials (APPLE_TEAM_ID, APPLE_ID, APPLE_APP_PASSWORD) |
| `scripts/codesign-app.sh` | Signs all app components |
| `scripts/notarize-app.sh` | Submits to Apple notarization |
| `scripts/create-dmg.sh` | Creates distributable DMG |
| `branding/entitlements.plist` | Hardened runtime permissions |
| `VSCode-darwin-arm64/Ritemark.app` | The signed app bundle |

---

## Apple Developer Account Details

- **Team ID:** JKBSC3ZDT5
- **Apple ID:** jarmo@productory.eu
- **Certificate:** Developer ID Application: Jarmo Tuisk (JKBSC3ZDT5)
- **App-specific password:** Stored in `.signing-config` as APPLE_APP_PASSWORD

---

## Known Issues

### Notarization Taking Very Long (Current Issue)

First-time notarizations from new developer accounts can take 24-72 hours. This is a known Apple issue in January 2026. See:
- https://developer.apple.com/forums/thread/809018
- https://developer.apple.com/forums/thread/811968

After the first successful notarization, subsequent submissions typically complete in minutes.

### Previous Failed Submissions

These older submissions failed with "Invalid" due to unsigned nested binaries (before codesign script was fixed):
- `d21e26b9-9f24-4fa8-8dd6-b78f95ea33bf` (Invalid)
- `b5d4ccc1-e11f-4bd4-b0c2-f196b8a9f40c` (Invalid)

The first submission `88630781-abdf-4c95-aa13-a85e2de14f34` was also stuck for hours and may still be processing.

---

## Build Details

- **App Location:** `VSCode-darwin-arm64/Ritemark.app`
- **Version:** 1.0.1 (check: `cat VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/product.json | grep ritemarkVersion`)
- **Architecture:** arm64 (Apple Silicon)
- **Build Date:** 2026-01-12

---

## Quick Reference Commands

```bash
# Check notarization status
source .signing-config && xcrun notarytool info a8e1af43-4716-40ca-b2b8-8e433f9d87ad --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$APPLE_TEAM_ID"

# View all submissions
source .signing-config && xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_PASSWORD" --team-id "$APPLE_TEAM_ID"

# Staple after acceptance
xcrun stapler staple "VSCode-darwin-arm64/Ritemark.app"

# Verify app signature
codesign --verify --deep --strict "VSCode-darwin-arm64/Ritemark.app"

# Check signing identity
codesign -dvvv "VSCode-darwin-arm64/Ritemark.app" 2>&1 | grep Authority
```

---

## Next Session Checklist

1. [ ] Check notarization status (command above)
2. [ ] If Accepted: Staple, create DMG, test, upload to GitHub
3. [ ] If still In Progress: Wait or contact Apple Support
4. [ ] If Invalid/Rejected: Get log, fix issues, resubmit
5. [ ] After successful release: Commit the signing scripts to git

---

**Last updated:** 2026-01-12 ~10:30 UTC
