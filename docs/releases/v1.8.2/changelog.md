<!-- WORK-IN-PROGRESS DRAFT — v1.8.2 is not final.
     Covers only the work shipped so far: Sprint 91 (Windows Foundation, PR #137)
     + Sprint 92 (esbuild extension-host bundling, PR #138), both merged to main.
     Sprint 93 (seamless background updates) is planned but NOT yet built and will add
     entries here before v1.8.2 ships. Nothing below has been built, signed, or notarized. -->

## [1.8.2] - TBD (work-in-progress draft)

### Added
- **Ritemark installs on Windows 11 — the whole app is code-signed (Sprint 91, #130).** The installer, uninstaller, mid-install `.tmp` loader, main program, and bundled AI helper binaries are all Authenticode-signed under "Productory Services OÜ" via Azure Trusted Signing, so a default Windows 11 machine with Smart App Control enabled trusts and installs it — the "can't confirm who published this app" / Error 4551 block is gone. Verified installing cleanly on a separate clean Windows 11 (SAC enabled) machine. Note: the Microsoft cloud-reputation review submission uses the final release binary and is deferred to release time; interim SmartScreen workaround documented in `docs/user/windows-smart-app-control.md`
- **OneDrive / SharePoint files that aren't downloaded now show an actionable error (Sprint 91, #134).** Opening a cloud file Windows hasn't hydrated used to fail with a cryptic "Unknown (FileSystemError)"; Ritemark now detects the pattern and suggests "right-click in File Explorer → Always keep on this device, then reopen", and logs the raw OS error code for diagnostics. Implemented as VS Code core patch `011-ritemark-cloud-file-error.patch` (the editor never sees the failure — core fails the read before the custom editor runs). Live-reproduced against a real OneDrive placeholder (`errno=-4094, syscall=read`)

### Changed
- **The extension host now ships as a single bundle instead of ~130 loose files (Sprint 92, #105).** `out/` collapses to one `out/extension.js` (~5.2 MB) plus a standalone `out/browser/browserMcpAdapter.js`, built with esbuild; `npm run compile` runs `tsc --noEmit` type-checking then esbuild emit. Result: a smaller download and the end of three documented build incidents — the Windows EMFILE ("too many open files") failure, the v1.7.1 0-byte-tsc trap that could ship a broken app, and DMG/zip bloat. Unblocks #107 and #108 (not built here)

### Fixed
- **New File / New Folder buttons are always visible in the File Browser (Sprint 91, #131).** On Windows these buttons stayed hidden until the user hovered over exactly the right spot in the title bar, so many never found them; they now render inline whenever the File Browser is expanded. Windows-only visibility fix via patch `002-ritemark-ui-layout.patch` (`showActions: ViewPaneShowActions.WhenExpanded`) — no new command registration, macOS unchanged and not duplicated
- **CI no longer fires surprise builds off version tags (Sprint 91).** Removed `push: tags: v*` from `build-windows.yml` and `build-macos-x64.yml` (both keep `workflow_dispatch`), so expensive Windows/Intel-Mac builds are only started deliberately; added a weekly free-runner `windows-canary.yml` that exercises the VS2026/node-gyp toolchain check as an early-warning signal

### Notes
- **WORK-IN-PROGRESS:** this entry covers only Sprint 91 + Sprint 92. Sprint 93 (seamless background updates — one-click "Relaunch to update") is planned but not yet built and will add entries before v1.8.2 ships.
- Windows signing runs on Windows only (`signtool.exe` + the Azure Trusted Signing library are Windows-only). The signed release installer is built in `build-windows.yml` / on a Windows machine; the Docker/macOS installer path remains an **unsigned local-dev fallback**, guarded by `#ifdef Sign` in `installer/windows/ritemark.iss`. All four `AZURE_SIGNING_*` credentials live outside this repo (never committed).
- The build's signature self-check (`scripts/validate-build-output.sh` Section 9) is gated behind `RITEMARK_SKIP_SIGNING_CHECK` and stays advisory until a few more signed builds confirm reliability, then flips to fail-closed (deferred, W1-12).
- OneDrive detection keys off the error *pattern* (`UNKNOWN` + `read`/`open` syscall on Windows), not a message regex — libuv collapses all `ERROR_CLOUD_FILE_*` codes into a generic `UNKNOWN` (errno `-4094`) and drops the original code. Successful reads and all non-Windows platforms are untouched.
- esbuild bundling: two `__dirname`-relative path lookups (`bundledAgentRuntime.ts`, `BrowserToolsInjector.ts`) were fixed for the new one-level bundle depth; `browserMcpAdapter.ts` stays a separate entry point because it is spawned as its own OS process. No new runtime dependency was added.
- Deferred to a later release: #133 (Windows voice dictation parity), #107 / #108 / #106 (architecture debt unblocked by #105 but not built), and any deeper OneDrive core read fix (error surfacing + diagnostics only for now).
- This release has NOT been built as a shippable app, signed, or notarized; the macOS Gate 1/Gate 2 release gates and the Windows SAC reputation submission are all still pending.
