/**
 * Version Service
 *
 * Provides version information for the Ritemark extension.
 * Supports both base versions (1.0.1) and extension builds (1.0.1-ext.5).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getBaseVersion, hasExtensionBuild, getExtensionBuild } from './versionComparison';

/**
 * Version info with parsed components
 */
export interface VersionInfo {
  /** Full version string (e.g., "1.0.1-ext.5") */
  full: string;
  /** App version embedded in product.json */
  app: string;
  /** Base app version (e.g., "1.0.1") */
  base: string;
  /** Extension build number (0 if not an extension build) */
  extensionBuild: number;
  /** Whether this is an extension build */
  isExtensionBuild: boolean;
}

/**
 * Get the current version of Ritemark from the extension's package.json
 */
export function getCurrentVersion(): string {
  const extension = vscode.extensions.getExtension('ritemark.ritemark');
  return extension?.packageJSON?.version ?? '0.0.0';
}

/**
 * Get the current Ritemark app version from product.json.
 * Falls back to the extension base version when product metadata is unavailable.
 */
export function getCurrentAppVersion(): string {
  try {
    const productJsonPath = path.join(vscode.env.appRoot, 'product.json');
    const raw = fs.readFileSync(productJsonPath, 'utf-8');
    const product = JSON.parse(raw) as { ritemarkVersion?: string; version?: string };

    if (product.ritemarkVersion) {
      return product.ritemarkVersion;
    }

    if (product.version) {
      return product.version;
    }
  } catch (error) {
    console.warn('Failed to read current app version from product.json:', error);
  }

  return getBaseVersion(getCurrentVersion());
}

/**
 * Get detailed version info for the current installation
 */
export function getVersionInfo(): VersionInfo {
  const full = getCurrentVersion();
  return {
    full,
    app: getCurrentAppVersion(),
    base: getBaseVersion(full),
    extensionBuild: getExtensionBuild(full),
    isExtensionBuild: hasExtensionBuild(full)
  };
}

/**
 * Get the extension folder name for a given version
 * Used for user extension directory naming
 */
export function getExtensionFolderName(version: string): string {
  return `ritemark-${version}`;
}

/**
 * Parse a folder name to extract version
 * Inverse of getExtensionFolderName
 */
export function parseVersionFromFolderName(folderName: string): string | null {
  if (folderName.startsWith('ritemark-')) {
    return folderName.replace('ritemark-', '');
  }
  return null;
}
