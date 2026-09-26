# Installing Ritemark

This guide covers installing and removing Ritemark on macOS and Windows. Once it is installed, [Getting Started](getting-started.md) walks you through your first document.

---

## Download

Download the latest version from the [Ritemark releases page](https://github.com/jarmo-productory/ritemark-public/releases/latest) and choose the file for your computer:

| Computer | File |
|----------|------|
| Mac with Apple Silicon (M1 or later) | `Ritemark-arm64.dmg` |
| Mac with an Intel processor | `Ritemark-x64.dmg` |
| Windows PC, 64-bit | `Ritemark-Setup.exe` |

To see which Mac you have, choose Apple menu → **About This Mac**. It lists a **Chip** on Apple Silicon Macs and a **Processor** on Intel Macs.

---

## macOS

1. Open the downloaded `.dmg` file.
2. Drag **Ritemark** to the **Applications** folder.
3. Eject the disk image.
4. Open Ritemark from **Applications**.

Ritemark is signed and notarized by Apple. The first time you open it, macOS asks whether you want to open an app downloaded from the internet. Click **Open**. No other security steps are needed.

---

## Windows

1. Run `Ritemark-Setup.exe`.
2. Choose whether to install Ritemark for yourself only or for all users of the computer. Installing for yourself does not need administrator rights.
3. Follow the installer. When it finishes, Ritemark is in the Start menu.

The installer and the app are signed by **Productory Services OÜ**. Keep Windows Security, Smart App Control, and SmartScreen turned on. [Installing Ritemark safely on Windows](windows-smart-app-control.md) covers the Microsoft Store option, how to check the signature, and what to do if Windows shows a message during installation.

---

## System requirements

**macOS**
- macOS 12 Monterey or later
- Apple Silicon or Intel processor
- About 2 GB of free disk space

**Windows**
- Windows 10 or later, 64-bit

---

## Uninstalling

**macOS:** quit Ritemark, then drag **Ritemark** from **Applications** to the Trash.

**Windows:** open **Settings → Apps**, find **Ritemark**, and choose **Uninstall**. You can also use **Uninstall Ritemark** in the Start menu.

Uninstalling leaves your documents alone; they are ordinary files in your folders. It also keeps Ritemark's settings, in case you install it again. To remove the settings and downloaded models as well, delete these folders:

| Platform | Folders |
|----------|---------|
| macOS | `~/Library/Application Support/Ritemark` and `~/.ritemark` |
| Windows | `%APPDATA%\Ritemark` and `%USERPROFILE%\.ritemark` |

---

## Getting help

- [Common Issues](troubleshooting.md) covers installation problems, including what to do if macOS says Ritemark cannot be opened.
- [Ritemark support](https://ritemark.app/en/support/)
