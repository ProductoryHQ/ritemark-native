# Audit A1 — the Windows build without the visibility toggle (#506)

Done on 27 October 2026 while planning. Each line says whether it was **measured** (a run, a log, an API answer, a file) or **inferred**.

## Why the toggle exists (measured, except where marked)

- `build-windows.yml` runs on `windows-8core`, a larger runner. GitHub: "By default, only private repositories can access runners in a runner group, but you can override this" (docs, *Controlling access to larger runners*), and "Larger runners are always charged for, even when used by public repositories" (docs, *GitHub Actions billing*). The `release` skill's Step 5 therefore makes the repository private for each build and public again.
- Each public → private change erases the repository's stars and watchers (#506). On 27 October the repository is public with 0 stars and 0 watchers (`gh api repos/ProductoryHQ/ritemark-native`).
- The org is on the GitHub Team plan (`gh api orgs/ProductoryHQ`). Its runner groups can't be read with this account's token (HTTP 403, needs `admin:org`), so which group holds `windows-8core`, and whether public repositories are allowed in it, is **inferred** from the toggle having been necessary.
- **The cost today:** October's bill is $29.53, all "Actions Windows 8-core": 703 minutes at $0.042 (billing usage API, 27 October). The last green 8-core build (run 40079413435, 2.0.1) took 48 minutes, about $2.0.
- **Free runners:** "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners" (docs, *GitHub Actions billing*). For public repositories the standard Windows runner is 4 CPUs, 16 GB of RAM, 14 GB of SSD, labels `windows-latest`, `windows-2025`, `windows-2025-vs2026`, `windows-2022` (docs, *GitHub-hosted runners*). A job may run up to six hours (docs, *Actions limits*).

## The probe (measured)

Run [40425970110](https://github.com/ProductoryHQ/ritemark-native/actions/runs/40425970110) on `scratch/sprint-144-free-runner-probe` (commit `93b457d8`), dispatched on 27 October at 00:22 UTC with `source_commit` = `origin/main` `c99a8596`. The branch carries `build-windows.yml` changed only to measure: `runs-on: windows-latest`, `timeout-minutes: 360`, no secrets (no signing, no Google OAuth client), the installer built unsigned, no installer uploaded, a sampler every 20 s (free disk on C: and D:, free memory, CPU) and a text report as the only artifact. Every other step is the release workflow's own: the canonical-source gate, `npm ci` with the retries, the extension's compile and staging, the patched-state gate, `gulp vscode-win32-x64-min`, provenance written and verified, `validate-build-output.sh win32-x64`, Inno Setup.

**Result: green, in 37.5 minutes, with the repository public throughout.**

| | Free `windows-latest` (probe) | `windows-8core` (2.0.1's run) |
|---|---|---|
| Image | `windows-2025-vs2026` 20261021.278 (the canary's) | `windows-2025-vs2026` 20261007.264 |
| CPU, RAM | 4 logical processors (AMD EPYC 7763), 16 GB | 8 cores |
| Queue | 4 s | — |
| Checkout (with the submodule) | 2.1 min | 1.8 min |
| `npm ci` in `vscode/` | **14.1 min** | 21.8 min |
| Patches + the patched-state gate | 1.6 min | 1.3 min |
| `gulp vscode-win32-x64-min` | **8.2 min** | 5.6 min |
| Provenance, validation | 0.6 min | 0.5 min |
| Signing (tools, catalog, sign, verify, validate) | not run | 2.3 min |
| Inno Setup | 7.9 min (unsigned) | 7.5 min (signed inside ISCC) |
| Standard-user install, update, start, uninstall | not run | 5.0 min |
| **Job** | **37.5 min** (to the unsigned installer) | **48.0 min** (everything) |

- **The work drive is D:, "Temporary Storage", 150 GB, 147 GB free at the start.** The workspace is `D:\a\ritemark-native\ritemark-native` and `RUNNER_TEMP` is `D:\a\_temp`. C: has 31 GB free. Lowest free on D: during the run: 132.2 GB. The build's tree was 14 GB at the end (`du -sh r/`), with `vscode/node_modules` 1.8 GB, the packaged app 901 MB, `.build` 431 MB and `out-vscode-min` 329 MB.
- **Memory:** lowest available 3.4 GB of 16 GB, at 00:47:38, inside the gulp build (`NODE_OPTIONS=--max-old-space-size=8192`).
- **CPU:** mean load 49.6%; 10 of 106 samples at 90% or more. The serialized native builds (`npm ci --foreground-scripts`) don't use four cores, so `npm ci` doesn't get slower on four. One sample each: `npm ci`'s 14.1 against 21.8 minutes is probably network and cache, not the runner (inferred).
- **The installer:** `Ritemark-Setup.exe`, 531 MiB unsigned, from `c99a8596` (2.0.1's signed one was 508 MiB, from older source).

## What the probe didn't run, and the estimate for the real job

- **Signing** uses Azure Artifact Signing (`azure/artifact-signing-action`), the Windows SDK's `signtool`, and NuGet's `Microsoft.ArtifactSigning.Client`; signing itself happens at Azure. The free runner has the same image family, so the same tools (inferred; proven by the first real run, S4). 2.3 minutes on the 8-core runner, mostly the signing call (inferred).
- **The round trip** (a standard user installs, updates from v1.14.0, starts and uninstalls) took 5.0 minutes on 8 cores; it starts the app twice, so allow 5–8 minutes on 4 (inferred).
- **Estimate for the whole job on the free runner: 45–50 minutes**, about what the 8-core runner takes today (inferred from the table). The current `timeout-minutes: 120` leaves more than twice that.

## A caution the probe found

The free runner documents **14 GB** of SSD, and this build's tree alone is 14 GB. Today the work drive has 150 GB, so the build fits with room, but that is more than GitHub promises. If GitHub ever gives the Windows runner only what it documents, the build would fail with a full disk mid-way. The cheap guard: the job's first step reads the work drive's free space and stops in seconds, with a clear message, below 30 GB (W1).

## The options

**A. The free standard runner, `windows-latest`, on the public repository.**
- Measured: it builds the release workflow's steps, green, in 37.5 minutes, with 132 GB to spare on its work drive and 3.4 GB of memory.
- Costs nothing from the Actions budget; frees the $40 a month for macOS larger runners or nothing.
- One workflow, one repository; the identity record and provenance unchanged (`source_commit` and `workflow_commit` both in ritemark-native).
- Change: one line (`runs-on`), two comments, the disk guard.
- Risks: disk beyond the documented 14 GB (the guard); a slower gulp (8.2 against 5.6 min); queue times on a busy day (4 s today, nothing paid while waiting).

**B. Allow the public repository into the 8-core runner's group** (an org setting, by an org owner).
- Keeps 48-minute builds at about $2 each.
- One setting; no workflow change but the docs.
- GitHub recommends larger runners only with private repositories: a fork's pull request whose workflow names `windows-8core` could then run on the paid runner. Today's fork approval policy is "first-time contributors" (`gh api …/actions/permissions/fork-pr-contributor-approval`); B would want "all external contributors". No secret reaches a fork's workflow either way.
- Changing an organization setting is Jarmo's (or an org owner's), not this sprint's.

**C. A private build repository.** Either a mirror the workflow pushes the release commit to, or a small private repository whose workflow calls ritemark-native's as a reusable workflow ("The assignment of GitHub-hosted runners is always evaluated using only the caller's context"; "Billing … is always associated with the caller").
- Keeps the 8-core runner at about $2 a build.
- Needs: the signing and OAuth secrets copied into a second repository; `actions/checkout` pointed at ritemark-native explicitly (in a called workflow the `github` context is the caller's); the harness identity (`github.sha`, `workflow_commit`) taken from a commit in another repository; a second place for the release path to break or drift.
- Provenance can keep naming the ritemark-native commit (`verify-release-source.sh` fetches `origin`, which would be ritemark-native), but the D1 split between product source and harness becomes two repositories.

## Recommendation

**A.** It is measured to fit, it is the smallest change, it costs nothing, and it keeps one workflow in one repository. B is the fallback if a real run on the free runner fails for a reason the probe couldn't see (signing, the round trip); C only if both fail.
