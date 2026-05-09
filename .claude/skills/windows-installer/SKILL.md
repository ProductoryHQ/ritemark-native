---
name: windows-installer
description: Build Ritemark Windows installer from CI artifact — fetch, patch, strip, build with Inno Setup, upload to GitHub release. Use when building Windows installer locally on a Windows machine, or when the release-manager agent needs Windows-specific commands.
allowed-tools: Read, Bash, Glob, Grep, Edit
metadata:
  version: 1.0.0
---

# Windows Installer Skill

End-to-end procedure for building the Ritemark Windows installer from a GitHub Actions CI artifact on a local Windows machine.

## When to use

- Building a Windows `.exe` installer from a CI-produced `VSCode-win32-x64` artifact
- The release-manager agent delegates Windows installer work
- Debugging why the installer is broken (wrong size, missing icons, unwanted UI elements)

## Prerequisites

| Tool | Required | Check |
|------|----------|-------|
| Inno Setup 6.x | Yes | `"C:/Program Files (x86)/Inno Setup 6/ISCC.exe"` |
| GitHub CLI | Yes | `gh --version` |
| rcedit | Yes | Found in `vscode/node_modules/rcedit/bin/rcedit.exe` or install globally |
| Node.js | Yes | `node --version` |

## Step-by-step procedure

### Step 1 — Find and download CI artifact

```bash
# List recent Windows builds
gh run list -w "Build Windows (x64)" -R ProductoryHQ/ritemark-native --limit 5

# Download the successful run (replace RUN_ID)
rm -rf VSCode-win32-x64  # clean slate
gh run download RUN_ID -R ProductoryHQ/ritemark-native -n ritemark-windows-x64 -D VSCode-win32-x64
```

### Step 2 — Verify artifact

```bash
# Must exist
ls VSCode-win32-x64/Ritemark.exe

# Version check — must match target release
grep -o '"ritemarkVersion":"[^"]*"' VSCode-win32-x64/resources/app/product.json

# Webview bundle — must be >500KB (typically ~7MB)
wc -c < VSCode-win32-x64/resources/app/extensions/ritemark/media/webview.js

# Extension node_modules — must have packages
ls VSCode-win32-x64/resources/app/extensions/ritemark/node_modules/ | wc -l
```

### Step 3 — Patch exe icon

```bash
# Find rcedit
RCEDIT="vscode/node_modules/rcedit/bin/rcedit.exe"
# Apply branding icon
"$RCEDIT" "VSCode-win32-x64/Ritemark.exe" --set-icon "branding/icons/icon.ico"
```

### Step 4 — Strip copilot extension (MANDATORY)

VS Code 1.117+ bundles GitHub Copilot Chat as a built-in extension (~254MB). It adds a "Chat Debug" icon to the activity bar. The CI build should strip it (step added in sprint 57), but always verify.

```bash
rm -rf "VSCode-win32-x64/resources/app/extensions/copilot"
```

### Step 5 — Apply CSS chat icon hide (MANDATORY)

Even with copilot removed, VS Code core registers a "Chat" view container. Patch 003 suppresses it in source, but if it leaks through, CSS catches it. **Two selectors are needed** — the core uses `workbench-panel-chat` class, the extension uses `copilot-chat` class.

```bash
CSS_FILE="VSCode-win32-x64/resources/app/out/vs/workbench/workbench.desktop.main.css"
printf '\n/* Ritemark: hide VS Code chat view container from activity bar */
.activitybar .action-item a[class*="workbench-panel-chat"] { display: none !important; }
.activitybar .action-item:has(a[class*="workbench-panel-chat"]) { display: none !important; }
.activitybar .action-item a[class*="copilot-chat"] { display: none !important; }
.activitybar .action-item:has(a[class*="copilot-chat"]) { display: none !important; }
' >> "$CSS_FILE"
```

### Step 6 — Update installer version

Edit `installer/windows/ritemark.iss` line 21 — set `AppVersion` to match the release.

### Step 7 — Build installer

**CRITICAL: Always use absolute SourcePath.** Relative paths break when ISCC is invoked from bash.

```bash
"C:/Program Files (x86)/Inno Setup 6/ISCC.exe" \
  /DSourcePath="C:\dev\ritemark-native\Ritemark\VSCode-win32-x64" \
  "C:/dev/ritemark-native/Ritemark/installer/windows/ritemark.iss"
```

Run as background task — takes ~5-8 minutes.

### Step 8 — Verify output

```bash
ls -lh installer-output/Ritemark-X.Y.Z-win32-x64-setup.exe
```

| Size | Meaning |
|------|---------|
| **150-260MB** | Correct |
| **~2MB** | SourcePath didn't resolve — rebuild with absolute path |
| **>300MB** | Copilot extension not stripped |

### Step 9 — Upload to GitHub release

Upload ONLY the canonical `Ritemark-Setup.exe`. Do NOT upload the versioned filename.

```bash
cp installer-output/Ritemark-X.Y.Z-win32-x64-setup.exe installer-output/Ritemark-Setup.exe
gh release upload vX.Y.Z "installer-output/Ritemark-Setup.exe" --clobber -R jarmo-productory/ritemark-public
```

### Step 10 — Update release notes

After uploading, ALWAYS:
1. Run `gh release view vX.Y.Z -R jarmo-productory/ritemark-public` to check current notes
2. Replace any "Windows coming later" placeholder with `Windows x64 | Ritemark-Setup.exe`
3. Remove trailing "follow-up" notes about Windows
4. Use `gh release edit vX.Y.Z --notes-file <file> -R jarmo-productory/ritemark-public`

## Hard rules

1. **NEVER** use relative SourcePath with ISCC — always pass `/DSourcePath=` with absolute Windows path
2. **NEVER** upload versioned installer to GitHub release — only canonical `Ritemark-Setup.exe`
3. **ALWAYS** strip copilot extension before building installer
4. **ALWAYS** apply BOTH CSS selectors (`workbench-panel-chat` AND `copilot-chat`)
5. **ALWAYS** verify installer size is >100MB after build
6. **ALWAYS** update release notes after uploading — remove "coming later" text

## Gotchas and past incidents

### Installer is 2MB instead of 150MB+

**Cause:** ISCC relative `SourcePath` doesn't resolve when called from bash. The `.iss` file has `#define SourcePath "..\..\VSCode-win32-x64"` as fallback, but Inno Setup path resolution differs between GUI and CLI invocation from bash.

**Fix:** Always pass `/DSourcePath="C:\dev\ritemark-native\Ritemark\VSCode-win32-x64"` explicitly.

### Chat Debug icon appears in activity bar

**Cause:** Two sources — the bundled copilot extension AND VS Code core's chat view container registration. Both must be addressed.

**Fix:** Strip copilot extension + CSS hide with BOTH selectors. The element classes are different:
- Core: `activity-workbench-panel-chat`
- Extension: `activity-workbench-view-extension-copilot-chat-*`

This was a recurring regression across v1.6.0, v1.6.1, and v1.6.3 because only one selector was used initially.

### Activity bar icons broken (1K+ fallback)

**Cause:** Product icon theme references Phosphor font from `node_modules/@phosphor-icons/web/` which is a devDependency — absent in production builds.

**Fix (applied v1.6.0):** Font file bundled into `extensions/ritemark/producticons/Phosphor-Regular.woff2` with local path reference in theme JSON. This is now committed and permanent.

### Versioned + canonical installer both uploaded

**Cause:** Early releases uploaded both `Ritemark-X.Y.Z-win32-x64-setup.exe` and `Ritemark-Setup.exe`.

**Fix:** Only upload `Ritemark-Setup.exe`. If both exist on a release, delete the versioned one: `gh release delete-asset vX.Y.Z "Ritemark-X.Y.Z-win32-x64-setup.exe" -R jarmo-productory/ritemark-public -y`

## Linux/Docker alternative (from macOS)

The `scripts/create-windows-installer.sh` script uses Docker with the `amake/innosetup` image. Key differences:

- Requires Docker Desktop running
- Uses Wine under the hood — path separators differ
- Mount the project root as `/work`
- Version extracted from `vscode/package.json` (not extension package.json)
- Pre-flight checks for bundled agent runtimes (Sprint 64)

```bash
./scripts/create-windows-installer.sh
```

Note: rcedit icon patching may not work via Docker/Wine. Plan to handle icon patching on the Windows machine if needed.

## Files reference

| File | Purpose |
|------|---------|
| `installer/windows/ritemark.iss` | Inno Setup script |
| `scripts/create-windows-installer.sh` | Docker-based build (macOS/Linux) |
| `scripts/build-windows-local.ps1` | Full Windows build from source (PowerShell) |
| `.github/workflows/build-windows.yml` | CI workflow (produces artifact) |
| `branding/icons/icon.ico` | Windows app icon |
