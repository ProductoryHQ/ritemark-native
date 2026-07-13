---
date: '2026-07-13'
title: 'Ritemark v1.8.2 — Windows Support & Reliability'
author: Jarmo Tuisk
status: Released
sprints:
  - sprint-91
  - sprint-92
  - sprint-93
tags:
  - sprint-91
  - sprint-92
  - sprint-93
  - windows
  - code-signing
  - smart-app-control
  - onedrive
  - sharepoint
  - file-browser
  - esbuild
  - build
---

# Ritemark v1.8.2 — Windows Support & Reliability

**Type:** Patch (1.8.1 → 1.8.2) — full app release (installer + code-signing + build system)
**Focus:** Getting Ritemark onto solid ground for Windows users. Until now Ritemark couldn't even install on a default Windows 11 machine — Windows blocked the installer because it couldn't confirm who published it. This release **code-signs the whole Windows app** so it installs like any trusted program, gives **OneDrive / SharePoint** users a clear, actionable message when a synced file isn't downloaded yet, brings the **New File / New Folder** buttons back into view in the File Browser, and rebuilds how the app is packaged so builds stop breaking in the ways they used to. Closes [#130](https://github.com/ProductoryHQ/ritemark-native/issues/130) (signing portion), [#134](https://github.com/ProductoryHQ/ritemark-native/issues/134), [#131](https://github.com/ProductoryHQ/ritemark-native/issues/131), and [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105).

**Availability:** macOS (Apple Silicon + Intel) is published now. The signed Windows installer follows shortly — until it lands, Windows stays on the previous version.

* * *

## Downloads

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.2/Ritemark-arm64.dmg |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.2/Ritemark-x64.dmg |
| Ritemark-Setup.exe | Windows x64 — **code-signed** (arriving shortly) | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.2/Ritemark-Setup.exe |

Both macOS downloads are signed and notarized by Apple — no Gatekeeper warnings.

* * *

## Highlights

- **Ritemark now installs on a default Windows 11 machine.** The whole app is code-signed, so the "can't confirm who published this app" / Smart App Control block is gone.
- **OneDrive and SharePoint files fail gracefully.** A cloud file that isn't downloaded yet now shows a clear, actionable message instead of a cryptic error.
- **New File / New Folder buttons are always visible** in the File Browser on Windows.
- **Smaller download, sturdier builds.** The app is repackaged into a single clean bundle, ending a class of intermittent build and startup glitches.

* * *

## Why This Release

Ritemark has always been mac-first, and Windows has quietly been the weakest part of the experience. On a default, up-to-date Windows 11 machine — the kind most people actually have, with Smart App Control turned on — you couldn't install Ritemark at all. Windows saw an unsigned installer, decided it couldn't confirm who made it, and blocked it outright. That's a dead end for a first-time user.

v1.8.2 fixes that at the root. The entire Windows app — the installer, the uninstaller, the temporary loader Windows extracts during setup, the main program, and the bundled AI helper programs — is now **code-signed** under a verified Productory certificate. Windows can now see exactly who published Ritemark, so it installs like any other trusted app. On a clean Windows 11 machine with Smart App Control enabled, the signed installer went in with no block, no warning, and no "run anyway" detour.

Two smaller-but-real Windows frustrations went with it. People who keep their documents in **OneDrive or SharePoint** sometimes hit a file that Windows hasn't actually downloaded yet — and Ritemark used to fail with a baffling "Unknown (FileSystemError)". Now it recognises that situation and tells you what to do. And the **New File / New Folder** buttons in the File Browser, which were hiding until you happened to hover in exactly the right spot on Windows, are now simply always visible while the File Browser is open.

Finally, a lot of invisible work went into making the build itself trustworthy. The way Ritemark was packaged used to trip over itself in a few well-documented ways — a Windows-specific "too many open files" build failure, a rare case that could silently ship a broken app, and steadily growing download sizes. Bundling the app's engine into a single clean package removes all three. You won't see this directly, but you'll feel it: a smaller download and builds that don't randomly break.

Sprint docs: `docs/development/sprints/sprint-91-windows-foundation/`, `docs/development/sprints/sprint-92-esbuild-bundling/`, and `docs/development/sprints/sprint-93-seamless-delivery/`

* * *

## What's New

### Ritemark now installs on Windows 11 (sprint-91)

The whole Windows app is now **code-signed**, so a default Windows 11 machine trusts it:

- **The installer is signed.** `Ritemark-Setup.exe` (and the uninstaller, the loader Windows extracts mid-install, the main program, and the bundled AI helper programs) all carry a valid signature under **Productory Services OÜ**. Windows shows a real, verified publisher name instead of "unknown".
- **The "can't confirm who published this app" block is gone.** The unsigned wall that stopped installation on Smart App Control machines no longer appears. On a clean Windows 11 test machine with Smart App Control enabled, the signed installer installed with no block, no SmartScreen warning, and no "run anyway" step.
- **How it's signed.** Ritemark uses **Azure Trusted Signing**, Microsoft's own cloud signing service — the path Microsoft recommends for exactly this situation. Productory's business history qualified it for public-trust signing.

This closes the signing portion of [#130](https://github.com/ProductoryHQ/ritemark-native/issues/130).

**One honest caveat.** Signing removes the "unsigned" block, but Smart App Control *also* weighs a separate Microsoft "reputation" signal, and a brand-new signed app can occasionally still be held on some machines until that reputation builds. If you ever hit a residual warning on your machine, the one-time workaround is documented in **[Windows Smart App Control](../../user/windows-smart-app-control.md)**.

### OneDrive and SharePoint files now fail gracefully — with a fix you can act on (sprint-91)

If you keep your Markdown in OneDrive or SharePoint, you've probably met a file that lives "in the cloud" and hasn't been downloaded to your PC yet. When Windows can't hand that file's contents to Ritemark, the app used to show a dead-end "Unknown (FileSystemError)".

Now Ritemark recognises that specific situation and shows an actionable message: **right-click the file in File Explorer → "Always keep on this device", then reopen it.** Behind the scenes it also records the real underlying Windows error code, so genuine problems are easier to diagnose. This was verified against a real, reproduced OneDrive "not downloaded" file on Windows.

This closes [#134](https://github.com/ProductoryHQ/ritemark-native/issues/134). Ordinary local files, and everything on macOS, are completely unaffected.

* * *

## Fixes &amp; Polish

- **New File / New Folder buttons are always visible in the File Browser (sprint-91).** On Windows these buttons were hidden until you hovered over just the right part of the File Browser title bar, so many users never found them and thought the feature was missing. They now stay visible the whole time the File Browser is expanded. macOS already worked and looks exactly the same as before — this was a Windows-only visibility fix, not a new button. Closes [#131](https://github.com/ProductoryHQ/ritemark-native/issues/131).
- **Smaller download and builds that don't randomly break (sprint-92).** The app's engine is now packaged as one clean bundle instead of ~130 loose files. You don't interact with this directly, but it means a smaller install download and the end of three long-standing build failures — including a Windows-only "too many open files" crash and a rare case that could ship a broken app that looked fine. Closes [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105).
- **More reliable release pipeline (sprint-91).** The Windows and Intel-Mac build jobs no longer fire automatically off version tags (which used to cause surprise, expensive builds); they're started deliberately now. A lightweight weekly "canary" build also runs on Windows to catch toolchain breakage early, before it can derail a real release.

* * *

## Groundwork for Seamless Updates (sprint-93)

This release also lays the **foundation** for one-click background updates — a future where Ritemark can fetch an update quietly and apply it with a single "Relaunch to update" click, without a full reinstall. The client-side plumbing and a two-tier release process ship in v1.8.2.

**This is groundwork, not a finished feature yet.** During release testing we found that the update flow doesn't reliably load in this build, so the full one-click experience is **not** available in v1.8.2 — you still update Ritemark the normal way (download and install the latest release). The seamless experience will be completed and turned on in a later release. We're calling this out plainly so no one expects a button that isn't ready.

* * *

## Under the Hood

### Windows code-signing via Azure Trusted Signing (sprint-91)

Signing has to happen on Windows: `signtool.exe` and the Azure Trusted Signing library are Windows-only, so the signed release installer is produced on Windows (CI `build-windows.yml` or a Windows machine), while the existing Docker/macOS installer path stays as an **unsigned local-dev fallback** guarded by a `#ifdef Sign` in `installer/windows/ritemark.iss`. CI signs the executables with `azure/trusted-signing-action`, then the installer itself is signed via `Invoke-TrustedSigning`. Every signed artifact is verified with `signtool verify /pa`. The certificate profile (`ritemark-public-trust`, publisher "Productory Services OÜ") and the four `AZURE_SIGNING_*` GitHub secrets live entirely outside this repo. A signature check was added to `scripts/validate-build-output.sh` (Section 9), currently gated behind `RITEMARK_SKIP_SIGNING_CHECK` so it stays advisory until a few more signed builds confirm reliability, then it flips to fail-closed. The Microsoft reputation submission uses the final shipping binary and happens at release time.

### Cloud-file error detection (sprint-91, patch 011)

Ritemark's editor never sees this failure — VS Code core reads the file to build the `TextDocument` *before* the custom editor runs, so the fix had to be a VS Code core patch, not extension code. New patch `011-ritemark-cloud-file-error.patch` extends `diskFileSystemProvider.ts`'s error mapping. A key real-world finding: libuv collapses every unmapped Windows `ERROR_CLOUD_FILE_*` code into a generic `UNKNOWN` (errno `-4094`) and drops the original code and any "cloud" wording — so detection keys off the *pattern* (`UNKNOWN` + a `read`/`open` syscall on Windows), not a message regex. The raw errno and syscall are logged for diagnostics. The path only triggers on that exact Windows failure pattern, so successful reads and all non-Windows platforms are untouched.

### esbuild bundling of the extension host (sprint-92)

The extension host used to ship as ~130 loose `.js` files plus ~180 packages. It's now a single esbuild bundle: `out/extension.js` (~5.2 MB) plus one standalone `out/browser/browserMcpAdapter.js` (it's spawned as its own OS process and can't be inlined). `npm run compile` now runs `tsc --noEmit` for type-checking and then esbuild for the emit, so a type error still fails the build loudly. Two `__dirname`-relative path lookups (`bundledAgentRuntime.ts`, `BrowserToolsInjector.ts`) were fixed for the new one-level bundle depth. This closes three documented incidents at their root: the Windows **EMFILE** ("too many open files") build failure, the **v1.7.1 0-byte-tsc trap** that could ship a broken app, and steadily growing **DMG/zip bloat**. A full production build was run end-to-end and the packaged app was launched and verified (editor, AI sidebar, Settings all load; all three AI runtimes resolve correctly).

### Seamless-delivery client + two-tier release process (sprint-93)

Sprint 93 landed the client-side code for background update delivery ("Relaunch to update", auto-apply, rollback) and a two-tier release model (a lightweight extension-only fast lane alongside the full shell release). Release testing surfaced [#142](https://github.com/ProductoryHQ/ritemark-native/issues/142): an `X.Y.Z-ext.N` extension update registers as a semver *pre-release*, which VS Code ranks below the bundled `X.Y.Z`, so the staged update never loads. Because of that, the seamless-update path is **not relied upon in v1.8.2** and no `-ext.N` release will be published until it's fixed — the next release is a full build. The client code ships now so the plumbing is in place; the user-facing one-click flow is deferred.

### CI de-risk (sprint-91)

The `push: tags: v*` auto-trigger was removed from both `build-windows.yml` and `build-macos-x64.yml` — neither derives its version from the git ref, so `workflow_dispatch` from any branch is safe and avoids surprise large-runner builds. A new `windows-canary.yml` runs weekly on the free `windows-latest` runner, exercising the precise VS2026/node-gyp toolchain check that has broken Windows CI before — an early-warning signal without cloning VS Code.

* * *

## Known Issues &amp; Deferred

- **Seamless one-click updates are not live yet.** The client plumbing ships in v1.8.2, but the "Relaunch to update" flow doesn't load reliably in this build ([#142](https://github.com/ProductoryHQ/ritemark-native/issues/142)) — keep updating Ritemark the normal way. The full experience arrives in a later release, and no `-ext.N` extension-only release will be published until the fix lands.
- **Smart App Control reputation may lag on some machines.** Signing removes the "unsigned" block, but a brand-new signed app can still be held by Smart App Control's reputation signal on some PCs until reputation builds or Microsoft's review completes. The interim one-time workaround is documented in **[Windows Smart App Control](../../user/windows-smart-app-control.md)**.
- **Windows voice dictation is still deferred.** [#133](https://github.com/ProductoryHQ/ritemark-native/issues/133) (Windows voice dictation parity) is out of scope for v1.8.2 and planned for a later Windows-parity release.
- **Deeper OneDrive fixes are deferred.** This release surfaces a clear error and logs diagnostics; it does not attempt to force-download cloud placeholders. Further work waits on a reproducible core case.
