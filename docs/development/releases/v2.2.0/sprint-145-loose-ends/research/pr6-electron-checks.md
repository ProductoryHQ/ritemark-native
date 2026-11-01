# PR 6's checks: Electron 43.8.6 on Node 24.22.1 (R12, S50, S51, #515)

1 November 2026, on the Mac, branch `sprint-145-loose-ends-electron` from `origin/main` at `d2fc595a`. VS Code 1.142 at the pin `d956e8a6`, in a copy-on-write `vscode/` tree in the worktree, reset to the pin, cleaned and patched from scratch with `./scripts/apply-patches.sh`. Arm64 Node 24.18.0 (`vscode/.nvmrc`). R12 has nothing that fails on `main` before the change (E1): `main` runs 43.8.3 on Node 24.22.0, which is what the issue reports.

## S50: availability

[electron-availability.md](electron-availability.md), *Run again for PR 6*: on 1 November, 17:21 UTC, the newest 43.x is 43.8.6 (30 October), on Node 24.22.1. PR 6 takes it.

## How the patch was made

As Sprint 144 made it, through `./scripts/create-patch.sh` on the patched tree:

1. Patch 020 reversed, so the tree was the pin plus 001–019, and that state staged in `vscode/`'s index (so `git diff`, which `create-patch.sh` runs, shows only the new change).
2. The three files edited:
   - `.npmrc`: `target="43.8.6"`; `ms_build_id` unchanged (read only with `product.electronArtifactFeed`, which Ritemark never sets).
   - `build/checksums/electron.txt`: Electron's own `SHASUMS256.txt` for v43.8.6, downloaded from the GitHub release, copied as it is, plus the trailing newline VS Code's copy has. Its first 7610 bytes hash to `91b08f0f…88e54`, the digest GitHub shows for the asset.
   - `cgmanifest.json`: Node 24.22.1 (tag commit `ce7aaf1c…`) and Electron 43.8.6 (tag commit `294458de…`), the commits each project's tag points at, as Sprint 144 recorded them. The Chromium entry (150.0.7871.250) is unchanged: 43.8.6 has the same Chromium.
3. `create-patch.sh "ritemark-electron-43"`: its diff is byte for byte `git diff HEAD` of the three files against the pin. The diff replaced patch 020's old diff under its updated header; the numbered copy the script made was removed and the index put back at the pin.

No other patch touches the three files (`grep '^diff --git'` over `patches/vscode/`).

## S51: the checks

| Check | Result |
|---|---|
| `./scripts/apply-patches.sh --dry-run` on the pin (`vscode/` HEAD `d956e8a6`) | **Pass.** Can apply 19, conflicts 0 |
| A real apply from a pristine tree (`reset --hard`, `clean -fd -e extensions/ritemark`), then a re-run | **Pass.** Applied 19, failed 0; the re-run skips 19 and exits 0. The applied files equal the patch |
| The build's Electron download (`npm run electron`), which checks every file against `build/checksums/electron.txt` (`validateChecksum`) | **Pass.** It downloaded and verified 43.8.6: `.build/electron/version` and the framework's `CFBundleVersion` read `43.8.6`; the zip's SHA-256 (`dd3ef1cf…71390`) is the darwin-arm64 line of Electron's file |
| A wrong checksum stops the download (Sprint 144's S10, again for 43.8.6): the darwin-arm64 line zeroed in a scratch edit | **Pass.** `npm run electron` stops with `ChecksumMismatchError: Generated checksum for "electron-v43.8.6-darwin-arm64.zip" did not match expected checksum`, from the cached zip too. Electron's file put back (the three files equal the patch again) and the download run again: 43.8.6, Node 24.22.1 |
| The downloaded Electron's own versions (`process.versions` with `ELECTRON_RUN_AS_NODE=1`, no window) | **Pass.** electron 43.8.6, node **24.22.1**, chrome 150.0.7871.250, modules 148, arm64 |
| `./scripts/check-native-modules.sh` (architecture) | **Pass.** 55 arm64, 40 other platforms' payloads skipped |
| Native-module ABI: each module node-gyp built (`build/Release/*.node` in `vscode/node_modules` and the built-in extensions', 20 files, built against 43.8.3's headers, ABI 148) loaded in 43.8.6's runtime | **Pass.** 14 load, among them node-pty, `@vscode/sqlite3`, `@vscode/spdlog`, `@parcel/watcher`, native-keymap, `@vscode/policy-watcher` and native-watchdog. The other 6 fail the same way on 43.8.3 (the same run with 43.8.3's Electron): four Windows-only modules that register nothing on a Mac, glob-watcher's file named `.node`, and kerberos asking for Linux's `libgssapi_krb5.so.2`. No ABI error. CI builds the modules against 43.7.7's headers before patching; that is ABI 148 too |
| A packaged app's archive in 43.8.6's stricter asar reader (43.8.4 checks header and entry sizes against the archive's length, electron/electron#55179): the installed 2.1.0's `node_modules.asar`, written by VS Code 1.142's own build and signed, every file read through Electron's `fs` (read only) | **Pass.** 43.8.6 and 43.8.3 (Electron's cached 43.8.3 zip, its checksum checked) read the same 806 folders and 6275 files, 224,870,129 bytes, with the same SHA-256 over paths and contents. Both show the same 16 unpacked binaries whose size on disk differs from the archive's header (they were changed after packaging; the cause wasn't traced here, and it is the same on both versions); both read them in full from `node_modules.asar.unpacked` |
| The extension host's Node calls to an outside address | **Unchanged** since A6 (*Run again*, in [electron-availability.md](electron-availability.md)): one path fetches an address a person or an agent supplies, Flows' Save File with an image URL; with Node 24.22.1 it gets the fix |

## Still to run

- **S51 in the app: not run yet.** One isolated dev launch of this branch, to see the extension host start, the built-in browser open a page, and About read Electron 43.8.6 and Node.js 24.22.1 (with a screenshot). Each time it was checked on 1 November, the Mac had been in use within the last second, and a hidden test window takes the keyboard focus on that Mac (27 October), so the launch waits for a time when a background test window may open. Everything it needs is ready in the worktree: the patched `vscode/` with `out/` rebuilt from it, Electron 43.8.6 downloaded and checked, the extension compiled.
- **Check 5f** (`validate-build-output.sh`: the packaged Electron is `.npmrc`'s target) needs a packaged app, so it runs on 2.2's candidate.
- **Windows** (the CI build, About, a terminal, a setting kept, a page in the browser) at Gate 2 on the candidate.
- **A6 once more** when the candidate is built (S50).

## Review round 1 (`/code-review` at high, head `ef3227f8`)

Nine findings; none in the patch's bytes, which the review checked on its own (the checksums against Electron's file, the tag commits, the blob hashes, the dry run, the network-call read). What changed:

- **No dev launch for S51:** open, above.
- **`tasks.md` ticked the check before the candidate, and the "if none exists" item:** the candidate's A6 and S51's launch are open items now; the conditional item is marked not applicable.
- **43.8.4's stricter archive checks and the packaged app:** checked on the installed 2.1.0's archive (the table).
- **No wrong-checksum run, no Check 5f:** the wrong-checksum run is in the table; Check 5f runs on the candidate.
- **`scripts/build-windows-local.ps1` pins 43.7.7:** its comment now says why: it is the pin's own target, CI builds native modules before the patches too, and every 43.x has ABI 148.
- **"Chromium fixes for the built-in browser":** the changelog and the release-notes draft say they cover everything Ritemark shows.
- **Not changed:** a script for the next Electron move (out of scope; patch 020 is deleted at the next VS Code update that carries this Electron); the branch name `sprint-145-loose-ends-electron` (the sprint plan's PR 6 branch, as for PR 2–4).

`/security-review` on the diff (not inside `vscode/`): no findings. It downloaded Electron's file again and matched it byte for byte, found no new download source and verification still on, and matched both tag commits.
