# Building Windows Installer Locally

This guide explains how to build the RiteMark Windows installer (.exe) on a Windows machine.

GitHub Actions builds the ZIP artifact automatically. The installer is built locally to avoid CI complexity with Inno Setup.

## Prerequisites

### 1. Install Inno Setup 6

Download and install from: https://jrsoftware.org/isdl.php

Choose "Inno Setup 6" (not 5.x). Default installation path is fine:
```
C:\Program Files (x86)\Inno Setup 6\
```

### 2. Download the Build Artifact

1. Go to: https://github.com/jarmo-productory/ritemark-native/actions
2. Click on the latest successful "Build Windows (x64)" run
3. Download the `ritemark-windows-x64` artifact (ZIP file)
4. Extract to a folder, e.g., `C:\RiteMark-Build\`

Your folder structure should look like:
```
C:\RiteMark-Build\
└── VSCode-win32-x64\
    ├── Code.exe
    ├── resources\
    │   └── app\
    │       └── extensions\
    │           └── ritemark\
    └── ...
```

## Building the Installer

### Option A: Using the GUI

1. Open Inno Setup Compiler (search "Inno Setup" in Start menu)
2. File → Open → navigate to your `ritemark-native` repo
3. Open `installer\windows\ritemark.iss`
4. **Important**: Edit line 60 to point to your extracted build:
   ```
   Source: "C:\RiteMark-Build\VSCode-win32-x64\*"; ...
   ```
5. Press F9 or click Compile
6. Installer will be created in `installer-output\` folder

### Option B: Using Command Line

Open PowerShell or Command Prompt:

```powershell
# Navigate to your ritemark-native repo
cd C:\path\to\ritemark-native

# Create output directory
mkdir installer-output -Force

# Run Inno Setup compiler
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" `
    /DSourcePath="C:\RiteMark-Build\VSCode-win32-x64" `
    installer\windows\ritemark.iss
```

Or with CMD:
```cmd
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" ^
    /DSourcePath="C:\RiteMark-Build\VSCode-win32-x64" ^
    installer\windows\ritemark.iss
```

## Output

The installer will be created at:
```
installer-output\RiteMark-{version}-win32-x64-setup.exe
```

Example: `RiteMark-1.96.0-win32-x64-setup.exe`

## Modifying the Installer Script

If you need to pass the source path as a parameter, modify `ritemark.iss`:

```iss
; At the top, add:
#ifndef SourcePath
  #define SourcePath "..\..\VSCode-win32-x64"
#endif

; Then in [Files] section, change:
Source: "{#SourcePath}\*"; DestDir: "{app}"; ...
```

This allows passing `/DSourcePath=...` from command line.

## Troubleshooting

### "File not found" errors
- Ensure the ZIP was fully extracted
- Check the Source path in ritemark.iss matches your folder

### Long path errors
- The installer script excludes deeply nested node_modules paths
- If you still get errors, enable Windows long paths:
  ```powershell
  # Run as Administrator
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
      -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  ```

### Version mismatch
- Edit `#define AppVersion` in ritemark.iss to match your release version

## Quick Reference

| Task | Command |
|------|---------|
| Compile installer | `ISCC.exe installer\windows\ritemark.iss` |
| Specify source | `/DSourcePath="C:\path\to\build"` |
| Quiet mode | `/Qp` (shows progress only) |
| Output directory | Already set to `installer-output\` in script |
