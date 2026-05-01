# v1.6.1 Marketing — Under the Hood

**Status:** Draft (open - more to come)

## One-liner

Ritemark v1.6.1 upgrades the VS Code engine to 1.117.0 and fixes text selection, AI file writes, and explorer refresh.

## Social post (short)

Ritemark v1.6.1 — the engine upgrade release. VS Code jumps from 1.109.5 to 1.117.0 (8 upstream releases), plus fixes for text selection visibility and AI file-write reliability. No new features, just a better foundation.

## Changelog entry

### v1.6.1

- Upgraded VS Code engine from 1.109.5 to 1.117.0
- Fixed text selection visibility in code blocks and table cells
- Fixed AI Flow file writes routing through vscode.workspace.fs
- Added file explorer auto-refresh after agent writes + manual refresh button
- Fixed document header hook sentinel
- Rebased all 6 Ritemark patches on new VS Code base
