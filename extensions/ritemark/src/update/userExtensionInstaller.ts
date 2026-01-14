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
import { UpdateManifest, UpdateFile } from './updateManifest';

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

  constructor() {
    // ~/.ritemark/ (matches VS Code's dataFolderName in product.json)
    this.userDataPath = path.join(os.homedir(), '.ritemark');
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

    const targetDir = path.join(this.extensionsDir, manifest.extensionDirName);
    const stagingTarget = path.join(this.stagingDir, manifest.extensionDirName);

    try {
      // Check if already installed
      if (await this.exists(targetDir)) {
        return {
          success: true,
          version: manifest.version,
          error: 'Already installed'
        };
      }

      // Step 1: Ensure directories exist
      await this.ensureDir(this.stagingDir);
      await this.ensureDir(this.extensionsDir);

      // Step 2: Download all files to staging
      await this.downloadFilesToStaging(manifest.files, stagingTarget, onProgress);

      // Step 3: Verify all checksums
      await this.verifyAllChecksums(manifest.files, stagingTarget);

      // Step 4: Atomic move from staging to extensions
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
   * Cleanup old extension versions, keeping only the specified version
   */
  async cleanupOldVersions(keepVersion: string): Promise<void> {
    try {
      if (!await this.exists(this.extensionsDir)) {
        return;
      }

      const entries = await fs.promises.readdir(this.extensionsDir, { withFileTypes: true });
      const keepDirName = `ritemark-${keepVersion}`;

      for (const entry of entries) {
        if (entry.isDirectory() &&
            entry.name.startsWith('ritemark-') &&
            entry.name !== keepDirName) {
          const dirPath = path.join(this.extensionsDir, entry.name);
          console.log(`Cleaning up old extension version: ${entry.name}`);
          await this.removeDir(dirPath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old versions:', error);
    }
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
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

    for (const file of files) {
      const targetPath = path.join(stagingTarget, file.path);
      await this.ensureDir(path.dirname(targetPath));

      const buffer = await this.downloadFile(file.url);
      await fs.promises.writeFile(targetPath, buffer);

      downloadedBytes += file.size;
      onProgress?.(downloadedBytes, totalBytes);
    }
  }

  private async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RiteMark-Native'
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
      const filePath = path.join(stagingTarget, file.path);
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
