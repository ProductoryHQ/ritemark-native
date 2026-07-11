# Windows Smart App Control & SmartScreen

When you first install Ritemark on Windows 11, you may see a warning from **Smart App Control** or **Windows SmartScreen** saying the app is unrecognized or from an unknown publisher.

This happens because Ritemark is a new app and hasn't yet built up reputation with Microsoft's cloud protection service. The app is code-signed by **Productory Services OÜ** via Microsoft's own Trusted Signing service, but reputation builds over time as more users install and run the app.

## How to proceed

### SmartScreen warning ("Windows protected your PC")

1. Click **More info**
2. Click **Run anyway**

### Smart App Control block

If Smart App Control is set to **Evaluation** or **On** mode and blocks the installer:

1. Open **Windows Security** → **App & browser control** → **Smart App Control settings**
2. Temporarily set Smart App Control to **Off** (note: this cannot be re-enabled without resetting Windows)
3. Run the Ritemark installer
4. Alternatively, ask your IT administrator to allow the app via group policy

### Managed / enterprise installs

System administrators can pre-approve Ritemark by adding it to their organization's allowed apps list via Microsoft Intune or Group Policy.

## Why does this happen?

Microsoft Smart App Control uses a cloud reputation system. Even properly signed apps need time to build trust. This is normal for new software from small publishers and resolves itself as more users install the app.

Ritemark is signed with a **Public Trust** certificate issued by Microsoft Artifact Signing to Productory Services OÜ (Estonia). You can verify the signature by right-clicking `Ritemark-Setup.exe` → **Properties** → **Digital Signatures** tab.
