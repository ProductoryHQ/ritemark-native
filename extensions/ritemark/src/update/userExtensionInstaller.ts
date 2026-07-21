/**
 * User Extension Installer
 *
 * Downloads and installs extension updates to the user extension directory.
 * This approach preserves code signing by not modifying the app bundle.
 *
 * Target: ~/.ritemark/extensions/ritemark-{version}/
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { UpdateManifest, UpdateFile, isContainedRelativePath } from './updateManifest';
import { compareVersions } from './versionComparison';
import { getCurrentAppVersion } from './versionService';
import { findBundledExtensionDir } from './bundledExtensionPath';

const execFileAsync = promisify(execFile);

/**
 * Progress callback for download operations
 */
export type ProgressCallback = (downloaded: number, total: number) => void;

/**
 * Result of an update installation
 */
export interface InstallResult {
  success: boolean;
  version?: string;
  error?: string;
}

/**
 * User Extension Installer
 *
 * Handles downloading and installing extension updates to user space.
 * Uses a staging directory for atomic installs.
 */
export class UserExtensionInstaller {
  private userDataPath: string;
  private stagingDir: string;
  private extensionsDir: string;

  /**
   * @param userDataPathOverride Test-only escape hatch. Production code must
   * never pass this — always resolves to ~/.ritemark/ (matches VS Code's
   * dataFolderName in product.json).
   */
  constructor(userDataPathOverride?: string) {
    this.userDataPath = userDataPathOverride ?? path.join(os.homedir(), '.ritemark');
    this.stagingDir = path.join(this.userDataPath, 'staging');
    this.extensionsDir = path.join(this.userDataPath, 'extensions');
  }

  /**
   * Get the user extensions directory path
   */
  getExtensionsDir(): string {
    return this.extensionsDir;
  }

  /**
   * Get the staging directory path
   */
  getStagingDir(): string {
    return this.stagingDir;
  }

  /**
   * Check if user extensions directory exists and is writable
   */
  async checkWriteAccess(): Promise<boolean> {
    try {
      await this.ensureDir(this.userDataPath);
      const testFile = path.join(this.userDataPath, '.write-test');
      await fs.promises.writeFile(testFile, 'test');
      await fs.promises.unlink(testFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Apply an extension update from manifest
   */
  async applyUpdate(
    manifest: UpdateManifest,
    onProgress?: ProgressCallback
  ): Promise<InstallResult> {
    if (manifest.type !== 'extension') {
      return {
        success: false,
        error: 'Manifest is not for extension update'
      };
    }

    if (!manifest.files || manifest.files.length === 0) {
      return {
        success: false,
        error: 'No files in manifest'
      };
    }

    if (!manifest.extensionDirName) {
      return {
        success: false,
        error: 'Missing extensionDirName in manifest'
      };
    }

    // The resolver already refuses incompatible releases, but the installer is the
    // last gate before anything touches disk and must not trust its caller.
    if (manifest.minimumAppVersion) {
      const appVersion = getCurrentAppVersion();
      if (compareVersions(appVersion, manifest.minimumAppVersion) < 0) {
        return {
          success: false,
          error: `Update requires app version ${manifest.minimumAppVersion}, but this app is ${appVersion}`
        };
      }
    }

    // The bundled copy is the base layer for every install. Without it we would be
    // installing a bare delta — the exact shape of incident v1.8.3-ext.1 — so this
    // fails closed rather than falling back to a partial directory.
    const bundledDir = findBundledExtensionDir();
    if (!bundledDir) {
      return {
        success: false,
        error: 'Could not locate the bundled extension to update from'
      };
    }

    const targetDir = path.join(this.extensionsDir, manifest.extensionDirName);
    const stagingTarget = path.join(this.stagingDir, manifest.extensionDirName);

    try {
      // Already installed AND loadable — nothing to do. A previously installed but
      // broken directory must NOT short-circuit here, or a corrected re-release of
      // the same version would silently no-op for exactly the users who need it.
      if (await this.exists(targetDir)) {
        if (await this.looksInstallable(targetDir)) {
          return {
            success: true,
            version: manifest.version,
            error: 'Already installed'
          };
        }
        await this.removeDir(targetDir);
      }

      // Step 1: Ensure directories exist, and clear any staging left by a crash
      await this.ensureDir(this.stagingDir);
      await this.ensureDir(this.extensionsDir);
      await this.removeDir(stagingTarget);

      // Step 2: Clone the bundled extension as the base layer
      await this.cloneDir(bundledDir, stagingTarget);

      // Step 3: Overlay the downloaded delta on top of the clone
      await this.downloadFilesToStaging(manifest.files, stagingTarget, onProgress);

      // Step 4: Verify all checksums
      await this.verifyAllChecksums(manifest.files, stagingTarget);

      // Step 5: Atomic move from staging to extensions
      await fs.promises.rename(stagingTarget, targetDir);

      return {
        success: true,
        version: manifest.version
      };

    } catch (error) {
      // Cleanup staging on any error
      await this.removeDir(stagingTarget);

      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Cheap structural check that an extension directory is worth keeping.
   *
   * Deliberately not a full integrity check — it exists to catch the incident
   * shape (a delta-only tree with no dependencies) so a repaired re-release of the
   * same version can replace it.
   */
  private async looksInstallable(dirPath: string): Promise<boolean> {
    return await this.exists(path.join(dirPath, 'package.json'))
      && await this.exists(path.join(dirPath, 'node_modules'));
  }

  /**
   * Copy a directory tree.
   *
   * macOS: `cp -c -R` uses clonefile(2), which shares blocks with the source and so
   * costs near-zero time and disk. It falls back to copyfile(2) on its own when the
   * target filesystem cannot clone, so no explicit fallback branch is needed.
   * Elsewhere: a plain recursive copy.
   */
  private async cloneDir(sourceDir: string, targetDir: string): Promise<void> {
    if (process.platform === 'darwin') {
      await execFileAsync('/bin/cp', ['-c', '-R', sourceDir, targetDir]);
      return;
    }
    await fs.promises.cp(sourceDir, targetDir, { recursive: true });
  }

  /**
   * Prompt user to reload window after successful update
   */
  async promptReload(version: string): Promise<void> {
    const reload = await vscode.window.showInformationMessage(
      `Extension updated to ${version}. Reload to apply changes.`,
      'Reload Window'
    );

    if (reload === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }

  /**
   * Cleanup old extension versions, keeping only the specified versions.
   *
   * Sprint 93 R9: accepts multiple versions (not just one) so a successful
   * update can keep N-1 alongside current — a rollback target stays on disk
   * instead of every prior version being deleted the moment a new one
   * activates.
   *
   * #142 guard (bug B): never delete a version NEWER than everything in the
   * keep list. Such a version is a staged update waiting for a restart, not
   * stale garbage. Without this, the built-in floor's own activation
   * (keepVersions = ['X.Y.Z-0']) would delete the freshly-staged
   * 'X.Y.Z-ext.N' before it ever gets a chance to load.
   */
  async cleanupOldVersions(keepVersions: string[]): Promise<void> {
    try {
      if (!await this.exists(this.extensionsDir)) {
        return;
      }

      const keepDirNames = new Set(keepVersions.map(v => `ritemark-${v}`));
      const newestKeep = keepVersions.reduce<string | null>(
        (max, v) => (max === null || compareVersions(v, max) > 0 ? v : max),
        null
      );
      const entries = await fs.promises.readdir(this.extensionsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() ||
            !entry.name.startsWith('ritemark-') ||
            keepDirNames.has(entry.name)) {
          continue;
        }

        const version = entry.name.replace('ritemark-', '');
        if (newestKeep !== null && compareVersions(version, newestKeep) > 0) {
          // Staged update newer than anything we keep — preserve it so a
          // pending restart can load it (#142 bug B).
          console.log(`Preserving staged newer extension version: ${entry.name}`);
          continue;
        }

        const dirPath = path.join(this.extensionsDir, entry.name);
        console.log(`Cleaning up old extension version: ${entry.name}`);
        await this.removeDir(dirPath);
      }
    } catch (error) {
      console.error('Failed to cleanup old versions:', error);
    }
  }

  /**
   * Remove a single installed version's directory outright (Sprint 93 R9
   * quarantine path — a version whose prior activation attempt never confirmed,
   * detected on its next launch).
   */
  async removeInstalledVersion(version: string): Promise<void> {
    const dirPath = path.join(this.extensionsDir, `ritemark-${version}`);
    console.warn(`Quarantining extension version: ritemark-${version}`);
    await this.removeDir(dirPath);
  }

  /**
   * Cleanup staging directory
   */
  async cleanupStaging(): Promise<void> {
    try {
      await this.removeDir(this.stagingDir);
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * List installed user extension versions
   */
  async listInstalledVersions(): Promise<string[]> {
    try {
      if (!await this.exists(this.extensionsDir)) {
        return [];
      }

      const entries = await fs.promises.readdir(this.extensionsDir, { withFileTypes: true });
      const versions: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('ritemark-')) {
          // Extract version from folder name: ritemark-1.0.1-ext.5 → 1.0.1-ext.5
          const version = entry.name.replace('ritemark-', '');
          versions.push(version);
        }
      }

      return versions;
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────

  private async downloadFilesToStaging(
    files: UpdateFile[],
    stagingTarget: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    await this.ensureDir(stagingTarget);

    let downloadedBytes = 0;
    const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);

    for (const file of files) {
      const targetPath = this.resolveInStaging(stagingTarget, file.path);

      if (file.op === 'delete') {
        await fs.promises.rm(targetPath, { recursive: true, force: true });
        continue;
      }

      if (!file.url) {
        throw new Error(`Manifest entry ${file.path} has no url`);
      }

      await this.ensureDir(path.dirname(targetPath));

      const buffer = await this.downloadFile(file.url);
      await fs.promises.writeFile(targetPath, buffer);

      downloadedBytes += file.size ?? buffer.length;
      onProgress?.(downloadedBytes, totalBytes);
    }
  }

  /**
   * Resolve a manifest path inside staging, refusing anything that escapes it.
   *
   * `validateManifest` performs the same check, but a manifest can reach the
   * installer without having gone through it, and the checksums are no help here —
   * they live in the same manifest they would be protecting against.
   */
  private resolveInStaging(stagingTarget: string, relativePath: string): string {
    if (!isContainedRelativePath(relativePath)) {
      throw new Error(`Refusing path outside the extension directory: ${relativePath}`);
    }

    const resolved = path.resolve(stagingTarget, relativePath);
    const root = path.resolve(stagingTarget) + path.sep;
    if (!resolved.startsWith(root)) {
      throw new Error(`Refusing path outside the extension directory: ${relativePath}`);
    }

    return resolved;
  }

  private async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Ritemark-Native'
      }
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async verifyAllChecksums(
    files: UpdateFile[],
    stagingTarget: string
  ): Promise<void> {
    for (const file of files) {
      if (file.op === 'delete') {
        if (await this.exists(path.join(stagingTarget, file.path))) {
          throw new Error(`Failed to delete ${file.path}`);
        }
        continue;
      }

      const filePath = this.resolveInStaging(stagingTarget, file.path);
      const buffer = await fs.promises.readFile(filePath);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      if (hash !== file.sha256) {
        throw new Error(`Checksum mismatch for ${file.path}: expected ${file.sha256}, got ${hash}`);
      }
    }
  }

  private async ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  private async removeDir(dirPath: string): Promise<void> {
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Checksum Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate SHA-256 checksum of a file
 */
export async function calculateChecksum(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Calculate SHA-256 checksum of a buffer
 */
export function calculateBufferChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Verify a file against expected checksum
 */
export async function verifyChecksum(
  filePath: string,
  expectedSha256: string
): Promise<boolean> {
  const actual = await calculateChecksum(filePath);
  return actual === expectedSha256;
}
