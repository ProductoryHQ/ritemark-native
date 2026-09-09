# Ritemark 1.10.1 Test Checklist

Release evidence for the v1.10.1 Codex Reliability maintenance release (all three platforms). Product source commit: `640e2aac86e03afb6d55ca5718794a9f5f5d83fe`.

## Current candidate record — 2026-09-09

- **Windows** (done before the macOS work, not repeated): CI run `34264256278` (`main@640e2aac`) produced `Ritemark-Setup.exe`, SHA-256 `c4315264e0d12de3fa03f7d3ada241825b1419f162a8c74d0dd55ea9a8f1f4e5`, publisher `Productory Services OÜ`, 46 signed PEs (v1.10.0 had 44 — the two Codex sandbox helpers are packaged), roundtrip `status: passed`. The artifact's `store_url` still names `downloads.ritemark.app`; the file and hash are correct and the host is corrected before Partner Center, not before publication. Preserved as `dist/Ritemark-1.10.1-win32-x64-setup.exe` with its `.sha256.txt` and `win32-roundtrip-evidence/` in the release worktree.
- **macOS x64**: CI run `34264252795` (`main@640e2aac`, Node 22.22.1 x64) extracted with `extract-macos-x64-artifact.sh` (extension attestation matches). Signed from the release worktree with `RITEMARK_RELEASE_COMMIT=640e2aac…`: 45 components, 0 failures, hardened runtime, secure timestamp, all Electron libraries and all four agent binaries (`claude`, `codex-app-server`, `codex-code-mode-host`, `opencode`) carry Team ID `JKBSC3ZDT5`, all Mach-O x86_64 (the only arm64 slice is inside the universal `fsevents.node`). `create-dmg` could not drive Finder from a non-interactive session (AppleScript -1743), so the DMG was built the v1.8.1 way: `ditto` → UDRW with volume icon → `hdiutil convert` UDZO zlib-9 → `codesign`. Result `dist/Ritemark-1.10.1-darwin-x64.dmg`, 666,268,813 bytes, SHA-256 `d42d42f51be5b8c21888c03bdf86b9a2da505da62fbb5e1c1529bcd635ccbf20`, built **2026-09-09 17:16:34 EEST** (hardening clock). **Not notarized.**
- **macOS arm64**: the first release worktree at `640e2aac` could not build: `build-prod.sh` Step 1 refused because the committed `media/webview.js` differs from a clean `npm ci` + `vite build` by 11 two-byte `\r` escapes inside `className` template literals (bundle committed from a Windows autocrlf checkout in `e4321178`). Harness fix [#268](https://github.com/ProductoryHQ/ritemark-native/pull/268) merged as `daf90f5a` (diff against `640e2aac`: `scripts/build-prod.sh` only); the root-cause fix [#267](https://github.com/ProductoryHQ/ritemark-native/pull/267) (LF rebuild + `.gitattributes`) is deferred to the next release. Rebuilt in a second fresh worktree `.worktrees/release-daf90f5adc70` (Node 22.22.1 arm64): preflight passed, Step 1 took the documented CR-residue path and restored the tracked bundle, both provenance verifications and post-build validation passed. Signed: 47 components, 0 failures. DMG built the same `hdiutil` way: `dist/Ritemark-1.10.1-darwin-arm64.dmg`, 625,106,078 bytes, SHA-256 `13c061d86a9fbf5a91257d94d8c1e2ff0a546800df1940ceb0ee01e03e0875fb`, built **2026-09-09 20:13:14 EEST** (hardening clock). **Not notarized.** Embedded provenance records `sourceCommit=daf90f5a` (harness tip); product bytes are those of `640e2aac`, where the tag goes (D1).

## Mounted arm64 DMG hard checks — 2026-09-09

- [x] Extension present; `webview.js` 8,844,056 bytes, SHA-256 `fec38a94…` — byte-identical to the x64 and Windows bundle.
- [x] `node_modules` 86 top-level entries / 103 `package.json`; `check-bundled-extension-complete.sh` passes; bundled extension version floored to `1.10.1-0`.
- [x] App and DMG both `TeamIdentifier=JKBSC3ZDT5`; deep `codesign --verify --strict` passes; `flags=0x10000(runtime)`.
- [x] `product.json` `ritemarkVersion` `1.10.1`; `Info.plist` `1.10.1`; app mtime is the build time.
- [x] Embedded provenance: `target=darwin-arm64`, `sourceCommit=daf90f5a`, `vscodeCommit=10c8e557`, Node `v22.22.1` arm64.
- [x] `extension.js` 4,914,977 bytes; 0 zero-byte `.js` under `out/`; only `darwin-arm64` under `binaries/agents/`.
- [x] Bundled runtimes execute natively from the signed bundle: `claude` `2.1.239`, `codex-app-server` `0.153.0`, `opencode` `1.18.21`; `codex-code-mode-host` starts and parses arguments.
- [x] `spctl` reports `rejected` — expected until notarized.

## Packaged arm64 canary — 2026-09-09

Driven by Claude over CDP against the app copied out of the signed DMG, isolated user-data directory, seeded workspace (220 old `bulk/*.md` files plus five dated files).

- [x] Launches with the folder, no workspace-trust dialog, status bar `AI Ready`.
- [x] Home → **Recent documents** lists `zz-newest.md`, `ends-with-list.md`, `newer.md`, `older.md`, `README.md` — the true mtime order; none of the 220 older files leak in ([#194](https://github.com/ProductoryHQ/ritemark-native/issues/194)).
- [x] `ends-with-list.md` opens in the Ritemark editor (3 list items rendered). After appending text to the last item and saving, the file on disk ends in exactly one `0a` (`gamma delta\n`) ([#254](https://github.com/ProductoryHQ/ritemark-native/issues/254)).
- [x] AI sidebar shows a resolved model, `Claude Code · Anthropic · Sonnet 5`, with no mismatch or unavailability warning.
- [ ] Onboarding pane with Claude signed out and Codex signed in — Jarmo (Gate 2); the build Mac's keychain holds Jarmo's Claude credentials.

## Mounted x64 DMG hard checks — 2026-09-09

- [x] Extension present; `webview.js` 8,844,056 bytes, SHA-256 `fec38a94…` — byte-identical to the committed bundle at `640e2aac`.
- [x] `node_modules` 86 top-level entries / 103 `package.json` (same 86 as the installed v1.10.0); `check-bundled-extension-complete.sh` passes.
- [x] App and DMG both `TeamIdentifier=JKBSC3ZDT5`; deep `codesign --verify --strict` passes; `flags=0x10000(runtime)`.
- [x] `product.json` `ritemarkVersion` is `1.10.1`; `Info.plist` `CFBundleShortVersionString` `1.10.1`; app bundle mtime set to build time (the CI tarball carried the 1980 epoch, corrected before packaging; signature still verifies).
- [x] Embedded provenance: `target=darwin-x64`, `sourceCommit=640e2aac`, `vscodeCommit=10c8e557`, verified anchored to the release commit.
- [x] `extension.js` 4,914,977 bytes; 0 zero-byte `.js` files under `out/`.
- [x] Only `darwin-x64` under `binaries/agents/` (foreign platform trees stripped).
- [x] Under Rosetta on the arm64 build machine: `claude` reports `2.1.239`, `codex-app-server` reports `0.153.0`. `opencode` prints Rosetta's "CPU lacks AVX" warning — a Rosetta limitation, not provable here; native Intel run is Jarmo's Gate 2.
- [x] `spctl` reports `rejected` — expected until notarized.

## Gate 2 — Jarmo (packaged artifacts only, never a local drop-in)

- [ ] **Windows:** Codex file read and write in sandbox mode `workspace-write` (not full access, which bypasses the sandbox and hides the defect). v1.10.0 failed with `orchestrator_helper_launch_failed: … codex-windows-sandbox-setup.exe … program not found`.
- [ ] **Windows and macOS:** with Claude signed out and Codex signed in, the Codex setup pane stays put (v1.10.0 remounted it on a ~2 s cycle). Windows dev build measured 182 → 0 remounts; the packaged builds are the thing under test. Not reproducible by Claude on the build Mac without removing Jarmo's Claude keychain credentials.
- [ ] **All platforms:** save a document whose last block is a list; the trailing newline is kept ([#254](https://github.com/ProductoryHQ/ritemark-native/issues/254)).
- [ ] **All platforms:** Home lists the documents actually opened recently ([#194](https://github.com/ProductoryHQ/ritemark-native/issues/194)).
- [ ] **macOS x64 (Intel):** DMG opens, app runs from `/Applications`, editor and AI sidebar load, bundled runtimes report their versions in Settings.

## Installation

- macOS arm64 / x64: DMG opens, app runs from `/Applications`; before notarization Gatekeeper warns (right-click → Open); after notarization and stapling no warning.
- Windows: installer runs signed as `Productory Services OÜ`, launches from Start Menu; Smart App Control reputation is tracked separately in [#130](https://github.com/ProductoryHQ/ritemark-native/issues/130).

## Sign-off

| Platform | Artifact | Gate 1 (technical) | Notarized / stapled | Gate 2 (Jarmo) |
| --- | --- | --- | --- | --- |
| Windows x64 | `c4315264…f1f4e5` | passed (CI roundtrip, 46 PEs) | n/a | open |
| macOS x64 | `d42d42f5…cbf20` (pre-notarization) | passed 2026-09-09 | pending | open |
| macOS arm64 | `13c061d8…75fb` (pre-notarization) | passed 2026-09-09 | pending | open |
