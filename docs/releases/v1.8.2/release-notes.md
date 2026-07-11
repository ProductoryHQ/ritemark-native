---
date: '2026-07-12'
title: 'Ritemark v1.8.2 — Sturdy & Seamless Delivery (Windows-first)'
author: Jarmo Tuisk
status: Draft (work-in-progress — release not final)
sprints:
  - sprint-91
  - sprint-92
tags:
  - sprint-91
  - sprint-92
  - windows
  - code-signing
  - smart-app-control
  - onedrive
  - sharepoint
  - file-browser
  - esbuild
  - build
---

# Ritemark v1.8.2 — Sturdy & Seamless Delivery (Windows-first)

> **WORK-IN-PROGRESS DRAFT — v1.8.2 is not final.**
> This document covers **only the work that has shipped so far**: Sprint 91 (Windows Foundation) and Sprint 92 (extension-host bundling), both merged to `main`. At least one more sprint — sprint-93, the "seamless background updates" work — is **planned but not yet built**, and more may land before v1.8.2 actually ships. Nothing described below has been built, signed, or notarized yet. Treat everything here as a scope-so-far draft that will grow.

**Status:** Draft (work-in-progress — more sprints to come; release gates not yet run)
**Type:** Patch (1.8.1 → 1.8.2) — shell-tier full app release (installer + code-signing + build system)
**Focus:** Getting Windows onto solid ground. Until now Ritemark could not even install on a default Windows 11 machine — Windows blocked the installer because it couldn't confirm who published it. This release **code-signs the whole Windows app** so it installs like any trusted program, gives **OneDrive / SharePoint** users a clear, actionable message when a synced file isn't downloaded (instead of a cryptic error), and brings the **New File / New Folder** buttons back into view in the File Browser. Under the hood it also rebuilds how the app is packaged so builds stop breaking in the ways they used to. Closes [#130](https://github.com/ProductoryHQ/ritemark-native/issues/130) (signing portion), [#134](https://github.com/ProductoryHQ/ritemark-native/issues/134), [#131](https://github.com/ProductoryHQ/ritemark-native/issues/131), and [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105).

* * *

## Downloads

<!-- Artifacts are NOT live yet — v1.8.2 has not been built, signed, or notarized.
     These are the target URLs where the assets will land once the release gates pass.
     The Windows Setup.exe will be Authenticode-signed under "Productory Services OÜ". -->

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.2/Ritemark-arm64.dmg |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.2/Ritemark-x64.dmg |
| Ritemark-Setup.exe | Windows x64 — **code-signed** | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.2/Ritemark-Setup.exe |

* * *

## Why This Release

Ritemark has always been mac-first, and Windows has quietly been the weakest part of the experience. On a default, up-to-date Windows 11 machine — the kind most people actually have, with Smart App Control turned on — you couldn't install Ritemark at all. Windows saw an unsigned installer, decided it couldn't confirm who made it, and blocked it outright (the "can't confirm who published this app" / Error 4551 wall). That's a dead end for a first-time user.

v1.8.2 fixes that at the root. The entire Windows app — the installer, the uninstaller, the temporary loader Windows extracts during setup, the main program, and the bundled AI helper programs — is now **code-signed** under a verified Productory certificate. Windows can now see exactly who published Ritemark, so it installs like any other trusted app. On a clean Windows 11 machine with Smart App Control enabled, the signed installer went in with no block, no warning, and no "run anyway" detour.

Two smaller-but-real Windows frustrations went with it. People who keep their documents in **OneDrive or SharePoint** sometimes hit a file that Windows hasn't actually downloaded yet — and Ritemark used to fail with a baffling "Unknown (FileSystemError)". Now it recognises that situation and tells you what to do: right-click the file in File Explorer and choose "Always keep on this device", then reopen it. And the **New File / New Folder** buttons in the File Browser, which were hiding until you happened to hover in exactly the right spot on Windows, are now simply always visible while the File Browser is open.

Finally, a lot of invisible work went into making the build itself trustworthy. The way Ritemark was packaged used to trip over itself in a few well-documented ways — a Windows-specific "too many open files" build failure, a nasty case that could silently ship a broken app, and steadily growing download sizes. Bundling the app's engine into a single clean package removes all three. You won't see this directly, but you'll feel it: a smaller download and builds that don't randomly break.

The "seamless updates" half of this release's name — updates that download quietly in the background and apply with one click — is **still to come** in a later sprint. This draft is the Windows-foundation half.

Sprint docs: `docs/development/sprints/sprint-91-windows-foundation/` and `docs/development/sprints/sprint-92-esbuild-bundling/`

* * *

## What's New

### Ritemark now installs on Windows 11 (sprint-91)

<!-- Screenshots would live in ./screenshots/ (directory not yet created for this release). -->

The whole Windows app is now **code-signed**, so a default Windows 11 machine trusts it:

- **The installer is signed.** `Ritemark-Setup.exe` (and the uninstaller, the loader Windows extracts mid-install, the main program, and the bundled AI helper programs) all carry a valid signature under **Productory Services OÜ**. Windows shows a real, verified publisher name instead of "unknown".
- **The "can't confirm who published this app" block is gone.** The unsigned wall (Error 4551) that stopped installation on Smart App Control machines no longer appears. On a clean Windows 11 test machine with Smart App Control enabled, the signed installer installed with no block, no SmartScreen warning, and no "run anyway" step.
- **How it's signed.** Ritemark uses **Azure Trusted Signing**, Microsoft's own cloud signing service — the path Microsoft recommends for exactly this situation. Productory's business history qualified it for public-trust signing.

This closes the signing portion of [#130](https://github.com/ProductoryHQ/ritemark-native/issues/130).

**One honest caveat.** Signing removes the "unsigned" block immediately, but Smart App Control *also* weighs a separate Microsoft "reputation" signal, and a brand-new signed app can occasionally still be held on some machines until that reputation builds. The formal step of **submitting the final release build to Microsoft for reputation review happens at release time** (it has to use the real shipping binary, which doesn't exist yet). If you ever hit a residual warning on your machine, the one-time workaround is documented in **[Windows Smart App Control](../../user/windows-smart-app-control.md)**.

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

## Under the Hood

### Windows code-signing via Azure Trusted Signing (sprint-91)

Signing has to happen on Windows: `signtool.exe` and the Azure Trusted Signing library are Windows-only, so the signed release installer is produced on Windows (CI `build-windows.yml` or a Windows machine), while the existing Docker/macOS installer path stays as an **unsigned local-dev fallback** guarded by a `#ifdef Sign` in `installer/windows/ritemark.iss`. CI signs the executables with `azure/trusted-signing-action`, then the installer itself is signed via `Invoke-TrustedSigning`. Every signed artifact is verified with `signtool verify /pa`. The certificate profile (`ritemark-public-trust`, publisher "Productory Services OÜ") and the four `AZURE_SIGNING_*` GitHub secrets live entirely outside this repo. A signature check was added to `scripts/validate-build-output.sh` (Section 9), currently gated behind `RITEMARK_SKIP_SIGNING_CHECK` so it stays advisory until a few more signed builds confirm reliability, then it flips to fail-closed. The Microsoft reputation submission (W1-11) and that fail-closed flip (W1-12) are deliberately **deferred to release time**.

### Cloud-file error detection (sprint-91, patch 011)

Ritemark's editor never sees this failure — VS Code core reads the file to build the `TextDocument` *before* the custom editor runs, so the fix had to be a VS Code core patch, not extension code. New patch `011-ritemark-cloud-file-error.patch` extends `diskFileSystemProvider.ts`'s error mapping. A key real-world finding: libuv collapses every unmapped Windows `ERROR_CLOUD_FILE_*` code into a generic `UNKNOWN` (errno `-4094`) and drops the original code and any "cloud" wording — so detection keys off the *pattern* (`UNKNOWN` + a `read`/`open` syscall on Windows), not a message regex. The raw errno and syscall are logged for diagnostics. The path only triggers on that exact Windows failure pattern, so successful reads and all non-Windows platforms are untouched.

### esbuild bundling of the extension host (sprint-92)

The extension host used to ship as ~130 loose `.js` files plus ~180 packages. It's now a single esbuild bundle: `out/extension.js` (~5.2 MB) plus one standalone `out/browser/browserMcpAdapter.js` (it's spawned as its own OS process and can't be inlined). `npm run compile` now runs `tsc --noEmit` for type-checking and then esbuild for the emit, so a type error still fails the build loudly. Two `__dirname`-relative path lookups (`bundledAgentRuntime.ts`, `BrowserToolsInjector.ts`) were fixed for the new one-level bundle depth. This closes three documented incidents at their root: the Windows **EMFILE** ("too many open files") build failure, the **v1.7.1 0-byte-tsc trap** that could ship a broken app, and steadily growing **DMG/zip bloat**. A full production build was run end-to-end and the packaged app was launched and verified (editor, AI sidebar, Settings all load; all three AI runtimes resolve correctly). GitHub issues #107 and #108 are now unblocked but explicitly **not** built here.

### CI de-risk (sprint-91)

The `push: tags: v*` auto-trigger was removed from both `build-windows.yml` and `build-macos-x64.yml` — neither derives its version from the git ref, so `workflow_dispatch` from any branch is safe and avoids surprise large-runner builds. A new `windows-canary.yml` runs weekly on the free `windows-latest` runner, exercising the precise VS2026/node-gyp toolchain check that has broken Windows CI before — an early-warning signal without cloning VS Code.

* * *

## Tests and Validation

**This release has not been built as a shippable app, and the full release gates have not been run.** Both shipped sprints are merged to `main` (Sprint 91 via PR #137, Sprint 92 via PR #138), and each was verified within its own scope:

- **Windows signing (sprint-91):** the certificate is live; a CI build signed all executables and they passed `signtool verify /pa`; the signed installer was tested on a **separate clean Windows 11 machine with Smart App Control enabled** and installed with no block, no SmartScreen warning, no "run anyway".
- **OneDrive error surfacing (sprint-91):** live-reproduced on a real Windows OneDrive "not downloaded" file (`errno=-4094, syscall=read`) and the actionable message confirmed; ordinary local files confirmed unaffected on both platforms.
- **New File / New Folder buttons (sprint-91):** verified visible and functional inline on Windows, and confirmed unchanged (no duplication) on macOS.
- **esbuild bundling (sprint-92):** full production build run end-to-end; packaged app launched and verified (editor, AI sidebar, Settings, all three AI runtimes); a deliberate type error confirmed to still fail the build.

Still pending for the actual v1.8.2 ship:

- **Sprint-93 (seamless updates)** — not yet built. It is expected to land before v1.8.2 ships and will add sections to this document.
- **Gate 1 (macOS arm64):** NOT YET RUN — no signed DMG built.
- **Gate 2 (macOS x64 + signed Windows installer, incl. the clean-Win11-SAC test on the final binary):** NOT YET RUN.
- **Notarization / stapling (macOS):** NOT YET RUN.
- **Microsoft Smart App Control reputation submission (Windows):** deferred to release time — it must use the final shipping binary.
- **`qa-validator` sign-off + Jarmo local test pass:** PENDING.

* * *

## Known Issues &amp; Deferred

- **Smart App Control reputation may lag on some machines.** Signing removes the "unsigned" block, but a brand-new signed app can still be held by Smart App Control's reputation signal on some PCs until reputation builds or Microsoft's review completes. The reputation submission happens at release time; the interim one-time workaround is documented in **[Windows Smart App Control](../../user/windows-smart-app-control.md)**.
- **The signing self-check is still advisory.** The build's signature validation is gated behind `RITEMARK_SKIP_SIGNING_CHECK` for now; it flips to fail-closed after a few more signed builds confirm reliability (deferred, tracked as W1-12).
- **Seamless background updates are not in this draft yet.** The one-click "Relaunch to update" experience (sprint-93) is planned but not yet built — it is the other half of this release's name and will be added before v1.8.2 ships.
- **Windows voice dictation is still deferred.** [#133](https://github.com/ProductoryHQ/ritemark-native/issues/133) (Windows voice dictation parity) is out of scope for v1.8.2 and planned for a later Windows-parity release.
- **Deeper OneDrive fixes are deferred.** This release surfaces a clear error and logs diagnostics; it does not attempt to force-download cloud placeholders. Further work waits on a reproducible core case.
