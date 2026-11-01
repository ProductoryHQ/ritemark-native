# A8: Where a dropped card's second goes, and whether a stuck read holds the board (R3, S18; R2)

Run on 31 October 2026 on the Mac, on `main` at `39b4e37f`. **Partly run:** the store's share and the tail question are measured; the full drop in a dev instance, with the controller's steps timed, is **not run yet** (it needs timers in `BoardController.ts`, which is PR 4's first step, before its fix).

## The store's share of a move (measured)

[`repro/a8-board-tail.ts`](repro/a8-board-tail.ts) builds a board of 40 cards (10 with an attached file) through the real `BoardStore` in a temp folder, then times a fresh store's first `list()`, a move (`mutate` to another stage with a new rank, as the controller's move does), and `list()` after it. Three runs each:

| File system | First `list()` (reads every card) | The move | `list()` after |
|---|---|---|---|
| The Mac's disk | 6–10 ms | 0–1 ms | 0 ms |
| Every read delayed 30 ms (a slow drive) | 1,309–1,331 ms | 34–36 ms | 0–1 ms |

```bash
cd extensions/ritemark && npx tsx ../../docs/development/releases/v2.2.0/sprint-145-loose-ends/research/repro/a8-board-tail.ts
```

On the Mac's disk the store's own work is a millisecond, so the second #597 sees on 2.1 (Mac) is **not the store's read, rank or write**. Where it goes is still to measure: the controller's `snapshot()` with a file-exists check per attached file, the change event's scheduled refresh, the round trip to the webview and its render. The first load of a board on a slow drive reads the cards one after another (40 × 30 ms ≈ 1.3 s).

## A stuck read holds every other move (measured)

The same script makes one card's read hang for 3 s inside `invalidate()` (what Try again or the watcher calls) and starts a move of another card at the same moment:

| | Try again (`invalidate`) ends | The move of another card ends |
|---|---|---|
| Three runs | 3,002–3,005 ms | **3,005–3,008 ms** |

Every read and write runs on the store's one tail (`serialized`), so a read that hangs (the issue's `ETIMEDOUT` from a cloud drive) holds every move, create and edit on the board until it gives up. That answers the risk in the plan: **Try again must not read under the store's lock.** W2 reads the file before the lock is taken and applies the result under it, with a test that a move of another card doesn't wait; W3's fix of the drop doesn't wait on it either.

## What this changes

- R3 stands. Its fix goes where the measurement in PR 4 shows the time, and the store is not it on a normal disk.
- R2's Try again reads outside the tail (already the plan's conditional branch, now confirmed). No spec change beyond that; no tier change.
