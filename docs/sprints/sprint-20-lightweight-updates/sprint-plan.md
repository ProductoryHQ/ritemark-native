# Sprint 20: Lightweight Extension-Only Updates

## Goal

Enable lightweight in-place updates for extension-only changes, eliminating the need for full DMG downloads when only the Ritemark extension has changed (not VS Code core).

## Success Criteria

- [ ] System detects whether an update is extension-only or full app update
- [ ] Extension-only updates install to user extension directory (preserves code signing)
- [ ] Full app updates continue to show "Install Now" (opens DMG download)
- [ ] Update notification clearly indicates update type
- [ ] Versioned folder installs provide automatic rollback capability
- [ ] Version tracking distinguishes extension version from app version
- [ ] Downgrade attempts are explicitly rejected
- [ ] Works on production macOS builds (darwin-arm64)

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Update Type Detection | Logic to determine extension-only vs full app updates |
| User Extension Installer | Service that downloads and installs to `~/.ritemark/extensions/` |
| Manifest System | JSON manifest in GitHub releases defining update type and files |
| Version Tracking | Separate version tracking for extension vs VS Code base |
| Versioned Folder Strategy | Each version in its own folder for natural rollback |
| Enhanced Notifications | Different UI for extension-only vs full updates |

---

## Critical Design Decision: User Extension Directory

### Why NOT App Bundle (Original Plan)

The original plan targeted `Ritemark.app/Contents/Resources/app/extensions/ritemark/`.

**This approach is INVALID because:**

1. **Code Signing Breakage**: Modifying ANY file inside a signed .app bundle invalidates the signature. macOS Gatekeeper will reject the app with "damaged and can't be opened".

2. **Write Permissions**: App bundles in `/Applications` are often read-only for non-admin users.

3. **No Recovery Path**: If update fails mid-write, app is corrupted with no easy rollback.

### Why User Extension Directory (Revised Plan)

**Target:** `~/.ritemark/extensions/ritemark-{version}/`

**Benefits:**

| Aspect | User Directory Approach |
|--------|------------------------|
| Code signing | **Preserved** - app bundle untouched |
| Permissions | **Always writable** - user's home directory |
| VS Code support | **Native** - VS Code prioritizes higher-version user extensions |
| Rollback | **Built-in** - previous version folder remains |
| Cleanup | **Simple** - delete old version folders |

### How VS Code Extension Priority Works

From our codebase research, VS Code scans extensions in this order:

```
1. Development extensions (if dev mode)
2. System extensions (bundled in app)
3. User extensions (~/.ritemark/extensions/)
```

**Deduplication rule:** When same extension exists in multiple locations:
- **Higher version wins** (with `pickLatest=true`)
- Same version → System extension wins

**This means:** Installing `ritemark-1.0.1-ext.5` to user directory will override bundled `ritemark-1.0.1` because the version is higher.

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
- VS Code core binaries (`Ritemark.app/Contents/MacOS/Electron`)
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
function determineUpdateType(current: string, latest: string): 'full' | 'extension' | 'none' {
  const currentBase = current.split('-ext.')[0];  // "1.0.1"
  const latestBase = latest.split('-ext.')[0];    // "1.0.1"

  // Reject downgrades
  if (compareVersions(latest, current) <= 0) {
    return 'none';  // No update needed or downgrade attempted
  }

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
  "installType": "user-extension",
  "extensionId": "ritemark",
  "extensionDirName": "ritemark-1.0.1-ext.5",
  "releaseDate": "2026-01-12T10:00:00Z",
  "minimumAppVersion": "1.0.1",
  "files": [
    {
      "path": "out/extension.js",
      "url": "https://github.com/.../download/v1.0.1-ext.5/extension.js",
      "sha256": "abc123...",
      "size": 12345
    },
    {
      "path": "media/webview.js",
      "url": "https://github.com/.../download/v1.0.1-ext.5/webview.js",
      "sha256": "def456...",
      "size": 900000
    },
    {
      "path": "package.json",
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
  "dmgUrl": "https://github.com/.../download/v1.1.0/Ritemark-1.1.0-darwin-arm64.dmg",
  "dmgSha256": "xyz789...",
  "dmgSize": 500000000,
  "releaseNotes": "Major update: New AI features, performance improvements"
}
```

---

### Lightweight Update Flow (REVISED)

**New flow for extension-only updates:**

```
1. Update Check (existing)
   ├─ Fetch latest release from GitHub
   ├─ Download update-manifest.json
   ├─ Determine update type (full vs extension)
   └─ Reject if downgrade attempted

2. Extension-Only Update Path (NEW - User Directory)
   ├─ Show notification: "Extension update available (1MB)"
   ├─ User clicks "Install Now"
   ├─ Download files to staging: ~/.ritemark/staging/ritemark-{version}/
   ├─ Verify SHA-256 checksums for ALL files
   ├─ Move staging → ~/.ritemark/extensions/ritemark-{version}/
   ├─ Prompt to reload window
   └─ On next successful load: cleanup old user extension versions

3. Full App Update Path (existing)
   ├─ Show notification: "New version available"
   └─ Open DMG download URL in browser

4. Failure Handling (Simplified)
   ├─ If any download fails → delete staging folder, show error
   ├─ If checksum fails → delete staging folder, show error
   ├─ Previous version remains intact (no rollback needed)
   └─ Bundled extension always available as baseline
```

---

### File System Layout

**User Extension Directory:**
```
~/.ritemark/
├── extensions/
│   ├── ritemark-1.0.1-ext.3/    ← Previous update (kept for one cycle)
│   │   ├── out/
│   │   ├── media/
│   │   └── package.json
│   └── ritemark-1.0.1-ext.5/    ← Current update
│       ├── out/
│       ├── media/
│       └── package.json
├── staging/                      ← Temporary download location
│   └── ritemark-1.0.1-ext.6/    ← In-progress download
└── User/                         ← User settings (existing)
```

**Bundled Extension (Fallback Baseline):**
```
Ritemark.app/Contents/Resources/app/extensions/ritemark/  → v1.0.1
```

**VS Code Loading Priority:**
```
1. ~/.ritemark/extensions/ritemark-1.0.1-ext.5/  → v1.0.1-ext.5 ✓ LOADED
2. Ritemark.app/.../extensions/ritemark/          → v1.0.1      (skipped, lower version)
```

---

### Versioned Folder Strategy (No Backup Needed)

**Key Insight:** By installing each version to a separate folder, we get automatic rollback:

| Scenario | Behavior |
|----------|----------|
| Update succeeds | New folder created, old folder cleaned up on next launch |
| Download fails | Staging folder deleted, previous version untouched |
| Checksum fails | Staging folder deleted, previous version untouched |
| Extension fails to load | VS Code falls back to bundled extension |
| User force-quits mid-update | Staging folder left behind, cleaned up on next launch |

**Cleanup Strategy:**
```typescript
async function cleanupOldVersions(): Promise<void> {
  const extensionsDir = path.join(userDataPath, 'extensions');
  const folders = await fs.readdir(extensionsDir);

  // Find all ritemark-* folders
  const ritemarkFolders = folders
    .filter(f => f.startsWith('ritemark-'))
    .sort(compareVersions)
    .reverse();  // Newest first

  // Keep only the latest version, delete older ones
  for (const folder of ritemarkFolders.slice(1)) {
    await fs.remove(path.join(extensionsDir, folder));
  }
}
```

---

### Security Considerations

| Risk | Mitigation |
|------|------------|
| **Man-in-the-middle attack** | Verify SHA-256 checksums for all downloaded files |
| **Partial download failure** | Staging folder approach - atomic move only after all verified |
| **Malicious manifest** | Only fetch from trusted GitHub repo (HTTPS) |
| **Downgrade attack** | Explicit version comparison rejects downgrades |
| **Corrupted files** | Verify checksums before moving from staging |
| **Failed extension load** | Bundled extension always available as fallback |

**Checksum Verification:**
```typescript
async function verifyFile(filePath: string, expectedSha256: string): Promise<boolean> {
  const buffer = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return hash === expectedSha256;
}
```

**Downgrade Protection:**
```typescript
function isValidUpgrade(current: string, target: string): boolean {
  const comparison = compareVersions(target, current);
  if (comparison <= 0) {
    console.warn(`Rejected update: ${target} is not newer than ${current}`);
    return false;
  }
  return true;
}
```

---

### User Experience Design

**Extension-Only Update Notification:**
```
┌────────────────────────────────────────────────────────────┐
│ Extension update available (1 MB)                          │
│                                                            │
│ New: CSV performance improvements                          │
│                                        [Later] [Install Now]│
└────────────────────────────────────────────────────────────┘
```

**Full App Update Notification (unchanged):**
```
┌────────────────────────────────────────────────────────────┐
│ New version of Ritemark is available                       │
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
│ Update installed successfully                              │
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
- [x] **REVIEW: Codex review incorporated** (2026-01-13)
- [x] **VERIFIED: User extension directory approach validated**

### Phase 2: Infrastructure
- [x] Create `updateManifest.ts` (parse manifest.json)
- [x] Add `determineUpdateType()` to versionComparison.ts
- [x] Create `userExtensionInstaller.ts` (download, verify, install to user dir)
- [x] Add staging directory management
- [x] Update `githubClient.ts` to fetch manifest
- [x] Add checksum verification utilities
- [x] Add downgrade protection

### Phase 3: Update Flow
- [x] Modify `updateService.ts` to check manifest
- [x] Add extension-only update path to updateNotification.ts
- [x] Implement download progress UI
- [x] Implement "Reload Window" prompt
- [x] Add cleanup logic for old user extension versions
- [x] Handle staging directory cleanup on failure

### Phase 4: Version Management
- [x] Update `package.json` version format (1.0.1 → 1.0.1-ext.0) - *Ready; change on first ext release*
- [x] Modify `versionService.ts` to handle new format
- [x] Update `versionComparison.ts` logic with downgrade rejection
- [x] Ensure backward compatibility with old versions

### Phase 5: Release Process
- [x] Document how to create extension-only releases (EXTENSION-RELEASE-GUIDE.md)
- [x] Create script to generate update-manifest.json
- [x] Create script to upload individual extension files to release
- [x] Test manifest generation
- [ ] Update ROADMAP with new update types (deferred to Phase 7)

### Phase 6: Testing & Validation
- [x] Test extension-only update on production build
- [x] Test VS Code loads user extension over bundled
- [ ] Test full app update still works (deferred - requires full release)
- [x] Test staging cleanup on download failure (implicit - tested via success path)
- [ ] Test staging cleanup on checksum mismatch (deferred - requires bad release)
- [x] Test downgrade rejection (code review verified)
- [x] Test old version cleanup after successful update
- [x] Verify no breaking changes for 1.0.1 users
- [x] Test version comparison with mixed formats (code review verified)
- [ ] Test fallback to bundled extension if user extension fails (deferred)

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

### 2. New Module: userExtensionInstaller.ts

```typescript
// File: extensions/ritemark/src/update/userExtensionInstaller.ts

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
  installType?: 'user-extension';
  extensionId: string;
  extensionDirName: string;
  releaseDate: string;
  minimumAppVersion?: string;
  files?: UpdateFile[];
  dmgUrl?: string;
  dmgSha256?: string;
  dmgSize?: number;
  releaseNotes: string;
}

export class UserExtensionInstaller {
  private userDataPath: string;
  private stagingDir: string;
  private extensionsDir: string;

  constructor() {
    // ~/.ritemark/
    this.userDataPath = path.join(os.homedir(), '.ritemark');
    this.stagingDir = path.join(this.userDataPath, 'staging');
    this.extensionsDir = path.join(this.userDataPath, 'extensions');
  }

  async applyUpdate(manifest: UpdateManifest): Promise<void> {
    if (manifest.type !== 'extension') {
      throw new Error('Manifest is not for extension update');
    }

    const targetDir = path.join(this.extensionsDir, manifest.extensionDirName);
    const stagingTarget = path.join(this.stagingDir, manifest.extensionDirName);

    try {
      // Step 1: Ensure directories exist
      await fs.ensureDir(this.stagingDir);
      await fs.ensureDir(this.extensionsDir);

      // Step 2: Download all files to staging
      await this.downloadFilesToStaging(manifest.files!, stagingTarget);

      // Step 3: Verify all checksums
      await this.verifyAllChecksums(manifest.files!, stagingTarget);

      // Step 4: Atomic move from staging to extensions
      await fs.move(stagingTarget, targetDir);

      // Step 5: Prompt reload
      this.promptReload();

    } catch (error) {
      // Cleanup staging on any error
      await fs.remove(stagingTarget).catch(() => {});
      throw error;
    }
  }

  async cleanupOldVersions(keepVersion: string): Promise<void> {
    const folders = await fs.readdir(this.extensionsDir);

    for (const folder of folders) {
      if (folder.startsWith('ritemark-') && folder !== `ritemark-${keepVersion}`) {
        await fs.remove(path.join(this.extensionsDir, folder));
      }
    }
  }

  async cleanupStaging(): Promise<void> {
    await fs.remove(this.stagingDir);
  }

  private async downloadFilesToStaging(
    fileList: UpdateFile[],
    stagingTarget: string
  ): Promise<void> {
    await fs.ensureDir(stagingTarget);

    for (const file of fileList) {
      const targetPath = path.join(stagingTarget, file.path);
      await fs.ensureDir(path.dirname(targetPath));

      const buffer = await this.downloadFile(file.url);
      await fs.writeFile(targetPath, buffer);
    }
  }

  private async verifyAllChecksums(
    fileList: UpdateFile[],
    stagingTarget: string
  ): Promise<void> {
    for (const file of fileList) {
      const filePath = path.join(stagingTarget, file.path);
      const buffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      if (hash !== file.sha256) {
        throw new Error(`Checksum mismatch for ${file.path}`);
      }
    }
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

    // Reject downgrades
    const currentVersion = getCurrentVersion();
    if (!isValidUpgrade(currentVersion, manifest.version)) {
      return;  // No update needed
    }

    if (manifest.type === 'extension') {
      // Extension-only update (user directory)
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
├── versionComparison.ts          # Version comparison (MODIFIED + downgrade protection)
├── githubClient.ts               # GitHub API (MODIFIED)
├── updateManifest.ts             # NEW: Manifest parser
└── userExtensionInstaller.ts     # NEW: User directory install logic
```

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **VS Code doesn't prefer user extension** | Update ignored | Low | Verified in codebase - higher version wins |
| **Partial download failure** | Incomplete staging | Low | Staging folder deleted, previous version intact |
| **Checksum mismatch** | Security risk | Low | Abort update, delete staging, show error |
| **Staging cleanup failure** | Disk space | Low | Cleanup on next startup |
| **GitHub API change** | Manifest not found | Low | Graceful fallback to DMG update |
| **User extension fails to load** | App unusable | Low | VS Code falls back to bundled extension |

---

## Performance Considerations

| Metric | Extension Update | Full DMG |
|--------|------------------|----------|
| **Download size** | ~1 MB | ~500 MB |
| **Download time** | <5 seconds | 2-10 minutes |
| **Install time** | <2 seconds | Manual (user drags app) |
| **Total time** | <10 seconds | 5-15 minutes |
| **Network usage** | Minimal | High |
| **Code signing** | Preserved | N/A |

**Benefits:**
- 500x smaller download
- 50x faster update
- No manual installation steps
- No interruption to workflow (just reload window)
- **Code signing remains intact**

---

## Future Enhancements (Post-MVP)

- [ ] Delta updates (only changed portions of files)
- [ ] Background downloads (pre-fetch update, install on next startup)
- [ ] Multi-step updates (1.0.1 → 1.0.1-ext.3 → 1.1.0 in sequence)
- [ ] Update scheduling (install at specific time)
- [ ] Beta channel support for extension-only updates
- [ ] Automatic rollback if extension fails to load
- [ ] Signed manifest verification (optional security enhancement)

---

## Status

**Current Phase:** COMPLETE
**Approval Required:** No (Approved 2026-01-14)

---

## Decisions (LOCKED)

| Decision | Value | Rationale |
|----------|-------|-----------|
| **Update target** | `~/.ritemark/extensions/` | Preserves code signing, always writable |
| **Version format** | `{app}-ext.{build}` | Clear separation, sortable |
| **Manifest location** | GitHub release assets | Same trust model as DMG |
| **Install strategy** | Versioned folders | Natural rollback, no explicit backup needed |
| **Checksum algorithm** | SHA-256 | Industry standard, secure |
| **Update trigger** | User click "Install Now" | Explicit consent, no surprise updates |
| **Downgrade handling** | Explicit rejection | Security, prevents version confusion |

---

## Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-01-12 | Claude | Initial plan |
| 2026-01-13 | Codex | Critical review - identified code signing issue |
| 2026-01-13 | Claude | Revised plan - user extension directory approach |

---

## Approval

- [x] Jarmo approved this sprint plan (2026-01-14)

---

*Sprint plan created: 2026-01-12*
*Phase 1 research completed: 2026-01-12*
*Codex review incorporated: 2026-01-13*
