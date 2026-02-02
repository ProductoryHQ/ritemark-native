# Building Ritemark Native Installers

This guide covers how to build distributable installers for macOS and Windows.

---

## Prerequisites

### All Platforms
- Node.js 20.x or later
- Yarn 1.x
- VS Code dependencies installed (`cd vscode && yarn`)

### macOS DMG
```bash
brew install create-dmg
```

### Windows Cross-Compile
```bash
brew install imagemagick  # For icon.ico creation
```

---

## Quick Start

### Build Everything

```bash
# 1. Build macOS production app
cd vscode && yarn gulp vscode-darwin-arm64

# 2. Create macOS DMG
./scripts/create-dmg.sh

# 3. Build Windows (cross-compile)
./scripts/build-windows.sh
```

### Output Files

After building, find installers in `dist/`:

```
dist/
├── Ritemark-Native-{version}-darwin-arm64.dmg
├── Ritemark-Native-{version}-darwin-arm64.dmg.sha256
├── Ritemark-Native-{version}-win32-x64.zip
└── Ritemark-Native-{version}-win32-x64.zip.sha256
```

---

## macOS DMG

### Script: `scripts/create-dmg.sh`

Creates a professional DMG installer with drag-to-Applications UI.

```bash
./scripts/create-dmg.sh
```

**Prerequisites:**
- Built app at `VSCode-darwin-arm64/Ritemark Native.app`
- `create-dmg` tool installed

**Output:**
- `dist/Ritemark-Native-{version}-darwin-arm64.dmg`
- `dist/Ritemark-Native-{version}-darwin-arm64.dmg.sha256`

### DMG Properties

| Property | Value |
|----------|-------|
| Volume Name | Ritemark Native |
| Window Size | 800x400 |
| Icon Size | 100x100 |
| Volume Icon | branding/icons/icon.icns |

### Customization

Edit `scripts/create-dmg.sh` to change:
- Window size: `--window-size 800 400`
- Icon positions: `--icon "..." 200 190` and `--app-drop-link 600 185`
- Background image: Add `--background "path/to/image.png"`

---

## Windows ZIP

### Script: `scripts/build-windows.sh`

Cross-compiles Windows application from macOS and packages as ZIP.

```bash
./scripts/build-windows.sh
```

**Prerequisites:**
- Node.js 20.x
- ImageMagick (for icon conversion)

**Output:**
- `VSCode-win32-x64/` - Application folder
- `dist/Ritemark-Native-{version}-win32-x64.zip`
- `dist/Ritemark-Native-{version}-win32-x64.zip.sha256`

### Windows Icon

The script automatically:
1. Converts `branding/icons/Icon-256.png` to `icon.ico`
2. Copies to `vscode/resources/win32/code.ico`

To manually create icon:
```bash
magick branding/icons/Icon-256.png \
    -define icon:auto-resize=256,128,64,48,32,16 \
    branding/icons/icon.ico
```

### Creating an Installer (Advanced)

The ZIP distribution works well, but if you want an actual installer:

**Option 1: Wine + InnoSetup**
```bash
brew install wine-stable
# Then use VS Code's built-in installer task
cd vscode && yarn gulp vscode-win32-x64-inno-updater
```

**Option 2: Docker**
```bash
docker run --rm -i \
  -v "$PWD/build/win32:/work" \
  -v "$PWD/../VSCode-win32-x64:/source" \
  amake/innosetup code.iss
```

---

## Build Times

| Target | Time |
|--------|------|
| macOS App | ~25 min |
| macOS DMG | ~30 sec |
| Windows App | ~25 min |
| Windows ZIP | ~1 min |

---

## Troubleshooting

### DMG creation fails

1. Ensure app exists: `ls VSCode-darwin-arm64/Ritemark\ Native.app`
2. Check create-dmg: `which create-dmg`
3. Check icon: `ls branding/icons/icon.icns`

### Windows build fails

1. Check Node version: `node -v` (need 20.x+)
2. Clean and retry: `rm -rf VSCode-win32-x64 out-build`
3. Check for disk space

### Icon not showing

**macOS:** Clear icon cache
```bash
sudo rm -rf /Library/Caches/com.apple.iconservices.store
killall Dock
```

**Windows:** Refresh icon cache (on Windows machine)
```cmd
ie4uinit.exe -ClearIconCache
```

---

## Code Signing (Future)

Current installers are **unsigned**. For production distribution:

### macOS
1. Enroll in Apple Developer Program ($99/year)
2. Create Developer ID Application certificate
3. Sign app: `codesign --deep --sign "Developer ID" Ritemark\ Native.app`
4. Notarize: `xcrun notarytool submit ...`
5. Staple: `xcrun stapler staple Ritemark\ Native.app`

### Windows
1. Purchase code signing certificate (~$100-500/year)
2. Sign with signtool: `signtool sign /f cert.pfx /p password installer.exe`

---

## CI/CD Integration

For automated builds, add to GitHub Actions:

```yaml
jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: yarn --frozen-lockfile
      - run: yarn gulp vscode-darwin-arm64
      - run: ./scripts/create-dmg.sh
      - uses: actions/upload-artifact@v4
        with:
          name: macos-dmg
          path: dist/*.dmg

  build-windows:
    runs-on: macos-latest  # Cross-compile from macOS
    steps:
      - uses: actions/checkout@v4
      - run: brew install imagemagick
      - run: yarn --frozen-lockfile
      - run: ./scripts/build-windows.sh
      - uses: actions/upload-artifact@v4
        with:
          name: windows-zip
          path: dist/*.zip
```

---

## References

- [create-dmg](https://github.com/create-dmg/create-dmg)
- [VS Code Build Instructions](https://github.com/microsoft/vscode/wiki/How-to-Contribute)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
