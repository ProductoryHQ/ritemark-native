# Building and verifying the Windows installer

Distributed Windows installers are built by the manual **Build Windows (x64)** GitHub workflow. It has one path: build, sign, verify, install, uninstall, then upload.

## Run the workflow

```bash
gh workflow run build-windows.yml --ref <branch-or-tag>
```

The paid workflow always signs. It stops before artifact upload if any required repository secret is missing:

- `AZURE_SIGNING_TENANT_ID`
- `AZURE_SIGNING_CLIENT_ID`
- `AZURE_SIGNING_CLIENT_SECRET`

There is no unsigned release mode.

## What CI checks

1. Builds and brands the Windows payload.
2. Finds every PE by its file header, including `.exe`, `.dll`, `.node`, and extensionless executables.
3. Keeps valid vendor signatures and signs Ritemark-owned or unsigned PEs through Azure Artifact Signing.
4. Verifies Authenticode plus `signtool verify /pa /all`. Productory-signed files must show `Productory Services OÜ` and a timestamp.
5. Compiles Inno with `/DSign`. Its SignTool adapter signs the setup loader, outer installer, and generated uninstaller.
6. Installs silently as a newly created standard Windows user.
7. Verifies the installed tree, one Ritemark Start-menu app shortcut, one new Ritemark app registration with the right publisher/version, and no additional app registration.
8. Silently uninstalls and confirms the install directory and Start-menu group are removed.
9. Uploads the installer and one SHA-256 file.

## Verify a Windows tree manually

```powershell
./scripts/verify-windows-signatures.ps1 `
  -Mode Verify `
  -Root installer-output `
  -SignToolPath 'C:\path\to\signtool.exe' `
  -OwnedPathPattern '*'
```

The command fails on an unsigned or invalid PE, a Productory-owned file with the wrong publisher, a missing Productory timestamp, or a failed Windows trust-policy verification.

## Local Docker installer

`scripts/create-windows-installer.sh` remains a local packaging diagnostic. Docker/Wine cannot use the Azure signing setup, so its output is not suitable for distribution. Use the Windows workflow for every installer given to users or Partner Center.

## Store and direct download

Partner Center should fetch:

```text
https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe
```

Before submission, download that URL and compare its SHA-256 with the workflow's `Ritemark-Setup.sha256.txt`. The GitHub Release direct-download file must be the same installer with the same hash. No separate channel infrastructure is required.

See the [Partner Center and SAC handoff](./releases/v1.10.0/sprint-114-trusted-windows-install/research/partner-center-and-sac-handoff.md).
