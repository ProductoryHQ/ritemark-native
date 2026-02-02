# Update Flow Comparison: Current vs Proposed

This document visualizes the difference between current (full DMG) and proposed (lightweight extension) update flows.

---

## Current System (Sprint 16)

**Every update requires full DMG download:**

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER TIMELINE                            │
└──────────────────────────────────────────────────────────────────┘

 0:00  User opens Ritemark
       │
       ├─ (10 sec delay)
       │
 0:10  Notification: "New version available"
       │
       ├─ User clicks "Install Now"
       │
 0:15  Browser opens GitHub release page
       │
       ├─ DMG download starts (500 MB)
       │
       ├─ ████████░░░░░░░░░░░░ (2-10 minutes)
       │
 5:00  DMG downloaded
       │
       ├─ User opens DMG
       │
       ├─ User drags Ritemark to Applications
       │
       ├─ macOS replaces old app
       │
       ├─ User quits current Ritemark
       │
       ├─ User opens new Ritemark
       │
 6:00  Update complete

┌─────────────────────────────────────────────────────────────────┐
│ TOTAL TIME: 5-15 minutes                                        │
│ USER EFFORT: 5 manual steps                                     │
│ DOWNLOAD: 500 MB (entire app)                                   │
│ INTERRUPTION: Must quit and restart app                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Proposed System: Extension-Only Update

**Small updates download only changed files:**

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER TIMELINE                            │
└──────────────────────────────────────────────────────────────────┘

 0:00  User opens Ritemark
       │
       ├─ (10 sec delay)
       │
 0:10  Notification: "Extension update available (1 MB)"
       │
       ├─ User clicks "Install Now"
       │
 0:11  Progress: "Downloading... 45%"
       │
       ├─ Downloads 3 files (~1 MB)
       │
       ├─ Verifies checksums
       │
       ├─ Writes files to app bundle
       │
 0:15  Notification: "✅ Update installed successfully [Reload Window]"
       │
       ├─ User clicks "Reload Window"
       │
       ├─ VS Code reloads (3 seconds)
       │
 0:18  Update complete, new features active

┌─────────────────────────────────────────────────────────────────┐
│ TOTAL TIME: <20 seconds                                         │
│ USER EFFORT: 2 clicks (Install + Reload)                        │
│ DOWNLOAD: 1 MB (extension only)                                 │
│ INTERRUPTION: Minimal (3 sec reload, no data loss)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Proposed System: Full App Update

**Major updates still use DMG (identical to current):**

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER TIMELINE                            │
└──────────────────────────────────────────────────────────────────┘

 0:00  User opens Ritemark
       │
       ├─ (10 sec delay)
       │
 0:10  Notification: "New version available"
       │
       ├─ User clicks "Install Now"
       │
 0:15  Browser opens GitHub release page
       │
       ├─ (Same as current system)
       │
 6:00  Update complete

┌─────────────────────────────────────────────────────────────────┐
│ SAME AS CURRENT SYSTEM                                          │
│ Used when VS Code base or patches change                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Decision Tree: Which Update Type?

```
                 New version available
                        │
                        ▼
              Fetch update-manifest.json
                        │
                        ▼
              Compare base versions
               (strip "-ext.X" suffix)
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
    Base changed?               Base same?
    (1.0.1 → 1.1.0)            (1.0.1 → 1.0.1)
          │                           │
          ▼                           ▼
    FULL UPDATE                 EXTENSION UPDATE
    ├─ Open DMG URL            ├─ Download files
    └─ Manual install          ├─ Verify checksums
                               ├─ Write in-place
                               └─ Reload window
```

---

## File Changes by Update Type

### Extension-Only Update
```
VSCode-darwin-arm64/Ritemark.app/Contents/Resources/app/
├── extensions/
│   └── ritemark/                    ← UPDATED
│       ├── out/
│       │   ├── extension.js         ← Changed
│       │   └── ritemarkEditor.js    ← Changed
│       ├── media/
│       │   └── webview.js           ← Changed (900KB)
│       └── package.json             ← Changed (version bump)
├── out/vs/                          ← Unchanged
│   └── (VS Code core)
└── product.json                     ← Unchanged
```

### Full App Update
```
VSCode-darwin-arm64/Ritemark.app/
└── Contents/
    ├── MacOS/
    │   └── Electron                 ← May change
    └── Resources/
        └── app/
            ├── extensions/          ← All change
            ├── out/vs/              ← All change
            └── product.json         ← May change
```

---

## Safety Mechanism: Atomic Update with Rollback

```
BEFORE UPDATE:
extensions/ritemark/
├── out/extension.js (version 1.0.1)
└── media/webview.js (version 1.0.1)

↓ Step 1: Create backup
/temp/extension-backup/
├── out/extension.js (backup)
└── media/webview.js (backup)

↓ Step 2: Download new files to temp
/temp/extension-update/
├── out/extension.js (version 1.0.1-ext.5)
└── media/webview.js (version 1.0.1-ext.5)

↓ Step 3: Verify checksums
✅ extension.js: abc123... matches manifest
✅ webview.js: def456... matches manifest

↓ Step 4: Write files
extensions/ritemark/
├── out/extension.js (version 1.0.1-ext.5) ✅ Updated
└── media/webview.js (version 1.0.1-ext.5) ✅ Updated

↓ Step 5: User reloads window
✅ Extension loads successfully

↓ Step 6: Delete backup
/temp/extension-backup/ (deleted)

AFTER UPDATE:
extensions/ritemark/
├── out/extension.js (version 1.0.1-ext.5)
└── media/webview.js (version 1.0.1-ext.5)
```

---

## Error Recovery: Rollback Scenario

```
SCENARIO: Network fails during download

↓ Step 1: Create backup
/temp/extension-backup/ ✅ Created

↓ Step 2: Download new files
/temp/extension-update/
├── out/extension.js ✅ Downloaded
└── media/webview.js ❌ Failed (network timeout)

↓ Step 3: Error detected, trigger rollback
❌ Download failed
→  Do NOT write any files
→  Do NOT delete backup
→  Restore from backup (no-op, nothing changed)

↓ Step 4: Show error notification
┌─────────────────────────────────────────────────┐
│ ⚠️ Update failed: Network error                 │
│                                [Try Again Later] │
└─────────────────────────────────────────────────┘

RESULT:
extensions/ritemark/
├── out/extension.js (version 1.0.1) ← Unchanged
└── media/webview.js (version 1.0.1) ← Unchanged

✅ No data loss
✅ App still functional
✅ User can retry later
```

---

## Comparison Table

| Aspect | Current (DMG) | Extension Update | Full Update (New) |
|--------|---------------|------------------|-------------------|
| **Download size** | 500 MB | 1 MB | 500 MB |
| **Download time** | 2-10 min | 2-5 sec | 2-10 min |
| **Install time** | Manual | 2 sec | Manual |
| **User steps** | 5 clicks | 2 clicks | 5 clicks |
| **Interruption** | Quit + Restart | Reload window | Quit + Restart |
| **Data loss risk** | None | None | None |
| **Rollback** | Manual | Automatic | Manual |
| **Works offline** | No | No | No |
| **Requires restart** | Yes | No (reload) | Yes |

---

## Version Progression Examples

### Scenario 1: Bug Fix (Extension-Only)
```
Current:  1.0.1
Issue:    CSV export has formatting bug
Fix:      Modify export/csvExporter.ts
Build:    Compile to out/export/csvExporter.js
Release:  1.0.1-ext.1 (extension-only)
Update:   Lightweight (1 MB, <10 sec)
```

### Scenario 2: Webview Feature (Extension-Only)
```
Current:  1.0.1-ext.1
Feature:  Add syntax highlighting to code blocks
Change:   Update webview/App.tsx, rebuild webview.js
Release:  1.0.1-ext.2 (extension-only)
Update:   Lightweight (1 MB, <10 sec)
```

### Scenario 3: VS Code Patch (Full Update)
```
Current:  1.0.1-ext.5
Change:   Add new patch to change menu item
Release:  1.0.2 (full update, extension resets)
Update:   Full DMG (500 MB, 5-15 min)
```

### Scenario 4: Major Release (Full Update)
```
Current:  1.0.2
Feature:  Upgrade VS Code base to 1.95.0
Release:  1.1.0 (full update)
Update:   Full DMG (500 MB, 5-15 min)
```

---

## Network Traffic Analysis

### Current System (Every Update)
```
Startup check:
  └─ GitHub API: /releases/latest
     ├─ Size: ~2 KB
     └─ Frequency: Once per app launch

User clicks "Install Now":
  └─ Browser downloads DMG
     ├─ Size: ~500 MB
     └─ Time: 2-10 minutes

TOTAL: ~500 MB per update
```

### New System (Extension Update)
```
Startup check:
  └─ GitHub API: /releases/latest
     ├─ Size: ~2 KB
     └─ Frequency: Once per app launch

Fetch manifest:
  └─ GitHub CDN: /download/v1.0.1-ext.5/update-manifest.json
     ├─ Size: ~2 KB
     └─ Not counted against API rate limit

User clicks "Install Now":
  └─ Download extension files
     ├─ extension.js: ~50 KB
     ├─ webview.js: ~900 KB
     └─ package.json: ~2 KB
     ├─ Time: 2-5 seconds
     └─ TOTAL: ~1 MB

TOTAL: ~1 MB per extension update (500x smaller!)
```

---

## Release Process Changes

### Current Release Process
```
1. Bump version in branding/product.json (e.g., 1.0.1 → 1.0.2)
2. Run ./scripts/build-prod.sh
3. Create DMG with ./scripts/create-dmg.sh
4. Upload DMG to GitHub release
5. Tag release (e.g., v1.0.2)
```

### New Release Process: Extension-Only
```
1. Make changes to extensions/ritemark/
2. Bump version in package.json (e.g., 1.0.1 → 1.0.1-ext.1)
3. Compile: yarn compile in extensions/ritemark/
4. Build webview: yarn build in extensions/ritemark/webview/
5. Run script: ./scripts/create-extension-release.sh
   ├─ Copies: out/, media/, package.json
   ├─ Computes SHA-256 for each file
   ├─ Generates update-manifest.json
   └─ Creates .zip with all files
6. Upload to GitHub release:
   ├─ update-manifest.json
   ├─ extension.js, ritemarkEditor.js, etc.
   ├─ webview.js, webview.js.map
   └─ package.json
7. Tag release (e.g., v1.0.1-ext.1)
```

### New Release Process: Full Update
```
1. Same as current process
2. Version format: 1.1.0 (no -ext suffix)
3. Manifest type: "full"
```

---

*Comparison created: 2026-01-12*
