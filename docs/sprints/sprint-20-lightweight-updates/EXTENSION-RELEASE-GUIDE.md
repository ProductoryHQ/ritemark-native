# Extension-Only Release Guide

This guide explains how to create and publish extension-only updates for RiteMark Native.

## Overview

Extension-only updates allow shipping bug fixes and features without requiring users to download the full DMG (~500MB). Instead, users download only the changed extension files (~1MB) which are installed to their user extension directory.

## Prerequisites

1. Extension compiled: `npm run compile` in `extensions/ritemark`
2. Webview built: `npm run build` in `extensions/ritemark/webview`
3. GitHub CLI installed: `gh` command available
4. Write access to `jarmo-productory/ritemark-public` repository

## Version Format

Extension-only releases use the format: `{appVersion}-ext.{build}`

Examples:
- `1.0.1-ext.1` - First extension update for app 1.0.1
- `1.0.1-ext.2` - Second extension update for app 1.0.1
- `1.1.0` - Full app update (resets extension build)

## Release Process

### Step 1: Update Extension Version

Edit `extensions/ritemark/package.json`:

```json
{
  "version": "1.0.1-ext.1"
}
```

### Step 2: Build Extension

```bash
cd extensions/ritemark
npm run compile
cd webview
npm run build
```

### Step 3: Generate Release Files

```bash
./scripts/create-extension-release.sh 1.0.1-ext.1
```

This creates:
- `release-staging/upload/` directory with all files
- `update-manifest.json` with checksums and URLs

### Step 4: Create GitHub Release

```bash
gh release create v1.0.1-ext.1 \
  --title "v1.0.1-ext.1" \
  --notes "Extension update: <describe changes>" \
  release-staging/upload/*
```

Or manually:
1. Go to GitHub → Releases → Draft new release
2. Tag: `v1.0.1-ext.1`
3. Title: `v1.0.1-ext.1`
4. Upload all files from `release-staging/upload/`

### Step 5: Verify Release

1. Check release assets are uploaded
2. Verify `update-manifest.json` is accessible:
   ```
   https://github.com/jarmo-productory/ritemark-public/releases/download/v1.0.1-ext.1/update-manifest.json
   ```

## How It Works

### User Flow

1. RiteMark checks for updates on startup
2. Downloads `update-manifest.json` from latest release
3. Detects update type (extension vs full)
4. For extension updates:
   - Shows notification with download size
   - Downloads files to staging directory
   - Verifies SHA-256 checksums
   - Moves to user extension directory
   - Prompts to reload window

### File Locations

| Location | Purpose |
|----------|---------|
| `~/.ritemark/extensions/ritemark-{version}/` | Installed user extensions |
| `~/.ritemark/staging/` | Temporary download location |
| `RiteMark.app/.../extensions/ritemark/` | Bundled extension (fallback) |

### VS Code Loading Priority

VS Code loads extensions in this order:
1. User extensions (higher version wins)
2. Bundled extensions (fallback)

This means a user extension `1.0.1-ext.5` will override bundled `1.0.1`.

## Troubleshooting

### Update Not Showing

- Check GitHub release is published (not draft)
- Verify `update-manifest.json` is included in release assets
- Check version in manifest is newer than installed version

### Checksum Mismatch

- Regenerate release files with `create-extension-release.sh`
- Ensure files weren't modified after manifest generation

### Extension Not Loading

- Check VS Code Developer Tools console for errors
- Verify files exist in `~/.ritemark/extensions/`
- Bundled extension should work as fallback

## Files Included in Extension Updates

```
out/extension.js
out/ritemarkEditor.js
out/update/*.js
out/export/*.js
media/webview.js
media/webview.js.map
package.json
```

## Security

- All files verified by SHA-256 checksum
- Downloads over HTTPS only
- Staging directory used for atomic installs
- Downgrades explicitly rejected

## Cleanup

Old extension versions are automatically cleaned up after successful update. Only the current version is kept in `~/.ritemark/extensions/`.
