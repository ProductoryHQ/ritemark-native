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
| Native-module ABI: each module node-gyp built (`build/Release/*.node` in `vscode/node_modules` and the built-in extensions', 20 files, built against 43.8.3's headers, ABI 148) loaded in 43.8.6's runtime | **Pass.** 14 load, among them node-pty, `@vscode/sqlite3`, `@vscode/spdlog`, `@parcel/watcher`, native-keymap, `@vscode/policy-watcher` and native-watchdog. The other 6 fail the same way on 43.8.3 (the same run with 43.8.3's Electron): four Windows-only modules that register nothing on a Mac, glob-watcher's file named `.node`, and kerberos asking for Linux's `libgssapi_krb5.so.2`. No ABI error. The Mac's release build (`build-prod.sh`) patches before `npm ci`, so it builds them against the patched target, as here. Windows CI builds them against 43.7.7's headers (`npm ci` before the patches), ABI 148 too: modules built that way were loaded on 43.8.3 in Sprint 144 (its S11), not on 43.8.6 here. Windows' own modules are proven at Gate 2 |
| A packaged archive in 43.8.6's stricter asar reader (43.8.4 checks header and entry sizes against the archive's length, electron/electron#55179): the installed 2.1.0's `node_modules.asar`, written by VS Code 1.142's own build and signed, every file read through Electron's `fs` with `ELECTRON_RUN_AS_NODE` (read only). A stand-in for the packaged app's own start, which is the candidate's (below) | **Pass.** 43.8.6 and 43.8.3 (Electron's cached 43.8.3 zip, its checksum checked) read the same 806 folders and 6275 files, 224,870,129 bytes, with the same SHA-256 over paths and contents. Both show the same 16 unpacked binaries whose size on disk differs from the archive's header, and both read them in full from `node_modules.asar.unpacked`. Why they differ: they carry Ritemark's own signature (team `JKBSC3ZDT5`, `codesign -dv` on node-pty's `pty.node` and the proxy resolver: 22:09 on 27 October), made after the archive was written (22:08). Signing changes a binary's size; the header keeps the size from before. Every signed Ritemark build has this, on 43.8.3 too |
| The extension host's Node calls to an outside address | **Unchanged** since A6 (*Run again*, in [electron-availability.md](electron-availability.md)): one path fetches an address a person or an agent supplies, Flows' Save File with an image URL; with Node 24.22.1 it gets the fix |

## S51 in the app: one dev launch (1 November, 18:04 UTC)

Run once Jarmo said a background test window could open (asked through the Development manager: "jah, ava praegu"). One hidden dev instance of this branch (`open -n -g -j`), never relaunched: a fresh short profile with its own user-data, extensions and shared-data folders under `/private/tmp`, scratch homes for the AIs (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_*`), `--use-mock-keychain`, the three backgrounding flags, usage data off, `window.dialogStyle: custom` so About is drawn in the window. CDP on 9343, checked free before and owned by this instance's process. No keychain prompt; nothing was signed in or clicked on the AI's sheet. Driven by a CDP script that types only into a focused quick pick or the browser's address; the instance was quit after the run, and the port was free again.

| Check | Result |
|---|---|
| The window's own versions (`vscode.process.versions`) | electron 43.8.6, node 24.22.1, chrome 150.0.7871.250 |
| The extension host starts | **Pass.** `renderer.log`: "Started local extension host with pid 87683"; `exthost.log`: `ExtensionService#_doActivateExtension ritemark.ritemark, startup: true`. The status bar shows Ritemark's items ("No AI yet", Send feedback), and the AI's sheet and Home drew |
| The built-in browser opens a page | **Pass.** Ritemark Browser: New Browser Tab, a page served on `127.0.0.1` typed into the address: the server answered 2 requests, CDP lists a page target titled "PR 6 check page" at that address, and the tab reads "PR 6 check page (127.0.0.1:…)" |
| About shows Electron and Node | **Pass.** Help: About reads "Electron: 43.8.6", "Chromium: 150.0.7871.250", "Node.js: 24.22.1", "V8: 15.0.245.31-electron.0". Screenshot: [`qa/r12-about.png`](../qa/r12-about.png). "Version: 2.1.0" is `branding/product.json`'s version until 2.2's bump |

**Seen in the window, and why:** three error toasts (13 in `exthost.log`) say built-in extensions failed to start, among them `vscode.configuration-editing`, `vscode.emmet` and `vscode.github-authentication`: "Cannot find module …/vscode/extensions/<name>/out/…". Their `package.json` names a compiled `./out/…` file that this copied dev tree doesn't have: it has no compiled `out/` for them (`/extensions/**/out/` is ignored by Git, so neither the clean before patching nor the patches touch it, and this run didn't compile the built-in extensions). Thirteen built-in extensions are affected, none of them Ritemark's; the files are missing on disk, which no Electron version changes. A release build compiles them. While the toasts were up, the browser tab showed VS Code's own "Paused due to Notification" over the page, as it does whenever a notification covers it.

## Still to run

- **Check 5f** (`validate-build-output.sh`: the packaged Electron is `.npmrc`'s target) needs a packaged app, so it runs on 2.2's candidate.
- **The packaged, signed 43.8.6 app opening its own archive** (an archive this branch's build writes, the app's start, a terminal and syntax colours) on the candidate at Gate 1.
- **Windows** (the CI build, About, a terminal, a setting kept, a page in the browser) at Gate 2 on the candidate.
- **A6 once more** when the candidate is built (S50).

## Review round 1 (`/code-review` at high, head `ef3227f8`)

Nine findings; none in the patch's bytes, which the review checked on its own (the checksums against Electron's file, the tag commits, the blob hashes, the dry run, the network-call read). What changed:

- **No dev launch for S51:** run afterwards, once a background test window could open (*S51 in the app*, above).
- **`tasks.md` ticked the check before the candidate, and the "if none exists" item:** the candidate's A6 and S51's launch are open items now; the conditional item is marked not applicable.
- **43.8.4's stricter archive checks and the packaged app:** checked on the installed 2.1.0's archive (the table).
- **No wrong-checksum run, no Check 5f:** the wrong-checksum run is in the table; Check 5f runs on the candidate.
- **`scripts/build-windows-local.ps1` pins 43.7.7:** its comment now says why: it is the pin's own target, CI builds native modules before the patches too, and every 43.x has ABI 148.
- **"Chromium fixes for the built-in browser":** the changelog and the release-notes draft say they cover everything Ritemark shows.
- **Not changed:** a script for the next Electron move (out of scope; patch 020 is deleted at the next VS Code update that carries this Electron); the branch name `sprint-145-loose-ends-electron` (the sprint plan's PR 6 branch, as for PR 2–4).

## Review round 2 (`/code-review` at high, `584c9fbc` only)

Eight findings, all on round 1's answer. What changed:

- **`build-windows-local.ps1`'s comment described the mechanism wrongly and contradicted itself:** rewritten. The script applies the patches first, so `vscode/.npmrc` says 43.8.6, and its `npm_config_target` override builds the modules against the pin's 43.7.7, as Windows CI does by installing before the patches. The Mac's `build-prod.sh` builds against the patched target.
- **The 16 size differences were left unexplained:** traced to Ritemark's signature made after packaging (the table).
- **The archive check is a stand-in, and the packaged app's own start wasn't listed:** the row says so; the candidate's start is in *Still to run*.
- **The ABI row read as if Windows' 43.7.7-built modules were loaded on 43.8.6:** it now says what was loaded where.
- **`tasks.md`:** the not-applicable item is `[x] ~~…~~`, as in Sprints 125 and 129; the window-free S51 checks and the High review are their own items, the review left open until its record.
- **Not changed:** a check in the Windows builds that the native modules' Electron and the packaged Electron share a major. Patch 020 moves only inside 43, whose ABI is 148 for every release; the comment says what has to change if it ever leaves the line.

`/security-review` on the diff (not inside `vscode/`): no findings. It downloaded Electron's file again and matched it byte for byte, found no new download source and verification still on, and matched both tag commits.
