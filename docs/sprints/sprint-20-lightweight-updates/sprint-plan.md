# Sprint 20: Lightweight Extension-Only Updates

## Goal

Enable lightweight in-place updates for extension-only changes, eliminating the need for full DMG downloads when only the RiteMark extension has changed (not VS Code core).

## Success Criteria

- [ ] System detects whether an update is extension-only or full app update
- [ ] Extension-only updates download and replace files in-place (no DMG)
- [ ] Full app updates continue to show "Install Now" (opens DMG download)
- [ ] Update notification clearly indicates update type
- [ ] Rollback mechanism in case extension-only update fails
- [ ] Version tracking distinguishes extension version from app version
- [ ] Works on production macOS builds (darwin-arm64)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Update Type Detection | Logic to determine extension-only vs full app updates |
| Lightweight Updater | Service that downloads and replaces extension files |
| Manifest System | JSON manifest in GitHub releases defining update type and files |
| Version Tracking | Separate version tracking for extension vs VS Code base |
| Rollback Protection | Backup and restore mechanism for failed updates |
| Enhanced Notifications | Different UI for extension-only vs full updates |

---

## Technical Analysis

### Current Update System (Sprint 16)

**What exists:**
```
extensions/ritemark/src/update/
├── updateService.ts          # Checks GitHub API, shows notification
├── updateScheduler.ts        # 10-second delayed startup check
├── updateNotification.ts     # "Install Now" opens DMG in browser
├── updateStorage.ts          # Tracks dismissed versions, preferences
├── versionService.ts         # Gets version from package.json
├── versionComparison.ts      # Semantic version comparison
└── githubClient.ts           # Fetches latest release from GitHub
```

**Current flow:**
1. Check GitHub Releases API on startup
2. Compare latest version with current version (`1.0.1`)
3. Show notification: "Install Now" | "Later" | "Don't Show Again"
4. "Install Now" opens DMG download URL in browser
5. User manually drags app to Applications

**Limitation:** Even if only one webview.js file changed (900KB), user must download entire DMG (~500MB) and reinstall app.

---

### Extension Files That Can Change

**Files in `extensions/ritemark/` that can be updated independently:**

```
extensions/ritemark/
├── out/                     # Compiled TypeScript (~50KB)
│   ├── extension.js
│   ├── ritemarkEditor.js
│   ├── update/*.js
│   ├── ai/*.js
│   ├── export/*.js
│   └── commands/*.js
├── media/                   # Webview bundle (~900KB)
│   ├── webview.js
│   └── webview.js.map
└── package.json             # Extension manifest (version, config)
```

**Total size:** ~1MB (vs ~500MB DMG)

**Files that CANNOT be updated this way:**
- VS Code core binaries (`RiteMark.app/Contents/MacOS/Electron`)
- VS Code core resources (`Resources/app/out/vs/...`)
- Patches to VS Code (require full rebuild)

---

### Version Strategy: Dual Versioning

**Problem:** Current system uses single version (`1.0.1`) stored in:
- `branding/product.json` → `ritemarkVersion`
- `extensions/ritemark/package.json` → `version`

Both change together, making it impossible to distinguish extension-only updates.

**Solution: Independent Versioning**

| Version | Stored In | Updated When | Example |
|---------|-----------|--------------|---------|
| **App Version** | `branding/product.json` → `ritemarkVersion` | VS Code update, patches, core changes | `1.0.1` |
| **Extension Version** | `extensions/ritemark/package.json` → `version` | Extension code, webview bundle changes | `1.0.1-ext.5` |

**Version Format:**
```
{appVersion}-ext.{extensionBuild}
```

**Examples:**
- `1.0.1-ext.0` - Initial extension for app 1.0.1
- `1.0.1-ext.1` - First extension-only update (webview fix)
- `1.0.1-ext.2` - Second extension-only update (CSV feature)
- `1.1.0` - Full app update (extension version resets)

**Detection Logic:**
```typescript
function determineUpdateType(current: string, latest: string): 'full' | 'extension' {
  const currentBase = current.split('-ext.')[0];  // "1.0.1"
  const latestBase = latest.split('-ext.')[0];    // "1.0.1"

  if (currentBase !== latestBase) {
    return 'full';  // App version changed
  }

  return 'extension';  // Only extension build incremented
}
```

---

### Update Manifest System

**Problem:** GitHub Releases currently only have DMG asset. No metadata about what changed.

**Solution: Update Manifest**

Each GitHub release includes `update-manifest.json`:

```json
{
  "version": "1.0.1-ext.5",
  "appVersion": "1.0.1",
  "extensionVersion": "1.0.1-ext.5",
  "type": "extension",
  "releaseDate": "2026-01-12T10:00:00Z",
  "files": [
    {
      "path": "extensions/ritemark/out/extension.js",
      "url": "https://github.com/.../download/v1.0.1-ext.5/extension.js",
      "sha256": "abc123...",
      "size": 12345
    },
    {
      "path": "extensions/ritemark/media/webview.js",
      "url": "https://github.com/.../download/v1.0.1-ext.5/webview.js",
      "sha256": "def456...",
      "size": 900000
    },
    {
      "path": "extensions/ritemark/package.json",
      "url": "https://github.com/.../download/v1.0.1-ext.5/package.json",
      "sha256": "ghi789...",
      "size": 2048
    }
  ],
  "releaseNotes": "Fixed CSV parsing bug, improved webview performance"
}
```

**Full app releases:**
```json
{
  "version": "1.1.0",
  "appVersion": "1.1.0",
  "extensionVersion": "1.1.0",
  "type": "full",
  "releaseDate": "2026-02-01T10:00:00Z",
  "dmgUrl": "https://github.com/.../download/v1.1.0/RiteMark-1.1.0-darwin-arm64.dmg",
  "dmgSha256": "xyz789...",
  "dmgSize": 500000000,
  "releaseNotes": "Major update: New AI features, performance improvements"
}
```

---

### Lightweight Update Flow

**New flow for extension-only updates:**

```
1. Update Check (existing)
   ├─ Fetch latest release from GitHub
   ├─ Download update-manifest.json
   └─ Determine update type (full vs extension)

2. Extension-Only Update Path (NEW)
   ├─ Show notification: "Extension update available (1MB)"
   ├─ User clicks "Install Now"
   ├─ Download files listed in manifest
   ├─ Verify SHA-256 checksums
   ├─ Create backup of current extension files
   ├─ Write new files to VSCode-darwin-arm64/RiteMark.app/Contents/Resources/app/extensions/ritemark/
   ├─ Prompt to reload window
   └─ On success: delete backup, mark as installed

3. Full App Update Path (existing)
   ├─ Show notification: "New version available"
   └─ Open DMG download URL in browser

4. Rollback on Failure
   ├─ If any download/write fails
   ├─ Restore from backup
   └─ Show error notification
```

---

### File System Operations

**Target Location (Production Build):**
```
VSCode-darwin-arm64/
└── RiteMark.app/
    └── Contents/
        └── Resources/
            └── app/
                └── extensions/
                    └── ritemark/     ← Update files here
                        ├── out/
                        ├── media/
                        └── package.json
```

**Backup Strategy:**
```typescript
// Before updating
const backupDir = path.join(app.getPath('userData'), 'extension-backup');
await fs.copy(
  path.join(resourcesPath, 'app/extensions/ritemark'),
  backupDir
);

// After successful update
await fs.remove(backupDir);

// On failure
await fs.copy(backupDir, path.join(resourcesPath, 'app/extensions/ritemark'));
```

**Write Permissions:**
- **Dev mode:** Extension files in `extensions/ritemark/` (writable)
- **Production:** App bundle may be signed/read-only (need to verify)
- **Mitigation:** Check write permissions before attempting update

---

### Security Considerations

| Risk | Mitigation |
|------|------------|
| **Man-in-the-middle attack** | Verify SHA-256 checksums for all downloaded files |
| **Partial update failure** | Atomic operation: backup first, rollback on any error |
| **Malicious manifest** | Only fetch from trusted GitHub repo (HTTPS) |
| **Write permission denied** | Check permissions, fall back to full DMG if no write access |
| **Corrupted files** | Verify checksums before backup deletion |
| **Rollback failure** | Keep backup until next successful update |

**Checksum Verification:**
```typescript
async function verifyFile(filePath: string, expectedSha256: string): Promise<boolean> {
  const buffer = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return hash === expectedSha256;
}
```

---

### User Experience Design

**Extension-Only Update Notification:**
```
┌────────────────────────────────────────────────────────────┐
│ 📦 Extension update available (1 MB)                       │
│                                                            │
│ New: CSV performance improvements                          │
│                                        [Later] [Install Now]│
└────────────────────────────────────────────────────────────┘
```

**Full App Update Notification (unchanged):**
```
┌────────────────────────────────────────────────────────────┐
│ 📦 New version of RiteMark is available                    │
│                                        [Later] [Install Now]│
└────────────────────────────────────────────────────────────┘
```

**Download Progress (NEW):**
```
┌────────────────────────────────────────────────────────────┐
│ Downloading update... 45%                                  │
│ [██████████░░░░░░░░░░]                                     │
└────────────────────────────────────────────────────────────┘
```

**Install Complete (NEW):**
```
┌────────────────────────────────────────────────────────────┐
│ ✅ Update installed successfully                           │
│                                             [Reload Window] │
└────────────────────────────────────────────────────────────┘
```

---

### Backward Compatibility

**Requirements:**
- Existing `1.0.1` users can upgrade to `1.0.1-ext.5` or `1.1.0`
- Version comparison handles both formats: `1.0.1` and `1.0.1-ext.5`
- Old update notification flow works for users who haven't upgraded

**Version Comparison Logic:**
```typescript
function compareVersions(a: string, b: string): number {
  // Parse: "1.0.1-ext.5" → { base: "1.0.1", ext: 5 }
  const parseVersion = (v: string) => {
    const [base, ext] = v.split('-ext.');
    return { base, ext: ext ? parseInt(ext) : 0 };
  };

  const vA = parseVersion(a);
  const vB = parseVersion(b);

  // Compare base versions first
  const baseCompare = semverCompare(vA.base, vB.base);
  if (baseCompare !== 0) return baseCompare;

  // If base same, compare extension build numbers
  return vA.ext - vB.ext;
}
```

---

## Implementation Checklist

### Phase 1: Research & Design
- [x] Analyze current update system
- [x] Design dual versioning strategy
- [x] Design update manifest format
- [x] Map file system locations
- [x] Identify security requirements
- [x] Document UX flow

### Phase 2: Infrastructure
- [ ] Create `updateManifest.ts` (parse manifest.json)
- [ ] Add `determineUpdateType()` to versionComparison.ts
- [ ] Create `lightweightUpdater.ts` (download, verify, install)
- [ ] Add `backupManager.ts` (backup/restore files)
- [ ] Update `githubClient.ts` to fetch manifest
- [ ] Add checksum verification utilities

### Phase 3: Update Flow
- [ ] Modify `updateService.ts` to check manifest
- [ ] Add extension-only update path to updateNotification.ts
- [ ] Implement download progress UI
- [ ] Implement "Reload Window" prompt
- [ ] Add rollback logic on failure
- [ ] Handle write permission errors

### Phase 4: Version Management
- [ ] Update `package.json` version format (1.0.1 → 1.0.1-ext.0)
- [ ] Modify `versionService.ts` to handle new format
- [ ] Update `versionComparison.ts` logic
- [ ] Ensure backward compatibility with old versions

### Phase 5: Release Process
- [ ] Document how to create extension-only releases
- [ ] Create script to generate update-manifest.json
- [ ] Create script to upload individual extension files to release
- [ ] Test manifest generation
- [ ] Update ROADMAP with new update types

### Phase 6: Testing & Validation
- [ ] Test extension-only update on production build
- [ ] Test full app update still works
- [ ] Test rollback on download failure
- [ ] Test rollback on checksum mismatch
- [ ] Test write permission denied scenario
- [ ] Test partial download failure
- [ ] Verify no breaking changes for 1.0.1 users
- [ ] Test version comparison with mixed formats

### Phase 7: Documentation
- [ ] Update Sprint 16 documentation with new features
- [ ] Document release process for extension-only updates
- [ ] Create troubleshooting guide
- [ ] Update CHANGELOG format

---

## Technical Specifications (EXACT)

### 1. Update Manifest Location

**GitHub Release Assets:**
```
v1.0.1-ext.5/
├── update-manifest.json           ← Metadata
├── extension.js                   ← Individual files
├── webview.js
├── webview.js.map
└── package.json
```

**Fetched via:**
```
https://github.com/jarmo-productory/ritemark-public/releases/download/v1.0.1-ext.5/update-manifest.json
```

### 2. New Module: lightweightUpdater.ts

```typescript
// File: extensions/ritemark/src/update/lightweightUpdater.ts

export interface UpdateFile {
  path: string;
  url: string;
  sha256: string;
  size: number;
}

export interface UpdateManifest {
  version: string;
  appVersion: string;
  extensionVersion: string;
  type: 'full' | 'extension';
  releaseDate: string;
  files?: UpdateFile[];
  dmgUrl?: string;
  dmgSha256?: string;
  dmgSize?: number;
  releaseNotes: string;
}

export class LightweightUpdater {
  private backupDir: string;
  private extensionDir: string;

  constructor() {
    // Detect production vs dev
    this.extensionDir = this.getExtensionDirectory();
    this.backupDir = path.join(
      vscode.env.appRoot,
      '..',
      'extension-backup'
    );
  }

  async applyUpdate(manifest: UpdateManifest): Promise<void> {
    if (manifest.type !== 'extension') {
      throw new Error('Manifest is not for extension update');
    }

    try {
      // Step 1: Create backup
      await this.createBackup();

      // Step 2: Download and verify files
      const files = await this.downloadFiles(manifest.files!);

      // Step 3: Write files
      await this.writeFiles(files);

      // Step 4: Cleanup backup
      await this.deleteBackup();

      // Step 5: Prompt reload
      this.promptReload();

    } catch (error) {
      // Rollback on any error
      await this.restoreBackup();
      throw error;
    }
  }

  private async downloadFiles(
    fileList: UpdateFile[]
  ): Promise<Map<string, Buffer>> {
    const downloads = new Map<string, Buffer>();

    for (const file of fileList) {
      const buffer = await this.downloadFile(file.url);

      // Verify checksum
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (hash !== file.sha256) {
        throw new Error(`Checksum mismatch for ${file.path}`);
      }

      downloads.set(file.path, buffer);
    }

    return downloads;
  }

  // ... implementation details
}
```

### 3. Modified updateService.ts

```typescript
// File: extensions/ritemark/src/update/updateService.ts

export class UpdateService {
  async checkAndNotify(): Promise<void> {
    const release = await fetchLatestRelease();
    const manifest = await fetchUpdateManifest(release.tag_name);

    if (manifest.type === 'extension') {
      // Extension-only update
      await showExtensionUpdateNotification(manifest, this.storage);
    } else {
      // Full app update (existing flow)
      await showUpdateNotification(manifest.version, manifest.dmgUrl!, this.storage);
    }
  }
}
```

### 4. File Structure (NEW)

```
extensions/ritemark/src/update/
├── index.ts                      # Export all update module
├── updateService.ts              # Main service (MODIFIED)
├── updateStorage.ts              # globalState wrapper
├── updateNotification.ts         # Show notifications (MODIFIED)
├── updateScheduler.ts            # scheduleStartupCheck()
├── versionService.ts             # getCurrentVersion()
├── versionComparison.ts          # Version comparison (MODIFIED)
├── githubClient.ts               # GitHub API (MODIFIED)
├── updateManifest.ts             # NEW: Manifest parser
├── lightweightUpdater.ts         # NEW: Download/install logic
└── backupManager.ts              # NEW: Backup/restore logic
```

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **App bundle read-only** | Cannot write files | Medium | Check permissions first, fall back to DMG |
| **Partial download failure** | Corrupted installation | Low | Atomic operations, rollback on error |
| **Checksum mismatch** | Security compromise | Low | Abort update, show error |
| **Backup failure** | Cannot rollback | Low | Fail update early if backup fails |
| **GitHub API change** | Manifest not found | Low | Graceful fallback to DMG update |
| **User force-quits during update** | Incomplete state | Medium | Detect incomplete update on next startup, restore backup |

---

## Performance Considerations

| Metric | Extension Update | Full DMG |
|--------|------------------|----------|
| **Download size** | ~1 MB | ~500 MB |
| **Download time** | <5 seconds | 2-10 minutes |
| **Install time** | <2 seconds | Manual (user drags app) |
| **Total time** | <10 seconds | 5-15 minutes |
| **Network usage** | Minimal | High |

**Benefits:**
- 500x smaller download
- 50x faster update
- No manual installation steps
- No interruption to workflow (just reload window)

---

## Future Enhancements (Post-MVP)

- [ ] Delta updates (only changed portions of files)
- [ ] Background downloads (pre-fetch update, install on next startup)
- [ ] Multi-step updates (1.0.1 → 1.0.1-ext.3 → 1.1.0 in sequence)
- [ ] Update scheduling (install at specific time)
- [ ] Beta channel support for extension-only updates
- [ ] Automatic rollback if extension fails to load

---

## Status

**Current Phase:** 1 (RESEARCH)
**Approval Required:** Yes

---

## Decisions (LOCKED)

| Decision | Value | Rationale |
|----------|-------|-----------|
| **Version format** | `{app}-ext.{build}` | Clear separation, sortable |
| **Manifest location** | GitHub release assets | Same trust model as DMG |
| **Backup location** | App bundle parent directory | Survives app replacement |
| **Checksum algorithm** | SHA-256 | Industry standard, secure |
| **Update trigger** | User click "Install Now" | Explicit consent, no surprise updates |

---

## Approval

- [ ] Jarmo approved this sprint plan

---

*Sprint plan created: 2026-01-12*
*Phase 1 research completed: 2026-01-12*
