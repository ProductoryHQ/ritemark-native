# A9: When does a Flow write itself? (R4, S27, S29, #571)

Run on 31 October 2026 on `main` at `39b4e37f`, with the committed `media/webview.js`, in a headless Chromium (nothing on screen). The runner is [`repro/a9-flow-save.mjs`](repro/a9-flow-save.mjs); it opens Sprint 144's flow harness (`v2.1.0/sprint-144-release-harness/research/repro/flow-step-panel/harness.html`) and reads its message timeline. Three runs per row.

```bash
node docs/development/releases/v2.2.0/sprint-145-loose-ends/research/repro/a9-flow-save.mjs --runs 3 [--select-at 400|1500|none] [--answer-save]
```

## Measured

| Case | `flow:save` after `flow:load` | `flow:save` after the click |
|---|---|---|
| The harness as Sprint 144 ran it: the step clicked 400 ms after load; the stand-in host never answers a save | 511, 514, 527 ms | 110, 111, 125 ms (the same save) |
| The flow opened, **nothing clicked** | 510, 514, 515 ms | — |
| The same, with the host answering `flow:saved` as `FlowEditorProvider.ts:120` does | 514, 514, 515 ms | — |
| Opened, the save answered, then **the step clicked 1.5 s after load** | 510–519 ms, then a second save | **518, 519, 520 ms** |

## What it shows

- **Opening a flow writes it** (S29 fails on `main`): one `flow:save` about 510 ms after `flow:load`, with no click. That is the 500 ms debounce in `FlowEditor.tsx:205–221`, started by a change to the node list right after the flow is drawn.
- **Selecting a step writes it again** (S27 fails on `main`): once the first save is acknowledged, a click posts another `flow:save` about 520 ms later, the same debounce.
- **There is no second write path.** The issue's "about 100 ms after the click" is the opening's save: the harness clicks 400 ms after load, and the save started at load lands 500 ms after it.
- Not measured: which change types React Flow sends at open and on a click (the harness logs messages, not store calls). `onNodesChange` sets `isDirty` for every change (`flowEditorStore.ts:386–395`), so the unit test of W4 pins the types (`select`, `dimensions` on one side; `position`, `add`, `remove`, `replace` on the other), and this runner is the check: after the fix both rows above show no `flow:save`.

## What this changes

R4 stands as written; its "second write path" criterion is answered (there is none), and "Opening a flow writes nothing" is now a check that fails on `main`, with the same cause. `spec.md` R4 carries this as a 31 October addendum. No tier change.
