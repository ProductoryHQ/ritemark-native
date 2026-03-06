# v1.2.0 Release Handover

**Date:** 2026-02-02
**From:** macOS
**To:** Windows

---

## Status

| Item | Status |
|------|--------|
| macOS DMG | ✅ Notarized, tested, **APPROVED** |
| Windows build | ✅ GH Actions complete |
| Windows artifact | `ritemark-windows-x64` (run 21597966472) |
| GitHub Release | ⏳ Not created yet |

---

## Next Steps (Windows)

### 1. Download artifact

```powershell
gh run download 21597966472 --name ritemark-windows-x64
```

### 2. Test Windows build

Use `TEST-CHECKLIST.md` in this folder. Focus on:
- Flows feature works
- Editor loads correctly
- No crashes

### 3. Say "Windows approved"

### 4. Agent will:
- Run Inno Setup → create installer
- Create GitHub Release with both:
  - `Ritemark.dmg` (macOS)
  - `Ritemark-Setup.exe` (Windows)

---

## Files Ready

- macOS DMG: `/dist/RiteMark-1.2.0-darwin-arm64.dmg` (needs to be copied to Windows or uploaded separately)
- Windows ZIP: Download from GH Actions artifact

---

## Notes

Some minor bugs noted during macOS testing - will be fixed in v1.2.1 bugfix release.
