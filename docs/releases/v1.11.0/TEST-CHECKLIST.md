# Ritemark 1.11.0 Test Checklist

Release evidence for v1.11.0 — Store Compliance + Agent Task Honesty. Product source commit: `a8343678e72a7d6d84606d30ee0d43cf4c409459`.

Shell-tier on two independent grounds: the Sprint 116 runtime binaries, and patch `016-ritemark-store-acquisition-policy` from Sprint 126.

## What is new, and therefore what has to be exercised

| Sprint | Change | Where it is tested |
|---|---|---|
| 116 | Claude Code 2.1.270, Codex 0.154.0, OpenCode 1.18.30 + refreshed model catalog | **Gate 2 carries the open gate** — native Intel and Windows execution was explicitly deferred here on 2026-09-14 |
| 117 | Comment→agent honesty: host-owned task ledger, real status, reply on the comment | Gate 1 |
| 126 | Report AI issue (status bar + AI Information → `info@productory.eu`); no Git/Node download offers | Gate 1 for reporting; **Windows for the Git-absent case** |

## Automated checks (before handover)

- [ ] `validate-qa.sh` exits 0 on the source commit
- [ ] Preflight passed in the release worktree (one expected warning: extension symlink created during build)
- [ ] `build-prod.sh` clean; committed `media/webview.js` reproduced byte-for-byte
- [ ] Embedded provenance records `target=darwin-arm64`, `sourceCommit=a8343678`, `vscodeCommit=10c8e557`
- [ ] All 16 patches applied, including `016-ritemark-store-acquisition-policy`
- [ ] `ritemarkVersion` is `1.11.0` in the built app

## Mounted arm64 DMG hard checks

- [ ] Extension present; `webview.js` byte-identical to the committed bundle
- [ ] `node_modules` complete (`check-bundled-extension-complete.sh`)
- [ ] App and DMG Team ID `JKBSC3ZDT5`; deep `codesign --verify --strict`; hardened runtime
- [ ] 0 zero-byte `.js` under `out/`; only `darwin-arm64` under `binaries/agents/`
- [ ] Bundled runtimes execute from the signed bundle: `claude` 2.1.270, `codex-app-server` 0.154.0, `opencode` 1.18.30
- [ ] `spctl` rejects — expected until notarized

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

**Gate 1 verdict:**

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

**Gate 2 verdict:**

## Not verifiable before the gates

- The Git-absent branch of both surfaces. The guarantee in source is structural — `renderLaunchCheckItem` takes no action argument in either branch, and no `scm.missing` string has a line that parses to a single link — but it has never been seen on screen. Windows Gate 2 is the first opportunity.
- Microsoft's certification decision. This release clears findings and produces evidence; acceptance is an external outcome with its own timeline.
