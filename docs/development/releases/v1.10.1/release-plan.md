# Release Plan — v1.10.1 Codex Reliability

**Status:** Release candidate. Not built, not released. The Codex sandbox and runtime-probe fixes are merged to `main` ([#261](https://github.com/ProductoryHQ/ritemark-native/pull/261), [#262](https://github.com/ProductoryHQ/ritemark-native/pull/262), [#263](https://github.com/ProductoryHQ/ritemark-native/pull/263)). The Codex onboarding loop fix is still in progress; the build commit is chosen only after it lands.<br>
**Target:** v1.10.1<br>
**Release type:** Full app distribution, all three platform artifacts. Shell-tier — touches `extensions/ritemark/binaries/agents/`, so a full rebuild, not the extension lane<br>
**Platforms:** darwin-arm64, darwin-x64, win32-x64<br>
**Release owner:** Jarmo<br>
**Created:** 2026-09-07 · **Widened to all platforms:** 2026-09-08

## Why This Ships

v1.10.0 is public and `Latest` in `jarmo-productory/ritemark-public` (released 2026-09-05). Two defects in it reach users now.

**Codex file and exec tools are dead on Windows.** In the default and recommended `workspace-write` sandbox mode, every turn that reads or writes a file fails:

```
orchestrator_helper_launch_failed: setup refresh failed to launch helper:
helper=codex-windows-sandbox-setup.exe, error=program not found
```

The manifest declared only `codex-app-server` and `codex-code-mode-host` for win32-x64. Codex's Windows sandbox path also spawns `codex-windows-sandbox-setup` and `codex-command-runner`, which the vendor publishes as separate release artifacts. Neither was present anywhere in the installed tree. Setting the sandbox to full access appeared to work only because that path bypasses the sandbox entirely and never spawns a helper — which is why the gap survived v1.10.0 validation.

**The Codex onboarding pane loops, on every platform.** With no Claude account signed in, choosing "Use Codex" brings up a setup pane that disappears and returns on a roughly two-second cycle, making it very hard to click. `CodexRuntime.startLoginPolling()` polls status every 2000 ms; each push re-derives runtime availability, and a transient `checking` state flips `showCodexSetup` false, unmounting the pane, before the next tick brings it back. Verified present in v1.10.0 too, so it is not a regression — but it is the first thing a new user without a Claude account meets.

## Why All Three Platforms

The original plan shipped Windows-only, reasoning that the sandbox helpers have no darwin build and macOS would gain nothing from two Apple notarization cycles. That reasoning no longer holds — v1.10.1 now carries three cross-platform fixes:

| Fix | Windows | macOS |
|---|---|---|
| Codex Windows sandbox helpers | applies | not applicable — the sandbox is the OS seatbelt |
| Codex onboarding loop | applies | applies |
| [#254](https://github.com/ProductoryHQ/ritemark-native/issues/254) trailing newline lost when saving a document ending in a list | applies | applies |
| [#194](https://github.com/ProductoryHQ/ritemark-native/issues/194) Home shows the wrong recent documents | applies | applies |

Shipping Windows-only would leave macOS users with a looping onboarding pane and two editor defects, for no reason other than build cost.

It also removes a standing hazard: while platforms sit on different versions, no extension-tier release is safe, because `isExtensionCompatible` requires an exact `appVersion` match and an extension built on 1.10.1 would leave anyone still on 1.10.0 blocked with no way out.

## Scope Envelope

### In scope

- Manifest rows for `codex-windows-sandbox-setup` and `codex-command-runner` (win32-x64, Codex 0.153.0).
- Validator support for platform-scoped components and for components that cannot be smoke-tested.
- Runtime verification check asserting both helpers are installed beside `codex-app-server`.
- The Codex onboarding loop fix, with a regression test proving a transient `checking` tick does not change the rendered view.
- Version 1.10.1 in `branding/product.json`, `branding/BRANDING.json`, `extensions/ritemark/package.json`.
- Three signed artifacts: arm64 DMG, x64 DMG, Windows installer. Both DMGs notarized and stapled.

### Out of scope

- [#195](https://github.com/ProductoryHQ/ritemark-native/issues/195) (Browser Recent never records in-panel browsing) and [#260](https://github.com/ProductoryHQ/ritemark-native/issues/260) (a post-build worktree stays permanently BLOCKED). Real, but neither blocks this release.
- The Windows release-guard test-harness work, and the `store_url` host correction that is stuck behind it. See Known Gaps.

## Release Sequence

Follows the `release` skill's full-DMG workflow. Steps on macOS require a Mac with Apple credentials — there is no CI workflow for darwin-arm64.

1. **Land the onboarding loop fix**, then fix the build commit to the resulting `origin/main` tip.
2. **macOS arm64 (Mac):** build locally, sign, DMG, hardening period, notarize, staple.
3. **Dispatch CI builds** for Windows and macOS x64. Both are `workflow_dispatch`-only and require `source_commit` to equal canonical `origin/main`. The repo must be private for the `windows-8core` runner; restore public visibility immediately after the build.
4. **macOS x64 (Mac):** download the CI artifact, sign, hardening period, notarize, staple.
5. **GitHub Release + update feed.** *Highest-risk step.* The stable feed URL is `releases/latest/download/update-feed.json`; the moment v1.10.1 becomes `Latest`, that URL resolves against its assets. A missing feed is a 404 for every user on every platform, and update checking dies silently. Publishing all three artifacts together also keeps every other `latest/download` link valid — the platform-partial hazard that forced the download links in `README.md` and `docs/user/getting-started.md` to be pinned to explicit tag URLs.
6. **Windows store channel:** new immutable path `/windows/v1.10.1/Ritemark-Setup.exe`; do not touch the v1.10.0 path. Verified working host is `getritemark.com` — `downloads.ritemark.app` has never resolved (DNS failure, recorded in `docs/microsoft-store-submission/evidence/url-check-2026-09-01.md` and re-confirmed 2026-09-08). Partner Center resubmission with the new hash.
7. Give `## [1.10.1]` in `docs/CHANGELOG.md` its real release date.

## Gates

- **Gate 1 (technical):** three signed artifacts; Windows publisher `Productory Services OÜ`; both DMGs notarized, stapled and Gatekeeper-accepted; manifest validator green; runtime verification green. **Windows signed PE count must be 46, not the 44 of v1.10.0** — that delta is the direct evidence both sandbox helpers are packaged.
- **Gate 2 (Jarmo tested):** must run against the CI-built installer and the real DMGs, never a local drop-in — the v1.10.0 defect was in packaging, so a local drop-in proves the wrong thing. Must cover Codex file read/write in `workspace-write` mode on Windows, and the Codex onboarding pane staying put on both platforms.

## Known Gaps

- **The release-guard test suites cannot run on Windows.** `scripts/test-release-source-integrity.sh` and `scripts/test-worktree-hygiene.sh` are invoked only by the pre-commit hook and `scripts/validate-qa.sh` — never in CI — and both fail under Git Bash on POSIX-only assumptions: `ln -s` silently deep-copies, audit output carries native Windows paths while assertions are built from MSYS paths, and `create-release-worktree.sh` hands an absolute POSIX path to Node through MSYS path conversion. Partial fixes exist and pass for the first two. They are held for a commit made on macOS, because every affected file is itself on Check 12's trigger list — on Windows the gate blocks its own repair.
- **`store_url` in `build-windows.yml` still points at `downloads.ritemark.app`.** It is written into `Ritemark-Setup.sha256.txt` and read by nothing automated, so it affects only Partner Center data entry — needed before step 6, not before the build. Blocked on the same Check 12 deadlock.
- **A narrower Check 11 gap.** The manifest fingerprint is a multiset of `agent@version`, blind to component identity, platform and install name when row count and versions are unchanged. Swapping one component for another under the same version would pass unnoticed.
- **An existing checkout that never re-ran `scripts/setup.sh` still has no pre-commit hook.** `.git/hooks` is not tracked, so it starts empty in every clone. setup.sh now installs it; the machine that skipped that step is unguarded until it runs again.

## Verification Evidence

The sandbox-helper fix was found and verified end to end on Windows 11 with Smart App Control in enforcement. With both vendor binaries in place, the Codex sandbox log goes from "program not found" to "setup binary completed" plus a successful command-runner launch, and the agent answers a question that requires reading a file.

Codex 0.153.0 stages the runner as `codex-command-runner-0.153.0.exe`, so a stale unversioned copy left by an unrelated npm install does not satisfy it — both binaries must be bundled.

The first CI build of this release (run `34245024049`, commit `0466a233`) passed all 45 steps, including the standard-user install/uninstall verification that had failed on the previous six Windows runs, and reported the expected 46 signed PEs. That build is superseded by the onboarding loop fix, but it established that the Windows pipeline and the packaging fix both work.
