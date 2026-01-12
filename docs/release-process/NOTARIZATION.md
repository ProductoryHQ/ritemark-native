# Apple Notarization Reference

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
xcrun stapler staple "VSCode-darwin-arm64/RiteMark.app"
```

**Validate stapling:**
```bash
xcrun stapler validate "VSCode-darwin-arm64/RiteMark.app"
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
| `branding/entitlements.plist` | Hardened runtime permissions |

## Apple Developer Account

- **Team ID:** JKBSC3ZDT5
- **Apple ID:** jarmo@productory.eu
- **Certificate:** Developer ID Application: Jarmo Tuisk (JKBSC3ZDT5)
