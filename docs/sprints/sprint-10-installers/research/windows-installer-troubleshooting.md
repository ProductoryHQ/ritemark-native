# Windows Installer Troubleshooting Guide

**Created:** 2024-12-12
**Status:** Active investigation - installer creates but app doesn't launch

---

## Current Issue

After installing Ritemark via the Inno Setup installer (`Ritemark-1.94.0-win32-x64-setup.exe`), the application fails to launch silently - no window appears, no error message.

---

## Implementation Summary

### What Was Built

We created a Windows installer using:
- **Inno Setup 6** (via `amake/innosetup` Docker image on macOS)
- **Custom `.iss` script** at `installer/windows/ritemark.iss`
- **Wrapper script** at `scripts/create-windows-installer.sh`

### Installer Features
- Installs to `%LOCALAPPDATA%\Programs\Ritemark\` (user mode) or `C:\Program Files\Ritemark\` (admin mode)
- Creates Start Menu shortcuts
- Optional desktop icon
- Optional `.md` file association
- Optional PATH addition
- Proper uninstaller

### Output
- `dist/Ritemark-1.94.0-win32-x64-setup.exe` (135 MB)
- SHA256 checksum file

---

## Debugging Steps

### Step 1: Run from Command Line

Open Command Prompt and run:

```cmd
cd %LOCALAPPDATA%\Programs\Ritemark
Ritemark.exe --verbose
```

Or with full logging:

```cmd
"%LOCALAPPDATA%\Programs\Ritemark\Ritemark.exe" --log trace
```

**What to look for:**
- Error messages about missing DLLs
- Crash information
- Module loading errors

### Step 2: Check Windows Event Viewer

1. Press `Win+R`, type `eventvwr.msc`, press Enter
2. Navigate to: **Windows Logs → Application**
3. Look for:
   - Red error entries from "Ritemark" or "Application Error"
   - Yellow warning entries
   - Entries around the time you tried to launch

**Common findings:**
- Missing DLL errors
- Access denied errors
- .NET Framework errors

### Step 3: Verify Installation Contents

Check if all files were installed:

```cmd
dir "%LOCALAPPDATA%\Programs\Ritemark"
dir "%LOCALAPPDATA%\Programs\Ritemark\resources"
dir "%LOCALAPPDATA%\Programs\Ritemark\resources\app"
```

**Expected structure:**
```
Ritemark/
├── Ritemark.exe           # Main executable
├── *.dll                  # Various DLLs
├── resources/
│   ├── app/
│   │   ├── package.json
│   │   ├── out/
│   │   └── extensions/
│   └── ...
└── ...
```

### Step 4: Check for Missing Visual C++ Runtime

VS Code (and forks) require Visual C++ Redistributable. Check if installed:

```cmd
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" 2>nul
```

If not found, download and install:
- [Visual C++ Redistributable 2015-2022 (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe)

### Step 5: Test with Dependency Walker

1. Download [Dependencies](https://github.com/lucasg/Dependencies) (modern Dependency Walker)
2. Open `Ritemark.exe` with it
3. Look for missing DLLs (highlighted in red)

### Step 6: Check Windows Defender / Antivirus

Sometimes unsigned executables get silently blocked:

1. Open Windows Security
2. Go to **Virus & threat protection → Protection history**
3. Look for blocked items related to Ritemark

### Step 7: Try Running as Administrator

Right-click `Ritemark.exe` → **Run as administrator**

If this works, there may be permission issues with the install location.

---

## Potential Root Causes

### 1. Missing Visual C++ Redistributable (MOST LIKELY)

**Symptoms:** App silently fails to start
**Solution:** Install VC++ Redistributable (see Step 4)

### 2. Missing or Corrupted DLLs

**Symptoms:** App crashes immediately or missing module errors
**Solution:** Rebuild Windows build, verify all files included in installer

### 3. Incorrect Working Directory

**Symptoms:** App starts but can't find resources
**Solution:** Check that shortcut sets correct "Start in" directory

### 4. Electron/Node Version Mismatch

**Symptoms:** Native modules fail to load
**Solution:** Ensure Windows build matches Node.js version used in build

### 5. Antivirus Blocking

**Symptoms:** Silent failure, entries in AV logs
**Solution:** Add exception for Ritemark folder

### 6. Wrong Architecture

**Symptoms:** "Not a valid Win32 application"
**Solution:** Verify x64 build on x64 Windows

### 7. Path Too Long

**Symptoms:** Installation appears successful but files missing
**Solution:** Install to shorter path (e.g., `C:\Ritemark`)

---

## Inno Setup Script Review

Current `installer/windows/ritemark.iss` should be verified:

### Check 1: Source Files Path

```ini
[Files]
Source: "..\..\VSCode-win32-x64\*"; DestDir: "{app}"; ...
```

This assumes the Windows build is at `VSCode-win32-x64/` relative to project root.

**Verify on macOS:**
```bash
ls -la VSCode-win32-x64/
ls -la VSCode-win32-x64/Ritemark.exe
```

### Check 2: Executable Name

```ini
#define AppExeName "Ritemark.exe"
```

**Verify actual exe name in build:**
```bash
ls VSCode-win32-x64/*.exe
```

### Check 3: Icons Section

```ini
[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
```

Make sure the shortcut points to correct executable.

---

## Comparison with VS Code's Approach

VS Code uses a more complex `code.iss` with:

1. **Inno Setup Preprocessor (ISPP)** for dynamic configuration
2. **Registry manipulation** for file associations
3. **Custom install scripts** for cleanup
4. **Quality checks** built into build process

Our simplified script may be missing critical steps.

### Key Differences to Investigate

| Feature | VS Code | Ritemark | Status |
|---------|---------|----------|--------|
| ISPP usage | Yes | No | May need |
| Quality parameter | Yes (`-DQuality=...`) | No | Check impact |
| Install mode | Multiple | User/Admin | OK |
| Architecture | Multiple | x64 only | OK |
| Custom messages | Yes | No | Cosmetic |
| Update check | Yes | No | OK for now |

---

## Quick Fixes to Try

### Fix 1: Add VC++ Redistributable to Installer

Modify `ritemark.iss` to bundle and install VC++ runtime:

```ini
[Files]
Source: "vcredist_x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Run]
Filename: "{tmp}\vcredist_x64.exe"; Parameters: "/quiet /norestart"; \
    StatusMsg: "Installing Visual C++ Runtime..."; Flags: waituntilterminated
```

### Fix 2: Set Working Directory in Shortcuts

```ini
[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"; \
    WorkingDir: "{app}"
```

### Fix 3: Add Missing DLLs

Check if these are in the Windows build:
- `ffmpeg.dll`
- `d3dcompiler_47.dll`
- `libEGL.dll`
- `libGLESv2.dll`
- `vk_swiftshader.dll`

---

## Next Steps

1. **Get debug output** from Windows machine (command line launch)
2. **Check Event Viewer** for crash details
3. **Verify VC++ Redistributable** is installed
4. **Compare file list** between VSCode-win32-x64/ and installed directory
5. **Consider bundling VC++ runtime** in installer

---

## Related Files

| File | Purpose |
|------|---------|
| `installer/windows/ritemark.iss` | Inno Setup script |
| `scripts/create-windows-installer.sh` | Docker wrapper script |
| `VSCode-win32-x64/` | Source Windows build |
| `dist/Ritemark-*.exe` | Generated installer |

---

## References

- [Inno Setup Documentation](https://jrsoftware.org/ishelp/)
- [VS Code's code.iss](https://github.com/microsoft/vscode/blob/main/build/win32/code.iss)
- [Visual C++ Redistributable Downloads](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)
- [Dependencies (DLL checker)](https://github.com/lucasg/Dependencies)
- [amake/innosetup Docker image](https://hub.docker.com/r/amake/innosetup)
