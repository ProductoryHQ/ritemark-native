# Audit: the extension host's first seconds (R15, #401)

Started 2026-10-18 on `sprint-133-welcome`. The Windows half waits for Windows round 2's numbers, which the Development manager's Windows session is measuring; this file is completed with them before the merge.

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

## What runs once per install

Everything that differs between the first start after an install or update and a later start is work on files the installer has just written:

- `extensions/ritemark/out/extension.js` (5.4 MB, one esbuild bundle) is read and compiled with a cold V8 code cache;
- the Agent SDK and other esbuild externals (`node_modules`, 452 MB in the app) are read for the first time;
- the bundled agents (`binaries/`, 620 MB) are spawned for the first time by the setup probes;
- on Windows, Defender scans each newly written file on first read or spawn (`MsMpEng`).

None of this is Ritemark's start-up logic; it is the cost of new files on disk. Whether that is all of #401 is what the Windows numbers decide: process start to extension host, MsMpEng's CPU during the start, a CPU profile of that first start, and a second start to compare.

## The decision (provisional until the Windows numbers)

- **If the first start's profile shows time inside `activate()` or a synchronous Ritemark step:** move it off the start path or make it asynchronous in this sprint, as #366 and #367 did.
- **If it is once-per-install work (Defender, a cold code cache):** record it in #401 and rely on R15's guarantee, which this sprint builds either way.

## R15's guarantee, built in any case

- The welcome's page draws from its own bundle as soon as the webview loads; it does not wait for any provider check.
- Each provider shows Checking… until its own check answers; a check with no answer after 20 s shows "Couldn't check. Try again." (R4).
- A click on Sign in while the host is busy is sent as a message; the host queues messages, so the click is acted on when the host answers. The card shows Checking… from the click until the host's next word about that AI (`welcomeState.ts`, `startSignIn` / `signInAnswered`, tested), so the Sign in button is gone and a second click can't start a second sign-in.
- The welcome's own start-up work is a few `globalState` reads and one webview panel, all after `activate()`'s synchronous part. It is profiled on Windows with the round's numbers, not yet on the branch.
