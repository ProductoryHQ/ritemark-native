# Release Plan — v1.10.1 Windows Codex Sandbox Hotfix

**Status:** Release candidate. Not built, not released. Both fixes are merged to `main`: [#261](https://github.com/ProductoryHQ/ritemark-native/pull/261) (sandbox helper binaries) and [#262](https://github.com/ProductoryHQ/ritemark-native/pull/262) (Windows runtime probe). Build commit is `743089a07665fb1182ee601d22c48e68d3720538`, confirmed equal to the `origin/main` tip.<br>
**Target:** v1.10.1<br>
**Release type:** Windows-only hotfix. Shell-tier (touches `extensions/ritemark/binaries/agents/`) — full app rebuild, not the extension lane<br>
**Platforms:** win32-x64 only. macOS stays on v1.10.0<br>
**Release owner:** Jarmo<br>
**Created:** 2026-09-07

## Why This Ships

v1.10.0 is public and `Latest` in `jarmo-productory/ritemark-public` (released 2026-09-05). Its Windows installer ships Codex with file and exec tools that fail on every turn in the default and recommended `workspace-write` sandbox mode:

```
orchestrator_helper_launch_failed: setup refresh failed to launch helper:
helper=codex-windows-sandbox-setup.exe, error=program not found
```

The manifest declared only `codex-app-server` and `codex-code-mode-host` for win32-x64. Codex's Windows sandbox path also spawns `codex-windows-sandbox-setup` and `codex-command-runner`, which the vendor publishes as separate release artifacts. Neither was present anywhere in the installed tree.

This is not a release candidate defect. It is a defect in users' hands, and the update feed currently serves it to every Windows install.

Setting the sandbox to full access appeared to work only because that path bypasses the sandbox and never spawns a helper — which is why the gap survived v1.10.0 validation.

## Why Windows-Only

Both helpers are Windows-only by construction: the vendor ships no darwin build, because on macOS the sandbox is the OS seatbelt rather than a spawned process. macOS v1.10.0 is unaffected, notarized and stapled. Rebuilding it would spend two Apple notarizations on a zero-byte product change.

## Scope Envelope

### In scope

- Manifest rows for `codex-windows-sandbox-setup` and `codex-command-runner` (win32-x64, Codex 0.153.0).
- Validator support for platform-scoped components and for components that cannot be smoke-tested.
- Runtime verification check asserting both helpers are installed beside `codex-app-server`.
- Version bump to 1.10.1 in `branding/product.json`, `branding/BRANDING.json`, `extensions/ritemark/package.json`.
- Windows installer rebuild, signing, upload, update feed, Partner Center resubmission.

### Out of scope

- macOS artifacts of any kind.
- Any extension-tier release while platforms sit on different versions (see Blocker 4).
- The pre-commit Check 11 gap and the `verify-agent-runtimes.sh` Windows portability bug (see Known Gaps) — separate fixes, deliberately not bundled into a hotfix.

## Release Sequence

Ordered. Each step blocks the next.

1. **Merge PR #261 to `main`.** `.github/workflows/build-windows.yml` is `workflow_dispatch` only and requires `source_commit` to equal canonical `origin/main`. A commit on an unmerged branch is not dispatchable.
2. **Repo private for the build.** The `windows-8core` larger runner does not run in a public repo. Restore public visibility immediately after. Human-authorized step.
3. **Build, sign, upload** the Windows installer from the approved `main` commit.
4. **Attach `update-feed.json` to the v1.10.1 release.** *Highest-risk step.* The stable feed URL is `releases/latest/download/update-feed.json`. The moment v1.10.1 becomes `Latest`, that URL resolves against v1.10.1's assets — a missing feed is a 404 for every user on every platform and update checking dies silently.
5. **New immutable download path** `/windows/v1.10.1/Ritemark-Setup.exe`. The v1.10.0 path must not be touched. Verified working host is `getritemark.com` (confirmed 2026-09-07: HTTP 200, correct size and SHA-256 for the v1.10.0 asset).
6. **Partner Center resubmission** with the new hash.

## Gates

- **Gate 1 (technical):** signed installer, correct publisher, manifest validator green, runtime verification green on the packaged build. Signed PE count must be **46**, not the 44 of v1.10.0.
- **Gate 2 (Jarmo tested):** must run against the **CI-built installer**, not a local drop-in. The original evidence proved the runtime contract, not the packaging — and packaging is where the defect was.

## Known Gaps (not fixed here)

- **The pre-commit hook was not installed on the Windows development machine at all.** `.git/hooks/pre-commit` did not exist and `core.hooksPath` was unset, so all twelve checks — including the symlink, bundle-freshness and Settings-stub invariants CLAUDE.md calls critical — were silently skipped for every commit made there. This, not a flaw in Check 11, is why `7249845c` landed without the matrix update that Check 11 requires. Measured: the check fingerprints the manifest as a multiset of `agent@version`, which went from 12 entries to 14 across that commit, so it would have fired. The first incident (`50a6ce16`, macOS `code-mode-host`, 9 to 12 rows) did update the matrix, so the check worked there too. Hook installed 2026-09-08 and verified passing; `scripts/setup.sh` still does not install it, which is the remaining fix.
- **A narrower Check 11 gap does exist.** The fingerprint is blind to component identity, platform and install name as long as the row count and versions are unchanged, so swapping one component for another under the same `agent@version` would pass unnoticed. Not what happened here.
- **`docs/development/agent-runtime-compatibility.md` is stale** — last updated 2026-09-03, with no mention of the two Windows sandbox helpers. It should have accompanied `7249845c` and is a genuine outstanding deliverable for this release.
- **`scripts/lib/verify-opencode.mjs:29` passes a Windows absolute path to a dynamic `import()`**, which Node's ESM loader rejects without `pathToFileURL()`. `verify-agent-runtimes.sh` therefore cannot complete on Windows: it reports three OpenCode failures that are harness crashes, not runtime defects. This weakens Gate 1 on the platform this release targets. Pre-existing since 2026-07-22 (sprint-100); not introduced by PR #261.

## Verification Evidence

Found and verified end to end on Windows 11 with Smart App Control in enforcement. With both vendor binaries in place the Codex sandbox log goes from "program not found" to "setup binary completed" plus a successful command-runner launch, and the agent answers a question that requires reading a file.

Codex 0.153.0 stages the runner as `codex-command-runner-0.153.0.exe`, so a stale unversioned copy left by an unrelated npm install does not satisfy it — both binaries must be bundled.
