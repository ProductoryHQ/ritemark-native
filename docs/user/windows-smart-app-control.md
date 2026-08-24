# Installing Ritemark safely on Windows

Ritemark's verified Windows publisher is **Productory Services OÜ**. Keep
Windows Security, Smart App Control, SmartScreen, and Microsoft Defender
enabled while installing it.

## Choose an installation channel

### Microsoft Store (recommended when available)

Use the Microsoft Store link on [ritemark.app](https://ritemark.app). Store
installation avoids direct-download SmartScreen reputation warnings and is the
primary Windows channel after the Ritemark listing is certified.

### Signed direct installer

The GitHub Release remains a secondary recovery and manual-deployment channel.
Download only `Ritemark-Setup.exe` from Ritemark's official release page. Before
running it:

1. Right-click the file and choose **Properties → Digital Signatures**.
2. Confirm the signer is **Productory Services OÜ** and Windows reports the
   signature as valid.
3. Compare the file's SHA-256 with the value in that version's Ritemark release
   notes or test checklist.

PowerShell can calculate the hash without changing the file:

```powershell
Get-FileHash .\Ritemark-Setup.exe -Algorithm SHA256
```

Do not continue if the signature is missing, invalid, uses another publisher,
or the hash differs.

## Understand the Windows message

- **SmartScreen “unrecognized app” warning** is a download-reputation result.
  A newly signed direct-download hash can receive it while reputation builds.
  Prefer the Store path or contact Ritemark support; do not weaken Windows
  security.
- **Smart App Control or organization policy block** is execution enforcement.
  Use the Store path or ask the device administrator for an approved deployment
  channel. Keep Smart App Control enabled when installing Ritemark.
- **Microsoft Defender malware/PUA detection** is different from reputation.
  Record the exact detection name, Ritemark version, download URL, and SHA-256,
  then report it to Ritemark support. Productory will submit a suspected false
  positive through the [Microsoft Security Intelligence submission
  portal](https://www.microsoft.com/en-us/wdsi/filesubmission).

## Managed devices

An administrator may require Microsoft Store deployment, Intune, or an
organization allow policy. Follow the organization's policy and provide the
administrator with the exact Ritemark version, publisher, and SHA-256. Ritemark
support does not recommend bypassing managed security controls.

## Information to include in a support report

- Ritemark version and installer SHA-256
- where the installer was obtained (Store or exact direct URL)
- the exact Windows message or Defender detection name
- Windows version and whether Smart App Control is On, Evaluation, or Off
- a screenshot, if it does not expose private information

These details distinguish download reputation, signature enforcement,
malware/PUA detection, and an unrelated installer failure.
