# Releasing Ritemark — a guide for Jarmo

Ritemark ships two different ways, depending on what changed. You don't need to figure out which one applies — Claude tells you, because a script checks it automatically.

## The two kinds of release

**Extension release** (most changes — bug fixes, new AI features, editor tweaks). Small, fast, no download for you to click through. Version looks like `1.8.2-ext.3`.

**Shell release** (rare — anything touching the VS Code base itself, code signing, or the installer). This is the ~500MB app you download and install manually. Version looks like `1.8.2`.

A script (`release-extension-preflight.sh`) checks which one applies before anything ships. If it detects a shell-tier change hiding inside what looked like a small fix, it blocks and tells Claude to switch to the full shell process instead. You'll never be asked to make this call yourself.

## What you do for an extension release

1. Claude tells you it's ready to test.
2. Open Ritemark. If an update already downloaded quietly in the background, you'll see a small **"Ritemark X.Y.Z ready"** notice in the status bar (bottom of the window). Click it to relaunch and update — no separate download step.
3. Try the specific thing that changed. You don't need to re-test the whole app — just the feature(s) in the update.
4. If it works: tell Claude "tested locally" or "approved" (or whatever confirms it). That's the only sign-off needed — no notarization wait, no extra CI runs.
5. If something's broken: tell Claude what went wrong. It fixes and re-ships.

That's it — an extension release is normally same-day, sometimes same-hour.

## What you do for a shell release

This is the traditional process, and it happens roughly monthly (batched, not per-change):

1. Claude builds a signed DMG (macOS) / installer (Windows) and tells you it's ready to test — **unnotarized** at this point, deliberately.
2. You install it fresh and actually use it for a while.
3. Tell Claude "tested locally" once you're satisfied.
4. Claude waits ~60 minutes (a safety window — late-surfacing bugs get one more chance to show up) before notarizing and publishing.
5. For a release affecting both macOS and Windows, this repeats once more for the second platform (Gate 2).

### Windows shell-release gate

Windows installers are produced by the manually dispatched `Build Windows (x64)` workflow. It always signs and stops if Azure credentials or any signature check is missing.

The workflow must finish payload PE signing, Inno setup/uninstaller signing, publisher/timestamp verification, standard-user silent install, installed-tree/product-registration checks, and uninstall before it uploads the installer. The expected publisher is `Productory Services OÜ`.

For v1.10.0, Partner Center ingests `https://downloads.ritemark.app/windows/v1.10.0/Ritemark-Setup.exe`. GitHub Release retains the same bytes as a secondary direct download. Kristiina tests that SHA-256 on a clean Windows 11 machine with Smart App Control On; Jarmo approves the same file for Gate 2.

Operator commands and evidence requirements are in [Building and Verifying the Windows Installer](./building-windows-installer.md). Partner Center and clean-machine ownership are in the [Sprint 114 handoff](./releases/v1.10.0/sprint-114-trusted-windows-install/research/partner-center-and-sac-handoff.md).

This is the slower path on purpose — it's changing the actual signed app, so it gets the full test-then-harden-then-publish treatment.

## How to tell which one is happening

You don't have to — Claude will say "this ships as an extension release" or "this needs a shell release" before asking you to test anything. If you're ever unsure, just ask.

## FAQ

**Do I need to do anything differently day-to-day?** No — just keep using Ritemark normally. Extension updates arrive automatically; you'll only ever see the "ready to relaunch" notice.

**Can I turn off automatic updates?** Yes — `ritemark.updates.mode` in Settings can be set to `"prompt"` instead of `"auto"` if you'd rather approve each install manually with the old-style notification. Full app updates (shell releases) aren't affected by this setting either way — those always need your explicit install.

**What if an update breaks something?** Ritemark keeps the previous working version on disk. If a new version fails to start correctly, the next launch detects that it never confirmed and automatically reverts to the previous working version.

**Why are shell releases slower?** They replace the entire signed app bundle, which has to go through Apple notarization and a hardening window before it's safe to publish widely. Extension releases never touch that bundle, so none of that applies.
