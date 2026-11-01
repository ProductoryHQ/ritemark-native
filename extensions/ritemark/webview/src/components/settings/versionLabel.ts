/**
 * Sprint 145 (R7, #595): the extension's version as Settings shows it.
 *
 * A production build floors the bundled extension's version to `X.Y.Z-0`
 * (`scripts/floor-bundled-extension.sh`, #142), so that an over-the-air
 * `X.Y.Z-ext.N` update always wins VS Code's extension scanner. That floor is a
 * build detail: people know the version as `X.Y.Z`. Only the label drops it;
 * the update code (`src/update/`) keeps comparing the floored value.
 *
 * A bare `-0` at the end goes, and nothing else: an update's own `-ext.N` shows
 * as it is, and so does any other value, an empty one included.
 */
export function extensionVersionLabel(version: string): string {
  return version.replace(/-0$/, '')
}
