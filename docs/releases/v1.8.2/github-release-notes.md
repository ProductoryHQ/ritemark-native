Ritemark v1.8.2 — sturdier, faster, and now installable on Windows.

## Windows 11 support
- **Installs cleanly on a default Windows 11 machine**, with a signed installer — the previous "unknown publisher" / Smart App Control blocks are resolved.
- OneDrive and SharePoint files that can't be read now show a clear, actionable message instead of a cryptic error.
- New File / New Folder buttons render correctly in the File Browser on Windows.

## More reliable under the hood
- The extension host now ships as a single bundled build (esbuild), fixing a class of intermittent startup/build issues and making the app boot cleaner. Mostly invisible — you just hit fewer glitches.

## Fixes & polish
- Various stability and correctness fixes across the editor and agent runtimes.

## Notes
- **macOS builds (Apple Silicon + Intel) are published now; the Windows installer follows shortly.** Until it lands, Windows stays on the previous version.
- Groundwork for one-click background updates is included in this build and will be completed in a follow-up release.

Both macOS downloads are signed and notarized by Apple — no Gatekeeper warnings.
