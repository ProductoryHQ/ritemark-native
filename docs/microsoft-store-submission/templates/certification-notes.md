# Notes for Microsoft certification

Replace every bracketed field before pasting this into Partner Center. Remove sections that do not apply.

## Installation

Ritemark is a per-user x64 desktop application. Use these silent installation parameters:

`/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /CURRENTUSER`

The normal install works from a standard Windows user account. A successful install creates one Ritemark entry in the Start menu and one entry in Windows Apps/Programs.

## Basic test

1. Launch Ritemark from the Start menu.
2. Open or create a local folder containing a Markdown file.
3. Open the `.md` file, edit text, and save it.
4. [Add any candidate-specific feature steps needed for certification.]

Local editing does not require a Ritemark account. Selected AI/provider features require network access and user-configured provider access. [Provide a temporary test account only if a reviewed feature genuinely requires one; never store credentials in the repository.]

## Offline behavior

The app can launch and edit local Markdown files without network access. Network-connected features should show an understandable unavailable/error state when offline rather than crash.

## Uninstallation

Use the Windows Apps/Programs entry or the Inno Setup uninstaller with:

`/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`

Uninstall removes the Ritemark install directory, Start menu group, and app registration.

## Drivers and services

[No non-Microsoft driver or NT service dependency is present in this candidate. Confirm from final audit, or replace this sentence with the required disclosure.]

## Additional reviewer information

[Explain hidden/locked functionality, unusual launch behavior, credentials, hardware, or other information Microsoft needs. If none, state: “No additional access steps are required for the basic local-editing test.”]
