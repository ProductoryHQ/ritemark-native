# Sprint 20: Implementation Roadmap

Detailed breakdown of implementation phases with dependencies and testing requirements.

---

## Phase Overview

| Phase | Effort | Risk | Blocking Dependencies |
|-------|--------|------|----------------------|
| 1. Research & Design | ✅ Complete | Low | None |
| 2. Infrastructure | 1 day | Low | Phase 1 approval |
| 3. Update Flow | 1 day | Medium | Phase 2 |
| 4. Version Management | 0.5 day | Low | Phase 2 |
| 5. Release Process | 0.5 day | Low | Phase 3 |
| 6. Testing & QA | 1 day | High | Phase 5 |
| 7. Documentation | 0.5 day | Low | Phase 6 |

**Total Estimated Effort:** 4-5 days

---

## Phase 2: Infrastructure (Day 1)

### Goal
Create foundational classes for manifest parsing, file operations, and backup management.

### Tasks

#### 2.1 Create Update Manifest Parser
**File:** `extensions/ritemark/src/update/updateManifest.ts`

```typescript
export interface UpdateFile {
  path: string;           // "extensions/ritemark/out/extension.js"
  url: string;            // Full GitHub download URL
  sha256: string;         // Hex checksum
  size: number;           // Bytes
}

export interface UpdateManifest {
  version: string;        // "1.0.1-ext.5"
  appVersion: string;     // "1.0.1"
  extensionVersion: string; // "1.0.1-ext.5"
  type: 'full' | 'extension';
  releaseDate: string;    // ISO 8601
  files?: UpdateFile[];   // For extension updates
  dmgUrl?: string;        // For full updates
  dmgSha256?: string;     // For full updates
  dmgSize?: number;       // For full updates
  releaseNotes: string;
}

export async function fetchManifest(version: string): Promise<UpdateManifest> {
  const url = `https://github.com/jarmo-productory/ritemark-public/releases/download/${version}/update-manifest.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.statusText}`);
  }

  return await response.json();
}

export function validateManifest(manifest: UpdateManifest): void {
  if (!manifest.version || !manifest.type) {
    throw new Error('Invalid manifest: missing required fields');
  }

  if (manifest.type === 'extension' && !manifest.files) {
    throw new Error('Extension manifest must include files array');
  }

  if (manifest.type === 'full' && !manifest.dmgUrl) {
    throw new Error('Full manifest must include dmgUrl');
  }
}
```

**Tests:**
- [ ] Parse valid extension manifest
- [ ] Parse valid full manifest
- [ ] Reject invalid manifest (missing fields)
- [ ] Handle network errors gracefully

---

#### 2.2 Create Backup Manager
**File:** `extensions/ritemark/src/update/backupManager.ts`

```typescript
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

export class BackupManager {
  private backupDir: string;
  private extensionDir: string;

  constructor() {
    // Backup location: VSCode-darwin-arm64/.extension-backup
    this.extensionDir = this.getExtensionDirectory();
    this.backupDir = path.join(
      path.dirname(vscode.env.appRoot),
      '.extension-backup'
    );
  }

  async createBackup(): Promise<void> {
    // Remove old backup if exists
    await fs.remove(this.backupDir);

    // Copy current extension to backup
    await fs.copy(this.extensionDir, this.backupDir, {
      overwrite: true,
      errorOnExist: false
    });

    // Verify backup was created
    const backupExists = await fs.pathExists(this.backupDir);
    if (!backupExists) {
      throw new Error('Backup creation failed');
    }
  }

  async restoreBackup(): Promise<void> {
    if (!await this.hasBackup()) {
      throw new Error('No backup found to restore');
    }

    // Remove current extension
    await fs.remove(this.extensionDir);

    // Restore from backup
    await fs.copy(this.backupDir, this.extensionDir, {
      overwrite: true,
      errorOnExist: false
    });
  }

  async deleteBackup(): Promise<void> {
    await fs.remove(this.backupDir);
  }

  async hasBackup(): Promise<boolean> {
    return fs.pathExists(this.backupDir);
  }

  private getExtensionDirectory(): string {
    // vscode.env.appRoot = .../Ritemark.app/Contents/Resources/app
    return path.join(vscode.env.appRoot, 'extensions', 'ritemark');
  }
}
```

**Tests:**
- [ ] Create backup successfully
- [ ] Restore backup successfully
- [ ] Delete backup successfully
- [ ] Handle missing backup directory
- [ ] Verify backup contents match original

---

#### 2.3 Create File Utilities
**File:** `extensions/ritemark/src/update/fileUtils.ts`

```typescript
import * as crypto from 'crypto';
import * as fs from 'fs-extra';

export async function computeSHA256(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

export async function verifySHA256(
  filePath: string,
  expectedHash: string
): Promise<boolean> {
  const actual = await computeSHA256(filePath);
  return actual.toLowerCase() === expectedHash.toLowerCase();
}

export async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function downloadWithRetry(
  url: string,
  maxRetries = 3
): Promise<Buffer> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await downloadFile(url);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // Exponential backoff: 2s, 4s, 8s
      await sleep(2000 * attempt);
    }
  }

  throw new Error('All download attempts failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function checkWritePermission(dirPath: string): Promise<boolean> {
  const testFile = path.join(dirPath, '.write-test');

  try {
    await fs.writeFile(testFile, 'test');
    await fs.remove(testFile);
    return true;
  } catch {
    return false;
  }
}
```

**Tests:**
- [ ] Compute SHA-256 correctly
- [ ] Verify matching checksums
- [ ] Reject mismatched checksums
- [ ] Download file successfully
- [ ] Retry on network failure
- [ ] Detect write permissions

---

### Deliverables
- [ ] `updateManifest.ts` with tests
- [ ] `backupManager.ts` with tests
- [ ] `fileUtils.ts` with tests
- [ ] Unit tests passing (>90% coverage)

### Exit Criteria
- All tests pass
- Manual test: Create and restore backup
- Manual test: Download and verify file checksum

---

## Phase 3: Update Flow (Day 2)

### Goal
Implement the lightweight updater that orchestrates download, verify, and install.

### Tasks

#### 3.1 Create Lightweight Updater
**File:** `extensions/ritemark/src/update/lightweightUpdater.ts`

```typescript
import { BackupManager } from './backupManager';
import { UpdateManifest } from './updateManifest';
import { downloadWithRetry, verifySHA256, checkWritePermission } from './fileUtils';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';

export class LightweightUpdater {
  private backupManager: BackupManager;
  private extensionDir: string;
  private tempDir: string;

  constructor() {
    this.backupManager = new BackupManager();
    this.extensionDir = path.join(vscode.env.appRoot, 'extensions', 'ritemark');
    this.tempDir = path.join(vscode.env.appRoot, '..', '.extension-update-temp');
  }

  async applyUpdate(manifest: UpdateManifest): Promise<void> {
    if (manifest.type !== 'extension') {
      throw new Error('This method only handles extension updates');
    }

    // Pre-flight checks
    await this.checkPrerequisites();

    try {
      // Step 1: Create backup
      await this.showProgress('Creating backup...');
      await this.backupManager.createBackup();

      // Step 2: Download files
      await this.showProgress('Downloading files...');
      const files = await this.downloadFiles(manifest.files!);

      // Step 3: Verify checksums
      await this.showProgress('Verifying checksums...');
      await this.verifyFiles(files, manifest.files!);

      // Step 4: Write files
      await this.showProgress('Installing update...');
      await this.writeFiles(files);

      // Step 5: Cleanup
      await this.cleanupTempFiles();
      await this.backupManager.deleteBackup();

      // Step 6: Prompt reload
      await this.promptReload();

    } catch (error) {
      // Rollback on any error
      console.error('Update failed, rolling back:', error);
      await this.rollback();
      throw error;
    }
  }

  private async checkPrerequisites(): Promise<void> {
    // Check write permissions
    const canWrite = await checkWritePermission(this.extensionDir);
    if (!canWrite) {
      throw new Error('No write permission to extension directory');
    }

    // Check disk space (need 2x extension size)
    // TODO: Implement disk space check
  }

  private async downloadFiles(
    fileList: UpdateFile[]
  ): Promise<Map<string, Buffer>> {
    const downloads = new Map<string, Buffer>();
    let downloaded = 0;

    for (const file of fileList) {
      // Download with retry
      const buffer = await downloadWithRetry(file.url);
      downloads.set(file.path, buffer);

      downloaded++;
      await this.showProgress(
        `Downloading... ${downloaded}/${fileList.length}`
      );
    }

    return downloads;
  }

  private async verifyFiles(
    downloads: Map<string, Buffer>,
    fileList: UpdateFile[]
  ): Promise<void> {
    // Write to temp directory first
    await fs.ensureDir(this.tempDir);

    for (const file of fileList) {
      const buffer = downloads.get(file.path)!;
      const tempPath = path.join(this.tempDir, path.basename(file.path));

      // Write to temp
      await fs.writeFile(tempPath, buffer);

      // Verify checksum
      const valid = await verifySHA256(tempPath, file.sha256);
      if (!valid) {
        throw new Error(`Checksum mismatch for ${file.path}`);
      }
    }
  }

  private async writeFiles(downloads: Map<string, Buffer>): Promise<void> {
    for (const [filePath, buffer] of downloads) {
      // filePath is relative: "extensions/ritemark/out/extension.js"
      // Extract the part after "extensions/ritemark/"
      const relativePath = filePath.replace('extensions/ritemark/', '');
      const targetPath = path.join(this.extensionDir, relativePath);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(targetPath));

      // Write file
      await fs.writeFile(targetPath, buffer);
    }
  }

  private async rollback(): Promise<void> {
    try {
      await this.backupManager.restoreBackup();
      vscode.window.showErrorMessage(
        'Update failed, restored previous version'
      );
    } catch (rollbackError) {
      vscode.window.showErrorMessage(
        'Critical: Update and rollback both failed. Please reinstall Ritemark.'
      );
    }
  }

  private async cleanupTempFiles(): Promise<void> {
    await fs.remove(this.tempDir);
  }

  private async promptReload(): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      '✅ Update installed successfully',
      'Reload Window'
    );

    if (choice === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }

  private async showProgress(message: string): Promise<void> {
    // TODO: Use vscode.window.withProgress for better UX
    console.log(message);
  }
}
```

**Tests:**
- [ ] Apply update successfully with mock files
- [ ] Rollback on download failure
- [ ] Rollback on checksum mismatch
- [ ] Rollback on write failure
- [ ] Detect missing write permissions
- [ ] Handle user cancellation

---

#### 3.2 Modify Update Service
**File:** `extensions/ritemark/src/update/updateService.ts` (modify existing)

```typescript
import { fetchManifest } from './updateManifest';
import { LightweightUpdater } from './lightweightUpdater';

export class UpdateService {
  private lightweightUpdater: LightweightUpdater;

  constructor(private storage: UpdateStorage) {
    this.lightweightUpdater = new LightweightUpdater();
  }

  async checkAndNotify(): Promise<void> {
    const currentVersion = getCurrentVersion();
    const release = await fetchLatestRelease();

    if (!release) return;

    const latestVersion = parseVersionFromTag(release.tag_name);

    if (!shouldNotifyUpdate(currentVersion, latestVersion)) {
      return;
    }

    // NEW: Fetch update manifest
    try {
      const manifest = await fetchManifest(release.tag_name);

      if (manifest.type === 'extension') {
        await this.handleExtensionUpdate(manifest);
      } else {
        await this.handleFullUpdate(manifest);
      }

    } catch (error) {
      // Fall back to old flow if manifest not found
      console.warn('Manifest not found, using DMG flow:', error);
      await this.handleFullUpdate({
        version: latestVersion,
        type: 'full',
        dmgUrl: getDownloadUrl(release)!,
        releaseNotes: release.body
      });
    }
  }

  private async handleExtensionUpdate(manifest: UpdateManifest): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      `Extension update available (${this.formatSize(manifest.files)})`,
      'Install Now',
      'Later',
      "Don't Show Again"
    );

    if (choice === 'Install Now') {
      try {
        await this.lightweightUpdater.applyUpdate(manifest);
        await this.storage.setDismissedVersion(manifest.version);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Update failed: ${error.message}`
        );
      }
    } else if (choice === "Don't Show Again") {
      await this.storage.setDontShowAgain(true);
    }
  }

  private async handleFullUpdate(manifest: UpdateManifest): Promise<void> {
    // Existing flow (open DMG in browser)
    await showUpdateNotification(
      manifest.version,
      manifest.dmgUrl!,
      this.storage
    );
  }

  private formatSize(files?: UpdateFile[]): string {
    if (!files) return '';
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    return `${(totalBytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
```

---

### Deliverables
- [ ] `lightweightUpdater.ts` implemented
- [ ] `updateService.ts` modified
- [ ] Integration tests passing
- [ ] Manual test with mock manifest

### Exit Criteria
- Can download and install mock update
- Rollback works on simulated failure
- UI shows progress and completion

---

## Phase 4: Version Management (Day 2.5)

### Goal
Update version comparison logic to handle new format and maintain backward compatibility.

### Tasks

#### 4.1 Update Version Comparison
**File:** `extensions/ritemark/src/update/versionComparison.ts` (modify)

```typescript
export function parseVersion(version: string): {
  base: string;
  ext: number;
} {
  // "1.0.1" → { base: "1.0.1", ext: 0 }
  // "1.0.1-ext.5" → { base: "1.0.1", ext: 5 }
  const parts = version.split('-ext.');
  return {
    base: parts[0],
    ext: parts[1] ? parseInt(parts[1]) : 0
  };
}

export function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  // Compare base versions first
  const baseCompare = semverCompare(vA.base, vB.base);
  if (baseCompare !== 0) {
    return baseCompare;
  }

  // If base same, compare extension build numbers
  return vA.ext - vB.ext;
}

export function getUpdateType(
  current: string,
  latest: string
): 'full' | 'extension' | 'none' {
  const comp = compareVersions(current, latest);

  if (comp >= 0) {
    return 'none'; // Current is same or newer
  }

  const currentBase = parseVersion(current).base;
  const latestBase = parseVersion(latest).base;

  return currentBase === latestBase ? 'extension' : 'full';
}
```

**Tests:**
- [ ] Parse "1.0.1" correctly
- [ ] Parse "1.0.1-ext.5" correctly
- [ ] Compare "1.0.1" < "1.0.1-ext.1"
- [ ] Compare "1.0.1-ext.5" < "1.0.1-ext.6"
- [ ] Compare "1.0.1-ext.5" < "1.1.0"
- [ ] Detect extension update type
- [ ] Detect full update type

---

#### 4.2 Update Package Version
**File:** `extensions/ritemark/package.json` (modify)

```json
{
  "version": "1.0.1-ext.0",
  ...
}
```

**Note:** This changes the version format. Must ensure `versionService.ts` still reads it correctly.

---

### Deliverables
- [ ] Version comparison tests passing
- [ ] Backward compatibility verified (1.0.1 users can update)
- [ ] Package version updated

### Exit Criteria
- All version comparison tests pass
- Manual test: Upgrade from 1.0.1 to 1.0.1-ext.1

---

## Phase 5: Release Process (Day 3)

### Goal
Create scripts and documentation for generating extension-only releases.

### Tasks

#### 5.1 Create Release Script
**File:** `scripts/create-extension-release.sh`

```bash
#!/bin/bash
# Create extension-only release package

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXT_DIR="$PROJECT_DIR/extensions/ritemark"
OUTPUT_DIR="$PROJECT_DIR/release-extension"

echo "Creating extension release package..."

# Read version from package.json
VERSION=$(node -p "require('$EXT_DIR/package.json').version")
echo "Version: $VERSION"

# Clean output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Copy files
echo "Copying extension files..."
cp -r "$EXT_DIR/out" "$OUTPUT_DIR/"
cp -r "$EXT_DIR/media" "$OUTPUT_DIR/"
cp "$EXT_DIR/package.json" "$OUTPUT_DIR/"

# Compute checksums
echo "Computing checksums..."
node scripts/generate-manifest.js "$OUTPUT_DIR" "$VERSION" > "$OUTPUT_DIR/update-manifest.json"

echo "✅ Extension release created in $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Create GitHub release: v$VERSION"
echo "2. Upload all files from $OUTPUT_DIR"
echo "3. Publish release"
```

---

#### 5.2 Create Manifest Generator
**File:** `scripts/generate-manifest.js`

```javascript
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const REPO_OWNER = 'jarmo-productory';
const REPO_NAME = 'ritemark-public';

async function generateManifest(outputDir, version) {
  const files = await collectFiles(outputDir);
  const fileEntries = [];

  for (const file of files) {
    const relativePath = path.relative(outputDir, file);
    const buffer = await fs.readFile(file);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const size = buffer.length;

    // Construct GitHub download URL
    const filename = path.basename(file);
    const url = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/${filename}`;

    fileEntries.push({
      path: `extensions/ritemark/${relativePath}`,
      url,
      sha256,
      size
    });
  }

  const [appVersion] = version.split('-ext.');

  const manifest = {
    version,
    appVersion,
    extensionVersion: version,
    type: 'extension',
    releaseDate: new Date().toISOString(),
    files: fileEntries,
    releaseNotes: `Extension update ${version}`
  };

  console.log(JSON.stringify(manifest, null, 2));
}

async function collectFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (entry.name !== 'update-manifest.json') {
      files.push(fullPath);
    }
  }

  return files;
}

const [,, outputDir, version] = process.argv;
generateManifest(outputDir, version);
```

---

### Deliverables
- [ ] `create-extension-release.sh` script
- [ ] `generate-manifest.js` script
- [ ] Release process documentation
- [ ] Test manifest generation

### Exit Criteria
- Script generates valid manifest
- Can create test release on GitHub
- Manual test: Download files from release

---

## Phase 6: Testing & QA (Day 4)

### Goal
Comprehensive testing of all update scenarios and edge cases.

### Test Matrix

| Scenario | Expected Result | Status |
|----------|----------------|--------|
| **Happy Path** |
| Extension update 1.0.1 → 1.0.1-ext.1 | Lightweight update succeeds | ⬜ |
| Full update 1.0.1 → 1.1.0 | Opens DMG in browser | ⬜ |
| Reload window after update | Extension loads new code | ⬜ |
| **Error Handling** |
| Network fails during download | Shows error, no changes | ⬜ |
| Checksum mismatch | Rollback, show error | ⬜ |
| Write permission denied | Fall back to DMG | ⬜ |
| User force-quits during update | Restore backup on next launch | ⬜ |
| **Edge Cases** |
| Update from 1.0.1 to 1.0.1-ext.5 | Works (backward compat) | ⬜ |
| Update from 1.0.1-ext.5 to 1.0.1 | Blocks downgrade | ⬜ |
| Manifest not found | Fall back to DMG | ⬜ |
| Multiple rapid update checks | Only one check at a time | ⬜ |
| **Security** |
| Modified file (bad checksum) | Rejects update | ⬜ |
| MITM attack (bad HTTPS cert) | Fetch fails | ⬜ |
| **Performance** |
| 1 MB download completes | <5 seconds | ⬜ |
| Full update flow | <20 seconds end-to-end | ⬜ |

---

### Testing Checklist

#### Unit Tests
- [ ] `updateManifest.ts` (parse, validate)
- [ ] `backupManager.ts` (backup, restore, delete)
- [ ] `fileUtils.ts` (download, checksum, retry)
- [ ] `versionComparison.ts` (all version formats)
- [ ] `lightweightUpdater.ts` (all error paths)

#### Integration Tests
- [ ] Full update flow with mock files
- [ ] Rollback on download failure
- [ ] Rollback on checksum failure
- [ ] Permission check

#### Manual Tests (Production Build)
- [ ] Create test release on GitHub
- [ ] Test extension update
- [ ] Test full update
- [ ] Test rollback scenarios
- [ ] Test on fresh install
- [ ] Test on existing 1.0.1 install

#### Performance Tests
- [ ] Measure download time (1 MB)
- [ ] Measure checksum verification time
- [ ] Measure backup creation time
- [ ] Measure total update time

---

### Exit Criteria
- All automated tests pass
- All manual test scenarios pass
- Performance meets targets (<10 sec)
- No regressions in existing update flow

---

## Phase 7: Documentation (Day 4.5)

### Goal
Document new features, release process, and troubleshooting.

### Documents to Create/Update

#### 7.1 Update Sprint 16 Documentation
**File:** `docs/sprints/sprint-16-auto-update/notes/lightweight-updates.md`

Document how Sprint 20 extends Sprint 16.

---

#### 7.2 Create Release Guide
**File:** `docs/guides/creating-releases.md`

Step-by-step guide for:
- Creating extension-only releases
- Creating full app releases
- Version numbering rules
- Testing releases before publishing

---

#### 7.3 Update CHANGELOG Template
**File:** `docs/releases/TEMPLATE.md`

Add section for extension updates vs full updates.

---

#### 7.4 Create Troubleshooting Guide
**File:** `docs/troubleshooting/update-issues.md`

Common issues and solutions:
- Update failed, how to recover?
- "No write permission" error
- Checksum mismatch error
- Rollback didn't work

---

### Exit Criteria
- All documentation complete
- Reviewed by Jarmo
- No ambiguities or missing steps

---

## Risk Mitigation Strategies

| Risk | Mitigation | Fallback |
|------|------------|----------|
| **Write permission denied** | Check before attempting | Show "Full update required" |
| **Checksum mismatch** | Reject update immediately | User can retry later |
| **Backup corruption** | Verify after creation | Abort update, keep old files |
| **Network timeout** | Retry with exponential backoff | User can retry manually |
| **Force quit during update** | Detect on next launch, auto-restore | Manual reinstall guide |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Update time** | <10 seconds | Timer in code |
| **Download size** | <2 MB | Actual file sizes |
| **Success rate** | >95% | Telemetry (opt-in) |
| **Rollback rate** | <1% | Storage tracking |
| **User satisfaction** | >90% | Survey (optional) |

---

## Post-Sprint Actions

After Sprint 20 completes:

1. **Monitor first release**
   - Watch for error reports
   - Check rollback rate
   - Measure update time

2. **Gather feedback**
   - Survey users about experience
   - Collect edge cases

3. **Iterate**
   - Fix bugs
   - Optimize download speed
   - Improve error messages

4. **Future enhancements**
   - Delta updates (only changed bytes)
   - Background downloads
   - Automatic rollback on extension crash

---

*Roadmap created: 2026-01-12*
