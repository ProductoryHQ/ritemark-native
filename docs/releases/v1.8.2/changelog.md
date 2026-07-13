## [1.8.2] - 2026-07-13

### Added
- **Ritemark installs on Windows 11 — the whole app is code-signed (Sprint 91, #130).** The installer, uninstaller, mid-install `.tmp` loader, main program, and bundled AI helper binaries are all Authenticode-signed under "Productory Services OÜ" via Azure Trusted Signing, so a default Windows 11 machine with Smart App Control enabled trusts and installs it — the "can't confirm who published this app" block is gone. Verified installing cleanly on a separate clean Windows 11 (SAC enabled) machine. Interim SmartScreen workaround documented in `docs/user/windows-smart-app-control.md`
- **OneDrive / SharePoint files that aren't downloaded now show an actionable error (Sprint 91, #134).** Opening a cloud file Windows hasn't hydrated used to fail with a cryptic "Unknown (FileSystemError)"; Ritemark now detects the pattern and suggests "right-click in File Explorer → Always keep on this device, then reopen", and logs the raw OS error code for diagnostics. Implemented as VS Code core patch `011-ritemark-cloud-file-error.patch`

### Changed
- **The extension host now ships as a single bundle instead of ~130 loose files (Sprint 92, #105).** `out/` collapses to one `out/extension.js` (~5.2 MB) plus a standalone `out/browser/browserMcpAdapter.js`, built with esbuild. Result: a smaller download and the end of three documented build incidents — the Windows EMFILE ("too many open files") failure, the v1.7.1 0-byte-tsc trap that could ship a broken app, and DMG/zip bloat

### Fixed
- **New File / New Folder buttons are always visible in the File Browser (Sprint 91, #131).** On Windows these buttons stayed hidden until the user hovered over exactly the right spot in the title bar, so many never found them; they now render inline whenever the File Browser is expanded. Windows-only visibility fix, macOS unchanged
- **CI no longer fires surprise builds off version tags (Sprint 91).** Removed `push: tags: v*` from `build-windows.yml` and `build-macos-x64.yml`, so expensive Windows/Intel-Mac builds are only started deliberately; added a weekly free-runner `windows-canary.yml` that exercises the VS2026/node-gyp toolchain check as an early-warning signal

### Notes
- macOS (Apple Silicon + Intel) is published now; the signed Windows installer follows shortly. Until it lands, Windows stays on the previous version.
- **Seamless background updates are groundwork only in this release.** Sprint 93 landed the client-side plumbing for one-click "Relaunch to update" plus a two-tier release process, but the flow does not load reliably in this build (#142 — an `X.Y.Z-ext.N` update ranks below the bundled `X.Y.Z` in VS Code's semver ordering). Keep updating Ritemark the normal way; the full experience arrives in a later release, and no `-ext.N` extension-only release will be published until the fix lands.
- Windows signing runs on Windows only (`signtool.exe` + the Azure Trusted Signing library are Windows-only). The signed release installer is built in `build-windows.yml` / on a Windows machine; the Docker/macOS installer path remains an unsigned local-dev fallback, guarded by `#ifdef Sign` in `installer/windows/ritemark.iss`. All four `AZURE_SIGNING_*` credentials live outside this repo.
- The build's signature self-check (`scripts/validate-build-output.sh` Section 9) is gated behind `RITEMARK_SKIP_SIGNING_CHECK` and stays advisory until a few more signed builds confirm reliability, then flips to fail-closed.
- OneDrive detection keys off the error *pattern* (`UNKNOWN` + `read`/`open` syscall on Windows), not a message regex — libuv collapses all `ERROR_CLOUD_FILE_*` codes into a generic `UNKNOWN` (errno `-4094`). Successful reads and all non-Windows platforms are untouched.
- Deferred to a later release: #133 (Windows voice dictation parity) and any deeper OneDrive core read fix (error surfacing + diagnostics only for now).
