# Partner Center and Smart App Control handoff

**Publisher:** `Productory Services OÜ`<br>
**Owners:** Jarmo — Partner Center and final approval; engineering — signed installer; Kristiina — clean Windows 11 test

## Jarmo: set up the Store listing

1. Sign in to Partner Center with the Productory organization account.
2. Complete organization verification if Microsoft asks for it.
3. Choose **New product → EXE or MSI app** and reserve **Ritemark**. If that exact name is unavailable, stop and choose a new name with Jarmo.
4. Complete the listing: description, category, age rating, privacy-policy URL, support URL, icons, and screenshots.
5. Add the x64 standalone EXE package:
   - URL: `https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe`
   - silent install: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER`
   - publisher: `Productory Services OÜ`
   - version: `1.10.0`
6. Submit only after the URL returns the exact `Ritemark-Setup.exe` produced and tested by CI. Compare its SHA-256 with `Ritemark-Setup.sha256.txt`.
7. Record Microsoft preprocessing or certification errors. If the binary changes, fix, rebuild, retest, publish it at a **new immutable candidate URL**, update Partner Center and the SHA-256, and resubmit. Never replace bytes at a URL that was already submitted.

GitHub Release may carry the same installer as the secondary direct download. It does not need to become the Store ingestion URL.

## Engineering: prepare the file

Before handing the installer to Jarmo:

- the Windows workflow is green;
- every PE in the payload and installed tree has a valid signature;
- Ritemark-owned files, installer, and uninstaller show `Productory Services OÜ` and a timestamp;
- standard-user silent install/uninstall passed;
- the versioned HTTPS URL downloads successfully;
- the downloaded Store file and the direct-download file have the same SHA-256.

The versioned URL is the Partner Center requirement. Once submitted, that URL is immutable. A rebuilt candidate uses a new path such as `/windows/v1.10.0-candidate-2/Ritemark-Setup.exe`; Sprint 114 does not build a new hosting or channel-management system.

## Kristiina: clean Windows 11 SAC-On test

Use a clean Windows 11 machine with current Defender updates. In **Windows Security → App & browser control → Smart App Control**, confirm the state is **On**.

1. Record the Windows version and installer SHA-256.
2. In installer **Properties → Digital Signatures**, confirm **Productory Services OÜ** and a valid signature.
3. Download and run the installer normally. Do not disable SmartScreen, Smart App Control, Defender, or organization policy.
4. Launch Ritemark and open/edit/save a Markdown file.
5. Exercise bundled agent/runtime paths available on the machine.
6. Confirm there is one Ritemark app entry and one Ritemark Start-menu app shortcut.
7. Uninstall Ritemark and confirm the app directory and Start-menu group are gone.
8. Check Defender Protection History and **Event Viewer → Applications and Services Logs → Microsoft → Windows → CodeIntegrity → Operational** for Ritemark-related blocks.

Return the installer SHA-256, SAC-state screenshot, install/launch/uninstall result, and any warning or Code Integrity event. Any Ritemark block fails the candidate.

## Final checklist

- [ ] Ritemark is reserved and the listing is complete.
- [ ] Store URL downloads the tested installer.
- [ ] Store and direct files share one SHA-256.
- [ ] Partner Center certification passes.
- [ ] Kristiina's SAC-On test passes.
- [ ] Jarmo approves that exact SHA-256 for release.

## Microsoft references

- [Reserve an app name](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/reserve-your-apps-name)
- [Create an EXE/MSI submission](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/create-app-submission)
- [Upload EXE/MSI packages](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/upload-app-packages)
- [EXE/MSI package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
- [Test with Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control)
