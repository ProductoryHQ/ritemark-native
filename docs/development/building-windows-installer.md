# Building and Verifying the Windows Installer

Canonical Windows installers are built on GitHub's Windows runner. The runner owns the complete order: build and brand the payload, inventory Portable Executables by content, preserve valid vendor signatures, sign Ritemark-owned or unsigned PEs, verify the payload, compile Inno with its `SignTool`, install and verify the result, uninstall it, and only then upload artifacts.

Local and branch builds are canaries. They cannot use the canonical artifact names or become a release without a new exact-tag release run.

## Workflow Modes

`.github/workflows/build-windows.yml` is manual and accepts one required `build_mode`:

| Mode | Ref | Signing | Release eligible |
|---|---|---|---|
| `signed-canary` | non-tag branch | Required | No |
| `unsigned-canary` | non-tag branch | Intentionally skipped | No |
| `release` | exact `vX.Y.Z` tag matching `branding/product.json` | Required | Yes |

The workflow fails closed when the mode/ref contract, credentials, PE inventory, publisher, timestamp, Inno signing, silent lifecycle test, or post-install verification fails. A non-release installer includes `SIGNED-CANARY-NON-RELEASE` or `UNSIGNED-NON-RELEASE` in its filename.

Azure credentials belong to the GitHub `windows-signing` environment, not unprotected repository secrets. Repository settings must require a reviewer and restrict deployment refs to the approved signed-canary branch plus release tags matching `vX.Y.Z`. A workflow YAML declaration cannot create or verify those GitHub-side protection rules; confirm them before the first signed run.

## Runner Proof Before Merge

After local QA and after the branch is committed and pushed, run the signed canary explicitly:

```bash
gh workflow run build-windows.yml \
  --ref codex/sprint-114-trusted-windows-install \
  -f build_mode=signed-canary
```

This is a paid external CI action. Record the run URL and retain both workflow artifacts. A signed-canary proves the Windows runner integration; it is not a Store or release candidate.

## Release Candidate

The release candidate is allowed only after the shell release's technical Gate 1 and exact tag exist:

```bash
gh workflow run build-windows.yml \
  --ref v1.10.0 \
  -f build_mode=release
```

Replace `v1.10.0` with the release being built. The tag must exactly match `branding/product.json`. Never dispatch release mode from a branch, and never rename a canary artifact into a canonical release artifact.

The release run emits:

- the packaged Windows application tree;
- the versioned installer;
- payload baseline and verification reports;
- Inno signing evidence for setup/uninstaller components;
- installer and installed-tree verification reports;
- a channel manifest with version, ref, commit, size, SHA-256, publisher, and Store URL.
- raw per-PE `signtool verify /pa /all /v` output plus structured signer, issuer, thumbprint, chain, SHA-256 signature digest, and RFC 3161 timestamp signer/digest evidence;
- a toolchain record containing the selected semantic Windows SDK version and observed SignTool, Artifact Signing client/dlib, NuGet, and Inno versions.

Verify that the channel manifest names `Productory Services OÜ` and the exact immutable Store URL. Any rebuilt byte creates a new candidate and resets Windows approval.

## Local Unsigned Installer

`scripts/create-windows-installer.sh` exists only for local diagnostics. It validates the payload under the explicit `unsigned-canary` trust mode and produces an `UNSIGNED-NON-RELEASE` filename. It must never be uploaded to a canonical release or Store path.

On Windows, an equivalent manual compile must omit `/DCanonicalRelease` and `/DSign` unless the approved Azure Artifact Signing dlib command is fully configured. Do not use the Inno GUI to make a release installer.

## Signature Verification

On Windows, verify an unpacked tree or installer-output directory with:

```powershell
./scripts/verify-windows-signatures.ps1 `
  -Mode Verify `
  -Root installer-output `
  -ExpectedPublisher 'Productory Services OÜ' `
  -RequireExpectedPublisherForAll `
  -RequireTimestamp
```

The verifier identifies PE content from its headers, not only `.exe` filenames, so DLLs, native `.node` modules, and extensionless executables are included. Valid third-party signatures may remain vendor-signed; Ritemark-owned files must match the expected publisher.

## Store and Direct Channels

The Store package URL for v1.10.0 is:

```text
https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe
```

That object is write-once. GitHub Release retains a same-hash `Ritemark-Setup.exe` as the secondary direct-download and recovery channel. See the Sprint 114 Partner Center handoff before hosting or submitting a candidate.
