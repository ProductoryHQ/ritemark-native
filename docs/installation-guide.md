# Ritemark Native Installation Guide

This guide covers installing Ritemark Native on macOS and Windows.

---

## macOS Installation

### Download

Download the latest DMG from [Releases](https://github.com/your-repo/releases):
- `Ritemark-Native-{version}-darwin-arm64.dmg` (Apple Silicon)

### Verify Download (Optional)

```bash
shasum -a 256 Ritemark-Native-*.dmg
# Compare with .sha256 file
```

### Install

1. Double-click the DMG file to mount it
2. Drag **Ritemark Native** to the **Applications** folder
3. Wait for the copy to complete
4. Eject the DMG (right-click > Eject)

### First Launch (Gatekeeper)

Since Ritemark Native is not signed with an Apple Developer certificate, macOS will show a security warning on first launch:

1. Open **Applications** folder in Finder
2. **Right-click** (or Control-click) on **Ritemark Native**
3. Select **Open** from the context menu
4. Click **Open** in the dialog that appears

After this, subsequent launches will work normally with a double-click.

**Alternative method:**
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /Applications/Ritemark\ Native.app
```

---

## Windows Installation

### Download

Download the latest ZIP from [Releases](https://github.com/your-repo/releases):
- `Ritemark-Native-{version}-win32-x64.zip` (64-bit Windows)

### Verify Download (Optional)

```powershell
Get-FileHash Ritemark-Native-*.zip -Algorithm SHA256
# Compare with .sha256 file
```

### Install

Ritemark Native for Windows is a **portable application** - no installer required.

1. Extract the ZIP file to your desired location:
   - `C:\Program Files\Ritemark Native\` (system-wide)
   - `C:\Users\YourName\Apps\Ritemark Native\` (user only)
   - Or any folder you prefer

2. Inside the extracted folder, find `Code - OSS.exe`

3. (Optional) Create a desktop shortcut:
   - Right-click `Code - OSS.exe` > **Send to** > **Desktop (create shortcut)**

### First Launch (SmartScreen)

Windows SmartScreen may show a warning for unsigned applications:

1. Click **More info**
2. Click **Run anyway**

After this, subsequent launches will work normally.

---

## System Requirements

### macOS
- macOS 11 Big Sur or later
- Apple Silicon (M1/M2/M3)
- 500 MB free disk space

### Windows
- Windows 10 or later (64-bit)
- 500 MB free disk space

---

## Troubleshooting

### macOS: "App is damaged and can't be opened"

Run in Terminal:
```bash
xattr -cr /Applications/Ritemark\ Native.app
```

### macOS: App won't open at all

1. Check System Preferences > Security & Privacy > General
2. Look for "Ritemark Native was blocked" message
3. Click "Open Anyway"

### Windows: Missing DLL errors

Ensure you have the Visual C++ Redistributable installed:
- Download from [Microsoft](https://aka.ms/vs/17/release/vc_redist.x64.exe)

### Windows: "Windows protected your PC" keeps appearing

1. Click **More info**
2. Click **Run anyway**
3. Or add an exception in Windows Security settings

---

## Uninstalling

### macOS
1. Drag **Ritemark Native** from Applications to Trash
2. (Optional) Remove settings: `rm -rf ~/Library/Application\ Support/Ritemark\ Native`

### Windows
1. Delete the `Ritemark Native` folder
2. (Optional) Remove settings: Delete `%APPDATA%\Ritemark Native`

---

## Getting Help

- GitHub Issues: [Report a problem](https://github.com/your-repo/issues)
- Documentation: [Full docs](https://github.com/your-repo/docs)
