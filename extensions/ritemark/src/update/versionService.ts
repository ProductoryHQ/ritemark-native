import * as vscode from 'vscode';

/**
 * Get the current version of RiteMark from the extension's package.json
 * which inherits the version from branding/product.json
 */
export function getCurrentVersion(): string {
  const extension = vscode.extensions.getExtension('ritemark.ritemark');
  return extension?.packageJSON?.version ?? '0.0.0';
}
