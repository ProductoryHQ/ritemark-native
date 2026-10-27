# Sprint 144 QA evidence

What ran, where, and what it showed. "Here" is the Mac, on a dev build of the branch in this worktree (VS Code `d956e8a6` with all patches, `npm ci` under arm64 Node 24.18.0). Every dev launch was hidden and isolated: its own profile, extensions and shared-data folders, its own `CODEX_HOME` and `CLAUDE_CONFIG_DIR` (both written to by the runtimes, so the person's `~/.codex` and `~/.claude` were never used), `--use-mock-keychain`, HOME unchanged.

## Part 1: the release harness (`sprint-144-release-harness`)

| Scenario | Result | Evidence |
|---|---|---|
| S13, the patch stack | **Pass.** On a pristine `d956e8a6` (`git -C vscode reset --hard`, `clean -fd -e extensions/ritemark`): `apply-patches.sh --dry-run` "OK (can apply)" for all 19, then applied, derived state recorded. Patch 020 has three `diff --git` sections: `.npmrc`, `build/checksums/electron.txt`, `cgmanifest.json` | This worktree, 27 October |
| The new `SHASUMS256.txt` | **Pass.** Electron's own v43.8.3 `SHASUMS256.txt` (SHA-256 `bfd55c81…`, equal to GitHub's asset digest); its darwin-arm64, darwin-x64 and win32-x64 lines equal GitHub's digests for those zips (`08e693ae…`, `3e16ccae…`, `98efbd2d…`). The pin's file was Electron's own 43.7.7 file plus a trailing newline, so 020's is too | `gh api repos/electron/electron/releases/tags/v43.8.3` |
| S10, a wrong checksum stops the build | **Pass.** With the darwin-arm64 line zeroed in a scratch edit (restored after), `npm run electron` failed: `ChecksumMismatchError: Generated checksum for "electron-v43.8.3-darwin-arm64.zip" did not match expected checksum.` | Dev download |
| The right checksum downloads | **Pass.** `npm run electron` downloaded and verified 43.8.3: `.build/electron/version` = `43.8.3`, the framework plist's `CFBundleVersion` = `43.8.3` | Dev download |
| S9, the Electron and Node in the running app | **Pass (dev).** The window: `vscode.process.versions` electron `43.8.3`, node `24.22.0`, chrome `150.0.7871.250`, modules `148`; CDP's user agent "Electron/43.8.3". The extension host ran from the same 43.8.3 bundle (`Ritemark Helper (Plugin).app` under `.build/electron`). About prints these same `process.versions` (patch 001); About itself is a native dialog and wasn't captured. The production About is Gate 1's | Dev launch p1 |
| S11, native modules (Mac) | **Pass.** Built against 43.7.7's headers (`config.gypi`: target `43.7.7`, `node_module_version` 148), as CI builds them, and run on 43.8.3: a terminal opened with a `bash` prompt (node-pty); the profile's `state.vscdb` was written (sqlite); a file written into the project from outside appeared in Home's *Last changed* within 4 s (the file watcher). No `NODE_MODULE_VERSION`, "compiled against" or `dlopen` line in any log. `scripts/check-native-modules.sh`: "53 arm64, 40 other platforms' payloads skipped", all fine | Dev launch p1 |
| S12, the integrated browser (Mac) | **Pass.** "Ritemark Browser: Open URL in Ritemark Browser" opened https://example.com, which rendered | Dev launch p1 |
| S12, the three AIs | **Not run here.** A turn needs a signed-in AI, and the person's own sign-ins live in `~/.codex` and `~/.claude`, which this sprint doesn't use. Gate 2's runtime line on Mac, Rosetta and Windows | — |
| S14, Check 5f | **Pass.** On scratch app trees: darwin plist 43.7.7 against target 43.8.3 → FAIL naming both; target 43.7.7 → OK; win32 `version` file `v43.8.3` one level down → OK; `43.7.7` at the root → FAIL; none → SKIPPED, "read About at Gate 2" | `scratchpad` test of the check's own lines |
| W1, the workflow | YAML parses; `runs-on: windows-latest`, `timeout-minutes: 120`, the disk guard second. Its first real run is S1 on `main` after the merge | — |
| W2, the release path | `grep -rn "visibility private\|visibility public\|repo toggle\|public/private" .claude .github docs/development/release-process` finds nothing | — |

Dev-environment noise seen in the p1 launch, not caused by this branch: GitHub Copilot Chat failed to activate (its `dist/` isn't built in a dev tree; release builds strip it), and the terminal showed Copilot CLI's hint for the same reason; "Missing 'tunnelApplicationConfig'" (OSS product.json); one "Refused to load resource /phosphor.woff2" at start, with every icon drawn.

**Still to run after the merge:** S1–S4 and S8 (the Windows build on `main`, the visibility and stars read before and after); `build-macos-x64.yml` on `main`; S11–S12's Windows half and S17–S19 by the Windows session; S15 or S16.
