# A2: startup marks on Windows (installed 2.1.0)

Measured on 1 November 2026, 23:37–23:47, by the "Ritemark on Windows" session, for Sprint 152's audit A2.

## The PC and its state

- **Hardware:** Windows 11 Pro 10.0.26300, AMD Ryzen 7 5825U (8 cores, 16 threads), 15.3 GB RAM. The perfview reported 5.2 GB free during the runs.
- **Ritemark:** 2.1.0 (7852c9f3), the per-user install at `%LOCALAPPDATA%\Programs\Ritemark`. It was reinstalled at 19:20 the same day, at the end of the #501 rerun.
- **Power:** on AC, battery at 100 %.
- **Defender:**
  - Real-time protection was on.
  - No scan ran: the last quick scan was 29 Oct, 23:24–23:27, and Defender logged no events during the runs.
  - MsMpEng's CPU use during each start is under the table below.
- **Modern Standby:**
  - Windows logged "entering Modern Standby (idle timeout)" at 18:57, and no exit before or during the runs.
  - The console was locked and nobody was at the PC.
  - Standby didn't seem to slow the runs:
    - the processor ran at 93–100 % of its rated performance;
    - the workbench reported itself `visible` and focused;
    - `requestAnimationFrame` fired.
- **Last boot:** 29 Oct, 05:15, 3 days and 18 hours before the runs.

## The starts

- **No start after a reboot.** Ritemark had run many times since the boot (the Sprint 145 and #501 checks, last at 19:26 that day), and a reboot was ruled out. So there is no "first start since boot" row.
- **p1, the closest to cold:**
  - the first start of a new scratch profile, 4 h 11 min after the last Ritemark start;
  - Defender scanned on read for the whole first 30 s, with MsMpEng at about one core.
- **w1–w4, warm:** the same profile, started again right after each quit. Each quit was a `WM_CLOSE`, then a wait of 5–18 s until all the profile's processes were gone.

### How each start ran

- **The command:**
  ```
  Ritemark.exe --remote-debugging-port=9233 --user-data-dir <scratch> --extensions-dir <empty scratch> --shared-data-dir <scratch> <scratch project with Notes.md>
  ```
  - It used the test channel, with usage data off.
  - It had throwaway Claude, Codex and XDG homes, and was signed in to nothing.
- **Launch time:** taken just before `Process.Start`. Nothing attached to the app before +45 s.
- **What was read after +45 s:**
  - **Renderer marks:** `performance.getEntriesByType('mark')` plus `performance.timeOrigin`.
  - **Main-process marks:** `vscode.context.configuration().perfMarks`.
  - **Developer: Startup Performance:**
    - It is hidden from Ritemark's command palette, so a keybinding in the scratch profile opened it.
    - Its full text was taken from the workbench through a logpoint at the model's `setValue`. That text includes the extension host's raw marks and the Extension Activation Stats.
    - Its tab was then closed, so the next start restored the same desk.
  - **A cross-check:** the `exthost.log` line `_doActivateExtension ritemark.ritemark`. It matches `code/extHost/willLoadExtensionCode/ritemark.ritemark` to the millisecond.

## Seconds from launch

| Mark | p1 | w1 | w2 | w3 | w4 |
| --- | --- | --- | --- | --- | --- |
| main `code/didStartMain` | 1.55 | 0.19 | 0.19 | 0.20 | 0.19 |
| renderer `code/timeOrigin` | 2.67 | 0.60 | 0.62 | 0.62 | 0.65 |
| **`code/didRemovePartsSplash`** | **5.17** | **1.65** | **1.71** | **1.67** | **1.73** |
| **`code/didStartWorkbench`** | **5.32** | **3.49** | **3.56** | **3.49** | **3.59** |
| `code/willLoadExtensions` | 5.38 | 1.81 | 1.86 | 1.82 | 1.88 |
| **`code/didLoadExtensions`** | **7.19** | **2.11** | **2.14** | **2.10** | **2.16** |
| `code/extHost/ready` | 7.66 | 2.51 | 2.57 | 2.52 | 2.60 |
| Ritemark: code loading starts | 9.91 | 2.66 | 2.71 | 2.66 | 2.74 |
| Ritemark: `activate()` called | 17.00 | 3.28 | 3.34 | 3.28 | 3.37 |
| **Ritemark activated** (`code/extHost/didActivateExtension/ritemark.ritemark`) | **17.20** | **3.42** | **3.49** | **3.42** | **3.52** |
| ext host log: "Eager extensions activated" | 26.79 | 4.59 | 4.68 | 4.60 | 4.78 |

**Ritemark's activation stats** (milliseconds):

| Start | Load code | Call activate | Finish activate | Event |
| --- | --- | --- | --- | --- |
| p1 | 7011 | 189 | 6 | `*` |
| w1–w4 | 584–595 | 132–140 | 4 | `onWebviewPanel:ritemark.home` |

**The workbench's code cache** (`import(workbench.desktop.main.js)`):

| Start | Time | Cached data |
| --- | --- | --- |
| p1 | 1217 ms | no (a new profile has none yet) |
| w1–w4 | 494–528 ms | yes |

**Defender (MsMpEng)**, sampled once a second, in % of one core:

| Start | MsMpEng | Whole CPU |
| --- | --- | --- |
| p1 | about 100 through the first 30 s (peaks of 216 at 7 s and 467 at 28 s) | 8–43 % until 27 s |
| w1–w4 | peaks of 126–164 at 6 s, at most 11 after 10 s | — |

## What it means for how long a released slot waits

- **Warm starts:**
  - Ritemark is active 1.75–1.79 s after `didRemovePartsSplash`, and 1.31–1.36 s after `didLoadExtensions`.
  - The restored Home and Task board tabs are what activate it (`onWebviewPanel:ritemark.home`).
  - `didStartWorkbench` waits for those tabs, and comes 0.07 s after Ritemark's activation.
- **p1, the closest to cold:** Ritemark is active 12.0 s after `didRemovePartsSplash`, and 10.0 s after `didLoadExtensions`. That time breaks down as follows:
  - **2.2 s:** the extension host first loads vscode.github-authentication and vscode.emmet, about 1.1 s each. vscode.git loads after Ritemark.
  - **7.0 s:** Ritemark's own code loading, with Defender scanning at about one core. A warm start takes 0.59 s for the same load.
  - **0.2 s:** the activation itself.
- **In p1 nothing was restored, because the profile was new.** So `didStartWorkbench` (5.32 s) came 11.9 s before Ritemark was active. Home and the Task board opened only after Ritemark activated.
- **A start after a reboot, an install or an update can be slower than p1.** In those cases the files may not be in the file cache at all.
  - The 18 October measurement for #401 was a first start after an install. It was ready in about 26 s, with 7.8 s of file reads in the extension host.
  - p1's "Eager extensions activated" at 26.8 s is in the same range.
- **Every start here had Ritemark active well inside the 60 s bound.** The slowest was 17.2 s.

## Raw data

The raw data is kept on the test PC, in `Downloads\rm-152`. For each start there are:
- the perfview text;
- the marks as JSON;
- `exthost.log`;
- the CPU and Defender samples.

There is also a screenshot of the Startup Performance view from w4.
