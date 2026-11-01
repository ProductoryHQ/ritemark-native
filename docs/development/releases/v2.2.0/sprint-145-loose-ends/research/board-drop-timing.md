# R3: where a dropped card's second goes, measured before the fix (S18)

Run on 1 November 2026 on the Mac, `main` at `39b4e37f`, for PR 4 (#597). This finishes A8 (`board-timing.md`, on PR 1's branch `sprint-145-loose-ends`), which measured the store alone: a move costs the store about 1 ms, and a stuck re-read holds every other move. Here the whole drop is timed, in a dev instance and through the real controller.

## How

- **The host, step by step:** [`repro/r3-drop-timing.ts`](repro/r3-drop-timing.ts) builds a 40-card board (10 cards name a file that exists) and times the real `BoardController.move()` (To do → Doing, at the end, as a drop sends it) and the `snapshot()` every surface is sent after it. Three runs each on the Mac's disk, with every card read +30 ms, and with every file check (`stat`) +30 ms.
- **The whole drop:** a hidden dev instance of `main` (isolated profile, CDP), a 40-card scratch project seeded through the real `BoardStore`. A drop is dispatched as DOM drag events inside the board's webview (the handlers a real drag reaches; CDP's intercepted drag sticks after one drop). Inside the webview: the drop event, the host's answer (`board/result`), the next snapshot (`board/state`), the card's tile appearing in its new column, and the frame after it.
- **A folder with delays:** a local hook in the dev build's board file system (never committed) added a delay to every card read, card write and file check, read live from a config file.

## The host's share (`main`)

| File system | `move()` | its two `list()` calls | its write | `snapshot()` | its file checks |
|---|---|---|---|---|---|
| The Mac's disk | 1.0–2.9 ms | 0.2–0.8 ms | 0.7–1.8 ms | 0.4–0.9 ms | 10, in parallel |
| Card reads +30 ms | 34–36 ms | 0.6–0.8 ms | 33–35 ms (it reads the card first) | 1–2 ms | |
| File checks +30 ms | 2–3 ms | | | 31–32 ms | 10 × 30 ms, in parallel |

## The whole drop (`main`, dev instance; ms after the drop)

| Folder | Host's answer | Snapshot | Card in its new column | Painted |
|---|---|---|---|---|
| The Mac's disk (9 drops) | 4–7 | 8–13 | **8–13** | 16–17 (the first frame) |
| Every operation +30 ms (5 drops) | 69–95 | 110–131 | **110–131** | 110–134 |
| Every operation +300 ms (3 drops) | 609–889 | 921–1,203 | **921–1,203** | 921–1,203 |

## Where the second goes

- **Not on the Mac's own disk.** There the card is in its column 8–13 ms after the drop, inside the first frame; the host's whole share is about 2 ms.
- **On a slow folder, into the move's own read and write of the card file, and then the snapshot's file checks.** With 300 ms per file operation the card lands 0.9–1.2 s after the drop: about two thirds is `move()` reading and writing the card's file (it can't answer before the file is written), one third is `snapshot()` checking that each file a card names still exists. That is the second #597 describes. A cloud-synced folder is the likely slow folder (#596's board timed out reading three cards), but Jarmo's board was not measured, so that is a reading, not a finding.
- **And a stuck read holds every move.** A re-read that hangs for 3 s (the watcher, or Try again) holds a move of another card for 3,006–3,009 ms (three runs), as A8 found.

## What the fix does, by where the time goes

- **The card no longer waits for any of it.** The surface that moves a card draws the move at once and lets the host's answer confirm or undo it (spec R3). The write and the snapshot still take what they take on a slow folder; nobody watches them.
- **Re-reads leave the store's tail.** The watcher's re-read and Try again read the file outside the tail and apply the result under it, only while no newer write, load or read has overtaken it.
- **The snapshot is not made cheaper.** Its file checks are about 1 ms on the Mac's disk and a third of the wait on a slow folder; with the move drawn at once, they only delay the other surfaces (the side bar's list), which by design show a move once it is saved. Caching them would weaken "a named file's presence is live" for no visible gain. If the side bar's lag matters on cloud folders, that is its own change.

## After (this branch, same instance and project)

| Folder | Card in its new column | Painted | Host's answer | Snapshot |
|---|---|---|---|---|
| The Mac's disk (9 drops) | 3.5–7 | 16–18 | 5–11 | 8–16 |
| Every operation +30 ms (4 cross-column drops) | 3.6–6 | 16–17 | 66–68 | 102–110 |
| Every operation +300 ms (2 cross-column drops) | 5–7.4 | 16–17 | 611–613 | 923–928 |
| Every operation +900 ms (the quiet sign, 3 drops) | 4–9 | 17–24 | 1,808–1,825 | 2,718–2,739 |

The card is drawn before the host answers in every drop, and painted in the first frame. With +900 ms the move is still pending after a second, so the card shows the quiet sign in its ⋯ slot until the snapshot confirms it (`qa/r3-saving-sign*.png`).

| A re-read that hangs 3 s, and a move of another card | Re-read ends | Move ends |
|---|---|---|
| `main` (3 runs) | 3,002 ms | 3,006–3,009 ms |
| This branch (3 runs) | 3,001 ms | **1–2 ms** |

## Not measured

- **A real drag through macOS.** CDP's drag bypasses the system's drag session, so anything macOS adds around a drop is not in these numbers. The move is now drawn on the drop event itself, so that time, if any, no longer delays the card either.
- **A cloud-synced folder.** This Mac's cloud folders belong to Jarmo's own accounts, so no scratch board was put in one; the delays above stand in for it.

## Re-run

```bash
cd extensions/ritemark && npx tsx ../../docs/development/releases/v2.2.0/sprint-145-loose-ends/research/repro/r3-drop-timing.ts
```

The dev-instance runs used the hook below in `taskBoardHost.ts`'s file system (reverted before the commit), a config file such as `{"readDelayMs":300,"writeDelayMs":300,"statDelayMs":300}`, and drops dispatched over CDP:

```ts
const tfs = () => { try { return JSON.parse(require('fs').readFileSync('/private/tmp/rmb4/boardfs.json', 'utf8')); } catch { return {}; } };
// readFile: await sleep(tfs().readDelayMs); throw ETIMEDOUT for names in tfs().timeout; then the real read
// writeFile: await sleep(tfs().writeDelayMs); trash: throw EPERM for names in tfs().trashFail
// fileExists: await sleep(tfs().statDelayMs) before the stat
```
