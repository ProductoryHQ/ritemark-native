# Sprint 20: Lightweight Extension-Only Updates

**Status:** Planning Phase (awaiting approval)
**Created:** 2026-01-12
**Sprint Type:** Enhancement

---

## Quick Summary

Enable fast in-place updates for extension-only changes (webview, TypeScript code) without downloading the full 500MB DMG. Updates complete in <10 seconds vs 5-15 minutes.

**Key Benefit:** When only `extensions/ritemark/` files change, download ~1MB and replace files directly instead of downloading entire app.

---

## Problem Statement

Currently, any change to Ritemark (even a one-line webview fix) requires:
1. Downloading 500MB DMG from GitHub
2. Manual drag-to-Applications
3. 5-15 minute process

This is overkill when only the extension changed (~1MB of files), not the VS Code base (~500MB).

---

## Proposed Solution

**Dual Update System:**

```
┌─────────────────────────────────────┬────────────────────────────┐
│ Extension-Only Update               │ Full App Update            │
├─────────────────────────────────────┼────────────────────────────┤
│ What:  Extension files changed      │ What:  VS Code or patches  │
│ Size:  ~1 MB                        │ Size:  ~500 MB             │
│ Time:  <10 seconds                  │ Time:  5-15 minutes        │
│ How:   Download + replace in-place  │ How:   Download DMG        │
│ User:  Click "Install" + Reload     │ User:  Manual drag to Apps │
└─────────────────────────────────────┴────────────────────────────┘
```

---

## Version Strategy

**New format:**
```
1.0.1           ← App version (VS Code base + patches)
1.0.1-ext.5     ← Extension version (extension code)
```

**Examples:**
- `1.0.1` → `1.0.1-ext.1` = Extension-only (CSV fix)
- `1.0.1-ext.5` → `1.0.1-ext.6` = Extension-only (webview update)
- `1.0.1-ext.5` → `1.1.0` = Full app update

---

## Files Included

**Extension-only updates can change:**
```
extensions/ritemark/
├── out/              ← Compiled TypeScript (~50KB)
├── media/            ← Webview bundle (~900KB)
└── package.json      ← Version, configuration
```

**Full updates required for:**
- VS Code core changes
- Patch files
- Electron framework
- Branding assets

---

## Technical Approach

### 1. Update Manifest

Each release includes `update-manifest.json`:
```json
{
  "version": "1.0.1-ext.5",
  "type": "extension",
  "files": [
    {
      "path": "extensions/ritemark/out/extension.js",
      "url": "https://github.com/.../extension.js",
      "sha256": "abc123...",
      "size": 45678
    }
  ],
  "releaseNotes": "Fixed CSV bug"
}
```

### 2. Update Flow

```
1. Check for updates (existing)
2. Fetch update-manifest.json
3. Determine type: extension vs full
4. IF extension:
   ├─ Backup current files
   ├─ Download new files
   ├─ Verify SHA-256 checksums
   ├─ Write to app bundle
   ├─ Prompt "Reload Window"
   └─ Delete backup on success
5. IF full:
   └─ Open DMG in browser (existing flow)
```

### 3. Safety Features

- **Atomic updates:** Backup first, rollback on any error
- **Checksum verification:** SHA-256 for every file
- **Write permission check:** Fall back to DMG if read-only
- **Crash recovery:** Restore backup on next startup if incomplete
- **Retry logic:** 3 attempts with exponential backoff

---

## User Experience

**Extension Update Notification:**
```
┌────────────────────────────────────────────────────┐
│ 📦 Extension update available (1 MB)               │
│                                                    │
│ New: CSV performance improvements                  │
│                              [Later] [Install Now] │
└────────────────────────────────────────────────────┘
```

**Progress:**
```
┌────────────────────────────────────────────────────┐
│ Downloading update... 45%                          │
│ [██████████░░░░░░░░░░]                             │
└────────────────────────────────────────────────────┘
```

**Success:**
```
┌────────────────────────────────────────────────────┐
│ ✅ Update installed successfully                   │
│                                     [Reload Window] │
└────────────────────────────────────────────────────┘
```

---

## Documents

| Document | Description |
|----------|-------------|
| [sprint-plan.md](./sprint-plan.md) | Complete implementation plan with checklist |
| [research/feasibility-analysis.md](./research/feasibility-analysis.md) | Technical analysis and risk assessment |

---

## Key Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| **Version format** | `{app}-ext.{build}` | Clear separation, sortable |
| **Manifest format** | JSON in GitHub release | Simple, trusted source |
| **Backup strategy** | Copy before write | Atomic, rollback on failure |
| **Checksum** | SHA-256 | Industry standard |
| **Fallback** | DMG if write fails | Always have working path |

---

## Risks

| Risk | Mitigation |
|------|------------|
| App bundle read-only (signed) | Check permissions first, fall back to DMG |
| Partial download/write | Atomic operations with rollback |
| User force-quit during update | Detect on startup, restore backup |
| Corrupted files | SHA-256 verification before commit |

---

## Success Metrics

- [ ] 95%+ users choose lightweight update when available
- [ ] <10 second average update time (vs 5-15 min currently)
- [ ] <1% rollback rate due to errors
- [ ] Zero corrupted installations
- [ ] 500x reduction in download size (1 MB vs 500 MB)

---

## Status

**Phase:** 1 (Research & Planning)
**Next:** Awaiting approval from Jarmo
**Blocked:** Cannot proceed to implementation without approval

---

## Approval Checklist

Before approving, verify:
- [ ] Version strategy makes sense (dual versioning)
- [ ] Update manifest format is clear
- [ ] Security considerations addressed (checksums)
- [ ] Rollback safety plan is solid
- [ ] User experience is clear and simple
- [ ] Risks are acceptable and mitigated

---

*Created: 2026-01-12*
*Sprint Manager: Claude*
