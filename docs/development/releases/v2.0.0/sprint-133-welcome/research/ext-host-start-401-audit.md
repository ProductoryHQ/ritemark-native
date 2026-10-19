# Audit: the extension host's first seconds (R15, #401)

Started 2026-10-18 on `sprint-133-welcome`; completed the same day with Windows round 2's numbers from the Development manager's Windows session.

## What is known

- **The issue (#401), 11 October, v1.13.0 RC on Windows:** about 8 s with nothing logged after `ritemark.ritemark` activated; the renderer reported the extension host unresponsive twice; three `onWillSaveTextDocument` saves aborted at 1750 ms. A profiled run the next day did not reproduce it (8.0 s, then 2.7 s, then 1.0 s on later fresh profiles), which fits a cold-cache cost better than a loop.
- **Jarmo's PC, 18 October (the plan):** the first start after a clean install or an update takes 32–54 s until fully up, the extension host starts 14–18 s late with three or four unresponsive periods; later starts take about 7 s; a fresh profile alone does not reproduce it.

## The Mac, 18 October

The installed v1.14.0, a fresh profile and extensions directory, an empty window (the welcome's case), started in the background with `--inspect-brk-extensions`; a CPU profile at 0.25 ms from the extension host's first instruction for 25 s, and an event-loop monitor (gaps over 50 ms).

| Measure | Value |
|---|---|
| Ritemark's `activate()` (`activate2` in the bundle) first runs | 535 ms after the host's first instruction |
| `activate()`'s synchronous time | 23 ms |
| Longest event-loop gaps | 186 ms and 133 ms (module loading before activation) |
| Largest self time | `wrapSafe` (compiling CommonJS) 169 ms, `readFileSync` 73 ms, ESM loading ~120 ms |

Nothing in Ritemark's start-up code holds the host on the Mac. The Claude and Codex probes run as child processes without blocking (`utils/runProcess.ts`, v1.12.0, #366 and #367).

## Windows, 18 October (round 2)

Main `f492948b`, installed over round 1 on Jarmo's own profile (the real update case), the extension host profiled with `--inspect-brk-extensions` (about 0.2 s pause). Seconds from the log session's start:

| Start | Extension host started | Ritemark activated | Eager activation done | Unresponsive | `readFileSync` in the extension host |
|---|---|---|---|---|---|
| 1st after install | 10.6 | 12.7 | 26.4 | 6.0 s, 0.6 s | 7,763 ms |
| 2nd start | 5.6 | 6.0 | 9.6 | none | 202 ms |
| 1st after reinstalling the same build | 10.9 | 13.0 | 25.7 | 5.5 s, 0.4 s | 7,772 ms |

- On a first start the extension host is busy for about 20 s, 79% of it in `readFileSync`: module loads through `extensionHostProcess.js`'s `_load`, `undici` and `@vscode/proxy-agent`.
- Ritemark's own CPU stays at about 6% of 16 cores.
- Defender (`MsMpEng`) averaged 6.6% of the machine (peak 18.7%) on the reinstall's first start, 2.5% on the second, 0.5% idle.
- The same build's second start reads the same files in 202 ms. What differs is files the installer has just written, which Defender scans on their first read. No security setting was changed.
- The CPU profiles and samples stay on the Windows PC (they hold Windows user paths).

## A second lead: the V8 code cache

The Windows session noticed that Ritemark's `product.json` has no `commit` (`""` on Windows, no key on the Mac's v1.14.0), and VS Code keeps a code cache only with one (`src/main.ts`, `getCodeCachePath`). Checked here:

- **What the cache covers.** In VS Code 1.117 the code cache is the windows' (`v8CacheOptions: 'bypassHeatCheck'`, `windowImpl.ts:711`), the session's (`app.ts:387`) and the shared process's. Nothing turns on a compile cache for the extension host. So a missing commit cannot explain #401's extension-host time: those 20 s are file reads, with or without a cache.
- **What it costs.** On the Mac, the installed v1.14.0 on a fresh profile, warm OS cache: loading the window's main bundle (`code/willLoadWorkbenchMain` to `code/didLoadWorkbenchMain`) takes 302–307 ms over three starts, and `CachedData` stays empty. That is the most a cache could save there; with it the compile part would come from the cache on the second start onward.
- **Not measured with a commit.** Stamping one into a copy of the signed app broke the bundle's seal, and macOS refused to start the copy (it showed a Gatekeeper prompt). A with/without number needs a build made with a commit: a follow-up, measured on the Mac and Windows from clean-room builds.
- **What else reads `product.commit`** (VS Code 1.117, desktop):
  - VS Code's update service: off without `updateUrl`, which Ritemark doesn't set (`abstractUpdateService.ts:158`).
  - The extensions scanner: one more part of its cache key (`extensionsScannerService.ts:503`), so the cache would be dropped per build; the key already has the version, date and folder times, so Ritemark's extension updates are unaffected.
  - The extension host's version check compares the window's and its own `product.json` (`extensionHostProcess.ts:342`): the same file, so it passes.
  - The integrated browser's reported revision (`browserViewGroup.ts:154`), the About dialog, the issue reporter and startup timings: text only.
  - Telemetry's common properties (shared process): sent only with VS Code telemetry, which Ritemark keeps off.
  - Inert for Ritemark: emergency alerts, Settings Sync, the extension gallery's headers, the web worker extension host's CDN template, remote servers' paths (`network.ts:257`); Ritemark sets none of those endpoints.
  - The integrity check stores a commit with its "don't show" choice; patch 004 skips the check.
  - The code-cache cleaner deletes caches of other commits, which keeps `CachedData` to the current build.

## What runs once per install

Everything that differs between the first start after an install or update and a later start is work on files the installer has just written:

- `extensions/ritemark/out/extension.js` (5.4 MB, one esbuild bundle) is read and compiled with a cold V8 code cache;
- the Agent SDK and other esbuild externals (`node_modules`, 452 MB in the app) are read for the first time;
- the bundled agents (`binaries/`, 620 MB) are spawned for the first time by the setup probes;
- on Windows, Defender scans each newly written file on first read or spawn (`MsMpEng`).

None of this is Ritemark's start-up logic; it is the cost of new files on disk. Whether that is all of #401 is what the Windows numbers decide: process start to extension host, MsMpEng's CPU during the start, a CPU profile of that first start, and a second start to compare.

## The decision (18 October)

#401's time is once-per-install work outside Ritemark's code: Defender scanning the files the installer just wrote, as they are first read. Ritemark's `activate()` is not the cause (6% CPU on Windows, 23 ms synchronous on the Mac). Per the plan's rule, nothing moves in `activate()` in this sprint; #401 gets these numbers, and R15's guarantee holds the welcome usable meanwhile.

The missing commit is a separate, smaller matter: it costs each window its compile cache, not the extension host's first start. Stamping the source commit at build time (shell-tier: `build-prod.sh`, `build-prod-windows.sh`, the Windows CI) is proposed as its own change, measured with and without on clean-room builds; it is not in this PR.

## R15's guarantee, built in any case

- The welcome's page draws from its own bundle as soon as the webview loads; it does not wait for any provider check.
- Each provider shows Checking… until its own check answers; a check with no answer after 20 s shows "Couldn't check. Try again." (R4).
- A click on Sign in while the host is busy is sent as a message; the host queues messages, so the click is acted on when the host answers. The card shows Checking… from the click until the host's next word about that AI (`welcomeState.ts`, `startSignIn` / `signInAnswered`, tested), so the Sign in button is gone and a second click can't start a second sign-in.
- The welcome's own start-up work is a few `globalState` reads and one webview panel, all after `activate()`'s synchronous part. It is profiled on Windows with the round's numbers, not yet on the branch.
