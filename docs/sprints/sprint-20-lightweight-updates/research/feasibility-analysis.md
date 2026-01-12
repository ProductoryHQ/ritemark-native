# Sprint 20: Feasibility Analysis - Lightweight Updates

**Date:** 2026-01-12
**Status:** Research Phase Complete

---

## Executive Summary

**Verdict:** ✅ FEASIBLE with careful implementation

Extension-only updates are technically possible and offer massive UX improvements (500x smaller downloads, <10 second install vs 5-15 minutes). Key challenges are write permissions on signed apps and atomic rollback safety.

---

## Critical Questions & Answers

### 1. Can we write to app bundle files after installation?

**Question:** macOS apps are typically signed and sealed. Can we modify files inside `RiteMark.app/Contents/Resources/app/extensions/ritemark/`?

**Investigation:**

**Unsigned apps (current):**
- ✅ Full write access to all files in app bundle
- No code signature to invalidate
- File modifications work immediately

**Signed apps (future):**
- ⚠️ Code signature covers entire app bundle
- Modifying any file invalidates signature
- Gatekeeper may refuse to launch modified app
- **Mitigation:** For signed apps, fall back to DMG update flow

**Test Plan:**
```bash
# Check if current build is signed
codesign -dv VSCode-darwin-arm64/RiteMark.app

# Test write permissions
touch VSCode-darwin-arm64/RiteMark.app/Contents/Resources/app/extensions/ritemark/test.txt
```

**Recommendation:** Implement write permission check before attempting update. If write fails, show "Full update required" message.

---

### 2. How do we ensure atomic updates (no half-updated state)?

**Problem:** If app crashes mid-update, extension could be corrupted.

**Solution: Backup-Write-Verify-Commit Pattern**

```
1. Check available disk space (needs 2x extension size)
2. Create backup in temp directory
3. Download all files to temp directory
4. Verify ALL checksums
5. Copy all files to extension directory (atomic)
6. Test extension loads (reload window)
7. Delete backup on success
8. Keep backup if any step fails
```

**Crash Safety:**
- On next startup, detect incomplete update (backup exists)
- Automatically restore from backup
- Show notification: "Previous update failed, restored backup"

**Key Insight:** Never delete backup until user successfully reloads and extension loads.

---

### 3. What happens if user force-quits during download?

**Scenarios:**

| Timing | State | Recovery |
|--------|-------|----------|
| During download | Partial files in temp, backup exists | Cleanup temp files on next startup |
| After backup, before write | Old files intact, backup exists | Delete backup, no harm done |
| During write | Files half-copied, backup exists | Restore from backup on startup |
| After write, before delete backup | New files written, backup exists | Delete backup on next startup, mark as complete |

**Implementation:**
```typescript
// On extension activation
async function checkRecovery() {
  const backupExists = await fs.pathExists(backupDir);
  const updateInProgress = await storage.get('updateInProgress');

  if (backupExists && updateInProgress) {
    // Incomplete update detected
    await restoreBackup();
    await storage.set('updateInProgress', false);
    showNotification('Previous update failed, restored backup');
  }
}
```

---

### 4. How do we detect extension vs app updates?

**Current System:**
- Single version in `package.json`: `1.0.1`
- No way to distinguish extension-only changes

**Proposed System:**
- App version in `branding/product.json`: `1.0.1`
- Extension version in `package.json`: `1.0.1-ext.5`

**Detection Logic:**
```typescript
function getUpdateType(current: string, latest: string): 'full' | 'extension' {
  // Examples:
  // current: "1.0.1",       latest: "1.0.1-ext.5"  → extension
  // current: "1.0.1-ext.5", latest: "1.0.1-ext.6"  → extension
  // current: "1.0.1-ext.5", latest: "1.1.0"        → full
  // current: "1.0.1",       latest: "1.1.0"        → full

  const currentBase = current.split('-ext.')[0];
  const latestBase = latest.split('-ext.')[0];

  return currentBase === latestBase ? 'extension' : 'full';
}
```

**Version Progression:**
```
1.0.0           → Initial release
1.0.0-ext.1     → Fix webview bug (extension-only)
1.0.0-ext.2     → Add CSV export (extension-only)
1.0.1           → Patch VS Code (full update, resets extension)
1.0.1-ext.1     → New feature (extension-only)
1.1.0           → Major release (full update)
```

---

### 5. What about GitHub API rate limits?

**Current System (Sprint 16):**
- Fetches `/releases/latest` (1 API call per startup)
- Rate limit: 60 requests/hour (unauthenticated)
- Typical usage: 1 request every 4 hours (user restarts app)

**New System:**
- `/releases/latest` (1 call) - get tag name
- `/releases/download/v1.0.1-ext.5/update-manifest.json` (not counted against API)
- Individual file downloads (not counted against API)

**Impact:** No change to API usage. Manifest and files are served via CDN, not API.

---

### 6. How large will update manifests be?

**Typical manifest:**
```json
{
  "version": "1.0.1-ext.5",
  "type": "extension",
  "files": [
    {"path": "out/extension.js", "url": "...", "sha256": "...", "size": 45678},
    {"path": "media/webview.js", "url": "...", "sha256": "...", "size": 900000},
    {"path": "package.json", "url": "...", "sha256": "...", "size": 2048}
  ]
}
```

**Size:** ~1-2 KB (negligible)

**Largest expected file list:**
- ~20 files in `out/` directory
- 1-2 files in `media/`
- 1 `package.json`

**Manifest max size:** ~5 KB

---

### 7. What if download is interrupted?

**Scenario:** User loses network during file download.

**Current Implementation:** Browser download resumes automatically (DMG).

**New Implementation:**
- Node.js `fetch()` doesn't support resume
- **Solution:** Retry mechanism (3 attempts)
- **Fallback:** If all retries fail, show "Update failed, try again later"

**Retry Logic:**
```typescript
async function downloadWithRetry(url: string, maxRetries = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url).then(r => r.arrayBuffer()).then(Buffer.from);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(2000 * attempt); // Exponential backoff
    }
  }
}
```

---

### 8. How do we test this safely?

**Testing Strategy:**

1. **Dev Mode Testing:**
   - Run in `yarn watch` mode
   - Extension files in `extensions/ritemark/`
   - Test write/backup/restore locally

2. **Production Build Testing:**
   - Create fake release with test manifest
   - Point to local HTTP server
   - Verify file paths resolve correctly

3. **Rollback Testing:**
   - Inject deliberate checksum mismatch
   - Force crash during write
   - Verify backup restored correctly

4. **Permission Testing:**
   - Test on read-only volume
   - Test with restricted user account
   - Verify fallback to DMG works

**Safety Net:** Add feature flag in settings:
```json
"ritemark.updates.lightweightEnabled": {
  "type": "boolean",
  "default": false,
  "description": "Enable experimental lightweight updates"
}
```

Enable only after thorough testing.

---

## Architecture Analysis

### Existing Update Flow (Sprint 16)
```
User opens RiteMark
  ↓
(10 second delay)
  ↓
UpdateService.checkAndNotify()
  ↓
Fetch GitHub /releases/latest
  ↓
Compare versions
  ↓
Show notification
  ↓
User clicks "Install Now"
  ↓
Open DMG URL in browser
  ↓
[Manual] User drags to Applications
```

### New Update Flow (Sprint 20)
```
User opens RiteMark
  ↓
(10 second delay)
  ↓
UpdateService.checkAndNotify()
  ↓
Fetch GitHub /releases/latest
  ↓
Fetch update-manifest.json
  ↓
Determine update type (extension vs full)
  ↓
┌─────────────────────────────────────┬──────────────────────────────┐
│ Extension Update                    │ Full Update                  │
├─────────────────────────────────────┼──────────────────────────────┤
│ Show "Extension update (1MB)"       │ Show "New version available" │
│   ↓                                 │   ↓                          │
│ User clicks "Install Now"           │ User clicks "Install Now"    │
│   ↓                                 │   ↓                          │
│ LightweightUpdater.applyUpdate()    │ Open DMG in browser          │
│   ↓                                 │   ↓                          │
│ 1. Create backup                    │ [Manual] Drag to Apps        │
│ 2. Download files                   │                              │
│ 3. Verify checksums                 │                              │
│ 4. Write files                      │                              │
│ 5. Delete backup                    │                              │
│ 6. Prompt "Reload Window"           │                              │
│   ↓                                 │                              │
│ User reloads                        │                              │
│   ↓                                 │                              │
│ Extension loads new code            │                              │
└─────────────────────────────────────┴──────────────────────────────┘
```

---

## File System Mapping

### Development Environment
```
ritemark-native/
├── extensions/ritemark/           ← Source (edit here)
│   ├── src/
│   ├── out/                      ← Compiled (writable)
│   ├── media/                    ← Webview bundle (writable)
│   └── package.json
└── vscode/
    └── extensions/ritemark/       ← Symlink to above
```

**Update target in dev:** `extensions/ritemark/` (writable, version controlled)

### Production Environment
```
VSCode-darwin-arm64/
└── RiteMark.app/
    └── Contents/
        ├── MacOS/
        │   └── Electron                        ← Cannot update
        └── Resources/
            └── app/
                ├── out/vs/                     ← VS Code core (cannot update)
                └── extensions/
                    └── ritemark/               ← UPDATE TARGET
                        ├── out/                ← Update these
                        ├── media/              ← Update these
                        └── package.json        ← Update this
```

**Update target in prod:** `VSCode-darwin-arm64/RiteMark.app/Contents/Resources/app/extensions/ritemark/`

**Critical Path Resolution:**
```typescript
function getExtensionDirectory(): string {
  // vscode.env.appRoot points to:
  // Dev:  /path/to/ritemark-native/vscode/out
  // Prod: /path/to/RiteMark.app/Contents/Resources/app

  const appRoot = vscode.env.appRoot;

  // Prod: /path/to/RiteMark.app/Contents/Resources/app
  // → /path/to/RiteMark.app/Contents/Resources/app/extensions/ritemark
  return path.join(appRoot, 'extensions', 'ritemark');
}
```

---

## Security Analysis

### Threat Model

| Threat | Attack Vector | Mitigation |
|--------|---------------|------------|
| **Man-in-the-middle** | Attacker replaces files during download | SHA-256 checksum verification |
| **Compromised GitHub** | Attacker uploads malicious manifest | Trust GitHub's infrastructure + HTTPS |
| **Local privilege escalation** | Attacker modifies backup directory | Use app-scoped temp directory |
| **Downgrade attack** | Attacker forces old version with vulnerabilities | Only allow upgrades, never downgrades |
| **Partial update** | Network interruption, partial files | Atomic write, rollback on any error |

### Checksum Implementation

**Why SHA-256:**
- Industry standard for file integrity
- Fast to compute (~300 MB/s on modern hardware)
- 256-bit output = 64 hex characters
- Collision-resistant (no known collisions)

**Implementation:**
```typescript
import * as crypto from 'crypto';

async function verifySHA256(filePath: string, expectedHash: string): Promise<boolean> {
  const buffer = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  const computed = hash.digest('hex');

  return computed.toLowerCase() === expectedHash.toLowerCase();
}
```

**Manifest Integrity:**
- Manifest itself is fetched over HTTPS (GitHub CDN)
- No separate signature needed (trust HTTPS + GitHub)
- Future: GPG-sign manifests for extra security

---

## Performance Projections

### Download Size Comparison

| File | Size | Included In |
|------|------|-------------|
| **Extension files (total)** | ~1 MB | Extension update |
| VS Code base | 300 MB | Full update only |
| Electron framework | 150 MB | Full update only |
| Node modules | 50 MB | Full update only |
| **DMG total** | ~500 MB | Full update only |

**Savings:** 500x smaller for typical extension updates

### Time Estimates

| Operation | Extension Update | Full DMG |
|-----------|------------------|----------|
| Download | 2-5 sec | 2-10 min |
| Verify | 0.5 sec | N/A |
| Backup | 0.5 sec | N/A |
| Write | 0.5 sec | N/A |
| User reload | 3 sec | Manual restart |
| **Total** | **<10 sec** | **5-15 min** |

**Assumptions:**
- 10 Mbps connection (1.25 MB/s)
- 1 MB extension = 0.8 seconds download
- Overhead (backup, verify, write) = 1.5 seconds
- User interaction (click "Reload") = 3 seconds

---

## Risks & Open Questions

### High-Priority Risks

| Risk | Severity | Mitigation Status |
|------|----------|-------------------|
| **Write permission denied on signed app** | HIGH | ✅ Check permissions first, fallback to DMG |
| **Corrupted backup directory** | MEDIUM | ✅ Verify backup after creation |
| **Node.js fetch doesn't resume** | MEDIUM | ✅ Retry with exponential backoff |
| **User force-quits during write** | MEDIUM | ✅ Detect on startup, restore backup |

### Open Questions (Needs Testing)

1. **Does VS Code cache extension code?**
   - If yes, reload window may not load new code
   - **Test:** Modify extension.js, reload, check if changes apply

2. **What if extension fails to load after update?**
   - Does VS Code show error?
   - Can we detect and auto-rollback?
   - **Test:** Inject syntax error, reload, observe behavior

3. **Can we detect available disk space?**
   - Need 2x extension size for backup
   - **Test:** Node.js `os.freemem()` vs actual disk space

4. **Does macOS quarantine downloaded files?**
   - Gatekeeper may block files downloaded via Node.js
   - **Test:** Download test file, check extended attributes

---

## Recommendation

**Proceed with Sprint 20** with following safeguards:

1. **Feature Flag:** Default disabled, enable after testing
2. **Fallback Path:** Always offer "Download Full Update" option
3. **Write Check:** Test permissions before showing lightweight option
4. **Extensive Testing:** Test all rollback scenarios before production
5. **User Communication:** Clear messaging about what's being updated

**Success Metrics:**
- 95%+ users prefer lightweight updates (measured by click rate)
- <1% rollback rate due to errors
- <10 second average update time
- Zero reports of corrupted installations

---

## Next Steps (Phase 2)

1. Implement `LightweightUpdater` class
2. Create test manifest.json
3. Test write permissions on production build
4. Implement backup/restore logic
5. Test rollback scenarios
6. Add progress notifications

**Estimated Effort:** 3-4 days
**Risk Level:** Medium (safe with proper testing)

---

*Analysis completed: 2026-01-12*
