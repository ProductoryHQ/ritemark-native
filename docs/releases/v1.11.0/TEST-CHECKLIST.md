# Ritemark 1.11.0 Test Checklist

Release evidence for v1.11.0 — Store Compliance + Agent Task Honesty. Product source commit: `a8343678e72a7d6d84606d30ee0d43cf4c409459`.

Shell-tier on two independent grounds: the Sprint 116 runtime binaries, and patch `016-ritemark-store-acquisition-policy` from Sprint 126.

## What is new, and therefore what has to be exercised

| Sprint | Change | Where it is tested |
|---|---|---|
| 116 | Claude Code 2.1.270, Codex 0.154.0, OpenCode 1.18.30 + refreshed model catalog | **Gate 2 carries the open gate** — native Intel and Windows execution was explicitly deferred here on 2026-09-14 |
| 117 | Comment→agent honesty: host-owned task ledger, real status, reply on the comment | Gate 1 |
| 126 | Report AI issue (status bar + AI Information → `info@productory.eu`); no Git/Node download offers | Gate 1 for reporting; **Windows for the Git-absent case** |

## Candidate 3 — 2026-09-17 (released)

Candidate 2 passed Gate 1 and was notarized, then became unusable for CI. Docs PR #310 was merged to `main` after the candidate was built, so `origin/main` moved past `9e963596`. Both CI dispatches then failed the source gate: `HEAD` has to equal live `origin/main`, and a named branch at the old commit is refused. Windows CI also needed three harness fixes before it could pass: [#311](https://github.com/ProductoryHQ/ritemark-native/pull/311), [#312](https://github.com/ProductoryHQ/ritemark-native/pull/312) and [#313](https://github.com/ProductoryHQ/ritemark-native/pull/313). So candidate 3 was rebuilt from the new tip, and every platform shares that one source commit. The product code is the same as candidate 2; the only differences are docs and CI scripts.

Source commit `bb823de525bc6e96cd34b6513be8405ebe9bd1a7` (tag `v1.11.0`). Built in `.worktrees/release-bb823de525bc`.

| Platform | Built | Signed | Notarization | Published asset |
| --- | --- | --- | --- | --- |
| macOS arm64 | locally, 2026-09-17 | 52 components, 0 failures | `9a95a684-3bb0-4f72-bc0d-f72fbde7b0a6`, Accepted, stapled | `Ritemark-arm64.dmg`, 623,574,471 bytes, SHA-256 `505d987ea9f35be436cb4109b5caac0c59c0847d65e9a8c834a092c5c896e64f` |
| macOS x64 | CI run `35181424280` | 50 components, 0 failures | `ba635e6f-e339-420e-9214-0414cf123b9a`, Accepted, stapled | `Ritemark-x64.dmg`, 664,007,658 bytes, SHA-256 `dfb913f47bc63c07829e341eafba95c139bd91e7a30939a1cf700113fa9d2947` |
| Windows x64 | CI run `35125844155` | Productory Services OÜ; standard-user roundtrip `passed` | not applicable | `Ritemark-Setup.exe`, 444,207,592 bytes, SHA-256 `0ebda5016e432b2f039613f74665343220006e39e7749ddb76d285d0a87b932b` |

Published 2026-09-18T11:56:21Z as Latest on `jarmo-productory/ritemark-public`, with `update-feed.json` (21 releases, v1.10.1 retained). Closeout evidence is in [`evidence/`](evidence/closeout.md).

## Candidate 2 — 2026-09-16 (superseded)

Candidate 1 was discarded at Gate 1. Jarmo: *"niipea kui liigun hiirega kommentaari poole, siis see on juba mouse-out from komment area ja kaob see kommentaar eest ära."* Hovering a highlight showed **Send to Claude** and then closed as the pointer travelled toward it, so the feature's primary action was unreachable by the gesture that revealed it. Fixed in [PR #309](https://github.com/ProductoryHQ/ritemark-native/pull/309): a click latches the comment open, hover gets a 220 ms grace, and the latched bubble is visibly different.

Source commit `9e963596ba14985471064b24e4c844d3984c3878`. Built in `.worktrees/release-9e963596ba14`, signed **52 components, 0 failures**. DMG `dist/Ritemark-1.11.0-darwin-arm64.dmg`, **623,571,092 bytes**, SHA-256 `35e8f99d8f9d64a40483083a79c42eb69377c043def6c6295eaadaa722682e7b`, built **2026-09-16 16:01:08 EEST** (hardening clock). Notarized after Gate 1, then superseded by candidate 3 (see above).

Mounted-DMG checks: `ritemarkVersion` 1.11.0; provenance `darwin-arm64` / `9e963596` / vscode `10c8e557`; the pin fix present in the shipped bundle; Sprint 126 intact (status bar item present, `git-scm.com/download` 0, `clickHereToInstall` 0); all three runtimes execute — `claude` 2.1.270, `codex-app-server` 0.154.0, `opencode` 1.18.30; `spctl` rejected as expected.

## Candidate 1 — 2026-09-16 (discarded at Gate 1)

Built in `.worktrees/release-a8343678e72a-2` (Node 22.x arm64). DMG `dist/Ritemark-1.11.0-darwin-arm64.dmg`, **623,571,703 bytes**, SHA-256 `9a367b3da2280807a01e7b7a6a6e3b0eb69bf23cb3ca01da508db1489fcf231c`, built **2026-09-16 09:35:56 EEST** (hardening clock). **Not notarized.**

Built the `ditto` → `hdiutil create` UDRW → `hdiutil convert` UDZO zlib-9 → `codesign` way: `create-dmg` cannot drive Finder from a non-interactive session (AppleScript **-1743**), the same fallback v1.10.1 used.

Two earlier attempts were discarded rather than repaired, and the reason is worth keeping: the first signing run hit a transient `--timestamp` failure on one component of fifty-two. Hand-signing that file broke the bundle seal; re-running signing then failed the provenance gate (correctly — the first pass had already changed extension bytes); and clearing the output and rebuilding failed the *source* gate, because `build-prod.sh` leaves `vscode/` patched, so a built release worktree is spent. The third attempt, in a fresh worktree, signed **52 components, 0 failures** with no other change.

## Automated checks (before handover)

- [x] `validate-qa.sh` exits 0 on the source commit
- [x] Preflight passed in the release worktree (one expected warning: extension symlink created during build)
- [x] `build-prod.sh` clean; committed `media/webview.js` reproduced byte-for-byte (8,869,400 bytes both sides)
- [x] Embedded provenance records `target=darwin-arm64`, `sourceCommit=a8343678`, `vscodeCommit=10c8e557`
- [x] All 16 patches applied, including `016-ritemark-store-acquisition-policy`
- [x] `ritemarkVersion` is `1.11.0` in the built app

## Mounted arm64 DMG hard checks — 2026-09-16

- [x] Extension present; `webview.js` 8,869,400 bytes, byte-identical to the committed bundle
- [x] `node_modules` 86 top-level entries; 0 zero-byte `.js` under `out/`
- [x] App and DMG both `TeamIdentifier=JKBSC3ZDT5`; hardened runtime (`flags=0x10000(runtime)`)
- [x] **Bundled runtimes execute from the signed bundle**: `claude` 2.1.270, `codex-app-server` 0.154.0, `opencode` 1.18.30 — all three re-signed under `JKBSC3ZDT5`. This is the Sprint 116 baseline confirmed on **arm64 only**; Intel and Windows remain Gate 2.
- [x] **Sprint 126 present in the shipped app**: status bar item and report dialog in the bundles, `info@productory.eu` carried; `git-scm.com/download` **0 occurrences** in `extensions/git/package.nls.json`; `clickHereToInstall` **0 occurrences** in the built workbench. The Windows SCM string now begins `"Source control depends on Git being installed."` — no line parses to a single link, so nothing renders as a button.
- [x] `spctl` reports `rejected` — expected until notarized

## ⛔ Gate 1 — Jarmo, on the installed arm64 DMG (un-notarized)

Gatekeeper will warn: right-click → **Open**, or `xattr -dr com.apple.quarantine '/Applications/Ritemark.app'`.

### Report AI output (Sprint 126, R2)

- [ ] **Report AI issue** is in the status bar beside the AI indicator, on a fresh profile, with the AI sidebar closed
- [ ] Clicking it reveals the AI panel and opens the report window
- [ ] AI Information (ⓘ in the composer) carries the same entry, and opens the same window
- [ ] The window opens with an empty body and three context lines — version, platform, time — and nothing else
- [ ] `Write to us: info@productory.eu` is visible without scrolling
- [ ] **Open email** opens the mail app addressed to `info@productory.eu` with the composed body, and Ritemark does **not** say the report was sent
- [ ] **Copy report** puts the whole report on the clipboard
- [ ] Cancel leaves nothing behind; reopening starts empty

### No acquisition promotion (Sprint 126, R4)

- [ ] Welcome page launch check shows Git and Node status with **no** "Click here to install" action
- [ ] Source Control works normally (Git is installed on this machine)

### Comments (Sprint 117)

- [ ] `@claude` in a comment → the Send line names the open conversation; status runs queued → working → completed; the agent's sentence lands under the note; the note, the highlighted passage and the Markdown are unchanged
- [ ] Status survives reload, reopen and restart
- [ ] **Mark as done** replaces the trash can on a finished comment
- [ ] Hovering the highlighted text opens its comment

### Dialog layout (Sprint 126)

- [ ] At a narrow AI sidebar, the report window and AI Information fill it edge to edge with no clipped text, and are not covered by the conversation rail

### Regression sweep

- [ ] Nothing from v1.10.1 broke: typing at speed, task lists, undo/redo, save without conflict warnings

**Gate 1 verdict:** passed. Candidate 2: Jarmo, 2026-09-16, *"ma olen RC ise läbi testinud - see on täiesti OK, et edasi minna ehk GATE 1 Approved"*. Candidate 3: Jarmo, 2026-09-17, *"GATE 1 approved - jätka x64-ga"*. The verdict was given for the gate as a whole; individual items above were not reported separately.

## ⛔ Gate 2 — Jarmo, on the x64 DMG (un-notarized) + Windows installer

This gate carries the **open Sprint 116 native-execution requirement**. It is not a formality: the runtime binaries were only proven on Apple Silicon.

### macOS x64 (Intel) — native, not Rosetta

- [ ] All three runtimes start and answer a turn natively. v1.10.1 noted `opencode` hits Rosetta's AVX limit under emulation, so a native Intel run is the only proof.
- [ ] App and all four agent binaries carry Team ID `JKBSC3ZDT5` and are x86_64

### Windows

- [ ] Installer signed by `Productory Services OÜ`; standard-user silent install, one Apps & Features entry at `1.11.0`, clean uninstall
- [ ] All three runtimes start and answer a turn
- [ ] **Report AI issue** appears and opens the window; **Open email** reaches the Windows mail handler
- [ ] **On a machine with no mail app configured:** the fallback shows the address and the full report with Copy, and reads as a normal outcome rather than an error
- [ ] **On a machine with no Git installed:** Source Control explains Git is needed and shows **no download button**. *This is the exact surface Microsoft flagged (10.1.5) and the one case that could not be exercised on the development machine.*

**Gate 2 verdict:** passed. Jarmo, 2026-09-18, *"pane edasi! Win ja x64 on testitud"*. The verdict was given for the gate as a whole; individual items above were not reported separately, so the Git-absent Windows case is not confirmed as seen on screen.

### Microsoft Store publication addendum — 2026-09-23

- [x] Microsoft certified and published Ritemark under public Store ID `XP9K8SP24TRNK4`.
- [x] Public listing observed at `https://apps.microsoft.com/detail/xp9k8sp24trnk4`, showing Ritemark, `Productory Services OÜ`, Productivity, and the approved description.
- [x] Jarmo confirmed Store-origin installation, launch, and uninstall.
- [x] Fresh anonymous direct-download stream returned HTTP 200, `444207592` bytes, SHA-256 `0ebda5016e432b2f039613f74665343220006e39e7749ddb76d285d0a87b932b`, ETag `"215bc154378ab2bf8ab4cce863ebaf9d"`, and `cache-control: public, max-age=31536000, immutable`.
- [ ] Store-origin edit/save was not separately stated in the owner confirmation.
- [ ] Clean Windows 11 / Smart App Control On remains a separate internal hardening check; Store certification does not prove it.

Store publication and the tested Store install path are complete. The two unchecked items above remain explicitly scoped evidence gaps and do not change the already-passed 2026-09-18 release Gate 2 verdict.

## Not verifiable before the gates

- The Git-absent branch of both surfaces. The guarantee in source is structural — `renderLaunchCheckItem` takes no action argument in either branch, and no `scm.missing` string has a line that parses to a single link — but it has never been seen on screen. Windows Gate 2 is the first opportunity.
- Microsoft's certification decision. This release clears findings and produces evidence; acceptance is an external outcome with its own timeline.
