/**
 * Update Manifest Types and Parsing
 *
 * Defines the manifest format for extension-only and full app updates.
 * Manifests are JSON files included in GitHub releases.
 */

/**
 * Individual file in an extension update
 */
export interface UpdateFile {
  /** Relative path within extension (e.g., "out/extension.js") */
  path: string;
  /** Full download URL */
  url: string;
  /** SHA-256 checksum for verification */
  sha256: string;
  /** File size in bytes */
  size: number;
}

/**
 * Update manifest included in GitHub releases
 */
export interface UpdateManifest {
  /** Full version string (e.g., "1.0.1-ext.5" or "1.1.0") */
  version: string;
  /** App/VS Code base version (e.g., "1.0.1") */
  appVersion: string;
  /** Extension version (e.g., "1.0.1-ext.5") */
  extensionVersion: string;
  /** Update type: extension-only or full app */
  type: 'full' | 'extension';
  /** Installation type for extension updates */
  installType?: 'user-extension';
  /** Extension identifier */
  extensionId?: string;
  /** Target folder name (e.g., "ritemark-1.0.1-ext.5") */
  extensionDirName?: string;
  /** ISO 8601 release date */
  releaseDate: string;
  /** Minimum app version required for this update */
  minimumAppVersion?: string;
  /** Files to download for extension updates */
  files?: UpdateFile[];
  /** DMG download URL for full updates (macOS) */
  dmgUrl?: string;
  /** DMG SHA-256 checksum */
  dmgSha256?: string;
  /** DMG size in bytes */
  dmgSize?: number;
  /** Installer download URL for full updates (Windows) */
  installerUrl?: string;
  /** Installer size in bytes */
  installerSize?: number;
  /** Human-readable release notes */
  releaseNotes: string;
}

/**
 * Result of manifest validation
 */
export interface ManifestValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate an update manifest
 */
export function validateManifest(manifest: unknown): ManifestValidation {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest is not an object'] };
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.version !== 'string' || !m.version) {
    errors.push('Missing or invalid version');
  }
  if (typeof m.appVersion !== 'string' || !m.appVersion) {
    errors.push('Missing or invalid appVersion');
  }
  if (typeof m.extensionVersion !== 'string' || !m.extensionVersion) {
    errors.push('Missing or invalid extensionVersion');
  }
  if (m.type !== 'full' && m.type !== 'extension') {
    errors.push('Invalid type: must be "full" or "extension"');
  }
  if (typeof m.releaseDate !== 'string' || !m.releaseDate) {
    errors.push('Missing or invalid releaseDate');
  }
  if (typeof m.releaseNotes !== 'string') {
    errors.push('Missing or invalid releaseNotes');
  }

  // Type-specific validation
  if (m.type === 'extension') {
    if (!Array.isArray(m.files) || m.files.length === 0) {
      errors.push('Extension update must have files array');
    } else {
      // Validate each file
      for (let i = 0; i < m.files.length; i++) {
        const file = m.files[i] as Record<string, unknown>;
        if (typeof file.path !== 'string' || !file.path) {
          errors.push(`files[${i}]: missing path`);
        }
        if (typeof file.url !== 'string' || !file.url) {
          errors.push(`files[${i}]: missing url`);
        }
        if (typeof file.sha256 !== 'string' || !file.sha256) {
          errors.push(`files[${i}]: missing sha256`);
        }
        if (typeof file.size !== 'number' || file.size <= 0) {
          errors.push(`files[${i}]: invalid size`);
        }
      }
    }
    if (typeof m.extensionDirName !== 'string' || !m.extensionDirName) {
      errors.push('Extension update must have extensionDirName');
    }
  }

  if (m.type === 'full') {
    const hasDmgUrl = typeof m.dmgUrl === 'string' && m.dmgUrl;
    const hasInstallerUrl = typeof m.installerUrl === 'string' && m.installerUrl;
    if (!hasDmgUrl && !hasInstallerUrl) {
      errors.push('Full update must have dmgUrl or installerUrl');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse manifest JSON with validation
 */
export function parseManifest(json: string): UpdateManifest | null {
  try {
    const parsed = JSON.parse(json);
    const validation = validateManifest(parsed);

    if (!validation.valid) {
      console.error('Invalid manifest:', validation.errors);
      return null;
    }

    return parsed as UpdateManifest;
  } catch (error) {
    console.error('Failed to parse manifest JSON:', error);
    return null;
  }
}

/**
 * Check if manifest is for an extension-only update
 */
export function isExtensionUpdate(manifest: UpdateManifest): boolean {
  return manifest.type === 'extension';
}

/**
 * Check if manifest is for a full app update
 */
export function isFullUpdate(manifest: UpdateManifest): boolean {
  return manifest.type === 'full';
}

/**
 * Calculate total download size for an extension update
 */
export function getTotalDownloadSize(manifest: UpdateManifest): number {
  if (manifest.type === 'extension' && manifest.files) {
    return manifest.files.reduce((sum, file) => sum + file.size, 0);
  }
  if (manifest.type === 'full') {
    return manifest.installerSize || manifest.dmgSize || 0;
  }
  return 0;
}

/**
 * Format download size for display
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
