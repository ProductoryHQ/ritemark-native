# Ritemark 1.10.1 Test Checklist

Release evidence for the v1.10.1 Codex Reliability maintenance release (all three platforms). Product source commit: `640e2aac86e03afb6d55ca5718794a9f5f5d83fe`.

## Current candidate record — 2026-09-09

- **Windows** (done before the macOS work, not repeated): CI run `34264256278` (`main@640e2aac`) produced `Ritemark-Setup.exe`, SHA-256 `c4315264e0d12de3fa03f7d3ada241825b1419f162a8c74d0dd55ea9a8f1f4e5`, publisher `Productory Services OÜ`, 46 signed PEs (v1.10.0 had 44 — the two Codex sandbox helpers are packaged), roundtrip `status: passed`. The artifact's `store_url` still names `downloads.ritemark.app`; the file and hash are correct and the host is corrected before Partner Center, not before publication. Preserved as `dist/Ritemark-1.10.1-win32-x64-setup.exe` with its `.sha256.txt` and `win32-roundtrip-evidence/` in the release worktree.
- **macOS x64**: CI run `34264252795` (`main@640e2aac`, Node 22.22.1 x64) extracted with `extract-macos-x64-artifact.sh` (extension attestation matches). Signed from the release worktree with `RITEMARK_RELEASE_COMMIT=640e2aac…`: 45 components, 0 failures, hardened runtime, secure timestamp, all Electron libraries and all four agent binaries (`claude`, `codex-app-server`, `codex-code-mode-host`, `opencode`) carry Team ID `JKBSC3ZDT5`, all Mach-O x86_64 (the only arm64 slice is inside the universal `fsevents.node`). `create-dmg` could not drive Finder from a non-interactive session (AppleScript -1743), so the DMG was built the v1.8.1 way: `ditto` → UDRW with volume icon → `hdiutil convert` UDZO zlib-9 → `codesign`. Result `dist/Ritemark-1.10.1-darwin-x64.dmg`, 666,268,813 bytes, SHA-256 `d42d42f51be5b8c21888c03bdf86b9a2da505da62fbb5e1c1529bcd635ccbf20`, built **2026-09-09 17:16:34 EEST** (hardening clock). **Not notarized.**
- **macOS arm64**: the first release worktree at `640e2aac` could not build: `build-prod.sh` Step 1 refused because the committed `media/webview.js` differs from a clean `npm ci` + `vite build` by 11 two-byte `\r` escapes inside `className` template literals (bundle committed from a Windows autocrlf checkout in `e4321178`). Harness fix [#268](https://github.com/ProductoryHQ/ritemark-native/pull/268) merged as `daf90f5a` (diff against `640e2aac`: `scripts/build-prod.sh` only); the root-cause fix [#267](https://github.com/ProductoryHQ/ritemark-native/pull/267) (LF rebuild + `.gitattributes`) is deferred to the next release. Rebuilt in a second fresh worktree `.worktrees/release-daf90f5adc70` (Node 22.22.1 arm64): preflight passed, Step 1 took the documented CR-residue path and restored the tracked bundle, both provenance verifications and post-build validation passed. Signed: 47 components, 0 failures. DMG built the same `hdiutil` way: `dist/Ritemark-1.10.1-darwin-arm64.dmg`, 625,106,078 bytes, SHA-256 `13c061d86a9fbf5a91257d94d8c1e2ff0a546800df1940ceb0ee01e03e0875fb`, built **2026-09-09 20:13:14 EEST** (hardening clock). **Not notarized.** Embedded provenance records `sourceCommit=daf90f5a` (harness tip); product bytes are those of `640e2aac`, where the tag goes (D1).

## Candidate 3 — fix train (2026-09-10)

Both earlier candidates are discarded (Jarmo, 2026-09-10): the v1.10.1 source carried a typing-level regression. Fixes on `fix/v1.10.1-editor-sync-tasklist` (PR #271), plan and outcome in `docs/development/releases/v1.10.1/fix-plan.md`.

- [x] Bug 1 (host echo re-applied over typing): canonical projection on both sides. RUNDEV trace with autosave: only `peer-edit` updates, `matches: true`, no external apply, no lost keystrokes, saved file ends in one `\n`; front-matter document identical.
- [x] Bug 2 (checkbox above text): first text node `A`, checkbox/text centres 1 px apart; screenshot inspected.
- [x] Bug 3 (empty task item → literal `[ ]`): Slash → Task List survives autosave, save, close and reopen as an empty checkbox; typing then saves `- [ ] todo`.
- [x] Bug 4 (two undo stacks): after the override, Cmd+Z shows `editor-update` + matching echo only, no `undo-redo`; redo restores without duplication.
- [x] Data-loss gate: `- [ ] A` / `- [x] B` open with hash unchanged and a clean tab; toggle + save writes `- [x] A` / `- [x] B`.
- [x] `test:editor-sync`, `test:task-list-roundtrip`, remaining chain green; integration test failure is environmental and identical on `main`.
- [x] **arm64 candidate 3 built and signed** from `23493cef` in `.worktrees/release-23493cef1f4d` (Node 22.22.1 arm64): preflight passed, `build-prod.sh` clean with the committed bundle reproduced byte-for-byte, 47 components signed, 0 failures. DMG `dist/Ritemark-1.10.1-darwin-arm64.dmg`, 625,107,367 bytes, SHA-256 `bbd9e048bed390e163301c684ca028d9b649a3bd25f853a2e0a07854e180b090`, built **2026-09-10 14:33:36 EEST** (hardening clock). **Not notarized.** Mounted-DMG hard checks: extension present, `webview.js` 8,844,955 bytes = committed `6ebdda86…`, node_modules 86 / completeness check passed, app and DMG Team ID `JKBSC3ZDT5`, `ritemarkVersion` 1.10.1, provenance `darwin-arm64` / `23493cef` / vscode `10c8e557`, deep signature and hardened runtime OK, all four agent binaries re-signed and executing, undo override present in bundle and manifest, `spctl` rejected as expected.
- [x] Packaged arm64 canary at typing speed on the app copied out of that DMG (isolated profile, autosave on): 15/15 — no trust dialog; plain and front-matter bursts with Enter mid-item intact; undo changes the document and redo restores it exactly; saved plain file ends in one newline, front matter preserved; task fixture opens untouched, text starts with `A`, checkbox and text on one row, toggle + save writes `- [x] A` / `- [x] B`; Slash → Task List survives autosave, saves as bare `- [ ]`, reopens as a checkbox, typing saves `- [ ] todo`; Home recents lead with the newest files. Screenshot `tasks.png` inspected.
- [x] **macOS x64 candidate 3**: CI run `34472235343` (`main@23493cef`, Node 22.22.1 x64) extracted with `extract-macos-x64-artifact.sh` (attestation matches; bundle `6ebdda86…` = committed). Signed anchored to `RITEMARK_RELEASE_COMMIT=23493cef…`: 45 components, 0 failures, hardened runtime, timestamp, all four agent binaries Team ID `JKBSC3ZDT5` and x86_64 (`claude` 2.1.239 and `codex-app-server` 0.153.0 run under Rosetta; `opencode` hits Rosetta's AVX limit, native Intel run is Gate 2). App mtime corrected from the 1980 epoch before packaging; deep signature still verifies. DMG `dist/Ritemark-1.10.1-darwin-x64.dmg`, 666,301,771 bytes, SHA-256 `f14095aedef5d488bdf38bcfa856923511e63ee6a8e2bb908469fe108d2cd8de`, built **2026-09-10 15:20:08 EEST** (hardening clock). **Not notarized.** Mounted-DMG hard checks all pass; the only non-x86_64 Mach-O is the universal `fsevents.node`.
- [x] **Windows candidate 3**: CI run `34472311244` (`main@23493cef`, dispatched with `source_commit`). `Ritemark-Setup.exe` SHA-256 `93f9adce13529c727cbb4b407822897f0043d65c62ff5dab0eab95fc54d77250`, sidecar records `source_commit` and `workflow_commit` `23493cef`; publisher `Productory Services OÜ`; roundtrip `status: passed` (standard-user install, registry, uninstall); **Windows PE check: 46 file(s), 0 failures** (both Codex sandbox helpers packaged). Preserved as `dist/Ritemark-1.10.1-win32-x64-setup.exe` with `.sha256.txt` and `win32-roundtrip-evidence/`. The sidecar's `store_url` still names `downloads.ritemark.app`; corrected before Partner Center, after publication.
- [x] Repository restored to public after the Windows build.
- [ ] Gate 2 (Jarmo) on the rebuilt arm64, x64 and Windows artifacts, including Edit-menu Undo (known limitation, document behaviour).

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
- [x] Baseline comparison on the installed v1.10.0 (same fixture, same steps, isolated profile): the saved file ends without a newline (last byte `61`), reproducing #254; v1.10.1 ends in `0a`.
- [ ] **Pre-existing, not a v1.10.1 regression, not a blocker:** both v1.10.0 and v1.10.1 rewrite a tight bullet list (`- alpha`) as a loose one on save (`-   alpha`, a whitespace-only line between items). Worth its own issue; the task-list round trip verified for v1.10.0 is a separate path.
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
| Windows x64 | `93f9adce…77250` (candidate 3) | passed (CI roundtrip, 46 PEs) | n/a | open |
| macOS x64 | `f14095ae…cd8de` (candidate 3, pre-notarization) | passed 2026-09-10 | pending | open |
| macOS arm64 | `bbd9e048…b090` (candidate 3, pre-notarization) | passed 2026-09-10 | pending | open |
