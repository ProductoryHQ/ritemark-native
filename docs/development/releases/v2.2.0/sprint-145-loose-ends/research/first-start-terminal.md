# A4: A restored terminal before the welcome on Windows' first start (R10, S45–S47, #501)

31 October 2026: waiting for the "Ritemark on Windows" session. 1 November: the Windows half ran (S45), and PR 5 ran the Mac half (S47) and read VS Code 1.142's rule. The cause is shown, and the fix is in patch 019 (decision 3). No tier moves.

## The Windows half (S45), 1 November

Run by the "Ritemark on Windows" session, posted on [#501](https://github.com/ProductoryHQ/ritemark-native/issues/501). 1.14.0 with two fresh profiles, each with a project and a terminal in the AI column at quit: A with the AI in front, B with the terminal in front. Then 2.1.0's RC4 installer (`7852c9f3`) over it. The trace was a MutationObserver on each group's tabs plus two logpoints in `RitemarkTerminalTabs.moveToDesk`.

Seconds from launch:

| | A, first start (cold install) | A, warm second start | B, first start (warm install) |
|---|---|---|---|
| Window | 3.2 | 1.0 | 0.9 |
| Ritemark activating | 13.7 | 2.7 | 5.0 |
| Terminal comes to the front | 9.39 | never (restored behind the welcome) | 6.18 |
| Welcome takes the front | 20.24 | 1.67 | 6.54 |
| **Terminal in front for** | **10.85 s** | **0** | **0.36 s** |

A's first start:

```
9.30s  moveToDesk start   behind=true  terminals=[powershell] active=none editorsOnDesk=0
9.36s  moveToDesk openEditor powershell inactive=true activeBefore=none editorsOnDesk=0
9.39s  G1[*powershell]                      (active, because the group was empty)
9.50s  moveToDesk start   behind=false terminals=[] (the sweep, no-op)
20.24s G1[powershell, *Welcome]
```

**The cause is two things, one after the other.** Patch 019's `moveToDesk(true)` runs at the terminal service's `whenConnected` and opens the restored terminal on the desk with `inactive: true`; the desk is still empty then, so VS Code makes it the active editor anyway, and it stays in front until the extension activates and opens the welcome. Neither alone does it: without the sweep the terminal stays in the panel, and on a desk that already holds an editor (the warm start) "behind" works. How long the terminal is in front is the gap between the terminal service connecting and the welcome opening; on a cold install that gap is long (Defender reads the new files). 1.14's state at quit makes no difference. Gate 2's second flash of 0.2 s after the welcome did not reproduce.

## VS Code 1.142's rule for an editor opened `inactive` into an empty group

Read in PR 5's patched tree (`d956e8a6` with the 19 patches), `src/vs/workbench/browser/parts/editor/editorGroupView.ts`, `doOpenEditor`:

```ts
active: this.count === 0 || !options?.inactive,
```

An editor opened into a group with no editors is always the active one, whatever `inactive` says. So `inactive` means "behind the editor in front", and with no editor in front there is nothing to be behind. A4's guess on 31 October holds.

## The Mac half (S47), 1 November

One hidden dev instance of PR 5's tree (CoW clone, patched at the pin), launched once with `--inspect-brk-extensions`, so every extension host waits for a debugger until it is let go over the inspector (`Runtime.runIfWaitingForDebugger`): the Mac's stand-in for Windows' slow first start. Scratch AI homes, `--use-mock-keychain`, a short profile under `/private/tmp`, its own shared-data folder, CDP on a port checked to be free; each inspector's process was checked to be a child of this instance. The scenario needs a terminal in the panel and an empty desk at the start of a window: a fresh project folder (no saved tabs), with the extension held so it opens neither Home nor the welcome, a terminal made in the panel (`terminal.integrated.defaultLocation: view` for this step only) under a copy of `ritemarkTerminalTabs.js` that moves nothing, then Reload Window under the code being tested. The terminal comes back from the pty host into the panel, as 1.14's does into 2.x. Trace copies of the compiled file carried the Windows run's logpoints; a probe read the first desk's tabs every 30 ms. None of these copies is committed.

**main** (patch 019 as on `origin/main`), project `gamma-notes`, the extension let go at 27.75 s:

```
2.68s  moveToDesk start behind=true terminals=["Terminal"] active=none editorsOnDesk=0
2.68s  openEditor Terminal inactive=true activeBefore=none editorsOnDesk=0
2.70s  [*Terminal]
2.70s  moveToDesk start behind=false terminals=[] active=Terminal editorsOnDesk=1   (the sweep, no-op)
30.36s [Home | *Task board | Terminal]
30.39s [Home | Task board | *Terminal]
```

So the Mac shows it when the extension is slow, exactly as Windows does. Without a welcome (this was no update start) it is worse: the extension's tab check returns the person to "the tab they were on", which is now the terminal, so the terminal stays in front for good.

**PR 5**, project `delta-notes`, the extension let go at 18.1 s:

```
2.65s  moveToDesk start behind=true terminals=["Terminal"] active=none editorsOnDesk=0
2.65s  waiting for a document: ["Terminal"]
       (the desk stays empty, the terminal in the panel)
19.27s release, active=Home
19.27s openEditor Terminal inactive=true activeBefore=Home editorsOnDesk=1
19.29s [*Home | Terminal]
19.33s [*Home | Task board | Terminal]
```

**A terminal the person opens** (S47's second half), the same window: ⌃` at 33.2 s opened `[Home | Task board | *Terminal 2 | Terminal]`, in front and named Terminal 2, as before.

**No document ever comes** (the bound), project `epsilon-notes`, the extension held past a minute:

```
2.70s  waiting for a document: ["Terminal"]
62.70s release, active=none
62.70s openEditor Terminal inactive=true activeBefore=none editorsOnDesk=0
62.75s [*Terminal]
```

At the same moment VS Code gave up on the held extension host (`renderer.log`: "The local extension host took longer than 60s to send its ready message"), so no document would have come: the terminal opens, in front of the empty desk, and is never lost. That is VS Code's own limit for the extension host to start, which is why the wait is a minute.

## The fix (patch 019, PR 5)

`RitemarkTerminalTabs.moveToDesk(true)`: when the desk has no editor in front, the restored terminals wait in the panel and open behind the first editor that is not a terminal (`onDidActiveEditorChange`: the welcome, Home, a document), or after `RITEMARK_RESTORED_TERMINALS_WAIT_MS` (60 s) with none. A terminal tab the person opens meanwhile doesn't end the wait (it isn't a document), a waiting terminal closed meanwhile isn't opened, and the sweep still opens any other terminal that lands in the panel in front, as asked. A desk that already has an editor in front is unchanged: the terminals open behind it at once.

Checks: `ritemarkTerminalTabs.test.ts` (two new cases: the wait past a terminal tab and the sweep, then behind the document; the bound with one closed meanwhile; the existing cases unchanged), which fail on `main` (the module has no wait); the Mac traces above. The Windows proof is 2.2's candidate at Gate 2 (S46), because Windows CI builds only `main`.
